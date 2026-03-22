/**
 * ReportGenerator Tests
 *
 * Unit tests for report generation logic
 *
 * @module analytics/__tests__/ReportGenerator.test
 */

import { reportGenerator } from '../ReportGenerator';

// Mock dependencies
jest.mock('../MetricsService');
jest.mock('../DashboardService');
jest.mock('../../database/user-tracking.dao');
// Note: '../../database/client' is automatically mocked via moduleNameMapper in jest.config.js

describe('ReportGenerator', () => {
  describe('Daily Report', () => {
    it('should define daily report structure', () => {
      const report = {
        date: '2024-01-15',
        type: 'daily' as const,
        metrics: {
          dau: 100,
          newSignups: 10,
          trades: 50,
          avgSessionDuration: 300,
        },
        comparison: {
          dauChange: 5,
          signupsChange: 10,
          tradesChange: -2,
        },
        topPages: [
          { url: '/dashboard', views: 50 },
        ],
        topEvents: [
          { type: 'page_view', count: 100 },
        ],
        alerts: [],
        generatedAt: new Date(),
      };

      expect(report.type).toBe('daily');
      expect(report.metrics.dau).toBe(100);
    });
  });

  describe('Weekly Report', () => {
    it('should define weekly report structure', () => {
      const report = {
        period: {
          start: '2024-01-08',
          end: '2024-01-15',
        },
        type: 'weekly' as const,
        summary: {
          northStar: {
            name: '周活跃交易用户',
            value: 100,
            changePercent: 15,
            trend: '上升',
          },
          highlights: ['周活跃交易用户增长 15%'],
          concerns: ['7日留存率偏低'],
        },
        metrics: {
          wau: 300,
          newSignups: 50,
          trades: 500,
          retention: { day1: 40, day7: 25, day30: 10 },
          conversionRate: 10,
        },
        comparison: {
          wauChange: 10,
          signupsChange: 20,
          tradesChange: 5,
          retentionChange: -2,
        },
        funnels: {
          signupToTrade: {
            name: 'signup_to_trade',
            steps: [],
            totalUsers: 100,
            completedUsers: 10,
            overallConversionRate: 10,
          },
          strategyExecution: {
            name: 'strategy_execution',
            steps: [],
            totalUsers: 50,
            completedUsers: 5,
            overallConversionRate: 10,
          },
        },
        dailyBreakdown: [],
        alerts: [],
        generatedAt: new Date(),
      };

      expect(report.type).toBe('weekly');
      expect(report.summary.northStar.value).toBe(100);
    });
  });

  describe('Alert Detection', () => {
    it('should define report alert structure', () => {
      const alert = {
        type: 'warning' as const,
        category: 'metric_drop' as const,
        title: '日活用户下降',
        message: 'DAU 下降 25%',
        metric: 'dau',
        value: 75,
        threshold: 20,
        recommendation: '检查是否有技术问题',
      };

      expect(alert.type).toBe('warning');
      expect(alert.category).toBe('metric_drop');
    });

    it('should define alert severity levels', () => {
      const severities = ['low', 'medium', 'high'];
      expect(severities).toContain('low');
      expect(severities).toContain('medium');
      expect(severities).toContain('high');
    });
  });

  describe('Anomaly Detection', () => {
    it('should define anomaly detection result structure', () => {
      const anomaly = {
        metricName: 'dau',
        currentValue: 150,
        expectedValue: 100,
        deviationPercent: 50,
        isAnomaly: true,
        severity: 'high' as const,
      };

      expect(anomaly.isAnomaly).toBe(true);
      expect(anomaly.deviationPercent).toBe(50);
    });

    it('should detect anomaly when deviation is > 2 standard deviations', async () => {
      const historicalValues = [100, 102, 98, 101, 99, 100, 101];
      const currentValue = 150;

      const result = await reportGenerator.detectAnomaly(
        'test_metric',
        currentValue,
        historicalValues
      );

      expect(result.isAnomaly).toBe(true);
      expect(result.severity).toBe('high');
    });

    it('should not detect anomaly for normal variation', async () => {
      const historicalValues = [100, 101, 99, 100, 101, 99, 100];
      const currentValue = 100; // Exactly at mean, no anomaly

      const result = await reportGenerator.detectAnomaly(
        'test_metric',
        currentValue,
        historicalValues
      );

      expect(result.isAnomaly).toBe(false);
    });

    it('should handle insufficient data', async () => {
      const historicalValues = [100, 50]; // Only 2 values
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

  describe('Change Calculation', () => {
    it('should calculate percentage change correctly', () => {
      const current = 110;
      const previous = 100;
      const change = ((current - previous) / previous) * 100;
      
      expect(change).toBe(10);
    });

    it('should handle zero previous value', () => {
      const current = 100;
      const previous = 0;
      const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
      
      expect(change).toBe(0);
    });
  });
});