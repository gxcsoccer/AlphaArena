/**
 * ReportGenerator Tests
 *
 * @module analytics/__tests__/ReportGenerator.test
 */

import { reportGenerator } from '../ReportGenerator';
import { metricsService } from '../MetricsService';
import { dashboardService } from '../DashboardService';
import { userTrackingDAO } from '../../database/user-tracking.dao';
import { getSupabaseAdminClient } from '../../database/client';

// Mock dependencies
jest.mock('../MetricsService');
jest.mock('../DashboardService');
jest.mock('../../database/user-tracking.dao');
jest.mock('../../database/client');

describe('ReportGenerator', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    (getSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe('generateDailyReport', () => {
    it('should generate daily report with metrics', async () => {
      const date = new Date('2024-01-15');
      const dateStr = '2024-01-15';
      const prevDateStr = '2024-01-14';

      // Mock all the queries
      mockSupabase.select
        // Today's DAU
        .mockResolvedValueOnce({
          data: [
            { user_id: 'u1' },
            { user_id: 'u2' },
            { user_id: 'u1' }, // duplicate
          ],
        })
        // Today's signups
        .mockResolvedValueOnce({ count: 10, data: [] })
        // Today's trades
        .mockResolvedValueOnce({ count: 50, data: [] })
        // Session durations
        .mockResolvedValueOnce({
          data: [
            { duration_seconds: 300 },
            { duration_seconds: 600 },
          ],
        })
        // Previous day's DAU
        .mockResolvedValueOnce({
          data: [{ user_id: 'u1' }, { user_id: 'u2' }],
        })
        // Previous day's signups
        .mockResolvedValueOnce({ count: 8, data: [] })
        // Previous day's trades
        .mockResolvedValueOnce({ count: 45, data: [] })
        // Top pages
        .mockResolvedValueOnce({
          data: [
            { page_url: '/dashboard' },
            { page_url: '/strategies' },
          ],
        })
        // Top events
        .mockResolvedValueOnce({
          data: [
            { event_type: 'page_view' },
            { event_type: 'order_placed' },
          ],
        });

      // Mock storeReport
      mockSupabase.insert.mockResolvedValueOnce({ error: null });

      const result = await reportGenerator.generateDailyReport(date);

      expect(result.type).toBe('daily');
      expect(result.date).toBe(dateStr);
      expect(result.metrics.dau).toBe(2); // 2 unique users
      expect(result.metrics.newSignups).toBe(10);
      expect(result.metrics.trades).toBe(50);
      expect(result.comparison.dauChange).toBeDefined();
      expect(result.topPages).toBeDefined();
      expect(result.topEvents).toBeDefined();
      expect(result.alerts).toBeInstanceOf(Array);
    });

    it('should detect DAU drop anomaly', async () => {
      const date = new Date('2024-01-15');

      // Mock queries with significant DAU drop
      mockSupabase.select
        .mockResolvedValueOnce({
          data: [{ user_id: 'u1' }], // 1 user today
        })
        .mockResolvedValueOnce({ count: 5, data: [] })
        .mockResolvedValueOnce({ count: 20, data: [] })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({
          data: [{ user_id: 'u1' }, { user_id: 'u2' }, { user_id: 'u3' }], // 3 users yesterday
        })
        .mockResolvedValueOnce({ count: 6, data: [] })
        .mockResolvedValueOnce({ count: 25, data: [] })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] });

      mockSupabase.insert.mockResolvedValueOnce({ error: null });

      const result = await reportGenerator.generateDailyReport(date);

      // Should have a warning about DAU drop
      const dauAlert = result.alerts.find(a => a.metric === 'dau');
      expect(dauAlert).toBeDefined();
      expect(dauAlert?.type).toBe('warning');
      expect(dauAlert?.category).toBe('metric_drop');
    });

    it('should detect zero activity anomaly', async () => {
      const date = new Date('2024-01-15');

      // Mock queries with zero activity
      mockSupabase.select
        .mockResolvedValueOnce({ data: [] }) // no users
        .mockResolvedValueOnce({ count: 0, data: [] })
        .mockResolvedValueOnce({ count: 0, data: [] })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ count: 0, data: [] })
        .mockResolvedValueOnce({ count: 0, data: [] })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] });

      mockSupabase.insert.mockResolvedValueOnce({ error: null });

      const result = await reportGenerator.generateDailyReport(date);

      const criticalAlert = result.alerts.find(a => a.type === 'critical');
      expect(criticalAlert).toBeDefined();
      expect(criticalAlert?.title).toBe('无活跃用户');
    });
  });

  describe('generateWeeklyReport', () => {
    it('should generate weekly report with summary', async () => {
      // Mock overview
      (dashboardService.getOverview as jest.Mock).mockResolvedValue({
        northStar: {
          name: 'weekly_active_trading_users',
          value: 100,
          changePercent: 15,
          trend: 'up',
        },
        metrics: {
          engagement: { dau: 50, wau: 150, mau: 300 },
        },
      });

      // Mock funnels
      (dashboardService.getFunnels as jest.Mock).mockResolvedValue({
        signupToTrade: {
          steps: [],
          overallConversionRate: 10,
        },
        strategyExecution: {
          steps: [],
          overallConversionRate: 5,
        },
      });

      // Mock engagement
      (userTrackingDAO.getUserEngagementMetrics as jest.Mock).mockResolvedValue({
        wau: 150,
        retention: { day1: 40, day7: 25, day30: 10 },
      });

      // Mock daily summary
      (userTrackingDAO.getDailySummary as jest.Mock).mockResolvedValue([]);

      // Mock signups and trades
      mockSupabase.select
        .mockResolvedValueOnce({ count: 50, data: [] }) // signups
        .mockResolvedValueOnce({ count: 200, data: [] }) // trades
        .mockResolvedValueOnce({ count: 45, data: [] }) // previous signups
        .mockResolvedValueOnce({ count: 180, data: [] }); // previous trades

      mockSupabase.insert.mockResolvedValueOnce({ error: null });

      const result = await reportGenerator.generateWeeklyReport();

      expect(result.type).toBe('weekly');
      expect(result.period).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary.northStar).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.funnels).toBeDefined();
      expect(result.alerts).toBeInstanceOf(Array);
    });

    it('should generate highlights and concerns', async () => {
      (dashboardService.getOverview as jest.Mock).mockResolvedValue({
        northStar: {
          value: 100,
          changePercent: 25, // > 10%, should be highlight
          trend: 'up',
        },
      });

      (dashboardService.getFunnels as jest.Mock).mockResolvedValue({
        signupToTrade: { steps: [], overallConversionRate: 3 }, // < 5%, should be concern
        strategyExecution: { steps: [], overallConversionRate: 5 },
      });

      (userTrackingDAO.getUserEngagementMetrics as jest.Mock).mockResolvedValue({
        wau: 150,
        stickiness: 35, // > 30%, should be highlight
        retention: { day1: 40, day7: 15, day30: 10 }, // day7 < 20%, should be concern
      });

      (userTrackingDAO.getDailySummary as jest.Mock).mockResolvedValue([]);

      mockSupabase.select.mockResolvedValue({ count: 0, data: [] });
      mockSupabase.insert.mockResolvedValueOnce({ error: null });

      const result = await reportGenerator.generateWeeklyReport();

      expect(result.summary.highlights.length).toBeGreaterThan(0);
      expect(result.summary.concerns.length).toBeGreaterThan(0);
    });
  });

  describe('detectAnomaly', () => {
    it('should detect anomaly when deviation is significant', async () => {
      const historicalValues = [100, 102, 98, 101, 99, 100, 101];
      const currentValue = 150; // Significant deviation

      const result = await reportGenerator.detectAnomaly(
        'test_metric',
        currentValue,
        historicalValues
      );

      expect(result.isAnomaly).toBe(true);
      expect(result.deviationPercent).toBeGreaterThan(40);
      expect(result.severity).toBe('high');
    });

    it('should not detect anomaly for normal variation', async () => {
      const historicalValues = [100, 102, 98, 101, 99, 100, 101];
      const currentValue = 103; // Within normal range

      const result = await reportGenerator.detectAnomaly(
        'test_metric',
        currentValue,
        historicalValues
      );

      expect(result.isAnomaly).toBe(false);
    });

    it('should handle insufficient data', async () => {
      const historicalValues = [100, 50]; // Only 2 values, need 7+
      const currentValue = 100;

      const result = await reportGenerator.detectAnomaly(
        'test_metric',
        currentValue,
        historicalValues
      );

      expect(result.isAnomaly).toBe(false);
      expect(result.expectedValue).toBe(currentValue);
    });
  });

  describe('getReports', () => {
    it('should retrieve historical reports', async () => {
      mockSupabase.select.mockResolvedValueOnce({
        data: [
          {
            content: {
              type: 'daily',
              date: '2024-01-15',
              metrics: { dau: 100 },
            },
          },
          {
            content: {
              type: 'daily',
              date: '2024-01-14',
              metrics: { dau: 95 },
            },
          },
        ],
        error: null,
      });

      const result = await reportGenerator.getReports('daily', 30);

      expect(result.length).toBe(2);
      expect(result[0].type).toBe('daily');
    });
  });
});