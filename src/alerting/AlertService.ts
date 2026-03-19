/**
 * Alert Service
 * Core service for monitoring and alerting
 * 
 * Features:
 * - Alert rule evaluation
 * - Multi-channel notification (in-app, email, webhook)
 * - Alert history management
 * - Integration with scheduler and monitoring systems
 */

import { EventEmitter } from 'events';
import {
  alertRulesDao,
  AlertRule,
  AlertRuleType,
  AlertSeverity,
  CreateAlertRuleInput,
  AlertRuleFilters,
} from '../database/alert-rules.dao';
import {
  alertHistoryDao,
  AlertHistory,
  CreateAlertHistoryInput,
  AlertHistoryFilters,
} from '../database/alert-history.dao';
import {
  alertConfigurationsDao,
  AlertConfiguration,
} from '../database/alert-configurations.dao';
import { createRiskNotification, createSystemNotification } from '../notification/NotificationService';
import { createLogger } from '../utils/logger';

const log = createLogger('AlertService');

export interface AlertContext {
  userId: string;
  entityType?: 'scheduler' | 'strategy' | 'system' | 'user';
  entityId?: string;
  entityName?: string;
  [key: string]: unknown;
}

export interface SchedulerAlertContext extends AlertContext {
  scheduleId: string;
  scheduleName: string;
  strategyId?: string;
  executionId?: string;
  consecutiveFailures?: number;
  errorMessage?: string;
  executionTimeMs?: number;
  timeoutMs?: number;
}

export interface AlertNotifierConfig {
  sendInApp?: boolean;
  sendEmail?: boolean;
  sendWebhook?: boolean;
  webhookUrl?: string;
}

// Alert message templates
const ALERT_TEMPLATES: Record<AlertRuleType, {
  getTitle: (ctx: AlertContext) => string;
  getMessage: (ctx: AlertContext) => string;
}> = {
  consecutive_failures: {
    getTitle: (ctx) => `连续执行失败告警: ${ctx.entityName ?? '调度器'}`,
    getMessage: (ctx) => `调度器 "${ctx.entityName ?? ctx.entityId}" 已连续失败 ${(ctx as SchedulerAlertContext).consecutiveFailures ?? 0} 次。最近错误: ${(ctx as SchedulerAlertContext).errorMessage ?? '未知'}`,
  },
  execution_timeout: {
    getTitle: (ctx) => `执行超时告警: ${ctx.entityName ?? '调度器'}`,
    getMessage: (ctx) => `调度器 "${ctx.entityName ?? ctx.entityId}" 执行超时。执行时间: ${(ctx as SchedulerAlertContext).executionTimeMs ?? 0}ms，超时阈值: ${(ctx as SchedulerAlertContext).timeoutMs ?? 0}ms`,
  },
  position_limit: {
    getTitle: (ctx) => `仓位限制告警`,
    getMessage: (ctx) => `仓位已达到限制阈值。当前仓位: ${ctx.currentPosition ?? '未知'}，限制: ${ctx.positionLimit ?? '未知'}`,
  },
  circuit_breaker: {
    getTitle: (ctx) => `熔断触发告警`,
    getMessage: (ctx) => `交易已触发熔断机制。原因: ${ctx.circuitBreakerReason ?? '未知'}，将在 ${ctx.circuitBreakerCooldown ?? '一段时间'} 后恢复`,
  },
  error_rate: {
    getTitle: (ctx) => `错误率过高告警: ${ctx.entityName ?? '系统'}`,
    getMessage: (ctx) => `${ctx.entityName ?? '系统'} 错误率已超过阈值。当前错误率: ${ctx.errorRate ?? '未知'}%，阈值: ${ctx.errorRateThreshold ?? '未知'}%`,
  },
  custom: {
    getTitle: (ctx) => `自定义告警: ${ctx.entityName ?? '系统'}`,
    getMessage: (ctx) => (ctx.customMessage as string) ?? '触发自定义告警',
  },
};

export class AlertService extends EventEmitter {
  private static instance: AlertService | null = null;
  private alertCounts: Map<string, { count: number; resetAt: number }> = new Map();

  private constructor() {
    super();
    this.startPeriodicCleanup();
  }

  static getInstance(): AlertService {
    if (!AlertService.instance) {
      AlertService.instance = new AlertService();
    }
    return AlertService.instance;
  }

  /**
   * Create a new alert rule
   */
  async createRule(input: CreateAlertRuleInput): Promise<AlertRule | null> {
    log.info('Creating alert rule:', input.name);
    const rule = await alertRulesDao.createAlertRule(input);
    if (rule) {
      this.emit('rule:created', rule);
    }
    return rule;
  }

