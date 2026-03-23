/**
 * Performance Alert Service
 * 
 * Manages performance threshold alerts and notifications.
 * Integrates with the existing alerting system.
 */

import { EventEmitter } from 'events';
import { getSupabaseClient } from '../database/client';
import { createLogger } from '../utils/logger';

const log = createLogger('PerformanceAlertService');

// Types
export interface PerformanceThreshold {
  id: string;
  metric_type: 'lcp' | 'fcp' | 'fid' | 'cls' | 'ttfb' | 'inp' | 'api_latency' | 'error_rate';
  warning_threshold: number;
  critical_threshold: number;
  enabled: boolean;
  notification_channels: {
    in_app: boolean;
    email: boolean;
    webhook: boolean;
  };
  cooldown_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface PerformanceAlertRecord {
  id: string;
  metric_type: string;
  severity: 'warning' | 'critical';
  current_value: number;
  threshold_value: number;
  page?: string;
  device_type?: string;
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved_at?: string;
  created_at: string;
}

export interface AlertNotification {
  id: string;
  alert_id: string;
  channel: 'in_app' | 'email' | 'webhook';
  status: 'pending' | 'sent' | 'failed';
  sent_at?: string;
  error?: string;
  created_at: string;
}

// Default thresholds based on Google's Core Web Vitals recommendations
const DEFAULT_THRESHOLDS: Omit<PerformanceThreshold, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    metric_type: 'lcp',
    warning_threshold: 2500,
    critical_threshold: 4000,
    enabled: true,
    notification_channels: { in_app: true, email: true, webhook: false },
    cooldown_minutes: 30,
  },
  {
    metric_type: 'fcp',
    warning_threshold: 1800,
    critical_threshold: 3000,
    enabled: true,
    notification_channels: { in_app: true, email: true, webhook: false },
    cooldown_minutes: 30,
  },
  {
    metric_type: 'fid',
    warning_threshold: 100,
    critical_threshold: 300,
    enabled: true,
    notification_channels: { in_app: true, email: false, webhook: false },
    cooldown_minutes: 30,
  },
  {
    metric_type: 'cls',
    warning_threshold: 0.1,
    critical_threshold: 0.25,
    enabled: true,
    notification_channels: { in_app: true, email: false, webhook: false },
    cooldown_minutes: 30,
  },
  {
    metric_type: 'ttfb',
    warning_threshold: 800,
    critical_threshold: 1800,
    enabled: true,
    notification_channels: { in_app: true, email: true, webhook: false },
    cooldown_minutes: 15,
  },
  {
    metric_type: 'inp',
    warning_threshold: 200,
    critical_threshold: 500,
    enabled: true,
    notification_channels: { in_app: true, email: false, webhook: false },
    cooldown_minutes: 30,
  },
  {
    metric_type: 'api_latency',
    warning_threshold: 500,
    critical_threshold: 1000,
    enabled: true,
    notification_channels: { in_app: true, email: true, webhook: true },
    cooldown_minutes: 10,
  },
  {
    metric_type: 'error_rate',
    warning_threshold: 5,
    critical_threshold: 10,
    enabled: true,
    notification_channels: { in_app: true, email: true, webhook: true },
    cooldown_minutes: 5,
  },
];

/**
 * Performance Alert Service
 */
export class PerformanceAlertService extends EventEmitter {
  private static instance: PerformanceAlertService;
  private thresholdCache: Map<string, PerformanceThreshold> = new Map();
  private lastAlertTime: Map<string, number> = new Map();

