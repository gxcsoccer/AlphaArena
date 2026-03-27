/**
 * Notification History DAO
 * Data access layer for notification history tracking
 */

import { getSupabaseClient } from './client';

export type NotificationChannel = 'in_app' | 'email' | 'push' | 'sms';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed';

export interface NotificationHistory {
  id: string;
  userId: string;
  notificationType: string;
  channel: NotificationChannel;
  title: string;
  message?: string;
  data: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
  status: NotificationStatus;
  errorMessage?: string;
  createdAt: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  clickedAt?: Date;
  actionTaken?: string;
}

export interface CreateNotificationHistoryInput {
  userId: string;
  notificationType: string;
  channel: NotificationChannel;
  title: string;
  message?: string;
  data?: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
}

export interface NotificationHistoryListOptions {
  userId: string;
  notificationType?: string;
  channel?: NotificationChannel;
  status?: NotificationStatus;
  entityId?: string;
  entityType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface NotificationStats {
  totalSent: number;
  byChannel: Record<NotificationChannel, number>;
  byType: Record<string, number>;
  deliveryRate: number;
  readRate: number;
  clickRate: number;
}

export class NotificationHistoryDAO {
  /**
   * Create a notification history record
   */
  async create(input: CreateNotificationHistoryInput): Promise<NotificationHistory> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('notification_history')
      .insert({
        user_id: input.userId,
        notification_type: input.notificationType,
        channel: input.channel,
        title: input.title,
        message: input.message,
        data: input.data ?? {},
        entity_type: input.entityType,
        entity_id: input.entityId,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating notification history:', error);
      throw error;
    }

    return this.mapToHistory(data);
  }

  /**
   * Update notification status
   */
  async updateStatus(
    id: string,
    status: NotificationStatus,
    errorMessage?: string
  ): Promise<NotificationHistory | null> {
    const supabase = getSupabaseClient();

    const updateData: Record<string, unknown> = {
      status,
      error_message: errorMessage,
    };

    if (status === 'sent') {
      updateData.sent_at = new Date().toISOString();
    } else if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('notification_history')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating notification status:', error);
      return null;
    }

