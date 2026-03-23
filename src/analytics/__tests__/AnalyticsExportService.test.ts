/**
 * Analytics Export Service Tests
 */

import { AnalyticsExportService } from '../AnalyticsExportService';

// Mock dependencies
jest.mock('../DashboardService', () => ({
  dashboardService: {
    getFullDashboard: jest.fn(() => ({
      overview: {
        northStar: {
          name: 'weekly_active_trading_users',
          value: 100,
          previousValue: 90,
          changePercent: 11.1,
          trend: 'up',
        },
        metrics: {
          engagement: { dau: 50, wau: 100, mau: 200, stickiness: 25 },
          registrationRate: { value: 5, previousValue: 4, changePercent: 25 },
          tradingFrequency: { avgTradesPerUser: 2, avgTradesPerActiveUser: 5, totalTrades: 500 },
        },
      },
      funnels: {
        signupToTrade: {
          name: 'signup_to_trade',
          steps: [
            { name: '注册', order: 0, count: 100, conversionRate: 100, dropOffRate: 0 },
            { name: '首次交易', order: 1, count: 10, conversionRate: 10, dropOffRate: 90 },
          ],
          totalUsers: 100,
          completedUsers: 10,
          overallConversionRate: 10,
        },
      },
      featureUsage: [
        { feature: 'trading', category: 'trading', usageCount: 500, uniqueUsers: 50 },
      ],
      realtime: {
        activeUsers: 25,
        pageViewsLastHour: 100,
        eventsLastHour: 200,
        topPages: [],
        topEvents: [],
        timestamp: new Date(),
      },
    })),
    getFunnels: jest.fn(() => ({
      signupToTrade: {
        name: 'signup_to_trade',
        steps: [],
        totalUsers: 100,
        completedUsers: 10,
        overallConversionRate: 10,
      },
    })),
  },
}));

jest.mock('../MetricsService', () => ({
  metricsService: {
    getKeyMetrics: jest.fn(() => ({
      northStar: {
        name: 'weekly_active_trading_users',
        value: 100,
        previousValue: 90,
        changePercent: 11.1,
        trend: 'up',
      },
      secondary: {
        engagement: { dau: 50, wau: 100, mau: 200, stickiness: 25 },
        registrationRate: { value: 5, previousValue: 4, changePercent: 25 },
        tradingFrequency: { avgTradesPerUser: 2, avgTradesPerActiveUser: 5, totalTrades: 500 },
      },
      calculatedAt: new Date(),
    })),
    getMetricHistory: jest.fn(() => []),
  },
}));

jest.mock('../ReportGenerator', () => ({
  reportGenerator: {
    generateDailyReport: jest.fn(() => ({
      date: '2026-06-15',
      type: 'daily',
      metrics: { dau: 50, newSignups: 10, trades: 100, avgSessionDuration: 300 },
      comparison: { dauChange: 5, signupsChange: 10, tradesChange: -2 },
      topPages: [],
      topEvents: [],
      alerts: [],
      generatedAt: new Date(),
    })),
    generateWeeklyReport: jest.fn(() => ({
      period: { start: '2026-06-08', end: '2026-06-15' },
      type: 'weekly',
      summary: {
        northStar: { name: '周活跃交易用户', value: 100, changePercent: 11.1, trend: '上升' },
        highlights: ['周活跃交易用户增长 11.1%'],
        concerns: [],
      },
      metrics: { wau: 100, newSignups: 50, trades: 500, retention: { day1: 50, day7: 25, day30: 10 }, conversionRate: 10 },
      comparison: { wauChange: 11.1, signupsChange: 20, tradesChange: 5, retentionChange: 2 },
      funnels: { signupToTrade: { steps: [] }, strategyExecution: { steps: [] } },
      dailyBreakdown: [],
      alerts: [],
      generatedAt: new Date(),
    })),
  },
}));

jest.mock('../ErrorLogService', () => ({
  errorLogService: {
    getErrorSummary: jest.fn(() => ({
      totalErrors: 50,
      uniqueErrors: 10,
      byErrorCode: [{ code: 'VALIDATION_ERROR', count: 20, percentage: 40 }],
      byPath: [{ path: '/api/test', count: 10 }],
      byUser: [],
      recentErrors: [],
      errorRate: 5.2,
      trend: 'stable',
    })),
    getErrorTrends: jest.fn(() => [
      { date: '2026-06-15', count: 10, byCode: { VALIDATION_ERROR: 5 } },
    ]),
  },
}));

