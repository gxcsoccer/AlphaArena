/**
 * Business Metrics Routes
 *
 * API endpoints for business metrics dashboard.
 * All endpoints require authentication and admin role.
 */

import { Router, Request, Response } from 'express';
import { businessMetricsService } from '../analytics/BusinessMetricsService';
import { createLogger } from '../utils/logger';
import { authMiddleware, requireAdmin } from './authMiddleware';

const log = createLogger('BusinessMetricsRoutes');
const router = Router();

// All business metrics routes require authentication
router.use(authMiddleware);

/**
 * GET /api/business-metrics/dashboard
 * Get complete business metrics dashboard
 * Admin only
 */
router.get('/dashboard', requireAdmin, async (req: Request, res: Response) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    const dashboard = await businessMetricsService.getDashboard(days);
    res.json({ success: true, dashboard });
  } catch (error: any) {
    log.error('Failed to get business metrics dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/business-metrics/funnel
 * Get conversion funnel analysis
 * Admin only
 */
router.get('/funnel', requireAdmin, async (req: Request, res: Response) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    const funnel = await businessMetricsService.getConversionFunnel(days);
    res.json({ success: true, funnel });
  } catch (error: any) {
    log.error('Failed to get conversion funnel:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/business-metrics/dau-mau
 * Get DAU/MAU metrics
 * Admin only
 */
router.get('/dau-mau', requireAdmin, async (req: Request, res: Response) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    const dauMau = await businessMetricsService.getDAUMAU(days);
    res.json({ success: true, dauMau });
  } catch (error: any) {
    log.error('Failed to get DAU/MAU metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/business-metrics/retention
 * Get retention analysis
 * Admin only
 */
router.get('/retention', requireAdmin, async (req: Request, res: Response) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 90;
    const retention = await businessMetricsService.getRetention(days);
    res.json({ success: true, retention });
  } catch (error: any) {
    log.error('Failed to get retention data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/business-metrics/revenue
 * Get revenue metrics
 * Admin only
 */
router.get('/revenue', requireAdmin, async (req: Request, res: Response) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    const revenue = await businessMetricsService.getRevenue(days);
    res.json({ success: true, revenue });
  } catch (error: any) {
    log.error('Failed to get revenue metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/business-metrics/export
 * Export metrics in JSON or CSV format
 * Admin only
 */
router.get('/export', requireAdmin, async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as 'json' | 'csv') || 'json';
    const data = await businessMetricsService.exportMetrics(format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=business-metrics.csv');
      res.send(data);
    } else {
      res.json({ success: true, data: JSON.parse(data) });
    }
  } catch (error: any) {
    log.error('Failed to export metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/business-metrics/summary
 * Get business metrics summary for unified admin dashboard
 * Admin only
 */
router.get('/summary', requireAdmin, async (req: Request, res: Response) => {
  try {
    const dashboard = await businessMetricsService.getDashboard(30);
    
    res.json({
      success: true,
      data: {
        dau: dashboard?.dauMau?.current?.dau || 0,
        mau: dashboard?.dauMau?.current?.mau || 0,
        stickiness: dashboard?.dauMau?.current?.stickiness || 0,
        mrr: dashboard?.revenue?.mrr || 0,
        mrrGrowth: dashboard?.revenue?.mrrGrowth || 0,
        conversionRate: dashboard?.conversionFunnel?.overallConversionRate || 0,
      },
    });
  } catch (error: any) {
    log.error('Failed to get business metrics summary:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;