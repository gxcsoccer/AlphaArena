/**
 * Reward Notification Service
 * Handles notifications for referral rewards
 */

import { getSupabaseAdminClient } from '../../database/client';
import { createLogger } from '../../utils/logger';
import { EmailService, getEmailService } from '../../notification/EmailService';
import {
  createNotification,
  shouldReceiveNotification,
} from '../../database/notifications.dao';

const log = createLogger('RewardNotificationService');

// ============================================
// Type Definitions
// ============================================

export type RewardNotificationType = 
  | 'reward_earned'
  | 'reward_pending'
  | 'reward_processed'
  | 'reward_failed'
  | 'referral_registered'
  | 'referral_activated'
  | 'fraud_warning';

export interface RewardNotificationData {
  userId: string;
  type: RewardNotificationType;
  data: {
    rewardId?: string;
    rewardAmount?: number;
    rewardType?: string;
    vipDays?: number;
    referralId?: string;
    inviteeEmail?: string;
    referrerEmail?: string;
    scheduledAt?: Date;
    processedAt?: Date;
    failureReason?: string;
    fraudFlags?: string[];
  };
}

export interface NotificationTemplate {
  title: string;
  message: string;
  emailSubject: string;
  emailBody: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  actionUrl?: string;
}

// ============================================
// Notification Templates
// ============================================

