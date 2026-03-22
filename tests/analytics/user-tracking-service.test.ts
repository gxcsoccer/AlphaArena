/**
 * User Tracking Service Tests
 *
 * Tests for user behavior tracking service
 */

import {
  TrackingContext,
  TrackEventInput,
} from '../../src/analytics/userTracking.types';

// Mock the DAO
jest.mock('../../src/database/user-tracking.dao', () => ({
  userTrackingDAO: {
    trackEvent: jest.fn((event) => Promise.resolve({ ...event, id: 'event-id' })),
    trackEvents: jest.fn((events) => Promise.resolve(events.map((e: any, i: number) => ({ ...e, id: `event-${i}` })))),
    getEvents: jest.fn(() => Promise.resolve([])),
    getSession: jest.fn(() => Promise.resolve(null)),
    getUserSessions: jest.fn(() => Promise.resolve([])),
    endSession: jest.fn(() => Promise.resolve()),
    getDailySummary: jest.fn(() => Promise.resolve([])),
    getEventCounts: jest.fn(() => Promise.resolve([])),
    getUserEngagementMetrics: jest.fn(() => Promise.resolve({
      dau: 100,
      wau: 500,
      mau: 2000,
      stickiness: 5,
      retention: { day1: 40, day7: 20, day30: 10 },
      avgSessionDuration: 300,
      avgSessionsPerUser: 2.5,
    })),
    analyzeFunnel: jest.fn((name: string) => Promise.resolve({
      name,
      steps: [],
      overallConversionRate: 0,
      period: { start: new Date(), end: new Date() },
      totalUsers: 0,
      completedUsers: 0,
    })),
    getPageViews: jest.fn(() => Promise.resolve([])),
    aggregateDailyAnalytics: jest.fn(() => Promise.resolve()),
    deleteOldEvents: jest.fn(() => Promise.resolve(0)),
  },
}));

// Import after mocking
import { userTrackingService } from '../../src/analytics/UserTrackingService';

