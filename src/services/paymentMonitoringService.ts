/**
 * Payment Monitoring Service
 * Provides real-time monitoring of payment success rates, failure tracking, and alerts
 */

import { getSupabaseAdminClient } from '../database/client';
import { createLogger } from '../utils/logger';
import { FeishuAlertService } from '../monitoring/FeishuAlertService';

const log = createLogger('PaymentMonitoringService');

// Types
export interface PaymentMetrics {
  totalPayments: number;
  succeededPayments: number;
  failedPayments: number;
  pendingPayments: number;
  refundedPayments: number;
  successRate: number;
  failureRate: number;
  totalRevenue: number;
  totalRefunded: number;
  avgTransactionValue: number;
  uniqueCustomers: number;
  retryRate: number;
}

export interface PaymentMethodMetrics {
  method: string;
  totalPayments: number;
  succeededPayments: number;
  failedPayments: number;
  successRate: number;
  totalAmount: number;
  avgAmount: number;
}

export interface FailureReason {
  reason: string;
  count: number;
  percentage: number;
  recentExamples: Array<{
    id: string;
    amount: number;
    currency: string;
    createdAt: string;
    userId: string;
  }>;
}

export interface PaymentTrend {
  period: string;
  totalPayments: number;
  succeededPayments: number;
  failedPayments: number;
  successRate: number;
  revenue: number;
}

export interface PaymentAlert {
  id: string;
  type: 'success_rate_low' | 'gateway_error' | 'high_failure_rate' | 'large_refund' | 'anomaly';
  severity: 'warning' | 'critical';
  message: string;
  currentValue: number;
  thresholdValue: number;
  metadata?: Record<string, any>;
  status: 'active' | 'acknowledged' | 'resolved';
  createdAt: string;
}

export interface AlertThreshold {
  type: string;
  warningThreshold: number;
  criticalThreshold: number;
  enabled: boolean;
  cooldownMinutes: number;
}

export class PaymentMonitoringService {
  private adminClient = getSupabaseAdminClient();
  private feishuAlertService = new FeishuAlertService();

  /**
   * Get overall payment metrics for a time period
   */
  async getMetrics(startDate: Date, endDate: Date): Promise<PaymentMetrics> {
    try {
      const { data, error } = await this.adminClient
        .rpc('get_payment_metrics', {
          p_start_date: startDate.toISOString(),
          p_end_date: endDate.toISOString(),
        });

      if (error) throw error;

      const result = data?.[0] || {};
      
      const totalPayments = (result.total_payments || 0);
      const succeededPayments = (result.succeeded_payments || 0);
      const failedPayments = (result.failed_payments || 0);
      
      return {
        totalPayments,
        succeededPayments,
        failedPayments,
        pendingPayments: result.pending_payments || 0,
        refundedPayments: result.refunded_payments || 0,
        successRate: totalPayments > 0 ? (succeededPayments / totalPayments) * 100 : 0,
        failureRate: totalPayments > 0 ? (failedPayments / totalPayments) * 100 : 0,
        totalRevenue: result.total_revenue || 0,
        totalRefunded: result.total_refunded || 0,
        avgTransactionValue: succeededPayments > 0 ? (result.total_revenue || 0) / succeededPayments : 0,
        uniqueCustomers: result.unique_customers || 0,
        retryRate: result.retry_rate || 0,
      };
    } catch (error) {
      log.error('Failed to get payment metrics:', error);
      throw error;
    }
  }

