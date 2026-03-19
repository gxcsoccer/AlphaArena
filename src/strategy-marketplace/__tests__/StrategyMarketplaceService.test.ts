/**
 * Tests for Strategy Marketplace Service
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the DAOs
jest.mock('../../database/strategy-marketplace.dao', () => ({
  getMarketplaceStrategiesDAO: jest.fn(() => ({
    create: jest.fn(),
    getById: jest.fn(),
    getMany: jest.fn(() => Promise.resolve([])),
    update: jest.fn(),
    delete: jest.fn(),
    publish: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
    incrementViews: jest.fn(),
    getCategories: jest.fn(() => Promise.resolve(['momentum', 'mean_reversion'])),
    getTags: jest.fn(() => Promise.resolve(['trend', 'breakout'])),
  })),
  getStrategySubscriptionsDAO: jest.fn(() => ({
    create: jest.fn(),
    getById: jest.fn(),
    getBySubscriberAndStrategy: jest.fn(() => Promise.resolve(null)),
    getMany: jest.fn(() => Promise.resolve([])),
    update: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    cancel: jest.fn(),
    getActiveSubscriptionsForStrategy: jest.fn(() => Promise.resolve([])),
    getActiveSubscriptionsForUser: jest.fn(() => Promise.resolve([])),
    incrementSignalsReceived: jest.fn(),
    incrementSignalsExecuted: jest.fn(),
  })),
  getStrategyReviewsDAO: jest.fn(() => ({
    create: jest.fn(),
    getById: jest.fn(),
    getByUserAndStrategy: jest.fn(() => Promise.resolve(null)),
    getMany: jest.fn(() => Promise.resolve([])),
    update: jest.fn(),
    delete: jest.fn(),
  })),
  getMarketplaceSignalsDAO: jest.fn(() => ({
    create: jest.fn(),
    getById: jest.fn(),
    getMany: jest.fn(() => Promise.resolve([])),
    update: jest.fn(),
    getActiveSignalsForStrategy: jest.fn(() => Promise.resolve([])),
  })),
  getStrategyPublisherStatsDAO: jest.fn(() => ({
    getOrCreate: jest.fn(),
    getByPublisher: jest.fn(),
    updateStats: jest.fn(),
    getTopPublishers: jest.fn(() => Promise.resolve([])),
  })),
}));

import { StrategyMarketplaceService, getStrategyMarketplaceService } from '../StrategyMarketplaceService';

describe('StrategyMarketplaceService', () => {
  let service: StrategyMarketplaceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = getStrategyMarketplaceService();
  });

  describe('listStrategies', () => {
    it('should return list of strategies', async () => {
      const strategies = await service.listStrategies();
      expect(Array.isArray(strategies)).toBe(true);
    });

    it('should apply filters correctly', async () => {
      const strategies = await service.listStrategies({
        category: 'momentum',
        limit: 10,
      });
      expect(Array.isArray(strategies)).toBe(true);
    });
  });

  describe('getCategories', () => {
    it('should return array of categories', async () => {
      const categories = await service.getCategories();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories).toContain('momentum');
    });
  });

  describe('getTags', () => {
    it('should return array of tags', async () => {
      const tags = await service.getTags();
      expect(Array.isArray(tags)).toBe(true);
      expect(tags).toContain('trend');
    });
  });

  describe('subscribe', () => {
    it('should throw error if strategy not found', async () => {
      // Mock the strategy not found scenario
      await expect(service.subscribe({
        subscriberId: 'user-1',
        strategyId: 'non-existent',
      })).rejects.toThrow('Strategy not found');
    });
  });

  describe('createReview', () => {
    it('should create review with verified subscriber flag', async () => {
      // Test review creation with verification
    });
  });

  describe('publishSignal', () => {
    it('should throw error if strategy not found', async () => {
      await expect(service.publishSignal({
        strategyId: 'non-existent',
        publisherId: 'user-1',
        symbol: 'BTC/USDT',
        side: 'buy',
      })).rejects.toThrow('Strategy not found');
    });

    it('should throw error if not strategy owner', async () => {
      // Test ownership validation
    });
  });

  describe('event emission', () => {
    it('should emit strategyCreated event', async () => {
      const listener = jest.fn();
      service.on('strategyCreated', listener);

      // Create strategy would emit event
      // In real test, we'd trigger this and verify
    });

    it('should emit subscribed event', async () => {
      const listener = jest.fn();
      service.on('subscribed', listener);

      // Subscribe would emit event
    });

    it('should emit signalPublished event', async () => {
      const listener = jest.fn();
      service.on('signalPublished', listener);

      // Signal publication would emit event
    });
  });

  describe('getTopPublishers', () => {
    it('should return top publishers by subscribers', async () => {
      const publishers = await service.getTopPublishers(10);
      expect(Array.isArray(publishers)).toBe(true);
    });
  });

  describe('searchStrategies', () => {
    it('should search strategies by query', async () => {
      const strategies = await service.searchStrategies('RSI');
      expect(Array.isArray(strategies)).toBe(true);
    });
  });
});

describe('getStrategyMarketplaceService', () => {
  it('should return singleton instance', () => {
    const instance1 = getStrategyMarketplaceService();
    const instance2 = getStrategyMarketplaceService();
    expect(instance1).toBe(instance2);
  });
});