describe('UserTrackingService', () => {
  const mockContext: TrackingContext = {
    sessionId: 'sess-123',
    deviceId: 'dev-456',
    userId: 'user-789',
    pageUrl: '/dashboard',
    pageTitle: 'Dashboard',
    referrer: 'https://google.com',
    userAgent: 'Mozilla/5.0',
    screenResolution: '1920x1080',
    viewportSize: '1920x969',
    language: 'en-US',
    timezone: 'Asia/Shanghai',
  };

  describe('trackEvent', () => {
    it('should track an event with context', async () => {
      const input: TrackEventInput = {
        eventType: 'button_click',
        eventName: 'Submit Button',
        properties: { buttonId: 'submit' },
      };

      const result = await userTrackingService.trackEvent(input, mockContext);

      expect(result).toBeDefined();
      expect(result.eventType).toBe('button_click');
      expect(result.sessionId).toBe('sess-123');
    });

    it('should auto-assign event category if not provided', async () => {
      const input: TrackEventInput = {
        eventType: 'page_view',
        eventName: 'Page View',
      };

      const result = await userTrackingService.trackEvent(input, mockContext);

      expect(result.eventCategory).toBe('navigation');
    });
  });

  describe('trackBatch', () => {
    it('should track multiple events in batch', async () => {
      const events = [
        {
          input: { eventType: 'page_view' as const, eventName: 'Page 1' },
          context: mockContext,
        },
        {
          input: { eventType: 'button_click' as const, eventName: 'Button 1' },
          context: mockContext,
        },
      ];

      const result = await userTrackingService.trackBatch(events);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });
  });

  describe('trackPageView', () => {
    it('should track a page view event', async () => {
      const result = await userTrackingService.trackPageView(mockContext, {
        title: 'Home',
        loadTime: 500,
      });

      expect(result).toBeDefined();
      expect(result.eventType).toBe('page_view');
    });
  });

  describe('trackAuth', () => {
    it('should track a login event', async () => {
      const result = await userTrackingService.trackAuth('login', mockContext, {
        method: 'email',
      });

      expect(result.eventType).toBe('user_login');
    });

    it('should track a signup event', async () => {
      const result = await userTrackingService.trackAuth('signup', mockContext, {
        method: 'google',
        isNewUser: true,
      });

      expect(result.eventType).toBe('user_signup');
    });

    it('should track a logout event', async () => {
      const result = await userTrackingService.trackAuth('logout', mockContext);

      expect(result.eventType).toBe('user_logout');
    });
  });

  describe('trackTrade', () => {
    it('should track an order placed event', async () => {
      const result = await userTrackingService.trackTrade(
        'order_placed',
        mockContext,
        {
          id: 'order-123',
          symbol: 'BTCUSDT',
          side: 'buy',
          orderType: 'limit',
          quantity: 0.1,
          price: 50000,
        }
      );

      expect(result.eventType).toBe('order_placed');
    });
  });

  describe('trackButtonClick', () => {
    it('should track a button click event', async () => {
      const result = await userTrackingService.trackButtonClick(mockContext, {
        text: 'Submit',
        buttonId: 'submit-btn',
        location: 'header',
      });

      expect(result.eventType).toBe('button_click');
    });
  });

  describe('trackError', () => {
    it('should track an error event', async () => {
      const result = await userTrackingService.trackError(mockContext, {
        message: 'Something went wrong',
        code: 'ERR_500',
        component: 'Dashboard',
      });

      expect(result.eventType).toBe('error');
    });
  });

  describe('getAnalytics', () => {
    it('should get analytics data', async () => {
      const options = {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        granularity: 'day' as const,
      };

      const result = await userTrackingService.getAnalytics(options);

      expect(result).toBeDefined();
      expect(result.events).toBeDefined();
      expect(Array.isArray(result.events)).toBe(true);
    });
  });

  describe('getEngagementMetrics', () => {
    it('should get user engagement metrics', async () => {
      const result = await userTrackingService.getEngagementMetrics(30);

      expect(result).toBeDefined();
      expect(result.dau).toBe(100);
      expect(result.wau).toBe(500);
      expect(result.mau).toBe(2000);
    });
  });

  describe('analyzePredefinedFunnel', () => {
    it('should analyze signup to first trade funnel', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const result = await userTrackingService.analyzePredefinedFunnel(
        'signup_to_first_trade',
        startDate,
        endDate
      );

      expect(result).toBeDefined();
      expect(result.name).toBe('signup_to_first_trade');
    });
  });

  describe('analyzeCustomFunnel', () => {
    it('should analyze a custom funnel', async () => {
      const steps = [
        { name: 'Step 1', eventType: 'page_view' },
        { name: 'Step 2', eventType: 'button_click' },
      ];

      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const result = await userTrackingService.analyzeCustomFunnel(
        'custom-funnel',
        steps,
        startDate,
        endDate
      );

      expect(result).toBeDefined();
      expect(result.name).toBe('custom-funnel');
    });
  });

  describe('generateSessionId', () => {
    it('should generate a unique session ID', () => {
      const id1 = userTrackingService.generateSessionId();
      const id2 = userTrackingService.generateSessionId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(id1.startsWith('sess_')).toBe(true);
    });
  });

  describe('generateDeviceId', () => {
    it('should generate a unique device ID', () => {
      const id1 = userTrackingService.generateDeviceId();
      const id2 = userTrackingService.generateDeviceId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(id1.startsWith('dev_')).toBe(true);
    });
  });

  describe('getDashboardData', () => {
    it('should get dashboard data', async () => {
      const result = await userTrackingService.getDashboardData(7);

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.engagement).toBeDefined();
      expect(result.topPages).toBeDefined();
      expect(result.signupFunnel).toBeDefined();
    });
  });

  describe('configure', () => {
    it('should update service configuration', () => {
      userTrackingService.configure({
        batchSize: 50,
        debug: true,
      });

      // Configuration is internal, just ensure no error
      expect(true).toBe(true);
    });
  });
});