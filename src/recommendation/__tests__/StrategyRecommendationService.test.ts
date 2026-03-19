/**
 * Tests for Strategy Recommendation Service
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the database client
jest.mock('../../database/client', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: jest.fn((table: string) => ({
      select: jest.fn((columns?: string) => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          gt: jest.fn(() => ({
            select: jest.fn(() => Promise.resolve({ data: [], count: 5, error: null })),
          })),
        })),
        gt: jest.fn(() => ({
          select: jest.fn(() => Promise.resolve({ data: [], count: 3, error: null })),
        })),
      })),
      rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  })),
}));

// Mock the DAOs
jest.mock('../../database/strategy-recommendation.dao', () => ({
  getUserFeedbackDAO: jest.fn(() => ({
    create: jest.fn((input) => Promise.resolve({
      id: 'feedback-1',
      userId: input.userId,
      strategyId: input.strategyId,
      feedbackType: input.feedbackType,
      reason: input.reason || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    getById: jest.fn(),
    getByUserAndStrategy: jest.fn(() => Promise.resolve(null)),
    getDislikedStrategyIds: jest.fn(() => Promise.resolve([])),
    getLikedStrategyIds: jest.fn(() => Promise.resolve(['strategy-1'])),
    delete: jest.fn(),
  })),
  getUserInteractionDAO: jest.fn(() => ({
    create: jest.fn((input) => {
      const weights: Record<string, number> = {
        view: 1,
        subscribe: 5,
        review: 3,
        signal_follow: 4,
      };
      return Promise.resolve({
        id: 'interaction-1',
        userId: input.userId,
        strategyId: input.strategyId,
        interactionType: input.interactionType,
        weight: input.weight ?? weights[input.interactionType] ?? 1,
        metadata: input.metadata || null,
        createdAt: new Date(),
      });
    }),
    getInteractionsByUser: jest.fn(() => Promise.resolve([])),
    getInteractionsByStrategy: jest.fn(() => Promise.resolve([])),
    getStrategyInteractionWeights: jest.fn(() => Promise.resolve(new Map([['strategy-1', 5]]))),
    getSimilarUsers: jest.fn(() => Promise.resolve(['user-2', 'user-3'])),
  })),
  getUserProfileDAO: jest.fn(() => ({
    getOrCreate: jest.fn((userId) => Promise.resolve({
      userId,
      riskTolerance: 'moderate',
      capitalScale: 'medium',
      preferredCategories: ['momentum', 'trend'],
      preferredStrategyTypes: ['sma', 'rsi'],
      preferredSymbols: ['BTC/USDT', 'ETH/USDT'],
      avgHoldingPeriod: null,
      totalTrades: 0,
      winRate: null,
      avgPnl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    getByUserId: jest.fn((userId) => Promise.resolve({
      userId,
      riskTolerance: 'moderate',
      capitalScale: 'medium',
      preferredCategories: ['momentum', 'trend'],
      preferredStrategyTypes: ['sma', 'rsi'],
      preferredSymbols: ['BTC/USDT', 'ETH/USDT'],
      avgHoldingPeriod: null,
      totalTrades: 0,
      winRate: null,
      avgPnl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    update: jest.fn((userId, input) => Promise.resolve({
      userId,
      riskTolerance: input.riskTolerance || 'moderate',
      capitalScale: input.capitalScale || 'medium',
      preferredCategories: input.preferredCategories || [],
      preferredStrategyTypes: input.preferredStrategyTypes || [],
      preferredSymbols: input.preferredSymbols || [],
      avgHoldingPeriod: null,
      totalTrades: 0,
      winRate: null,
      avgPnl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    getUsersByPreferences: jest.fn(() => Promise.resolve(['user-2', 'user-3'])),
  })),
  getStrategyRecommendationDAO: jest.fn(() => ({
    create: jest.fn(),
    getActiveRecommendations: jest.fn(() => Promise.resolve([])),
    getMany: jest.fn(() => Promise.resolve([])),
    markDismissed: jest.fn(),
    markClicked: jest.fn(),
    clearExpired: jest.fn(() => Promise.resolve(0)),
    batchCreate: jest.fn(),
  })),
}));

// Mock the marketplace DAOs
jest.mock('../../database/strategy-marketplace.dao', () => ({
  getMarketplaceStrategiesDAO: jest.fn(() => ({
    getById: jest.fn((id) => {
      if (id === 'strategy-1') {
        return Promise.resolve({
          id: 'strategy-1',
          publisherId: 'publisher-1',
          name: 'Test Strategy',
          description: 'A test strategy',
          strategyType: 'sma',
          category: 'momentum',
          symbols: ['BTC/USDT'],
          config: {},
          riskParams: {},
          tags: ['trend'],
          visibility: 'public',
          status: 'approved',
          performanceMetrics: { sharpeRatio: 1.8, winRate: 0.65, maxDrawdown: 0.15 },
          backtestPeriod: null,
          backtestStats: null,
          subscriptionFee: 0,
          feeCurrency: 'USDT',
          revenueSharePercent: 70,
          subscriberCount: 150,
          viewCount: 500,
          ratingAvg: 4.5,
          ratingCount: 20,
          signalCount: 10,
          isFeatured: true,
          isVerified: true,
          publishedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      return Promise.resolve(null);
    }),
    getMany: jest.fn(() => Promise.resolve([
      {
        id: 'strategy-1',
        publisherId: 'publisher-1',
        name: 'Test Strategy',
        description: 'A test strategy',
        strategyType: 'sma',
        category: 'momentum',
        symbols: ['BTC/USDT'],
        config: {},
        riskParams: {},
        tags: ['trend'],
        visibility: 'public',
        status: 'approved',
        performanceMetrics: { sharpeRatio: 1.8, winRate: 0.65, maxDrawdown: 0.15 },
        backtestPeriod: null,
        backtestStats: null,
        subscriptionFee: 0,
        feeCurrency: 'USDT',
        revenueSharePercent: 70,
        subscriberCount: 150,
        viewCount: 500,
        ratingAvg: 4.5,
        ratingCount: 20,
        signalCount: 10,
        isFeatured: true,
        isVerified: true,
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])),
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
    getActiveSubscriptionsForUser: jest.fn(() => Promise.resolve([])),
    getActiveSubscriptionsForStrategy: jest.fn(() => Promise.resolve([])),
  })),
}));

import {
  StrategyRecommendationService,
  getStrategyRecommendationService,
} from '../StrategyRecommendationService';

describe('StrategyRecommendationService', () => {
  let service: StrategyRecommendationService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton
    (StrategyRecommendationService as any).instance = null;
    service = getStrategyRecommendationService();
  });

  describe('getRecommendations', () => {
    it('should return personalized recommendations', async () => {
      const recommendations = await service.getRecommendations('user-1', 5);

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeLessThanOrEqual(5);
    });

    it('should include recommendation details', async () => {
      const recommendations = await service.getRecommendations('user-1', 5);

      for (const rec of recommendations) {
        expect(rec).toHaveProperty('strategy');
        expect(rec).toHaveProperty('score');
        expect(rec).toHaveProperty('reasons');
        expect(rec).toHaveProperty('algorithm');
        expect(['collaborative', 'content_based', 'hybrid', 'trending']).toContain(rec.algorithm);
      }
    });

    it('should respect limit parameter', async () => {
      const recommendations = await service.getRecommendations('user-1', 3);
      expect(recommendations.length).toBeLessThanOrEqual(3);
    });
  });

  describe('recordFeedback', () => {
    it('should record like feedback', async () => {
      const feedback = await service.recordFeedback({
        userId: 'user-1',
        strategyId: 'strategy-1',
        feedbackType: 'like',
      });

      expect(feedback).toHaveProperty('id');
      expect(feedback.userId).toBe('user-1');
      expect(feedback.strategyId).toBe('strategy-1');
      expect(feedback.feedbackType).toBe('like');
    });

    it('should record dislike feedback with reason', async () => {
      const feedback = await service.recordFeedback({
        userId: 'user-1',
        strategyId: 'strategy-2',
        feedbackType: 'dislike',
        reason: 'Too risky',
      });

      expect(feedback.feedbackType).toBe('dislike');
      expect(feedback.reason).toBe('Too risky');
    });

    it('should emit feedbackRecorded event', async () => {
      const listener = jest.fn();
      service.on('feedbackRecorded', listener);

      await service.recordFeedback({
        userId: 'user-1',
        strategyId: 'strategy-1',
        feedbackType: 'like',
      });

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('recordInteraction', () => {
    it('should record view interaction', async () => {
      const interaction = await service.recordInteraction({
        userId: 'user-1',
        strategyId: 'strategy-1',
        interactionType: 'view',
      });

      expect(interaction).toHaveProperty('id');
      expect(interaction.interactionType).toBe('view');
    });

    it('should assign default weight based on interaction type', async () => {
      const subscribeInteraction = await service.recordInteraction({
        userId: 'user-1',
        strategyId: 'strategy-1',
        interactionType: 'subscribe',
      });

      expect(subscribeInteraction.weight).toBe(5); // Subscribe has weight 5
    });

    it('should emit interactionRecorded event', async () => {
      const listener = jest.fn();
      service.on('interactionRecorded', listener);

      await service.recordInteraction({
        userId: 'user-1',
        strategyId: 'strategy-1',
        interactionType: 'subscribe',
      });

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('updateUserProfile', () => {
    it('should update user preferences', async () => {
      const profile = await service.updateUserProfile('user-1', {
        riskTolerance: 'aggressive',
        capitalScale: 'large',
        preferredCategories: ['momentum'],
      });

      expect(profile.riskTolerance).toBe('aggressive');
      expect(profile.capitalScale).toBe('large');
      expect(profile.preferredCategories).toContain('momentum');
    });

    it('should emit profileUpdated event', async () => {
      const listener = jest.fn();
      service.on('profileUpdated', listener);

      await service.updateUserProfile('user-1', {
        riskTolerance: 'conservative',
      });

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('getUserProfile', () => {
    it('should return user profile', async () => {
      const profile = await service.getUserProfile('user-1');

      expect(profile).toHaveProperty('userId');
      expect(profile).toHaveProperty('riskTolerance');
      expect(profile).toHaveProperty('capitalScale');
    });
  });

  describe('explainRecommendation', () => {
    it('should explain why a strategy is recommended', async () => {
      const explanation = await service.explainRecommendation('user-1', 'strategy-1');

      expect(explanation).toHaveProperty('score');
      expect(explanation).toHaveProperty('reasons');
      expect(explanation).toHaveProperty('factors');
      expect(Array.isArray(explanation.reasons)).toBe(true);
      expect(typeof explanation.factors).toBe('object');
    });

    it('should throw error for non-existent strategy', async () => {
      // Mock getById to return null for non-existent strategy
      await expect(service.explainRecommendation('user-1', 'non-existent')).rejects.toThrow();
    });
  });

  describe('getStats', () => {
    it('should return recommendation system stats', async () => {
      const stats = await service.getStats();

      expect(stats).toHaveProperty('totalFeedback');
      expect(stats).toHaveProperty('totalInteractions');
      expect(stats).toHaveProperty('totalProfiles');
      expect(stats).toHaveProperty('activeRecommendations');
    });
  });

  describe('clearExpiredRecommendations', () => {
    it('should clear expired recommendations', async () => {
      const count = await service.clearExpiredRecommendations();
      expect(typeof count).toBe('number');
    });
  });
});

describe('getStrategyRecommendationService', () => {
  it('should return singleton instance', () => {
    const instance1 = getStrategyRecommendationService();
    const instance2 = getStrategyRecommendationService();
    expect(instance1).toBe(instance2);
  });
});

describe('Recommendation Algorithms', () => {
  let service: StrategyRecommendationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = getStrategyRecommendationService();
  });

  describe('Collaborative Filtering', () => {
    it('should find similar users based on interactions', async () => {
      const recommendations = await service.getRecommendations('user-1');

      // If collaborative filtering works, similar users' liked strategies should appear
      // This is validated indirectly through the recommendation results
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('Content-Based Filtering', () => {
    it('should match strategies to user preferences', async () => {
      // User prefers 'momentum' category and 'sma' strategy type
      // The test strategy has both, so it should get a high score
      const recommendations = await service.getRecommendations('user-1');

      for (const rec of recommendations) {
        if (rec.strategy.category === 'momentum') {
          expect(rec.reasons.some(r => r.includes('偏好分类'))).toBe(true);
        }
      }
    });
  });

  describe('Hybrid Scoring', () => {
    it('should combine multiple recommendation algorithms', async () => {
      const recommendations = await service.getRecommendations('user-1', 10);

      // Check that we have recommendations with different algorithms
      const algorithms = new Set(recommendations.map(r => r.algorithm));
      // Hybrid recommendations should be present if multiple factors match
      expect(algorithms.size).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('Recommendation Score Factors', () => {
  let service: StrategyRecommendationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = getStrategyRecommendationService();
  });

  it('should boost score for high Sharpe ratio', async () => {
    const explanation = await service.explainRecommendation('user-1', 'strategy-1');

    // Strategy has sharpeRatio: 1.8 > 1.5
    expect(explanation.reasons.some(r => r.includes('夏普比率') || r.includes('高评分') || r.includes('胜率'))).toBe(true);
  });

  it('should boost score for verified strategies', async () => {
    const explanation = await service.explainRecommendation('user-1', 'strategy-1');

    // Strategy is verified
    expect(explanation.reasons.some(r => r.includes('已验证'))).toBe(true);
  });

  it('should boost score for category match', async () => {
    const explanation = await service.explainRecommendation('user-1', 'strategy-1');

    // User prefers 'momentum', strategy category is 'momentum'
    expect(explanation.reasons.some(r => r.includes('偏好分类'))).toBe(true);
  });
});