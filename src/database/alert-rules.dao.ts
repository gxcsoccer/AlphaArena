/**
 * Alert Rules DAO
 * Data access layer for alert rules management
 */

import { getSupabaseClient } from './client';

const getSupabase = () => getSupabaseClient();

export type AlertRuleType = 
  | 'consecutive_failures'
  | 'execution_timeout'
  | 'position_limit'
  | 'circuit_breaker'
  | 'error_rate'
  | 'custom';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export type EntityType = 'scheduler' | 'strategy' | 'system' | 'user';

export interface AlertRule {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  rule_type: AlertRuleType;
  severity: AlertSeverity;
  conditions: Record<string, unknown>;
  entity_type?: EntityType;
  entity_id?: string;
  channels: {
    in_app: boolean;
    email: boolean;
    webhook: boolean;
  };
  webhook_url?: string;
  is_enabled: boolean;
  last_triggered_at?: Date;
  trigger_count: number;
  cooldown_minutes: number;
  last_notification_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAlertRuleInput {
  user_id: string;
  name: string;
  description?: string;
  rule_type: AlertRuleType;
  severity?: AlertSeverity;
  conditions: Record<string, unknown>;
  entity_type?: EntityType;
  entity_id?: string;
  channels?: {
    in_app: boolean;
    email: boolean;
    webhook: boolean;
  };
  webhook_url?: string;
  is_enabled?: boolean;
  cooldown_minutes?: number;
}

export interface UpdateAlertRuleInput {
  name?: string;
  description?: string;
  severity?: AlertSeverity;
  conditions?: Record<string, unknown>;
  channels?: {
    in_app: boolean;
    email: boolean;
    webhook: boolean;
  };
  webhook_url?: string;
  is_enabled?: boolean;
  cooldown_minutes?: number;
}

export interface AlertRuleFilters {
  user_id?: string;
  rule_type?: AlertRuleType;
  entity_type?: EntityType;
  entity_id?: string;
  is_enabled?: boolean;
  severity?: AlertSeverity;
  limit?: number;
  offset?: number;
}

/**
 * Create a new alert rule
 */
export async function createAlertRule(
  input: CreateAlertRuleInput
): Promise<AlertRule | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('alert_rules')
    .insert({
      user_id: input.user_id,
      name: input.name,
      description: input.description,
      rule_type: input.rule_type,
      severity: input.severity ?? 'medium',
      conditions: input.conditions,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      channels: input.channels ?? { in_app: true, email: false, webhook: false },
      webhook_url: input.webhook_url,
      is_enabled: input.is_enabled ?? true,
      cooldown_minutes: input.cooldown_minutes ?? 30,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating alert rule:', error);
    return null;
  }

  return mapToAlertRule(data);
}

/**
 * Get alert rule by ID
 */
export async function getAlertRuleById(id: string): Promise<AlertRule | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error getting alert rule:', error);
    return null;
  }

  return mapToAlertRule(data);
}

/**
 * List alert rules with filters
 */
export async function listAlertRules(
  filters: AlertRuleFilters
): Promise<{ rules: AlertRule[]; total: number }> {
  const supabase = getSupabase();
  let query = supabase
    .from('alert_rules')
    .select('*', { count: 'exact' });

  if (filters.user_id) {
    query = query.eq('user_id', filters.user_id);
  }
  if (filters.rule_type) {
    query = query.eq('rule_type', filters.rule_type);
  }
  if (filters.entity_type) {
    query = query.eq('entity_type', filters.entity_type);
  }
  if (filters.entity_id) {
    query = query.eq('entity_id', filters.entity_id);
  }
  if (filters.is_enabled !== undefined) {
    query = query.eq('is_enabled', filters.is_enabled);
  }
  if (filters.severity) {
    query = query.eq('severity', filters.severity);
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
    console.error('Error listing alert rules:', error);
    return { rules: [], total: 0 };
  }

  return {
    rules: (data ?? []).map(mapToAlertRule),
    total: count ?? 0,
  };
}

