/**
 * Referral System DAO Tests
 */

import { ReferralDAO, getReferralDAO } from '../referral.dao';
import { getSupabaseClient, getSupabaseAdminClient } from '../client';

// Mock the Supabase client
jest.mock('../client', () => ({
  getSupabaseClient: jest.fn(),
  getSupabaseAdminClient: jest.fn(),
}));

describe('ReferralDAO', () => {
  let referralDAO: ReferralDAO;
  let mockAnonClient: any;
  let mockAdminClient: any;

  beforeEach(() => {
    // Create mock clients
    mockAnonClient = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(),
            maybeSingle: jest.fn(),
          })),
          maybeSingle: jest.fn(),
        })),
        rpc: jest.fn(),
      })),
      rpc: jest.fn(),
    };

    mockAdminClient = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(),
            maybeSingle: jest.fn(),
          })),
          maybeSingle: jest.fn(),
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(),
          })),
        })),
        update: jest.fn(() => ({
          eq: jest.fn(),
        })),
        rpc: jest.fn(),
      })),
      rpc: jest.fn(),
    };

    (getSupabaseClient as jest.Mock).mockReturnValue(mockAnonClient);
    (getSupabaseAdminClient as jest.Mock).mockReturnValue(mockAdminClient);

    referralDAO = new ReferralDAO(mockAnonClient, mockAdminClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrCreateReferralCode', () => {
    it('should call the RPC function to get or create a referral code', async () => {
      const userId = 'test-user-id';
      const codeId = 'test-code-id';

      mockAdminClient.rpc.mockResolvedValueOnce({ data: codeId, error: null });
      mockAdminClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: codeId,
                user_id: userId,
                code: 'ABC12345',
                total_referrals: 0,
                successful_referrals: 0,
                pending_rewards: 0,
                total_rewards_earned: 0,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      });

      const result = await referralDAO.getOrCreateReferralCode(userId);

      expect(mockAdminClient.rpc).toHaveBeenCalledWith('get_or_create_referral_code', {
        p_user_id: userId,
      });
      expect(result.code).toBe('ABC12345');
    });

    it('should throw an error if RPC fails', async () => {
      const userId = 'test-user-id';

      mockAdminClient.rpc.mockResolvedValueOnce({
        data: null,
        error: new Error('RPC failed'),
      });

      await expect(referralDAO.getOrCreateReferralCode(userId)).rejects.toThrow();
    });
  });

  describe('getReferralCodeByUserId', () => {
    it('should return referral code if found', async () => {
      const userId = 'test-user-id';
      const mockData = {
        id: 'code-id',
        user_id: userId,
        code: 'TESTCODE',
        total_referrals: 5,
        successful_referrals: 3,
        pending_rewards: 100,
        total_rewards_earned: 300,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockAnonClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      });

      const result = await referralDAO.getReferralCodeByUserId(userId);

      expect(result).not.toBeNull();
      expect(result?.code).toBe('TESTCODE');
      expect(result?.totalReferrals).toBe(5);
    });

    it('should return null if referral code not found', async () => {
      const userId = 'non-existent-user';

      mockAnonClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const result = await referralDAO.getReferralCodeByUserId(userId);

      expect(result).toBeNull();
    });
  });

  describe('createReferralInvite', () => {
    it('should create a referral invite', async () => {
      const referrerUserId = 'referrer-id';
      const mockResult = {
        success: true,
        referral_id: 'referral-id',
        invite_token: 'invite-token-uuid',
        referral_link: '/register?ref=invite-token-uuid',
      };

      mockAdminClient.rpc.mockResolvedValueOnce({ data: mockResult, error: null });

      const result = await referralDAO.createReferralInvite({ referrerUserId });

      expect(mockAdminClient.rpc).toHaveBeenCalledWith('create_referral_invite', {
        p_referrer_user_id: referrerUserId,
        p_invite_email: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('processReferralRegistration', () => {
    it('should process a referral registration', async () => {
      const data = {
        inviteToken: 'test-token',
        inviteeUserId: 'invitee-id',
        deviceFingerprint: 'fingerprint',
        ipAddress: '127.0.0.1',
      };
      const mockResult = {
        success: true,
        referral_id: 'referral-id',
        referrer_user_id: 'referrer-id',
        invitee_bonus: 50,
      };

      mockAdminClient.rpc.mockResolvedValueOnce({ data: mockResult, error: null });

      const result = await referralDAO.processReferralRegistration(data);

      expect(mockAdminClient.rpc).toHaveBeenCalledWith('process_referral_registration', {
        p_invite_token: data.inviteToken,
        p_invitee_user_id: data.inviteeUserId,
        p_device_fingerprint: data.deviceFingerprint,
        p_ip_address: data.ipAddress,
      });
      expect(result.success).toBe(true);
      expect(result.inviteeBonus).toBe(50);
    });

    it('should handle fraud detection', async () => {
      const data = {
        inviteToken: 'test-token',
        inviteeUserId: 'same-as-referrer',
        deviceFingerprint: null,
        ipAddress: null,
      };
      const mockResult = {
        success: false,
        error: 'FRAUD_DETECTED',
        message: 'Referral flagged for suspicious activity',
      };

      mockAdminClient.rpc.mockResolvedValueOnce({ data: mockResult, error: null });

      const result = await referralDAO.processReferralRegistration(data);

      expect(result.success).toBe(false);
      expect(result.error).toBe('FRAUD_DETECTED');
    });
  });

  describe('activateReferral', () => {
    it('should activate a referral', async () => {
      const inviteeUserId = 'invitee-id';
      const mockResult = {
        success: true,
        referral_id: 'referral-id',
        reward_amount: 100,
        reward_scheduled_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      mockAdminClient.rpc.mockResolvedValueOnce({ data: mockResult, error: null });

      const result = await referralDAO.activateReferral(inviteeUserId);

      expect(result.success).toBe(true);
      expect(result.rewardAmount).toBe(100);
    });

    it('should return error if no referral found', async () => {
      const inviteeUserId = 'user-without-referral';
      const mockResult = {
        success: false,
        error: 'NO_REFERRAL_FOUND',
      };

      mockAdminClient.rpc.mockResolvedValueOnce({ data: mockResult, error: null });

      const result = await referralDAO.activateReferral(inviteeUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('NO_REFERRAL_FOUND');
    });
  });

  describe('getReferralStats', () => {
    it('should return referral statistics', async () => {
      const userId = 'test-user-id';
      const mockResult = {
        has_code: true,
        referral_code: 'TESTCODE',
        total_referrals: 10,
        successful_referrals: 5,
        pending_rewards: 200,
        total_rewards_earned: 500,
        recent_referrals: [
          {
            id: 'ref-1',
            status: 'registered',
            invited_at: new Date().toISOString(),
            registered_at: new Date().toISOString(),
            activated_at: null,
          },
        ],
        earnings_summary: {
          pending: 200,
          processed: 500,
          total: 700,
        },
      };

      mockAnonClient.rpc.mockResolvedValueOnce({ data: mockResult, error: null });

      const result = await referralDAO.getReferralStats(userId);

      expect(result.hasCode).toBe(true);
      expect(result.referralCode).toBe('TESTCODE');
      expect(result.totalReferrals).toBe(10);
      expect(result.earningsSummary.total).toBe(700);
    });

    it('should return empty stats for user without referral code', async () => {
      const userId = 'user-without-code';
      const mockResult = {
        has_code: false,
        referral_code: null,
      };

      mockAnonClient.rpc.mockResolvedValueOnce({ data: mockResult, error: null });

      const result = await referralDAO.getReferralStats(userId);

      expect(result.hasCode).toBe(false);
      expect(result.referralCode).toBeNull();
    });
  });

  describe('getRewardsByUserId', () => {
    it('should return rewards list', async () => {
      const userId = 'test-user-id';
      const mockData = [
        {
          id: 'reward-1',
          user_id: userId,
          referral_id: 'ref-1',
          reward_type: 'referral_bonus',
          amount: 100,
          currency: 'CNY',
          source_user_id: 'invitee-id',
          status: 'processed',
          scheduled_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
          virtual_account_transaction_id: null,
          description: 'Referral bonus',
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      mockAnonClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              range: jest.fn().mockResolvedValue({
                data: mockData,
                error: null,
                count: 1,
              }),
            }),
          }),
        }),
      });

      const result = await referralDAO.getRewardsByUserId(userId);

      expect(result.rewards).toHaveLength(1);
      expect(result.rewards[0].amount).toBe(100);
      expect(result.total).toBe(1);
    });
  });

  describe('processPendingRewards', () => {
    it('should process pending rewards', async () => {
      mockAdminClient.rpc.mockResolvedValueOnce({ data: 5, error: null });

      const count = await referralDAO.processPendingRewards();

      expect(mockAdminClient.rpc).toHaveBeenCalledWith('process_pending_rewards');
      expect(count).toBe(5);
    });
  });
});

describe('getReferralDAO', () => {
  it('should return a singleton instance', () => {
    const instance1 = getReferralDAO();
    const instance2 = getReferralDAO();

    expect(instance1).toBe(instance2);
  });
});