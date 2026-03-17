/**
 * Subscription Plans Data Access Object
 * Handles database operations for subscription plans, user subscriptions, and feature usage
 */

import { getSupabaseClient, getSupabaseAdminClient } from './client';
import { createLogger } from '../utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';

const log = createLogger('SubscriptionDAO');

// Type definitions
export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  billingInterval: 'month' | 'year' | 'one-time' | null;
  features: Record<string, unknown>;
  limits: PlanLimits;
  stripePriceId: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanLimits {
  concurrentStrategies: number;
  dailyBacktests: number;
  dataRetention: number;
  apiCalls: number;
  [key: string]: number;
}

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  status: 'active' | 'canceled' | 'expired' | 'past_due' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  stripePriceId: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  cancellationReason: string | null;
  trialStart: Date | null;
  trialEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionHistory {
  id: string;
  userId: string;
  action: 'created' | 'upgraded' | 'downgraded' | 'canceled' | 'renewed' | 'expired' | 'trial_started' | 'trial_ended';
  fromPlan: string | null;
  toPlan: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  stripeEventId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface FeatureUsage {
  id: string;
  userId: string;
  featureKey: string;
  usageDate: Date;
  usageCount: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureAccessResult {
  hasAccess: boolean;
  limit: number;
  currentUsage: number;
  remaining: number;
  planId: string;
}

export interface UserSubscriptionStatus {
  planId: string;
  planName: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  features: Record<string, unknown>;
  limits: PlanLimits;
}

/**
 * Subscription DAO Class
 * Uses anon client for reads (RLS enforced) and admin client for writes (bypasses RLS)
 */
export class SubscriptionDAO {
  private anonClient: SupabaseClient;
  private adminClient: SupabaseClient;

  constructor(anonClient: SupabaseClient, adminClient: SupabaseClient) {
    this.anonClient = anonClient;
    this.adminClient = adminClient;
  }

  // ==================== Subscription Plans ====================

  /**
   * Get all active subscription plans
   * Uses anon client - RLS filters visible plans
   */
  async getPlans(): Promise<SubscriptionPlan[]> {
    const { data, error } = await this.anonClient
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      log.error('Failed to get plans:', error);
      throw error;
    }

    return (data || []).map(this.mapPlanRow);
  }

  /**
   * Get a specific plan by ID
   * Uses anon client - RLS filters visible plans
   */
  async getPlanById(planId: string): Promise<SubscriptionPlan | null> {
    const { data, error } = await this.anonClient
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      log.error('Failed to get plan:', error);
      throw error;
    }

    return data ? this.mapPlanRow(data) : null;
  }

  // ==================== User Subscriptions ====================

  /**
   * Get user's current subscription
   * Uses anon client - RLS filters to user's own subscription
   */
  async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    const { data, error } = await this.anonClient
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      log.error('Failed to get user subscription:', error);
      throw error;
    }

    return data ? this.mapUserSubscriptionRow(data) : null;
  }

  /**
   * Get user's subscription status with plan details
   * Uses anon client for reads
   */
  async getUserSubscriptionStatus(userId: string): Promise<UserSubscriptionStatus> {
    // First get user's subscription
    const subscription = await this.getUserSubscription(userId);
    
    if (!subscription || subscription.status !== 'active') {
      // Return free plan as default
      const freePlan = await this.getPlanById('free');
      return {
        planId: 'free',
        planName: freePlan?.name || 'Free',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        features: freePlan?.features || {},
        limits: freePlan?.limits || this.getDefaultLimits(),
      };
    }

    // Get plan details
    const plan = await this.getPlanById(subscription.planId);

    return {
      planId: subscription.planId,
      planName: plan?.name || subscription.planId,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      features: plan?.features || {},
      limits: plan?.limits || this.getDefaultLimits(),
    };
  }

  /**
   * Create a new subscription for a user
   * Uses admin client to bypass RLS for writes
   */
  async createSubscription(data: {
    userId: string;
    planId: string;
    status?: 'active' | 'trialing';
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    stripeSubscriptionId?: string;
    stripeCustomerId?: string;
    stripePriceId?: string;
    trialStart?: Date;
    trialEnd?: Date;
  }): Promise<UserSubscription> {
    const currentPeriodEnd = data.currentPeriodEnd || 
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Check if user already has a subscription (use anon client for read)
    const existing = await this.getUserSubscription(data.userId);

    if (existing) {
      const fromPlan = existing.planId;
      const action = data.planId === 'free' ? 'canceled' : 
        (fromPlan < data.planId ? 'upgraded' : 'downgraded');

      // Record history (use admin client for write)
      await this.addHistoryEntry({
        userId: data.userId,
        action,
        fromPlan,
        toPlan: data.planId,
        fromStatus: existing.status,
        toStatus: data.status || 'active',
      });

      // Update existing subscription (use admin client for write)
      const { data: updated, error } = await this.adminClient
        .from('user_subscriptions')
        .update({
          plan_id: data.planId,
          status: data.status || 'active',
          current_period_start: data.currentPeriodStart || new Date(),
          current_period_end: currentPeriodEnd,
          stripe_subscription_id: data.stripeSubscriptionId || null,
          stripe_customer_id: data.stripeCustomerId || null,
          stripe_price_id: data.stripePriceId || null,
          cancel_at_period_end: false,
          canceled_at: null,
          cancellation_reason: null,
          trial_start: data.trialStart || null,
          trial_end: data.trialEnd || null,
          updated_at: new Date(),
        })
        .eq('user_id', data.userId)
        .select()
        .single();

      if (error) {
        log.error('Failed to update subscription:', error);
        throw error;
      }

      return this.mapUserSubscriptionRow(updated);
    }

    // Create new subscription (use admin client for write)
    const { data: inserted, error } = await this.adminClient
      .from('user_subscriptions')
      .insert({
        user_id: data.userId,
        plan_id: data.planId,
        status: data.status || 'active',
        current_period_start: data.currentPeriodStart || new Date(),
        current_period_end: currentPeriodEnd,
        stripe_subscription_id: data.stripeSubscriptionId || null,
        stripe_customer_id: data.stripeCustomerId || null,
        stripe_price_id: data.stripePriceId || null,
        trial_start: data.trialStart || null,
        trial_end: data.trialEnd || null,
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to create subscription:', error);
      throw error;
    }

    // Record history (use admin client for write)
    await this.addHistoryEntry({
      userId: data.userId,
      action: 'created',
      fromPlan: null,
      toPlan: data.planId,
      fromStatus: null,
      toStatus: data.status || 'active',
    });

    return this.mapUserSubscriptionRow(inserted);
  }

  /**
   * Update user's subscription
   * Uses admin client to bypass RLS for writes
   */
  async updateSubscription(userId: string, data: {
    planId?: string;
    status?: 'active' | 'canceled' | 'expired' | 'past_due' | 'trialing';
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    stripeSubscriptionId?: string;
    stripeCustomerId?: string;
    stripePriceId?: string;
    cancelAtPeriodEnd?: boolean;
    canceledAt?: Date;
    cancellationReason?: string;
  }): Promise<UserSubscription | null> {
    const existing = await this.getUserSubscription(userId);

    if (!existing) {
      return null;
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (data.planId !== undefined) updateData.plan_id = data.planId;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.currentPeriodStart !== undefined) updateData.current_period_start = data.currentPeriodStart;
    if (data.currentPeriodEnd !== undefined) updateData.current_period_end = data.currentPeriodEnd;
    if (data.stripeSubscriptionId !== undefined) updateData.stripe_subscription_id = data.stripeSubscriptionId;
    if (data.stripeCustomerId !== undefined) updateData.stripe_customer_id = data.stripeCustomerId;
    if (data.stripePriceId !== undefined) updateData.stripe_price_id = data.stripePriceId;
    if (data.cancelAtPeriodEnd !== undefined) updateData.cancel_at_period_end = data.cancelAtPeriodEnd;
    if (data.canceledAt !== undefined) updateData.canceled_at = data.canceledAt;
    if (data.cancellationReason !== undefined) updateData.cancellation_reason = data.cancellationReason;

    // Use admin client for write
    const { data: updated, error } = await this.adminClient
      .from('user_subscriptions')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      log.error('Failed to update subscription:', error);
      throw error;
    }

    // Record history if plan changed (use admin client for write)
    if (data.planId && data.planId !== existing.planId) {
      await this.addHistoryEntry({
        userId,
        action: data.planId > existing.planId ? 'upgraded' : 'downgraded',
        fromPlan: existing.planId,
        toPlan: data.planId,
        fromStatus: existing.status,
        toStatus: data.status || existing.status,
      });
    }

    return this.mapUserSubscriptionRow(updated);
  }

  /**
   * Cancel user's subscription
   * Uses admin client to bypass RLS for writes
   */
  async cancelSubscription(userId: string, reason?: string): Promise<UserSubscription | null> {
    const existing = await this.getUserSubscription(userId);

    if (!existing) {
      return null;
    }

    // Use admin client for write
    const { data: updated, error } = await this.adminClient
      .from('user_subscriptions')
      .update({
        cancel_at_period_end: true,
        canceled_at: new Date(),
        cancellation_reason: reason || null,
        updated_at: new Date(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      log.error('Failed to cancel subscription:', error);
      throw error;
    }

    // Record history (use admin client for write)
    await this.addHistoryEntry({
      userId,
      action: 'canceled',
      fromPlan: existing.planId,
      toPlan: 'free',
      fromStatus: existing.status,
      toStatus: 'canceled',
      reason,
    });

    return this.mapUserSubscriptionRow(updated);
  }

  // ==================== Feature Usage ====================

  /**
   * Check if user has access to a feature
   * Uses anon client for reads
   */
  async checkFeatureAccess(userId: string, featureKey: string): Promise<FeatureAccessResult> {
    // Get user's plan
    const status = await this.getUserSubscriptionStatus(userId);
    const limits = status.limits;
    const limit = limits[featureKey] ?? 0;

    // Get current usage today (use anon client for read)
    const today = new Date().toISOString().split('T')[0];
    const { data: usageData, error } = await this.anonClient
      .from('feature_usage')
      .select('usage_count')
      .eq('user_id', userId)
      .eq('feature_key', featureKey)
      .eq('usage_date', today)
      .maybeSingle();

    if (error) {
      log.error('Failed to get feature usage:', error);
    }

    const currentUsage = usageData?.usage_count || 0;
    const hasAccess = limit === -1 || currentUsage < limit;
    const remaining = limit === -1 ? -1 : limit - currentUsage;

    return {
      hasAccess,
      limit,
      currentUsage,
      remaining,
      planId: status.planId,
    };
  }

  /**
   * Increment feature usage
   * Uses admin client to bypass RLS for writes
   */
  async incrementFeatureUsage(userId: string, featureKey: string, increment: number = 1): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    // Try to update existing record (use admin client for write)
    const { error: updateError } = await this.adminClient
      .rpc('increment_feature_usage', {
        p_user_id: userId,
        p_feature_key: featureKey,
        p_increment: increment,
      });

    if (updateError) {
      // If RPC doesn't exist, try direct upsert (use admin client for write)
      const { error: upsertError } = await this.adminClient
        .from('feature_usage')
        .upsert({
          user_id: userId,
          feature_key: featureKey,
          usage_date: today,
          usage_count: increment,
        }, {
          onConflict: 'user_id,feature_key,usage_date',
        });

      if (upsertError) {
        log.error('Failed to increment feature usage:', upsertError);
        throw upsertError;
      }
    }
  }

  /**
   * Get user's feature usage for today
   * Uses anon client for reads
   */
  async getFeatureUsage(userId: string, featureKey: string): Promise<FeatureUsage | null> {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await this.anonClient
      .from('feature_usage')
      .select('*')
      .eq('user_id', userId)
      .eq('feature_key', featureKey)
      .eq('usage_date', today)
      .maybeSingle();

    if (error) {
      log.error('Failed to get feature usage:', error);
      throw error;
    }

    return data ? this.mapFeatureUsageRow(data) : null;
  }

  // ==================== Subscription History ====================

  /**
   * Get subscription history for a user
   * Uses anon client for reads
   */
  async getSubscriptionHistory(userId: string, limit: number = 20): Promise<SubscriptionHistory[]> {
    const { data, error } = await this.anonClient
      .from('subscription_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      log.error('Failed to get subscription history:', error);
      throw error;
    }

    return (data || []).map(this.mapSubscriptionHistoryRow);
  }

  // ==================== Helper Methods ====================

  /**
   * Add a history entry
   * Uses admin client to bypass RLS for writes
   */
  private async addHistoryEntry(data: {
    userId: string;
    action: string;
    fromPlan: string | null;
    toPlan: string;
    fromStatus: string | null;
    toStatus: string;
    reason?: string;
  }): Promise<void> {
    const { error } = await this.adminClient
      .from('subscription_history')
      .insert({
        user_id: data.userId,
        action: data.action,
        from_plan: data.fromPlan,
        to_plan: data.toPlan,
        from_status: data.fromStatus,
        to_status: data.toStatus,
        reason: data.reason || null,
      });

    if (error) {
      log.error('Failed to add history entry:', error);
    }
  }

  private mapPlanRow(row: Record<string, unknown>): SubscriptionPlan {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | null,
      price: typeof row.price === 'string' ? parseFloat(row.price) : (row.price as number),
      currency: row.currency as string,
      billingInterval: row.billing_interval as 'month' | 'year' | 'one-time' | null,
      features: row.features as Record<string, unknown>,
      limits: row.limits as PlanLimits,
      stripePriceId: row.stripe_price_id as string | null,
      isActive: row.is_active as boolean,
      displayOrder: row.display_order as number,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapUserSubscriptionRow(row: Record<string, unknown>): UserSubscription {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      planId: row.plan_id as string,
      status: row.status as 'active' | 'canceled' | 'expired' | 'past_due' | 'trialing',
      currentPeriodStart: new Date(row.current_period_start as string),
      currentPeriodEnd: new Date(row.current_period_end as string),
      stripeSubscriptionId: row.stripe_subscription_id as string | null,
      stripeCustomerId: row.stripe_customer_id as string | null,
      stripePriceId: row.stripe_price_id as string | null,
      cancelAtPeriodEnd: row.cancel_at_period_end as boolean,
      canceledAt: row.canceled_at ? new Date(row.canceled_at as string) : null,
      cancellationReason: row.cancellation_reason as string | null,
      trialStart: row.trial_start ? new Date(row.trial_start as string) : null,
      trialEnd: row.trial_end ? new Date(row.trial_end as string) : null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapSubscriptionHistoryRow(row: Record<string, unknown>): SubscriptionHistory {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      action: row.action as 'created' | 'upgraded' | 'downgraded' | 'canceled' | 'renewed' | 'expired' | 'trial_started' | 'trial_ended',
      fromPlan: row.from_plan as string | null,
      toPlan: row.to_plan as string | null,
      fromStatus: row.from_status as string | null,
      toStatus: row.to_status as string | null,
      reason: row.reason as string | null,
      stripeEventId: row.stripe_event_id as string | null,
      metadata: row.metadata as Record<string, unknown>,
      createdAt: new Date(row.created_at as string),
    };
  }

  private mapFeatureUsageRow(row: Record<string, unknown>): FeatureUsage {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      featureKey: row.feature_key as string,
      usageDate: new Date(row.usage_date as string),
      usageCount: row.usage_count as number,
      metadata: row.metadata as Record<string, unknown>,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private getDefaultLimits(): PlanLimits {
    return {
      concurrentStrategies: 3,
      dailyBacktests: 10,
      dataRetention: 7,
      apiCalls: 100,
    };
  }
}

// Export singleton instance
let subscriptionDAO: SubscriptionDAO | null = null;

export function getSubscriptionDAO(): SubscriptionDAO {
  if (!subscriptionDAO) {
    subscriptionDAO = new SubscriptionDAO(getSupabaseClient(), getSupabaseAdminClient());
  }
  return subscriptionDAO;
}
