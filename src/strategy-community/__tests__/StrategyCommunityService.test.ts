/**
 * Strategy Community Service Tests
 */

import { StrategyCommunityService, getStrategyCommunityService } from '../StrategyCommunityService';
import {
  StrategyReportsDAO,
  StrategyLeaderboardDAO,
  CommunityStatsDAO,
  getStrategyReportsDAO,
  getStrategyLeaderboardDAO,
  getCommunityStatsDAO,
} from '../../database/strategy-community.dao';
import {
  MarketplaceStrategiesDAO,
  StrategySubscriptionsDAO,
  StrategyReviewsDAO,
  getMarketplaceStrategiesDAO,
  getStrategySubscriptionsDAO,
  getStrategyReviewsDAO,
} from '../../database/strategy-marketplace.dao';

// Mock DAOs
jest.mock('../../database/strategy-community.dao');
jest.mock('../../database/strategy-marketplace.dao');

describe('StrategyCommunityService', () => {
  let service: StrategyCommunityService;
  let mockReportsDAO: jest.Mocked<StrategyReportsDAO>;
  let mockLeaderboardDAO: jest.Mocked<StrategyLeaderboardDAO>;
  let mockCommunityStatsDAO: jest.Mocked<CommunityStatsDAO>;
  let mockStrategiesDAO: jest.Mocked<MarketplaceStrategiesDAO>;
  let mockSubscriptionsDAO: jest.Mocked<StrategySubscriptionsDAO>;
  let mockReviewsDAO: jest.Mocked<StrategyReviewsDAO>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock instances
    mockReportsDAO = {
      create: jest.fn(),
      getById: jest.fn(),
      getMany: jest.fn(),
      update: jest.fn(),
      getPendingCount: jest.fn(),
      getReportCountByStrategy: jest.fn(),
    } as any;

    mockLeaderboardDAO = {
      getLeaderboard: jest.fn(),
      getStrategyRankings: jest.fn(),
    } as any;

    mockCommunityStatsDAO = {
      getStats: jest.fn(),
    } as any;

    mockStrategiesDAO = {
      create: jest.fn(),
      getById: jest.fn(),
      getMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      publish: jest.fn(),
      incrementViews: jest.fn(),
      getCategories: jest.fn(),
      getTags: jest.fn(),
    } as any;

    mockSubscriptionsDAO = {
      create: jest.fn(),
      getById: jest.fn(),
      getBySubscriberAndStrategy: jest.fn(),
      getMany: jest.fn(),
      update: jest.fn(),
      getActiveSubscriptionsForStrategy: jest.fn(),
      getActiveSubscriptionsForUser: jest.fn(),
      cancel: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
    } as any;

    mockReviewsDAO = {
      create: jest.fn(),
      getById: jest.fn(),
      getByUserAndStrategy: jest.fn(),
      getMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    // Mock DAO getters
    (getStrategyReportsDAO as jest.Mock).mockReturnValue(mockReportsDAO);
    (getStrategyLeaderboardDAO as jest.Mock).mockReturnValue(mockLeaderboardDAO);
    (getCommunityStatsDAO as jest.Mock).mockReturnValue(mockCommunityStatsDAO);
    (getMarketplaceStrategiesDAO as jest.Mock).mockReturnValue(mockStrategiesDAO);
    (getStrategySubscriptionsDAO as jest.Mock).mockReturnValue(mockSubscriptionsDAO);
    (getStrategyReviewsDAO as jest.Mock).mockReturnValue(mockReviewsDAO);

    // Create service instance
    service = new StrategyCommunityService();
  });

  describe('shareStrategy', () => {
    it('should share a strategy to the community', async () => {
      const mockStrategy = {
        id: 'strategy-1',
        publisherId: 'user-1',
        name: 'Test Strategy',
        description: 'A test strategy',
        strategyType: 'trend_following',
        category: 'crypto',
        symbols: ['BTC/USDT'],
        config: {},
        riskParams: {},
        tags: ['trend'],
        visibility: 'public',
        status: 'draft',
        performanceMetrics: {},
        subscriptionFee: 0,
        feeCurrency: 'USDT',
        revenueSharePercent: 70,
        subscriberCount: 0,
        viewCount: 0,
        ratingAvg: 0,
        ratingCount: 0,
        signalCount: 0,
        isFeatured: false,
        isVerified: false,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStrategiesDAO.create.mockResolvedValue(mockStrategy);
      mockStrategiesDAO.publish.mockResolvedValue({ ...mockStrategy, status: 'pending_review' });

      const result = await service.shareStrategy({
        publisherId: 'user-1',
        name: 'Test Strategy',
        description: 'A test strategy',
        strategyType: 'trend_following',
        category: 'crypto',
        symbols: ['BTC/USDT'],
        tags: ['trend'],
        visibility: 'public',
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Strategy');
      expect(mockStrategiesDAO.create).toHaveBeenCalled();
    });
  });

  describe('getLeaderboard', () => {
    it('should return leaderboard entries', async () => {
      const mockEntries = [
        {
          rank: 1,
          strategyId: 'strategy-1',
          strategyName: 'Top Strategy',
          publisherId: 'publisher-1',
          score: 95.5,
          metrics: {
            totalReturn: 150,
            winRate: 75,
            sharpeRatio: 2.5,
          },
          period: 'all_time',
          updatedAt: new Date(),
        },
      ];

      mockLeaderboardDAO.getLeaderboard.mockResolvedValue(mockEntries);

      const result = await service.getLeaderboard({
        type: 'returns',
        period: 'all_time',
        limit: 20,
      });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].strategyName).toBe('Top Strategy');
      expect(result.type).toBe('returns');
    });
  });

  describe('subscribeToStrategy', () => {
    it('should subscribe a user to a strategy', async () => {
      const mockStrategy = {
        id: 'strategy-1',
        publisherId: 'publisher-1',
        name: 'Test Strategy',
        status: 'approved',
      } as any;

      const mockSubscription = {
        id: 'sub-1',
        subscriberId: 'user-1',
        strategyId: 'strategy-1',
        status: 'active',
        autoExecute: false,
        copyRatio: 1.0,
      } as any;

      mockStrategiesDAO.getById.mockResolvedValue(mockStrategy);
      mockSubscriptionsDAO.getBySubscriberAndStrategy.mockResolvedValue(null);
      mockSubscriptionsDAO.create.mockResolvedValue(mockSubscription);

      const result = await service.subscribeToStrategy({
        subscriberId: 'user-1',
        strategyId: 'strategy-1',
      });

      expect(result.isNew).toBe(true);
      expect(result.subscription.strategyId).toBe('strategy-1');
    });

    it('should not allow subscribing to own strategy', async () => {
      const mockStrategy = {
        id: 'strategy-1',
        publisherId: 'user-1',
        name: 'Test Strategy',
        status: 'approved',
      } as any;

      mockStrategiesDAO.getById.mockResolvedValue(mockStrategy);

      await expect(service.subscribeToStrategy({
        subscriberId: 'user-1',
        strategyId: 'strategy-1',
      })).rejects.toThrow('Cannot subscribe to your own strategy');
    });
  });

  describe('reviewStrategy', () => {
    it('should create a review for a strategy', async () => {
      const mockReview = {
        id: 'review-1',
        strategyId: 'strategy-1',
        userId: 'user-1',
        rating: 5,
        title: 'Great strategy',
        content: 'This strategy is amazing!',
        isVerifiedSubscriber: true,
        status: 'active',
      } as any;

      mockSubscriptionsDAO.getBySubscriberAndStrategy.mockResolvedValue({
        id: 'sub-1',
        status: 'active',
      } as any);
      mockReviewsDAO.create.mockResolvedValue(mockReview);

      const result = await service.reviewStrategy({
        strategyId: 'strategy-1',
        userId: 'user-1',
        rating: 5,
        title: 'Great strategy',
        content: 'This strategy is amazing!',
      });

      expect(result.rating).toBe(5);
      expect(result.isVerifiedSubscriber).toBe(true);
    });
  });

  describe('reportStrategy', () => {
    it('should report a strategy', async () => {
      const mockReport = {
        id: 'report-1',
        reporterId: 'user-1',
        strategyId: 'strategy-1',
        reportType: 'spam',
        reason: 'This is spam',
        status: 'pending',
      } as any;

      mockStrategiesDAO.getById.mockResolvedValue({
        id: 'strategy-1',
        name: 'Test Strategy',
      } as any);
      mockReportsDAO.create.mockResolvedValue(mockReport);

      const result = await service.reportStrategy({
        reporterId: 'user-1',
        strategyId: 'strategy-1',
        reportType: 'spam',
        reason: 'This is spam',
      });

      expect(result.reportType).toBe('spam');
      expect(result.status).toBe('pending');
    });

    it('should throw error for non-existent strategy', async () => {
      mockStrategiesDAO.getById.mockResolvedValue(null);

      await expect(service.reportStrategy({
        reporterId: 'user-1',
        strategyId: 'non-existent',
        reportType: 'spam',
        reason: 'This is spam',
      })).rejects.toThrow('Strategy not found');
    });
  });

  describe('getCommunityStats', () => {
    it('should return community statistics', async () => {
      const mockStats = {
        totalStrategies: 100,
        activeStrategies: 80,
        totalSubscriptions: 500,
        totalSignals: 1000,
        totalReviews: 200,
        totalPublishers: 50,
        topCategories: [
          { category: 'crypto', count: 40 },
          { category: 'forex', count: 30 },
        ],
        recentGrowth: {
          newStrategies: 10,
          newSubscriptions: 50,
          newSignals: 100,
        },
        updatedAt: new Date(),
      };

      mockCommunityStatsDAO.getStats.mockResolvedValue(mockStats);

      const result = await service.getCommunityStats();

      expect(result.totalStrategies).toBe(100);
      expect(result.topCategories).toHaveLength(2);
    });
  });

  describe('getStrategyDetails', () => {
    it('should return full strategy details', async () => {
      const mockStrategy = {
        id: 'strategy-1',
        publisherId: 'publisher-1',
        name: 'Test Strategy',
        status: 'approved',
        subscriberCount: 100,
        ratingAvg: 4.5,
      } as any;

      mockStrategiesDAO.getById.mockResolvedValue(mockStrategy);
      mockStrategiesDAO.incrementViews.mockResolvedValue(undefined);
      mockSubscriptionsDAO.getBySubscriberAndStrategy.mockResolvedValue(null);
      mockReviewsDAO.getByUserAndStrategy.mockResolvedValue(null);
      mockReviewsDAO.getMany.mockResolvedValue([]);
      mockReportsDAO.getReportCountByStrategy.mockResolvedValue(0);
      mockLeaderboardDAO.getStrategyRankings.mockResolvedValue(null);

      // Mock publisher stats DAO
      const { getStrategyPublisherStatsDAO } = require('../../database/strategy-marketplace.dao');
      getStrategyPublisherStatsDAO.mockReturnValue({
        getByPublisher: jest.fn().mockResolvedValue({
          totalStrategies: 5,
          avgRating: 4.2,
          totalSubscribers: 500,
        }),
      });

      const result = await service.getStrategyDetails('strategy-1', 'user-1');

      expect(result).toBeDefined();
      expect(result?.strategy.name).toBe('Test Strategy');
      expect(result?.isSubscribed).toBe(false);
    });

    it('should return null for non-existent strategy', async () => {
      mockStrategiesDAO.getById.mockResolvedValue(null);

      const result = await service.getStrategyDetails('non-existent');

      expect(result).toBeNull();
    });
  });
});

describe('getStrategyCommunityService', () => {
  it('should return a singleton instance', () => {
    const instance1 = getStrategyCommunityService();
    const instance2 = getStrategyCommunityService();

    expect(instance1).toBe(instance2);
  });
});