/**
 * WebhookSender - HTTP delivery with retry logic
 *
 * Handles sending webhooks with exponential backoff retry
 */

import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { EventEmitter } from 'events';
import {
  WebhookConfig,
  WebhookPayload,
  WebhookDelivery,
  DeliveryStatus,
  WebhookTestResult,
} from './types';
import { WebhookSigner } from './WebhookSigner';

/**
 * Send result
 */
export interface SendResult {
  success: boolean;
  responseCode?: number;
  responseTime?: number;
  errorMessage?: string;
}

/**
 * WebhookSender options
 */
export interface WebhookSenderOptions {
  maxConcurrent?: number;  // Max concurrent sends (default: 10)
  defaultTimeout?: number; // Default timeout in ms (default: 5000)
}

/**
 * WebhookSender class for HTTP delivery
 */
export class WebhookSender extends EventEmitter {
  private options: WebhookSenderOptions;
  private pendingSends: number = 0;

  constructor(options: WebhookSenderOptions = {}) {
    super();
    this.options = {
      maxConcurrent: options.maxConcurrent || 10,
      defaultTimeout: options.defaultTimeout || 5000,
    };
  }

  /**
   * Send a webhook payload
   * @param config - Webhook configuration
   * @param payload - Payload to send
   * @returns Send result
   */
  async send(config: WebhookConfig, payload: WebhookPayload): Promise<SendResult> {
    // Wait if at max concurrency
    while (this.pendingSends >= this.options.maxConcurrent!) {
      await this.sleep(100);
    }

    this.pendingSends++;

    try {
      const startTime = Date.now();

      // Sign the payload
      const signer = new WebhookSigner(config.secret);
      const signedPayload: WebhookPayload = {
        ...payload,
        signature: signer.sign(payload),
      };

      // Send HTTP request
      const result = await this.sendHttpRequest(config, signedPayload);

      const responseTime = Date.now() - startTime;

      if (result.success) {
        this.emit('sent', {
          webhookId: config.id,
          eventId: payload.id,
          responseCode: result.responseCode,
          responseTime,
        });
      } else {
        this.emit('failed', {
          webhookId: config.id,
          eventId: payload.id,
          error: result.errorMessage,
          responseCode: result.responseCode,
          responseTime,
        });
      }

      return {
        ...result,
        responseTime,
      };
    } finally {
      this.pendingSends--;
    }
  }

  /**
   * Send with retry logic
   * @param config - Webhook configuration
   * @param payload - Payload to send
   * @param delivery - Delivery record for tracking
   * @param onDeliveryUpdate - Callback for delivery status updates
   * @returns Final delivery status
   */
  async sendWithRetry(
    config: WebhookConfig,
    payload: WebhookPayload,
    delivery: WebhookDelivery,
    onDeliveryUpdate: (delivery: WebhookDelivery) => Promise<void>
  ): Promise<WebhookDelivery> {
    const currentDelivery = { ...delivery };
    const maxAttempts = config.retryCount + 1; // Initial attempt + retries

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      currentDelivery.attemptCount = attempt;
      currentDelivery.lastAttemptAt = new Date();

      const result = await this.send(config, payload);

      currentDelivery.responseCode = result.responseCode;
      currentDelivery.responseTime = result.responseTime;
      currentDelivery.errorMessage = result.errorMessage;

      if (result.success) {
        currentDelivery.status = 'sent' as DeliveryStatus;
        currentDelivery.deliveredAt = new Date();
        await onDeliveryUpdate(currentDelivery);
        return currentDelivery;
      }

      // Check if we have more retries
      if (attempt < maxAttempts) {
        // Calculate exponential backoff delay
        const delay = this.calculateBackoffDelay(config.retryDelayMs, attempt);
        currentDelivery.status = 'retrying' as DeliveryStatus;
        currentDelivery.nextRetryAt = new Date(Date.now() + delay);
        
        await onDeliveryUpdate(currentDelivery);

        // Emit retry event
        this.emit('retry', {
          webhookId: config.id,
          eventId: payload.id,
          attempt,
          nextDelay: delay,
          error: result.errorMessage,
        });

        // Wait before retry
        await this.sleep(delay);

        // Reload config in case it was updated
        // (This would typically be done by the caller)
      }
    }

    // All retries exhausted
    currentDelivery.status = 'failed' as DeliveryStatus;
    currentDelivery.errorMessage = currentDelivery.errorMessage || 'Max retries exceeded';
    await onDeliveryUpdate(currentDelivery);

    this.emit('exhausted', {
      webhookId: config.id,
      eventId: payload.id,
      attempts: maxAttempts,
      error: currentDelivery.errorMessage,
    });

    return currentDelivery;
  }

  /**
   * Test a webhook endpoint
   * @param config - Webhook configuration
   * @returns Test result
   */
  async test(config: WebhookConfig): Promise<WebhookTestResult> {
    // Create test payload
    const payload: WebhookPayload = {
      id: `test_${Date.now()}`,
      event: 'system.alert',
      timestamp: new Date().toISOString(),
      data: {
        type: 'alert',
        severity: 'info',
        title: 'Webhook Test',
        message: 'This is a test webhook from AlphaArena',
      },
      signature: '', // Will be filled by send()
    };

    const result = await this.send(config, payload);

    return {
      success: result.success,
      responseCode: result.responseCode,
      responseTime: result.responseTime,
      errorMessage: result.errorMessage,
      payload,
    };
  }

  /**
   * Send HTTP request
   */
  private async sendHttpRequest(
    config: WebhookConfig,
    payload: WebhookPayload
  ): Promise<SendResult> {
    return new Promise((resolve) => {
      try {
        const url = new URL(config.url);
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;

        const postData = JSON.stringify(payload);

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData).toString(),
          'User-Agent': 'AlphaArena-Webhook/1.0',
          'X-Webhook-ID': config.id,
          'X-Webhook-Event': payload.event,
          'X-Webhook-Signature': payload.signature,
          ...config.headers,
        };

        const options = {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method: 'POST',
          headers,
          timeout: config.timeoutMs || this.options.defaultTimeout,
        };

        const req = httpModule.request(options, (res) => {
          let body = '';

          res.on('data', (chunk) => {
            body += chunk;
          });

          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve({
                success: true,
                responseCode: res.statusCode,
              });
            } else {
              resolve({
                success: false,
                responseCode: res.statusCode,
                errorMessage: `HTTP ${res.statusCode}: ${body.substring(0, 200)}`,
              });
            }
          });
        });

        req.on('error', (error) => {
          resolve({
            success: false,
            errorMessage: error.message,
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            success: false,
            errorMessage: 'Request timeout',
          });
        });

        req.write(postData);
        req.end();
      } catch (error) {
        resolve({
          success: false,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  /**
   * Calculate exponential backoff delay
   * @param baseDelay - Base delay in ms
   * @param attempt - Current attempt number
   * @returns Delay in ms
   */
  private calculateBackoffDelay(baseDelay: number, attempt: number): number {
    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    return Math.min(exponentialDelay + jitter, 60000); // Max 60 seconds
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default WebhookSender;
