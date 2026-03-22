/**
 * MetricsService Tests
 *
 * @module analytics/__tests__/MetricsService.test
 */

import { MetricsService } from '../MetricsService';
import { seedMockData, clearMockData } from '../../database/client';

// Mock dependencies
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
// Note: database/client is automatically mocked via moduleNameMapper in jest.config.js

describe('MetricsService', () => {
  let metricsService: MetricsService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2024-01-15T12:00:00Z'));
    clearMockData();
    metricsService = new MetricsService();
  });

  afterEach(() => {
    jest.useRealTimers();
    clearMockData();
  });

  describe('calculateNorthStarMetric', () => {
    it('should calculate weekly active trading users', async () => {
      // Seed mock data for current period and previous period
      const now = new Date('2024-01-15T12:00:00Z');
      const currentPeriodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const previousPeriodStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      
      seedMockData('user_tracking_events', [
        // Current period orders
        { user_id: 'user1', event_type: 'order_placed', occurred_at: now.toISOString() },
        { user_id: 'user2', event_type: 'order_placed', occurred_at: now.toISOString() },
        { user_id: 'user1', event_type: 'order_placed', occurred_at: now.toISOString() }, // duplicate
        { user_id: 'user3', event_type: 'order_placed', occurred_at: now.toISOString() },
        // Previous period orders
        { user_id: 'user1', event_type: 'order_placed', occurred_at: previousPeriodStart.toISOString() },
        { user_id: 'user2', event_type: 'order_placed', occurred_at: previousPeriodStart.toISOString() },
      ]);

      const result = await metricsService.calculateNorthStarMetric();

      expect(result.name).toBe('weekly_active_trading_users');
      expect(result.value).toBe(3); // 3 unique users in current period
      expect(result.previousValue).toBe(2); // 2 unique users in previous period
    });

    it('should handle zero previous value', async () => {
      const now = new Date('2024-01-15T12:00:00Z');
      
      // Only current period data, no previous period data
      seedMockData('user_tracking_events', [
        { user_id: 'user1', event_type: 'order_placed', occurred_at: now.toISOString() },
      ]);

      const result = await metricsService.calculateNorthStarMetric();

      expect(result.value).toBe(1);
      expect(result.previousValue).toBe(0);
      expect(result.changePercent).toBe(0);
    });
  });

  describe('getKeyMetrics', () => {
    it('should return all key metrics', async () => {
      const now = new Date('2024-01-15T12:00:00Z');
      
      seedMockData('user_tracking_events', [
        { user_id: 'u1', event_type: 'order_placed', occurred_at: now.toISOString() },
      ]);
      seedMockData('metric_snapshots', []);

      const result = await metricsService.getKeyMetrics();

      expect(result.northStar).toBeDefined();
      expect(result.northStar.name).toBe('weekly_active_trading_users');
      expect(result.calculatedAt).toBeInstanceOf(Date);
    });
  });

  describe('storeMetricSnapshot', () => {
    it('should store metric snapshot in database', async () => {
      const snapshot = {
        metricName: 'test_metric',
        value: 100,
        period: 'daily' as const,
        periodStart: new Date(),
        periodEnd: new Date(),
      };

      // Should not throw
      await expect(metricsService.storeMetricSnapshot(snapshot)).resolves.not.toThrow();
    });
  });

  describe('getMetricHistory', () => {
    it('should retrieve metric history', async () => {
      seedMockData('metric_snapshots', [
        { metric_name: 'dau', calculated_at: '2024-01-03T00:00:00Z', value: 110 },
        { metric_name: 'dau', calculated_at: '2024-01-02T00:00:00Z', value: 105 },
        { metric_name: 'dau', calculated_at: '2024-01-01T00:00:00Z', value: 100 },
      ]);

      const result = await metricsService.getMetricHistory('dau', 30);

      expect(result.length).toBe(3);
      expect(result[0].value).toBeDefined();
    });
  });

  describe('calculateSecondaryMetrics', () => {
    it('should calculate all secondary metrics', async () => {
      const now = new Date('2024-01-15T12:00:00Z');
      
      seedMockData('user_tracking_events', [
        { user_id: 'u1', event_type: 'user_signup', occurred_at: now.toISOString() },
        { user_id: 'u2', event_type: 'user_signup', occurred_at: now.toISOString() },
        { user_id: 'u1', event_type: 'order_placed', occurred_at: now.toISOString() },
      ]);

      const result = await metricsService.calculateSecondaryMetrics(7);

      expect(result.engagement).toBeDefined();
      expect(result.retentionRate).toBeDefined();
      expect(result.tradingFrequency).toBeDefined();
      expect(result.conversionRate).toBeDefined();
      expect(result.registrationRate).toBeDefined();
    });
  });
});