  private constructor() {
    super();
    this.initializeDefaultThresholds();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PerformanceAlertService {
    if (!PerformanceAlertService.instance) {
      PerformanceAlertService.instance = new PerformanceAlertService();
    }
    return PerformanceAlertService.instance;
  }

  /**
   * Initialize default thresholds if not exist
   */
  private async initializeDefaultThresholds(): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      
      // Check if thresholds already exist
      const { data: existing } = await supabase
        .from('performance_thresholds')
        .select('metric_type');

      if (existing && existing.length > 0) {
        // Load existing thresholds into cache
        for (const threshold of existing) {
          this.thresholdCache.set(threshold.metric_type, threshold as PerformanceThreshold);
        }
        log.info(`Loaded ${existing.length} existing thresholds`);
        return;
      }

      // Create default thresholds
      const { data, error } = await supabase
        .from('performance_thresholds')
        .insert(DEFAULT_THRESHOLDS.map(t => ({
          ...t,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })))
        .select();

      if (error) {
        log.error('Failed to create default thresholds:', error);
        return;
      }

      // Cache the thresholds
      for (const threshold of data || []) {
        this.thresholdCache.set(threshold.metric_type, threshold as PerformanceThreshold);
      }

      log.info(`Created ${data?.length || 0} default thresholds`);
    } catch (error) {
      log.error('Error initializing thresholds:', error);
    }
  }

  /**
   * Get all thresholds
   */
  async getThresholds(): Promise<PerformanceThreshold[]> {
    if (this.thresholdCache.size === 0) {
      await this.initializeDefaultThresholds();
    }
    return Array.from(this.thresholdCache.values());
  }

  /**
   * Get threshold for a specific metric
   */
  async getThreshold(metricType: string): Promise<PerformanceThreshold | null> {
    if (this.thresholdCache.size === 0) {
      await this.initializeDefaultThresholds();
    }
    return this.thresholdCache.get(metricType) || null;
  }

  /**
   * Update a threshold
   */
  async updateThreshold(
    metricType: string,
    updates: Partial<Pick<PerformanceThreshold, 'warning_threshold' | 'critical_threshold' | 'enabled' | 'notification_channels' | 'cooldown_minutes'>>
  ): Promise<PerformanceThreshold | null> {
    try {
      const supabase = getSupabaseClient();
      
      const { data, error } = await supabase
        .from('performance_thresholds')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('metric_type', metricType)
        .select()
        .single();

      if (error) {
        log.error('Failed to update threshold:', error);
        return null;
      }

      // Update cache
      if (data) {
        this.thresholdCache.set(metricType, data as PerformanceThreshold);
      }

      return data as PerformanceThreshold;
    } catch (error) {
      log.error('Error updating threshold:', error);
      return null;
    }
  }

  /**
   * Check if a metric value should trigger an alert
   */
  async checkAndAlert(
    metricType: string,
    value: number,
    context?: { page?: string; deviceType?: string; userId?: string }
  ): Promise<PerformanceAlertRecord | null> {
    const threshold = await this.getThreshold(metricType);
    
    if (!threshold || !threshold.enabled) {
      return null;
    }

    // Determine severity
    let severity: 'warning' | 'critical' | null = null;
    
    if (value >= threshold.critical_threshold) {
      severity = 'critical';
    } else if (value >= threshold.warning_threshold) {
      severity = 'warning';
    }

    if (!severity) {
      return null;
    }

    // Check cooldown
    const cooldownKey = `${metricType}:${context?.page || 'global'}`;
    const lastAlert = this.lastAlertTime.get(cooldownKey);
    const now = Date.now();

    if (lastAlert && (now - lastAlert) < threshold.cooldown_minutes * 60 * 1000) {
      log.debug(`Alert for ${metricType} is in cooldown`);
      return null;
    }

    // Create alert record
    const alert = await this.createAlert({
      metric_type: metricType,
      severity,
      current_value: value,
      threshold_value: severity === 'critical' ? threshold.critical_threshold : threshold.warning_threshold,
      page: context?.page,
      device_type: context?.deviceType,
    });

    if (alert) {
      // Update last alert time
      this.lastAlertTime.set(cooldownKey, now);

      // Send notifications
      await this.sendNotifications(alert, threshold, context?.userId);

      // Emit event
      this.emit('alert', alert);
    }

    return alert;
  }

  /**
   * Create an alert record
   */
  private async createAlert(params: {
    metric_type: string;
    severity: 'warning' | 'critical';
    current_value: number;
    threshold_value: number;
    page?: string;
    device_type?: string;
  }): Promise<PerformanceAlertRecord | null> {
    try {
      const supabase = getSupabaseClient();
      
      const { data, error } = await supabase
        .from('performance_alerts')
        .insert({
          ...params,
          status: 'active',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        log.error('Failed to create alert:', error);
        return null;
      }

      log.warn(`Performance alert created: ${params.metric_type} ${params.severity} (${params.current_value} > ${params.threshold_value})`);
      
      return data as PerformanceAlertRecord;
    } catch (error) {
      log.error('Error creating alert:', error);
      return null;
    }
  }

  /**
   * Send notifications for an alert
   */
  private async sendNotifications(
    alert: PerformanceAlertRecord,
    threshold: PerformanceThreshold,
    userId?: string
  ): Promise<void> {
    const channels = threshold.notification_channels;

    // In-app notification
    if (channels.in_app && userId) {
      await this.sendInAppNotification(alert, userId);
    }

    // Email notification
    if (channels.email) {
      await this.sendEmailNotification(alert);
    }

    // Webhook notification
    if (channels.webhook) {
      await this.sendWebhookNotification(alert);
    }
  }

  /**
   * Send in-app notification
   */
  private async sendInAppNotification(alert: PerformanceAlertRecord, userId: string): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      
      await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'performance_alert',
          title: `性能告警: ${alert.metric_type.toUpperCase()}`,
          message: `${alert.metric_type.toUpperCase()} ${alert.severity === 'critical' ? '严重' : '警告'}: 当前值 ${alert.current_value} 超过阈值 ${alert.threshold_value}${alert.page ? ` (页面: ${alert.page})` : ''}`,
          severity: alert.severity,
          data: {
            alert_id: alert.id,
            metric_type: alert.metric_type,
            current_value: alert.current_value,
            threshold_value: alert.threshold_value,
            page: alert.page,
          },
          created_at: new Date().toISOString(),
        });

      log.info(`In-app notification sent for alert ${alert.id}`);
    } catch (error) {
      log.error('Failed to send in-app notification:', error);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(alert: PerformanceAlertRecord): Promise<void> {
    // TODO: Integrate with email service
    log.info(`Email notification would be sent for alert ${alert.id}`);
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(alert: PerformanceAlertRecord): Promise<void> {
    // TODO: Integrate with webhook system
    log.info(`Webhook notification would be sent for alert ${alert.id}`);
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(limit: number = 50): Promise<PerformanceAlertRecord[]> {
    try {
      const supabase = getSupabaseClient();
      
      const { data, error } = await supabase
        .from('performance_alerts')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        log.error('Failed to get active alerts:', error);
        return [];
      }

      return (data || []) as PerformanceAlertRecord[];
    } catch (error) {
      log.error('Error getting active alerts:', error);
      return [];
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      
      const { error } = await supabase
        .from('performance_alerts')
        .update({
          status: 'acknowledged',
          acknowledged_by: userId,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (error) {
        log.error('Failed to acknowledge alert:', error);
        return false;
      }

      log.info(`Alert ${alertId} acknowledged by ${userId}`);
      return true;
    } catch (error) {
      log.error('Error acknowledging alert:', error);
      return false;
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      
      const { error } = await supabase
        .from('performance_alerts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (error) {
        log.error('Failed to resolve alert:', error);
        return false;
      }

      log.info(`Alert ${alertId} resolved`);
      return true;
    } catch (error) {
      log.error('Error resolving alert:', error);
      return false;
    }
  }

  /**
   * Get alert history
   */
  async getAlertHistory(params: {
    startDate?: string;
    endDate?: string;
    metricType?: string;
    severity?: 'warning' | 'critical';
    status?: 'active' | 'acknowledged' | 'resolved';
    limit?: number;
    offset?: number;
  } = {}): Promise<{ alerts: PerformanceAlertRecord[]; total: number }> {
    try {
      const supabase = getSupabaseClient();
      
      let query = supabase
        .from('performance_alerts')
        .select('*', { count: 'exact' });

      if (params.startDate) {
        query = query.gte('created_at', params.startDate);
      }
      if (params.endDate) {
        query = query.lte('created_at', params.endDate);
      }
      if (params.metricType) {
        query = query.eq('metric_type', params.metricType);
      }
      if (params.severity) {
        query = query.eq('severity', params.severity);
      }
      if (params.status) {
        query = query.eq('status', params.status);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(params.offset || 0, (params.offset || 0) + (params.limit || 50) - 1);

      const { data, error, count } = await query;

      if (error) {
        log.error('Failed to get alert history:', error);
        return { alerts: [], total: 0 };
      }

      return {
        alerts: (data || []) as PerformanceAlertRecord[],
        total: count || 0,
      };
    } catch (error) {
      log.error('Error getting alert history:', error);
      return { alerts: [], total: 0 };
    }
  }

  /**
   * Clear cache and reload thresholds
   */
  async reloadThresholds(): Promise<void> {
    this.thresholdCache.clear();
    await this.initializeDefaultThresholds();
  }
}

// Export singleton instance
export const performanceAlertService = PerformanceAlertService.getInstance();
export default performanceAlertService;