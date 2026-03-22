/**
 * DashboardService Tests
 *
 * @module analytics/__tests__/DashboardService.test
 */

import { DashboardService } from '../DashboardService';
import { metricsService } from '../MetricsService';
import { userTrackingDAO } from '../../database/user-tracking.dao';
import { seedMockData, clearMockData } from '../../database/client';

// Mock dependencies
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
    analyzeFunnel: jest.fn().mockResolvedValue({
      name: 'signup_to_trade',
      steps: [
        { name: '注册', order: 0, completedCount: 100, conversionRate: 100, dropOffRate: 0 },
        { name: '首次交易', order: 1, completedCount: 10, conversionRate: 10, dropOffRate: 90 },
      ],
      totalUsers: 100,
      completedUsers: 10,
      overallConversionRate: 10,
    }),
  },
}));
// Note: '../../database/client' is automatically mocked via moduleNameMapper in jest.config.js

describe('DashboardService', () => {
  let dashboardService: DashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    clearMockData();
    dashboardService = new DashboardService();
  });

  afterEach(() => {
    clearMockData();
  });

  describe('getOverview', () => {
    it('should return dashboard overview', async () => {
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
          engagement: { dau: 100, wau: 300, mau: 500, stickiness: 20 },
          retentionRate: { day1: 40, day7: 25, day30: 10 },
          tradingFrequency: { avgTradesPerUser: 5, totalTrades: 500 },
          conversionRate: { signupToFirstTrade: 10 },
          registrationRate: { value: 5, changePercent: 0 },
        },
        calculatedAt: new Date(),
      });

      const result = await dashboardService.getOverview(7);

      expect(result.northStar).toBeDefined();
      expect(result.northStar.value).toBe(100);
      expect(result.metrics).toBeDefined();
      expect(result.period).toBeDefined();
    });
  });

  describe('getFunnels', () => {
    it('should return funnel analysis', async () => {
      const result = await dashboardService.getFunnels(30);

      expect(result.signupToTrade).toBeDefined();
      expect(result.signupToTrade.steps.length).toBe(2);
      expect(result.signupToTrade.overallConversionRate).toBe(10);
    });
  });

  describe('getFeatureUsage', () => {
    it('should return feature usage data', async () => {
      // Seed mock data for feature usage query
      seedMockData('user_tracking_events', [
        { event_name: 'Create Strategy', event_category: 'strategy', user_id: 'u1', occurred_at: new Date().toISOString() },
        { event_name: 'Create Strategy', event_category: 'strategy', user_id: 'u2', occurred_at: new Date().toISOString() },
        { event_name: 'Run Backtest', event_category: 'backtest', user_id: 'u1', occurred_at: new Date().toISOString() },
      ]);

      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = new Date();
      const result = await dashboardService.getFeatureUsage(startDate, endDate);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].feature).toBeDefined();
      expect(result[0].usageCount).toBeGreaterThan(0);
    });
  });

  describe('getActivityHeatmap', () => {
    it('should return activity heatmap', async () => {
      const now = new Date();
      const events = [];
      
      for (let i = 0; i < 100; i++) {
        const date = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
        events.push({ occurred_at: date.toISOString() });
      }

      seedMockData('user_tracking_events', events);

      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = new Date();
      const result = await dashboardService.getActivityHeatmap(startDate, endDate);

      expect(result.type).toBe('hourly');
      expect(result.data.length).toBe(24 * 7);
      expect(result.maxValue).toBeGreaterThanOrEqual(result.minValue);
    });
  });

  describe('getMetricTrends', () => {
    it('should return metric trends', async () => {
      seedMockData('metric_snapshots', [
        { metric_name: 'dau', calculated_at: '2024-01-03T00:00:00Z', value: 110 },
        { metric_name: 'dau', calculated_at: '2024-01-02T00:00:00Z', value: 105 },
        { metric_name: 'dau', calculated_at: '2024-01-01T00:00:00Z', value: 100 },
      ]);

      const result = await dashboardService.getMetricTrends('dau', 30);

      expect(result.metricName).toBe('dau');
      expect(result.data.length).toBe(3);
      expect(result.trend).toBeDefined();
    });
  });

  describe('getRealTimeStats', () => {
    it('should return real-time statistics', async () => {
      const now = new Date().toISOString();
      seedMockData('user_tracking_events', [
        { user_id: 'u1', occurred_at: now, event_type: 'page_view', page_url: '/dashboard' },
        { user_id: 'u2', occurred_at: now, event_type: 'page_view', page_url: '/dashboard' },
        { user_id: 'u1', occurred_at: now, event_type: 'order_placed', page_url: '/strategies' },
      ]);

      const result = await dashboardService.getRealTimeStats();

      expect(result.activeUsers).toBeDefined();
      expect(result.topPages).toBeDefined();
      expect(result.topEvents).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('getFullDashboard', () => {
    it('should return complete dashboard data', async () => {
      (metricsService.getKeyMetrics as jest.Mock).mockResolvedValue({
        northStar: { value: 100, trend: 'up' },
        secondary: { engagement: { dau: 100 } },
        calculatedAt: new Date(),
      });

      seedMockData('user_tracking_events', []);
      seedMockData('metric_snapshots', []);

      const result = await dashboardService.getFullDashboard(7);

      expect(result.overview).toBeDefined();
      expect(result.funnels).toBeDefined();
      expect(result.featureUsage).toBeDefined();
      expect(result.heatmap).toBeDefined();
      expect(result.realTime).toBeDefined();
    });
  });
});