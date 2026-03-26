/**
 * APM (Application Performance Monitoring) Routes
 * 
 * Handles frontend error reports and APM data collection.
 */

import { Router, Request, Response } from 'express';
import { getSupabaseClient, getSupabaseAdminClient } from '../database/client';
import authMiddleware, { optionalAuthMiddleware } from './authMiddleware';
import { createLogger } from '../utils/logger';

const log = createLogger('APMRoutes');
const router = Router();

// Error report from frontend
interface FrontendErrorReport {
  id: string;
  message: string;
  name: string;
  stack?: string;
  type: 'javascript' | 'promise' | 'react' | 'resource' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  context: {
    userId?: string;
    sessionId: string;
    page: string;
    route?: string;
    componentStack?: string;
    metadata?: Record<string, unknown>;
  };
  timestamp: number;
  url: string;
  userAgent: string;
  breadcrumbs: Array<{
    type: string;
    message: string;
    timestamp: number;
    data?: Record<string, unknown>;
  }>;
}

/**
 * @swagger
 * /api/apm/errors:
 *   post:
 *     summary: Report frontend error
 *     description: Receive and store frontend error reports
 *     tags: [APM]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               message:
 *                 type: string
 *               name:
 *                 type: string
 *               stack:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [javascript, promise, react, resource, unknown]
 *               severity:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *               context:
 *                 type: object
 *               timestamp:
 *                 type: number
 *               url:
 *                 type: string
 *               userAgent:
 *                 type: string
 *               breadcrumbs:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Error recorded
 */
router.post('/errors', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const errorReport: FrontendErrorReport = req.body;
    
    if (!errorReport.message) {
      return res.status(400).json({
        success: false,
        error: 'Error message is required',
      });
    }

    const client = getSupabaseClient();
    
    // Store error in database
    const { error } = await client
      .from('frontend_errors')
      .insert({
        id: errorReport.id,
        user_id: errorReport.context.userId || req.user?.id,
        session_id: errorReport.context.sessionId,
        message: errorReport.message,
        error_name: errorReport.name,
        stack: errorReport.stack,
        error_type: errorReport.type,
        severity: errorReport.severity,
        page: errorReport.context.page,
        route: errorReport.context.route,
        component_stack: errorReport.context.componentStack,
        metadata: errorReport.context.metadata || {},
        url: errorReport.url,
        user_agent: errorReport.userAgent,
        breadcrumbs: errorReport.breadcrumbs || [],
        created_at: new Date(errorReport.timestamp).toISOString(),
      });

    if (error) {
      // If table doesn't exist, log but don't fail
      if (error.code === '42P01') {
        log.warn('frontend_errors table not found, skipping error storage');
      } else {
        log.error('Failed to store error:', error);
      }
    }

    // Log critical errors
    if (errorReport.severity === 'critical') {
      log.error('Critical frontend error:', {
        message: errorReport.message,
        type: errorReport.type,
        page: errorReport.context.page,
        userId: errorReport.context.userId,
      });
    }

    res.json({
      success: true,
      message: 'Error recorded',
    });
  } catch (err) {
    log.error('Error processing error report:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to process error report',
    });
  }
});

/**
 * @swagger
 * /api/apm/errors:
 *   get:
 *     summary: Get frontend errors
 *     description: Get paginated list of frontend errors (admin only)
 *     tags: [APM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [javascript, promise, react, resource, unknown]
 *       - in: query
 *         name: page_filter
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
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of errors
 */
router.get('/errors', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { severity, type, page_filter, start_date, end_date, limit, offset } = req.query;
    
    // Use admin client to bypass RLS - this is an admin-only endpoint
    const client = getSupabaseAdminClient();
    let query = client
      .from('frontend_errors')
      .select('*', { count: 'exact' });

    if (severity) {
      query = query.eq('severity', severity);
    }
    if (type) {
      query = query.eq('error_type', type);
    }
    if (page_filter) {
      query = query.ilike('page', `%${page_filter}%`);
    }
    if (start_date) {
      query = query.gte('created_at', start_date as string);
    }
    if (end_date) {
      query = query.lte('created_at', end_date as string);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(
        parseInt(offset as string, 10) || 0,
        (parseInt(offset as string, 10) || 0) + (parseInt(limit as string, 10) || 50) - 1
      );

    const { data, error, count } = await query;

    if (error) {
      // If table doesn't exist, return empty
      if (error.code === '42P01') {
        return res.json({
          success: true,
          data: [],
          total: 0,
        });
      }
      throw error;
    }

    res.json({
      success: true,
      data: data || [],
      total: count || 0,
    });
  } catch (err) {
    log.error('Failed to fetch errors:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch errors',
    });
  }
});