  /**
   * Get alert rule by ID
   */
  async getRule(id: string): Promise<AlertRule | null> {
    return alertRulesDao.getAlertRuleById(id);
  }

  /**
   * List alert rules
   */
  async listRules(filters: AlertRuleFilters): Promise<{ rules: AlertRule[]; total: number }> {
    return alertRulesDao.listAlertRules(filters);
  }

  /**
   * Update alert rule
   */
  async updateRule(id: string, input: Partial<CreateAlertRuleInput>): Promise<AlertRule | null> {
    const rule = await alertRulesDao.updateAlertRule(id, input);
    if (rule) {
      this.emit('rule:updated', rule);
    }
    return rule;
  }

  /**
   * Delete alert rule
   */
  async deleteRule(id: string): Promise<boolean> {
    const result = await alertRulesDao.deleteAlertRule(id);
    if (result) {
      this.emit('rule:deleted', id);
    }
    return result;
  }

  /**
   * Trigger an alert based on rule type and context
   */
  async triggerAlert(
    ruleType: AlertRuleType,
    context: AlertContext,
    options?: {
      severity?: AlertSeverity;
      ruleId?: string;
      customTitle?: string;
      customMessage?: string;
    }
  ): Promise<AlertHistory | null> {
    const { userId } = context;
    
    log.info(`Triggering ${ruleType} alert for user ${userId}`);

    // Check if alerts are enabled for this user
    const config = await alertConfigurationsDao.getAlertConfiguration(userId);
    if (!config?.alerts_enabled) {
      log.debug(`Alerts disabled for user ${userId}`);
      return null;
    }

    // Check quiet hours
    if (await alertConfigurationsDao.isInQuietHours(userId)) {
      log.debug(`User ${userId} is in quiet hours`);
      // Still create the alert history but mark as skipped
      return this.createAlertHistory({
        user_id: userId,
        rule_id: options?.ruleId,
        rule_type: ruleType,
        severity: options?.severity ?? 'medium',
        title: options?.customTitle ?? ALERT_TEMPLATES[ruleType].getTitle(context),
        message: options?.customMessage ?? ALERT_TEMPLATES[ruleType].getMessage(context),
        context: context as unknown as Record<string, unknown>,
        notification_status: 'skipped',
        notification_channels: {},
      });
    }

    // Check rate limit
    if (!(await this.checkRateLimit(userId, config.max_alerts_per_hour))) {
      log.warn(`Rate limit exceeded for user ${userId}`);
      return null;
    }

    // Get applicable rules
    let rule: AlertRule | null = null;
    if (options?.ruleId) {
      rule = await alertRulesDao.getAlertRuleById(options.ruleId);
    } else {
      // Find matching rule
      const rules = await alertRulesDao.getRulesForEntity(
        context.entityType ?? 'system',
        context.entityId,
        userId
      );
      rule = rules.find(r => r.rule_type === ruleType) ?? null;
    }

    // If rule exists, check cooldown
    if (rule) {
      if (await alertRulesDao.isRuleInCooldown(rule.id)) {
        log.debug(`Rule ${rule.id} is in cooldown`);
        return null;
      }
    }

    // Determine severity
    const severity = options?.severity ?? rule?.severity ?? 'medium';

    // Determine channels
    const channels = rule?.channels ?? config.default_channels;

    // Generate alert content
    const title = options?.customTitle ?? ALERT_TEMPLATES[ruleType].getTitle(context);
    const message = options?.customMessage ?? ALERT_TEMPLATES[ruleType].getMessage(context);

    // Create alert history
    const alertHistory = await this.createAlertHistory({
      user_id: userId,
      rule_id: rule?.id,
      rule_type: ruleType,
      severity,
      title,
      message,
      context: context as unknown as Record<string, unknown>,
      notification_status: 'pending',
      notification_channels: channels,
    });

    if (!alertHistory) {
      log.error('Failed to create alert history');
      return null;
    }

    // Send notifications
    const notificationResults = await this.sendNotifications(alertHistory, channels, {
      webhookUrl: rule?.webhook_url ?? config.default_webhook_url,
      email: config.email_address,
    });

    // Update notification status
    const allSucceeded = Object.values(notificationResults).every(r => r);
    await alertHistoryDao.updateAlertHistory(alertHistory.id, {
      notification_status: allSucceeded ? 'sent' : 'failed',
      sent_at: new Date(),
    });

    // Update rule trigger info
    if (rule) {
      await alertRulesDao.updateAlertRuleTrigger(rule.id);
    }

    // Emit alert triggered event
    this.emit('alert:triggered', {
      alertHistory,
      notificationResults,
    });

    log.info(`Alert ${alertHistory.id} triggered and ${allSucceeded ? 'sent' : 'failed'}`);
    return alertHistory;
  }

