/**
 * Tests for SubscriptionDAO
 */

import { SubscriptionDAO } from '../subscription.dao';
import { getSupabaseClient } from '../client';
import {
  SubscriptionPlan,
  SubscriptionStatus,
  UserSubscription,
  SubscriptionPlanConfig,
} from '../../types/subscription.types';

// Mock Supabase client
jest.mock('../client');
const mockSupabase = {
  from: jest.fn(),
  rpc: jest.fn(),
};

(getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

describe('SubscriptionDAO', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllPlans', () => {
    it('should return all active subscription plans', async () => {
      const mockPlans: SubscriptionPlanConfig[] = [
        {
          plan: 'free',
          name: 'Free',
          price_monthly: 0,
          price_yearly: 0,
          currency: 'USD',
          features: {},
          limits: { strategies: 1 },
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          plan: 'pro',
          name: 'Pro',
          price_monthly: 9.99,
          price_yearly: 99.99,
          currency: 'USD',
          features: {},
          limits: { strategies: 10 },
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockPlans,
              error: null,
            }),
          }),
        }),
      });

      const result = await SubscriptionDAO.getAllPlans();

      expect(result).toEqual(mockPlans);
      expect(mockSupabase.from).toHaveBeenCalledWith('subscription_plans');
    });

    it('should throw error when database query fails', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      });

      await expect(SubscriptionDAO.getAllPlans()).rejects.toThrow(
        'Failed to get subscription plans'
      );
    });
  });

  describe('getUserSubscription', () => {
    it('should return user subscription when exists', async () => {
      const userId = 'user-123';
      const mockSubscription: UserSubscription = {
        id: 'sub-123',
        user_id: userId,
        plan: 'pro',
        status: 'active',
        cancel_at_period_end: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: mockSubscription,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await SubscriptionDAO.getUserSubscription(userId);

      expect(result).toEqual(mockSubscription);
    });

    it('should return null when user has no subscription', async () => {
      const userId = 'user-123';

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await SubscriptionDAO.getUserSubscription(userId);

      expect(result).toBeNull();
    });
  });

  describe('upsertSubscription', () => {
    it('should create new subscription using RPC', async () => {
      const userId = 'user-123';
      const plan: SubscriptionPlan = 'pro';
      const subscriptionId = 'sub-123';

      const mockSubscription: UserSubscription = {
        id: subscriptionId,
        user_id: userId,
        plan: plan,
        status: 'active',
        cancel_at_period_end: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Mock RPC call
      mockSupabase.rpc.mockResolvedValue({
        data: subscriptionId,
        error: null,
      });

      // Mock fetch call
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSubscription,
              error: null,
            }),
          }),
        }),
      });

      const result = await SubscriptionDAO.upsertSubscription({
        user_id: userId,
        plan: plan,
      });

      expect(result).toEqual(mockSubscription);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('upsert_subscription', {
        p_user_id: userId,
        p_plan: plan,
        p_status: 'active',
        p_stripe_subscription_id: null,
        p_stripe_customer_id: null,
        p_billing_period: null,
        p_current_period_end: null,
        p_current_period_start: null,
        p_trial_end: null,
        p_trial_start: null,
      });
    });
  });

  describe('checkFeatureAccess', () => {
    it('should return true when user has access', async () => {
      const userId = 'user-123';
      const featureKey = 'advanced_charts';

      mockSupabase.rpc.mockResolvedValue({
        data: true,
        error: null,
      });

      const result = await SubscriptionDAO.checkFeatureAccess(userId, featureKey);

      expect(result).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('check_feature_access', {
        p_user_id: userId,
        p_feature_key: featureKey,
      });
    });

    it('should return false when user does not have access', async () => {
      const userId = 'user-123';
      const featureKey = 'api_advanced';

      mockSupabase.rpc.mockResolvedValue({
        data: false,
        error: null,
      });

      const result = await SubscriptionDAO.checkFeatureAccess(userId, featureKey);

      expect(result).toBe(false);
    });
  });

  describe('checkFeatureLimit', () => {
    it('should return usage info for feature', async () => {
      const userId = 'user-123';
      const featureKey = 'backtests_per_day';

      mockSupabase.rpc.mockResolvedValue({
        data: {
          allowed: true,
          current_usage: 10,
          limit: 50,
        },
        error: null,
      });

      const result = await SubscriptionDAO.checkFeatureLimit(userId, featureKey);

      expect(result).toEqual({
        allowed: true,
        current_usage: 10,
        limit: 50,
      });
    });

    it('should show when limit is exceeded', async () => {
      const userId = 'user-123';
      const featureKey = 'backtests_per_day';

      mockSupabase.rpc.mockResolvedValue({
        data: {
          allowed: false,
          current_usage: 50,
          limit: 50,
        },
        error: null,
      });

      const result = await SubscriptionDAO.checkFeatureLimit(userId, featureKey);

      expect(result.allowed).toBe(false);
      expect(result.current_usage).toBe(result.limit);
    });
  });

  describe('incrementFeatureUsage', () => {
    it('should increment feature usage and return new count', async () => {
      const userId = 'user-123';
      const featureKey = 'api_calls_per_day';

      mockSupabase.rpc.mockResolvedValue({
        data: 101,
        error: null,
      });

      const result = await SubscriptionDAO.incrementFeatureUsage(userId, featureKey);

      expect(result).toBe(101);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('increment_feature_usage', {
        p_user_id: userId,
        p_feature_key: featureKey,
        p_increment: 1,
      });
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription immediately', async () => {
      const userId = 'user-123';

      mockSupabase.rpc.mockResolvedValue({
        data: true,
        error: null,
      });

      const result = await SubscriptionDAO.cancelSubscription(userId, true);

      expect(result).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('cancel_subscription', {
        p_user_id: userId,
        p_immediately: true,
      });
    });

    it('should schedule cancellation at period end', async () => {
      const userId = 'user-123';

      mockSupabase.rpc.mockResolvedValue({
        data: true,
        error: null,
      });

      const result = await SubscriptionDAO.cancelSubscription(userId, false);

      expect(result).toBe(true);
    });
  });

  describe('getExpiringSubscriptions', () => {
    it('should return subscriptions expiring within specified days', async () => {
      const mockSubscriptions: UserSubscription[] = [
        {
          id: 'sub-1',
          user_id: 'user-1',
          plan: 'pro',
          status: 'active',
          cancel_at_period_end: false,
          current_period_end: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'sub-2',
          user_id: 'user-2',
          plan: 'enterprise',
          status: 'active',
          cancel_at_period_end: false,
          current_period_end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: mockSubscriptions,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const result = await SubscriptionDAO.getExpiringSubscriptions(7);

      expect(result).toEqual(mockSubscriptions);
    });
  });
});