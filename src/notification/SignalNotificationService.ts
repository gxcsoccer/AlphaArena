/**
 * Signal Notification Service (Enhanced)
 * Handles enhanced signal notifications with templates, rate limiting,
 * market context, and multi-channel delivery
 */

import { createLogger } from '../utils/logger';
import { getSupabaseClient } from '../database/client';
import { NotificationHistoryDAO, NotificationHistory, NotificationChannel } from '../database/notification-history.dao';
import { StrategyNotificationConfigDAO, StrategyNotificationConfig } from '../database/strategy-notification-config.dao';
import { SignalPushConfigDAO, SignalPushConfig } from '../database/signal-push-config.dao';
import {
  createSignalNotification,
  createSystemNotification,
} from './NotificationService';
import { getPushService } from './PushService';
import { getEmailService } from './EmailService';
import {
  getSignalNotificationTemplates,
  SignalNotificationVariables,
  MarketContext,
} from './NotificationTemplates';

const log = createLogger('SignalNotificationService');

export interface SignalNotificationInput {
  userId: string;
  signalId: string;
  strategyId?: string;
  strategyName?: string;
  symbol: string;
  side: 'buy' | 'sell';
  signalType: string;
  
  // Signal details
  entryPrice?: number;
  targetPrice?: number;
  stopLossPrice?: number;
  currentPrice?: number;
  confidenceScore?: number;
  riskLevel?: string;
  title?: string;
  description?: string;
  analysis?: string;
  
  // Status
  status?: string;
  pnl?: number;
  pnlPercent?: number;
  
  // Alert specific
  alertType?: string;
  alertMessage?: string;
  
  // Context
  marketContext?: MarketContext;
}

export interface NotificationResult {
  success: boolean;
  channels: {
    inApp: boolean;
    push: boolean;
    email: boolean;
    sms: boolean;
  };
  historyId?: string;
  error?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt?: Date;
}

class SignalNotificationServiceClass {
  private historyDAO: NotificationHistoryDAO;
  private strategyConfigDAO: StrategyNotificationConfigDAO;
  private pushConfigDAO: SignalPushConfigDAO;
  private templates: ReturnType<typeof getSignalNotificationTemplates>;

  constructor() {
    this.historyDAO = new NotificationHistoryDAO();
    this.strategyConfigDAO = new StrategyNotificationConfigDAO();
    this.pushConfigDAO = new SignalPushConfigDAO();
    this.templates = getSignalNotificationTemplates();
  }

