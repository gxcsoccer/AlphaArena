/**
 * Analytics Export Routes
 *
 * API endpoints for exporting analytics data in various formats
 *
 * @module api/analyticsExportRoutes
 */

import { Router, Request, Response } from 'express';
import { analyticsExportService, ExportOptions } from '../analytics/AnalyticsExportService';
import { createLogger } from '../utils/logger';
import { authMiddleware, requireAdmin } from './authMiddleware';

const log = createLogger('AnalyticsExportRoutes');
const router = Router();

// All export routes require authentication
router.use(authMiddleware);

/**
 * GET /api/analytics-export/dashboard
 * Export dashboard data
 *
 * @query format - 'csv' | 'pdf' | 'json' (default: 'json')
 * @query startDate - Start date (ISO string)
 * @query endDate - End date (ISO string)
 * @query days - Number of days (default: 7, used if no dates provided)
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as 'csv' | 'pdf' | 'json') || 'json';
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const result = await analyticsExportService.exportDashboard({
      format,
      startDate,
      endDate,
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.size);
    res.send(result.content);
  } catch (error: any) {
    log.error('Failed to export dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics-export/metrics
 * Export metrics data
 *
 * @query format - 'csv' | 'pdf' | 'json' (default: 'json')
 * @query startDate - Start date (ISO string)
 * @query endDate - End date (ISO string)
 */
router.get('/metrics', requireAdmin, async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as 'csv' | 'pdf' | 'json') || 'json';
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const result = await analyticsExportService.exportMetrics({
      format,
      startDate,
      endDate,
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.size);
    res.send(result.content);
  } catch (error: any) {
    log.error('Failed to export metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics-export/report/daily
 * Export daily report
 *
 * @query format - 'csv' | 'pdf' | 'json' (default: 'json')
 * @query date - Report date (ISO string, default: yesterday)
 */
router.get('/report/daily', requireAdmin, async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as 'csv' | 'pdf' | 'json') || 'json';
    const date = req.query.date
      ? new Date(req.query.date as string)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await analyticsExportService.exportReport('daily', {
      format,
      startDate: date,
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.size);
    res.send(result.content);
  } catch (error: any) {
    log.error('Failed to export daily report:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics-export/report/weekly
 * Export weekly report
 *
 * @query format - 'csv' | 'pdf' | 'json' (default: 'json')
 * @query endDate - Report end date (ISO string, default: today)
 */
router.get('/report/weekly', requireAdmin, async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as 'csv' | 'pdf' | 'json') || 'json';
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const result = await analyticsExportService.exportReport('weekly', {
      format,
      endDate,
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.size);
    res.send(result.content);
  } catch (error: any) {
    log.error('Failed to export weekly report:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics-export/errors
 * Export error logs
 *
 * @query format - 'csv' | 'pdf' | 'json' (default: 'json')
 * @query startDate - Start date (ISO string)
 * @query endDate - End date (ISO string)
 */
router.get('/errors', requireAdmin, async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as 'csv' | 'pdf' | 'json') || 'json';
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const result = await analyticsExportService.exportErrorLogs({
      format,
      startDate,
      endDate,
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.size);
    res.send(result.content);
  } catch (error: any) {
    log.error('Failed to export error logs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics-export/user-tracking
 * Export user tracking data
 *
 * @query format - 'csv' | 'pdf' | 'json' (default: 'json')
 * @query startDate - Start date (ISO string)
 * @query endDate - End date (ISO string)
 * @query userId - Filter by user ID (optional)
 * @query includeRawData - Include raw events (default: false)
 */
router.get('/user-tracking', requireAdmin, async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as 'csv' | 'pdf' | 'json') || 'json';
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const userId = req.query.userId as string | undefined;
    const includeRawData = req.query.includeRawData === 'true';

    const result = await analyticsExportService.exportUserTracking({
      format,
      startDate,
      endDate,
      userId,
      includeRawData,
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.size);
    res.send(result.content);
  } catch (error: any) {
    log.error('Failed to export user tracking:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics-export/funnels
 * Export funnel analysis
 *
 * @query format - 'csv' | 'pdf' | 'json' (default: 'json')
 * @query startDate - Start date (ISO string)
 * @query endDate - End date (ISO string)
 */
router.get('/funnels', async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as 'csv' | 'pdf' | 'json') || 'json';
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const result = await analyticsExportService.exportFunnels({
      format,
      startDate,
      endDate,
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.size);
    res.send(result.content);
  } catch (error: any) {
    log.error('Failed to export funnels:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics-export/full
 * Export comprehensive analytics bundle
 *
 * @query format - 'csv' | 'pdf' | 'json' (default: 'json')
 * @query startDate - Start date (ISO string)
 * @query endDate - End date (ISO string)
 */
router.get('/full', requireAdmin, async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as 'csv' | 'pdf' | 'json') || 'json';
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const result = await analyticsExportService.exportFullAnalytics({
      format,
      startDate,
      endDate,
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.size);
    res.send(result.content);
  } catch (error: any) {
    log.error('Failed to export full analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;