/**
 * Tests for Reward Service
 */

import { RewardService, getRewardService } from '../RewardService';

// Helper to create chainable mock
const createChainableMock = () => {
  const mock: any = {
    data: [],
    error: null,
  };
  mock.select = jest.fn(() => mock);
  mock.eq = jest.fn(() => mock);
  mock.not = jest.fn(() => mock);
  mock.lte = jest.fn(() => mock);
  mock.lt = jest.fn(() => mock);
  mock.order = jest.fn(() => mock);
  mock.limit = jest.fn(() => mock);
  mock.maybeSingle = jest.fn(() => Promise.resolve({ data: null, error: null }));
  mock.single = jest.fn(() => Promise.resolve({ data: null, error: null }));
  mock.insert = jest.fn(() => mock);
  mock.update = jest.fn(() => mock);
  return mock;
};

// Mock dependencies
jest.mock('../../../database/client', () => ({
  getSupabaseAdminClient: jest.fn(() => ({
    from: jest.fn(() => createChainableMock()),
    rpc: jest.fn(() => Promise.resolve({ data: { success: true }, error: null })),
  })),
}));

jest.mock('../../../database/referral.dao', () => ({
  getReferralDAO: jest.fn(() => ({
    getReferralsByReferrerUserId: jest.fn(() => Promise.resolve({
      referrals: [],
      total: 0,
    })),
    getRewardsByUserId: jest.fn(() => Promise.resolve({
      rewards: [],
      total: 0,
    })),
  })),
}));

jest.mock('../RewardRulesEngine', () => ({
  getRewardRulesEngine: jest.fn(() => ({
    calculateRewards: jest.fn(() => Promise.resolve({
      referrerReward: { amount: 30, type: 'vip_days', delayDays: 0 },
      inviteeReward: { amount: 7, type: 'vip_days', immediate: true },
      ruleId: 'test-rule',
      ruleName: 'test_rule',
    })),
    getRuleById: jest.fn(() => Promise.resolve({
      id: 'test-rule',
      name: 'test_rule',
    })),
  })),
}));

jest.mock('../AntiFraudService', () => ({
  getAntiFraudService: jest.fn(() => ({
    checkForFraud: jest.fn(() => Promise.resolve({
      isFraud: false,
      riskScore: 0,
      flags: [],
      recommendation: 'allow',
    })),
    recordFraudFlag: jest.fn(),
  })),
}));

jest.mock('../RewardNotificationService', () => ({
  getRewardNotificationService: jest.fn(() => ({
    notifyRewardEarned: jest.fn(),
    notifyRewardPending: jest.fn(),
    notifyRewardProcessed: jest.fn(),
    sendNotification: jest.fn(),
  })),
}));

describe('RewardService', () => {
  let service: RewardService;

  beforeEach(() => {
    service = new RewardService();
    jest.clearAllMocks();
  });

  describe('processReward', () => {
    it('should pass fraud check for clean referrals', async () => {
      const result = await service.processReward({
        triggerEvent: 'registration',
        referrerUserId: 'user-1',
        inviteeUserId: 'user-2',
        referralId: 'referral-1',
        context: {
          deviceFingerprint: 'device-new',
          ipAddress: '192.168.1.2',
        },
      });

      // Should pass fraud check
      expect(result.fraudCheck?.recommendation).toBe('allow');
      expect(result.fraudCheck?.isFraud).toBe(false);
    });
  });

  describe('getRewardHistory', () => {
    it('should return empty history for new user', async () => {
      const { rewards, total } = await service.getRewardHistory({
        userId: 'new-user',
      });

      expect(rewards).toEqual([]);
      expect(total).toBe(0);
    });
  });

  describe('getRewardStats', () => {
    it('should return stats with zero values for new user', async () => {
      const stats = await service.getRewardStats('new-user');

      expect(stats.totalEarned).toBe(0);
      expect(stats.totalVipDays).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.processed).toBe(0);
    });
  });

  describe('processPendingRewards', () => {
    it('should process pending rewards', async () => {
      const result = await service.processPendingRewards();

      expect(result).toHaveProperty('processed');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('total');
    });
  });

  describe('retryFailedRewards', () => {
    it('should retry failed rewards', async () => {
      const result = await service.retryFailedRewards();

      expect(result).toHaveProperty('retried');
      expect(result).toHaveProperty('succeeded');
      expect(result).toHaveProperty('failed');
    });
  });
});

describe('getRewardService', () => {
  it('should return a singleton instance', () => {
    const instance1 = getRewardService();
    const instance2 = getRewardService();
    expect(instance1).toBe(instance2);
  });
});