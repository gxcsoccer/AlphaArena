/**
 * DashboardService Tests
 *
 * @module analytics/__tests__/DashboardService.test
 */

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Explicitly mock database client
jest.mock('../../database/client', () => require('../../../tests/__mocks__/supabase'));

jest.mock('../MetricsService');
jest.mock('../../database/user-tracking.dao', () => ({
  userTrackingDAO: {
    getUserEngagementMetrics: jest.fn().mockResolvedValue({
      dau: 100,
      wau: 300,
      mau: 500,
      stickiness: 20,
      retention: { day1: 40, day7: 25, day30: 10 },
      avgSessionDuration: 300,
      avgSessionsPerUser: 2.5,
    }),
    analyzeFunnel: jest.fn().mockImplementation((name: string) => Promise.resolve({
      name,
      steps: [],
      totalUsers: 100,
      completedUsers: 10,
      overallConversionRate: 10,
    })),
    getDailySummary: jest.fn().mockResolvedValue([]),
  },
}));

// Import after mocks are set up
import { dashboardService } from '../DashboardService';
import { seedMockData, clearMockData } from '../../../tests/__mocks__/supabase';
import { metricsService } from '../MetricsService';

// Mock metricsService return values
(metricsService.getKeyMetrics as jest.Mock).mockResolvedValue({
  northStar: {
    name: 'weekly_active_trading_users',
    value: 100,
    previousValue: 90,
    changePercent: 11.11,
    trend: 'up',
    period: { start: new Date(), end: new Date() },
  },
  secondary: {
    engagement: { dau: 100, wau: 300, mau: 500, stickiness: 20, avgSessionDuration: 300 },
    retentionRate: { day1: 40, day7: 25, day30: 10 },
    tradingFrequency: { avgTradesPerUser: 5, avgTradesPerActiveUser: 10, totalTrades: 500 },
    conversionRate: { signupToFirstTrade: 10, visitorToSignup: 5, trialToSubscription: 80 },
    registrationRate: { value: 5, previousValue: 4, changePercent: 25 },
  },
  calculatedAt: new Date(),
});

describe('DashboardService', () => {
  beforeEach(() => {
    clearMockData();
  });

  describe('getOverview', () => {
    it('should return dashboard overview', async () => {
      const result = await dashboardService.getOverview(7);

      expect(result).toBeDefined();
      expect(result.northStar).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.period).toBeDefined();
      expect(result.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('getFunnels', () => {
    it('should return funnel data', async () => {
      const result = await dashboardService.getFunnels(30);

      expect(result).toBeDefined();
      expect(result.signupToTrade).toBeDefined();
      expect(result.strategyExecution).toBeDefined();
      expect(result.subscriptionConversion).toBeDefined();
    });
  });

  describe('getFeatureUsage', () => {
    it('should return feature usage data', async () => {
      seedMockData('user_tracking_events', [
        { id: '1', event_name: 'Create Strategy', event_category: 'strategy', user_id: 'user1', event_type: 'feature_used', occurred_at: new Date().toISOString() },
        { id: '2', event_name: 'Backtest', event_category: 'backtest', user_id: 'user2', event_type: 'feature_used', occurred_at: new Date().toISOString() },
      ]);

      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const result = await dashboardService.getFeatureUsage(weekAgo, now);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getActivityHeatmap', () => {
    it('should return activity heatmap', async () => {
      seedMockData('user_tracking_events', [
        { id: '1', event_type: 'page_view', occurred_at: new Date().toISOString(), event_category: 'navigation', event_name: 'view' },
      ]);

      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const result = await dashboardService.getActivityHeatmap(weekAgo, now);

      expect(result).toBeDefined();
      expect(result.type).toBe('hourly');
      expect(result.data.length).toBe(168); // 24 hours x 7 days
    });
  });

  describe('getMetricTrends', () => {
    it('should return metric trends', async () => {
      seedMockData('metric_snapshots', [
        { id: '1', metric_name: 'dau', value: 100, calculated_at: new Date().toISOString() },
        { id: '2', metric_name: 'dau', value: 95, calculated_at: new Date(Date.now() - 86400000).toISOString() },
      ]);

      const result = await dashboardService.getMetricTrends('dau', 30);

      expect(result).toBeDefined();
      expect(result.metricName).toBe('dau');
      expect(result.trend).toBeDefined();
    });
  });

  describe('getRealTimeStats', () => {
    it('should return real-time stats', async () => {
      seedMockData('user_tracking_events', [
        { id: '1', user_id: 'user1', event_type: 'page_view', page_url: '/dashboard', occurred_at: new Date().toISOString(), session_id: 's1', event_category: 'navigation', event_name: 'view' },
      ]);

      const result = await dashboardService.getRealTimeStats();

      expect(result).toBeDefined();
      expect(result.activeUsers).toBeDefined();
      expect(result.eventsLastHour).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });
});