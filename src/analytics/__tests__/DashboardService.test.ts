/**
 * DashboardService Tests
 *
 * Unit tests for dashboard service interfaces
 *
 * @module analytics/__tests__/DashboardService.test
 */

describe('DashboardService', () => {
  describe('DashboardOverview Interface', () => {
    it('should define correct overview structure', () => {
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

      expect(overview.northStar.name).toBe('weekly_active_trading_users');
      expect(overview.northStar.value).toBe(100);
      expect(overview.metrics.engagement.dau).toBe(100);
    });
  });

  describe('DashboardFunnel Interface', () => {
    it('should define correct funnel structure', () => {
      const funnel = {
        name: 'signup_to_trade',
        steps: [
          { name: '注册', order: 0, count: 100, conversionRate: 100, dropOffRate: 0 },
          { name: '首次交易', order: 1, count: 10, conversionRate: 10, dropOffRate: 90 },
        ],
        totalUsers: 100,
        completedUsers: 10,
        overallConversionRate: 10,
      };

      expect(funnel.name).toBe('signup_to_trade');
      expect(funnel.steps.length).toBe(2);
      expect(funnel.overallConversionRate).toBe(10);
    });
  });

  describe('RealTimeStats Interface', () => {
    it('should define correct real-time stats structure', () => {
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
      expect(realTime.pageViewsLastHour).toBe(150);
      expect(realTime.topPages.length).toBe(2);
    });
  });

  describe('ActivityHeatmap Interface', () => {
    it('should define correct heatmap structure', () => {
      const heatmap = {
        type: 'hourly' as const,
        data: [
          { hour: 14, day: 3, value: 150, normalizedValue: 75 },
        ],
        maxValue: 200,
        minValue: 0,
      };

      expect(heatmap.type).toBe('hourly');
      expect(heatmap.data.length).toBe(1);
      expect(heatmap.maxValue).toBe(200);
    });
  });
});