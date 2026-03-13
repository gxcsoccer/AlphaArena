/**
 * AlphaArena Feishu Alert Service
 * 
 * Sends alerts to Feishu (Lark) via webhook for:
 * - Critical errors
 * - Threshold violations
 * - System health issues
 */

import https from 'https';

export interface AlertMessage {
  type: 'error' | 'warning' | 'info';
  title: string;
  content: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export interface FeishuAlertServiceConfig {
  webhookUrl?: string;
  appId?: string;
  appSecret?: string;
}

export class FeishuAlertService {
  private webhookUrl: string | null;
  private appId: string | null;
  private appSecret: string | null;
  private tenantAccessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: FeishuAlertServiceConfig = {}) {
    this.webhookUrl = config.webhookUrl || process.env.FEISHU_WEBHOOK_URL || null;
    this.appId = config.appId || process.env.FEISHU_APP_ID || null;
    this.appSecret = config.appSecret || process.env.FEISHU_APP_SECRET || null;
  }

  /**
   * Send an alert message to Feishu
   */
  public async sendAlert(alert: AlertMessage): Promise<boolean> {
    try {
      // Try webhook first (simpler, no auth needed)
      if (this.webhookUrl) {
        return await this.sendViaWebhook(alert);
      }
      
      // Fall back to API with app credentials
      if (this.appId && this.appSecret) {
        return await this.sendViaApi(alert);
      }
      
      console.warn('[FeishuAlert] No credentials configured, skipping alert');
      return false;
    } catch (error) {
      console.error('[FeishuAlert] Failed to send alert:', error);
      return false;
    }
  }

  /**
   * Send alert via webhook (simpler method)
   */
  private async sendViaWebhook(alert: AlertMessage): Promise<boolean> {
    if (!this.webhookUrl) {
      return false;
    }

    const message = this.formatAlertMessage(alert);
    
    return new Promise((resolve, reject) => {
      const url = new URL(this.webhookUrl!);
      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
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
            console.log('[FeishuAlert] Alert sent successfully via webhook');
            resolve(true);
          } else {
            console.error('[FeishuAlert] Webhook response:', res.statusCode, data);
            resolve(false);
          }
        });
      });

      req.on('error', (error) => {
        console.error('[FeishuAlert] Webhook request failed:', error);
        reject(error);
      });

      req.write(JSON.stringify(message));
      req.end();
    });
  }

  /**
   * Send alert via Feishu API (requires app credentials)
   */
  private async sendViaApi(alert: AlertMessage): Promise<boolean> {
    try {
      const token = await this.getTenantAccessToken();
      if (!token) {
        return false;
      }

      // Send message to a default chat (in production, you'd configure the chat ID)
      const message = this.formatAlertMessage(alert);
      
      // For now, we'll use the webhook approach as it's simpler
      // The API approach would require knowing the specific chat ID
      console.log('[FeishuAlert] API method not fully implemented, use webhook instead');
      return false;
    } catch (error) {
      console.error('[FeishuAlert] API send failed:', error);
      return false;
    }
  }

  /**
   * Get tenant access token for Feishu API
   */
  private async getTenantAccessToken(): Promise<string | null> {
    // Return cached token if still valid
    if (this.tenantAccessToken && Date.now() < this.tokenExpiry) {
      return this.tenantAccessToken;
    }

    if (!this.appId || !this.appSecret) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'open.feishu.cn',
        port: 443,
        path: '/open-apis/auth/v3/tenant_access_token/internal',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.code === 0 && response.tenant_access_token) {
              this.tenantAccessToken = response.tenant_access_token;
              this.tokenExpiry = Date.now() + (response.expire - 60) * 1000; // Refresh 1 minute early
              resolve(this.tenantAccessToken);
            } else {
              console.error('[FeishuAlert] Failed to get token:', response);
              resolve(null);
            }
          } catch (e) {
            console.error('[FeishuAlert] Token response parse error:', e);
            resolve(null);
          }
        });
      });

      req.on('error', reject);
      req.write(JSON.stringify({
        app_id: this.appId,
        app_secret: this.appSecret,
      }));
      req.end();
    });
  }

  /**
   * Format alert message for Feishu
   */
  private formatAlertMessage(alert: AlertMessage): any {
    const emoji = this.getSeverityEmoji(alert.severity);
    const timestamp = new Date().toLocaleString('zh-CN', { 
      timeZone: 'Asia/Shanghai',
      hour12: false 
    });

    return {
      msg_type: 'interactive',
      card: {
        header: {
          title: {
            tag: 'plain_text',
            content: `${emoji} ${alert.title}`,
          },
          template: this.getSeverityColor(alert.severity),
        },
        elements: [
          {
            tag: 'markdown',
            content: `**时间**: ${timestamp}\n\n${alert.content}`,
          },
          ...(alert.metadata ? [{
            tag: 'markdown',
            content: '**详情**:\n' + Object.entries(alert.metadata)
              .map(([key, value]) => `- ${key}: ${value}`)
              .join('\n'),
          }] : []),
          {
            tag: 'hr',
          },
          {
            tag: 'note',
            elements: [
              {
                tag: 'plain_text',
                content: `AlphaArena 监控系统 | 严重程度: ${alert.severity || 'medium'}`,
              },
            ],
          },
        ],
      },
    };
  }

  /**
   * Get emoji for severity level
   */
  private getSeverityEmoji(severity?: string): string {
    switch (severity) {
      case 'critical':
        return '🚨';
      case 'high':
        return '⚠️';
      case 'medium':
        return '⚡';
      case 'low':
        return 'ℹ️';
      default:
        return '📢';
    }
  }

  /**
   * Get color template for severity
   */
  private getSeverityColor(severity?: string): string {
    switch (severity) {
      case 'critical':
        return 'red';
      case 'high':
        return 'orange';
      case 'medium':
        return 'yellow';
      case 'low':
        return 'blue';
      default:
        return 'gray';
    }
  }

  /**
   * Send a critical error alert
   */
  public async sendCriticalError(error: Error, context?: Record<string, any>): Promise<boolean> {
    return await this.sendAlert({
      type: 'error',
      title: '严重错误',
      content: `错误信息: ${error.message}\n\n堆栈: ${error.stack?.substring(0, 500) || 'N/A'}`,
      severity: 'critical',
      metadata: context,
    });
  }

  /**
   * Send a system health alert
   */
  public async sendHealthAlert(healthStatus: {
    status: string;
    memory: { percent: number };
    cpu: number;
    errorRate: number;
  }): Promise<boolean> {
    return await this.sendAlert({
      type: 'warning',
      title: '系统健康警告',
      content: `系统状态: ${healthStatus.status.toUpperCase()}\n` +
        `- 内存使用: ${healthStatus.memory.percent}%\n` +
        `- CPU 使用: ${healthStatus.cpu}%\n` +
        `- 错误率：${healthStatus.errorRate}%`,
      severity: healthStatus.status === 'unhealthy' ? 'high' : 'medium',
    });
  }
}

// Singleton instance
let feishuAlertInstance: FeishuAlertService | null = null;

export function getFeishuAlertService(): FeishuAlertService {
  if (!feishuAlertInstance) {
    feishuAlertInstance = new FeishuAlertService();
  }
  return feishuAlertInstance;
}

export default FeishuAlertService;