  /**
   * Send signal notification with all configured channels
   */
  async sendSignalNotification(
    input: SignalNotificationInput,
    templateKey: string = 'signal.new'
  ): Promise<NotificationResult> {
    const result: NotificationResult = {
      success: false,
      channels: { inApp: false, push: false, email: false, sms: false },
    };

    try {
      // Initialize templates
      await this.templates.initialize();

      // Get user's global push config
      const pushConfig = await this.pushConfigDAO.getOrCreate(input.userId);

      // Check rate limit
      const rateLimit = await this.checkRateLimit(input.userId, 'SIGNAL', pushConfig);
      if (!rateLimit.allowed) {
        log.warn(`Rate limit exceeded for user ${input.userId}`);
        return {
          success: false,
          channels: result.channels,
          error: 'Rate limit exceeded',
        };
      }

      // Check quiet hours
      if (this.isInQuietHours(pushConfig)) {
        log.debug(`User ${input.userId} is in quiet hours`);
        // Still create history but don't send push/email
        result.channels.inApp = true;
      }

      // Get strategy-specific config if available
      let strategyConfig: StrategyNotificationConfig | null = null;
      if (input.strategyId) {
        strategyConfig = await this.strategyConfigDAO.getOrCreate(input.userId, input.strategyId);
        
        // Check if notifications are enabled for this strategy
        if (!strategyConfig.enabled) {
          log.debug(`Notifications disabled for strategy ${input.strategyId}`);
          return {
            success: false,
            channels: result.channels,
            error: 'Notifications disabled for this strategy',
          };
        }

        // Check if signal passes filters
        if (!this.signalPassesFilters(input, strategyConfig)) {
          log.debug(`Signal filtered out by strategy config`);
          return {
            success: false,
            channels: result.channels,
            error: 'Signal filtered by user preferences',
          };
        }
      }

      // Prepare notification variables
      const variables: SignalNotificationVariables = {
        strategy_name: input.strategyName ?? '策略信号',
        symbol: input.symbol,
        side: input.side,
        signal_type: input.signalType,
        entry_price: input.entryPrice?.toLocaleString(),
        target_price: input.targetPrice?.toLocaleString(),
        stop_loss: input.stopLossPrice?.toLocaleString(),
        current_price: input.currentPrice?.toLocaleString(),
        confidence: input.confidenceScore ? Math.round(input.confidenceScore * 100) : undefined,
        risk_level: input.riskLevel,
        status: input.status,
        pnl: input.pnl?.toFixed(2),
        pnl_percent: input.pnlPercent?.toFixed(2),
        analysis: input.analysis,
        alert_type: input.alertType,
        message: input.alertMessage,
      };

      // Add market context if available
      if (input.marketContext) {
        variables.market_context = this.templates.formatMarketContext(input.marketContext);
      }

      // Add quick actions
      variables.quick_actions = this.templates.formatQuickActions(input.signalId, input.side);

      // Render template
      const { title, body } = this.templates.render(templateKey, variables);

      // Create history record
      const history = await this.historyDAO.create({
        userId: input.userId,
        notificationType: 'SIGNAL',
        channel: 'in_app',
        title,
        message: body,
        data: {
          signalId: input.signalId,
          strategyId: input.strategyId,
          symbol: input.symbol,
          side: input.side,
        },
        entityType: 'signal',
        entityId: input.signalId,
      });

      result.historyId = history.id;

      // Send in-app notification
      if (strategyConfig?.notifyInApp ?? pushConfig.inAppNotify) {
        try {
          await createSignalNotification(
            input.userId,
            title,
            body,
            {
              symbol: input.symbol,
              side: input.side,
              price: input.entryPrice,
              strategy: input.strategyId,
              confidence: input.confidenceScore,
            },
            {
              priority: this.getPriorityFromRisk(input.riskLevel),
              actionUrl: `/signals/${input.signalId}`,
              strategyId: input.strategyId,
            }
          );
          result.channels.inApp = true;
          await this.historyDAO.updateStatus(history.id, 'sent');
        } catch (error) {
          log.error('Failed to send in-app notification:', error);
        }
      }

      // Send push notification
      if ((strategyConfig?.notifyPush ?? pushConfig.browserNotify) && !this.isInQuietHours(pushConfig)) {
        try {
          const pushService = getPushService();
          if (pushService.isConfigured) {
            // TODO: Get user's device tokens from a user devices table
            const pushResult = await pushService.send({
              tokens: [], // Empty tokens - would need device token lookup
              title,
              body,
              options: {
                data: {
                  signalId: input.signalId,
                  type: 'signal',
                  url: `/signals/${input.signalId}`,
                },
              },
            });
            result.channels.push = pushResult.success;
          }
        } catch (error) {
          log.error('Failed to send push notification:', error);
        }
      }

      // Send email notification
      if ((strategyConfig?.notifyEmail ?? pushConfig.inAppNotify) && !this.isInQuietHours(pushConfig)) {
        try {
          const emailService = getEmailService();
          if (emailService.isConfigured) {
            await emailService.send({
              to: { email: input.userId }, // Email service will look up user's email
              subject: title,
              html: this.formatEmailBody(body, input),
            });
            result.channels.email = true;
          }
        } catch (error) {
          log.error('Failed to send email notification:', error);
        }
      }

      // Send SMS notification (VIP only)
      if (strategyConfig?.notifySms && !this.isInQuietHours(pushConfig)) {
        try {
          // TODO: Implement SMS service integration
          log.info(`SMS notification would be sent to user ${input.userId}`);
          result.channels.sms = false; // Not implemented yet
        } catch (error) {
          log.error('Failed to send SMS notification:', error);
        }
      }

      // Record rate limit
      await this.recordRateLimit(input.userId, 'SIGNAL');

      result.success = result.channels.inApp || result.channels.push || result.channels.email;

      return result;
    } catch (error) {
      log.error('Error sending signal notification:', error);
      return {
        success: false,
        channels: result.channels,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send signal update notification
   */
  async sendSignalUpdate(input: SignalNotificationInput): Promise<NotificationResult> {
    return this.sendSignalNotification(input, 'signal.update');
  }

  /**
   * Send signal close notification
   */
  async sendSignalClose(input: SignalNotificationInput): Promise<NotificationResult> {
    return this.sendSignalNotification(input, 'signal.close');
  }

  /**
   * Send signal alert notification
   */
  async sendSignalAlert(input: SignalNotificationInput): Promise<NotificationResult> {
    return this.sendSignalNotification(input, 'signal.alert');
  }

  /**
   * Check rate limit
   */
  async checkRateLimit(
    userId: string,
    type: string,
    config: SignalPushConfig
  ): Promise<RateLimitResult> {
    const limit = config.frequency === 'realtime' ? 30 : 
                  config.frequency === 'batch_1m' ? 20 :
                  config.frequency === 'batch_5m' ? 10 : 5;

    try {
      const supabase = getSupabaseClient();

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const { count, error } = await supabase
        .from('notification_rate_limits')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('notification_type', type)
        .gte('window_start', oneHourAgo.toISOString());

      if (error) {
        log.error('Error checking rate limit:', error);
        return { allowed: true, remaining: limit };
      }

      const used = count ?? 0;
      const remaining = Math.max(0, limit - used);

      return {
        allowed: used < limit,
        remaining,
        resetAt: new Date(Date.now() + 60 * 60 * 1000),
      };
    } catch (error) {
      log.error('Error checking rate limit:', error);
      return { allowed: true, remaining: limit };
    }
  }

  /**
   * Record rate limit usage
   */
  private async recordRateLimit(userId: string, type: string): Promise<void> {
    try {
      const supabase = getSupabaseClient();

      await supabase.rpc('record_notification_rate', {
        p_user_id: userId,
        p_notification_type: type,
      });
    } catch (error) {
      log.error('Error recording rate limit:', error);
    }
  }

  /**
   * Check if signal passes user's filters
   */
  private signalPassesFilters(
    input: SignalNotificationInput,
    config: StrategyNotificationConfig
  ): boolean {
    // Check confidence score
    if (input.confidenceScore !== undefined && input.confidenceScore !== null) {
      const confidencePercent = input.confidenceScore * 100;
      if (confidencePercent < config.minConfidenceScore) {
        return false;
      }
    }

    // Check risk levels
    if (input.riskLevel && !config.riskLevels.includes(input.riskLevel as any)) {
      return false;
    }

    // Check signal types
    if (!config.signalTypes.includes('all') && !config.signalTypes.includes(input.signalType)) {
      return false;
    }

    return true;
  }

  /**
   * Check if current time is in quiet hours
   */
  private isInQuietHours(config: SignalPushConfig): boolean {
    if (!config.quietHoursEnabled) return false;

    const now = new Date();
    const timezone = config.quietHoursTimezone ?? 'UTC';

    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      });
      const timeStr = formatter.format(now);
      const [currentHour, currentMinute] = timeStr.split(':').map(Number);
      const currentTimeMinutes = currentHour * 60 + currentMinute;

      const [startHour, startMin] = (config.quietHoursStart ?? '22:00').split(':').map(Number);
      const [endHour, endMin] = (config.quietHoursEnd ?? '08:00').split(':').map(Number);
      const startTimeMinutes = startHour * 60 + startMin;
      const endTimeMinutes = endHour * 60 + endMin;

      if (startTimeMinutes > endTimeMinutes) {
        return currentTimeMinutes >= startTimeMinutes || currentTimeMinutes < endTimeMinutes;
      } else {
        return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes < endTimeMinutes;
      }
    } catch {
      return false;
    }
  }

