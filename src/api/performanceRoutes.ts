/**
 * Performance Metrics API Routes
 * 
 * Handles collection and retrieval of mobile/web performance metrics.
 * Also manages performance alert configuration and notifications.
 */

import { Router, Request, Response } from 'express';
import { getPerformanceMetricsDAO, PerformanceFilters, CreatePerformanceMetricInput } from '../database/performance-metrics.dao';
import { performanceAlertService } from '../monitoring/PerformanceAlertService';
import authMiddleware, { optionalAuthMiddleware, requireAdmin } from './authMiddleware';
import { createLogger } from '../utils/logger';

const log = createLogger('PerformanceRoutes');
const router = Router();

/**
 * @swagger
 * /api/performance/metrics:
 *   post:
 *     summary: Report performance metrics
 *     description: Collect performance metrics from client
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               session_id:
 *                 type: string
 *                 description: Session identifier
 *               fcp:
 *                 type: number
 *                 description: First Contentful Paint (ms)
 *               lcp:
 *                 type: number
 *                 description: Largest Contentful Paint (ms)
 *               fid:
 *                 type: number
 *                 description: First Input Delay (ms)
 *               cls:
 *                 type: number
 *                 description: Cumulative Layout Shift (score)
 *               ttfb:
 *                 type: number
 *                 description: Time to First Byte (ms)
 *               inp:
 *                 type: number
 *                 description: Interaction to Next Paint (ms)
 *               tti:
 *                 type: number
 *                 description: Time to Interactive (ms)
 *               memory_used:
 *                 type: number
 *                 description: JS Heap Size (bytes)
 *               memory_limit:
 *                 type: number
 *                 description: JS Heap Limit (bytes)
 *               api_latency:
 *                 type: number
 *                 description: Average API latency (ms)
 *               ws_latency:
 *                 type: number
 *                 description: WebSocket latency (ms)
 *               ws_connected:
 *                 type: boolean
 *                 description: WebSocket connection status
 *               page:
 *                 type: string
 *                 description: Current page/route
 *               route:
 *                 type: string
 *                 description: Route name
 *               device_type:
 *                 type: string
 *                 enum: [mobile, tablet, desktop]
 *                 description: Device type
 *               os:
 *                 type: string
 *                 description: Operating system
 *               browser:
 *                 type: string
 *                 description: Browser name
 *               screen_width:
 *                 type: number
 *                 description: Screen width in pixels
 *               screen_height:
 *                 type: number
 *                 description: Screen height in pixels
 *               connection_type:
 *                 type: string
 *                 description: Connection type (4g, 3g, wifi)
 *               effective_type:
 *                 type: string
 *                 description: Effective connection type
 *     responses:
 *       200:
 *         description: Metrics saved successfully
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Server error
 */
router.post('/metrics', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const dao = getPerformanceMetricsDAO();
    
    // Extract device info from request
    const userAgent = req.headers['user-agent'] || '';
    const forwardedFor = req.headers['x-forwarded-for'];
    const _ip = forwardedFor ? (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0]) : req.ip;

    const input: CreatePerformanceMetricInput = {
      user_id: req.user?.id,
      session_id: req.body.session_id || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      
      // Core Web Vitals
      fcp: req.body.fcp,
      lcp: req.body.lcp,
      fid: req.body.fid,
      cls: req.body.cls,
      ttfb: req.body.ttfb,
      inp: req.body.inp,
      
      // Custom metrics
      tti: req.body.tti,
      memory_used: req.body.memory_used,
      memory_limit: req.body.memory_limit,
      
      // Network metrics
      api_latency: req.body.api_latency,
      ws_latency: req.body.ws_latency,
      ws_connected: req.body.ws_connected,
      
      // Page context
      page: req.body.page || 'unknown',
      route: req.body.route,
      
      // Device info
      device_type: req.body.device_type || 'desktop',
      os: req.body.os,
      browser: req.body.browser,
      screen_width: req.body.screen_width,
      screen_height: req.body.screen_height,
      connection_type: req.body.connection_type,
      effective_type: req.body.effective_type,
      
      // Additional context
      user_agent: userAgent,
      referrer: req.body.referrer,
    };

    // Validate device_type
    if (!['mobile', 'tablet', 'desktop'].includes(input.device_type)) {
      input.device_type = 'desktop';
    }

    const result = await dao.create(input);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error saving performance metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save performance metrics',
    });
  }
});

