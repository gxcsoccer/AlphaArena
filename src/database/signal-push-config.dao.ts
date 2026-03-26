/**
 * Signal Push Configuration DAO
 * Manages user preferences for real-time signal notifications
 */

import { getSupabaseClient } from './client';

export type SignalPushFrequency = 'realtime' | 'batch_1m' | 'batch_5m' | 'batch_15m';
export type SignalTypeFilter = 'buy' | 'sell' | 'stop_loss' | 'take_profit' | 'risk_alert' | 'all';

export interface SignalPushConfig {
  id: string;
  userId: string;
  
  // Master toggle
  pushEnabled: boolean;
  
  // Signal types to receive
  signalTypes: SignalTypeFilter[];
  
  // Push frequency
  frequency: SignalPushFrequency;
  
  // Notification channels
  browserNotify: boolean;
  inAppNotify: boolean;
  soundEnabled: boolean;
  
  // Filter settings
  minConfidenceScore: number; // 0-100
  riskLevels: ('low' | 'medium' | 'high' | 'very_high')[];
  symbols: string[]; // Empty = all symbols
  
  // Quiet hours
  quietHoursEnabled: boolean;
  quietHoursStart: string; // HH:MM format
  quietHoursEnd: string; // HH:MM format
  quietHoursTimezone: string;
  
  // Push statistics
  totalPushes?: number;
  successfulPushes?: number;
  failedPushes?: number;
  lastPushAt?: Date | null;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePushConfigInput {
  userId: string;
  pushEnabled?: boolean;
  signalTypes?: SignalTypeFilter[];
  frequency?: SignalPushFrequency;
  browserNotify?: boolean;
  inAppNotify?: boolean;
  soundEnabled?: boolean;
  minConfidenceScore?: number;
  riskLevels?: ('low' | 'medium' | 'high' | 'very_high')[];
  symbols?: string[];
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  quietHoursTimezone?: string;
}

export interface UpdatePushConfigInput {
  pushEnabled?: boolean;
  signalTypes?: SignalTypeFilter[];
  frequency?: SignalPushFrequency;
  browserNotify?: boolean;
  inAppNotify?: boolean;
  soundEnabled?: boolean;
  minConfidenceScore?: number;
  riskLevels?: ('low' | 'medium' | 'high' | 'very_high')[];
  symbols?: string[];
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  quietHoursTimezone?: string;
}

const DEFAULT_CONFIG: Omit<CreatePushConfigInput, 'userId'> = {
  pushEnabled: true,
  signalTypes: ['all'],
  frequency: 'realtime',
  browserNotify: true,
  inAppNotify: true,
  soundEnabled: true,
  minConfidenceScore: 0,
  riskLevels: ['low', 'medium', 'high', 'very_high'],
  symbols: [],
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  quietHoursTimezone: 'Asia/Shanghai',
};

export class SignalPushConfigDAO {
  /**
   * Get or create push config for a user
   */
  async getOrCreate(userId: string): Promise<SignalPushConfig> {
    const existing = await this.getByUserId(userId);
    if (existing) return existing;
    return this.create({ userId });
  }

  /**
   * Create push config
   */
  async create(input: CreatePushConfigInput): Promise<SignalPushConfig> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('signal_push_configs')
      .insert({
        user_id: input.userId,
        push_enabled: input.pushEnabled ?? DEFAULT_CONFIG.pushEnabled!,
        signal_types: input.signalTypes ?? DEFAULT_CONFIG.signalTypes!,
        frequency: input.frequency ?? DEFAULT_CONFIG.frequency!,
        browser_notify: input.browserNotify ?? DEFAULT_CONFIG.browserNotify!,
        in_app_notify: input.inAppNotify ?? DEFAULT_CONFIG.inAppNotify!,
        sound_enabled: input.soundEnabled ?? DEFAULT_CONFIG.soundEnabled!,
        min_confidence_score: input.minConfidenceScore ?? DEFAULT_CONFIG.minConfidenceScore!,
        risk_levels: input.riskLevels ?? DEFAULT_CONFIG.riskLevels!,
        symbols: input.symbols ?? DEFAULT_CONFIG.symbols!,
        quiet_hours_enabled: input.quietHoursEnabled ?? DEFAULT_CONFIG.quietHoursEnabled!,
        quiet_hours_start: input.quietHoursStart ?? DEFAULT_CONFIG.quietHoursStart!,
        quiet_hours_end: input.quietHoursEnd ?? DEFAULT_CONFIG.quietHoursEnd!,
        quiet_hours_timezone: input.quietHoursTimezone ?? DEFAULT_CONFIG.quietHoursTimezone!,
      })
      .select()
      .single();

    if (error) {
      // If table doesn't exist, return a default config
      if (error.code === '42P01') {
        console.warn('signal_push_configs table not found, returning default config');
        return this.createDefaultConfig(input.userId);
      }
      throw error;
    }

