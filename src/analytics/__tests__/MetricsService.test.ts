/**
 * MetricsService Tests
 *
 * @module analytics/__tests__/MetricsService.test
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

// Explicitly mock database client - this is needed because relative paths 
// don't match the moduleNameMapper pattern in jest.config.js
jest.mock('../../database/client', () => require('../../../tests/__mocks__/supabase'));

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

// Import after mocks are set up
import { metricsService } from '../MetricsService';
import { seedMockData, clearMockData } from '../../../tests/__mocks__/supabase';

describe('MetricsService', () => {
  beforeEach(() => {
    clearMockData();
  });

  describe('calculateNorthStarMetric', () => {
    it('should return North Star metric', async () => {
      // Seed some trading events
      seedMockData('user_tracking_events', [
        { id: '1', user_id: 'user1', event_type: 'order_placed', occurred_at: new Date().toISOString(), event_category: 'trading', event_name: 'order' },
        { id: '2', user_id: 'user2', event_type: 'order_placed', occurred_at: new Date().toISOString(), event_category: 'trading', event_name: 'order' },
      ]);

      const result = await metricsService.calculateNorthStarMetric();

      expect(result).toBeDefined();
      expect(result.name).toBe('weekly_active_trading_users');
      expect(result.value).toBeDefined();
      expect(result.trend).toBeDefined();
    });
  });

  describe('calculateSecondaryMetrics', () => {
    it('should return secondary metrics', async () => {
      const result = await metricsService.calculateSecondaryMetrics();

      expect(result).toBeDefined();
      expect(result.engagement).toBeDefined();
      expect(result.retentionRate).toBeDefined();
      expect(result.tradingFrequency).toBeDefined();
      expect(result.conversionRate).toBeDefined();
    });
  });

  describe('getKeyMetrics', () => {
    it('should return all key metrics', async () => {
      seedMockData('user_tracking_events', [
        { id: '1', user_id: 'user1', event_type: 'order_placed', occurred_at: new Date().toISOString(), event_category: 'trading', event_name: 'order' },
      ]);

      const result = await metricsService.getKeyMetrics();

      expect(result).toBeDefined();
      expect(result.northStar).toBeDefined();
      expect(result.secondary).toBeDefined();
      expect(result.calculatedAt).toBeInstanceOf(Date);
    });
  });

  describe('getMetricHistory', () => {
    it('should return metric history', async () => {
      seedMockData('metric_snapshots', [
        { id: '1', metric_name: 'dau', value: 100, calculated_at: new Date().toISOString() },
      ]);

      const result = await metricsService.getMetricHistory('dau');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('storeMetricSnapshot', () => {
    it('should store metric snapshot', async () => {
      const result = await metricsService.storeMetricSnapshot({
        metricType: 'north_star',
        metricName: 'weekly_active_trading_users',
        value: 100,
        previousValue: 90,
        changePercent: 11.11,
        calculatedAt: new Date(),
        periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        periodEnd: new Date(),
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });
  });
});