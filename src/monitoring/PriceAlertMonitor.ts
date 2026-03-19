/**
 * Price Alert Monitor
 * 
 * Monitors market prices and triggers price alerts when conditions are met.
 * This service runs as a background job and checks active alerts periodically.
 */

import { PriceAlertsDAO } from '../database/price-alerts.dao';
import { getFeishuAlertService } from './FeishuAlertService';

export interface PriceAlertMonitorConfig {
  checkIntervalMs?: number; // How often to check alerts (default: 5000ms)
  symbols?: string[]; // Symbols to monitor (default: all with active alerts)
}

export class PriceAlertMonitor {
  private alertsDAO: PriceAlertsDAO;
  private feishuService: ReturnType<typeof getFeishuAlertService>;
  private checkIntervalMs: number;
  private symbols?: string[];
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(config: PriceAlertMonitorConfig = {}) {
    this.alertsDAO = new PriceAlertsDAO();
    this.feishuService = getFeishuAlertService();
    this.checkIntervalMs = config.checkIntervalMs || 5000;
    this.symbols = config.symbols;
  }

  /**
   * Start monitoring price alerts
   */
  public start(): void {
    if (this.isRunning) {
      console.warn('[PriceAlertMonitor] Already running, ignoring start request');
      return;
    }

    console.log('[PriceAlertMonitor] Starting monitor with interval:', this.checkIntervalMs, 'ms');
    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.checkAlerts().catch(error => {
        console.error('[PriceAlertMonitor] Error in checkAlerts:', error);
      });
    }, this.checkIntervalMs);
  }

  /**
   * Stop monitoring price alerts
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[PriceAlertMonitor] Stopped');
  }

  /**
   * Check all active alerts and trigger if conditions are met
   */
  private async checkAlerts(): Promise<void> {
    try {
      // Get symbols to monitor
      const symbolsToMonitor = this.symbols || await this.getSymbolsWithActiveAlerts();
      
      if (symbolsToMonitor.length === 0) {
        return; // No active alerts to check
      }

      // Check each symbol
      for (const symbol of symbolsToMonitor) {
        await this.checkSymbolAlerts(symbol);
      }
    } catch (error) {
      console.error('[PriceAlertMonitor] Error checking alerts:', error);
    }
  }

  /**
   * Get all symbols that have active alerts
   */
  private async getSymbolsWithActiveAlerts(): Promise<string[]> {
    try {
      const activeAlerts = await this.alertsDAO.getActive();
      const symbols = [...new Set(activeAlerts.map(a => a.symbol))];
      return symbols;
    } catch (error) {
      console.error('[PriceAlertMonitor] Error getting symbols with active alerts:', error);
      return [];
    }
  }

  /**
   * Check alerts for a specific symbol
   */
  private async checkSymbolAlerts(symbol: string): Promise<void> {
    try {
      // Get current market price for this symbol
      const currentPrice = await this.getCurrentPrice(symbol);
      
      if (!currentPrice) {
        console.warn('[PriceAlertMonitor] No price data for symbol:', symbol);
        return;
      }

      // Get alerts that should be triggered
      const alertsToTrigger = await this.alertsDAO.getAlertsToTrigger(symbol, currentPrice);

      if (alertsToTrigger.length === 0) {
        return;
      }

      console.log('[PriceAlertMonitor] Found', alertsToTrigger.length, 'alerts to trigger for', symbol);

      // Trigger each alert
      for (const alert of alertsToTrigger) {
        await this.triggerAlert(alert, currentPrice);
      }
    } catch (error) {
      console.error('[PriceAlertMonitor] Error checking symbol alerts:', symbol, error);
    }
  }

  /**
   * Get current market price for a symbol
   * This would typically call your market data API
   */
  private async getCurrentPrice(symbol: string): Promise<number | null> {
    try {
      // In production, this would call your market data API
      // For now, we'll use the DAO to get the latest price from price_history
      // This is a simplified implementation - replace with actual market data source
      
      // Try to get from price_history table
      const { getSupabaseClient } = await import('../database/client');
      const supabase = getSupabaseClient();
      
      const { data } = await supabase
        .from('price_history')
        .select('price')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (data && data.price) {
        return parseFloat(data.price.toString());
      }

      return null;
    } catch (error) {
      console.error('[PriceAlertMonitor] Error getting current price:', error);
      return null;
    }
  }

  /**
   * Trigger a price alert
   */
  private async triggerAlert(alert: any, currentPrice: number): Promise<void> {
    try {
      // Update alert status in database
      const updatedAlert = await this.alertsDAO.trigger(alert.id, currentPrice, alert.isRecurring);

      console.log('[PriceAlertMonitor] Triggered alert:', alert.id, 'for symbol:', alert.symbol);

      // Send notification based on notification method
      await this.sendNotification(updatedAlert, currentPrice);

      // If not recurring, we're done
      // If recurring, the alert is reset to 'active' status automatically
    } catch (error) {
      console.error('[PriceAlertMonitor] Error triggering alert:', alert.id, error);
    }
  }

  /**
   * Send notification for triggered alert
   */
  private async sendNotification(alert: any, triggeredPrice: number): Promise<void> {
    const conditionText = alert.conditionType === 'above' ? '高于' : '低于';
    const message = `价格提醒已触发！\n\n` +
      `交易对：${alert.symbol}\n` +
      `条件：${conditionText} $${alert.targetPrice}\n` +
      `当前价格：$${triggeredPrice}\n` +
      `触发时间：${new Date().toLocaleString('zh-CN')}\n` +
      (alert.notes ? `\n备注：${alert.notes}` : '');

    switch (alert.notificationMethod) {
      case 'feishu':
        await this.feishuService.sendAlert({
          type: 'info',
          title: '💰 价格提醒触发',
          content: message,
          severity: 'medium',
          metadata: {
            symbol: alert.symbol,
            targetPrice: alert.targetPrice,
            triggeredPrice,
            conditionType: alert.conditionType,
          },
        });
        break;

      case 'email':
        // BACKLOG(#426): Email service integration pending
        // Requires: EMAIL_SERVICE_PROVIDER, EMAIL_API_KEY configuration
        // See: src/alerting/AlertService.ts sendEmailNotification for implementation pattern
        console.log('[PriceAlertMonitor] Email notification pending - see Issue #426 for implementation');
        break;

      case 'push':
        // BACKLOG(#427): Push notification service pending
        // Requires: PUSH_SERVICE_PROVIDER, device token management
        // See Issue #427 for full requirements and provider options
        console.log('[PriceAlertMonitor] Push notification pending - see Issue #427 for implementation');
        break;

      case 'in_app':
      default:
        // In-app notifications are handled by the frontend via realtime
        // We'll just log it for now
        console.log('[PriceAlertMonitor] In-app notification triggered:', alert.id);
        break;
    }
  }

  /**
   * Manually check and trigger alerts (useful for testing)
   */
  public async checkNow(): Promise<void> {
    await this.checkAlerts();
  }

  /**
   * Get monitor status
   */
  public getStatus(): {
    isRunning: boolean;
    checkIntervalMs: number;
    symbols?: string[];
  } {
    return {
      isRunning: this.isRunning,
      checkIntervalMs: this.checkIntervalMs,
      symbols: this.symbols,
    };
  }
}

// Singleton instance
let priceAlertMonitorInstance: PriceAlertMonitor | null = null;

export function getPriceAlertMonitor(config?: PriceAlertMonitorConfig): PriceAlertMonitor {
  if (!priceAlertMonitorInstance) {
    priceAlertMonitorInstance = new PriceAlertMonitor(config);
  }
  return priceAlertMonitorInstance;
}

export default PriceAlertMonitor;
