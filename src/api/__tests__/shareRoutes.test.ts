/**
 * Tests for Share Routes
 */

import request from 'supertest';
import express from 'express';
import shareRoutes from '../shareRoutes';

// Set required environment variables before importing routes
process.env.BASE_URL = 'https://alphaarena.app';

// Mock the DAOs
jest.mock('../../database/share-stats.dao', () => ({
  getShareStatsDAO: jest.fn(() => ({
    recordShareEvent: jest.fn().mockResolvedValue({
      id: 'test-event-id',
      userId: 'user-123',
      platform: 'twitter',
      contentType: 'profile',
      contentId: null,
      referralCode: null,
      utmSource: 'web',
      utmMedium: 'social',
      utmCampaign: 'share',
      shareUrl: 'https://alphaarena.app',
      userAgent: null,
      ipAddress: null,
      metadata: {},
      createdAt: new Date(),
    }),
    getGlobalStats: jest.fn().mockResolvedValue({
      totalShares: 100,
      platformDistribution: { twitter: 50, wechat: 30, weibo: 20 },
      contentTypeDistribution: { profile: 60, referral_link: 40 },
      recentShares: [],
      trendData: [],
    }),
    getUserStats: jest.fn().mockResolvedValue({
      userId: 'user-123',
      totalShares: 10,
      referralShares: 5,
      platformDistribution: { twitter: 6, wechat: 4 },
      topContentType: 'profile',
      sharesTrend: [],
    }),
    getPlatformDistribution: jest.fn().mockResolvedValue({
      twitter: 50,
      wechat: 30,
      weibo: 20,
    }),
    getShareCountByContent: jest.fn().mockResolvedValue(42),
    getConversionRate: jest.fn().mockResolvedValue({
      totalReferrals: 100,
      successfulReferrals: 25,
      conversionRate: 0.25,
      period: '30d',
    }),
  })),
}));

jest.mock('../../database/referral.dao', () => ({
  getReferralDAO: jest.fn(() => ({
    getOrCreateReferralCode: jest.fn().mockResolvedValue({
      id: 'code-123',
      userId: 'user-123',
      code: 'ABC123',
      totalReferrals: 5,
      successfulReferrals: 3,
      pendingRewards: 10,
      totalRewardsEarned: 50,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  })),
}));

// Mock auth middleware
jest.mock('../authMiddleware', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: 'user-123', email: 'test@example.com' };
    next();
  },
  optionalAuthMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: 'user-123', email: 'test@example.com' };
    next();
  },
  requireAdmin: (req: any, res: any, next: any) => {
    // For tests, mock as admin
    req.user = { id: 'admin-123', email: 'admin@example.com', role: 'admin' };
    next();
  },
}));

const app = express();
app.use(express.json());
app.use('/api/share', shareRoutes);

describe('Share Routes', () => {
  describe('POST /api/share/record', () => {
    it('should record a share event', async () => {
      const response = await request(app)
        .post('/api/share/record')
        .send({
          platform: 'twitter',
          contentType: 'profile',
          utmSource: 'web',
          utmMedium: 'social',
          utmCampaign: 'share',
          shareUrl: 'https://alphaarena.app',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('test-event-id');
    });

    it('should reject invalid platform', async () => {
      const response = await request(app)
        .post('/api/share/record')
        .send({
          platform: 'invalid_platform',
          contentType: 'profile',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid platform');
    });

    it('should reject invalid content type', async () => {
      const response = await request(app)
        .post('/api/share/record')
        .send({
          platform: 'twitter',
          contentType: 'invalid_type',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid content type');
    });
  });

  describe('POST /api/share/referral', () => {
    it('should create referral share', async () => {
      const response = await request(app)
        .post('/api/share/referral')
        .send({
          platform: 'wechat',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.referralCode).toBe('ABC123');
      expect(response.body.data.shareUrl).toContain('ref=ABC123');
    });
  });

  describe('GET /api/share/stats/me', () => {
    it('should return user share stats', async () => {
      const response = await request(app)
        .get('/api/share/stats/me');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalShares).toBe(10);
      expect(response.body.data.referralShares).toBe(5);
    });
  });

  describe('GET /api/share/platform-distribution', () => {
    it('should return platform distribution', async () => {
      const response = await request(app)
        .get('/api/share/platform-distribution');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.twitter).toBe(50);
      expect(response.body.data.wechat).toBe(30);
    });
  });

  describe('GET /api/share/content/:type/:id', () => {
    it('should return share count for content', async () => {
      const response = await request(app)
        .get('/api/share/content/profile/test-id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.count).toBe(42);
    });
  });

  describe('POST /api/share/generate-image', () => {
    it('should return image generation config', async () => {
      const response = await request(app)
        .post('/api/share/generate-image')
        .send({
          type: 'trade_result',
          data: {
            pair: 'BTC/USD',
            side: 'buy',
            profit: 100,
            percentage: 5.5,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.template).toBeDefined();
    });
  });

  describe('GET /api/share/stats', () => {
    it('should return global share stats for admin', async () => {
      const response = await request(app)
        .get('/api/share/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalShares).toBe(100);
    });
  });

  describe('GET /api/share/conversion-rate', () => {
    it('should return conversion rate for admin', async () => {
      const response = await request(app)
        .get('/api/share/conversion-rate');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});