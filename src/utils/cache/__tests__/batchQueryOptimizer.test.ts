/**
 * Batch Query Optimizer Tests
 * 
 * Unit tests for batch query optimization utilities.
 * Integration tests should be used for testing actual database queries.
 */

import { BatchQueryOptimizer } from '../batchQueryOptimizer';

// Mock Supabase client
jest.mock('../../../database/client', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        in: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    })),
  })),
}));

describe('BatchQueryOptimizer', () => {
  describe('getTradesByStrategyIds', () => {
    it('should return empty map for empty input', async () => {
      const result = await BatchQueryOptimizer.getTradesByStrategyIds([]);
      expect(result.size).toBe(0);
    });

    it('should initialize strategies with empty arrays', async () => {
      const result = await BatchQueryOptimizer.getTradesByStrategyIds(['s1', 's2']);
      expect(result.size).toBe(2);
      expect(result.get('s1')).toEqual([]);
      expect(result.get('s2')).toEqual([]);
    });
  });

  describe('getStrategyStatsBatch', () => {
    it('should return empty map for empty input', async () => {
      const result = await BatchQueryOptimizer.getStrategyStatsBatch([]);
      expect(result.size).toBe(0);
    });

    it('should initialize strategies with zero stats', async () => {
      const result = await BatchQueryOptimizer.getStrategyStatsBatch(['s1']);
      expect(result.size).toBe(1);
      const stats = result.get('s1');
      expect(stats).toEqual({
        totalTrades: 0,
        totalVolume: 0,
        buyCount: 0,
        sellCount: 0,
      });
    });
  });

  describe('getUsersBatch', () => {
    it('should return empty map for empty input', async () => {
      const result = await BatchQueryOptimizer.getUsersBatch([]);
      expect(result.size).toBe(0);
    });
  });

  describe('getPortfoliosBatch', () => {
    it('should return empty map for empty input', async () => {
      const result = await BatchQueryOptimizer.getPortfoliosBatch([]);
      expect(result.size).toBe(0);
    });
  });

  describe('prefetchRelated', () => {
    it('should return empty map for empty input', async () => {
      const result = await BatchQueryOptimizer.prefetchRelated(
        [],
        'id',
        async () => new Map()
      );
      expect(result.size).toBe(0);
    });

    it('should extract IDs and call fetcher in batches', async () => {
      const items = [
        { id: '1', name: 'a' },
        { id: '2', name: 'b' },
        { id: '1', name: 'c' }, // duplicate ID
        { id: '3', name: 'd' },
      ];

      const fetcher = jest.fn().mockResolvedValue(new Map([
        ['1', { data: 'data1' }],
        ['2', { data: 'data2' }],
        ['3', { data: 'data3' }],
      ]));

      const result = await BatchQueryOptimizer.prefetchRelated(items, 'id', fetcher, 2);

      // Should dedupe IDs and batch fetch
      expect(fetcher).toHaveBeenCalledTimes(2); // 3 unique IDs / batch size 2 = 2 batches
      expect(result.size).toBe(3);
    });
  });
});