/**
 * Promo Code Data Access Object
 * Handles database operations for promo codes and usage tracking
 */

import { getSupabaseClient, getSupabaseAdminClient } from './client';
import { createLogger } from '../utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';

const log = createLogger('PromoCodeDAO');

// Type definitions
export interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  currency: string;
  validFrom: Date;
  validUntil: Date | null;
  maxUses: number | null;
  maxUsesPerUser: number;
  currentUses: number;
  stripeCouponId: string | null;
  stripePromotionCodeId: string | null;
  applicablePlans: string[] | null;
  minPurchaseAmount: number | null;
  firstTimeUsersOnly: boolean;
  isActive: boolean;
  createdBy: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PromoCodeUsage {
  id: string;
  promoCodeId: string;
  userId: string;
  stripeSubscriptionId: string | null;
  stripeInvoiceId: string | null;
  planId: string | null;
  discountAmount: number | null;
  currency: string;
  usedAt: Date;
}

export interface UserTrial {
  id: string;
  userId: string;
  trialPlanId: string;
  trialStart: Date;
  trialEnd: Date;
  status: 'active' | 'converted' | 'expired' | 'canceled';
  convertedToPlan: string | null;
  convertedAt: Date | null;
  convertedViaPromoCode: string | null;
  reminder3DaysSent: boolean;
  reminder1DaySent: boolean;
  reminderExpiredSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PromoCodeValidationResult {
  valid: boolean;
  error?: string;
  message?: string;
  promoCodeId?: string;
  code?: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  discountAmount?: number | null;
  currency?: string;
  stripeCouponId?: string | null;
  stripePromotionCodeId?: string | null;
}

export interface TrialStartResult {
  success: boolean;
  error?: string;
  message?: string;
  trial?: {
    planId: string;
    trialStart: Date;
    trialEnd: Date;
    trialDays: number;
  };
}

/**
 * Promo Code DAO Class
 * Uses anon client for reads (RLS enforced) and admin client for writes (bypasses RLS)
 */
export class PromoCodeDAO {
  private anonClient: SupabaseClient;
  private adminClient: SupabaseClient;

  constructor(anonClient: SupabaseClient, adminClient: SupabaseClient) {
    this.anonClient = anonClient;
    this.adminClient = adminClient;
  }

  // ==================== Promo Codes ====================

  /**
   * Create a new promo code
   * Uses admin client for write
   */
  async createPromoCode(data: {
    code: string;
    description?: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    currency?: string;
    validFrom?: Date;
    validUntil?: Date | null;
    maxUses?: number | null;
    maxUsesPerUser?: number;
    stripeCouponId?: string;
    stripePromotionCodeId?: string;
    applicablePlans?: string[] | null;
    minPurchaseAmount?: number | null;
    firstTimeUsersOnly?: boolean;
    createdBy?: string;
    metadata?: Record<string, unknown>;
  }): Promise<PromoCode> {
    const insertData: Record<string, unknown> = {
      code: data.code.toUpperCase(),
      description: data.description || null,
      discount_type: data.discountType,
      discount_value: data.discountValue,
      currency: data.currency || 'CNY',
      valid_from: data.validFrom || new Date(),
      valid_until: data.validUntil || null,
      max_uses: data.maxUses || null,
      max_uses_per_user: data.maxUsesPerUser || 1,
      stripe_coupon_id: data.stripeCouponId || null,
      stripe_promotion_code_id: data.stripePromotionCodeId || null,
      applicable_plans: data.applicablePlans || null,
      min_purchase_amount: data.minPurchaseAmount || null,
      first_time_users_only: data.firstTimeUsersOnly || false,
      created_by: data.createdBy || null,
      metadata: data.metadata || {},
    };

    const { data: result, error } = await this.adminClient
      .from('promo_codes')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      log.error('Failed to create promo code:', error);
      throw error;
    }

    return this.mapPromoCodeRow(result);
  }

