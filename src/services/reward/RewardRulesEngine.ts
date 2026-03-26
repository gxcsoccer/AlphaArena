/**
 * Reward Rules Engine
 * Configurable rules for referral rewards
 */

import { getSupabaseAdminClient } from '../../database/client';
import { createLogger } from '../../utils/logger';

const log = createLogger('RewardRulesEngine');

// ============================================
// Type Definitions
// ============================================

export type RewardType = 'vip_days' | 'points' | 'cash_voucher';
export type TriggerEvent = 'registration' | 'first_payment' | 'subscription' | 'trade';
export type RewardLevel = 'level_1' | 'level_2'; // Direct referral vs second level

export interface RewardRule {
  id: string;
  name: string;
  description: string;
  triggerEvent: TriggerEvent;
  rewardType: RewardType;
  rewardLevel: RewardLevel;
  referrerReward: {
    amount: number;
    type: RewardType;
    delayDays: number; // Days before reward is granted
  };
  inviteeReward: {
    amount: number;
    type: RewardType;
    immediate: boolean;
  };
  conditions: {
    minSubscriptionAmount?: number;
    requiredTradeCount?: number;
    paymentRequired?: boolean;
  };
  isActive: boolean;
  priority: number; // Higher priority rules take precedence
  validFrom: Date | null;
  validUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RewardCalculationResult {
  referrerReward: {
    amount: number;
    type: RewardType;
    delayDays: number;
  };
  inviteeReward: {
    amount: number;
    type: RewardType;
    immediate: boolean;
  };
  ruleId: string;
  ruleName: string;
}

export interface CreateRewardRuleInput {
  name: string;
  description?: string;
  triggerEvent: TriggerEvent;
  rewardType: RewardType;
  rewardLevel: RewardLevel;
  referrerReward: {
    amount: number;
    type: RewardType;
    delayDays?: number;
  };
  inviteeReward: {
    amount: number;
    type: RewardType;
    immediate?: boolean;
  };
  conditions?: {
    minSubscriptionAmount?: number;
    requiredTradeCount?: number;
    paymentRequired?: boolean;
  };
  priority?: number;
  validFrom?: Date;
  validUntil?: Date;
}

// ============================================
// Default Rules
// ============================================

const DEFAULT_RULES: CreateRewardRuleInput[] = [
  {
    name: 'registration_invitee_bonus',
    description: 'Invitee gets 7 days VIP Pro upon registration',
    triggerEvent: 'registration',
    rewardType: 'vip_days',
    rewardLevel: 'level_1',
    referrerReward: {
      amount: 0,
      type: 'vip_days',
      delayDays: 0,
    },
    inviteeReward: {
      amount: 7,
      type: 'vip_days',
      immediate: true,
    },
    priority: 10,
  },
  {
    name: 'activation_referrer_bonus',
    description: 'Referrer gets 30 days VIP when invitee activates (first payment/subscription)',
    triggerEvent: 'subscription',
    rewardType: 'vip_days',
    rewardLevel: 'level_1',
    referrerReward: {
      amount: 30,
      type: 'vip_days',
      delayDays: 0, // Immediate
    },
    inviteeReward: {
      amount: 0,
      type: 'vip_days',
      immediate: false,
    },
    conditions: {
      paymentRequired: true,
    },
    priority: 20,
  },
  {
    name: 'first_trade_bonus',
    description: 'Additional bonus when invitee completes first trade',
    triggerEvent: 'trade',
    rewardType: 'vip_days',
    rewardLevel: 'level_1',
    referrerReward: {
      amount: 7,
      type: 'vip_days',
      delayDays: 0,
    },
    inviteeReward: {
      amount: 7,
      type: 'vip_days',
      immediate: true,
    },
    conditions: {
      requiredTradeCount: 1,
    },
    priority: 15,
  },
];

// ============================================
// Rules Engine Class
// ============================================

export class RewardRulesEngine {
  private cache: Map<string, RewardRule> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes
  private lastCacheRefresh: number = 0;