  /**
   * Get metrics broken down by payment method
   */
  async getPaymentMethodMetrics(startDate: Date, endDate: Date): Promise<PaymentMethodMetrics[]> {
    try {
      const { data, error } = await this.adminClient
        .rpc('get_payment_method_metrics', {
          p_start_date: startDate.toISOString(),
          p_end_date: endDate.toISOString(),
        });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        method: row.method || 'unknown',
        totalPayments: row.total_payments || 0,
        succeededPayments: row.succeeded_payments || 0,
        failedPayments: row.failed_payments || 0,
        successRate: row.total_payments > 0 
          ? (row.succeeded_payments / row.total_payments) * 100 
          : 0,
        totalAmount: row.total_amount || 0,
        avgAmount: row.succeeded_payments > 0 
          ? row.total_amount / row.succeeded_payments 
          : 0,
      }));
    } catch (error) {
      log.error('Failed to get payment method metrics:', error);
      throw error;
    }
  }

  /**
   * Get failure reasons analysis
   */
  async getFailureReasons(
    startDate: Date, 
    endDate: Date, 
    limit: number = 10
  ): Promise<FailureReason[]> {
    try {
      const { data, error } = await this.adminClient
        .rpc('get_payment_failure_reasons', {
          p_start_date: startDate.toISOString(),
          p_end_date: endDate.toISOString(),
          p_limit: limit,
        });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        reason: row.reason || 'Unknown error',
        count: row.count || 0,
        percentage: row.percentage || 0,
        recentExamples: (row.recent_examples || []).map((ex: any) => ({
          id: ex.id,
          amount: ex.amount,
          currency: ex.currency,
          createdAt: ex.created_at,
          userId: ex.user_id,
        })),
      }));
    } catch (error) {
      log.error('Failed to get failure reasons:', error);
      throw error;
    }
  }

  /**
   * Get payment trend over time
   */
  async getPaymentTrend(
    startDate: Date, 
    endDate: Date, 
    granularity: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<PaymentTrend[]> {
    try {
      const { data, error } = await this.adminClient
        .rpc('get_payment_trend', {
          p_start_date: startDate.toISOString(),
          p_end_date: endDate.toISOString(),
          p_granularity: granularity,
        });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        period: row.period,
        totalPayments: row.total_payments || 0,
        succeededPayments: row.succeeded_payments || 0,
        failedPayments: row.failed_payments || 0,
        successRate: row.total_payments > 0 
          ? (row.succeeded_payments / row.total_payments) * 100 
          : 0,
        revenue: row.revenue || 0,
      }));
    } catch (error) {
      log.error('Failed to get payment trend:', error);
      throw error;
    }
  }

  /**
   * Get failed payments list
   */
  async getFailedPayments(
    startDate: Date,
    endDate: Date,
    page: number = 1,
    pageSize: number = 20,
    reason?: string
  ): Promise<{
    payments: any[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    try {
      const offset = (page - 1) * pageSize;
      
      let query = this.adminClient
        .from('payment_history')
        .select('*', { count: 'exact' })
        .eq('status', 'failed')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (reason) {
        query = query.contains('metadata', { failure_reason: reason });
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        payments: data || [],
        total: count || 0,
        page,
        pageSize,
      };
    } catch (error) {
      log.error('Failed to get failed payments:', error);
      throw error;
    }
  }

  /**
   * Get active payment alerts
   */
  async getActiveAlerts(limit: number = 20): Promise<PaymentAlert[]> {
    try {
      const { data, error } = await this.adminClient
        .from('payment_alerts')
        .select('*')
        .in('status', ['active', 'acknowledged'])
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        type: row.alert_type,
        severity: row.severity,
        message: row.message,
        currentValue: row.current_value,
        thresholdValue: row.threshold_value,
        metadata: row.metadata,
        status: row.status,
        createdAt: row.created_at,
      }));
    } catch (error) {
      log.error('Failed to get active alerts:', error);
      throw error;
    }
  }

  /**
   * Get alert thresholds configuration
   */
  async getAlertThresholds(): Promise<AlertThreshold[]> {
    try {
      const { data, error } = await this.adminClient
        .from('payment_alert_thresholds')
        .select('*')
        .eq('enabled', true);

      if (error) throw error;

      return (data || []).map((row: any) => ({
        type: row.alert_type,
        warningThreshold: row.warning_threshold,
        criticalThreshold: row.critical_threshold,
        enabled: row.enabled,
        cooldownMinutes: row.cooldown_minutes,
      }));
    } catch (error) {
      log.error('Failed to get alert thresholds:', error);
      // Return default thresholds if table doesn't exist
      return [
        {
          type: 'success_rate',
          warningThreshold: 95,
          criticalThreshold: 90,
          enabled: true,
          cooldownMinutes: 30,
        },
        {
          type: 'failure_spike',
          warningThreshold: 10,
          criticalThreshold: 20,
          enabled: true,
          cooldownMinutes: 15,
        },
        {
          type: 'large_refund',
          warningThreshold: 10000,
          criticalThreshold: 50000,
          enabled: true,
          cooldownMinutes: 60,
        },
      ];
    }
  }

  /**
   * Update alert threshold
   */
  async updateAlertThreshold(
    alertType: string,
    updates: {
      warningThreshold?: number;
      criticalThreshold?: number;
      enabled?: boolean;
      cooldownMinutes?: number;
    }
  ): Promise<void> {
    try {
      const updateData: any = {};
      if (updates.warningThreshold !== undefined) {
        updateData.warning_threshold = updates.warningThreshold;
      }
      if (updates.criticalThreshold !== undefined) {
        updateData.critical_threshold = updates.criticalThreshold;
      }
      if (updates.enabled !== undefined) {
        updateData.enabled = updates.enabled;
      }
      if (updates.cooldownMinutes !== undefined) {
        updateData.cooldown_minutes = updates.cooldownMinutes;
      }

      const { error } = await this.adminClient
        .from('payment_alert_thresholds')
        .update(updateData)
        .eq('alert_type', alertType);

      if (error) throw error;

      log.info('Updated alert threshold', { alertType, updates });
    } catch (error) {
      log.error('Failed to update alert threshold:', error);
      throw error;
    }
  }

  /**
   * Check payment health and generate alerts
   */
  async checkPaymentHealth(): Promise<void> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      // Get current metrics
      const metrics = await this.getMetrics(oneHourAgo, now);
      const thresholds = await this.getAlertThresholds();
      
      // Check success rate
      const successRateThreshold = thresholds.find(t => t.type === 'success_rate');
      if (successRateThreshold && metrics.totalPayments >= 10) {
        if (metrics.successRate < successRateThreshold.criticalThreshold) {
          await this.createAlert({
            type: 'success_rate_low',
            severity: 'critical',
            message: `支付成功率严重过低: ${metrics.successRate.toFixed(2)}% (阈值: ${successRateThreshold.criticalThreshold}%)`,
            currentValue: metrics.successRate,
            thresholdValue: successRateThreshold.criticalThreshold,
            metadata: { 
              totalPayments: metrics.totalPayments,
              failedPayments: metrics.failedPayments,
            },
          });
        } else if (metrics.successRate < successRateThreshold.warningThreshold) {
          await this.createAlert({
            type: 'success_rate_low',
            severity: 'warning',
            message: `支付成功率偏低: ${metrics.successRate.toFixed(2)}% (阈值: ${successRateThreshold.warningThreshold}%)`,
            currentValue: metrics.successRate,
            thresholdValue: successRateThreshold.warningThreshold,
            metadata: { 
              totalPayments: metrics.totalPayments,
              failedPayments: metrics.failedPayments,
            },
          });
        }
      }
      
      // Check failure spike
      const failureThreshold = thresholds.find(t => t.type === 'failure_spike');
      if (failureThreshold && metrics.failureRate > failureThreshold.criticalThreshold) {
        await this.createAlert({
          type: 'high_failure_rate',
          severity: 'critical',
          message: `支付失败率异常: ${metrics.failureRate.toFixed(2)}% (阈值: ${failureThreshold.criticalThreshold}%)`,
          currentValue: metrics.failureRate,
          thresholdValue: failureThreshold.criticalThreshold,
          metadata: { failedPayments: metrics.failedPayments },
        });
      }
      
      log.info('Payment health check completed', { 
        successRate: metrics.successRate,
        failureRate: metrics.failureRate,
      });
    } catch (error) {
      log.error('Failed to check payment health:', error);
    }
  }

  /**
   * Create a new payment alert
   */
  private async createAlert(alert: {
    type: PaymentAlert['type'];
    severity: PaymentAlert['severity'];
    message: string;
    currentValue: number;
    thresholdValue: number;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      // Check for similar active alerts (cooldown)
      const cooldownMinutes = 30;
      const cooldownTime = new Date(Date.now() - cooldownMinutes * 60 * 1000);
      
      const { data: existingAlert } = await this.adminClient
        .from('payment_alerts')
        .select('id')
        .eq('alert_type', alert.type)
        .eq('status', 'active')
        .gte('created_at', cooldownTime.toISOString())
        .maybeSingle();

      if (existingAlert) {
        log.info('Similar alert exists, skipping', { type: alert.type });
        return;
      }

      // Create alert
      const { data, error } = await this.adminClient
        .from('payment_alerts')
        .insert({
          alert_type: alert.type,
          severity: alert.severity,
          message: alert.message,
          current_value: alert.currentValue,
          threshold_value: alert.thresholdValue,
          metadata: alert.metadata || {},
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      // Send notification
      await this.sendAlertNotification({
        ...alert,
        id: data.id,
        status: 'active',
        createdAt: data.created_at,
      });

      log.info('Created payment alert', { alert });
    } catch (error) {
      log.error('Failed to create alert:', error);
    }
  }

  /**
   * Send alert notification via Feishu
   */
  private async sendAlertNotification(alert: PaymentAlert): Promise<void> {
    try {
      const title = `🚨 支付告警: ${alert.severity === 'critical' ? '【严重】' : '【警告】'}`;
      const content = `
**告警类型:** ${this.getAlertTypeLabel(alert.type)}
**详细信息:** ${alert.message}
**当前值:** ${alert.currentValue.toFixed(2)}
**阈值:** ${alert.thresholdValue}
**时间:** ${new Date(alert.createdAt).toLocaleString('zh-CN')}
      `.trim();

      await this.feishuAlertService.sendAlert({
        type: alert.severity === 'critical' ? 'error' : 'warning',
        title,
        content,
        severity: alert.severity === 'critical' ? 'critical' : 'medium',
      });
      
      log.info('Sent alert notification', { alertId: alert.id });
    } catch (error) {
      log.error('Failed to send alert notification:', error);
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    try {
      const { error } = await this.adminClient
        .from('payment_alerts')
        .update({ status: 'acknowledged', acknowledged_at: new Date().toISOString() })
        .eq('id', alertId);

      if (error) throw error;

      log.info('Acknowledged alert', { alertId });
    } catch (error) {
      log.error('Failed to acknowledge alert:', error);
      throw error;
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    try {
      const { error } = await this.adminClient
        .from('payment_alerts')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', alertId);

      if (error) throw error;

      log.info('Resolved alert', { alertId });
    } catch (error) {
      log.error('Failed to resolve alert:', error);
      throw error;
    }
  }

  /**
   * Get real-time dashboard data
   */
  async getDashboardData(startDate: Date, endDate: Date): Promise<{
    metrics: PaymentMetrics;
    methodMetrics: PaymentMethodMetrics[];
    failureReasons: FailureReason[];
    trend: PaymentTrend[];
    activeAlerts: PaymentAlert[];
  }> {
    const [metrics, methodMetrics, failureReasons, trend, activeAlerts] = await Promise.all([
      this.getMetrics(startDate, endDate),
      this.getPaymentMethodMetrics(startDate, endDate),
      this.getFailureReasons(startDate, endDate),
      this.getPaymentTrend(startDate, endDate, 'day'),
      this.getActiveAlerts(10),
    ]);

    return {
      metrics,
      methodMetrics,
      failureReasons,
      trend,
      activeAlerts,
    };
  }

  /**
   * Get label for alert type
   */
  private getAlertTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      success_rate_low: '支付成功率过低',
      gateway_error: '支付网关异常',
      high_failure_rate: '高失败率',
      large_refund: '大额退款',
      anomaly: '异常检测',
    };
    return labels[type] || type;
  }
}

// Singleton instance
let paymentMonitoringService: PaymentMonitoringService | null = null;

export function getPaymentMonitoringService(): PaymentMonitoringService {
  if (!paymentMonitoringService) {
    paymentMonitoringService = new PaymentMonitoringService();
  }
  return paymentMonitoringService;
}