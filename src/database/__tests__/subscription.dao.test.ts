/**
 * Tests for Subscription DAO
 * VIP Subscription System - Data Access Layer Tests
 */

import { SubscriptionDAO } from '../subscription.dao';
import type { SupabaseClient } from '@supabase/supabase-js';

// Helper to create a mock query chain that returns a promise at the end
function createMockQueryBuilder() {
  const queryBuilder: any = {};
  
  // Chain methods that return the builder itself
  queryBuilder.select = jest.fn(() => queryBuilder);
  queryBuilder.eq = jest.fn(() => queryBuilder);
  queryBuilder.neq = jest.fn(() => queryBuilder);
  queryBuilder.in = jest.fn(() => queryBuilder);
  queryBuilder.order = jest.fn(() => queryBuilder);
  queryBuilder.limit = jest.fn(() => queryBuilder);
  queryBuilder.range = jest.fn(() => queryBuilder);
  queryBuilder.insert = jest.fn(() => queryBuilder);
  queryBuilder.update = jest.fn(() => queryBuilder);
  queryBuilder.upsert = jest.fn(() => queryBuilder);
  queryBuilder.delete = jest.fn(() => queryBuilder);
  
  // Terminal methods that return promises
  queryBuilder.single = jest.fn();
  queryBuilder.maybeSingle = jest.fn();
  
  return queryBuilder;
}

// Mock Supabase clients
const mockAnonClient: Partial<SupabaseClient> = {
  from: jest.fn(),
  rpc: jest.fn(),
};

const mockAdminClient: Partial<SupabaseClient> = {
  from: jest.fn(),
  rpc: jest.fn(),
};

