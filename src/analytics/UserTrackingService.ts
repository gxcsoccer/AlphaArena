/**
 * User Tracking Service
 *
 * Business logic for user behavior analytics and tracking
 *
 * @module analytics/UserTrackingService
 */

import { userTrackingDAO } from '../database/user-tracking.dao';
import { createLogger } from '../utils/logger';
import {
  TrackingEvent,
  UserSession,
  DailyAnalyticsSummary,
  UserAnalyticsQueryOptions,
  UserEngagementMetrics,
  FunnelAnalysis,
  TrackEventInput,
  TrackerConfig,
  TrackingContext,
  EVENT_CATEGORY_MAP,
  EventCategory,
  TrackingEventType,
} from './userTracking.types';

const log = createLogger('UserTrackingService');

/**
 * Predefined funnels for common user journeys
 */
const PREDEFINED_FUNNELS = {
  signup_to_first_trade: [
    { name: 'Sign Up', eventType: 'user_signup' as TrackingEventType },
    { name: 'Login', eventType: 'user_login' as TrackingEventType },
    { name: 'Connect Exchange', eventType: 'feature_used' as TrackingEventType },
    { name: 'First Order', eventType: 'order_placed' as TrackingEventType },
  ],
  strategy_execution: [
    { name: 'Create Strategy', eventType: 'strategy_created' as TrackingEventType },
    { name: 'Configure', eventType: 'form_submit' as TrackingEventType },
    { name: 'Start Strategy', eventType: 'strategy_started' as TrackingEventType },
    { name: 'First Trade', eventType: 'order_placed' as TrackingEventType },
  ],
  subscription_conversion: [
    { name: 'View Pricing', eventType: 'page_view' as TrackingEventType },
    { name: 'Click Subscribe', eventType: 'button_click' as TrackingEventType },
    { name: 'Complete Payment', eventType: 'subscription_started' as TrackingEventType },
  ],
};

/**
 * User Tracking Service
 */
class UserTrackingService {
  private config: TrackerConfig = {
    batchSize: 20,
    flushInterval: 5000,
    debug: false,
    respectDoNotTrack: true,
    autoTrackPageViews: true,
    trackPerformance: true,
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
  };

  /**
   * Update service configuration
   */
  configure(config: Partial<TrackerConfig>): void {
    this.config = { ...this.config, ...config };
    log.info('User tracking service configured', { config: this.config });
  }

  /**
   * Track a single event
   */
  async trackEvent(
    input: TrackEventInput,
    context: TrackingContext
  ): Promise<TrackingEvent> {
    const event = this.buildEvent(input, context);
    
    try {
      const tracked = await userTrackingDAO.trackEvent(event);
      log.debug('Event tracked', { 
        eventType: event.eventType, 
        eventName: event.eventName,
        sessionId: event.sessionId,
      });
      return tracked;
    } catch (error) {
      log.error('Failed to track event', { error, event });
      throw error;
    }
  }

  /**
   * Track multiple events in batch
   */
  async trackBatch(
    events: Array<{ input: TrackEventInput; context: TrackingContext }>
  ): Promise<TrackingEvent[]> {
    const builtEvents = events.map(({ input, context }) => 
      this.buildEvent(input, context)
    );
    
    try {
      const tracked = await userTrackingDAO.trackEvents(builtEvents);
      log.info('Batch events tracked', { count: tracked.length });
      return tracked;
    } catch (error) {
      log.error('Failed to track batch events', { error });
      throw error;
    }
  }

  /**
   * Build a tracking event from input and context
   */
  private buildEvent(
    input: TrackEventInput,
    context: TrackingContext
  ): TrackingEvent {
    const eventCategory = input.eventCategory || 
      EVENT_CATEGORY_MAP[input.eventType] || 
      'custom' as EventCategory;

    return {
      userId: context.userId,
      sessionId: context.sessionId,
      deviceId: context.deviceId,
      eventType: input.eventType,
      eventCategory,
      eventName: input.eventName,
      properties: input.properties || {},
      pageUrl: input.pageUrl || context.pageUrl,
      pageTitle: input.pageTitle || context.pageTitle,
      referrer: context.referrer,
      userAgent: context.userAgent,
      screenResolution: context.screenResolution,
      viewportSize: context.viewportSize,
      language: context.language,
      timezone: context.timezone,
      loadTimeMs: input.loadTimeMs,
      occurredAt: new Date(),
    };
  }

  /**
   * Track page view
   */
  async trackPageView(
    context: TrackingContext,
    properties?: {
      title?: string;
      loadTime?: number;
      from?: string;
    }
  ): Promise<TrackingEvent> {
    return this.trackEvent(
      {
        eventType: 'page_view',
        eventName: 'Page View',
        properties: {
          path: context.pageUrl,
          title: properties?.title || context.pageTitle,
          loadTime: properties?.loadTime,
          from: properties?.from,
        },
        loadTimeMs: properties?.loadTime,
      },
      context
    );
  }

  /**
   * Track user authentication event
   */
  async trackAuth(
    type: 'login' | 'signup' | 'logout',
    context: TrackingContext,
    properties?: {
      method?: 'email' | 'google' | 'apple' | 'wallet' | 'other';
      isNewUser?: boolean;
      plan?: 'free' | 'pro' | 'enterprise';
    }
  ): Promise<TrackingEvent> {
    const eventType = type === 'login' ? 'user_login' : 
                      type === 'signup' ? 'user_signup' : 'user_logout';
    
    return this.trackEvent(
      {
        eventType,
        eventName: type.charAt(0).toUpperCase() + type.slice(1),
        properties: properties || {},
      },
      context
    );
  }