const NOTIFICATION_TEMPLATES: Record<RewardNotificationType, (data: RewardNotificationData['data']) => NotificationTemplate> = {
  reward_earned: (data) => ({
    title: '🎉 奖励已到账',
    message: `您获得了 ${data.vipDays || data.rewardAmount || 0} ${data.rewardType === 'vip_days' ? '天VIP会员' : '积分'}奖励！`,
    emailSubject: '恭喜！您的推荐奖励已到账',
    emailBody: `
      <h2>恭喜您获得推荐奖励！</h2>
      <p>您成功推荐的新用户已激活，奖励已发放到您的账户：</p>
      <ul>
        <li>奖励类型：${data.rewardType === 'vip_days' ? 'VIP会员时长' : '积分'}</li>
        <li>奖励数量：${data.vipDays || data.rewardAmount}</li>
      </ul>
      <p>感谢您对 AlphaArena 的支持！继续邀请好友，获得更多奖励。</p>
    `,
    priority: 'MEDIUM',
    actionUrl: '/referral',
  }),

  reward_pending: (data) => ({
    title: '⏳ 奖励处理中',
    message: `您的奖励正在处理中，预计 ${data.scheduledAt ? new Date(data.scheduledAt).toLocaleDateString() : '7天内'} 到账`,
    emailSubject: '您的推荐奖励正在处理中',
    emailBody: `
      <h2>推荐奖励处理通知</h2>
      <p>您推荐的新用户已完成激活，奖励正在处理中：</p>
      <ul>
        <li>奖励类型：${data.rewardType === 'vip_days' ? 'VIP会员时长' : '积分'}</li>
        <li>奖励数量：${data.vipDays || data.rewardAmount}</li>
        <li>预计到账：${data.scheduledAt ? new Date(data.scheduledAt).toLocaleDateString() : '7天内'}</li>
      </ul>
      <p>奖励将在满足条件后自动发放到您的账户。</p>
    `,
    priority: 'LOW',
    actionUrl: '/referral',
  }),

  reward_processed: (data) => ({
    title: '✅ 奖励发放成功',
    message: `${data.vipDays || data.rewardAmount || 0} ${data.rewardType === 'vip_days' ? '天VIP' : '积分'}已发放至您的账户`,
    emailSubject: '推荐奖励发放成功',
    emailBody: `
      <h2>奖励发放成功</h2>
      <p>您的推荐奖励已成功发放：</p>
      <ul>
        <li>奖励类型：${data.rewardType === 'vip_days' ? 'VIP会员时长' : '积分'}</li>
        <li>奖励数量：${data.vipDays || data.rewardAmount}</li>
        <li>发放时间：${data.processedAt ? new Date(data.processedAt).toLocaleString() : '刚刚'}</li>
      </ul>
      <p>感谢您的支持，继续邀请好友获取更多奖励！</p>
    `,
    priority: 'MEDIUM',
    actionUrl: '/referral',
  }),

  reward_failed: (data) => ({
    title: '⚠️ 奖励发放失败',
    message: `奖励发放失败：${data.failureReason || '未知错误'}，请联系客服处理`,
    emailSubject: '推荐奖励发放失败通知',
    emailBody: `
      <h2>奖励发放失败</h2>
      <p>很抱歉，您的推荐奖励发放遇到了问题：</p>
      <ul>
        <li>失败原因：${data.failureReason || '未知错误'}</li>
      </ul>
      <p>请联系客服处理此问题，我们将尽快为您解决。</p>
    `,
    priority: 'HIGH',
    actionUrl: '/referral',
  }),

  referral_registered: (data) => ({
    title: '👤 新用户通过您的链接注册',
    message: `${data.inviteeEmail || '一位新用户'}通过您的推荐链接注册成功`,
    emailSubject: '新用户通过您的推荐链接注册',
    emailBody: `
      <h2>新用户注册通知</h2>
      <p>恭喜！${data.inviteeEmail || '一位新用户'}已通过您的推荐链接注册成功。</p>
      <p>当新用户完成首次订阅或交易后，您将获得推荐奖励。</p>
      <p>继续分享您的推荐链接，邀请更多好友加入！</p>
    `,
    priority: 'LOW',
    actionUrl: '/referral',
  }),

  referral_activated: (data) => ({
    title: '🎊 推荐用户已激活',
    message: `您推荐的用户已完成激活，奖励即将发放！`,
    emailSubject: '推荐用户已激活，奖励即将到账',
    emailBody: `
      <h2>推荐用户激活通知</h2>
      <p>太棒了！您推荐的用户已完成激活条件（首次订阅/交易）。</p>
      <p>您的推荐奖励即将发放，请留意通知。</p>
      <p>继续分享，获得更多奖励！</p>
    `,
    priority: 'MEDIUM',
    actionUrl: '/referral',
  }),

  fraud_warning: (data) => ({
    title: '⚠️ 推荐活动异常提醒',
    message: `检测到您的推荐活动存在异常，请查看详情`,
    emailSubject: '推荐活动异常提醒',
    emailBody: `
      <h2>推荐活动异常提醒</h2>
      <p>我们在您的推荐活动中检测到以下异常：</p>
      <ul>
        ${(data.fraudFlags || []).map(flag => `<li>${flag}</li>`).join('')}
      </ul>
      <p>如需帮助或有疑问，请联系客服。</p>
    `,
    priority: 'HIGH',
    actionUrl: '/referral',
  }),
};

// ============================================
// Reward Notification Service Class
// ============================================

export class RewardNotificationService {
  private emailService: EmailService | null = null;

  /**
   * Send a reward notification
   */
  async sendNotification(input: RewardNotificationData): Promise<void> {
    const { userId, type, data } = input;
    
    try {
      // Get template
      const template = NOTIFICATION_TEMPLATES[type](data);
      
      // Check if user wants this notification type
      const shouldNotify = await shouldReceiveNotification(
        userId,
        'REFERRAL',
        template.priority
      );

      if (!shouldNotify) {
        log.debug('User has disabled referral notifications:', { userId, type });
        return;
      }

      // Create in-app notification
      await this.createInAppNotification(userId, type, template, data);
      
      // Send email notification
      await this.sendEmailNotification(userId, template);
      
      log.info('Reward notification sent:', { userId, type });
    } catch (error) {
      log.error('Failed to send reward notification:', { error, userId, type });
    }
  }

  /**
   * Send batch notifications
   */
  async sendBatchNotifications(notifications: RewardNotificationData[]): Promise<void> {
    for (const notification of notifications) {
      await this.sendNotification(notification);
    }
  }

