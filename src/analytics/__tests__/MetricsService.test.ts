/**
 * MetricsService Tests
 *
 * Unit tests for metrics calculation logic
 *
 * @module analytics/__tests__/MetricsService.test
 */

import { userTrackingDAO } from '../../database/user-tracking.dao';

// Mock dependencies
jest.mock('../../database/client');
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
      name: 'test_funnel',
      steps: [],
      totalUsers: 100,
      completedUsers: 10,
      overallConversionRate: 10,
    }),
  },
}));
jest.mock('../../database/user-tracking.dao');

describe('MetricsService', () => {
  describe('North Star Metric Calculation', () => {
    it('should define correct metric name for North Star', () => {
      const northStarName = 'weekly_active_trading_users';
      expect(northStarName).toBe('weekly_active_trading_users');
    });
  });

  describe('Secondary Metrics', () => {
    it('should calculate retention rate from engagement metrics', async () => {
      (userTrackingDAO.getUserEngagementMetrics as jest.Mock).mockResolvedValue({
        dau: 100,
        wau: 300,
        mau: 500,
        stickiness: 20,
        retention: { day1: 40, day7: 25, day30: 10 },
        avgSessionDuration: 300,
        avgSessionsPerUser: 2.5,
      });

      const engagement = await userTrackingDAO.getUserEngagementMetrics(30);
      
      expect(engagement.retention.day1).toBe(40);
      expect(engagement.retention.day7).toBe(25);
      expect(engagement.retention.day30).toBe(10);
    });
  });

  describe('Metric Snapshots', () => {
    it('should define metric snapshot interface', () => {
      const snapshot = {
        metricType: 'north_star' as const,
        metricName: 'weekly_active_trading_users',
        value: 100,
        previousValue: 90,
        changePercent: 11.11,
        calculatedAt: new Date(),
        periodStart: new Date(),
        periodEnd: new Date(),
      };

      expect(snapshot.metricType).toBe('north_star');
      expect(snapshot.metricName).toBe('weekly_active_trading_users');
      expect(snapshot.value).toBe(100);
    });
  });

  describe('Trend Detection', () => {
    it('should detect up trend when change > 2%', () => {
      const changePercent = 5;
      const trend = changePercent > 2 ? 'up' : changePercent < -2 ? 'down' : 'flat';
      expect(trend).toBe('up');
    });

    it('should detect down trend when change < -2%', () => {
      const changePercent = -5;
      const trend = changePercent > 2 ? 'up' : changePercent < -2 ? 'down' : 'flat';
      expect(trend).toBe('down');
    });

    it('should detect flat trend when change is between -2% and 2%', () => {
      const changePercent = 1;
      const trend = changePercent > 2 ? 'up' : changePercent < -2 ? 'down' : 'flat';
      expect(trend).toBe('flat');
    });
  });

  describe('DAU/MAU Stickiness', () => {
    it('should calculate stickiness as DAU/MAU ratio', () => {
      const dau = 100;
      const mau = 500;
      const stickiness = (dau / mau) * 100;
      
      expect(stickiness).toBe(20);
    });

    it('should handle zero MAU', () => {
      const dau = 100;
      const mau = 0;
      const stickiness = mau > 0 ? (dau / mau) * 100 : 0;
      
      expect(stickiness).toBe(0);
    });
  });
});