jest.mock('../../database/user-tracking.dao', () => ({
  userTrackingDAO: {
    getEvents: jest.fn(() => []),
    getDailySummary: jest.fn(() => []),
    getUserEngagementMetrics: jest.fn(() => ({
      dau: 50,
      wau: 100,
      mau: 200,
      stickiness: 25,
      retention: { day1: 50, day7: 25, day30: 10 },
      avgSessionDuration: 300,
      avgSessionsPerUser: 2,
    })),
  },
}));

jest.mock('../../database/client', () => ({
  getSupabaseAdminClient: jest.fn(),
}));

describe('AnalyticsExportService', () => {
  let service: AnalyticsExportService;

  beforeEach(() => {
    service = new AnalyticsExportService();
    jest.clearAllMocks();
  });

  describe('exportDashboard', () => {
    it('should export dashboard as JSON', async () => {
      const result = await service.exportDashboard({
        format: 'json',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-15'),
      });

      expect(result).toBeDefined();
      expect(result.contentType).toBe('application/json');
      expect(result.filename).toContain('dashboard');
      expect(result.filename).toContain('.json');
      expect(result.size).toBeGreaterThan(0);
    });

    it('should export dashboard as CSV', async () => {
      const result = await service.exportDashboard({
        format: 'csv',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-15'),
      });

      expect(result).toBeDefined();
      expect(result.contentType).toBe('text/csv');
      expect(result.filename).toContain('.csv');
      expect(result.content).toContain('# Dashboard Overview');
    });
  });

  describe('exportMetrics', () => {
    it('should export metrics as JSON', async () => {
      const result = await service.exportMetrics({
        format: 'json',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-15'),
      });

      expect(result).toBeDefined();
      expect(result.contentType).toBe('application/json');
      expect(result.filename).toContain('metrics');
    });
  });

  describe('exportReport', () => {
    it('should export daily report', async () => {
      const result = await service.exportReport('daily', { format: 'json' });

      expect(result).toBeDefined();
      expect(result.filename).toContain('report-daily');
    });

    it('should export weekly report', async () => {
      const result = await service.exportReport('weekly', { format: 'json' });

      expect(result).toBeDefined();
      expect(result.filename).toContain('report-weekly');
    });
  });

  describe('exportErrorLogs', () => {
    it('should export error logs as CSV', async () => {
      const result = await service.exportErrorLogs({
        format: 'csv',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-15'),
      });

      expect(result).toBeDefined();
      expect(result.contentType).toBe('text/csv');
      expect(result.content).toContain('# Error Logs Summary');
    });
  });

  describe('exportAsJson', () => {
    it('should correctly format JSON export', async () => {
      const data = { test: 'value', nested: { key: 123 } };
      const result = (service as any).exportAsJson(
        data,
        'test',
        new Date('2026-06-01'),
        new Date('2026-06-15')
      );

      expect(result.contentType).toBe('application/json');
      expect(result.filename).toBe('analytics_test_2026-06-01_2026-06-15.json');
      
      const parsed = JSON.parse(result.content);
      expect(parsed.test).toBe('value');
      expect(parsed.nested.key).toBe(123);
    });
  });

  describe('exportDashboardAsCsv', () => {
    it('should include all dashboard sections', async () => {
      const dashboard = {
        overview: {
          northStar: { name: 'watu', value: 100, previousValue: 90, changePercent: 11.1, trend: 'up' },
          metrics: {
            engagement: { dau: 50, wau: 100, mau: 200, stickiness: 25 },
            registrationRate: { value: 5 },
            tradingFrequency: { avgTradesPerUser: 2 },
          },
        },
        funnels: {
          signupToTrade: {
            steps: [
              { name: '注册', order: 0, count: 100, conversionRate: 100, dropOffRate: 0 },
            ],
          },
        },
        featureUsage: [
          { feature: 'trading', category: 'trading', usageCount: 500, uniqueUsers: 50 },
        ],
        realtime: { activeUsers: 25, pageViewsLastHour: 100, eventsLastHour: 200 },
      };

      const result = (service as any).exportDashboardAsCsv(
        dashboard,
        new Date('2026-06-01'),
        new Date('2026-06-15')
      );

      expect(result.content).toContain('# Dashboard Overview');
      expect(result.content).toContain('## North Star Metric');
      expect(result.content).toContain('## Secondary Metrics');
      expect(result.content).toContain('## Funnel Analysis');
      expect(result.content).toContain('## Top Features');
      expect(result.content).toContain('## Real-time Stats');
    });
  });
});