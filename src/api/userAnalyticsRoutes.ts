/**
 * User Analytics Routes
 *
 * API endpoints for user behavior analytics dashboard
 *
 * @module api/userAnalyticsRoutes
 */

import { Router, Request, Response } from 'express';
import { userTrackingService } from '../analytics/UserTrackingService';
import { dashboardService } from '../analytics/DashboardService';
import { createLogger } from '../utils/logger';

const log = createLogger('UserAnalyticsRoutes');

const router = Router();

/**
 * GET /api/user-analytics/overview
 * Get dashboard overview with key metrics
 */
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const overview = await dashboardService.getOverview(days);

    res.json({
      success: true,
      data: overview,
    });
  } catch (error: any) {
    log.error('Failed to get overview:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/user-analytics/engagement
 * Get user engagement metrics (DAU, MAU, retention)
 */
router.get('/engagement', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const metrics = await userTrackingService.getEngagementMetrics(days);

    res.json({
      success: true,
      data: {
        dau: metrics.dau,
        wau: metrics.wau,
        mau: metrics.mau,
        stickiness: metrics.stickiness,
        retention: metrics.retention,
        avgSessionDuration: metrics.avgSessionDuration,
        avgSessionsPerUser: metrics.avgSessionsPerUser,
      },
    });
  } catch (error: any) {
    log.error('Failed to get engagement metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/user-analytics/funnels
 * Get funnel analysis data
 */
router.get('/funnels', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const funnels = await dashboardService.getFunnels(days);

    res.json({
      success: true,
      data: funnels,
    });
  } catch (error: any) {
    log.error('Failed to get funnels:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/user-analytics/funnels/:funnelName
 * Get specific funnel analysis
 */
router.get('/funnels/:funnelName', async (req: Request, res: Response) => {
  try {
    const funnelName = req.params.funnelName as 'signup_to_first_trade' | 'strategy_execution' | 'subscription_conversion';
    const days = parseInt(req.query.days as string) || 30;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const funnel = await userTrackingService.analyzePredefinedFunnel(funnelName, startDate, endDate);

    res.json({
      success: true,
      data: {
        name: funnel.name,
        steps: funnel.steps,
        totalUsers: funnel.totalUsers,
        completedUsers: funnel.completedUsers,
        overallConversionRate: funnel.overallConversionRate,
      },
    });
  } catch (error: any) {
    log.error('Failed to get funnel:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/user-analytics/page-views
 * Get page view analytics (hot pages)
 */
router.get('/page-views', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const limit = parseInt(req.query.limit as string) || 20;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const pageViews = await userTrackingService.getPageAnalytics(startDate, endDate, limit);

    res.json({
      success: true,
      data: pageViews,
    });
  } catch (error: any) {
    log.error('Failed to get page views:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/user-analytics/feature-usage
 * Get feature usage statistics
 */
router.get('/feature-usage', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const limit = parseInt(req.query.limit as string) || 20;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const usage = await dashboardService.getFeatureUsage(startDate, endDate, limit);

    res.json({
      success: true,
      data: usage,
    });
  } catch (error: any) {
    log.error('Failed to get feature usage:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/user-analytics/heatmap
 * Get activity heatmap (hourly distribution by day of week)
 */
router.get('/heatmap', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const heatmap = await dashboardService.getActivityHeatmap(startDate, endDate);

    res.json({
      success: true,
      data: heatmap,
    });
  } catch (error: any) {
    log.error('Failed to get heatmap:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/user-analytics/realtime
 * Get real-time statistics
 */
router.get('/realtime', async (req: Request, res: Response) => {
  try {
    const stats = await dashboardService.getRealTimeStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    log.error('Failed to get realtime stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/user-analytics/daily-summary
 * Get daily analytics summary
 */
router.get('/daily-summary', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const summary = await dashboardService.getDailySummary(startDate, endDate);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    log.error('Failed to get daily summary:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/user-analytics/dashboard
 * Get complete dashboard data in one request
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const dashboard = await dashboardService.getFullDashboard(days);

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error: any) {
    log.error('Failed to get dashboard data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/user-analytics/events
 * Track user event
 */
router.post('/events', async (req: Request, res: Response) => {
  try {
    const { eventType, eventName, properties, context } = req.body;

    if (!eventType || !eventName) {
      return res.status(400).json({
        error: 'eventType and eventName are required',
      });
    }

    const event = await userTrackingService.trackEvent(
      { eventType, eventName, properties },
      context
    );

    res.json({
      success: true,
      data: event,
    });
  } catch (error: any) {
    log.error('Failed to track event:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/user-analytics/events/batch
 * Track multiple events in batch
 */
router.post('/events/batch', async (req: Request, res: Response) => {
  try {
    const { events } = req.body;

    if (!events || !Array.isArray(events)) {
      return res.status(400).json({
        error: 'events array is required',
      });
    }

    const tracked = await userTrackingService.trackBatch(events);

    res.json({
      success: true,
      data: {
        received: events.length,
        processed: tracked.length,
      },
    });
  } catch (error: any) {
    log.error('Failed to track batch events:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/user-analytics/funnels/custom
 * Analyze custom funnel
 */
router.post('/funnels/custom', async (req: Request, res: Response) => {
  try {
    const { name, steps, startDate, endDate } = req.body;

    if (!name || !steps || !Array.isArray(steps)) {
      return res.status(400).json({
        error: 'name and steps array are required',
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
      data: funnel,
    });
  } catch (error: any) {
    log.error('Failed to analyze custom funnel:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;