/**
 * @swagger
 * /api/performance/metrics/batch:
 *   post:
 *     summary: Batch report performance metrics
 *     description: Collect multiple performance metrics in a single request
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               metrics:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Metrics saved successfully
 */
router.post('/metrics/batch', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const dao = getPerformanceMetricsDAO();
    const metrics = req.body.metrics;

    if (!Array.isArray(metrics) || metrics.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Metrics array is required',
      });
    }

    const userAgent = req.headers['user-agent'] || '';

    const inputs: CreatePerformanceMetricInput[] = metrics.map(m => ({
      user_id: req.user?.id,
      session_id: m.session_id || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fcp: m.fcp,
      lcp: m.lcp,
      fid: m.fid,
      cls: m.cls,
      ttfb: m.ttfb,
      inp: m.inp,
      tti: m.tti,
      memory_used: m.memory_used,
      memory_limit: m.memory_limit,
      api_latency: m.api_latency,
      ws_latency: m.ws_latency,
      ws_connected: m.ws_connected,
      page: m.page || 'unknown',
      route: m.route,
      device_type: ['mobile', 'tablet', 'desktop'].includes(m.device_type) ? m.device_type : 'desktop',
      os: m.os,
      browser: m.browser,
      screen_width: m.screen_width,
      screen_height: m.screen_height,
      connection_type: m.connection_type,
      effective_type: m.effective_type,
      user_agent: userAgent,
      referrer: m.referrer,
    }));

    const results = await dao.createBatch(inputs);

    res.json({
      success: true,
      data: { count: results.length },
    });
  } catch (error) {
    console.error('Error saving batch performance metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save performance metrics',
    });
  }
});

/**
 * @swagger
 * /api/performance/summary:
 *   get:
 *     summary: Get performance summary
 *     description: Get aggregated performance metrics summary
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Performance summary
 */
router.get('/summary', authMiddleware, async (req: Request, res: Response) => {
  try {
    const dao = getPerformanceMetricsDAO();
    const { start_date, end_date } = req.query;

    const summary = await dao.getSummary(
      start_date as string,
      end_date as string
    );

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Error fetching performance summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch performance summary',
    });
  }
});

/**
 * @swagger
 * /api/performance/device-distribution:
 *   get:
 *     summary: Get device type distribution
 *     description: Get performance metrics distribution by device type
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Device distribution
 */
router.get('/device-distribution', authMiddleware, async (req: Request, res: Response) => {
  try {
    const dao = getPerformanceMetricsDAO();
    const { start_date, end_date } = req.query;

    const distribution = await dao.getDeviceDistribution(
      start_date as string,
      end_date as string
    );

    res.json({
      success: true,
      data: distribution,
    });
  } catch (error) {
    console.error('Error fetching device distribution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch device distribution',
    });
  }
});

/**
 * @swagger
 * /api/performance/connection-distribution:
 *   get:
 *     summary: Get connection type distribution
 *     description: Get performance metrics distribution by connection type
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Connection distribution
 */
router.get('/connection-distribution', authMiddleware, async (req: Request, res: Response) => {
  try {
    const dao = getPerformanceMetricsDAO();
    const { start_date, end_date } = req.query;

    const distribution = await dao.getConnectionDistribution(
      start_date as string,
      end_date as string
    );

    res.json({
      success: true,
      data: distribution,
    });
  } catch (error) {
    console.error('Error fetching connection distribution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch connection distribution',
    });
  }
});

/**
 * @swagger
 * /api/performance/page-performance:
 *   get:
 *     summary: Get page-level performance
 *     description: Get performance metrics aggregated by page
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Page performance data
 */
router.get('/page-performance', authMiddleware, async (req: Request, res: Response) => {
  try {
    const dao = getPerformanceMetricsDAO();
    const { start_date, end_date } = req.query;

    const pagePerf = await dao.getPagePerformance(
      start_date as string,
      end_date as string
    );

    res.json({
      success: true,
      data: pagePerf,
    });
  } catch (error) {
    console.error('Error fetching page performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch page performance',
    });
  }
});

/**
 * @swagger
 * /api/performance/metrics:
 *   get:
 *     summary: Get raw performance metrics
 *     description: Get raw performance metrics with filters
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: device_type
 *         schema:
 *           type: string
 *           enum: [mobile, tablet, desktop]
 *       - in: query
 *         name: page
 *         schema:
 *           type: string
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Performance metrics
 */
