/**
 * Referral Routes Tests
 */

import request from 'supertest';
import express, { Express } from 'express';
import referralRoutes from '../referralRoutes';
import { getReferralDAO } from '../../database/referral.dao';

// Mock dependencies
jest.mock('../../database/referral.dao');
jest.mock('../authMiddleware', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    // Check for test header to simulate unauthenticated user
    if (req.headers['x-test-unauthenticated']) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  },
}));

const mockReferralDAO = {
  getOrCreateReferralCode: jest.fn(),
  getReferralCodeByUserId: jest.fn(),
  getReferralCodeByCode: jest.fn(),
  getReferralStats: jest.fn(),
  createReferralInvite: jest.fn(),
  getReferralsByReferrerUserId: jest.fn(),
  getRewardsByUserId: jest.fn(),
  getReferralByInviteToken: jest.fn(),
  getReferralByInviteeUserId: jest.fn(),
  activateReferral: jest.fn(),
  processPendingRewards: jest.fn(),
};

(getReferralDAO as jest.Mock).mockReturnValue(mockReferralDAO);

describe('Referral Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/referral', referralRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/referral/code', () => {
    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .get('/api/referral/code')
        .set('x-test-unauthenticated', 'true');

      expect(response.status).toBe(401);
    });

    it('should return referral code for authenticated user', async () => {
      mockReferralDAO.getOrCreateReferralCode.mockResolvedValue({
        id: 'code-id',
        userId: 'test-user-id',
        code: 'ABC12345',
        totalReferrals: 0,
        successfulReferrals: 0,
        pendingRewards: 0,
        totalRewardsEarned: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app).get('/api/referral/code');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.code).toBe('ABC12345');
      expect(response.body.data.referralLink).toContain('ABC12345');
    });
  });

  describe('GET /api/referral/stats', () => {
    it('should return referral statistics', async () => {
      mockReferralDAO.getReferralStats.mockResolvedValue({
        hasCode: true,
        referralCode: 'ABC12345',
        totalReferrals: 10,
        successfulReferrals: 5,
        pendingRewards: 200,
        totalRewardsEarned: 500,
        recentReferrals: [],
        earningsSummary: {
          pending: 200,
          processed: 500,
          total: 700,
        },
      });

      const response = await request(app).get('/api/referral/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalReferrals).toBe(10);
      expect(response.body.data.earningsSummary.total).toBe(700);
    });
  });

  describe('POST /api/referral/invite', () => {
    it('should create a referral invite', async () => {
      mockReferralDAO.createReferralInvite.mockResolvedValue({
        success: true,
        referralId: 'referral-id',
        inviteToken: 'invite-token-uuid',
        referralLink: '/register?ref=invite-token-uuid',
      });

      const response = await request(app)
        .post('/api/referral/invite')
        .send({ inviteEmail: 'friend@example.com' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.inviteToken).toBe('invite-token-uuid');
    });

    it('should return 400 if invite creation fails', async () => {
      mockReferralDAO.createReferralInvite.mockResolvedValue({
        success: false,
        error: 'MAX_INVITES_REACHED',
      });

      const response = await request(app)
        .post('/api/referral/invite')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/referral/referrals', () => {
    it('should return referrals list', async () => {
      mockReferralDAO.getReferralsByReferrerUserId.mockResolvedValue({
        referrals: [
          {
            id: 'ref-1',
            status: 'registered',
            inviteEmail: 'friend@example.com',
            invitedAt: new Date(),
            registeredAt: new Date(),
            activatedAt: null,
          },
        ],
        total: 1,
      });

      const response = await request(app).get('/api/referral/referrals');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.referrals).toHaveLength(1);
      expect(response.body.data.total).toBe(1);
    });
  });

  describe('GET /api/referral/rewards', () => {
    it('should return rewards list', async () => {
      mockReferralDAO.getRewardsByUserId.mockResolvedValue({
        rewards: [
          {
            id: 'reward-1',
            type: 'referral_bonus',
            amount: 100,
            currency: 'CNY',
            status: 'processed',
            description: 'Referral bonus',
            scheduledAt: new Date(),
            processedAt: new Date(),
            createdAt: new Date(),
          },
        ],
        total: 1,
      });

      const response = await request(app).get('/api/referral/rewards');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.rewards).toHaveLength(1);
    });
  });

  describe('GET /api/referral/validate/:token', () => {
    it('should validate a valid invite token', async () => {
      mockReferralDAO.getReferralByInviteToken.mockResolvedValue({
        id: 'ref-1',
        referrerCodeId: 'code-id',
        referrerUserId: 'referrer-id',
        inviteeUserId: null,
        inviteEmail: null,
        inviteToken: 'valid-token-uuid',
        status: 'pending',
        inviteeDeviceFingerprint: null,
        inviteeIpAddress: null,
        invitedAt: new Date(),
        registeredAt: null,
        activatedAt: null,
        rewardScheduledAt: null,
        rewardProcessedAt: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app).get('/api/referral/validate/valid-token-uuid');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
    });

    it('should validate a referral code', async () => {
      mockReferralDAO.getReferralByInviteToken.mockResolvedValue(null);
      mockReferralDAO.getReferralCodeByCode.mockResolvedValue({
        id: 'code-id',
        userId: 'referrer-id',
        code: 'VALIDCODE',
        totalReferrals: 0,
        successfulReferrals: 0,
        pendingRewards: 0,
        totalRewardsEarned: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app).get('/api/referral/validate/VALIDCODE');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('code');
    });

    it('should return 404 for invalid token', async () => {
      mockReferralDAO.getReferralByInviteToken.mockResolvedValue(null);
      mockReferralDAO.getReferralCodeByCode.mockResolvedValue(null);

      const response = await request(app).get('/api/referral/validate/invalid-token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for already used referral', async () => {
      mockReferralDAO.getReferralByInviteToken.mockResolvedValue({
        id: 'ref-1',
        referrerCodeId: 'code-id',
        referrerUserId: 'referrer-id',
        inviteeUserId: 'already-registered-user',
        inviteEmail: null,
        inviteToken: 'used-token-uuid',
        status: 'registered',
        inviteeDeviceFingerprint: null,
        inviteeIpAddress: null,
        invitedAt: new Date(),
        registeredAt: new Date(),
        activatedAt: null,
        rewardScheduledAt: null,
        rewardProcessedAt: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app).get('/api/referral/validate/used-token-uuid');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already been used');
    });
  });

  describe('POST /api/referral/activate', () => {
    it('should activate a referral', async () => {
      mockReferralDAO.getReferralByInviteeUserId.mockResolvedValue({
        id: 'ref-1',
        referrerCodeId: 'code-id',
        referrerUserId: 'referrer-id',
        inviteeUserId: 'test-user-id',
        inviteEmail: null,
        inviteToken: 'token-uuid',
        status: 'registered',
        inviteeDeviceFingerprint: null,
        inviteeIpAddress: null,
        invitedAt: new Date(),
        registeredAt: new Date(),
        activatedAt: null,
        rewardScheduledAt: null,
        rewardProcessedAt: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockReferralDAO.activateReferral.mockResolvedValue({
        success: true,
        referralId: 'ref-1',
        rewardAmount: 100,
        rewardScheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const response = await request(app).post('/api/referral/activate');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.rewardAmount).toBe(100);
    });

    it('should return 404 if user has no referral', async () => {
      mockReferralDAO.getReferralByInviteeUserId.mockResolvedValue(null);

      const response = await request(app).post('/api/referral/activate');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('No referral found');
    });
  });

  describe('POST /api/referral/process-rewards', () => {
    it('should process pending rewards with valid auth', async () => {
      process.env.CRON_SECRET = 'test-secret';

      mockReferralDAO.processPendingRewards.mockResolvedValue(5);

      const response = await request(app)
        .post('/api/referral/process-rewards')
        .set('Authorization', 'Bearer test-secret');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.processedCount).toBe(5);

      delete process.env.CRON_SECRET;
    });

    it('should return 401 without valid auth', async () => {
      const response = await request(app)
        .post('/api/referral/process-rewards')
        .set('Authorization', 'Bearer invalid-secret');

      expect(response.status).toBe(401);
    });
  });
});