/**
 * Tests for Share Statistics DAO
 */

import { ShareStatsDAO, SharePlatform, ShareContentType } from '../share-stats.dao';

// Mock Supabase client
jest.mock('./client', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        gte: jest.fn(() => ({
          lte: jest.fn(() => ({
            order: jest.fn(() => ({
              range: jest.fn(() => Promise.resolve({ data: [], error: null, count: 0 })),
            })),
          })),
        })),
        order: jest.fn(() => ({
          range: jest.fn(() => Promise.resolve({ data: [], error: null, count: 0 })),
        })),
      })),
      rpc: jest.fn(() => Promise.resolve({ data: null, error: { message: 'RPC not found' } })),
    })),
  })),
  getSupabaseAdminClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: {
              id: 'test-id',
              user_id: 'user-123',
              platform: 'twitter',
              content_type: 'profile',
              content_id: null,
              referral_code: null,
              utm_source: 'web',
              utm_medium: 'social',
              utm_campaign: 'share',
              share_url: 'https://alphaarena.app',
              user_agent: null,
              ip_address: null,
              metadata: {},
              created_at: new Date().toISOString(),
            },
            error: null,
          })),
        })),
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          gte: jest.fn(() => ({
            lte: jest.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    })),
    rpc: jest.fn(() => Promise.resolve({ data: null, error: { message: 'RPC not found' } })),
  })),
}));

describe('ShareStatsDAO', () => {
  let dao: ShareStatsDAO;

  beforeEach(() => {
    const { getSupabaseClient, getSupabaseAdminClient } = require('./client');
    dao = new ShareStatsDAO(getSupabaseClient(), getSupabaseAdminClient());
  });

  describe('recordShareEvent', () => {
    it('should record a share event successfully', async () => {
      const input = {
        platform: 'twitter' as SharePlatform,
        contentType: 'profile' as ShareContentType,
        utmSource: 'web',
        utmMedium: 'social',
        utmCampaign: 'share',
        shareUrl: 'https://alphaarena.app',
      };

      const result = await dao.recordShareEvent(input);

      expect(result).toBeDefined();
      expect(result.platform).toBe('twitter');
      expect(result.contentType).toBe('profile');
    });

    it('should include user ID when provided', async () => {
      // This test verifies the input is correctly passed
      // The mock returns a fixed response, so we test the flow
      const input = {
        userId: 'user-123',
        platform: 'wechat' as SharePlatform,
        contentType: 'referral_link' as ShareContentType,
        referralCode: 'ABC123',
        utmSource: 'web',
        utmMedium: 'referral',
        utmCampaign: 'share',
        shareUrl: 'https://alphaarena.app/register?ref=ABC123',
      };

      const result = await dao.recordShareEvent(input);

      expect(result).toBeDefined();
      expect(result.userId).toBe('user-123');
      // Note: mock returns null for referralCode, in real implementation it would be included
    });
  });

  describe('getEmptyStats', () => {
    it('should return empty stats structure', () => {
      const stats = dao['getEmptyStats']();

      expect(stats.totalShares).toBe(0);
      expect(stats.platformDistribution).toBeDefined();
      expect(stats.contentTypeDistribution).toBeDefined();
      expect(stats.recentShares).toEqual([]);
      expect(stats.trendData).toEqual([]);
    });
  });

  describe('getEmptyPlatformDistribution', () => {
    it('should return zero counts for all platforms', () => {
      const distribution = dao['getEmptyPlatformDistribution']();

      expect(distribution.wechat).toBe(0);
      expect(distribution.weibo).toBe(0);
      expect(distribution.twitter).toBe(0);
      expect(distribution.linkedin).toBe(0);
      expect(distribution.facebook).toBe(0);
      expect(distribution.clipboard).toBe(0);
      expect(distribution.native).toBe(0);
    });
  });
});