router.get('/metrics', authMiddleware, async (req: Request, res: Response) => {
  try {
    const dao = getPerformanceMetricsDAO();
    const { user_id, device_type, page, start_date, end_date, limit, offset } = req.query;

    const filters: PerformanceFilters = {};
    if (user_id) filters.user_id = user_id as string;
    if (device_type) filters.device_type = device_type as 'mobile' | 'tablet' | 'desktop';
    if (page) filters.page = page as string;
    if (start_date) filters.start_date = start_date as string;
    if (end_date) filters.end_date = end_date as string;
    if (limit) filters.limit = parseInt(limit as string, 10);
    if (offset) filters.offset = parseInt(offset as string, 10);

    const metrics = await dao.getMetrics(filters);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch performance metrics',
    });
  }
});

/**
 * @swagger
 * /api/performance/trend:
 *   get:
 *     summary: Get performance trend over time
 *     description: Get aggregated performance metrics over time
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: granularity
 *         schema:
 *           type: string
 *           enum: [hour, day, week]
 *           default: day
 *     responses:
 *       200:
 *         description: Performance trend data
 */
router.get('/trend', authMiddleware, async (req: Request, res: Response) => {
  try {
    const dao = getPerformanceMetricsDAO();
    const { start_date, end_date, granularity } = req.query;

    // Default to last 7 days if no dates provided
    const endDate = end_date ? new Date(end_date as string) : new Date();
    const startDate = start_date 
      ? new Date(start_date as string) 
      : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get raw metrics and aggregate by date
    const metrics = await dao.getMetrics({
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      limit: 10000,
    });

    // Aggregate by granularity
    const granularityKey = granularity || 'day';
    const trendData: Record<string, {
      period: string;
      fcpSum: number;
      lcpSum: number;
      fidSum: number;
      clsSum: number;
      ttiSum: number;
      apiLatencySum: number;
      count: number;
      fcpValues: number[];
      lcpValues: number[];
    }> = {};

    for (const metric of metrics) {
      const date = new Date(metric.created_at);
      let periodKey: string;

      if (granularityKey === 'hour') {
        periodKey = `${date.toISOString().split('T')[0]}T${date.getHours().toString().padStart(2, '0')}:00`;
      } else if (granularityKey === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        periodKey = weekStart.toISOString().split('T')[0];
      } else {
        periodKey = date.toISOString().split('T')[0];
      }

      if (!trendData[periodKey]) {
        trendData[periodKey] = {
          period: periodKey,
          fcpSum: 0,
          lcpSum: 0,
          fidSum: 0,
          clsSum: 0,
          ttiSum: 0,
          apiLatencySum: 0,
          count: 0,
          fcpValues: [],
          lcpValues: [],
        };
      }

      const entry = trendData[periodKey];
      if (metric.fcp != null) {
        entry.fcpSum += metric.fcp;
        entry.fcpValues.push(metric.fcp);
      }
      if (metric.lcp != null) {
        entry.lcpSum += metric.lcp;
        entry.lcpValues.push(metric.lcp);
      }
      if (metric.fid != null) entry.fidSum += metric.fid;
      if (metric.cls != null) entry.clsSum += metric.cls;
      if (metric.tti != null) entry.ttiSum += metric.tti;
      if (metric.api_latency != null) entry.apiLatencySum += metric.api_latency;
      entry.count++;
    }

    // Calculate percentiles
    const calculatePercentile = (values: number[], percentile: number): number => {
      if (values.length === 0) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      const index = Math.ceil((percentile / 100) * sorted.length) - 1;
      return sorted[Math.max(0, index)];
    };

    const result = Object.values(trendData)
      .sort((a, b) => a.period.localeCompare(b.period))
      .map(entry => ({
        period: entry.period,
        avg_fcp: entry.fcpValues.length > 0 ? entry.fcpSum / entry.fcpValues.length : 0,
        avg_lcp: entry.lcpValues.length > 0 ? entry.lcpSum / entry.lcpValues.length : 0,
        p50_fcp: calculatePercentile(entry.fcpValues, 50),
        p50_lcp: calculatePercentile(entry.lcpValues, 50),
        p75_fcp: calculatePercentile(entry.fcpValues, 75),
        p75_lcp: calculatePercentile(entry.lcpValues, 75),
        p95_fcp: calculatePercentile(entry.fcpValues, 95),
        p95_lcp: calculatePercentile(entry.lcpValues, 95),
        avg_fid: entry.count > 0 ? entry.fidSum / entry.count : 0,
        avg_cls: entry.count > 0 ? entry.clsSum / entry.count : 0,
        avg_tti: entry.count > 0 ? entry.ttiSum / entry.count : 0,
        avg_api_latency: entry.count > 0 ? entry.apiLatencySum / entry.count : 0,
        sample_count: entry.count,
      }));

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching performance trend:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch performance trend',
    });
  }
});

