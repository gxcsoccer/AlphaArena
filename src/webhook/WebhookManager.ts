/**
 * WebhookManager - Webhook lifecycle management
 *
 * Coordinates webhook configuration, delivery, and event handling
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  WebhookConfig,
  WebhookPayload,
  WebhookDelivery,
  WebhookEventData,
  WebhookEventType,
  DeliveryStatus,
  WebhookStats,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  WebhookDeliveryFilters,
  WebhookTestResult,
} from './types';
import { WebhookStorage } from './WebhookStorage';
import { WebhookSender } from './WebhookSender';
import { WebhookSigner } from './WebhookSigner';

/**
 * WebhookManager options
 */
export interface WebhookManagerOptions {
  retryIntervalMs?: number;   // Interval for checking pending retries (default: 30000)
  cleanupIntervalMs?: number; // Interval for cleaning old logs (default: 86400000)
  cleanupOlderThanDays?: number; // Delete logs older than this (default: 30)
}

/**
 * WebhookManager class
 */
export class WebhookManager extends EventEmitter {
  private storage: WebhookStorage;
  private sender: WebhookSender;
  private options: Required<WebhookManagerOptions>;
  private retryTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private isRunning: boolean = false;

  constructor(options: WebhookManagerOptions = {}) {
    super();
    this.storage = new WebhookStorage();
    this.sender = new WebhookSender();
    
    this.options = {
      retryIntervalMs: options.retryIntervalMs || 30000,
      cleanupIntervalMs: options.cleanupIntervalMs || 86400000, // 24 hours
      cleanupOlderThanDays: options.cleanupOlderThanDays || 30,
    };

    // Forward sender events
    this.sender.on('sent', (data) => this.emit('sent', data));
    this.sender.on('failed', (data) => this.emit('failed', data));
    this.sender.on('retry', (data) => this.emit('retry', data));
    this.sender.on('exhausted', (data) => this.emit('exhausted', data));
  }

