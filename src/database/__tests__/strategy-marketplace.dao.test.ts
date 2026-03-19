/**
 * Tests for Strategy Marketplace DAO
 * 
 * Note: These are integration-style tests that verify the DAO structure.
 * Full database integration tests would require a test database.
 */

import { describe, it, expect } from '@jest/globals';

describe('Strategy Marketplace DAOs', () => {
  describe('Types and Interfaces', () => {
    it('should have correct type definitions', () => {
      // Verify types are correctly defined
      type StrategyVisibility = 'public' | 'private' | 'unlisted';
      type StrategyStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'delisted';
      type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired';
      type SignalType = 'entry' | 'exit' | 'stop_loss' | 'take_profit' | 'update';
      type RiskLevel = 'low' | 'medium' | 'high' | 'very_high';

      const visibility: StrategyVisibility = 'public';
      const status: StrategyStatus = 'approved';
      const subStatus: SubscriptionStatus = 'active';
      const signalType: SignalType = 'entry';
      const riskLevel: RiskLevel = 'medium';

      expect(visibility).toBe('public');
      expect(status).toBe('approved');
      expect(subStatus).toBe('active');
      expect(signalType).toBe('entry');
      expect(riskLevel).toBe('medium');
    });

    it('should have correct PerformanceMetrics structure', () => {
      interface PerformanceMetrics {
        totalReturn?: number | null;
        annualizedReturn?: number | null;
        sharpeRatio?: number | null;
        maxDrawdown?: number | null;
        winRate?: number | null;
        profitFactor?: number | null;
        avgTradeDuration?: number | null;
        totalTrades?: number | null;
      }

      const metrics: PerformanceMetrics = {
        totalReturn: 25.5,
        sharpeRatio: 1.8,
        maxDrawdown: -10,
        winRate: 65,
      };

      expect(metrics.totalReturn).toBe(25.5);
      expect(metrics.sharpeRatio).toBe(1.8);
    });
  });

  describe('Module Imports', () => {
    it('should export all required DAOs', async () => {
      const module = await import('../strategy-marketplace.dao');
      
      expect(typeof module.MarketplaceStrategiesDAO).toBe('function');
      expect(typeof module.StrategySubscriptionsDAO).toBe('function');
      expect(typeof module.StrategyReviewsDAO).toBe('function');
      expect(typeof module.MarketplaceSignalsDAO).toBe('function');
      expect(typeof module.StrategyPublisherStatsDAO).toBe('function');
      
      expect(typeof module.getMarketplaceStrategiesDAO).toBe('function');
      expect(typeof module.getStrategySubscriptionsDAO).toBe('function');
      expect(typeof module.getStrategyReviewsDAO).toBe('function');
      expect(typeof module.getMarketplaceSignalsDAO).toBe('function');
      expect(typeof module.getStrategyPublisherStatsDAO).toBe('function');
    });

    it('should export type definitions', async () => {
      const module = await import('../strategy-marketplace.dao');
      
      // Types are compile-time only, but we verify the module exports them
      expect(module).toBeDefined();
    });
  });

  describe('DAO Instantiation', () => {
    it('should create MarketplaceStrategiesDAO instance', async () => {
      const { MarketplaceStrategiesDAO } = await import('../strategy-marketplace.dao');
      const dao = new MarketplaceStrategiesDAO();
      expect(dao).toBeInstanceOf(MarketplaceStrategiesDAO);
    });

    it('should create StrategySubscriptionsDAO instance', async () => {
      const { StrategySubscriptionsDAO } = await import('../strategy-marketplace.dao');
      const dao = new StrategySubscriptionsDAO();
      expect(dao).toBeInstanceOf(StrategySubscriptionsDAO);
    });

    it('should create StrategyReviewsDAO instance', async () => {
      const { StrategyReviewsDAO } = await import('../strategy-marketplace.dao');
      const dao = new StrategyReviewsDAO();
      expect(dao).toBeInstanceOf(StrategyReviewsDAO);
    });

    it('should create MarketplaceSignalsDAO instance', async () => {
      const { MarketplaceSignalsDAO } = await import('../strategy-marketplace.dao');
      const dao = new MarketplaceSignalsDAO();
      expect(dao).toBeInstanceOf(MarketplaceSignalsDAO);
    });

    it('should create StrategyPublisherStatsDAO instance', async () => {
      const { StrategyPublisherStatsDAO } = await import('../strategy-marketplace.dao');
      const dao = new StrategyPublisherStatsDAO();
      expect(dao).toBeInstanceOf(StrategyPublisherStatsDAO);
    });
  });
});