  /**
   * Get priority from risk level
   */
  private getPriorityFromRisk(riskLevel?: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' {
    switch (riskLevel) {
      case 'very_high':
        return 'URGENT';
      case 'high':
        return 'HIGH';
      case 'medium':
        return 'MEDIUM';
      default:
        return 'LOW';
    }
  }

  /**
   * Format email body with HTML
   */
  private formatEmailBody(body: string, input: SignalNotificationInput): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">${input.symbol} ${input.side === 'buy' ? '买入' : '卖出'}信号</h1>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
            <pre style="white-space: pre-wrap; font-family: inherit;">${body}</pre>
          </div>
          <div style="padding: 20px; text-align: center;">
            <a href="/signals/${input.signalId}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">查看详情</a>
          </div>
          <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
            <p>您收到此邮件是因为您订阅了策略通知。</p>
            <p><a href="/settings/notifications">管理通知设置</a></p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Get notification history for a user
   */
  async getNotificationHistory(
    userId: string,
    options: {
      type?: string;
      entityId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ history: NotificationHistory[]; total: number }> {
    return this.historyDAO.list({
      userId,
      notificationType: options.type,
      entityId: options.entityId,
      startDate: options.startDate,
      endDate: options.endDate,
      limit: options.limit ?? 50,
      offset: options.offset ?? 0,
    });
  }

  /**
   * Get signal comparison (signal vs actual outcome)
   */
  async getSignalComparison(
    userId: string,
    options: {
      strategyId?: string;
      symbol?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {}
  ) {
    return this.historyDAO.getSignalComparison(userId, options);
  }

  /**
   * Update strategy notification config
   */
  async updateStrategyConfig(
    userId: string,
    strategyId: string,
    config: {
      enabled?: boolean;
      signalTypes?: string[];
      minConfidenceScore?: number;
      riskLevels?: ('low' | 'medium' | 'high' | 'very_high')[];
      notifyInApp?: boolean;
      notifyPush?: boolean;
      notifyEmail?: boolean;
      notifySms?: boolean;
    }
  ): Promise<StrategyNotificationConfig> {
    return this.strategyConfigDAO.update(userId, strategyId, config);
  }

  /**
   * Get all strategy configs for a user
   */
  async getStrategyConfigs(userId: string): Promise<StrategyNotificationConfig[]> {
    return this.strategyConfigDAO.getByUser(userId);
  }
}

// Singleton instance
let signalNotificationService: SignalNotificationServiceClass | null = null;

export function getSignalNotificationService(): SignalNotificationServiceClass {
  if (!signalNotificationService) {
    signalNotificationService = new SignalNotificationServiceClass();
  }
  return signalNotificationService;
}

export { SignalNotificationServiceClass };