/**
 * ReportGenerator Tests
 *
 * @module analytics/__tests__/ReportGenerator.test
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

// Explicitly mock database client
jest.mock('../../database/client', () => require('../../../tests/__mocks__/supabase'));

jest.mock('../MetricsService');
jest.mock('../DashboardService');
jest.mock('../../database/user-tracking.dao', () => ({
  userTrackingDAO: {
    getUserEngagementMetrics: jest.fn().mockResolvedValue({
      dau: 100,
      wau: 300,
      mau: 500,
      stickiness: 20,
      retention: { day1: 40, day7: 25, day30: 10 },
      avgSessionDuration: 300,
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

// Import after mocks are set up
import { reportGenerator } from '../ReportGenerator';
import { seedMockData, clearMockData } from '../../../tests/__mocks__/supabase';
import { metricsService } from '../MetricsService';
import { dashboardService } from '../DashboardService';

// Mock metricsService return values
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
    engagement: { dau: 100, wau: 300, mau: 500, stickiness: 20, avgSessionDuration: 300 },
    retentionRate: { day1: 40, day7: 25, day30: 10 },
    tradingFrequency: { avgTradesPerUser: 5, avgTradesPerActiveUser: 10, totalTrades: 500 },
    conversionRate: { signupToFirstTrade: 10, visitorToSignup: 5, trialToSubscription: 80 },
    registrationRate: { value: 5, previousValue: 4, changePercent: 25 },
  },
  calculatedAt: new Date(),
});

// Mock dashboardService return values
(dashboardService.getOverview as jest.Mock).mockResolvedValue({
  northStar: {
    name: 'weekly_active_trading_users',
    value: 100,
    previousValue: 90,
    changePercent: 11.11,
    trend: 'up',
    period: { start: new Date(), end: new Date() },
  },
  metrics: {},
  period: { start: new Date(), end: new Date() },
  updatedAt: new Date(),
});

(dashboardService.getFunnels as jest.Mock).mockResolvedValue({
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
  subscriptionConversion: {
    name: 'subscription_conversion',
    steps: [],
    totalUsers: 30,
    completedUsers: 3,
    overallConversionRate: 10,
  },
});

describe('ReportGenerator', () => {
  beforeEach(() => {
    clearMockData();
  });

  describe('generateDailyReport', () => {
    it('should generate daily report', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      seedMockData('user_tracking_events', [
        { id: '1', user_id: 'user1', event_type: 'page_view', page_url: '/dashboard', occurred_at: `${today}T10:00:00Z`, session_id: 's1', event_category: 'navigation', event_name: 'view' },
        { id: '2', user_id: 'user2', event_type: 'order_placed', occurred_at: `${today}T12:00:00Z`, event_category: 'trading', event_name: 'order' },
      ]);

      seedMockData('user_sessions', [
        { id: 's1', session_id: 's1', user_id: 'user1', first_event_at: `${today}T10:00:00Z`, duration_seconds: 300 },
      ]);

      const result = await reportGenerator.generateDailyReport();

      expect(result).toBeDefined();
      expect(result.type).toBe('daily');
      expect(result.date).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.alerts).toBeDefined();
    });
  });

  describe('generateWeeklyReport', () => {
    it('should generate weekly report', async () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Seed some events for the week
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

      const result = await reportGenerator.generateWeeklyReport();

      expect(result).toBeDefined();
      expect(result.type).toBe('weekly');
      expect(result.period).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.funnels).toBeDefined();
    });
  });

  describe('detectAnomaly', () => {
    it('should detect high severity anomaly', async () => {
      const historicalValues = [100, 101, 99, 100, 102, 98, 100];
      const currentValue = 200;

      const result = await reportGenerator.detectAnomaly('test_metric', currentValue, historicalValues);

      expect(result.isAnomaly).toBe(true);
      expect(result.severity).toBe('high');
    });

    it('should not detect anomaly for normal values', async () => {
      const historicalValues = [100, 101, 99, 100, 102, 98, 100];
      const currentValue = 101;

      const result = await reportGenerator.detectAnomaly('test_metric', currentValue, historicalValues);

      expect(result.isAnomaly).toBe(false);
    });

    it('should handle insufficient data', async () => {
      const historicalValues = [100];
      const currentValue = 100;

      const result = await reportGenerator.detectAnomaly('test_metric', currentValue, historicalValues);

      expect(result.isAnomaly).toBe(false);
    });
  });

  describe('getReports', () => {
    it('should get reports from database', async () => {
      seedMockData('analytics_reports', [
        { id: '1', report_type: 'daily', report_date: new Date().toISOString().split('T')[0], content: {} },
      ]);

      const result = await reportGenerator.getReports('daily', 30);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});