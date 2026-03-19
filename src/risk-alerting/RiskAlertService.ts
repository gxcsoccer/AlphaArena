/**
 * Risk Alert Service
 * 
 * Core service for monitoring portfolio risk and triggering alerts.
 * Integrates with the existing AlertService for notification delivery.
 */

import { EventEmitter } from 'events';
import {
  RiskAlertRule,
  RiskMetrics,
  RiskAlert,
  RiskType,
  RiskSeverity,
  RiskAlertStatus,
  NotificationChannels,
  PortfolioData,
  RiskAlertHistory,
  UserRiskConfig,
  RiskAlertStats,
  RiskCalculationResult,
} from './types';
import { RiskCalculator, riskCalculator } from './RiskCalculator';
import { getAlertService } from '../alerting/AlertService';
import { createLogger } from '../utils/logger';

const log = createLogger('RiskAlertService');

/**
 * Risk Alert Service
 * 
 * Monitors portfolio risk metrics and triggers alerts when thresholds are exceeded.
 */
export class RiskAlertService extends EventEmitter {
  private static instance: RiskAlertService | null = null;
  private riskCalculator: RiskCalculator;
  private alertCounts: Map<string, { count: number; resetAt: number }> = new Map();
  private ruleCooldowns: Map<string, Date> = new Map();
  private userConfigs: Map<string, UserRiskConfig> = new Map();

  private constructor() {
    super();
    this.riskCalculator = new RiskCalculator();
    this.startPeriodicCleanup();
  }

  static getInstance(): RiskAlertService {
    if (!RiskAlertService.instance) {
      RiskAlertService.instance = new RiskAlertService();
    }
    return RiskAlertService.instance;
  }

  /**
   * Monitor portfolio and check for risk alerts
   */
  async monitorPortfolio(
    userId: string,
    portfolio: PortfolioData,
    rules?: RiskAlertRule[]
  ): Promise<RiskCalculationResult[]> {
    log.info(`Monitoring portfolio for user ${userId}`);

    // Calculate all risk metrics
    const metrics = this.riskCalculator.calculateRiskMetrics(portfolio);
    const overallScore = this.riskCalculator.calculateOverallScore(metrics);
    metrics.overallScore = overallScore;

    // Get user's risk config
    const config = await this.getUserConfig(userId);
    
    // If no custom rules provided, use user's config to get rules
    const activeRules = rules ?? await this.getUserRules(userId);
    
    // Check each rule
    const results: RiskCalculationResult[] = [];
    
    for (const rule of activeRules) {
      if (!rule.isEnabled) {
        continue;
      }

      // Check if in cooldown
      if (this.isInCooldown(rule.id)) {
        log.debug(`Rule ${rule.id} is in cooldown`);
        continue;
      }

      // Check if in quiet hours
      if (this.isInQuietHours(config, rule)) {
        log.debug(`User ${userId} is in quiet hours for rule ${rule.id}`);
        continue;
      }

      // Calculate risk for this type
      const result = this.riskCalculator.checkRiskThreshold(
        metrics,
        rule.riskType,
        rule.threshold
      );

      // If threshold exceeded, trigger alert
      if (result.exceeded) {
        const alert = await this.triggerAlert(userId, rule, result, portfolio);
        if (alert) {
          results.push(result);
          this.setCooldown(rule.id, rule.cooldownMinutes);
        }
      }
    }

    // Emit monitoring complete event
    this.emit('monitoring:complete', {
      userId,
      metrics,
      alerts: results,
    });

    return results;
  }

  /**
   * Check a specific risk type
   */
  async checkRisk(
    userId: string,
    portfolio: PortfolioData,
    riskType: RiskType,
    threshold?: number
  ): Promise<RiskCalculationResult> {
    const metrics = this.riskCalculator.calculateRiskMetrics(portfolio);
    const config = await this.getUserConfig(userId);
    const effectiveThreshold = threshold ?? config.presetThresholds[riskType];

    return this.riskCalculator.checkRiskThreshold(metrics, riskType, effectiveThreshold);
  }

