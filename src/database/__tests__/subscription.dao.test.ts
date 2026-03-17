/**
 * Tests for Subscription DAO
 */

import { SubscriptionDAO } from '../subscription.dao';

// Mock Supabase client chain methods
const createMockChain = () => {
  const chain: any = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.limit = jest.fn(() => chain);
  chain.single = jest.fn(() => chain);
  chain.maybeSingle = jest.fn(() => chain);
  chain.insert = jest.fn(() => chain);
  chain.update = jest.fn(() => chain);
  chain.upsert = jest.fn(() => chain);
  chain.rpc = jest.fn(() => chain);
  return chain;
};

// Mock clients (anon for reads, admin for writes)
const mockAnonClient = {
  from: jest.fn(),
  rpc: jest.fn(),
};

const mockAdminClient = {
  from: jest.fn(),
  rpc: jest.fn(),
};

describe('SubscriptionDAO', () => {
  let dao: SubscriptionDAO;

  beforeEach(() => {
    jest.clearAllMocks();
    // Constructor now takes two clients: anon for reads, admin for writes
    dao = new SubscriptionDAO(mockAnonClient as any, mockAdminClient as any);
  });

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

      const chain = createMockChain();
      chain.order.mockResolvedValue({ data: mockPlans, error: null });
      mockAnonClient.from.mockReturnValue(chain);

      const result = await dao.getPlans();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('free');
      expect(result[1].id).toBe('pro');
    });

    it('should return empty array when no plans exist', async () => {
      const chain = createMockChain();
      chain.order.mockResolvedValue({ data: [], error: null });
      mockAnonClient.from.mockReturnValue(chain);

      const result = await dao.getPlans();

      expect(result).toHaveLength(0);
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

      const chain = createMockChain();
      chain.single.mockResolvedValue({ data: mockPlan, error: null });
      mockAnonClient.from.mockReturnValue(chain);

      const result = await dao.getPlanById('pro');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('pro');
      expect(result?.price).toBe(99);
    });

    it('should return null for non-existent plan', async () => {
      const chain = createMockChain();
      chain.single.mockResolvedValue({ 
        data: null, 
        error: { code: 'PGRST116' } 
      });
      mockAnonClient.from.mockReturnValue(chain);

      const result = await dao.getPlanById('nonexistent');

      expect(result).toBeNull();
    });
  });

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

      const chain = createMockChain();
      chain.maybeSingle.mockResolvedValue({ data: mockSubscription, error: null });
      mockAnonClient.from.mockReturnValue(chain);

      const result = await dao.getUserSubscription('user-1');

      expect(result).not.toBeNull();
      expect(result?.planId).toBe('pro');
      expect(result?.status).toBe('active');
    });

    it('should return null for user without subscription', async () => {
      const chain = createMockChain();
      chain.maybeSingle.mockResolvedValue({ data: null, error: null });
      mockAnonClient.from.mockReturnValue(chain);

      const result = await dao.getUserSubscription('user-without-sub');

      expect(result).toBeNull();
    });
  });

  describe('checkFeatureAccess', () => {
    it('should return access info for a feature', async () => {
      // Mock getUserSubscription (returns null)
      const chain1 = createMockChain();
      chain1.maybeSingle.mockResolvedValue({ data: null, error: null });

      // Mock getPlanById (returns free plan)
      const chain2 = createMockChain();
      chain2.single.mockResolvedValue({
        data: {
          id: 'free',
          name: 'Free',
          limits: { dailyBacktests: 10 },
          features: {},
        },
        error: null,
      });

      // Mock feature_usage query
      const chain3 = createMockChain();
      chain3.maybeSingle.mockResolvedValue({ 
        data: { usage_count: 3 }, 
        error: null 
      });

      mockAnonClient.from
        .mockReturnValueOnce(chain1)
        .mockReturnValueOnce(chain2)
        .mockReturnValueOnce(chain3);

      const result = await dao.checkFeatureAccess('user-1', 'dailyBacktests');

      expect(result.hasAccess).toBe(true);
      expect(result.limit).toBe(10);
      expect(result.currentUsage).toBe(3);
      expect(result.remaining).toBe(7);
    });

    it('should return no access when limit exceeded', async () => {
      // Mock getUserSubscription (returns null)
      const chain1 = createMockChain();
      chain1.maybeSingle.mockResolvedValue({ data: null, error: null });

      // Mock getPlanById (returns free plan)
      const chain2 = createMockChain();
      chain2.single.mockResolvedValue({
        data: {
          id: 'free',
          name: 'Free',
          limits: { dailyBacktests: 10 },
          features: {},
        },
        error: null,
      });

      // Mock feature_usage query with exceeded limit
      const chain3 = createMockChain();
      chain3.maybeSingle.mockResolvedValue({ 
        data: { usage_count: 10 }, 
        error: null 
      });

      mockAnonClient.from
        .mockReturnValueOnce(chain1)
        .mockReturnValueOnce(chain2)
        .mockReturnValueOnce(chain3);

      const result = await dao.checkFeatureAccess('user-1', 'dailyBacktests');

      expect(result.hasAccess).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

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

      const chain = createMockChain();
      chain.limit.mockResolvedValue({ data: mockHistory, error: null });
      mockAnonClient.from.mockReturnValue(chain);

      const result = await dao.getSubscriptionHistory('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('upgraded');
      expect(result[0].fromPlan).toBe('free');
      expect(result[0].toPlan).toBe('pro');
    });
  });

  describe('createSubscription', () => {
    it('should create a new subscription for new user', async () => {
      // Mock getUserSubscription (returns null) - uses anon client
      const chain1 = createMockChain();
      chain1.maybeSingle.mockResolvedValue({ data: null, error: null });

      // Mock insert - uses admin client
      const chain2 = createMockChain();
      chain2.single.mockResolvedValue({
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

      // Mock history insert - uses admin client
      const chain3 = createMockChain();
      chain3.insert.mockResolvedValue({ error: null });

      mockAnonClient.from.mockReturnValueOnce(chain1);
      mockAdminClient.from
        .mockReturnValueOnce(chain2)
        .mockReturnValueOnce(chain3);

      const result = await dao.createSubscription({
        userId: 'user-1',
        planId: 'pro',
      });

      expect(result.planId).toBe('pro');
      expect(result.status).toBe('active');
    });
  });
});
