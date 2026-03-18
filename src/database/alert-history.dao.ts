/**
 * Alert History DAO
 * Data access layer for alert history management
 */

import { getSupabaseClient } from './client';
import type { AlertRuleType, AlertSeverity } from './alert-rules.dao';

const getSupabase = () => getSupabaseClient();

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface AlertHistory {
  id: string;
  user_id: string;
  rule_id?: string;
  rule_type: AlertRuleType;
  severity: AlertSeverity;
  title: string;
  message: string;
  context: Record<string, unknown>;
  notification_status: NotificationStatus;
  notification_channels: Record<string, boolean>;
  notification_error?: string;
  sent_at?: Date;
  is_acknowledged: boolean;
  acknowledged_at?: Date;
  acknowledged_by?: string;
  is_resolved: boolean;
  resolved_at?: Date;
  resolution_note?: string;
  created_at: Date;
}

export interface CreateAlertHistoryInput {
  user_id: string;
  rule_id?: string;
  rule_type: AlertRuleType;
  severity: AlertSeverity;
  title: string;
  message: string;
  context?: Record<string, unknown>;
  notification_status?: NotificationStatus;
  notification_channels?: Record<string, boolean>;
  notification_error?: string;
  sent_at?: Date;
}

export interface UpdateAlertHistoryInput {
  notification_status?: NotificationStatus;
  notification_error?: string;
  sent_at?: Date;
  is_acknowledged?: boolean;
  acknowledged_at?: Date;
  acknowledged_by?: string;
  is_resolved?: boolean;
  resolved_at?: Date;
  resolution_note?: string;
}

export interface AlertHistoryFilters {
  user_id?: string;
  rule_id?: string;
  rule_type?: AlertRuleType;
  severity?: AlertSeverity;
  notification_status?: NotificationStatus;
  is_acknowledged?: boolean;
  is_resolved?: boolean;
  start_date?: Date;
  end_date?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Create alert history entry
 */
export async function createAlertHistory(
  input: CreateAlertHistoryInput
): Promise<AlertHistory | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('alert_history')
    .insert({
      user_id: input.user_id,
      rule_id: input.rule_id,
      rule_type: input.rule_type,
      severity: input.severity,
      title: input.title,
      message: input.message,
      context: input.context ?? {},
      notification_status: input.notification_status ?? 'pending',
      notification_channels: input.notification_channels ?? {},
      notification_error: input.notification_error,
      sent_at: input.sent_at?.toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating alert history:', error);
    return null;
  }

  return mapToAlertHistory(data);
}

/**
 * Get alert history by ID
 */
export async function getAlertHistoryById(id: string): Promise<AlertHistory | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('alert_history')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error getting alert history:', error);
    return null;
  }

  return mapToAlertHistory(data);
}

/**
 * List alert history with filters
 */
export async function listAlertHistory(
  filters: AlertHistoryFilters
): Promise<{ alerts: AlertHistory[]; total: number }> {
  const supabase = getSupabase();
  let query = supabase
    .from('alert_history')
    .select('*', { count: 'exact' });

  if (filters.user_id) {
    query = query.eq('user_id', filters.user_id);
  }
  if (filters.rule_id) {
    query = query.eq('rule_id', filters.rule_id);
  }
  if (filters.rule_type) {
    query = query.eq('rule_type', filters.rule_type);
  }
  if (filters.severity) {
    query = query.eq('severity', filters.severity);
  }
  if (filters.notification_status) {
    query = query.eq('notification_status', filters.notification_status);
  }
  if (filters.is_acknowledged !== undefined) {
    query = query.eq('is_acknowledged', filters.is_acknowledged);
  }
  if (filters.is_resolved !== undefined) {
    query = query.eq('is_resolved', filters.is_resolved);
  }
  if (filters.start_date) {
    query = query.gte('created_at', filters.start_date.toISOString());
  }
  if (filters.end_date) {
    query = query.lte('created_at', filters.end_date.toISOString());
  }

  query = query.order('created_at', { ascending: false });

  if (filters.limit) {
    query = query.limit(filters.limit);
  }
  if (filters.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit ?? 20) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error listing alert history:', error);
    return { alerts: [], total: 0 };
  }

  return {
    alerts: (data ?? []).map(mapToAlertHistory),
    total: count ?? 0,
  };
}

/**
 * Update alert history
 */
export async function updateAlertHistory(
  id: string,
  input: UpdateAlertHistoryInput
): Promise<AlertHistory | null> {
  const supabase = getSupabase();
  const updateData: Record<string, unknown> = {};

  if (input.notification_status !== undefined) {
    updateData.notification_status = input.notification_status;
  }
  if (input.notification_error !== undefined) {
    updateData.notification_error = input.notification_error;
  }
  if (input.sent_at !== undefined) {
    updateData.sent_at = input.sent_at.toISOString();
  }
  if (input.is_acknowledged !== undefined) {
    updateData.is_acknowledged = input.is_acknowledged;
  }
  if (input.acknowledged_at !== undefined) {
    updateData.acknowledged_at = input.acknowledged_at.toISOString();
  }
  if (input.acknowledged_by !== undefined) {
    updateData.acknowledged_by = input.acknowledged_by;
  }
  if (input.is_resolved !== undefined) {
    updateData.is_resolved = input.is_resolved;
  }
  if (input.resolved_at !== undefined) {
    updateData.resolved_at = input.resolved_at.toISOString();
  }
  if (input.resolution_note !== undefined) {
    updateData.resolution_note = input.resolution_note;
  }

  const { data, error } = await supabase
    .from('alert_history')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating alert history:', error);
    return null;
  }

  return mapToAlertHistory(data);
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(
  id: string,
  userId: string
): Promise<AlertHistory | null> {
  return updateAlertHistory(id, {
    is_acknowledged: true,
    acknowledged_at: new Date(),
    acknowledged_by: userId,
  });
}

