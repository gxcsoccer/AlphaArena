#!/usr/bin/env node

/**
 * AlphaArena Uptime Monitor
 * 
 * Monitors the API server health and sends alerts if downtime is detected.
 * Can be run as a cron job or standalone process.
 */

import https from 'https';
import http from 'http';

interface MonitorConfig {
  url: string;
  interval: number; // milliseconds between checks
  timeout: number; // request timeout in milliseconds
  maxRetries: number; // retries before alerting
  alertWebhook?: string; // Feishu webhook URL for alerts
}

interface HealthCheckResult {
  success: boolean;
  responseTime: number;
  statusCode: number | null;
  error?: string;
  timestamp: number;
}

class UptimeMonitor {
  private config: MonitorConfig;
  private consecutiveFailures: number = 0;
  private isRunning: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastSuccessfulCheck: number | null = null;

  constructor(config: MonitorConfig) {
    this.config = config;
  }

  /**
   * Start monitoring
   */
  public start(): void {
    if (this.isRunning) {
      console.log('[UptimeMonitor] Already running');
      return;
    }

    this.isRunning = true;
    console.log(`[UptimeMonitor] Starting monitoring of ${this.config.url}`);
    console.log(`[UptimeMonitor] Interval: ${this.config.interval / 1000}s, Timeout: ${this.config.timeout}ms`);

    // Run initial check immediately
    this.runCheck();

    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.runCheck();
    }, this.config.interval);
  }

  /**
   * Stop monitoring
   */
  public stop(): void {
    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('[UptimeMonitor] Stopped');
  }

  /**
   * Run a single health check
   */
  private async runCheck(): Promise<void> {
    const result = await this.checkHealth();
    
    if (result.success) {
      this.consecutiveFailures = 0;
      this.lastSuccessfulCheck = result.timestamp;
      console.log(`[UptimeMonitor] ✓ Health check passed (${result.responseTime}ms)`);
    } else {
      this.consecutiveFailures++;
      console.error(`[UptimeMonitor] ✗ Health check failed: ${result.error}`);
      
      // Alert after max retries
      if (this.consecutiveFailures >= this.config.maxRetries) {
        await this.sendDowntimeAlert(result);
        this.consecutiveFailures = 0; // Reset to avoid repeated alerts
      }
    }
  }

  /**
   * Perform health check
   */
  private checkHealth(): Promise<HealthCheckResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const url = new URL(this.config.url);
      const isHttps = url.protocol === 'https:';
      
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        timeout: this.config.timeout,
      };

      const lib = isHttps ? https : http;
      const req = lib.request(options, (res) => {
        const responseTime = Date.now() - startTime;
        
        // Consume response data to free up memory
        res.resume();
        
        const success = res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 400;
        
        resolve({
          success,
          responseTime,
          statusCode: res.statusCode || null,
          timestamp: Date.now(),
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          responseTime: Date.now() - startTime,
          statusCode: null,
          error: error.message,
          timestamp: Date.now(),
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          responseTime: Date.now() - startTime,
          statusCode: null,
          error: 'Request timeout',
          timestamp: Date.now(),
        });
      });

      req.end();
    });
  }

  /**
   * Send downtime alert to Feishu
   */
  private async sendDowntimeAlert(lastResult: HealthCheckResult): Promise<void> {
    const downtime = this.lastSuccessfulCheck
      ? Math.round((Date.now() - this.lastSuccessfulCheck) / 1000)
      : 'unknown';

    const message = {
      msg_type: 'interactive',
      card: {
        header: {
          title: {
            tag: 'plain_text',
            content: '🚨 服务宕机警告',
          },
          template: 'red',
        },
        elements: [
          {
            tag: 'markdown',
            content: `**服务**: ${this.config.url}\n` +
              `**状态**: 无法访问\n` +
              `**错误**: ${lastResult.error || `HTTP ${lastResult.statusCode}`}\n` +
              `**宕机时长**: ${downtime}秒\n` +
              `**连续失败次数**: ${this.consecutiveFailures + 1}`,
          },
          {
            tag: 'hr',
          },
          {
            tag: 'note',
            elements: [
              {
                tag: 'plain_text',
                content: 'AlphaArena 监控系统 | 请立即检查服务状态',
              },
            ],
          },
        ],
      },
    };

    if (!this.config.alertWebhook) {
      console.warn('[UptimeMonitor] No webhook configured, skipping alert');
      return;
    }

    try {
      await this.sendWebhook(this.config.alertWebhook, message);
      console.log('[UptimeMonitor] Downtime alert sent');
    } catch (error) {
      console.error('[UptimeMonitor] Failed to send alert:', error);
    }
  }

  /**
   * Send webhook message
   */
  private sendWebhook(url: string, message: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const webhookUrl = new URL(url);
      const options = {
        hostname: webhookUrl.hostname,
        port: 443,
        path: webhookUrl.pathname + webhookUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            reject(new Error(`Webhook responded with ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.write(JSON.stringify(message));
      req.end();
    });
  }

  /**
   * Get current status
   */
  public getStatus(): {
    isRunning: boolean;
    consecutiveFailures: number;
    lastSuccessfulCheck: number | null;
    uptime: number;
  } {
    const uptime = this.lastSuccessfulCheck
      ? Date.now() - this.lastSuccessfulCheck
      : 0;

    return {
      isRunning: this.isRunning,
      consecutiveFailures: this.consecutiveFailures,
      lastSuccessfulCheck: this.lastSuccessfulCheck,
      uptime,
    };
  }
}

// CLI usage
if (require.main === module) {
  const url = process.env.MONITOR_URL || 'http://localhost:3001/health';
  const interval = parseInt(process.env.MONITOR_INTERVAL || '30000');
  const timeout = parseInt(process.env.MONITOR_TIMEOUT || '5000');
  const maxRetries = parseInt(process.env.MONITOR_MAX_RETRIES || '3');
  const webhook = process.env.FEISHU_WEBHOOK_URL;

  const monitor = new UptimeMonitor({
    url,
    interval,
    timeout,
    maxRetries,
    alertWebhook: webhook,
  });

  monitor.start();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    monitor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    monitor.stop();
    process.exit(0);
  });
}

export default UptimeMonitor;
