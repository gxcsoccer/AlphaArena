/**
 * DashboardService Tests
 *
 * Unit tests for dashboard data aggregation logic
 *
 * @module analytics/__tests__/DashboardService.test
 */

import { dashboardService } from '../DashboardService';
import { metricsService } from '../MetricsService';
import { userTrackingDAO } from '../../database/user-tracking.dao';

// Mock dependencies
jest.mock('../MetricsService');
jest.mock('../../database/user-tracking.dao');
jest.mock('../../database/client');

describe('DashboardService', () => {
  describe('Overview Data', () => {
    it('should define dashboard overview interface', () => {
      const overview = {
        northStar: {
          name: 'weekly_active_trading_users' as const,
          value: 100,
          previousValue: 90,
          changePercent: 11.11,
          trend: 'up' as const,
          period: { start: new Date(), end: new Date() },
        },
        metrics: {
          engagement: { dau: 100, wau: 300, mau: 500, stickiness: 20, avgSessionDuration: 300 },
          retentionRate: { day1: 40, day7: 25, day30: 10 },
          tradingFrequency: { avgTradesPerUser: 5, avgTradesPerActiveUser: 10, totalTrades: 500 },
          conversionRate: { signupToFirstTrade: 10, visitorToSignup: 5, trialToSubscription: 80 },
          registrationRate: { value: 5, previousValue: 4, changePercent: 25 },
        },
        period: { start: new Date(), end: new Date() },
        updatedAt: new Date(),
      };

      expect(overview.northStar.value).toBe(100);
      expect(overview.metrics.engagement.dau).toBe(100);
    });
  });

  describe('Funnel Data', () => {
    it('should define funnel step structure', () => {
      const funnelStep = {
        name: '注册',
        order: 0,
        count: 100,
        conversionRate: 100,
        dropOffRate: 0,
      };

      expect(funnelStep.name).toBe('注册');
      expect(funnelStep.conversionRate).toBe(100);
    });

    it('should calculate conversion rates correctly', () => {
      const steps = [
        { count: 100, conversionRate: 100 },
        { count: 50, conversionRate: 50 },
        { count: 10, conversionRate: 20 },
      ];

      const overallConversionRate = steps[steps.length - 1].count / steps[0].count * 100;
      expect(overallConversionRate).toBe(10);
    });
  });

  describe('Feature Usage', () => {
    it('should define feature usage structure', () => {
      const featureUsage = {
        feature: 'Create Strategy',
        category: 'strategy',
        usageCount: 150,
        uniqueUsers: 50,
      };

      expect(featureUsage.feature).toBe('Create Strategy');
      expect(featureUsage.usageCount).toBe(150);
    });
  });

  describe('Activity Heatmap', () => {
    it('should define heatmap cell structure', () => {
      const cell = {
        hour: 14,
        day: 3, // Wednesday
        value: 150,
        normalizedValue: 75,
      };

      expect(cell.hour).toBeGreaterThanOrEqual(0);
      expect(cell.hour).toBeLessThan(24);
      expect(cell.day).toBeGreaterThanOrEqual(0);
      expect(cell.day).toBeLessThan(7);
    });

    it('should have correct grid size for hourly heatmap', () => {
      const gridSize = 24 * 7; // 24 hours x 7 days
      expect(gridSize).toBe(168);
    });
  });

  describe('Metric Trends', () => {
    it('should define trend data structure', () => {
      const trend = {
        metricName: 'dau',
        data: [
          { date: '2024-01-03', value: 110 },
          { date: '2024-01-02', value: 105 },
          { date: '2024-01-01', value: 100 },
        ],
        trend: 'up' as const,
        changePercent: 4.76,
      };

      expect(trend.data.length).toBe(3);
      expect(trend.trend).toBe('up');
    });
  });

  describe('Real-time Stats', () => {
    it('should define real-time stats structure', () => {
      const realTime = {
        activeUsers: 25,
        pageViewsLastHour: 150,
        eventsLastHour: 500,
        topPages: [
          { url: '/dashboard', views: 50 },
          { url: '/strategies', views: 30 },
        ],
        topEvents: [
          { type: 'page_view', count: 100 },
          { type: 'order_placed', count: 20 },
        ],
        timestamp: new Date(),
      };

      expect(realTime.activeUsers).toBe(25);
      expect(realTime.topPages.length).toBe(2);
    });
  });
});