  /**
   * Convenience method for scheduler consecutive failures alert
   */
  async alertConsecutiveFailures(
    userId: string,
    scheduleId: string,
    scheduleName: string,
    consecutiveFailures: number,
    errorMessage?: string,
    strategyId?: string
  ): Promise<AlertHistory | null> {
    return this.triggerAlert('consecutive_failures', {
      userId,
      entityType: 'scheduler',
      entityId: scheduleId,
      entityName: scheduleName,
      scheduleId,
      scheduleName,
      strategyId,
      consecutiveFailures,
      errorMessage,
    } as SchedulerAlertContext);
  }

  /**
   * Convenience method for execution timeout alert
   */
  async alertExecutionTimeout(
    userId: string,
    scheduleId: string,
    scheduleName: string,
    executionTimeMs: number,
    timeoutMs: number,
    executionId?: string
  ): Promise<AlertHistory | null> {
    return this.triggerAlert('execution_timeout', {
      userId,
      entityType: 'scheduler',
      entityId: scheduleId,
      entityName: scheduleName,
      scheduleId,
      scheduleName,
      executionId,
      executionTimeMs,
      timeoutMs,
    } as SchedulerAlertContext);
  }

  /**
   * Convenience method for position limit alert
   */
  async alertPositionLimit(
    userId: string,
    currentPosition: number,
    positionLimit: number,
    symbol?: string
  ): Promise<AlertHistory | null> {
    return this.triggerAlert('position_limit', {
      userId,
      entityType: 'system',
      currentPosition,
      positionLimit,
      symbol,
    } as AlertContext);
  }

  /**
   * Convenience method for circuit breaker alert
   */
  async alertCircuitBreaker(
    userId: string,
    reason: string,
    cooldownMinutes?: number
  ): Promise<AlertHistory | null> {
    return this.triggerAlert('circuit_breaker', {
      userId,
      entityType: 'system',
      circuitBreakerReason: reason,
      circuitBreakerCooldown: cooldownMinutes ? `${cooldownMinutes}分钟` : undefined,
    } as AlertContext, { severity: 'critical' });
  }

  /**
   * Get alert history
   */
  async getAlertHistory(
    userId: string,
    filters?: Partial<AlertHistoryFilters>
  ): Promise<{ alerts: AlertHistory[]; total: number }> {
    return alertHistoryDao.listAlertHistory({
      user_id: userId,
      ...filters,
    });
  }

