/**
 * Notifications DAO
 * Data access layer for user notifications
 */

import getSupabaseClient from './client.js';

const getSupabase = () => getSupabaseClient();

export type NotificationType = 'SIGNAL' | 'RISK' | 'PERFORMANCE' | 'SYSTEM' | 'COMMENT';
export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  data: Record<string, unknown>;
  entity_type?: string;
  entity_id?: string;
  is_read: boolean;
  read_at?: string;
  action_url?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  id: string;
  user_id: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  signal_notifications: boolean;
  risk_notifications: boolean;
  performance_notifications: boolean;
  system_notifications: boolean;
  priority_threshold: NotificationPriority;
  quiet_hours_enabled: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  quiet_hours_timezone?: string;
  digest_enabled: boolean;
  digest_frequency?: 'hourly' | 'daily' | 'weekly';
  created_at: string;
  updated_at: string;
}

export interface CreateNotificationInput {
  user_id: string;
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  entity_type?: string;
  entity_id?: string;
  action_url?: string;
  expires_at?: string;
}

export interface NotificationListOptions {
  user_id: string;
  type?: NotificationType;
  is_read?: boolean;
  priority?: NotificationPriority;
  limit?: number;
  offset?: number;
}

export interface UpdateNotificationPreferencesInput {
  in_app_enabled?: boolean;
  email_enabled?: boolean;
  push_enabled?: boolean;
  signal_notifications?: boolean;
  risk_notifications?: boolean;
  performance_notifications?: boolean;
  system_notifications?: boolean;
  priority_threshold?: NotificationPriority;
  quiet_hours_enabled?: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  quiet_hours_timezone?: string;
  digest_enabled?: boolean;
  digest_frequency?: 'hourly' | 'daily' | 'weekly';
}

/**
 * Create a new notification
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<Notification | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: input.user_id,
      type: input.type,
      priority: input.priority ?? 'MEDIUM',
      title: input.title,
      message: input.message,
      data: input.data ?? {},
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      action_url: input.action_url,
      expires_at: input.expires_at,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating notification:', error);
    return null;
  }

  return data;
}

/**
 * Create multiple notifications at once
 */
export async function createNotifications(
  inputs: CreateNotificationInput[]
): Promise<Notification[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('notifications')
    .insert(
      inputs.map((input) => ({
        user_id: input.user_id,
        type: input.type,
        priority: input.priority ?? 'MEDIUM',
        title: input.title,
        message: input.message,
        data: input.data ?? {},
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        action_url: input.action_url,
        expires_at: input.expires_at,
      }))
    )
    .select();

  if (error) {
    console.error('Error creating notifications:', error);
    return [];
  }

  return data ?? [];
}

/**
 * Get notification by ID
 */
export async function getNotificationById(
  id: string,
  userId: string
): Promise<Notification | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error getting notification:', error);
    return null;
  }

  return data;
}

/**
 * List notifications for a user
 */
export async function listNotifications(
  options: NotificationListOptions
): Promise<{ notifications: Notification[]; total: number }> {
  const supabase = getSupabase();
  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', options.user_id)
    .order('created_at', { ascending: false });

  if (options.type) {
    query = query.eq('type', options.type);
  }

  if (options.is_read !== undefined) {
    query = query.eq('is_read', options.is_read);
  }

  if (options.priority) {
    query = query.eq('priority', options.priority);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  if (options.offset) {
    query = query.range(options.offset, options.offset + (options.limit ?? 20) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error listing notifications:', error);
    return { notifications: [], total: 0 };
  }

  return { notifications: data ?? [], total: count ?? 0 };
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }

  return count ?? 0;
}

/**
 * Mark notification as read
 */
export async function markAsRead(
  id: string,
  userId: string
): Promise<Notification | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error marking notification as read:', error);
    return null;
  }

  return data;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<number> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('is_read', false)
    .select();

  if (error) {
    console.error('Error marking all notifications as read:', error);
    return 0;
  }

  return data?.length ?? 0;
}

/**
 * Delete notification
 */
export async function deleteNotification(
  id: string,
  userId: string
): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting notification:', error);
    return false;
  }

  return true;
}

/**
 * Delete all read notifications for a user
 */
export async function deleteReadNotifications(userId: string): Promise<number> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId)
    .eq('is_read', true)
    .select();

  if (error) {
    console.error('Error deleting read notifications:', error);
    return 0;
  }

  return data?.length ?? 0;
}

/**
 * Delete expired notifications
 */
export async function deleteExpiredNotifications(): Promise<number> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('notifications')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select();

  if (error) {
    console.error('Error deleting expired notifications:', error);
    return 0;
  }

  return data?.length ?? 0;
}

/**
 * Get notification preferences for a user
 */
export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    // If no preferences exist, create default ones
    if (error.code === 'PGRST116') {
      const { data: newPrefs, error: createError } = await supabase
        .from('notification_preferences')
        .insert({ user_id: userId })
        .select()
        .single();

      if (createError) {
        console.error('Error creating notification preferences:', createError);
        return null;
      }

      return newPrefs;
    }

    console.error('Error getting notification preferences:', error);
    return null;
  }

  return data;
}

/**
 * Update notification preferences for a user
 */
export async function updateNotificationPreferences(
  userId: string,
  input: UpdateNotificationPreferencesInput
): Promise<NotificationPreferences | null> {
  // First ensure preferences exist
  const existing = await getNotificationPreferences(userId);

  if (!existing) {
    return null;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('notification_preferences')
    .update(input)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating notification preferences:', error);
    return null;
  }

  return data;
}

/**
 * Check if user should receive notification based on preferences
 */
export async function shouldReceiveNotification(
  userId: string,
  type: NotificationType,
  priority: NotificationPriority
): Promise<boolean> {
  const prefs = await getNotificationPreferences(userId);

  if (!prefs) {
    return true; // Default to sending notification if no preferences
  }

  // Check type preference
  const typeEnabled: Record<NotificationType, boolean> = {
    SIGNAL: prefs.signal_notifications,
    RISK: prefs.risk_notifications,
    PERFORMANCE: prefs.performance_notifications,
    SYSTEM: prefs.system_notifications,
    COMMENT: (prefs as any).comment_notifications ?? true,
  };

  if (!typeEnabled[type]) {
    return false;
  }

  // Check priority threshold
  const priorityLevels: Record<NotificationPriority, number> = {
    LOW: 0,
    MEDIUM: 1,
    HIGH: 2,
    URGENT: 3,
  };

  if (priorityLevels[priority] < priorityLevels[prefs.priority_threshold]) {
    return false;
  }

  // Check quiet hours (simplified - actual implementation would consider timezone)
  if (prefs.quiet_hours_enabled) {
    const now = new Date();
    const currentHour = now.getUTCHours();
    const startHour = prefs.quiet_hours_start
      ? parseInt(prefs.quiet_hours_start.split(':')[0], 10)
      : 22;
    const endHour = prefs.quiet_hours_end
      ? parseInt(prefs.quiet_hours_end.split(':')[0], 10)
      : 8;

    if (startHour > endHour) {
      // Overnight quiet hours (e.g., 22:00 - 08:00)
      if (currentHour >= startHour || currentHour < endHour) {
        return false;
      }
    } else {
      // Daytime quiet hours
      if (currentHour >= startHour && currentHour < endHour) {
        return false;
      }
    }
  }

  return true;
}

export const notificationsDao = {
  createNotification,
  createNotifications,
  getNotificationById,
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteReadNotifications,
  deleteExpiredNotifications,
  getNotificationPreferences,
  updateNotificationPreferences,
  shouldReceiveNotification,
};

export default notificationsDao;
