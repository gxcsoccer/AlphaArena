/**
 * Referral System Data Access Object
 * Handles database operations for referral codes, referrals, and rewards
 */

import { getSupabaseClient, getSupabaseAdminClient } from './client';
import { createLogger } from '../utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';

const log = createLogger('ReferralDAO');

// ============================================
// Type Definitions
// ============================================

export interface ReferralCode {
  id: string;
  userId: string;
  code: string;
  totalReferrals: number;
  successfulReferrals: number;
  pendingRewards: number;
  totalRewardsEarned: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Referral {
  id: string;
  referrerCodeId: string;
  referrerUserId: string;
  inviteeUserId: string | null;
  inviteEmail: string | null;
  inviteToken: string;
  status: 'pending' | 'registered' | 'activated' | 'rewarded' | 'cancelled';
  inviteeDeviceFingerprint: string | null;
  inviteeIpAddress: string | null;
  invitedAt: Date;
  registeredAt: Date | null;
  activatedAt: Date | null;
  rewardScheduledAt: Date | null;
  rewardProcessedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Reward {
  id: string;
  userId: string;
  referralId: string | null;
  rewardType: 'referral_bonus' | 'invitee_bonus' | 'activation_bonus' | 'manual';
  amount: number;
  currency: string;
  sourceUserId: string | null;
  status: 'pending' | 'processed' | 'cancelled';
  scheduledAt: Date | null;
  processedAt: Date | null;
  virtualAccountTransactionId: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferralFraudFlag {
  id: string;
  referralId: string;
  flagType: 'same_device' | 'same_ip' | 'rapid_registration' | 'suspicious_pattern' | 'self_referral' | 'multiple_accounts';
  severity: 'low' | 'medium' | 'high';
  details: Record<string, unknown>;
  resolved: boolean;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  createdAt: Date;
}

export interface ReferralStats {
  hasCode: boolean;
  referralCode: string | null;
  totalReferrals: number;
  successfulReferrals: number;
  pendingRewards: number;
  totalRewardsEarned: number;
  recentReferrals: Array<{
    id: string;
    status: string;
    invitedAt: Date;
    registeredAt: Date | null;
    activatedAt: Date | null;
  }>;
  earningsSummary: {
    pending: number;
    processed: number;
    total: number;
  };
}

export interface CreateReferralCodeData {
  userId: string;
}

export interface CreateReferralInviteData {
  referrerUserId: string;
  inviteEmail?: string;
}

export interface ProcessRegistrationData {
  inviteToken: string;
  inviteeUserId: string;
  deviceFingerprint?: string;
  ipAddress?: string;
}

// ============================================
// DAO Class
// ============================================

export class ReferralDAO {
  private anonClient: SupabaseClient;
  private adminClient: SupabaseClient;

  constructor(anonClient: SupabaseClient, adminClient: SupabaseClient) {
    this.anonClient = anonClient;
    this.adminClient = adminClient;
  }

  // ============================================
  // Referral Code Operations
  // ============================================

  /**
   * Get or create a referral code for a user
   */
  async getOrCreateReferralCode(userId: string): Promise<ReferralCode> {
    const { data, error } = await this.adminClient.rpc('get_or_create_referral_code', {
      p_user_id: userId,
    });

    if (error) {
      log.error('Failed to get or create referral code:', error);
      throw error;
    }

    // Fetch the full record
    const { data: code, error: fetchError } = await this.adminClient
      .from('referral_codes')
      .select('*')
      .eq('id', data)
      .single();

    if (fetchError) {
      log.error('Failed to fetch referral code:', fetchError);
      throw fetchError;
    }

    return this.mapReferralCodeRow(code);
  }

  /**
   * Get referral code by user ID
   */
  async getReferralCodeByUserId(userId: string): Promise<ReferralCode | null> {
    const { data, error } = await this.anonClient
      .from('referral_codes')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      log.error('Failed to get referral code:', error);
      throw error;
    }

    return data ? this.mapReferralCodeRow(data) : null;
  }

  /**
   * Get referral code by code string
   */
  async getReferralCodeByCode(code: string): Promise<ReferralCode | null> {
    const { data, error } = await this.anonClient
      .from('referral_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      log.error('Failed to get referral code by code:', error);
      throw error;
    }

    return data ? this.mapReferralCodeRow(data) : null;
  }

  /**
   * Deactivate a referral code
   */
  async deactivateReferralCode(userId: string): Promise<void> {
    const { error } = await this.adminClient
      .from('referral_codes')
      .update({ is_active: false, updated_at: new Date() })
      .eq('user_id', userId);

    if (error) {
      log.error('Failed to deactivate referral code:', error);
      throw error;
    }
  }

  // ============================================
  // Referral Operations
  // ============================================

  /**
   * Create a referral invite
   */
  async createReferralInvite(data: CreateReferralInviteData): Promise<{
    success: boolean;
    referralId?: string;
    inviteToken?: string;
    referralLink?: string;
    error?: string;
  }> {
    const { data: result, error } = await this.adminClient.rpc('create_referral_invite', {
      p_referrer_user_id: data.referrerUserId,
      p_invite_email: data.inviteEmail || null,
    });

    if (error) {
      log.error('Failed to create referral invite:', error);
      throw error;
    }

    return result as {
      success: boolean;
      referral_id?: string;
      invite_token?: string;
      referral_link?: string;
      message?: string;
    };
  }

  /**
   * Get referral by invite token
   */
  async getReferralByInviteToken(inviteToken: string): Promise<Referral | null> {
    const { data, error } = await this.anonClient
      .from('referrals')
      .select('*')
      .eq('invite_token', inviteToken)
      .maybeSingle();

    if (error) {
      log.error('Failed to get referral by invite token:', error);
      throw error;
    }

    return data ? this.mapReferralRow(data) : null;
  }

  /**
   * Get referral by invitee user ID
   */
  async getReferralByInviteeUserId(inviteeUserId: string): Promise<Referral | null> {
    const { data, error } = await this.anonClient
      .from('referrals')
      .select('*')
      .eq('invitee_user_id', inviteeUserId)
      .maybeSingle();

    if (error) {
      log.error('Failed to get referral by invitee:', error);
      throw error;
    }

    return data ? this.mapReferralRow(data) : null;
  }

  /**
   * Process a referral registration
   */
  async processReferralRegistration(data: ProcessRegistrationData): Promise<{
    success: boolean;
    referralId?: string;
    referrerUserId?: string;
    inviteeBonus?: number;
    error?: string;
    message?: string;
  }> {
    const { data: result, error } = await this.adminClient.rpc('process_referral_registration', {
      p_invite_token: data.inviteToken,
      p_invitee_user_id: data.inviteeUserId,
      p_device_fingerprint: data.deviceFingerprint || null,
      p_ip_address: data.ipAddress || null,
    });

    if (error) {
      log.error('Failed to process referral registration:', error);
      throw error;
    }

    // Map snake_case from RPC to camelCase
    const mapped = result as {
      success: boolean;
      referral_id?: string;
      referrer_user_id?: string;
      invitee_bonus?: number;
      error?: string;
      message?: string;
    };

    return {
      success: mapped.success,
      referralId: mapped.referral_id,
      referrerUserId: mapped.referrer_user_id,
      inviteeBonus: mapped.invitee_bonus,
      error: mapped.error,
      message: mapped.message,
    };
  }

  /**
   * Activate a referral (when invitee meets criteria)
   */
  async activateReferral(inviteeUserId: string): Promise<{
    success: boolean;
    referralId?: string;
    rewardAmount?: number;
    rewardScheduledAt?: Date;
    error?: string;
  }> {
    const { data: result, error } = await this.adminClient.rpc('activate_referral', {
      p_invitee_user_id: inviteeUserId,
    });

    if (error) {
      log.error('Failed to activate referral:', error);
      throw error;
    }

    // Map snake_case from RPC to camelCase
    const mapped = result as {
      success: boolean;
      referral_id?: string;
      reward_amount?: number;
      reward_scheduled_at?: string;
      error?: string;
    };

    return {
      success: mapped.success,
      referralId: mapped.referral_id,
      rewardAmount: mapped.reward_amount,
      rewardScheduledAt: mapped.reward_scheduled_at ? new Date(mapped.reward_scheduled_at) : undefined,
      error: mapped.error,
    };
  }

  /**
   * Get referrals by referrer user ID
   */
  async getReferralsByReferrerUserId(
    referrerUserId: string,
    options?: { limit?: number; offset?: number; status?: string }
  ): Promise<{ referrals: Referral[]; total: number }> {
    let query = this.anonClient
      .from('referrals')
      .select('*', { count: 'exact' })
      .eq('referrer_user_id', referrerUserId);

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    query = query
      .order('invited_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      log.error('Failed to get referrals:', error);
      throw error;
    }

    return {
      referrals: (data || []).map(this.mapReferralRow),
      total: count || 0,
    };
  }

  // ============================================
  // Reward Operations
  // ============================================

  /**
   * Get rewards by user ID
   */
  async getRewardsByUserId(
    userId: string,
    options?: { limit?: number; offset?: number; status?: string }
  ): Promise<{ rewards: Reward[]; total: number }> {
    let query = this.anonClient
      .from('rewards')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      log.error('Failed to get rewards:', error);
      throw error;
    }

    return {
      rewards: (data || []).map(this.mapRewardRow),
      total: count || 0,
    };
  }

  /**
   * Create a manual reward
   */
  async createManualReward(data: {
    userId: string;
    amount: number;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Reward> {
    const { data: reward, error } = await this.adminClient
      .from('rewards')
      .insert({
        user_id: data.userId,
        reward_type: 'manual',
        amount: data.amount,
        description: data.description || 'Manual reward',
        metadata: data.metadata || {},
        status: 'pending',
        scheduled_at: new Date(),
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to create manual reward:', error);
      throw error;
    }

    return this.mapRewardRow(reward);
  }

  /**
   * Process pending rewards (cron job)
   */
  async processPendingRewards(): Promise<number> {
    const { data, error } = await this.adminClient.rpc('process_pending_rewards');

    if (error) {
      log.error('Failed to process pending rewards:', error);
      throw error;
    }

    return data as number;
  }

  // ============================================
  // Statistics
  // ============================================

  /**
   * Get referral statistics for a user
   */
  async getReferralStats(userId: string): Promise<ReferralStats> {
    const { data, error } = await this.anonClient.rpc('get_referral_stats', {
      p_user_id: userId,
    });

    if (error) {
      log.error('Failed to get referral stats:', error);
      throw error;
    }

    return this.mapReferralStats(data);
  }

  // ============================================
  // Helper Methods
  // ============================================

  private mapReferralCodeRow(row: Record<string, unknown>): ReferralCode {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      code: row.code as string,
      totalReferrals: row.total_referrals as number,
      successfulReferrals: row.successful_referrals as number,
      pendingRewards: typeof row.pending_rewards === 'string' 
        ? parseFloat(row.pending_rewards) 
        : (row.pending_rewards as number),
      totalRewardsEarned: typeof row.total_rewards_earned === 'string' 
        ? parseFloat(row.total_rewards_earned) 
        : (row.total_rewards_earned as number),
      isActive: row.is_active as boolean,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapReferralRow(row: Record<string, unknown>): Referral {
    return {
      id: row.id as string,
      referrerCodeId: row.referrer_code_id as string,
      referrerUserId: row.referrer_user_id as string,
      inviteeUserId: row.invitee_user_id as string | null,
      inviteEmail: row.invite_email as string | null,
      inviteToken: row.invite_token as string,
      status: row.status as Referral['status'],
      inviteeDeviceFingerprint: row.invitee_device_fingerprint as string | null,
      inviteeIpAddress: row.invitee_ip_address as string | null,
      invitedAt: new Date(row.invited_at as string),
      registeredAt: row.registered_at ? new Date(row.registered_at as string) : null,
      activatedAt: row.activated_at ? new Date(row.activated_at as string) : null,
      rewardScheduledAt: row.reward_scheduled_at ? new Date(row.reward_scheduled_at as string) : null,
      rewardProcessedAt: row.reward_processed_at ? new Date(row.reward_processed_at as string) : null,
      metadata: (row.metadata as Record<string, unknown>) || {},
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapRewardRow(row: Record<string, unknown>): Reward {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      referralId: row.referral_id as string | null,
      rewardType: row.reward_type as Reward['rewardType'],
      amount: typeof row.amount === 'string' ? parseFloat(row.amount) : (row.amount as number),
      currency: row.currency as string,
      sourceUserId: row.source_user_id as string | null,
      status: row.status as Reward['status'],
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at as string) : null,
      processedAt: row.processed_at ? new Date(row.processed_at as string) : null,
      virtualAccountTransactionId: row.virtual_account_transaction_id as string | null,
      description: row.description as string | null,
      metadata: (row.metadata as Record<string, unknown>) || {},
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapReferralFraudFlagRow(row: Record<string, unknown>): ReferralFraudFlag {
    return {
      id: row.id as string,
      referralId: row.referral_id as string,
      flagType: row.flag_type as ReferralFraudFlag['flagType'],
      severity: row.severity as ReferralFraudFlag['severity'],
      details: (row.details as Record<string, unknown>) || {},
      resolved: row.resolved as boolean,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at as string) : null,
      resolutionNote: row.resolution_note as string | null,
      createdAt: new Date(row.created_at as string),
    };
  }

  private mapReferralStats(data: Record<string, unknown>): ReferralStats {
    const earningsSummary = data.earnings_summary as Record<string, unknown> || {};
    const recentReferrals = (data.recent_referrals as Array<Record<string, unknown>> || []).map(r => ({
      id: r.id as string,
      status: r.status as string,
      invitedAt: new Date(r.invited_at as string),
      registeredAt: r.registered_at ? new Date(r.registered_at as string) : null,
      activatedAt: r.activated_at ? new Date(r.activated_at as string) : null,
    }));

    return {
      hasCode: data.has_code as boolean,
      referralCode: data.referral_code as string | null,
      totalReferrals: data.total_referrals as number,
      successfulReferrals: data.successful_referrals as number,
      pendingRewards: typeof data.pending_rewards === 'string' 
        ? parseFloat(data.pending_rewards) 
        : (data.pending_rewards as number) || 0,
      totalRewardsEarned: typeof data.total_rewards_earned === 'string' 
        ? parseFloat(data.total_rewards_earned) 
        : (data.total_rewards_earned as number) || 0,
      recentReferrals,
      earningsSummary: {
        pending: typeof earningsSummary.pending === 'string' 
          ? parseFloat(earningsSummary.pending) 
          : (earningsSummary.pending as number) || 0,
        processed: typeof earningsSummary.processed === 'string' 
          ? parseFloat(earningsSummary.processed) 
          : (earningsSummary.processed as number) || 0,
        total: typeof earningsSummary.total === 'string' 
          ? parseFloat(earningsSummary.total) 
          : (earningsSummary.total as number) || 0,
      },
    };
  }
}

// Export singleton instance
let referralDAO: ReferralDAO | null = null;

export function getReferralDAO(): ReferralDAO {
  if (!referralDAO) {
    referralDAO = new ReferralDAO(getSupabaseClient(), getSupabaseAdminClient());
  }
  return referralDAO;
}

export default ReferralDAO;