// ==================== Alert Configuration Endpoints ====================

/**
 * @swagger
 * /api/performance/alerts/thresholds:
 *   get:
 *     summary: Get all performance thresholds
 *     description: Get configured performance thresholds for alerting
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance thresholds
 */
router.get('/alerts/thresholds', authMiddleware, async (req: Request, res: Response) => {
  try {
    const thresholds = await performanceAlertService.getThresholds();
    res.json({
      success: true,
      data: thresholds,
    });
  } catch (error) {
    log.error('Failed to get thresholds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get performance thresholds',
    });
  }
});

/**
 * @swagger
 * /api/performance/alerts/thresholds/{metricType}:
 *   put:
 *     summary: Update a performance threshold
 *     description: Update threshold configuration for a specific metric (admin only)
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: metricType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [lcp, fcp, fid, cls, ttfb, inp, api_latency, error_rate]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               warning_threshold:
 *                 type: number
 *               critical_threshold:
 *                 type: number
 *               enabled:
 *                 type: boolean
 *               notification_channels:
 *                 type: object
 *                 properties:
 *                   in_app:
 *                     type: boolean
 *                   email:
 *                     type: boolean
 *                   webhook:
 *                     type: boolean
 *               cooldown_minutes:
 *                 type: number
 *     responses:
 *       200:
 *         description: Threshold updated
 */
router.put('/alerts/thresholds/:metricType', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { metricType } = req.params;
    const updates = req.body;

    const threshold = await performanceAlertService.updateThreshold(metricType, updates);

    if (!threshold) {
      return res.status(404).json({
        success: false,
        error: 'Threshold not found',
      });
    }

    res.json({
      success: true,
      data: threshold,
    });
  } catch (error) {
    log.error('Failed to update threshold:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update performance threshold',
    });
  }
});

/**
 * @swagger
 * /api/performance/alerts:
 *   get:
 *     summary: Get active performance alerts
 *     description: Get list of active performance alerts
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Active alerts
 */
router.get('/alerts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const alerts = await performanceAlertService.getActiveAlerts(limit);
    res.json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    log.error('Failed to get active alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active alerts',
    });
  }
});

/**
 * @swagger
 * /api/performance/alerts/history:
 *   get:
 *     summary: Get alert history
 *     description: Get paginated history of performance alerts
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: metric_type
 *         schema:
 *           type: string
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [warning, critical]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, acknowledged, resolved]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Alert history
 */
router.get('/alerts/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { start_date, end_date, metric_type, severity, status, limit, offset } = req.query;

    const result = await performanceAlertService.getAlertHistory({
      startDate: start_date as string,
      endDate: end_date as string,
      metricType: metric_type as string,
      severity: severity as 'warning' | 'critical',
      status: status as 'active' | 'acknowledged' | 'resolved',
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });

    res.json({
      success: true,
      data: result.alerts,
      total: result.total,
    });
  } catch (error) {
    log.error('Failed to get alert history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get alert history',
    });
  }
});

/**
 * @swagger
 * /api/performance/alerts/{alertId}/acknowledge:
 *   post:
 *     summary: Acknowledge an alert
 *     description: Mark an alert as acknowledged
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Alert acknowledged
 */
router.post('/alerts/:alertId/acknowledge', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const success = await performanceAlertService.acknowledgeAlert(alertId, userId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
    }

    res.json({
      success: true,
      message: 'Alert acknowledged',
    });
  } catch (error) {
    log.error('Failed to acknowledge alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge alert',
    });
  }
});

/**
 * @swagger
 * /api/performance/alerts/{alertId}/resolve:
 *   post:
 *     summary: Resolve an alert
 *     description: Mark an alert as resolved
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Alert resolved
 */
router.post('/alerts/:alertId/resolve', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;

    const success = await performanceAlertService.resolveAlert(alertId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
    }

    res.json({
      success: true,
      message: 'Alert resolved',
    });
  } catch (error) {
    log.error('Failed to resolve alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert',
    });
  }
});

export default router;