  /**
   * Track trading event
   */
  async trackTrade(
    action: 'order_placed' | 'order_cancelled' | 'order_filled' | 'position_opened' | 'position_closed',
    context: TrackingContext,
    properties: {
      id: string;
      symbol?: string;
      side?: 'buy' | 'sell';
      orderType?: 'market' | 'limit' | 'stop' | 'stop_limit';
      quantity?: number;
      price?: number;
      strategyId?: string;
      success?: boolean;
      error?: string;
    }
  ): Promise<TrackingEvent> {
    return this.trackEvent(
      {
        eventType: action,
        eventName: action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        properties,
      },
      context
    );
  }

  /**
   * Track button click
   */
  async trackButtonClick(
    context: TrackingContext,
    properties: {
      text?: string;
      buttonId?: string;
      location?: string;
      intent?: string;
    }
  ): Promise<TrackingEvent> {
    return this.trackEvent(
      {
        eventType: 'button_click',
        eventName: 'Button Click',
        properties,
      },
      context
    );
  }

  /**
   * Track error
   */
  async trackError(
    context: TrackingContext,
    properties: {
      message: string;
      code?: string;
      stack?: string;
      component?: string;
      context?: Record<string, any>;
    }
  ): Promise<TrackingEvent> {
    return this.trackEvent(
      {
        eventType: 'error',
        eventName: 'Error',
        properties,
      },
      context
    );
  }

  /**
   * Get user sessions
   */
  async getUserSessions(userId: string, limit?: number): Promise<UserSession[]> {
    return userTrackingDAO.getUserSessions(userId, limit);
  }

  /**
   * Get analytics data
   */
  async getAnalytics(options: UserAnalyticsQueryOptions): Promise<{
    events: TrackingEvent[];
    summary?: DailyAnalyticsSummary[];
    counts?: Array<{ eventType: string; eventCategory: string; count: number }>;
  }> {
    const [events, summary, counts] = await Promise.all([
      userTrackingDAO.getEvents(options),
      options.granularity === 'day' ? userTrackingDAO.getDailySummary(options.startDate, options.endDate) : undefined,
      userTrackingDAO.getEventCounts(options),
    ]);

    return { events, summary, counts };
  }

  /**
   * Get user engagement metrics
   */
  async getEngagementMetrics(days?: number): Promise<UserEngagementMetrics> {
    return userTrackingDAO.getUserEngagementMetrics(days);
  }

  /**
   * Get page view analytics
   */
  async getPageAnalytics(
    startDate: Date,
    endDate: Date,
    limit?: number
  ): Promise<Array<{ url: string; views: number; uniqueVisitors: number }>> {
    return userTrackingDAO.getPageViews(startDate, endDate, limit);
  }

  /**
   * Analyze predefined funnel
   */
  async analyzePredefinedFunnel(
    funnelName: keyof typeof PREDEFINED_FUNNELS,
    startDate: Date,
    endDate: Date
  ): Promise<FunnelAnalysis> {
    const steps = PREDEFINED_FUNNELS[funnelName];
    return userTrackingDAO.analyzeFunnel(funnelName, steps, startDate, endDate);
  }

  /**
   * Analyze custom funnel
   */
  async analyzeCustomFunnel(
    name: string,
    steps: Array<{ name: string; eventType: string }>,
    startDate: Date,
    endDate: Date
  ): Promise<FunnelAnalysis> {
    return userTrackingDAO.analyzeFunnel(name, steps, startDate, endDate);
  }

  /**
   * Generate session ID
   */
  generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Generate device ID
   */
  generateDeviceId(): string {
    return `dev_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Get tracking context from request
   */
  getContextFromRequest(req: any, sessionId: string, deviceId?: string, userId?: string): TrackingContext {
    const userAgent = req.headers['user-agent'] || '';
    const forwarded = req.headers['x-forwarded-for'];
    const ip = typeof forwarded === 'string' ? forwarded.split(',')[0] : req.ip;
    
    return {
      sessionId,
      deviceId: deviceId || this.generateDeviceId(),
      userId,
      pageUrl: req.originalUrl || req.url,
      pageTitle: '',
      referrer: req.headers.referer || req.headers.referrer,
      userAgent,
      screenResolution: '',
      viewportSize: '',
      language: req.headers['accept-language']?.split(',')[0] || 'en',
      timezone: '',
    };
  }

  /**
   * Aggregate daily analytics
   */
  async runDailyAggregation(date?: Date): Promise<void> {
    const targetDate = date || new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday by default
    await userTrackingDAO.aggregateDailyAnalytics(targetDate);
    log.info('Daily analytics aggregated', { date: targetDate });
  }

  /**
   * Clean up old events
   */
  async cleanupOldEvents(olderThanDays: number = 365): Promise<number> {
    const deleted = await userTrackingDAO.deleteOldEvents(olderThanDays);
    log.info('Old events cleaned up', { count: deleted, olderThanDays });
    return deleted;
  }

  /**
   * Get analytics dashboard data
   */
  async getDashboardData(days: number = 7): Promise<{
    summary: DailyAnalyticsSummary[];
    engagement: UserEngagementMetrics;
    topPages: Array<{ url: string; views: number; uniqueVisitors: number }>;
    signupFunnel: FunnelAnalysis;
  }> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [summary, engagement, topPages, signupFunnel] = await Promise.all([
      userTrackingDAO.getDailySummary(startDate, endDate),
      userTrackingDAO.getUserEngagementMetrics(days),
      userTrackingDAO.getPageViews(startDate, endDate, 10),
      this.analyzePredefinedFunnel('signup_to_first_trade', startDate, endDate),
    ]);

    return { summary, engagement, topPages, signupFunnel };
  }
}

// Singleton instance
export { UserTrackingService };
export const userTrackingService = new UserTrackingService();
export default userTrackingService;