  /**
   * Trigger a risk alert
   */
  private async triggerAlert(
    userId: string,
    rule: RiskAlertRule,
    result: RiskCalculationResult,
    portfolio: PortfolioData
  ): Promise<RiskAlert | null> {
    log.info(`Triggering ${result.riskType} alert for user ${userId}`);

    // Check rate limit
    const config = await this.getUserConfig(userId);
    if (!this.checkRateLimit(userId, config.maxAlertsPerHour)) {
      log.warn(`Rate limit exceeded for user ${userId}`);
      return null;
    }

    // Create alert record
    const alert: RiskAlert = {
      id: this.generateAlertId(),
      userId,
      ruleId: rule.id,
      riskType: result.riskType,
      severity: result.severity,
      status: 'active',
      title: this.generateAlertTitle(result),
      message: result.message,
      currentValue: result.value,
      threshold: result.threshold,
      context: {
        ...result.details,
        portfolioValue: portfolio.totalValue,
        positionCount: portfolio.positions.length,
        triggeredAt: new Date().toISOString(),
      },
      triggeredAt: new Date(),
      notificationChannels: rule.channels,
      notificationStatus: 'pending',
    };

    // Send notifications using existing AlertService
    await this.sendNotifications(alert, rule);

    // Emit alert event
    this.emit('alert:triggered', alert);

    return alert;
  }

  /**
   * Generate alert title based on risk type and severity
   */
  private generateAlertTitle(result: RiskCalculationResult): string {
    const severityEmoji = {
      low: '⚠️',
      medium: '🔶',
      high: '🔴',
      critical: '🚨',
    };

    const typeNames: Record<RiskType, string> = {
      concentration: '持仓集中度',
      drawdown: '账户回撤',
      volatility: '市场波动',
      leverage: '杠杆风险',
      liquidity: '流动性风险',
    };

    return `${severityEmoji[result.severity]} ${typeNames[result.riskType]}告警`;
  }

  /**
   * Send notifications through various channels
   */
  private async sendNotifications(
    alert: RiskAlert,
    rule: RiskAlertRule
  ): Promise<void> {
    try {
      const alertService = getAlertService();

      // Map risk type to alert type
      const alertTypeMap: Record<RiskType, string> = {
        concentration: 'position_limit',
        drawdown: 'position_limit',
        volatility: 'error_rate',
        leverage: 'circuit_breaker',
        liquidity: 'position_limit',
      };

      // Send via existing AlertService
      await alertService.triggerAlert(
        alertTypeMap[alert.riskType] as 'position_limit' | 'error_rate' | 'circuit_breaker',
        {
          userId: alert.userId,
          entityType: 'system',
          current_value: alert.currentValue,
          threshold_value: alert.threshold,
          risk_type: alert.riskType,
          severity: alert.severity,
          message: alert.message,
        },
        {
          severity: alert.severity,
          customTitle: alert.title,
          customMessage: alert.message,
        }
      );

      log.info(`Notifications sent for alert ${alert.id}`);
    } catch (error) {
      log.error('Failed to send notifications:', error);
    }
  }

