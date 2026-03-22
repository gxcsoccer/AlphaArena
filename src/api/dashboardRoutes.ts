/**
 * Dashboard Routes
 * 
 * API endpoints for analytics dashboard.
 * All endpoints require authentication.
 * Admin-only endpoints are marked with requireAdmin.
 */

import { Router, Request, Response } from 'express';
import { dashboardService } from '../analytics/DashboardService';
import { metricsService } from '../analytics/MetricsService';
import { reportGenerator } from '../analytics/ReportGenerator';
import { createLogger } from '../utils/logger';
import { authMiddleware, requireAdmin } from './authMiddleware';

const log = createLogger('DashboardRoutes');
const router = Router();

// All dashboard routes require authentication
router.use(authMiddleware);

/**
 * GET /api/dashboard/overview
 * Get dashboard overview with key metrics
 */
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;
    const overview = await dashboardService.getOverview(days);
    res.json({ success: true, overview });
  } catch (error: any) {
    log.error('Failed to get dashboard overview:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard/metrics/north-star
 * Get North Star metric (admin only)
 */
router.get('/metrics/north-star', requireAdmin, async (req: Request, res: Response) => {
  try {
    const metric = await metricsService.calculateNorthStarMetric();
    res.json({ success: true, metric });
  } catch (error: any) {
    log.error('Failed to get North Star metric:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard/metrics/secondary
 * Get secondary metrics (admin only)
 */
router.get('/metrics/secondary', requireAdmin, async (req: Request, res: Response) => {
  try {
    const metrics = await metricsService.calculateSecondaryMetrics();
    res.json({ success: true, metrics });
  } catch (error: any) {
    log.error('Failed to get secondary metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard/funnels
 * Get funnel analysis
 */
router.get('/funnels', async (req: Request, res: Response) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    const funnels = await dashboardService.getFunnels(days);
    res.json({ success: true, funnels });
  } catch (error: any) {
    log.error('Failed to get funnels:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard/features
 * Get feature usage
 */
router.get('/features', async (req: Request, res: Response) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const featureUsage = await dashboardService.getFeatureUsage(startDate, endDate);
    res.json({ success: true, featureUsage });
  } catch (error: any) {
    log.error('Failed to get feature usage:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard/heatmap
 * Get activity heatmap
 */
router.get('/heatmap', async (req: Request, res: Response) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const heatmap = await dashboardService.getActivityHeatmap(startDate, endDate);
    res.json({ success: true, heatmap });
  } catch (error: any) {
    log.error('Failed to get activity heatmap:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard/realtime
 * Get real-time stats
 */
router.get('/realtime', async (req: Request, res: Response) => {
  try {
    const realTime = await dashboardService.getRealTimeStats();
    res.json({ success: true, realTime });
  } catch (error: any) {
    log.error('Failed to get real-time stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard
 * Get complete dashboard data
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;
    const dashboard = await dashboardService.getFullDashboard(days);
    res.json({ success: true, dashboard });
  } catch (error: any) {
    log.error('Failed to get dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard/reports/daily
 * Get daily report (admin only)
 */
router.get('/reports/daily', requireAdmin, async (req: Request, res: Response) => {
  try {
    const date = req.query.date ? new Date(req.query.date as string) : undefined;
    const report = await reportGenerator.generateDailyReport(date);
    res.json({ success: true, report });
  } catch (error: any) {
    log.error('Failed to generate daily report:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard/reports/weekly
 * Get weekly report (admin only)
 */
router.get('/reports/weekly', requireAdmin, async (req: Request, res: Response) => {
  try {
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const report = await reportGenerator.generateWeeklyReport(endDate);
    res.json({ success: true, report });
  } catch (error: any) {
    log.error('Failed to generate weekly report:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;