/**
 * Strategy Notification Configuration DAO
 * Per-strategy notification preferences
 */

import { getSupabaseClient } from './client';

export interface StrategyNotificationConfig {
  id: string;
  userId: string;
  strategyId: string;
  
  // Master toggle
  enabled: boolean;
  
  // Signal types to receive
  signalTypes: string[];
  
  // Filter settings
  minConfidenceScore: number;
  riskLevels: ('low' | 'medium' | 'high' | 'very_high')[];
  
  // Channel preferences
  notifyInApp: boolean;
  notifyPush: boolean;
  notifyEmail: boolean;
  notifySms: boolean; // VIP only
  
  // Timing
  quietHoursEnabled: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStrategyNotificationConfigInput {
  userId: string;
  strategyId: string;
  enabled?: boolean;
  signalTypes?: string[];
  minConfidenceScore?: number;
  riskLevels?: ('low' | 'medium' | 'high' | 'very_high')[];
  notifyInApp?: boolean;
  notifyPush?: boolean;
  notifyEmail?: boolean;
  notifySms?: boolean;
  quietHoursEnabled?: boolean;
}

export interface UpdateStrategyNotificationConfigInput {
  enabled?: boolean;
  signalTypes?: string[];
  minConfidenceScore?: number;
  riskLevels?: ('low' | 'medium' | 'high' | 'very_high')[];
  notifyInApp?: boolean;
  notifyPush?: boolean;
  notifyEmail?: boolean;
  notifySms?: boolean;
  quietHoursEnabled?: boolean;
}

const DEFAULT_CONFIG: Omit<CreateStrategyNotificationConfigInput, 'userId' | 'strategyId'> = {
  enabled: true,
  signalTypes: ['all'],
  minConfidenceScore: 0,
  riskLevels: ['low', 'medium', 'high', 'very_high'],
  notifyInApp: true,
  notifyPush: true,
  notifyEmail: false,
  notifySms: false,
  quietHoursEnabled: false,
};

export class StrategyNotificationConfigDAO {
  /**
   * Get or create config for a strategy
   */
  async getOrCreate(userId: string, strategyId: string): Promise<StrategyNotificationConfig> {
    const existing = await this.getByUserAndStrategy(userId, strategyId);
    if (existing) return existing;
    return this.create({ userId, strategyId });
  }

  /**
   * Create new config
   */
  async create(input: CreateStrategyNotificationConfigInput): Promise<StrategyNotificationConfig> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_notification_configs')
      .insert({
        user_id: input.userId,
        strategy_id: input.strategyId,
        enabled: input.enabled ?? DEFAULT_CONFIG.enabled!,
        signal_types: input.signalTypes ?? DEFAULT_CONFIG.signalTypes!,
        min_confidence_score: input.minConfidenceScore ?? DEFAULT_CONFIG.minConfidenceScore!,
        risk_levels: input.riskLevels ?? DEFAULT_CONFIG.riskLevels!,
        notify_in_app: input.notifyInApp ?? DEFAULT_CONFIG.notifyInApp!,
        notify_push: input.notifyPush ?? DEFAULT_CONFIG.notifyPush!,
        notify_email: input.notifyEmail ?? DEFAULT_CONFIG.notifyEmail!,
        notify_sms: input.notifySms ?? DEFAULT_CONFIG.notifySms!,
        quiet_hours_enabled: input.quietHoursEnabled ?? DEFAULT_CONFIG.quietHoursEnabled!,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating strategy notification config:', error);
      // Return default config if table doesn't exist
      if (error.code === '42P01') {
        return this.createDefaultConfig(input.userId, input.strategyId);
      }
      throw error;
    }

    return this.mapToConfig(data);
  }

  /**
   * Get config by user and strategy
   */
  async getByUserAndStrategy(userId: string, strategyId: string): Promise<StrategyNotificationConfig | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_notification_configs')
      .select('*')
      .eq('user_id', userId)
      .eq('strategy_id', strategyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      if (error.code === '42P01') {
        return this.createDefaultConfig(userId, strategyId);
      }
      console.error('Error getting strategy notification config:', error);
      throw error;
    }

    return this.mapToConfig(data);
  }