  /**
   * Start the webhook manager
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Start retry loop
    this.startRetryLoop();
    
    // Start cleanup loop
    this.startCleanupLoop();
    
    this.emit('started');
  }

  /**
   * Stop the webhook manager
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = undefined;
    }
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    
    this.emit('stopped');
  }

  /**
   * Trigger a webhook event
   * This is the main entry point for sending webhooks
   */
  async triggerEvent(eventType: WebhookEventType, data: WebhookEventData): Promise<void> {
    try {
      // Get all webhooks subscribed to this event
      const webhooks = await this.storage.getWebhooksForEvent(eventType);
      
      if (webhooks.length === 0) {
        return; // No webhooks subscribed to this event
      }

      // Create payload
      const payloadId = uuidv4();
      
      // Send to all subscribed webhooks (async, fire-and-forget)
      await Promise.all(
        webhooks.map((webhook) => this.deliverWebhook(webhook, eventType, data, payloadId))
      );
    } catch (error) {
      this.emit('error', {
        operation: 'triggerEvent',
        eventType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Deliver webhook to a single endpoint
   */
  private async deliverWebhook(
    webhook: WebhookConfig,
    eventType: WebhookEventType,
    data: WebhookEventData,
    payloadId: string
  ): Promise<void> {
    // Create payload
    const payload: WebhookPayload = {
      id: payloadId,
      event: eventType,
      timestamp: new Date().toISOString(),
      data,
      signature: '', // Will be filled by sender
    };

    // Create delivery record
    const delivery: WebhookDelivery = {
      id: '', // Will be set by storage
      webhookId: webhook.id,
      eventId: payloadId,
      eventType,
      payload,
      status: 'pending' as DeliveryStatus,
      attemptCount: 0,
      createdAt: new Date(),
    };

    try {
      // Save initial delivery record
      const savedDelivery = await this.storage.createDelivery(delivery);
      
      // Send with retry
      await this.sender.sendWithRetry(
        webhook,
        payload,
        savedDelivery,
        async (updatedDelivery) => {
          await this.storage.updateDelivery(updatedDelivery.id, updatedDelivery);
        }
      );
    } catch (error) {
      this.emit('error', {
        operation: 'deliverWebhook',
        webhookId: webhook.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Process pending retries
   */
  private async processRetries(): Promise<void> {
    try {
      const pendingDeliveries = await this.storage.getPendingRetries();
      
      await Promise.all(
        pendingDeliveries.map((delivery) => this.retryDelivery(delivery))
      );
    } catch (error) {
      this.emit('error', {
        operation: 'processRetries',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Retry a single delivery
   */
  private async retryDelivery(delivery: WebhookDelivery): Promise<void> {
    try {
      const webhook = await this.storage.getWebhookById(delivery.webhookId);
      
      if (!webhook || !webhook.enabled) {
        // Webhook no longer exists or is disabled
        await this.storage.updateDelivery(delivery.id, {
          status: 'failed' as DeliveryStatus,
          errorMessage: 'Webhook disabled or deleted',
        });
        return;
      }

      await this.sender.sendWithRetry(
        webhook,
        delivery.payload,
        delivery,
        async (updatedDelivery) => {
          await this.storage.updateDelivery(updatedDelivery.id, updatedDelivery);
        }
      );
    } catch (error) {
      this.emit('error', {
        operation: 'retryDelivery',
        deliveryId: delivery.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Start the retry loop
   */
  private startRetryLoop(): void {
    this.retryTimer = setInterval(() => {
      this.processRetries().catch((error) => {
        this.emit('error', {
          operation: 'retryLoop',
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, this.options.retryIntervalMs);
  }

  /**
   * Start the cleanup loop
   */
  private startCleanupLoop(): void {
    this.cleanupTimer = setInterval(async () => {
      try {
        const deletedCount = await this.storage.deleteOldDeliveries(this.options.cleanupOlderThanDays);
        if (deletedCount > 0) {
          this.emit('cleanup', { deletedCount });
        }
      } catch (error) {
        this.emit('error', {
          operation: 'cleanup',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, this.options.cleanupIntervalMs);
  }

  // ============================================
  // Webhook Configuration Management
  // ============================================

  /**
   * Create a new webhook
   */
  async createWebhook(request: CreateWebhookRequest): Promise<WebhookConfig> {
    // Validate URL
    try {
      new URL(request.url);
    } catch {
      throw new Error('Invalid webhook URL');
    }

    // Validate events
    if (!request.events || request.events.length === 0) {
      throw new Error('At least one event type must be specified');
    }

    const webhook = await this.storage.createWebhook(request);
    this.emit('webhook:created', { webhook });
    return webhook;
  }

  /**
   * Get a webhook by ID
   */
  async getWebhook(id: string): Promise<WebhookConfig | null> {
    return this.storage.getWebhookById(id);
  }

  /**
   * Get all webhooks
   */
  async getAllWebhooks(enabledOnly: boolean = false): Promise<WebhookConfig[]> {
    return this.storage.getAllWebhooks(enabledOnly);
  }

  /**
   * Update a webhook
   */
  async updateWebhook(id: string, request: UpdateWebhookRequest): Promise<WebhookConfig> {
    // Validate URL if provided
    if (request.url) {
      try {
        new URL(request.url);
      } catch {
        throw new Error('Invalid webhook URL');
      }
    }

    const webhook = await this.storage.updateWebhook(id, request);
    this.emit('webhook:updated', { webhook });
    return webhook;
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(id: string): Promise<void> {
    await this.storage.deleteWebhook(id);
    this.emit('webhook:deleted', { webhookId: id });
  }

  /**
   * Test a webhook
   */
  async testWebhook(id: string): Promise<WebhookTestResult> {
    const webhook = await this.storage.getWebhookById(id);
    
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const result = await this.sender.test(webhook);
    this.emit('webhook:tested', { webhookId: id, result });
    return result;
  }

  // ============================================
  // Delivery Log Management
  // ============================================

  /**
   * Get delivery logs
   */
  async getDeliveries(filters: WebhookDeliveryFilters = {}): Promise<WebhookDelivery[]> {
    return this.storage.getDeliveries(filters);
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(id: string): Promise<WebhookStats> {
    return this.storage.getWebhookStats(id);
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Generate a new secret for webhook signing
   */
  static generateSecret(): string {
    return WebhookSigner.generateSecret();
  }

  /**
   * Check if the manager is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }
}

export default WebhookManager;
