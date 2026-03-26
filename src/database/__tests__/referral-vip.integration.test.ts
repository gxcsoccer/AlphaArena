/**
 * Integration tests for Referral-VIP integration
 * Tests the flow of referral rewards granting VIP days
 */

import { ReferralDAO } from '../referral.dao';
import { SubscriptionDAO } from '../subscription.dao';

// Mock the Supabase clients
jest.mock('../client', () => ({
  getSupabaseClient: jest.fn(),
  getSupabaseAdminClient: jest.fn(),
}));

describe('Referral-VIP Integration', () => {
  let referralDAO: ReferralDAO;
  let mockAnonClient: any;
  let mockAdminClient: any;

  beforeEach(() => {
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

    referralDAO = new ReferralDAO(mockAnonClient, mockAdminClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Process Referral Registration', () => {
    it('should return VIP days information when processing registration', async () => {
      const mockResult = {
        success: true,
        referral_id: 'referral-id',
        referrer_user_id: 'referrer-id',
        invitee_bonus: 7,
        invitee_bonus_type: 'vip_days',
        message: 'Referral registered successfully, granted 7 VIP days',
      };

      mockAdminClient.rpc.mockResolvedValueOnce({ data: mockResult, error: null });

      const result = await referralDAO.processReferralRegistration({
        inviteToken: 'test-token',
        inviteeUserId: 'invitee-id',
      });

      expect(result.success).toBe(true);
      expect(result.inviteeBonus).toBe(7);
      expect(result.inviteeBonusType).toBe('vip_days');
      expect(result.vipDaysGranted).toBe(7);
    });
  });

  describe('Activate Referral', () => {
    it('should return VIP days granted when activating referral', async () => {
      const mockResult = {
        success: true,
        referral_id: 'referral-id',
        reward_amount: 100,
        vip_days_granted: 30,
        message: 'Referral activated successfully, granted 30 VIP days to referrer',
      };

      mockAdminClient.rpc.mockResolvedValueOnce({ data: mockResult, error: null });

      const result = await referralDAO.activateReferral('invitee-id');

      expect(result.success).toBe(true);
      expect(result.vipDaysGranted).toBe(30);
      expect(result.rewardAmount).toBe(100);
    });
  });

  describe('Referral Stats', () => {
    it('should include VIP days earned in stats', async () => {
      const mockStats = {
        has_code: true,
        referral_code: 'TESTCODE',
        total_referrals: 10,
        successful_referrals: 5,
        pending_rewards: 200,
        total_rewards_earned: 500,
        recent_referrals: [],
        earnings_summary: {
          pending: 200,
          processed: 500,
          total: 700,
          vip_days_earned: 150,
        },
        reward_rules: {
          invitee_bonus_days: 7,
          referrer_bonus_days: 30,
          activation_criteria: 'First subscription or trade',
        },
      };

      mockAnonClient.rpc.mockResolvedValueOnce({ data: mockStats, error: null });

      const result = await referralDAO.getReferralStats('user-id');

      expect(result.hasCode).toBe(true);
      expect(result.earningsSummary.vipDaysEarned).toBe(150);
      expect(result.rewardRules?.inviteeBonusDays).toBe(7);
      expect(result.rewardRules?.referrerBonusDays).toBe(30);
    });
  });
});