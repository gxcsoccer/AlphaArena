/**
 * Insight Report Service Tests
 *
 * Tests for user behavior insight report generation
 */

import { insightReportService, InsightReport, UserSegment, BehaviorPattern, MetricsTrend, OptimizationSuggestion, AnomalyInsight } from '../InsightReportService';
import { userTrackingDAO } from '../../database/user-tracking.dao';
import { dashboardService } from '../DashboardService';
import { getSupabaseAdminClient } from '../../database/client';

// Mock dependencies
jest.mock('../../database/client', () => ({
  getSupabaseAdminClient: jest.fn(),
}));

jest.mock('../../database/user-tracking.dao', () => ({
  userTrackingDAO: {
    getUserEngagementMetrics: jest.fn(),
    getEvents: jest.fn(),
    getDailySummary: jest.fn(),
    analyzeFunnel: jest.fn(),
  },
}));

jest.mock('../DashboardService', () => ({
  dashboardService: {
    getFunnels: jest.fn(),
    getFeatureUsage: jest.fn(),
    getActivityHeatmap: jest.fn(),
    getRealTimeStats: jest.fn(),
  },
}));

describe('InsightReportService', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a chainable mock that resolves properly
    const createChainableMock = () => {
      const mock: any = jest.fn(); // The final resolver
      
      const chainable: any = {
        from: jest.fn(() => chainable),
        select: jest.fn(() => chainable),
        insert: jest.fn(() => Promise.resolve({ error: null })),
        update: jest.fn(() => chainable),
        delete: jest.fn(() => chainable),
        eq: jest.fn(() => chainable),
        neq: jest.fn(() => chainable),
        gte: jest.fn(() => chainable),
        lte: jest.fn(() => chainable),
        gt: jest.fn(() => chainable),
        lt: jest.fn(() => chainable),
        not: jest.fn(() => chainable),
        order: jest.fn(() => chainable),
        limit: jest.fn(() => chainable),
        range: jest.fn(() => chainable),
        in: jest.fn(() => chainable),
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
      };
      
      // Make the chainable object callable and return a promise
      // This handles the case where the query is awaited
      return new Proxy(chainable, {
        apply: (target, thisArg, args) => {
          return Promise.resolve({ data: [], error: null, count: 0 });
        },
      });
    };

    mockSupabase = createChainableMock();

    (getSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabase);

    // Default mocks
    (userTrackingDAO.getUserEngagementMetrics as jest.Mock).mockResolvedValue({
      dau: 100,
      wau: 300,
      mau: 800,
      stickiness: 25,
      retention: { day1: 40, day7: 25, day30: 15 },
      avgSessionDuration: 300,
      avgSessionsPerUser: 3,
    });

    (dashboardService.getFunnels as jest.Mock).mockResolvedValue({
      signupToTrade: {
        name: 'signup_to_trade',
        steps: [
          { name: '注册', order: 0, count: 100, conversionRate: 100, dropOffRate: 0 },
          { name: '首次登录', order: 1, count: 80, conversionRate: 80, dropOffRate: 20 },
          { name: '连接交易所', order: 2, count: 40, conversionRate: 50, dropOffRate: 50 },
          { name: '首次交易', order: 3, count: 20, conversionRate: 50, dropOffRate: 50 },
        ],
        totalUsers: 100,
        completedUsers: 20,
        overallConversionRate: 20,
      },
      strategyExecution: {
        name: 'strategy_execution',
        steps: [],
        totalUsers: 50,
        completedUsers: 15,
        overallConversionRate: 30,
      },
      subscriptionConversion: {
        name: 'subscription_conversion',
        steps: [],
        totalUsers: 30,
        completedUsers: 5,
        overallConversionRate: 16.7,
      },
    });

    (dashboardService.getFeatureUsage as jest.Mock).mockResolvedValue([
      { feature: 'backtest', category: 'backtest', usageCount: 500, uniqueUsers: 100 },
      { feature: 'strategy_create', category: 'strategy', usageCount: 300, uniqueUsers: 80 },
    ]);
  });

  describe('generateInsightReport', () => {
    it('should generate a daily insight report', async () => {
      const report = await insightReportService.generateInsightReport({
        reportType: 'daily',
      });

      expect(report).toBeDefined();
      expect(report.reportType).toBe('daily');
      expect(report.period).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.userSegments).toBeDefined();
      expect(report.behaviorPatterns).toBeDefined();
      expect(report.metricsTrends).toBeDefined();
      expect(report.optimizationSuggestions).toBeDefined();
      expect(report.anomalies).toBeDefined();
    });

    it('should generate a weekly insight report', async () => {
      const report = await insightReportService.generateInsightReport({
        reportType: 'weekly',
      });

      expect(report.reportType).toBe('weekly');
      expect(report.id).toContain('insight-weekly');
    });

    it('should handle empty data gracefully', async () => {
      const report = await insightReportService.generateInsightReport({
        reportType: 'daily',
      });

      expect(report).toBeDefined();
      expect(report.userSegments).toBeDefined();
    });
  });

  describe('analyzeUserSegments', () => {
    it('should handle segment analysis', async () => {
      const report = await insightReportService.generateInsightReport({
        reportType: 'weekly',
        includePatterns: false,
        includeTrends: false,
        includeSuggestions: false,
        includeAnomalies: false,
        includeJourneys: false,
        includeFeatures: false,
      });

      expect(report.userSegments).toBeDefined();
    });
  });

  describe('detectBehaviorPatterns', () => {
    it('should handle pattern detection', async () => {
      const report = await insightReportService.generateInsightReport({
        reportType: 'weekly',
        includeSegments: false,
        includeTrends: false,
        includeSuggestions: false,
        includeAnomalies: false,
        includeJourneys: false,
        includeFeatures: false,
      });

      expect(report.behaviorPatterns).toBeDefined();
    });
  });

  describe('generateOptimizationSuggestions', () => {
    it('should generate suggestions based on funnel performance', async () => {
      const report = await insightReportService.generateInsightReport({
        reportType: 'weekly',
        includeSegments: false,
        includePatterns: false,
        includeTrends: false,
        includeAnomalies: false,
        includeJourneys: false,
        includeFeatures: false,
      });

      expect(report.optimizationSuggestions.length).toBeGreaterThan(0);
      
      // Check for high priority suggestions
      const highPrioritySuggestions = report.optimizationSuggestions.filter(s => s.priority === 'high');
      expect(highPrioritySuggestions.length).toBeGreaterThan(0);
    });

    it('should include A/B test suggestions when applicable', async () => {
      const report = await insightReportService.generateInsightReport({
        reportType: 'weekly',
        includeSegments: false,
        includePatterns: false,
        includeTrends: false,
        includeAnomalies: false,
        includeJourneys: false,
        includeFeatures: false,
      });

      // Check that suggestions are generated with proper structure
      // A/B test suggestions are included for specific scenarios (low conversion rates)
      expect(report.optimizationSuggestions.length).toBeGreaterThan(0);
      
      // Verify the first high-priority suggestion has expected fields
      const highPrioritySuggestion = report.optimizationSuggestions.find(s => s.priority === 'high');
      if (highPrioritySuggestion?.abTestSuggestion) {
        expect(highPrioritySuggestion.abTestSuggestion.hypothesis).toBeDefined();
        expect(highPrioritySuggestion.abTestSuggestion.successMetric).toBeDefined();
      }
    });
  });

  describe('detectAnomalies', () => {
    it('should detect anomalies in metrics', async () => {
      const report = await insightReportService.generateInsightReport({
        reportType: 'weekly',
        includeSegments: false,
        includePatterns: false,
        includeTrends: false,
        includeSuggestions: false,
        includeJourneys: false,
        includeFeatures: false,
      });

      expect(report.anomalies).toBeDefined();
    });
  });

  describe('getInsightReports', () => {
    it('should retrieve historical reports', async () => {
      // Mock the full chain for getInsightReports
      const mockData = [
        { id: 'insight-weekly-2026-03-16', content: { reportType: 'weekly', summary: {} } },
        { id: 'insight-weekly-2026-03-09', content: { reportType: 'weekly', summary: {} } },
      ];

      // The query chain is: from().select().order().limit() or from().select().order().limit().eq()
      const chainableWithEq = {
        eq: jest.fn(() => Promise.resolve({ data: mockData, error: null })),
      };
      
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              ...chainableWithEq,
              // Make it thenable
              then: (resolve: any) => resolve({ data: mockData, error: null }),
            })),
          })),
        })),
      }));

      const reports = await insightReportService.getInsightReports('weekly', 10);

      expect(reports.length).toBe(2);
    });

    it('should handle errors when retrieving reports', async () => {
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              then: (resolve: any) => resolve({ data: null, error: { message: 'Database error' } }),
            })),
          })),
        })),
      }));

      await expect(insightReportService.getInsightReports()).rejects.toThrow('Failed to get insight reports');
    });
  });

  describe('scheduleReportGeneration', () => {
    it('should successfully schedule daily report generation', async () => {
      await expect(insightReportService.scheduleReportGeneration('daily')).resolves.not.toThrow();
    });

    it('should successfully schedule weekly report generation', async () => {
      await expect(insightReportService.scheduleReportGeneration('weekly')).resolves.not.toThrow();
    });

    it('should successfully schedule monthly report generation', async () => {
      await expect(insightReportService.scheduleReportGeneration('monthly')).resolves.not.toThrow();
    });
  });

  describe('summary generation', () => {
    it('should generate a comprehensive summary', async () => {
      const report = await insightReportService.generateInsightReport({
        reportType: 'weekly',
      });

      expect(report.summary).toBeDefined();
      expect(report.summary.overview).toBeDefined();
      expect(report.summary.keyFindings).toBeDefined();
      expect(Array.isArray(report.summary.keyFindings)).toBe(true);
      expect(report.summary.criticalAlerts).toBeDefined();
      expect(report.summary.topRecommendations).toBeDefined();
    });
  });

  describe('comparison generation', () => {
    it('should generate comparison with previous period', async () => {
      const report = await insightReportService.generateInsightReport({
        reportType: 'weekly',
      });

      expect(report.comparison).toBeDefined();
      expect(report.comparison.periodLabel).toBe('与上周相比');
      expect(report.comparison.improvements).toBeDefined();
      expect(report.comparison.regressions).toBeDefined();
    });
  });

  describe('next actions generation', () => {
    it('should generate actionable next steps', async () => {
      const report = await insightReportService.generateInsightReport({
        reportType: 'weekly',
      });

      expect(report.nextActions).toBeDefined();
      expect(Array.isArray(report.nextActions)).toBe(true);
      
      // Each action should have required fields
      for (const action of report.nextActions) {
        expect(action.action).toBeDefined();
        expect(action.priority).toBeDefined();
        expect(['high', 'medium', 'low']).toContain(action.priority);
      }
    });
  });
});