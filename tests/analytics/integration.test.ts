/**
 * Analytics Integration Tests
 *
 * Integration tests for analytics services using mock database
 *
 * @module tests/analytics/integration.test
 */

import { 
  seedMockData, 
  clearMockData,
  getSupabaseAdminClient
} from '../__mocks__/supabase';

// Mock dependencies
jest.mock('../../src/utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock database client
jest.mock('../../src/database/client', () => require('../__mocks__/supabase'));

jest.mock('../../src/database/user-tracking.dao', () => ({
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
    getDailySummary: jest.fn().mockResolvedValue([]),
  },
}));

// Import after mocking
import { metricsService } from '../../src/analytics/MetricsService';
import { reportGenerator } from '../../src/analytics/ReportGenerator';

describe('Analytics Integration Tests', () => {
  beforeEach(() => {
    clearMockData();
  });

  describe('MetricsService with Mock Data', () => {
    describe('calculateNorthStarMetric', () => {
      it('should calculate weekly active trading users correctly', async () => {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Seed mock tracking events
        seedMockData('user_tracking_events', [
          { id: '1', user_id: 'user1', event_type: 'order_placed', occurred_at: now.toISOString(), event_category: 'trading', event_name: 'order' },
          { id: '2', user_id: 'user2', event_type: 'order_placed', occurred_at: weekAgo.toISOString(), event_category: 'trading', event_name: 'order' },
          { id: '3', user_id: 'user1', event_type: 'order_placed', occurred_at: weekAgo.toISOString(), event_category: 'trading', event_name: 'order' },
        ]);

        const result = await metricsService.calculateNorthStarMetric({
          startDate: weekAgo,
          endDate: now,
        });

        expect(result.name).toBe('weekly_active_trading_users');
        expect(result.value).toBe(2); // user1 and user2
        expect(result.trend).toBeDefined();
      });

      it('should handle empty data gracefully', async () => {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const result = await metricsService.calculateNorthStarMetric({
          startDate: weekAgo,
          endDate: now,
        });

        expect(result.value).toBe(0);
        expect(result.changePercent).toBe(0);
      });
    });

    describe('getKeyMetrics', () => {
      it('should return all key metrics', async () => {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const result = await metricsService.getKeyMetrics({
          startDate: weekAgo,
          endDate: now,
        });

        expect(result.northStar).toBeDefined();
        expect(result.secondary).toBeDefined();
        expect(result.calculatedAt).toBeInstanceOf(Date);
      });
    });

    describe('storeMetricSnapshot', () => {
      it('should store metric snapshot in database', async () => {
        const now = new Date();
        const snapshot = {
          metricType: 'north_star' as const,
          metricName: 'weekly_active_trading_users',
          value: 100,
          previousValue: 90,
          changePercent: 11.11,
          calculatedAt: now,
          periodStart: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          periodEnd: now,
        };

        const result = await metricsService.storeMetricSnapshot(snapshot);

        expect(result.id).toBeDefined();
        expect(result.metricName).toBe('weekly_active_trading_users');
        expect(result.value).toBe(100);
      });
    });
  });

  describe('ReportGenerator', () => {
    describe('detectAnomaly', () => {
      it('should detect high severity anomaly for significant deviation', async () => {
        const historicalValues = [100, 101, 99, 100, 102, 98, 100];
        const currentValue = 200;

        const result = await reportGenerator.detectAnomaly(
          'test_metric',
          currentValue,
          historicalValues
        );

        expect(result.isAnomaly).toBe(true);
        expect(result.severity).toBe('high');
        expect(result.deviationPercent).toBeGreaterThan(50);
      });

      it('should not detect anomaly for normal values', async () => {
        const historicalValues = [100, 101, 99, 100, 102, 98, 100];
        const currentValue = 101;

        const result = await reportGenerator.detectAnomaly(
          'test_metric',
          currentValue,
          historicalValues
        );

        expect(result.isAnomaly).toBe(false);
      });

      it('should handle insufficient historical data', async () => {
        const historicalValues = [100, 105];
        const currentValue = 100;

        const result = await reportGenerator.detectAnomaly(
          'test_metric',
          currentValue,
          historicalValues
        );

        expect(result.isAnomaly).toBe(false);
        expect(result.expectedValue).toBe(currentValue);
      });

      it('should detect medium severity anomaly for moderate deviation', async () => {
        const historicalValues = [100, 100, 100, 100, 100, 100, 100];
        const currentValue = 150;

        const result = await reportGenerator.detectAnomaly(
          'test_metric',
          currentValue,
          historicalValues
        );

        expect(result.isAnomaly).toBe(true);
        expect(result.severity).toBe('high');
      });
    });

    describe('generateDailyReport', () => {
      it('should generate daily report with correct structure', async () => {
        // Seed some tracking events
        const today = new Date().toISOString().split('T')[0];
        
        seedMockData('user_tracking_events', [
          { id: '1', user_id: 'user1', event_type: 'page_view', page_url: '/dashboard', occurred_at: `${today}T10:00:00Z`, session_id: 's1', event_category: 'navigation', event_name: 'view' },
          { id: '2', user_id: 'user2', event_type: 'page_view', page_url: '/strategies', occurred_at: `${today}T11:00:00Z`, session_id: 's2', event_category: 'navigation', event_name: 'view' },
          { id: '3', user_id: 'user1', event_type: 'order_placed', occurred_at: `${today}T12:00:00Z`, event_category: 'trading', event_name: 'order' },
        ]);

        seedMockData('user_sessions', [
          { id: 's1', session_id: 's1', user_id: 'user1', first_event_at: `${today}T10:00:00Z`, duration_seconds: 300 },
          { id: 's2', session_id: 's2', user_id: 'user2', first_event_at: `${today}T11:00:00Z`, duration_seconds: 600 },
        ]);

        const report = await reportGenerator.generateDailyReport();

        expect(report.type).toBe('daily');
        expect(report.date).toBeDefined();
        expect(report.metrics).toBeDefined();
        expect(report.comparison).toBeDefined();
        expect(report.alerts).toBeDefined();
        expect(report.generatedAt).toBeInstanceOf(Date);
      });
    });

    describe('generateWeeklyReport', () => {
      it('should generate weekly report with correct structure', async () => {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Seed weekly tracking events
        const events = [];
        for (let i = 0; i < 7; i++) {
          const date = new Date(weekAgo.getTime() + i * 24 * 60 * 60 * 1000);
          const dateStr = date.toISOString().split('T')[0];
          events.push(
            { id: `event-${i}-1`, user_id: `user${i}`, event_type: 'page_view', page_url: '/dashboard', occurred_at: `${dateStr}T10:00:00Z`, session_id: `s${i}`, event_category: 'navigation', event_name: 'view' },
            { id: `event-${i}-2`, user_id: `user${i}`, event_type: 'order_placed', occurred_at: `${dateStr}T12:00:00Z`, event_category: 'trading', event_name: 'order' }
          );
        }

        seedMockData('user_tracking_events', events);

        const report = await reportGenerator.generateWeeklyReport();

        expect(report.type).toBe('weekly');
        expect(report.period).toBeDefined();
        expect(report.summary).toBeDefined();
        expect(report.metrics).toBeDefined();
        expect(report.funnels).toBeDefined();
        expect(report.generatedAt).toBeInstanceOf(Date);
      });
    });
  });

  describe('End-to-End Analytics Flow', () => {
    it('should support complete metrics collection workflow', async () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Seed comprehensive test data
      seedMockData('user_tracking_events', [
        { id: '1', user_id: 'user1', event_type: 'user_signup', occurred_at: weekAgo.toISOString(), event_category: 'auth', event_name: 'signup' },
        { id: '2', user_id: 'user2', event_type: 'user_signup', occurred_at: weekAgo.toISOString(), event_category: 'auth', event_name: 'signup' },
        { id: '3', user_id: 'user1', event_type: 'page_view', page_url: '/dashboard', occurred_at: now.toISOString(), session_id: 's1', event_category: 'navigation', event_name: 'view' },
        { id: '4', user_id: 'user2', event_type: 'page_view', page_url: '/strategies', occurred_at: now.toISOString(), session_id: 's2', event_category: 'navigation', event_name: 'view' },
        { id: '5', user_id: 'user1', event_type: 'order_placed', occurred_at: now.toISOString(), event_category: 'trading', event_name: 'order' },
        { id: '6', user_id: 'user2', event_type: 'order_placed', occurred_at: now.toISOString(), event_category: 'trading', event_name: 'order' },
      ]);

      // Get key metrics
      const metrics = await metricsService.getKeyMetrics({
        startDate: weekAgo,
        endDate: now,
      });

      expect(metrics.northStar).toBeDefined();
      expect(metrics.secondary).toBeDefined();
      expect(metrics.calculatedAt).toBeInstanceOf(Date);

      // Store the metric
      const snapshot = await metricsService.storeMetricSnapshot({
        metricType: 'north_star',
        metricName: metrics.northStar.name,
        value: metrics.northStar.value,
        previousValue: metrics.northStar.previousValue,
        changePercent: metrics.northStar.changePercent,
        calculatedAt: metrics.calculatedAt,
        periodStart: metrics.northStar.period.start,
        periodEnd: metrics.northStar.period.end,
      });

      expect(snapshot.id).toBeDefined();
    });
  });
});