  /**
   * Notify referrer of new registration
   */
  async notifyReferrerOfRegistration(
    referrerUserId: string,
    inviteeEmail?: string
  ): Promise<void> {
    await this.sendNotification({
      userId: referrerUserId,
      type: 'referral_registered',
      data: { inviteeEmail },
    });
  }

  /**
   * Notify referrer of referral activation
   */
  async notifyReferrerOfActivation(
    referrerUserId: string,
    vipDays: number
  ): Promise<void> {
    await this.sendNotification({
      userId: referrerUserId,
      type: 'referral_activated',
      data: {
        vipDays,
        rewardType: 'vip_days',
      },
    });
  }

  /**
   * Notify user of reward earned
   */
  async notifyRewardEarned(
    userId: string,
    vipDays: number,
    rewardType: string
  ): Promise<void> {
    await this.sendNotification({
      userId,
      type: 'reward_earned',
      data: {
        vipDays,
        rewardType,
      },
    });
  }

  /**
   * Notify user of pending reward
   */
  async notifyRewardPending(
    userId: string,
    vipDays: number,
    scheduledAt: Date
  ): Promise<void> {
    await this.sendNotification({
      userId,
      type: 'reward_pending',
      data: {
        vipDays,
        rewardType: 'vip_days',
        scheduledAt,
      },
    });
  }

  /**
   * Notify user of processed reward
   */
  async notifyRewardProcessed(
    userId: string,
    vipDays: number,
    processedAt: Date
  ): Promise<void> {
    await this.sendNotification({
      userId,
      type: 'reward_processed',
      data: {
        vipDays,
        rewardType: 'vip_days',
        processedAt,
      },
    });
  }

  /**
   * Notify user of fraud warning
   */
  async notifyFraudWarning(
    userId: string,
    fraudFlags: string[]
  ): Promise<void> {
    await this.sendNotification({
      userId,
      type: 'fraud_warning',
      data: { fraudFlags },
    });
  }

  // ============================================
  // Private Methods
  // ============================================

  private async createInAppNotification(
    userId: string,
    type: RewardNotificationType,
    template: NotificationTemplate,
    data: RewardNotificationData['data']
  ): Promise<void> {
    await createNotification({
      user_id: userId,
      type: 'REFERRAL',
      priority: template.priority,
      title: template.title,
      message: template.message,
      data: data as unknown as Record<string, unknown>,
      entity_type: 'reward',
      entity_id: data.rewardId,
      action_url: template.actionUrl,
    });
  }

  private async sendEmailNotification(
    userId: string,
    template: NotificationTemplate
  ): Promise<void> {
    try {
      if (!this.emailService) {
        this.emailService = getEmailService();
      }

      // Get user email
      const supabase = getSupabaseAdminClient();
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .maybeSingle();

      if (error || !profile?.email) {
        log.debug('User has no email, skipping email notification:', { userId });
        return;
      }

      // Check if email notifications are enabled
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('email_enabled')
        .eq('user_id', userId)
        .maybeSingle();

      if (prefs && prefs.email_enabled === false) {
        log.debug('User has disabled email notifications:', { userId });
        return;
      }

      // Send email
      await this.emailService.send({
        to: [{ email: profile.email }],
        subject: template.emailSubject,
        html: this.formatEmailBody(template.emailBody),
      });

      log.debug('Email notification sent:', { userId, email: profile.email });
    } catch (error) {
      log.error('Failed to send email notification:', { error, userId });
    }
  }

  private formatEmailBody(body: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; }
          h2 { color: #6366f1; }
          ul { padding-left: 20px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        ${body}
        <div class="footer">
          <p>此邮件由 AlphaArena 系统自动发送，请勿直接回复。</p>
          <p>如需帮助，请访问 <a href="https://alphaarena.app/support">帮助中心</a></p>
        </div>
      </body>
      </html>
    `;
  }
}

// Singleton instance
let rewardNotificationService: RewardNotificationService | null = null;

export function getRewardNotificationService(): RewardNotificationService {
  if (!rewardNotificationService) {
    rewardNotificationService = new RewardNotificationService();
  }
  return rewardNotificationService;
}

export default RewardNotificationService;