    return this.mapToConfig(data);
  }

  /**
   * Get push config by user ID
   */
  async getByUserId(userId: string): Promise<SignalPushConfig | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('signal_push_configs')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === '42P01') {
        console.warn('signal_push_configs table not found, returning default config');
        return this.createDefaultConfig(userId);
      }
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapToConfig(data);
  }

  /**
   * Update push config
   */
  async update(userId: string, input: UpdatePushConfigInput): Promise<SignalPushConfig> {
    const supabase = getSupabaseClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.pushEnabled !== undefined) updateData.push_enabled = input.pushEnabled;
    if (input.signalTypes !== undefined) updateData.signal_types = input.signalTypes;
    if (input.frequency !== undefined) updateData.frequency = input.frequency;
    if (input.browserNotify !== undefined) updateData.browser_notify = input.browserNotify;
    if (input.inAppNotify !== undefined) updateData.in_app_notify = input.inAppNotify;
    if (input.soundEnabled !== undefined) updateData.sound_enabled = input.soundEnabled;
    if (input.minConfidenceScore !== undefined) updateData.min_confidence_score = input.minConfidenceScore;
    if (input.riskLevels !== undefined) updateData.risk_levels = input.riskLevels;
    if (input.symbols !== undefined) updateData.symbols = input.symbols;
    if (input.quietHoursEnabled !== undefined) updateData.quiet_hours_enabled = input.quietHoursEnabled;
    if (input.quietHoursStart !== undefined) updateData.quiet_hours_start = input.quietHoursStart;
    if (input.quietHoursEnd !== undefined) updateData.quiet_hours_end = input.quietHoursEnd;
    if (input.quietHoursTimezone !== undefined) updateData.quiet_hours_timezone = input.quietHoursTimezone;

    const { data, error } = await supabase
      .from('signal_push_configs')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === '42P01') {
        console.warn('signal_push_configs table not found');
        return this.createDefaultConfig(userId);
      }
      throw error;
    }

    return this.mapToConfig(data);
  }

  /**
   * Delete push config
   */
  async delete(userId: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('signal_push_configs')
      .delete()
      .eq('user_id', userId);

    if (error && error.code !== '42P01') throw error;
  }

  /**
   * Create a default config object without database
   */
  private createDefaultConfig(userId: string): SignalPushConfig {
    return {
      id: `default-${userId}`,
      userId,
      pushEnabled: DEFAULT_CONFIG.pushEnabled!,
      signalTypes: DEFAULT_CONFIG.signalTypes!,
      frequency: DEFAULT_CONFIG.frequency!,
      browserNotify: DEFAULT_CONFIG.browserNotify!,
      inAppNotify: DEFAULT_CONFIG.inAppNotify!,
      soundEnabled: DEFAULT_CONFIG.soundEnabled!,
      minConfidenceScore: DEFAULT_CONFIG.minConfidenceScore!,
      riskLevels: DEFAULT_CONFIG.riskLevels!,
      symbols: DEFAULT_CONFIG.symbols!,
      quietHoursEnabled: DEFAULT_CONFIG.quietHoursEnabled!,
      quietHoursStart: DEFAULT_CONFIG.quietHoursStart!,
      quietHoursEnd: DEFAULT_CONFIG.quietHoursEnd!,
      quietHoursTimezone: DEFAULT_CONFIG.quietHoursTimezone!,
      totalPushes: 0,
      successfulPushes: 0,
      failedPushes: 0,
      lastPushAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private mapToConfig(row: Record<string, unknown>): SignalPushConfig {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      pushEnabled: row.push_enabled as boolean,
      signalTypes: row.signal_types as SignalTypeFilter[],
      frequency: row.frequency as SignalPushFrequency,
      browserNotify: row.browser_notify as boolean,
      inAppNotify: row.in_app_notify as boolean,
      soundEnabled: row.sound_enabled as boolean,
      minConfidenceScore: row.min_confidence_score as number,
      riskLevels: row.risk_levels as ('low' | 'medium' | 'high' | 'very_high')[],
      symbols: row.symbols as string[],
      quietHoursEnabled: row.quiet_hours_enabled as boolean,
      quietHoursStart: row.quiet_hours_start as string,
      quietHoursEnd: row.quiet_hours_end as string,
      quietHoursTimezone: row.quiet_hours_timezone as string,
      totalPushes: (row.total_pushes as number) || 0,
      successfulPushes: (row.successful_pushes as number) || 0,
      failedPushes: (row.failed_pushes as number) || 0,
      lastPushAt: row.last_push_at ? new Date(row.last_push_at as string) : null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// Singleton instance
let signalPushConfigDAO: SignalPushConfigDAO | null = null;

export function getSignalPushConfigDAO(): SignalPushConfigDAO {
  if (!signalPushConfigDAO) {
    signalPushConfigDAO = new SignalPushConfigDAO();
  }
  return signalPushConfigDAO;
}