  /**
   * Get alert by ID
   */
  async getAlert(id: string): Promise<AlertHistory | null> {
    return alertHistoryDao.getAlertHistoryById(id);
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(id: string, userId: string): Promise<AlertHistory | null> {
    const alert = await alertHistoryDao.acknowledgeAlert(id, userId);
    if (alert) {
      this.emit('alert:acknowledged', alert);
    }
    return alert;
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(
    id: string,
    userId: string,
    resolutionNote?: string
  ): Promise<AlertHistory | null> {
    const alert = await alertHistoryDao.resolveAlert(id, userId, resolutionNote);
    if (alert) {
      this.emit('alert:resolved', alert);
    }
    return alert;
  }

  /**
   * Get unacknowledged alerts for a user
   */
  async getUnacknowledgedAlerts(userId: string): Promise<AlertHistory[]> {
    return alertHistoryDao.getUnacknowledgedAlerts(userId);
  }

  /**
   * Get alert statistics
   */
  async getAlertStats(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    return alertHistoryDao.getAlertStats(userId, startDate, endDate);
  }

  /**
   * Get user alert configuration
   */
  async getConfiguration(userId: string): Promise<AlertConfiguration | null> {
    return alertConfigurationsDao.getAlertConfiguration(userId);
  }

  /**
   * Update user alert configuration
   */
  async updateConfiguration(
    userId: string,
    input: Partial<AlertConfiguration>
  ): Promise<AlertConfiguration | null> {
    return alertConfigurationsDao.updateAlertConfiguration(userId, input);
  }

  /**
   * Create alert history entry
   */
  private async createAlertHistory(
    input: CreateAlertHistoryInput
  ): Promise<AlertHistory | null> {
    return alertHistoryDao.createAlertHistory(input);
  }

  /**
   * Send notifications through various channels
   */
  private async sendNotifications(
    alert: AlertHistory,
    channels: { in_app: boolean; email: boolean; webhook: boolean },
    options?: { webhookUrl?: string; email?: string }
  ): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    // Send in-app notification
    if (channels.in_app) {
      results.in_app = await this.sendInAppNotification(alert);
    }

    // Send email notification
    if (channels.email && options?.email) {
      results.email = await this.sendEmailNotification(alert, options.email);
    }

    // Send webhook notification
    if (channels.webhook && options?.webhookUrl) {
      results.webhook = await this.sendWebhookNotification(alert, options.webhookUrl);
    }

    return results;
  }


  /**
   * Map alert rule type to risk notification type
   */
  private mapRuleTypeToRiskType(ruleType: AlertRuleType): 'position_limit' | 'loss_threshold' | 'exposure_limit' | 'margin_call' {
    const mapping: Record<AlertRuleType, 'position_limit' | 'loss_threshold' | 'exposure_limit' | 'margin_call'> = {
      consecutive_failures: 'loss_threshold',
      execution_timeout: 'exposure_limit',
      position_limit: 'position_limit',
      circuit_breaker: 'margin_call',
      error_rate: 'loss_threshold',
      custom: 'position_limit',
    };
    return mapping[ruleType] || 'position_limit';
  }
  /**
   * Send in-app notification
   */
  private async sendInAppNotification(alert: AlertHistory): Promise<boolean> {
    try {
      await createRiskNotification(
        alert.user_id,
        alert.title,
        alert.message,
        {
          risk_type: this.mapRuleTypeToRiskType(alert.rule_type),
          current_value: 0,
          threshold_value: 0,
          message_details: alert.message,
        }
      );
      return true;
    } catch (error) {
      log.error('Failed to send in-app notification:', error);
      return false;
    }
  }


  private async sendEmailNotification(alert: AlertHistory, email: string): Promise<boolean> {
    try {
      // Environment check: warn if called in production without email service integration
      if (process.env.NODE_ENV === 'production') {
        log.warn('Email notification called in production but email service is not integrated. Alert:', {
          alertId: alert.id,
          email,
          title: alert.title,
        });
        // Return false to indicate email was not sent
        return false;
      }

      // BACKLOG(#426): Email service integration pending
      // Required configuration: EMAIL_SERVICE_PROVIDER, EMAIL_API_KEY, EMAIL_FROM_ADDRESS
      // Recommended providers: Resend (simplicity), AWS SES (cost-effective), SendGrid
      // For development, just log it
      log.info(`[DEV] Would send email to ${email}: ${alert.title}`);
      log.info(`[DEV] Alert details: ${JSON.stringify({ id: alert.id, type: alert.rule_type, severity: alert.severity })}`);
      return true;
    } catch (error) {
      log.error('Failed to send email notification:', error);
      return false;
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(
    alert: AlertHistory,
    webhookUrl: string
  ): Promise<boolean> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: alert.id,
          type: 'alert',
          rule_type: alert.rule_type,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          context: alert.context,
          created_at: alert.created_at,
        }),
      });

      return response.ok;
    } catch (error) {
      log.error('Failed to send webhook notification:', error);
      return false;
    }
  }

  /**
   * Check rate limit for a user
   */
  private async checkRateLimit(userId: string, maxPerHour: number): Promise<boolean> {
    const now = Date.now();
    const key = userId;
    const record = this.alertCounts.get(key);

    if (!record || now > record.resetAt) {
      // Reset or create new record
      this.alertCounts.set(key, {
        count: 1,
        resetAt: now + 60 * 60 * 1000, // 1 hour
      });
      return true;
    }

    if (record.count >= maxPerHour) {
      return false;
    }

    record.count++;
    return true;
  }

  /**
   * Start periodic cleanup of old data
   */
  private startPeriodicCleanup(): void {
    // Clean up alert counts every hour
    setInterval(() => {
      const now = Date.now();
      this.alertCounts.forEach((record, key) => {
        if (now > record.resetAt) {
          this.alertCounts.delete(key);
        }
      });
    }, 60 * 60 * 1000);

    // Clean up old alert history every day
    setInterval(async () => {
      try {
        const deleted = await alertHistoryDao.deleteOldAlertHistory(90);
        if (deleted > 0) {
          log.info(`Cleaned up ${deleted} old alert history entries`);
        }
      } catch (error) {
        log.error('Failed to clean up old alert history:', error);
      }
    }, 24 * 60 * 60 * 1000);
  }
}

// Singleton instance getter
export function getAlertService(): AlertService {
  return AlertService.getInstance();
}

export default AlertService;