  /**
   * Get all active reward rules
   */
  async getActiveRules(): Promise<RewardRule[]> {
    await this.refreshCacheIfNeeded();
    return Array.from(this.cache.values())
      .filter(rule => this.isRuleValid(rule))
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get rule by ID
   */
  async getRuleById(ruleId: string): Promise<RewardRule | null> {
    await this.refreshCacheIfNeeded();
    return this.cache.get(ruleId) || null;
  }

  /**
   * Calculate rewards for a trigger event
   */
  async calculateRewards(
    triggerEvent: TriggerEvent,
    context: {
      referrerUserId: string;
      inviteeUserId: string;
      rewardLevel?: RewardLevel;
      subscriptionAmount?: number;
      tradeCount?: number;
      hasPaid?: boolean;
    }
  ): Promise<RewardCalculationResult | null> {
    const rules = await this.getActiveRules();
    
    // Find matching rules
    const matchingRules = rules.filter(rule => {
      // Match trigger event
      if (rule.triggerEvent !== triggerEvent) return false;
      
      // Match reward level (if specified)
      if (context.rewardLevel && rule.rewardLevel !== context.rewardLevel) return false;
      
      // Check conditions
      if (rule.conditions) {
        if (rule.conditions.minSubscriptionAmount && 
            (!context.subscriptionAmount || context.subscriptionAmount < rule.conditions.minSubscriptionAmount)) {
          return false;
        }
        if (rule.conditions.requiredTradeCount && 
            (!context.tradeCount || context.tradeCount < rule.conditions.requiredTradeCount)) {
          return false;
        }
        if (rule.conditions.paymentRequired && !context.hasPaid) {
          return false;
        }
      }
      
      return true;
    });

    // Return highest priority matching rule
    const rule = matchingRules[0];
    if (!rule) {
      log.debug('No matching rule found for event:', { triggerEvent, context });
      return null;
    }

    return {
      referrerReward: rule.referrerReward,
      inviteeReward: rule.inviteeReward,
      ruleId: rule.id,
      ruleName: rule.name,
    };
  }

  /**
   * Create a new reward rule
   */
  async createRule(input: CreateRewardRuleInput): Promise<RewardRule> {
    const supabase = getSupabaseAdminClient();
    
    const { data, error } = await supabase
      .from('reward_rules')
      .insert({
        name: input.name,
        description: input.description || '',
        trigger_event: input.triggerEvent,
        reward_type: input.rewardType,
        reward_level: input.rewardLevel,
        referrer_reward: input.referrerReward,
        invitee_reward: input.inviteeReward,
        conditions: input.conditions || {},
        is_active: true,
        priority: input.priority || 0,
        valid_from: input.validFrom?.toISOString() || null,
        valid_until: input.validUntil?.toISOString() || null,
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to create reward rule:', error);
      throw error;
    }

    // Invalidate cache
    this.lastCacheRefresh = 0;
    
    return this.mapRuleRow(data);
  }

  /**
   * Update a reward rule
   */
  async updateRule(
    ruleId: string,
    updates: Partial<CreateRewardRuleInput> & { isActive?: boolean }
  ): Promise<RewardRule> {
    const supabase = getSupabaseAdminClient();
    
    const updateData: Record<string, unknown> = {};
    
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.triggerEvent !== undefined) updateData.trigger_event = updates.triggerEvent;
    if (updates.rewardType !== undefined) updateData.reward_type = updates.rewardType;
    if (updates.rewardLevel !== undefined) updateData.reward_level = updates.rewardLevel;
    if (updates.referrerReward !== undefined) updateData.referrer_reward = updates.referrerReward;
    if (updates.inviteeReward !== undefined) updateData.invitee_reward = updates.inviteeReward;
    if (updates.conditions !== undefined) updateData.conditions = updates.conditions;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.validFrom !== undefined) updateData.valid_from = updates.validFrom?.toISOString() || null;
    if (updates.validUntil !== undefined) updateData.valid_until = updates.validUntil?.toISOString() || null;

    const { data, error } = await supabase
      .from('reward_rules')
      .update(updateData)
      .eq('id', ruleId)
      .select()
      .single();

    if (error) {
      log.error('Failed to update reward rule:', error);
      throw error;
    }

    // Invalidate cache
    this.lastCacheRefresh = 0;
    
    return this.mapRuleRow(data);
  }

  /**
   * Delete a reward rule
   */
  async deleteRule(ruleId: string): Promise<void> {
    const supabase = getSupabaseAdminClient();
    
    const { error } = await supabase
      .from('reward_rules')
      .delete()
      .eq('id', ruleId);

    if (error) {
      log.error('Failed to delete reward rule:', error);
      throw error;
    }

    // Invalidate cache
    this.lastCacheRefresh = 0;
  }

  /**
   * Initialize default rules if none exist
   */
  async initializeDefaultRules(): Promise<void> {
    const supabase = getSupabaseAdminClient();
    
    const { count, error } = await supabase
      .from('reward_rules')
      .select('*', { count: 'exact', head: true });

    if (error) {
      log.error('Failed to check existing rules:', error);
      return;
    }

    if (count && count > 0) {
      log.debug('Reward rules already exist, skipping initialization');
      return;
    }

    log.info('Initializing default reward rules');
    
    for (const rule of DEFAULT_RULES) {
      try {
        await this.createRule(rule);
      } catch (err) {
        log.error('Failed to create default rule:', err);
      }
    }
  }

  // ============================================
  // Private Methods
  // ============================================

  private async refreshCacheIfNeeded(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCacheRefresh < this.cacheExpiry && this.cache.size > 0) {
      return;
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('reward_rules')
      .select('*')
      .eq('is_active', true);

    if (error) {
      log.error('Failed to fetch reward rules:', error);
      return;
    }

    this.cache.clear();
    for (const row of data || []) {
      this.cache.set(row.id, this.mapRuleRow(row));
    }
    this.lastCacheRefresh = now;
  }

  private isRuleValid(rule: RewardRule): boolean {
    const now = new Date();
    
    if (rule.validFrom && now < rule.validFrom) return false;
    if (rule.validUntil && now > rule.validUntil) return false;
    
    return rule.isActive;
  }

  private mapRuleRow(row: Record<string, unknown>): RewardRule {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      triggerEvent: row.trigger_event as TriggerEvent,
      rewardType: row.reward_type as RewardType,
      rewardLevel: row.reward_level as RewardLevel,
      referrerReward: row.referrer_reward as RewardRule['referrerReward'],
      inviteeReward: row.invitee_reward as RewardRule['inviteeReward'],
      conditions: (row.conditions as RewardRule['conditions']) || {},
      isActive: row.is_active as boolean,
      priority: (row.priority as number) || 0,
      validFrom: row.valid_from ? new Date(row.valid_from as string) : null,
      validUntil: row.valid_until ? new Date(row.valid_until as string) : null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// Singleton instance
let rewardRulesEngine: RewardRulesEngine | null = null;

export function getRewardRulesEngine(): RewardRulesEngine {
  if (!rewardRulesEngine) {
    rewardRulesEngine = new RewardRulesEngine();
  }
  return rewardRulesEngine;
}

export default RewardRulesEngine;