describe('SubscriptionDAO', () => {
  let dao: SubscriptionDAO;

  beforeEach(() => {
    jest.clearAllMocks();
    dao = new SubscriptionDAO(
      mockAnonClient as SupabaseClient,
      mockAdminClient as SupabaseClient
    );
  });

  // ========================================
  // Subscription Plans
  // ========================================
  describe('getPlans', () => {
    it('should return all active subscription plans', async () => {
      const mockPlans = [
        {
          id: 'free',
          name: 'Free',
          description: 'Free plan',
          price: 0,
          currency: 'CNY',
          billing_interval: 'month',
          features: { basic: true },
          limits: { concurrentStrategies: 3 },
          stripe_price_id: null,
          is_active: true,
          display_order: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'pro',
          name: 'Pro',
          description: 'Pro plan',
          price: 99,
          currency: 'CNY',
          billing_interval: 'month',
          features: { advanced: true },
          limits: { concurrentStrategies: -1 },
          stripe_price_id: 'price_pro',
          is_active: true,
          display_order: 2,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const queryBuilder = createMockQueryBuilder();
      queryBuilder.order.mockResolvedValue({ data: mockPlans, error: null });
      (mockAnonClient.from as jest.Mock).mockReturnValue(queryBuilder);

      const result = await dao.getPlans();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('free');
      expect(result[1].id).toBe('pro');
    });

    it('should return empty array when no plans exist', async () => {
      const queryBuilder = createMockQueryBuilder();
      queryBuilder.order.mockResolvedValue({ data: [], error: null });
      (mockAnonClient.from as jest.Mock).mockReturnValue(queryBuilder);

      const result = await dao.getPlans();

      expect(result).toHaveLength(0);
    });

    it('should throw error on database failure', async () => {
      const queryBuilder = createMockQueryBuilder();
      queryBuilder.order.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      });
      (mockAnonClient.from as jest.Mock).mockReturnValue(queryBuilder);

      await expect(dao.getPlans()).rejects.toBeDefined();
    });
  });

  describe('getPlanById', () => {
    it('should return a specific plan by ID', async () => {
      const mockPlan = {
        id: 'pro',
        name: 'Pro',
        description: 'Pro plan',
        price: 99,
        currency: 'CNY',
        billing_interval: 'month',
        features: { advanced: true },
        limits: { concurrentStrategies: -1 },
        stripe_price_id: 'price_pro',
        is_active: true,
        display_order: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const queryBuilder = createMockQueryBuilder();
      queryBuilder.single.mockResolvedValue({ data: mockPlan, error: null });
      (mockAnonClient.from as jest.Mock).mockReturnValue(queryBuilder);

      const result = await dao.getPlanById('pro');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('pro');
      expect(result?.price).toBe(99);
    });

    it('should return null for non-existent plan', async () => {
      const queryBuilder = createMockQueryBuilder();
      queryBuilder.single.mockResolvedValue({ 
        data: null, 
        error: { code: 'PGRST116' } 
      });
      (mockAnonClient.from as jest.Mock).mockReturnValue(queryBuilder);

      const result = await dao.getPlanById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ========================================
  // User Subscriptions
  // ========================================
  describe('getUserSubscription', () => {
    it('should return user subscription', async () => {
      const mockSubscription = {
        id: 'sub-1',
        user_id: 'user-1',
        plan_id: 'pro',
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        stripe_subscription_id: 'stripe_sub_1',
        stripe_customer_id: 'stripe_cust_1',
        stripe_price_id: 'price_pro',
        cancel_at_period_end: false,
        canceled_at: null,
        cancellation_reason: null,
        trial_start: null,
        trial_end: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const queryBuilder = createMockQueryBuilder();
      queryBuilder.maybeSingle.mockResolvedValue({ data: mockSubscription, error: null });
      (mockAnonClient.from as jest.Mock).mockReturnValue(queryBuilder);

      const result = await dao.getUserSubscription('user-1');

      expect(result).not.toBeNull();
      expect(result?.planId).toBe('pro');
      expect(result?.status).toBe('active');
    });

    it('should return null for user without subscription', async () => {
      const queryBuilder = createMockQueryBuilder();
      queryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });
      (mockAnonClient.from as jest.Mock).mockReturnValue(queryBuilder);

      const result = await dao.getUserSubscription('user-without-sub');

      expect(result).toBeNull();
    });
  });

  describe('getUserSubscriptionStatus', () => {
    it('should return free plan status for user without subscription', async () => {
      // Mock getUserSubscription returning null
      const queryBuilder1 = createMockQueryBuilder();
      queryBuilder1.maybeSingle.mockResolvedValue({ data: null, error: null });
      
      // Mock getPlanById for free plan
      const queryBuilder2 = createMockQueryBuilder();
      queryBuilder2.single.mockResolvedValue({
        data: {
          id: 'free',
          name: 'Free',
          description: 'Free plan',
          price: 0,
          currency: 'CNY',
          billing_interval: 'month',
          features: { basic: true },
          limits: { concurrentStrategies: 3, dailyBacktests: 10 },
          stripe_price_id: null,
          is_active: true,
          display_order: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      (mockAnonClient.from as jest.Mock)
        .mockReturnValueOnce(queryBuilder1)
        .mockReturnValueOnce(queryBuilder2);

      const result = await dao.getUserSubscriptionStatus('user-1');

      expect(result.planId).toBe('free');
      expect(result.status).toBe('active');
    });
  });

  // ========================================
  // Feature Access
  // ========================================
  describe('checkFeatureAccess', () => {
    it('should return access info for a feature', async () => {
      // Mock getUserSubscriptionStatus
      const statusQueryBuilder = createMockQueryBuilder();
      statusQueryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });
      
      // Mock getPlanById for free plan
      const planQueryBuilder = createMockQueryBuilder();
      planQueryBuilder.single.mockResolvedValue({
        data: {
          id: 'free',
          name: 'Free',
          limits: { dailyBacktests: 10 },
          features: {},
        },
        error: null,
      });

      // Mock feature_usage query
      const usageQueryBuilder = createMockQueryBuilder();
      usageQueryBuilder.maybeSingle.mockResolvedValue({ 
        data: { usage_count: 3 }, 
        error: null 
      });

      (mockAnonClient.from as jest.Mock)
        .mockReturnValueOnce(statusQueryBuilder)  // getUserSubscription
        .mockReturnValueOnce(planQueryBuilder)     // getPlanById
        .mockReturnValueOnce(usageQueryBuilder);   // feature_usage

      const result = await dao.checkFeatureAccess('user-1', 'dailyBacktests');

      expect(result.hasAccess).toBe(true);
      expect(result.limit).toBe(10);
      expect(result.currentUsage).toBe(3);
      expect(result.remaining).toBe(7);
    });

    it('should return no access when limit exceeded', async () => {
      // Mock getUserSubscriptionStatus
      const statusQueryBuilder = createMockQueryBuilder();
      statusQueryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });
      
      // Mock getPlanById for free plan
      const planQueryBuilder = createMockQueryBuilder();
      planQueryBuilder.single.mockResolvedValue({
        data: {
          id: 'free',
          name: 'Free',
          limits: { dailyBacktests: 10 },
          features: {},
        },
        error: null,
      });

      // Mock feature_usage query with exceeded limit
      const usageQueryBuilder = createMockQueryBuilder();
      usageQueryBuilder.maybeSingle.mockResolvedValue({ 
        data: { usage_count: 10 }, 
        error: null 
      });

      (mockAnonClient.from as jest.Mock)
        .mockReturnValueOnce(statusQueryBuilder)
        .mockReturnValueOnce(planQueryBuilder)
        .mockReturnValueOnce(usageQueryBuilder);

      const result = await dao.checkFeatureAccess('user-1', 'dailyBacktests');

      expect(result.hasAccess).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should allow unlimited access for -1 limit', async () => {
      // Mock getUserSubscriptionStatus
      const statusQueryBuilder = createMockQueryBuilder();
      statusQueryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });
      
      // Mock getPlanById for enterprise plan (unlimited)
      const planQueryBuilder = createMockQueryBuilder();
      planQueryBuilder.single.mockResolvedValue({
        data: {
          id: 'enterprise',
          name: 'Enterprise',
          limits: { dailyBacktests: -1 },  // -1 means unlimited
          features: {},
        },
        error: null,
      });

      const usageQueryBuilder = createMockQueryBuilder();

      (mockAnonClient.from as jest.Mock)
        .mockReturnValueOnce(statusQueryBuilder)
        .mockReturnValueOnce(planQueryBuilder);

      const result = await dao.checkFeatureAccess('user-1', 'dailyBacktests');

      expect(result.hasAccess).toBe(true);
      expect(result.limit).toBe(-1);
      expect(result.remaining).toBe(-1);
    });
  });

  // ========================================
  // Subscription History
  // ========================================
  describe('getSubscriptionHistory', () => {
    it('should return subscription history', async () => {
      const mockHistory = [
        {
          id: 'hist-1',
          user_id: 'user-1',
          action: 'upgraded',
          from_plan: 'free',
          to_plan: 'pro',
          from_status: 'active',
          to_status: 'active',
          reason: null,
          stripe_event_id: null,
          metadata: {},
          created_at: new Date().toISOString(),
        },
      ];

      const queryBuilder = createMockQueryBuilder();
      queryBuilder.limit.mockResolvedValue({ data: mockHistory, error: null });
      (mockAnonClient.from as jest.Mock).mockReturnValue(queryBuilder);

      const result = await dao.getSubscriptionHistory('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('upgraded');
      expect(result[0].fromPlan).toBe('free');
      expect(result[0].toPlan).toBe('pro');
    });

    it('should return empty array when no history', async () => {
      const queryBuilder = createMockQueryBuilder();
      queryBuilder.limit.mockResolvedValue({ data: [], error: null });
      (mockAnonClient.from as jest.Mock).mockReturnValue(queryBuilder);

      const result = await dao.getSubscriptionHistory('user-1');

      expect(result).toHaveLength(0);
    });
  });

  // ========================================
  // Create/Update Subscription
  // ========================================
  describe('createSubscription', () => {
    it('should create a new subscription for new user', async () => {
      // Mock getUserSubscription (returns null)
      const queryBuilder1 = createMockQueryBuilder();
      queryBuilder1.maybeSingle.mockResolvedValue({ data: null, error: null });

      // Mock insert on admin client
      const queryBuilder2 = createMockQueryBuilder();
      queryBuilder2.single.mockResolvedValue({
        data: {
          id: 'sub-1',
          user_id: 'user-1',
          plan_id: 'pro',
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          stripe_subscription_id: null,
          stripe_customer_id: null,
          stripe_price_id: null,
          cancel_at_period_end: false,
          canceled_at: null,
          cancellation_reason: null,
          trial_start: null,
          trial_end: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      // Mock history insert
      const queryBuilder3 = createMockQueryBuilder();
      queryBuilder3.insert.mockResolvedValue({ error: null });

      (mockAnonClient.from as jest.Mock).mockReturnValueOnce(queryBuilder1);
      (mockAdminClient.from as jest.Mock)
        .mockReturnValueOnce(queryBuilder2)
        .mockReturnValueOnce(queryBuilder3);

      const result = await dao.createSubscription({
        userId: 'user-1',
        planId: 'pro',
      });

      expect(result.planId).toBe('pro');
      expect(result.status).toBe('active');
    });

    it('should update existing subscription for returning user', async () => {
      // Mock getUserSubscription (returns existing subscription)
      const queryBuilder1 = createMockQueryBuilder();
      queryBuilder1.maybeSingle.mockResolvedValue({ 
        data: {
          id: 'sub-old',
          user_id: 'user-1',
          plan_id: 'free',
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          cancel_at_period_end: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, 
        error: null 
      });

      // Mock history insert
      const queryBuilder2 = createMockQueryBuilder();
      queryBuilder2.insert.mockResolvedValue({ error: null });

      // Mock update on admin client
      const queryBuilder3 = createMockQueryBuilder();
      queryBuilder3.single.mockResolvedValue({
        data: {
          id: 'sub-old',
          user_id: 'user-1',
          plan_id: 'pro',
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          stripe_subscription_id: null,
          stripe_customer_id: null,
          stripe_price_id: null,
          cancel_at_period_end: false,
          canceled_at: null,
          cancellation_reason: null,
          trial_start: null,
          trial_end: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      (mockAnonClient.from as jest.Mock).mockReturnValueOnce(queryBuilder1);
      (mockAdminClient.from as jest.Mock)
        .mockReturnValueOnce(queryBuilder2)
        .mockReturnValueOnce(queryBuilder3);

      const result = await dao.createSubscription({
        userId: 'user-1',
        planId: 'pro',
      });

      expect(result.planId).toBe('pro');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel a subscription', async () => {
      // Mock getUserSubscription
      const queryBuilder1 = createMockQueryBuilder();
      queryBuilder1.maybeSingle.mockResolvedValue({ 
        data: {
          id: 'sub-1',
          user_id: 'user-1',
          plan_id: 'pro',
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          cancel_at_period_end: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, 
        error: null 
      });

      // Mock update on admin client
      const queryBuilder2 = createMockQueryBuilder();
      queryBuilder2.single.mockResolvedValue({
        data: {
          id: 'sub-1',
          user_id: 'user-1',
          plan_id: 'pro',
          status: 'active',
          cancel_at_period_end: true,
          canceled_at: new Date().toISOString(),
          cancellation_reason: 'User requested',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      // Mock history insert
      const queryBuilder3 = createMockQueryBuilder();
      queryBuilder3.insert.mockResolvedValue({ error: null });

      (mockAnonClient.from as jest.Mock).mockReturnValueOnce(queryBuilder1);
      (mockAdminClient.from as jest.Mock)
        .mockReturnValueOnce(queryBuilder2)
        .mockReturnValueOnce(queryBuilder3);

      const result = await dao.cancelSubscription('user-1', 'User requested');

      expect(result).not.toBeNull();
      expect(result?.cancelAtPeriodEnd).toBe(true);
    });

    it('should return null if no subscription exists', async () => {
      const queryBuilder = createMockQueryBuilder();
      queryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });
      (mockAnonClient.from as jest.Mock).mockReturnValue(queryBuilder);

      const result = await dao.cancelSubscription('user-without-sub');

      expect(result).toBeNull();
    });
  });

  // ========================================
  // Feature Usage
  // ========================================
  describe('incrementFeatureUsage', () => {
    it('should increment feature usage via RPC', async () => {
      (mockAdminClient.rpc as jest.Mock).mockResolvedValue({ error: null });

      await expect(
        dao.incrementFeatureUsage('user-1', 'dailyBacktests', 1)
      ).resolves.not.toThrow();
    });

    it('should fallback to upsert if RPC fails', async () => {
      (mockAdminClient.rpc as jest.Mock).mockResolvedValue({ 
        error: { message: 'RPC not found' } 
      });

      const queryBuilder = createMockQueryBuilder();
      queryBuilder.upsert.mockResolvedValue({ error: null });
      (mockAdminClient.from as jest.Mock).mockReturnValue(queryBuilder);

      await expect(
        dao.incrementFeatureUsage('user-1', 'dailyBacktests', 1)
      ).resolves.not.toThrow();
    });
  });
});