/**
 * Tests for UserDashboardDAO
 */

import { UserDashboardDAO } from '../user-dashboard.dao';

// Mock Supabase client
jest.mock('../client', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: { code: 'PGRST116' } })),
          order: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    })),
  })),
}));

describe('UserDashboardDAO', () => {
  const testUserId = 'test-user-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserOverview', () => {
    it('should return user overview with demo data when no real data exists', async () => {
      const result = await UserDashboardDAO.getUserOverview(testUserId);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe(testUserId);
      expect(result?.totalAssets).toBeGreaterThan(0);
      expect(result?.equityCurve).toBeDefined();
      expect(result?.equityCurve.length).toBeGreaterThan(0);
    });
  });

  describe('getUserStrategies', () => {
    it('should return user strategies', async () => {
      const result = await UserDashboardDAO.getUserStrategies(testUserId);

      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('id');
        expect(result[0]).toHaveProperty('name');
        expect(result[0]).toHaveProperty('status');
        expect(result[0]).toHaveProperty('returnRate');
      }
    });

    it('should filter by status', async () => {
      const result = await UserDashboardDAO.getUserStrategies(testUserId, { status: 'active' });

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getUserTrades', () => {
    it('should return user trades with pagination info', async () => {
      const result = await UserDashboardDAO.getUserTrades(testUserId, { limit: 10 });

      expect(result).toHaveProperty('trades');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.trades)).toBe(true);
    });

    it('should filter by symbol', async () => {
      const result = await UserDashboardDAO.getUserTrades(testUserId, { symbol: 'BTC/USDT' });

      expect(result.trades.every(t => t.symbol === 'BTC/USDT')).toBe(true);
    });
  });

  describe('getUserPerformance', () => {
    it('should return performance metrics', async () => {
      const result = await UserDashboardDAO.getUserPerformance(testUserId);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe(testUserId);
      expect(result?.totalReturn).toBeDefined();
      expect(result?.winRate).toBeDefined();
      expect(result?.monthlyReturns).toBeDefined();
      expect(result?.assetDistribution).toBeDefined();
    });
  });
});
