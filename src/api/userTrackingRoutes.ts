/**
 * User Tracking Routes
 *
 * API endpoints for user behavior analytics and tracking
 *
 * @module api/userTrackingRoutes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { userTrackingService } from '../analytics/UserTrackingService';
import { userTrackingDAO } from '../database/user-tracking.dao';
import { createLogger } from '../utils/logger';
import {
  TrackEventsRequest,
  GetAnalyticsRequest,
  TrackingEvent,
  TrackingEventType,
  EventCategory,
} from '../analytics/userTracking.types';

const log = createLogger('UserTrackingRoutes');

const router = Router();

/**
 * POST /api/tracking/events
 * Track one or more events
 */
router.post('/events', async (req: Request, res: Response) => {
  try {
    const { events } = req.body as TrackEventsRequest;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Events array is required and must not be empty',
      });
    }

    // Validate events
    for (const event of events) {
      if (!event.sessionId) {
        return res.status(400).json({
          error: 'Invalid event',
          message: 'Each event must have a sessionId',
        });
      }
      if (!event.eventType) {
        return res.status(400).json({
          error: 'Invalid event',
          message: 'Each event must have an eventType',
        });
      }
    }

    // Track events directly (they already have all required fields)
    const trackedEvents = await userTrackingDAO.trackEvents(events as TrackingEvent[]);

    log.info('Events tracked', { count: trackedEvents.length });

    res.json({
      success: true,
      received: events.length,
      processed: trackedEvents.length,
    });
  } catch (error: any) {
    log.error('Failed to track events:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tracking/event
 * Track a single event (simplified client API)
 */
router.post('/event', async (req: Request, res: Response) => {
  try {
    const { eventType, eventName, sessionId, userId, properties, ...rest } = req.body;

    if (!eventType || !sessionId) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'eventType and sessionId are required',
      });
    }

    // Build context from request
    const context = userTrackingService.getContextFromRequest(
      req,
      sessionId,
      rest.deviceId,
      userId
    );

    // Track the event
    const event = await userTrackingService.trackEvent(
      {
        eventType,
        eventName: eventName || eventType,
        properties: properties || {},
        pageUrl: rest.pageUrl,
        pageTitle: rest.pageTitle,
        loadTimeMs: rest.loadTimeMs,
      },
      context
    );

    res.json({
      success: true,
      eventId: event.id,
    });
  } catch (error: any) {
    log.error('Failed to track event:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tracking/page-view
 * Track a page view
 */
router.post('/page-view', async (req: Request, res: Response) => {
  try {
    const { sessionId, userId, deviceId, pageUrl, pageTitle, loadTime, referrer } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'sessionId is required',
      });
    }

    const context = userTrackingService.getContextFromRequest(
      req,
      sessionId,
      deviceId,
      userId
    );

    // Override with provided values
    if (pageUrl) context.pageUrl = pageUrl;
    if (pageTitle) context.pageTitle = pageTitle;
    if (referrer) context.referrer = referrer;

    const event = await userTrackingService.trackPageView(context, {
      title: pageTitle,
      loadTime,
      from: referrer,
    });

    res.json({
      success: true,
      eventId: event.id,
    });
  } catch (error: any) {
    log.error('Failed to track page view:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tracking/events
 * Get events with filters
 */
router.get('/events', async (req: Request, res: Response) => {
  try {
    const {
      startDate,
      endDate,
      userId,
      eventType,
      eventCategory,
      limit,
      offset,
    } = req.query as any;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'startDate and endDate are required',
      });
    }

    const options = {
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
      userId: userId as string | undefined,
      eventType: eventType as TrackingEventType | undefined,
      eventCategory: eventCategory as EventCategory | undefined,
      limit: limit ? parseInt(limit as string, 10) : 100,
      offset: offset ? parseInt(offset as string, 10) : 0,
    };

    const events = await userTrackingDAO.getEvents(options);

    res.json({
      success: true,
      events,
      count: events.length,
    });
  } catch (error: any) {
    log.error('Failed to get events:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tracking/sessions/:sessionId
 * Get session details
 */
router.get('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;

    const session = await userTrackingDAO.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Not found',
        message: `Session not found: ${sessionId}`,
      });
    }

    res.json({
      success: true,
      session,
    });
  } catch (error: any) {
    log.error('Failed to get session:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tracking/users/:userId/sessions
 * Get user sessions
 */
router.get('/users/:userId/sessions', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const { limit } = req.query;

    const sessions = await userTrackingDAO.getUserSessions(
      userId,
      limit ? parseInt(limit as string, 10) : 50
    );

    res.json({
      success: true,
      sessions,
      count: sessions.length,
    });
  } catch (error: any) {
    log.error('Failed to get user sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tracking/sessions/:sessionId/end
 * End a session
 */
router.post('/sessions/:sessionId/end', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;

    await userTrackingDAO.endSession(sessionId);

    res.json({
      success: true,
      message: 'Session ended',
    });
  } catch (error: any) {
    log.error('Failed to end session:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tracking/analytics/summary
 * Get daily analytics summary
 */
router.get('/analytics/summary', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'startDate and endDate are required',
      });
    }

    const summary = await userTrackingDAO.getDailySummary(
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json({
      success: true,
      summary,
    });
  } catch (error: any) {
    log.error('Failed to get analytics summary:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tracking/analytics/engagement
 * Get user engagement metrics
 */
router.get('/analytics/engagement', async (req: Request, res: Response) => {
  try {
    const { days } = req.query;

    const engagement = await userTrackingService.getEngagementMetrics(
      days ? parseInt(days as string, 10) : 30
    );

    res.json({
      success: true,
      engagement,
    });
  } catch (error: any) {
    log.error('Failed to get engagement metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tracking/analytics/pages
 * Get page view analytics
 */
router.get('/analytics/pages', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, limit } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'startDate and endDate are required',
      });
    }

    const pages = await userTrackingService.getPageAnalytics(
      new Date(startDate as string),
      new Date(endDate as string),
      limit ? parseInt(limit as string, 10) : 20
    );

    res.json({
      success: true,
      pages,
    });
  } catch (error: any) {
    log.error('Failed to get page analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tracking/analytics/funnel/:name
 * Analyze a predefined funnel
 */
router.get('/analytics/funnel/:name', async (req: Request, res: Response) => {
  try {
    const name = req.params.name as string;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'startDate and endDate are required',
      });
    }

    const validFunnels = [
      'signup_to_first_trade',
      'strategy_execution',
      'subscription_conversion',
    ];

    if (!validFunnels.includes(name)) {
      return res.status(400).json({
        error: 'Invalid funnel',
        message: `Invalid funnel name. Valid options: ${validFunnels.join(', ')}`,
      });
    }

    const funnel = await userTrackingService.analyzePredefinedFunnel(
      name as any,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json({
      success: true,
      funnel,
    });
  } catch (error: any) {
    log.error('Failed to analyze funnel:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tracking/analytics/funnel/custom
 * Analyze a custom funnel
 */
router.post('/analytics/funnel/custom', async (req: Request, res: Response) => {
  try {
    const { name, steps, startDate, endDate } = req.body;

    if (!name || !steps || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'name, steps, startDate, and endDate are required',
      });
    }

    if (!Array.isArray(steps) || steps.length < 2) {
      return res.status(400).json({
        error: 'Invalid steps',
        message: 'steps must be an array with at least 2 items',
      });
    }

    const funnel = await userTrackingService.analyzeCustomFunnel(
      name,
      steps,
      new Date(startDate),
      new Date(endDate)
    );

    res.json({
      success: true,
      funnel,
    });
  } catch (error: any) {
    log.error('Failed to analyze custom funnel:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tracking/analytics/dashboard
 * Get all dashboard data in one call
 */
router.get('/analytics/dashboard', async (req: Request, res: Response) => {
  try {
    const { days } = req.query;

    const dashboard = await userTrackingService.getDashboardData(
      days ? parseInt(days as string, 10) : 7
    );

    res.json({
      success: true,
      dashboard,
    });
  } catch (error: any) {
    log.error('Failed to get dashboard data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tracking/analytics/aggregate
 * Run daily aggregation (admin only)
 */
router.post('/analytics/aggregate', async (req: Request, res: Response) => {
  try {
    const { date } = req.body;

    const targetDate = date ? new Date(date) : undefined;

    await userTrackingService.runDailyAggregation(targetDate);

    res.json({
      success: true,
      message: 'Daily aggregation completed',
      date: targetDate || new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
  } catch (error: any) {
    log.error('Failed to run aggregation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tracking/analytics/cleanup
 * Clean up old events (admin only)
 */
router.post('/analytics/cleanup', async (req: Request, res: Response) => {
  try {
    const { olderThanDays = 365 } = req.body;

    const deleted = await userTrackingService.cleanupOldEvents(olderThanDays);

    res.json({
      success: true,
      deleted,
      message: `Deleted ${deleted} events older than ${olderThanDays} days`,
    });
  } catch (error: any) {
    log.error('Failed to cleanup events:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tracking/session-id
 * Generate a new session ID
 */
router.get('/session-id', (req: Request, res: Response) => {
  const sessionId = userTrackingService.generateSessionId();
  res.json({
    success: true,
    sessionId,
  });
});

/**
 * GET /api/tracking/device-id
 * Generate a new device ID
 */
router.get('/device-id', (req: Request, res: Response) => {
  const deviceId = userTrackingService.generateDeviceId();
  res.json({
    success: true,
    deviceId,
  });
});

export default router;