/**
 * Update alert rule
 */
export async function updateAlertRule(
  id: string,
  input: UpdateAlertRuleInput
): Promise<AlertRule | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('alert_rules')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating alert rule:', error);
    return null;
  }

  return mapToAlertRule(data);
}

/**
 * Delete alert rule
 */
export async function deleteAlertRule(id: string): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('alert_rules')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting alert rule:', error);
    return false;
  }

  return true;
}

/**
 * Update trigger info after an alert is triggered
 */
export async function updateAlertRuleTrigger(
  id: string
): Promise<void> {
  const supabase = getSupabase();
  
  // Get current rule to increment trigger count
  const rule = await getAlertRuleById(id);
  if (!rule) return;

  const { error } = await supabase
    .from('alert_rules')
    .update({
      last_triggered_at: new Date().toISOString(),
      last_notification_at: new Date().toISOString(),
      trigger_count: rule.trigger_count + 1,
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating alert rule trigger:', error);
  }
}

/**
 * Check if rule is in cooldown period
 */
export async function isRuleInCooldown(id: string): Promise<boolean> {
  const rule = await getAlertRuleById(id);
  if (!rule || !rule.last_notification_at) {
    return false;
  }

  const lastNotification = new Date(rule.last_notification_at);
  const cooldownEnd = new Date(
    lastNotification.getTime() + rule.cooldown_minutes * 60 * 1000
  );

  return new Date() < cooldownEnd;
}

/**
 * Get rules that apply to a specific entity
 */
export async function getRulesForEntity(
  entityType: EntityType,
  entityId?: string,
  userId?: string
): Promise<AlertRule[]> {
  const supabase = getSupabase();
  let query = supabase
    .from('alert_rules')
    .select('*')
    .eq('is_enabled', true);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error getting rules for entity:', error);
    return [];
  }

  // Filter in memory for complex OR conditions
  const rules = (data ?? []).map(mapToAlertRule);
  return rules.filter(rule => {
    // Rule applies if entity_type matches or is null (global rule)
    const typeMatch = !rule.entity_type || rule.entity_type === entityType;
    // Rule applies if entity_id matches or is null (applies to all entities of type)
    const idMatch = !rule.entity_id || rule.entity_id === entityId;
    return typeMatch && idMatch;
  });
}

/**
 * Helper to map database record to AlertRule
 */
function mapToAlertRule(data: Record<string, unknown>): AlertRule {
  return {
    id: data.id as string,
    user_id: data.user_id as string,
    name: data.name as string,
    description: data.description as string | undefined,
    rule_type: data.rule_type as AlertRuleType,
    severity: data.severity as AlertSeverity,
    conditions: (data.conditions as Record<string, unknown>) ?? {},
    entity_type: data.entity_type as EntityType | undefined,
    entity_id: data.entity_id as string | undefined,
    channels: (data.channels as { in_app: boolean; email: boolean; webhook: boolean }) ?? {
      in_app: true,
      email: false,
      webhook: false,
    },
    webhook_url: data.webhook_url as string | undefined,
    is_enabled: data.is_enabled as boolean,
    last_triggered_at: data.last_triggered_at
      ? new Date(data.last_triggered_at as string)
      : undefined,
    trigger_count: (data.trigger_count as number) ?? 0,
    cooldown_minutes: (data.cooldown_minutes as number) ?? 30,
    last_notification_at: data.last_notification_at
      ? new Date(data.last_notification_at as string)
      : undefined,
    created_at: new Date(data.created_at as string),
    updated_at: new Date(data.updated_at as string),
  };
}

export const alertRulesDao = {
  createAlertRule,
  getAlertRuleById,
  listAlertRules,
  updateAlertRule,
  deleteAlertRule,
  updateAlertRuleTrigger,
  isRuleInCooldown,
  getRulesForEntity,
};

export default alertRulesDao;