  /**
   * Get all configs for a user
   */
  async getByUser(userId: string): Promise<StrategyNotificationConfig[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_notification_configs')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      if (error.code === '42P01') {
        return [];
      }
      console.error('Error getting user strategy configs:', error);
      throw error;
    }

    return (data ?? []).map(this.mapToConfig);
  }

  /**
   * Update config
   */
  async update(
    userId: string,
    strategyId: string,
    input: UpdateStrategyNotificationConfigInput
  ): Promise<StrategyNotificationConfig> {
    const supabase = getSupabaseClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.enabled !== undefined) updateData.enabled = input.enabled;
    if (input.signalTypes !== undefined) updateData.signal_types = input.signalTypes;
    if (input.minConfidenceScore !== undefined) updateData.min_confidence_score = input.minConfidenceScore;
    if (input.riskLevels !== undefined) updateData.risk_levels = input.riskLevels;
    if (input.notifyInApp !== undefined) updateData.notify_in_app = input.notifyInApp;
    if (input.notifyPush !== undefined) updateData.notify_push = input.notifyPush;
    if (input.notifyEmail !== undefined) updateData.notify_email = input.notifyEmail;
    if (input.notifySms !== undefined) updateData.notify_sms = input.notifySms;
    if (input.quietHoursEnabled !== undefined) updateData.quiet_hours_enabled = input.quietHoursEnabled;

    const { data, error } = await supabase
      .from('strategy_notification_configs')
      .update(updateData)
      .eq('user_id', userId)
      .eq('strategy_id', strategyId)
      .select()
      .single();

    if (error) {
      if (error.code === '42P01') {
        return this.createDefaultConfig(userId, strategyId);
      }
      console.error('Error updating strategy notification config:', error);
      throw error;
    }

    return this.mapToConfig(data);
  }

  /**
   * Delete config
   */
  async delete(userId: string, strategyId: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('strategy_notification_configs')
      .delete()
      .eq('user_id', userId)
      .eq('strategy_id', strategyId);

    if (error && error.code !== '42P01') {
      console.error('Error deleting strategy notification config:', error);
      throw error;
    }
  }

  /**
   * Bulk update configs for multiple strategies
   */
  async bulkUpdate(
    userId: string,
    updates: Array<{ strategyId: string; config: UpdateStrategyNotificationConfigInput }>
  ): Promise<StrategyNotificationConfig[]> {
    const results: StrategyNotificationConfig[] = [];

    for (const { strategyId, config } of updates) {
      const result = await this.update(userId, strategyId, config);
      results.push(result);
    }

    return results;
  }

  /**
   * Enable/disable notifications for all strategies
   */
  async setAllEnabled(userId: string, enabled: boolean): Promise<number> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_notification_configs')
      .update({
        enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select();

    if (error) {
      if (error.code === '42P01') return 0;
      console.error('Error updating all strategy configs:', error);
      throw error;
    }

    return data?.length ?? 0;
  }

  private createDefaultConfig(userId: string, strategyId: string): StrategyNotificationConfig {
    return {
      id: `default-${userId}-${strategyId}`,
      userId,
      strategyId,
      enabled: DEFAULT_CONFIG.enabled!,
      signalTypes: DEFAULT_CONFIG.signalTypes!,
      minConfidenceScore: DEFAULT_CONFIG.minConfidenceScore!,
      riskLevels: DEFAULT_CONFIG.riskLevels!,
      notifyInApp: DEFAULT_CONFIG.notifyInApp!,
      notifyPush: DEFAULT_CONFIG.notifyPush!,
      notifyEmail: DEFAULT_CONFIG.notifyEmail!,
      notifySms: DEFAULT_CONFIG.notifySms!,
      quietHoursEnabled: DEFAULT_CONFIG.quietHoursEnabled!,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private mapToConfig(row: Record<string, unknown>): StrategyNotificationConfig {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      strategyId: row.strategy_id as string,
      enabled: row.enabled as boolean,
      signalTypes: row.signal_types as string[],
      minConfidenceScore: row.min_confidence_score as number,
      riskLevels: row.risk_levels as ('low' | 'medium' | 'high' | 'very_high')[],
      notifyInApp: row.notify_in_app as boolean,
      notifyPush: row.notify_push as boolean,
      notifyEmail: row.notify_email as boolean,
      notifySms: row.notify_sms as boolean,
      quietHoursEnabled: row.quiet_hours_enabled as boolean,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// Singleton instance
let strategyNotificationConfigDAO: StrategyNotificationConfigDAO | null = null;

export function getStrategyNotificationConfigDAO(): StrategyNotificationConfigDAO {
  if (!strategyNotificationConfigDAO) {
    strategyNotificationConfigDAO = new StrategyNotificationConfigDAO();
  }
  return strategyNotificationConfigDAO;
}