    return this.mapToHistory(data);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string): Promise<NotificationHistory | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('notification_history')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error marking notification as read:', error);
      return null;
    }

    return this.mapToHistory(data);
  }

  /**
   * Record click action
   */
  async recordClick(id: string, action?: string): Promise<NotificationHistory | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('notification_history')
      .update({
        clicked_at: new Date().toISOString(),
        action_taken: action,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error recording notification click:', error);
      return null;
    }

    return this.mapToHistory(data);
  }

  /**
   * List notification history
   */
  async list(options: NotificationHistoryListOptions): Promise<{
    history: NotificationHistory[];
    total: number;
  }> {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('notification_history')
      .select('*', { count: 'exact' })
      .eq('user_id', options.userId)
      .order('created_at', { ascending: false });

    if (options.notificationType) {
      query = query.eq('notification_type', options.notificationType);
    }

    if (options.channel) {
      query = query.eq('channel', options.channel);
    }

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.entityType && options.entityId) {
      query = query.eq('entity_type', options.entityType);
      query = query.eq('entity_id', options.entityId);
    }

    if (options.startDate) {
      query = query.gte('created_at', options.startDate.toISOString());
    }

    if (options.endDate) {
      query = query.lte('created_at', options.endDate.toISOString());
    }

    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error listing notification history:', error);
      return { history: [], total: 0 };
    }

    return {
      history: (data ?? []).map(this.mapToHistory),
      total: count ?? 0,
    };
  }

  /**
   * Get notification statistics
   */
  async getStats(userId: string, period: { start: Date; end: Date }): Promise<NotificationStats> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('notification_history')
      .select('channel, notification_type, status, read_at, clicked_at')
      .eq('user_id', userId)
      .gte('created_at', period.start.toISOString())
      .lte('created_at', period.end.toISOString());

    if (error) {
      console.error('Error getting notification stats:', error);
      return {
        totalSent: 0,
        byChannel: { in_app: 0, email: 0, push: 0, sms: 0 },
        byType: {},
        deliveryRate: 0,
        readRate: 0,
        clickRate: 0,
      };
    }

    const records = data ?? [];
    const totalSent = records.length;
    const delivered = records.filter(r => r.status === 'delivered' || r.status === 'sent').length;
    const read = records.filter(r => r.read_at).length;
    const clicked = records.filter(r => r.clicked_at).length;

    const byChannel: Record<NotificationChannel, number> = {
      in_app: 0,
      email: 0,
      push: 0,
      sms: 0,
    };

    const byType: Record<string, number> = {};

    for (const record of records) {
      byChannel[record.channel as NotificationChannel]++;
      byType[record.notification_type] = (byType[record.notification_type] ?? 0) + 1;
    }

    return {
      totalSent,
      byChannel,
      byType,
      deliveryRate: totalSent > 0 ? delivered / totalSent : 0,
      readRate: delivered > 0 ? read / delivered : 0,
      clickRate: delivered > 0 ? clicked / delivered : 0,
    };
  }

  /**
   * Get signal notification comparison (signal history vs actual price movement)
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
  ): Promise<{
    signalId: string;
    signalTitle?: string;
    signalType: string;
    side: 'buy' | 'sell';
    symbol: string;
    entryPrice?: number;
    targetPrice?: number;
    stopLossPrice?: number;
    signalConfidence?: number;
    signalCreatedAt: Date;
    currentPrice?: number;
    pnlPercent?: number;
    outcome: 'hit_target' | 'hit_stop_loss' | 'expired' | 'active' | 'unknown';
  }[]> {
    const supabase = getSupabaseClient();

    // Get signal notifications
    let query = supabase
      .from('notification_history')
      .select(`
        entity_id,
        data,
        created_at
      `)
      .eq('user_id', userId)
      .eq('notification_type', 'SIGNAL')
      .eq('entity_type', 'signal')
      .order('created_at', { ascending: false });

    if (options.strategyId) {
      query = query.contains('data', { strategyId: options.strategyId });
    }

    if (options.symbol) {
      query = query.contains('data', { symbol: options.symbol });
    }

    if (options.startDate) {
      query = query.gte('created_at', options.startDate.toISOString());
    }

    if (options.endDate) {
      query = query.lte('created_at', options.endDate.toISOString());
    }

    const limit = options.limit ?? 50;
    query = query.limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error('Error getting signal comparison:', error);
      return [];
    }

    // Get signal outcomes from trading_signals table
    const signalIds = (data ?? [])
      .filter(d => d.entity_id)
      .map(d => d.entity_id);

    if (signalIds.length === 0) return [];

    const { data: signals, error: signalsError } = await supabase
      .from('trading_signals')
      .select(`
        id,
        title,
        signal_type,
        side,
        symbol,
        entry_price,
        target_price,
        stop_loss_price,
        confidence_score,
        created_at,
        status,
        pnl_percent,
        executed_at
      `)
      .in('id', signalIds);

    if (signalsError) {
      console.error('Error getting signal details:', signalsError);
      return [];
    }

    const signalMap = new Map((signals ?? []).map(s => [s.id, s]));

    return (data ?? [])
      .filter(d => d.entity_id && signalMap.has(d.entity_id))
      .map(d => {
        const signal = signalMap.get(d.entity_id)!;
        let outcome: 'hit_target' | 'hit_stop_loss' | 'expired' | 'active' | 'unknown' = 'unknown';

        if (signal.status === 'executed') {
          if (signal.pnl_percent && signal.pnl_percent > 0) {
            outcome = 'hit_target';
          } else if (signal.pnl_percent && signal.pnl_percent < 0) {
            outcome = 'hit_stop_loss';
          }
        } else if (signal.status === 'expired') {
          outcome = 'expired';
        } else if (signal.status === 'active') {
          outcome = 'active';
        }

        return {
          signalId: signal.id,
          signalTitle: signal.title,
          signalType: signal.signal_type,
          side: signal.side,
          symbol: signal.symbol,
          entryPrice: signal.entry_price,
          targetPrice: signal.target_price,
          stopLossPrice: signal.stop_loss_price,
          signalConfidence: signal.confidence_score,
          signalCreatedAt: new Date(signal.created_at),
          pnlPercent: signal.pnl_percent,
          outcome,
        };
      });
  }

  /**
   * Delete old history (cleanup)
   */
  async deleteOldHistory(olderThanDays: number = 90): Promise<number> {
    const supabase = getSupabaseClient();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const { data, error } = await supabase
      .from('notification_history')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .select();

    if (error) {
      console.error('Error deleting old history:', error);
      return 0;
    }

    return data?.length ?? 0;
  }

  private mapToHistory(row: Record<string, unknown>): NotificationHistory {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      notificationType: row.notification_type as string,
      channel: row.channel as NotificationChannel,
      title: row.title as string,
      message: row.message as string | undefined,
      data: (row.data as Record<string, unknown>) ?? {},
      entityType: row.entity_type as string | undefined,
      entityId: row.entity_id as string | undefined,
      status: row.status as NotificationStatus,
      errorMessage: row.error_message as string | undefined,
      createdAt: new Date(row.created_at as string),
      sentAt: row.sent_at ? new Date(row.sent_at as string) : undefined,
      deliveredAt: row.delivered_at ? new Date(row.delivered_at as string) : undefined,
      readAt: row.read_at ? new Date(row.read_at as string) : undefined,
      clickedAt: row.clicked_at ? new Date(row.clicked_at as string) : undefined,
      actionTaken: row.action_taken as string | undefined,
    };
  }
}

// Singleton instance
let notificationHistoryDAO: NotificationHistoryDAO | null = null;

export function getNotificationHistoryDAO(): NotificationHistoryDAO {
  if (!notificationHistoryDAO) {
    notificationHistoryDAO = new NotificationHistoryDAO();
  }
  return notificationHistoryDAO;
}