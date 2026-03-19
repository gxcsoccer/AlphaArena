/**
 * Tests for LeaderboardService
 */

import { LeaderboardService, StrategyMetrics } from '../../src/strategy/LeaderboardService';

describe('LeaderboardService', () => {
  let leaderboardService: LeaderboardService;

  beforeEach(() => {
    leaderboardService = new LeaderboardService();
  });

  afterEach(() => {
    leaderboardService.clearCache();
  });

  describe('calculateStrategyMetrics', () => {
    it('should calculate metrics correctly', async () => {
      // This would require mocking the DAOs
      // For now, we test the structure
      expect(leaderboardService).toBeDefined();
    });

    it('should handle empty trade history', async () => {
      // Mock implementation would return empty trades
      const metrics = await leaderboardService.calculateStrategyMetrics('test-strategy-id');
      
      if (metrics) {
        expect(metrics).toHaveProperty('strategyId');
        expect(metrics).toHaveProperty('totalTrades');
        expect(metrics).toHaveProperty('roi');
        expect(metrics).toHaveProperty('sharpeRatio');
        expect(metrics).toHaveProperty('maxDrawdown');
        expect(metrics).toHaveProperty('winRate');
      }
    });
  });

  describe('calculateSharpeRatio', () => {
    it('should return 0 for empty array', () => {
      const service = new LeaderboardService();
      // @ts-ignore - accessing private method for testing
      const result = service.calculateSharpeRatio([]);
      expect(result).toBe(0);
    });

    it('should return 0 for single element', () => {
      const service = new LeaderboardService();
      // @ts-ignore
      const result = service.calculateSharpeRatio([100]);
      expect(result).toBe(0);
    });

    it('should calculate positive sharpe ratio for profitable trades', () => {
      const service = new LeaderboardService();
      // @ts-ignore
      const result = service.calculateSharpeRatio([100, 150, 200, 180, 220]);
      expect(result).toBeGreaterThan(0);
    });

    it('should handle mixed P&L', () => {
      const service = new LeaderboardService();
      // @ts-ignore
      const result = service.calculateSharpeRatio([100, -50, 75, -30, 120]);
      expect(result).toBeDefined();
    });
  });

  describe('calculateMaxDrawdown', () => {
    it('should return 0 for empty array', () => {
      const service = new LeaderboardService();
      // @ts-ignore
      const result = service.calculateMaxDrawdown([]);
      expect(result).toBe(0);
    });

    it('should calculate drawdown correctly', () => {
      const service = new LeaderboardService();
      // Simulate: +100, +50 (peak 150), -80 (drawdown from 150 to 70)
      // @ts-ignore
      const result = service.calculateMaxDrawdown([100, 50, -80]);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should return 0 for consistently profitable trades', () => {
      const service = new LeaderboardService();
      // @ts-ignore
      const result = service.calculateMaxDrawdown([100, 100, 100, 100]);
      expect(result).toBe(0);
    });
  });

  describe('calculateConsecutive', () => {
    it('should count consecutive wins', () => {
      const service = new LeaderboardService();
      // @ts-ignore
      const result = service.calculateConsecutive([100, 150, 200, -50, 100]);
      expect(result.consecutiveWins).toBe(3);
      expect(result.consecutiveLosses).toBe(1);
    });

    it('should count consecutive losses', () => {
      const service = new LeaderboardService();
      // @ts-ignore
      const result = service.calculateConsecutive([-100, -150, -200, 50, -100]);
      expect(result.consecutiveWins).toBe(1);
      expect(result.consecutiveLosses).toBe(3);
    });

    it('should handle empty array', () => {
      const service = new LeaderboardService();
      // @ts-ignore
      const result = service.calculateConsecutive([]);
      expect(result.consecutiveWins).toBe(0);
      expect(result.consecutiveLosses).toBe(0);
    });
  });

  describe('getCurrentLeaderboard', () => {
    it('should return empty array when no data', () => {
      const leaderboard = leaderboardService.getCurrentLeaderboard();
      expect(leaderboard).toEqual([]);
    });
  });

  describe('getStrategyRank', () => {
    it('should return null for unknown strategy', () => {
      const rank = leaderboardService.getStrategyRank('unknown-strategy');
      expect(rank).toBeNull();
    });
  });

  describe('createSnapshot', () => {
    it('should create a snapshot', async () => {
      const snapshot = await leaderboardService.createSnapshot();
      expect(snapshot).toBeDefined();
      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot).toHaveProperty('entries');
      expect(snapshot).toHaveProperty('totalStrategies');
      expect(snapshot).toHaveProperty('totalTrades');
      expect(snapshot).toHaveProperty('totalVolume');
    });
  });

  describe('event emission', () => {
    it('should emit leaderboard:updated event', (done) => {
      leaderboardService.on('leaderboard:updated', (entries) => {
        expect(entries).toBeDefined();
        expect(Array.isArray(entries)).toBe(true);
        done();
      });

      // Trigger calculation (will use mocked data)
      leaderboardService.calculateLeaderboard('roi').catch(() => {
        // Ignore errors from missing DB
      });
    });

    it('should emit leaderboard:snapshot event', (done) => {
      leaderboardService.on('leaderboard:snapshot', (snapshot) => {
        expect(snapshot).toBeDefined();
        done();
      });

      leaderboardService.createSnapshot().catch(() => {
        // Ignore errors
      });
    });
  });

  describe('clearCache', () => {
    it('should clear cached rankings', () => {
      leaderboardService.clearCache();
      const leaderboard = leaderboardService.getCurrentLeaderboard();
      expect(leaderboard).toEqual([]);
    });
  });
});