/**
 * Resolve an alert
 */
export async function resolveAlert(
  id: string,
  userId: string,
  resolutionNote?: string
): Promise<AlertHistory | null> {
  return updateAlertHistory(id, {
    is_acknowledged: true,
    acknowledged_at: new Date(),
    acknowledged_by: userId,
    is_resolved: true,
    resolved_at: new Date(),
    resolution_note: resolutionNote,
  });
}

/**
 * Get unacknowledged alerts for a user
 */
export async function getUnacknowledgedAlerts(userId: string): Promise<AlertHistory[]> {
  const { alerts } = await listAlertHistory({
    user_id: userId,
    is_acknowledged: false,
    limit: 100,
  });
  return alerts;
}

/**
 * Get unresolved alerts for a user
 */
export async function getUnresolvedAlerts(userId: string): Promise<AlertHistory[]> {
  const { alerts } = await listAlertHistory({
    user_id: userId,
    is_resolved: false,
    limit: 100,
  });
  return alerts;
}

/**
 * Get alert statistics for a user
 */
export async function getAlertStats(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  total: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  acknowledged: number;
  resolved: number;
  avgResolutionTimeMs: number | null;
}> {
  const { alerts } = await listAlertHistory({
    user_id: userId,
    start_date: startDate,
    end_date: endDate,
    limit: 1000,
  });

  const stats = {
    total: alerts.length,
    byType: {} as Record<string, number>,
    bySeverity: {} as Record<string, number>,
    acknowledged: 0,
    resolved: 0,
    avgResolutionTimeMs: null as number | null,
  };

  let totalResolutionTime = 0;
  let resolutionCount = 0;

  for (const alert of alerts) {
    // Count by type
    stats.byType[alert.rule_type] = (stats.byType[alert.rule_type] ?? 0) + 1;
    
    // Count by severity
    stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] ?? 0) + 1;
    
    // Count acknowledged
    if (alert.is_acknowledged) {
      stats.acknowledged++;
    }
    
    // Count resolved and calculate resolution time
    if (alert.is_resolved && alert.resolved_at) {
      stats.resolved++;
      const resolutionTime = new Date(alert.resolved_at).getTime() - new Date(alert.created_at).getTime();
      totalResolutionTime += resolutionTime;
      resolutionCount++;
    }
  }

  if (resolutionCount > 0) {
    stats.avgResolutionTimeMs = Math.round(totalResolutionTime / resolutionCount);
  }

  return stats;
}

/**
 * Delete old alert history (cleanup)
 */
export async function deleteOldAlertHistory(
  olderThanDays: number = 90
): Promise<number> {
  const supabase = getSupabase();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const { data, error } = await supabase
    .from('alert_history')
    .delete()
    .lt('created_at', cutoffDate.toISOString())
    .eq('is_resolved', true)
    .select();

  if (error) {
    console.error('Error deleting old alert history:', error);
    return 0;
  }

  return data?.length ?? 0;
}

/**
 * Helper to map database record to AlertHistory
 */
function mapToAlertHistory(data: Record<string, unknown>): AlertHistory {
  return {
    id: data.id as string,
    user_id: data.user_id as string,
    rule_id: data.rule_id as string | undefined,
    rule_type: data.rule_type as AlertRuleType,
    severity: data.severity as AlertSeverity,
    title: data.title as string,
    message: data.message as string,
    context: (data.context as Record<string, unknown>) ?? {},
    notification_status: (data.notification_status as NotificationStatus) ?? 'pending',
    notification_channels: (data.notification_channels as Record<string, boolean>) ?? {},
    notification_error: data.notification_error as string | undefined,
    sent_at: data.sent_at ? new Date(data.sent_at as string) : undefined,
    is_acknowledged: (data.is_acknowledged as boolean) ?? false,
    acknowledged_at: data.acknowledged_at
      ? new Date(data.acknowledged_at as string)
      : undefined,
    acknowledged_by: data.acknowledged_by as string | undefined,
    is_resolved: (data.is_resolved as boolean) ?? false,
    resolved_at: data.resolved_at
      ? new Date(data.resolved_at as string)
      : undefined,
    resolution_note: data.resolution_note as string | undefined,
    created_at: new Date(data.created_at as string),
  };
}

export const alertHistoryDao = {
  createAlertHistory,
  getAlertHistoryById,
  listAlertHistory,
  updateAlertHistory,
  acknowledgeAlert,
  resolveAlert,
  getUnacknowledgedAlerts,
  getUnresolvedAlerts,
  getAlertStats,
  deleteOldAlertHistory,
};

export default alertHistoryDao;