  /**
   * Get user's risk configuration
   */
  async getUserConfig(userId: string): Promise<UserRiskConfig> {
    // Check cache first
    const cached = this.userConfigs.get(userId);
    if (cached) {
      return cached;
    }

    // Return default config
    const defaultConfig: UserRiskConfig = {
      userId,
      alertsEnabled: true,
      defaultChannels: {
        inApp: true,
        email: false,
        webhook: false,
      },
      maxAlertsPerHour: 10,
      presetThresholds: {
        concentration: 0.3,    // 30% max position
        drawdown: 0.1,         // 10% max drawdown
        volatility: 0.5,       // 50% annualized volatility
        leverage: 2.0,         // 2x leverage
        liquidity: 20,         // 20/100 liquidity score minimum
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return defaultConfig;
  }

  /**
   * Update user's risk configuration
   */
  async updateUserConfig(
    userId: string,
    updates: Partial<UserRiskConfig>
  ): Promise<UserRiskConfig> {
    const current = await this.getUserConfig(userId);
    const updated = {
      ...current,
      ...updates,
      updatedAt: new Date(),
    };
    
    this.userConfigs.set(userId, updated);
    return updated;
  }

  /**
   * Get user's alert rules
   * 
   * Note: In production, this would fetch from database
   * For now, returns default rules based on user config
   */
  async getUserRules(userId: string): Promise<RiskAlertRule[]> {
    const config = await this.getUserConfig(userId);

    // Default rules based on preset thresholds
    const defaultRules: RiskAlertRule[] = [
      {
        id: `${userId}-concentration`,
        userId,
        name: '持仓集中度告警',
        description: '当单一持仓占比超过阈值时触发',
        riskType: 'concentration',
        threshold: config.presetThresholds.concentration,
        severity: 'high',
        channels: config.defaultChannels,
        webhookUrl: config.defaultWebhookUrl,
        emailAddress: config.emailAddress,
        cooldownMinutes: 60,
        isEnabled: config.alertsEnabled,
        triggerCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: `${userId}-drawdown`,
        userId,
        name: '回撤告警',
        description: '当账户回撤超过阈值时触发',
        riskType: 'drawdown',
        threshold: config.presetThresholds.drawdown,
        severity: 'critical',
        channels: config.defaultChannels,
        webhookUrl: config.defaultWebhookUrl,
        emailAddress: config.emailAddress,
        cooldownMinutes: 30,
        isEnabled: config.alertsEnabled,
        triggerCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: `${userId}-volatility`,
        userId,
        name: '波动率告警',
        description: '当市场波动率超过阈值时触发',
        riskType: 'volatility',
        threshold: config.presetThresholds.volatility,
        severity: 'medium',
        channels: config.defaultChannels,
        webhookUrl: config.defaultWebhookUrl,
        emailAddress: config.emailAddress,
        cooldownMinutes: 120,
        isEnabled: config.alertsEnabled,
        triggerCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: `${userId}-leverage`,
        userId,
        name: '杠杆告警',
        description: '当杠杆率超过阈值时触发',
        riskType: 'leverage',
        threshold: config.presetThresholds.leverage,
        severity: 'high',
        channels: config.defaultChannels,
        webhookUrl: config.defaultWebhookUrl,
        emailAddress: config.emailAddress,
        cooldownMinutes: 30,
        isEnabled: config.alertsEnabled,
        triggerCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: `${userId}-liquidity`,
        userId,
        name: '流动性告警',
        description: '当流动性评分低于阈值时触发',
        riskType: 'liquidity',
        threshold: config.presetThresholds.liquidity,
        severity: 'medium',
        channels: config.defaultChannels,
        webhookUrl: config.defaultWebhookUrl,
        emailAddress: config.emailAddress,
        cooldownMinutes: 60,
        isEnabled: config.alertsEnabled,
        triggerCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    return defaultRules;
  }

  /**
   * Get current risk metrics for a portfolio
   */
  getRiskMetrics(portfolio: PortfolioData): RiskMetrics {
    const metrics = this.riskCalculator.calculateRiskMetrics(portfolio);
    metrics.overallScore = this.riskCalculator.calculateOverallScore(metrics);
    return metrics;
  }

  /**
   * Get top concentrated positions
   */
  getTopConcentratedPositions(
    portfolio: PortfolioData,
    limit?: number
  ): Array<{ symbol: string; concentration: number; marketValue: number }> {
    return this.riskCalculator.getTopConcentratedPositions(portfolio, limit);
  }

  /**
   * Check rate limit for user
   */
  private checkRateLimit(userId: string, maxPerHour: number): boolean {
    const now = Date.now();
    const record = this.alertCounts.get(userId);

    if (!record || now > record.resetAt) {
      this.alertCounts.set(userId, {
        count: 1,
        resetAt: now + 60 * 60 * 1000,
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
   * Check if rule is in cooldown
   */
  private isInCooldown(ruleId: string): boolean {
    const cooldownEnd = this.ruleCooldowns.get(ruleId);
    if (!cooldownEnd) {
      return false;
    }
    return new Date() < cooldownEnd;
  }

  /**
   * Set cooldown for a rule
   */
  private setCooldown(ruleId: string, minutes: number): void {
    const cooldownEnd = new Date(Date.now() + minutes * 60 * 1000);
    this.ruleCooldowns.set(ruleId, cooldownEnd);
  }

  /**
   * Check if current time is in quiet hours
   */
  private isInQuietHours(config: UserRiskConfig, rule: RiskAlertRule): boolean {
    const quietStart = rule.quietHoursStart ?? config.quietHoursStart;
    const quietEnd = rule.quietHoursEnd ?? config.quietHoursEnd;

    if (!quietStart || !quietEnd) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = quietStart.split(':').map(Number);
    const [endHour, endMin] = quietEnd.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (startMinutes < endMinutes) {
      // Quiet hours don't cross midnight
      return currentTime >= startMinutes && currentTime < endMinutes;
    } else {
      // Quiet hours cross midnight
      return currentTime >= startMinutes || currentTime < endMinutes;
    }
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start periodic cleanup
   */
  private startPeriodicCleanup(): void {
    // Clean up rate limit counters every hour
    setInterval(() => {
      const now = Date.now();
      this.alertCounts.forEach((record, key) => {
        if (now > record.resetAt) {
          this.alertCounts.delete(key);
        }
      });
    }, 60 * 60 * 1000);

    // Clean up expired cooldowns every 10 minutes
    setInterval(() => {
      const now = new Date();
      this.ruleCooldowns.forEach((endTime, key) => {
        if (now >= endTime) {
          this.ruleCooldowns.delete(key);
        }
      });
    }, 10 * 60 * 1000);
  }
}

// Singleton instance
export function getRiskAlertService(): RiskAlertService {
  return RiskAlertService.getInstance();
}

export default RiskAlertService;