/**
 * @swagger
 * /api/apm/errors/summary:
 *   get:
 *     summary: Get error summary
 *     description: Get aggregated error statistics (admin only)
 *     tags: [APM]
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
 *         description: Error summary
 */
router.get('/errors/summary', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { start_date, end_date } = req.query;
    
    // Use admin client to bypass RLS - this is an admin-only endpoint
    const client = getSupabaseAdminClient();
    let query = client
      .from('frontend_errors')
      .select('severity, error_type, page, created_at');

    if (start_date) {
      query = query.gte('created_at', start_date as string);
    }
    if (end_date) {
      query = query.lte('created_at', end_date as string);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === '42P01') {
        return res.json({
          success: true,
          data: {
            total_errors: 0,
            by_severity: {},
            by_type: {},
            by_page: {},
            unique_sessions: 0,
          },
        });
      }
      throw error;
    }

    const errors = data || [];

    // Aggregate statistics
    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byPage: Record<string, number> = {};
    const sessions = new Set<string>();

    for (const err of errors) {
      // By severity
      bySeverity[err.severity] = (bySeverity[err.severity] || 0) + 1;
      // By type
      byType[err.error_type] = (byType[err.error_type] || 0) + 1;
      // By page
      byPage[err.page] = (byPage[err.page] || 0) + 1;
    }

    res.json({
      success: true,
      data: {
        total_errors: errors.length,
        by_severity: bySeverity,
        by_type: byType,
        by_page: byPage,
        unique_sessions: sessions.size,
      },
    });
  } catch (err) {
    log.error('Failed to fetch error summary:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch error summary',
    });
  }
});

/**
 * @swagger
 * /api/apm/errors/{id}:
 *   get:
 *     summary: Get error details
 *     description: Get detailed error information (admin only)
 *     tags: [APM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Error details
 */
router.get('/errors/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Use admin client to bypass RLS - this is an admin-only endpoint
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from('frontend_errors')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Error not found',
        });
      }
      throw error;
    }

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    log.error('Failed to fetch error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch error',
    });
  }
});

/**
 * @swagger
 * /api/apm/errors/{id}/resolve:
 *   post:
 *     summary: Mark error as resolved
 *     description: Mark a frontend error as resolved (admin only)
 *     tags: [APM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Error resolved
 */
router.post('/errors/:id/resolve', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Use admin client to bypass RLS - this is an admin-only endpoint
    const client = getSupabaseAdminClient();
    const { error } = await client
      .from('frontend_errors')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: req.user?.id,
      })
      .eq('id', id);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Error marked as resolved',
    });
  } catch (err) {
    log.error('Failed to resolve error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve error',
    });
  }
});

/**
 * @swagger
 * /api/apm/api-latency:
 *   get:
 *     summary: Get API latency statistics
 *     description: Get aggregated API latency metrics
 *     tags: [APM]
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
 *         name: endpoint
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API latency statistics
 */
router.get('/api-latency', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { start_date, end_date } = req.query;
    
    // Use admin client to bypass RLS - this is an admin-only endpoint
    const client = getSupabaseAdminClient();
    
    // Query performance_metrics table for API latency data
    let query = client
      .from('performance_metrics')
      .select('api_latency, page, created_at, device_type')
      .not('api_latency', 'is', null);

    if (start_date) {
      query = query.gte('created_at', start_date as string);
    }
    if (end_date) {
      query = query.lte('created_at', end_date as string);
    }

    const { data, error } = await query.limit(1000);

    if (error) {
      throw error;
    }

    // Calculate statistics
    const latencies = (data || []).map(d => d.api_latency).filter(l => l != null) as number[];
    
    const stats = {
      count: latencies.length,
      avg: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      min: latencies.length > 0 ? Math.min(...latencies) : 0,
      max: latencies.length > 0 ? Math.max(...latencies) : 0,
      p50: calculatePercentile(latencies, 50),
      p75: calculatePercentile(latencies, 75),
      p90: calculatePercentile(latencies, 90),
      p95: calculatePercentile(latencies, 95),
      p99: calculatePercentile(latencies, 99),
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    log.error('Failed to fetch API latency:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch API latency',
    });
  }
});

/**
 * Calculate percentile value
 */
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

export default router;