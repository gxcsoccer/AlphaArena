/**
 * Notification Service
 * Manages notification creation, delivery, and storage
 */

import {
  createNotification,
  createNotifications,
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  shouldReceiveNotification,
  type Notification,
  type NotificationType,
  type NotificationPriority,
  type CreateNotificationInput,
  type NotificationListOptions,
  type UpdateNotificationPreferencesInput,
} from '../database/notifications.dao.js';

export type { Notification, NotificationType, NotificationPriority };

export interface SignalNotificationData {
  symbol: string;
  side: 'buy' | 'sell';
  price?: number;
  strategy?: string;
  confidence?: number;
}

export interface RiskNotificationData {
  risk_type: 'position_limit' | 'loss_threshold' | 'exposure_limit' | 'margin_call';
  symbol?: string;
  current_value: number;
  threshold_value: number;
  message_details?: string;
}

export interface PerformanceNotificationData {
  period: 'daily' | 'weekly' | 'monthly';
  total_pnl: number;
  total_pnl_percent: number;
  win_rate: number;
  trade_count: number;
  best_trade?: { symbol: string; pnl: number };
  worst_trade?: { symbol: string; pnl: number };
}

export interface SystemNotificationData {
  event_type: 'maintenance' | 'update' | 'alert' | 'info';
  scheduled_time?: string;
  duration_minutes?: number;
  details?: string;
}

/**
 * Create a trading signal notification
 */
export async function createSignalNotification(
  userId: string,
  title: string,
  message: string,
  data: SignalNotificationData,
  options?: {
    priority?: NotificationPriority;
    actionUrl?: string;
    strategyId?: string;
  }
): Promise<Notification | null> {
  const shouldReceive = await shouldReceiveNotification(
    userId,
    'SIGNAL',
    options?.priority ?? 'MEDIUM'
  );

  if (!shouldReceive) {
    return null;
  }

  return createNotification({
    user_id: userId,
    type: 'SIGNAL',
    priority: options?.priority ?? 'MEDIUM',
    title,
    message,
    data: data as unknown as Record<string, unknown>,
    entity_type: 'strategy',
    entity_id: options?.strategyId,
    action_url: options?.actionUrl,
  });
}

/**
 * Create a risk alert notification
 */
export async function createRiskNotification(
  userId: string,
  title: string,
  message: string,
  data: RiskNotificationData,
  options?: {
    priority?: NotificationPriority;
    actionUrl?: string;
  }
): Promise<Notification | null> {
  const shouldReceive = await shouldReceiveNotification(
    userId,
    'RISK',
    options?.priority ?? 'HIGH'
  );

  if (!shouldReceive) {
    return null;
  }

  return createNotification({
    user_id: userId,
    type: 'RISK',
    priority: options?.priority ?? 'HIGH',
    title,
    message,
    data: data as unknown as Record<string, unknown>,
    action_url: options?.actionUrl,
  });
}

/**
 * Create a performance report notification
 */
export async function createPerformanceNotification(
  userId: string,
  title: string,
  message: string,
  data: PerformanceNotificationData,
  options?: {
    priority?: NotificationPriority;
    actionUrl?: string;
  }
): Promise<Notification | null> {
  const shouldReceive = await shouldReceiveNotification(
    userId,
    'PERFORMANCE',
    options?.priority ?? 'LOW'
  );

  if (!shouldReceive) {
    return null;
  }

  return createNotification({
    user_id: userId,
    type: 'PERFORMANCE',
    priority: options?.priority ?? 'LOW',
    title,
    message,
    data: data as unknown as Record<string, unknown>,
    action_url: options?.actionUrl,
  });
}

/**
 * Create a system notification
 */
export async function createSystemNotification(
  userId: string,
  title: string,
  message: string,
  data?: SystemNotificationData,
  options?: {
    priority?: NotificationPriority;
    actionUrl?: string;
    expiresAt?: string;
  }
): Promise<Notification | null> {
  const shouldReceive = await shouldReceiveNotification(
    userId,
    'SYSTEM',
    options?.priority ?? 'MEDIUM'
  );

  if (!shouldReceive) {
    return null;
  }

  return createNotification({
    user_id: userId,
    type: 'SYSTEM',
    priority: options?.priority ?? 'MEDIUM',
    title,
    message,
    data: data as unknown as Record<string, unknown>,
    action_url: options?.actionUrl,
    expires_at: options?.expiresAt,
  });
}

/**
 * Broadcast notification to multiple users
 */
export async function broadcastNotification(
  userIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  options?: {
    priority?: NotificationPriority;
    data?: Record<string, unknown>;
    entityType?: string;
    entityId?: string;
    actionUrl?: string;
    expiresAt?: string;
  }
): Promise<Notification[]> {
  const inputs: CreateNotificationInput[] = [];

  for (const userId of userIds) {
    const shouldReceive = await shouldReceiveNotification(
      userId,
      type,
      options?.priority ?? 'MEDIUM'
    );

    if (shouldReceive) {
      inputs.push({
        user_id: userId,
        type,
        priority: options?.priority ?? 'MEDIUM',
        title,
        message,
        data: options?.data,
        entity_type: options?.entityType,
        entity_id: options?.entityId,
        action_url: options?.actionUrl,
        expires_at: options?.expiresAt,
      });
    }
  }

  return createNotifications(inputs);
}

/**
 * Get notifications for a user
 */
export async function getUserNotifications(
  userId: string,
  options?: Partial<NotificationListOptions>
): Promise<{ notifications: Notification[]; total: number }> {
  return listNotifications({
    user_id: userId,
    ...options,
  });
}

/**
 * Get unread count for a user
 */
export async function getUserUnreadCount(userId: string): Promise<number> {
  return getUnreadCount(userId);
}

/**
 * Mark a notification as read
 */
export async function readNotification(
  notificationId: string,
  userId: string
): Promise<Notification | null> {
  return markAsRead(notificationId, userId);
}

/**
 * Mark all notifications as read for a user
 */
export async function readAllNotifications(userId: string): Promise<number> {
  return markAllAsRead(userId);
}

/**
 * Remove a notification
 */
export async function removeNotification(
  notificationId: string,
  userId: string
): Promise<boolean> {
  return deleteNotification(notificationId, userId);
}

/**
 * Get user notification preferences
 */
export async function getUserPreferences(
  userId: string
) {
  return getNotificationPreferences(userId);
}

/**
 * Update user notification preferences
 */
export async function updateUserPreferences(
  userId: string,
  input: UpdateNotificationPreferencesInput
) {
  return updateNotificationPreferences(userId, input);
}

// Export the service object
export const NotificationService = {
  createSignalNotification,
  createRiskNotification,
  createPerformanceNotification,
  createSystemNotification,
  broadcastNotification,
  getUserNotifications,
  getUserUnreadCount,
  readNotification,
  readAllNotifications,
  removeNotification,
  getUserPreferences,
  updateUserPreferences,
};

export default NotificationService;