  /**
   * Get promo code by code string
   * Uses anon client for read
   */
  async getPromoCodeByCode(code: string): Promise<PromoCode | null> {
    const { data, error } = await this.anonClient
      .from('promo_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      log.error('Failed to get promo code:', error);
      throw error;
    }

    return data ? this.mapPromoCodeRow(data) : null;
  }

  /**
   * Get promo code by ID
   * Uses admin client for read (to access inactive codes)
   */
  async getPromoCodeById(id: string): Promise<PromoCode | null> {
    const { data, error } = await this.adminClient
      .from('promo_codes')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      log.error('Failed to get promo code by ID:', error);
      throw error;
    }

    return data ? this.mapPromoCodeRow(data) : null;
  }

  /**
   * List all promo codes (admin)
   * Uses admin client
   */
  async listPromoCodes(options?: {
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<PromoCode[]> {
    let query = this.adminClient
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (options?.isActive !== undefined) {
      query = query.eq('is_active', options.isActive);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, error } = await query;

    if (error) {
      log.error('Failed to list promo codes:', error);
      throw error;
    }

    return (data || []).map(this.mapPromoCodeRow);
  }

  /**
   * Update promo code
   * Uses admin client for write
   */
  async updatePromoCode(id: string, data: Partial<{
    description: string | null;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    currency: string;
    validFrom: Date;
    validUntil: Date | null;
    maxUses: number | null;
    maxUsesPerUser: number;
    applicablePlans: string[] | null;
    minPurchaseAmount: number | null;
    firstTimeUsersOnly: boolean;
    isActive: boolean;
    stripeCouponId: string | null;
    stripePromotionCodeId: string | null;
    metadata: Record<string, unknown>;
  }>): Promise<PromoCode | null> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (data.description !== undefined) updateData.description = data.description;
    if (data.discountType !== undefined) updateData.discount_type = data.discountType;
    if (data.discountValue !== undefined) updateData.discount_value = data.discountValue;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.validFrom !== undefined) updateData.valid_from = data.validFrom;
    if (data.validUntil !== undefined) updateData.valid_until = data.validUntil;
    if (data.maxUses !== undefined) updateData.max_uses = data.maxUses;
    if (data.maxUsesPerUser !== undefined) updateData.max_uses_per_user = data.maxUsesPerUser;
    if (data.applicablePlans !== undefined) updateData.applicable_plans = data.applicablePlans;
    if (data.minPurchaseAmount !== undefined) updateData.min_purchase_amount = data.minPurchaseAmount;
    if (data.firstTimeUsersOnly !== undefined) updateData.first_time_users_only = data.firstTimeUsersOnly;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;
    if (data.stripeCouponId !== undefined) updateData.stripe_coupon_id = data.stripeCouponId;
    if (data.stripePromotionCodeId !== undefined) updateData.stripe_promotion_code_id = data.stripePromotionCodeId;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    const { data: result, error } = await this.adminClient
      .from('promo_codes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      log.error('Failed to update promo code:', error);
      throw error;
    }

    return result ? this.mapPromoCodeRow(result) : null;
  }

  /**
   * Delete (deactivate) promo code
   * Uses admin client for write
   */
  async deactivatePromoCode(id: string): Promise<boolean> {
    const { error } = await this.adminClient
      .from('promo_codes')
      .update({ is_active: false, updated_at: new Date() })
      .eq('id', id);

    if (error) {
      log.error('Failed to deactivate promo code:', error);
      throw error;
    }

    return true;
  }

  // ==================== Promo Code Validation & Usage ====================

  /**
   * Validate a promo code
   * Uses RPC function for complex validation logic
   */
  async validatePromoCode(
    code: string,
    userId: string,
    planId?: string,
    amount?: number
  ): Promise<PromoCodeValidationResult> {
    const { data, error } = await this.adminClient.rpc('validate_promo_code', {
      p_code: code.toUpperCase(),
      p_user_id: userId,
      p_plan_id: planId || null,
      p_amount: amount || null,
    });

    if (error) {
      log.error('Failed to validate promo code:', error);
      throw error;
    }

    return data as PromoCodeValidationResult;
  }

  /**
   * Record promo code usage
   * Uses RPC function
   */
  async recordUsage(data: {
    promoCodeId: string;
    userId: string;
    stripeSubscriptionId?: string;
    stripeInvoiceId?: string;
    planId?: string;
    discountAmount?: number;
    currency?: string;
  }): Promise<string> {
    const { data: usageId, error } = await this.adminClient.rpc('record_promo_code_usage', {
      p_promo_code_id: data.promoCodeId,
      p_user_id: data.userId,
      p_stripe_subscription_id: data.stripeSubscriptionId || null,
      p_stripe_invoice_id: data.stripeInvoiceId || null,
      p_plan_id: data.planId || null,
      p_discount_amount: data.discountAmount || null,
      p_currency: data.currency || 'CNY',
    });

    if (error) {
      log.error('Failed to record promo code usage:', error);
      throw error;
    }

    return usageId;
  }

  /**
   * Get user's promo code usage history
   * Uses anon client for read
   */
  async getUserPromoCodeUsage(userId: string, limit: number = 20): Promise<PromoCodeUsage[]> {
    const { data, error } = await this.anonClient
      .from('promo_code_usage')
      .select('*')
      .eq('user_id', userId)
      .order('used_at', { ascending: false })
      .limit(limit);

    if (error) {
      log.error('Failed to get user promo code usage:', error);
      throw error;
    }

    return (data || []).map(this.mapPromoCodeUsageRow);
  }

  // ==================== User Trials ====================

  /**
   * Start a trial for a user
   * Uses RPC function
   */
  async startTrial(
    userId: string,
    trialDays: number = 14,
    planId: string = 'pro'
  ): Promise<TrialStartResult> {
    const { data, error } = await this.adminClient.rpc('start_user_trial', {
      p_user_id: userId,
      p_trial_days: trialDays,
      p_plan_id: planId,
    });

    if (error) {
      log.error('Failed to start trial:', error);
      throw error;
    }

    // Parse the result
    const result = data as TrialStartResult;
    if (result.trial) {
      result.trial.trialStart = new Date(result.trial.trialStart as unknown as string);
      result.trial.trialEnd = new Date(result.trial.trialEnd as unknown as string);
    }
    return result;
  }

  /**
   * Get user's trial status
   * Uses anon client for read
   */
  async getUserTrial(userId: string): Promise<UserTrial | null> {
    const { data, error } = await this.anonClient
      .from('user_trials')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      log.error('Failed to get user trial:', error);
      throw error;
    }

    return data ? this.mapUserTrialRow(data) : null;
  }

  /**
   * Convert trial to paid subscription
   * Uses admin client for write
   */
  async convertTrial(
    userId: string,
    toPlanId: string,
    promoCodeId?: string
  ): Promise<UserTrial | null> {
    const updateData: Record<string, unknown> = {
      status: 'converted',
      converted_to_plan: toPlanId,
      converted_at: new Date(),
      updated_at: new Date(),
    };

    if (promoCodeId) {
      updateData.converted_via_promo_code = promoCodeId;
    }

    const { data, error } = await this.adminClient
      .from('user_trials')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      log.error('Failed to convert trial:', error);
      throw error;
    }

    return data ? this.mapUserTrialRow(data) : null;
  }

  /**
   * Cancel a trial
   * Uses admin client for write
   */
  async cancelTrial(userId: string): Promise<UserTrial | null> {
    const { data, error } = await this.adminClient
      .from('user_trials')
      .update({
        status: 'canceled',
        updated_at: new Date(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      log.error('Failed to cancel trial:', error);
      throw error;
    }

    return data ? this.mapUserTrialRow(data) : null;
  }

  /**
   * Get users needing trial reminders
   * Uses RPC function
   */
  async getUsersForTrialReminder(daysBefore: number): Promise<Array<{
    userId: string;
    trialEnd: Date;
    trialPlanId: string;
  }>> {
    const { data, error } = await this.adminClient.rpc('get_users_for_trial_reminder', {
      p_days_before: daysBefore,
    });

    if (error) {
      log.error('Failed to get users for trial reminder:', error);
      throw error;
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      userId: row.user_id as string,
      trialEnd: new Date(row.trial_end as string),
      trialPlanId: row.trial_plan_id as string,
    }));
  }

  /**
   * Mark trial reminder as sent
   * Uses RPC function
   */
  async markTrialReminderSent(userId: string, daysBefore: number): Promise<void> {
    const { error } = await this.adminClient.rpc('mark_trial_reminder_sent', {
      p_user_id: userId,
      p_days_before: daysBefore,
    });

    if (error) {
      log.error('Failed to mark trial reminder sent:', error);
      throw error;
    }
  }

  /**
   * Expire trials that have ended
   * Uses RPC function
   */
  async expireTrials(): Promise<number> {
    const { data, error } = await this.adminClient.rpc('expire_trials');

    if (error) {
      log.error('Failed to expire trials:', error);
      throw error;
    }

    return data as number;
  }

  // ==================== Helper Methods ====================

  private mapPromoCodeRow(row: Record<string, unknown>): PromoCode {
    return {
      id: row.id as string,
      code: row.code as string,
      description: row.description as string | null,
      discountType: row.discount_type as 'percentage' | 'fixed',
      discountValue: typeof row.discount_value === 'string' 
        ? parseFloat(row.discount_value) 
        : (row.discount_value as number),
      currency: row.currency as string,
      validFrom: new Date(row.valid_from as string),
      validUntil: row.valid_until ? new Date(row.valid_until as string) : null,
      maxUses: row.max_uses as number | null,
      maxUsesPerUser: row.max_uses_per_user as number,
      currentUses: row.current_uses as number,
      stripeCouponId: row.stripe_coupon_id as string | null,
      stripePromotionCodeId: row.stripe_promotion_code_id as string | null,
      applicablePlans: row.applicable_plans as string[] | null,
      minPurchaseAmount: row.min_purchase_amount as number | null,
      firstTimeUsersOnly: row.first_time_users_only as boolean,
      isActive: row.is_active as boolean,
      createdBy: row.created_by as string | null,
      metadata: row.metadata as Record<string, unknown>,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapPromoCodeUsageRow(row: Record<string, unknown>): PromoCodeUsage {
    return {
      id: row.id as string,
      promoCodeId: row.promo_code_id as string,
      userId: row.user_id as string,
      stripeSubscriptionId: row.stripe_subscription_id as string | null,
      stripeInvoiceId: row.stripe_invoice_id as string | null,
      planId: row.plan_id as string | null,
      discountAmount: row.discount_amount as number | null,
      currency: row.currency as string,
      usedAt: new Date(row.used_at as string),
    };
  }

  private mapUserTrialRow(row: Record<string, unknown>): UserTrial {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      trialPlanId: row.trial_plan_id as string,
      trialStart: new Date(row.trial_start as string),
      trialEnd: new Date(row.trial_end as string),
      status: row.status as 'active' | 'converted' | 'expired' | 'canceled',
      convertedToPlan: row.converted_to_plan as string | null,
      convertedAt: row.converted_at ? new Date(row.converted_at as string) : null,
      convertedViaPromoCode: row.converted_via_promo_code as string | null,
      reminder3DaysSent: row.reminder_3_days_sent as boolean,
      reminder1DaySent: row.reminder_1_day_sent as boolean,
      reminderExpiredSent: row.reminder_expired_sent as boolean,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// Export singleton instance
let promoCodeDAO: PromoCodeDAO | null = null;

export function getPromoCodeDAO(): PromoCodeDAO {
  if (!promoCodeDAO) {
    promoCodeDAO = new PromoCodeDAO(getSupabaseClient(), getSupabaseAdminClient());
  }
  return promoCodeDAO;
}
