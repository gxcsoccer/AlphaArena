/**
 * Tests for Reward Rules Engine
 */

import { RewardRulesEngine, getRewardRulesEngine } from '../RewardRulesEngine';
import { getSupabaseAdminClient } from '../../../database/client';

// Mock Supabase client
jest.mock('../../../database/client', () => ({
  getSupabaseAdminClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        data: [],
        error: null,
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: {
              id: 'test-rule-id',
              name: 'test_rule',
              description: 'Test rule',
              trigger_event: 'registration',
              reward_type: 'vip_days',
              reward_level: 'level_1',
              referrer_reward: { amount: 0, type: 'vip_days', delayDays: 0 },
              invitee_reward: { amount: 7, type: 'vip_days', immediate: true },
              conditions: {},
              is_active: true,
              priority: 10,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({
              data: null,
              error: null,
            })),
          })),
        })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({
          error: null,
        })),
      })),
    })),
    rpc: jest.fn(),
  })),
}));

describe('RewardRulesEngine', () => {
  let engine: RewardRulesEngine;

  beforeEach(() => {
    engine = new RewardRulesEngine();
    jest.clearAllMocks();
  });

  describe('calculateRewards', () => {
    it('should return null when no matching rules found', async () => {
      // Mock empty rules
      jest.spyOn(engine as any, 'refreshCacheIfNeeded').mockResolvedValue(undefined);
      (engine as any).cache = new Map();

      const result = await engine.calculateRewards('registration', {
        referrerUserId: 'user1',
        inviteeUserId: 'user2',
      });

      expect(result).toBeNull();
    });

    it('should match registration event and return invitee bonus', async () => {
      // Mock rules in cache
      const mockRule = {
        id: 'rule-1',
        name: 'registration_invitee_bonus',
        description: 'Test rule',
        triggerEvent: 'registration',
        rewardType: 'vip_days',
        rewardLevel: 'level_1',
        referrerReward: { amount: 0, type: 'vip_days', delayDays: 0 },
        inviteeReward: { amount: 7, type: 'vip_days', immediate: true },
        conditions: {},
        isActive: true,
        priority: 10,
        validFrom: null,
        validUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(engine as any, 'refreshCacheIfNeeded').mockResolvedValue(undefined);
      (engine as any).cache = new Map([['rule-1', mockRule]]);

      const result = await engine.calculateRewards('registration', {
        referrerUserId: 'user1',
        inviteeUserId: 'user2',
      });

      expect(result).not.toBeNull();
      expect(result?.ruleId).toBe('rule-1');
      expect(result?.inviteeReward.amount).toBe(7);
    });

    it('should respect priority order when multiple rules match', async () => {
      const lowPriorityRule = {
        id: 'rule-low',
        name: 'low_priority_rule',
        description: 'Low priority',
        triggerEvent: 'subscription' as const,
        rewardType: 'vip_days' as const,
        rewardLevel: 'level_1' as const,
        referrerReward: { amount: 10, type: 'vip_days', delayDays: 0 },
        inviteeReward: { amount: 0, type: 'vip_days', immediate: false },
        conditions: {},
        isActive: true,
        priority: 5,
        validFrom: null,
        validUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const highPriorityRule = {
        id: 'rule-high',
        name: 'high_priority_rule',
        description: 'High priority',
        triggerEvent: 'subscription' as const,
        rewardType: 'vip_days' as const,
        rewardLevel: 'level_1' as const,
        referrerReward: { amount: 30, type: 'vip_days', delayDays: 0 },
        inviteeReward: { amount: 0, type: 'vip_days', immediate: false },
        conditions: { paymentRequired: true },
        isActive: true,
        priority: 20,
        validFrom: null,
        validUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(engine as any, 'refreshCacheIfNeeded').mockResolvedValue(undefined);
      (engine as any).cache = new Map([
        ['rule-low', lowPriorityRule],
        ['rule-high', highPriorityRule],
      ]);

      const result = await engine.calculateRewards('subscription', {
        referrerUserId: 'user1',
        inviteeUserId: 'user2',
        hasPaid: true,
      });

      expect(result?.ruleId).toBe('rule-high');
      expect(result?.referrerReward.amount).toBe(30);
    });

    it('should filter rules by conditions', async () => {
      const ruleWithConditions = {
        id: 'rule-conditional',
        name: 'conditional_rule',
        description: 'Requires payment',
        triggerEvent: 'subscription' as const,
        rewardType: 'vip_days' as const,
        rewardLevel: 'level_1' as const,
        referrerReward: { amount: 30, type: 'vip_days', delayDays: 0 },
        inviteeReward: { amount: 0, type: 'vip_days', immediate: false },
        conditions: { paymentRequired: true },
        isActive: true,
        priority: 10,
        validFrom: null,
        validUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(engine as any, 'refreshCacheIfNeeded').mockResolvedValue(undefined);
      (engine as any).cache = new Map([['rule-conditional', ruleWithConditions]]);

      // Test without payment
      const resultWithoutPayment = await engine.calculateRewards('subscription', {
        referrerUserId: 'user1',
        inviteeUserId: 'user2',
        hasPaid: false,
      });

      expect(resultWithoutPayment).toBeNull();

      // Test with payment
      const resultWithPayment = await engine.calculateRewards('subscription', {
        referrerUserId: 'user1',
        inviteeUserId: 'user2',
        hasPaid: true,
      });

      expect(resultWithPayment).not.toBeNull();
      expect(resultWithPayment?.ruleId).toBe('rule-conditional');
    });
  });

  describe('isRuleValid', () => {
    it('should return false for expired rules', () => {
      const expiredRule = {
        id: 'rule-expired',
        name: 'expired_rule',
        description: 'Expired',
        triggerEvent: 'registration' as const,
        rewardType: 'vip_days' as const,
        rewardLevel: 'level_1' as const,
        referrerReward: { amount: 0, type: 'vip_days', delayDays: 0 },
        inviteeReward: { amount: 7, type: 'vip_days', immediate: true },
        conditions: {},
        isActive: true,
        priority: 10,
        validFrom: null,
        validUntil: new Date(Date.now() - 1000 * 60 * 60 * 24), // Yesterday
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const isValid = (engine as any).isRuleValid(expiredRule);
      expect(isValid).toBe(false);
    });

    it('should return false for future rules', () => {
      const futureRule = {
        id: 'rule-future',
        name: 'future_rule',
        description: 'Future',
        triggerEvent: 'registration' as const,
        rewardType: 'vip_days' as const,
        rewardLevel: 'level_1' as const,
        referrerReward: { amount: 0, type: 'vip_days', delayDays: 0 },
        inviteeReward: { amount: 7, type: 'vip_days', immediate: true },
        conditions: {},
        isActive: true,
        priority: 10,
        validFrom: new Date(Date.now() + 1000 * 60 * 60 * 24), // Tomorrow
        validUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const isValid = (engine as any).isRuleValid(futureRule);
      expect(isValid).toBe(false);
    });

    it('should return false for inactive rules', () => {
      const inactiveRule = {
        id: 'rule-inactive',
        name: 'inactive_rule',
        description: 'Inactive',
        triggerEvent: 'registration' as const,
        rewardType: 'vip_days' as const,
        rewardLevel: 'level_1' as const,
        referrerReward: { amount: 0, type: 'vip_days', delayDays: 0 },
        inviteeReward: { amount: 7, type: 'vip_days', immediate: true },
        conditions: {},
        isActive: false,
        priority: 10,
        validFrom: null,
        validUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const isValid = (engine as any).isRuleValid(inactiveRule);
      expect(isValid).toBe(false);
    });
  });
});

describe('getRewardRulesEngine', () => {
  it('should return a singleton instance', () => {
    const instance1 = getRewardRulesEngine();
    const instance2 = getRewardRulesEngine();
    expect(instance1).toBe(instance2);
  });
});