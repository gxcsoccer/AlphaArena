/**
 * Revenue DAO Tests
 */

import { RevenueDAO } from '../revenue.dao';

// Mock Supabase client
jest.mock('../client', () => ({
  getSupabaseAdminClient: jest.fn(() => {
    const mockChain = {
      select: jest.fn(() => mockChain),
      eq: jest.fn(() => mockChain),
      in: jest.fn(() => mockChain),
      neq: jest.fn(() => mockChain),
      gte: jest.fn(() => mockChain),
      lte: jest.fn(() => mockChain),
      lt: jest.fn(() => mockChain),
      order: jest.fn(() => mockChain),
      limit: jest.fn(() => mockChain),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    
    return {
      from: jest.fn(() => mockChain),
    };
  }),
}));

describe('RevenueDAO', () => {
  let dao: RevenueDAO;

  beforeEach(() => {
    jest.clearAllMocks();
    const { getSupabaseAdminClient } = require('../client');
    const mockClient = getSupabaseAdminClient();
    dao = new RevenueDAO(mockClient);
  });

  describe('constructor', () => {
    it('should create instance', () => {
      expect(dao).toBeDefined();
    });
  });

  describe('getRevenueMetrics', () => {
    it('should return metrics object with all required properties', async () => {
      const result = await dao.getRevenueMetrics();
      
      expect(result).toHaveProperty('mrr');
      expect(result).toHaveProperty('arr');
      expect(result).toHaveProperty('arpu');
      expect(result).toHaveProperty('totalRevenue');
      expect(result).toHaveProperty('activeSubscribers');
      expect(result).toHaveProperty('trialUsers');
      expect(result).toHaveProperty('churnRate');
      expect(result).toHaveProperty('ltv');
      expect(result).toHaveProperty('conversionRate');
      
      // When no data, metrics should be 0
      expect(result.mrr).toBe(0);
      expect(result.arr).toBe(0);
      expect(result.totalRevenue).toBe(0);
      expect(result.activeSubscribers).toBe(0);
    });
  });

  describe('getRevenueTrend', () => {
    it('should return array of trends', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-07');
      const result = await dao.getRevenueTrend({ startDate, endDate }, 'day');
      
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getSubscriptionDistribution', () => {
    it('should return distribution array', async () => {
      const result = await dao.getSubscriptionDistribution();
      
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getConversionFunnel', () => {
    it('should return funnel stages', async () => {
      const result = await dao.getConversionFunnel();
      
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getChurnAnalysis', () => {
    it('should return churn data for requested months', async () => {
      const result = await dao.getChurnAnalysis(3);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
    });
  });
});