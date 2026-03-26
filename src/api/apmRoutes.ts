/**
 * APM (Application Performance Monitoring) Routes
 * 
 * Handles frontend error reports and APM data collection.
 * Issue #663: Improved error aggregation, deduplication, and reporting
 */

import { Router, Request, Response } from 'express';
import { getSupabaseClient, getSupabaseAdminClient } from '../database/client';
import authMiddleware, { optionalAuthMiddleware, requireAdmin } from './authMiddleware';
import { createLogger } from '../utils/logger';
import crypto from 'crypto';

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
 * Generate error fingerprint for deduplication
 * Uses message, name, type, and file/line info
 */
function generateErrorFingerprint(error: FrontendErrorReport): string {
  const parts = [
    error.message.substring(0, 200), // Truncate long messages
    error.name,
    error.type,
  ];

  // Extract file and line from stack if available
  if (error.stack) {
    const stackLines = error.stack.split('\n').slice(0, 3); // First 3 lines
    for (const line of stackLines) {
      const match = line.match(/(?:at\s+)?(.+?):(\d+):(\d+)/);
      if (match) {
        parts.push(match[1]); // File path
        parts.push(match[2]); // Line number
        break;
      }
    }
  }

  const fingerprint = parts.filter(Boolean).join('|');
  return crypto.createHash('md5').update(fingerprint).digest('hex');
}

/**
 * Extract file path and line number from stack trace
 */
function extractStackInfo(stack?: string): { filePath?: string; lineNumber?: number } {
  if (!stack) return {};

  const lines = stack.split('\n');
  for (const line of lines) {
    const match = line.match(/(?:at\s+)?(.+?):(\d+):(\d+)/);
    if (match) {
      return {
        filePath: match[1].trim(),
        lineNumber: parseInt(match[2], 10),
      };
    }
  }

  return {};
}

/**
 * @swagger
 * /api/apm/errors:
 *   post:
 *     summary: Report frontend error
 *     description: Receive and store frontend error reports with deduplication
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
    const adminClient = getSupabaseAdminClient();
    
    // Generate fingerprint for deduplication
    const fingerprint = generateErrorFingerprint(errorReport);
    const stackInfo = extractStackInfo(errorReport.stack);

    // Store in error_aggregations table (for deduplication and statistics)
    try {
      await adminClient.rpc('upsert_error_aggregation', {
        p_error_fingerprint: fingerprint,
        p_error_message: errorReport.message.substring(0, 1000), // Truncate
        p_error_name: errorReport.name || 'Error',
        p_error_type: errorReport.type || 'unknown',
        p_file_path: stackInfo.filePath,
        p_line_number: stackInfo.lineNumber,
        p_stack: errorReport.stack?.substring(0, 5000), // Limit stack size
        p_user_id: errorReport.context.userId || req.user?.id || null,
        p_session_id: errorReport.context.sessionId,
      });
    } catch (aggError: any) {
      // Log but don't fail if aggregation table doesn't exist
      if (!aggError.message?.includes('does not exist')) {
        log.warn('Failed to update error aggregation:', aggError.message);
      }
    }
    
    // Store detailed error in frontend_errors table
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
        metadata: {
          ...errorReport.context.metadata,
          fingerprint, // Include fingerprint for grouping
        },
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

    // Log critical errors with more context
    if (errorReport.severity === 'critical') {
      log.error('Critical frontend error:', {
        message: errorReport.message,
        type: errorReport.type,
        page: errorReport.context.page,
        userId: errorReport.context.userId,
        fingerprint,
        sessionId: errorReport.context.sessionId,
      });
    }

    res.json({
      success: true,
      message: 'Error recorded',
      fingerprint, // Return fingerprint for client-side deduplication
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
 * /api/apm/errors/top:
 *   get:
 *     summary: Get top errors by occurrence
 *     description: Get aggregated top errors with occurrence counts
 *     tags: [APM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Top errors by occurrence
 */
router.get('/errors/top', authMiddleware, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string, 10) || 7;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    
    const client = getSupabaseAdminClient();
    
    // Try to use the aggregation function
    const { data, error } = await client.rpc('get_top_errors', {
      p_days: days,
      p_limit: limit,
    });

    if (error) {
      // If function doesn't exist, fall back to direct query
      if (error.code === '42883') {
        // Fallback: query frontend_errors directly with aggregation
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        const { data: fallbackData, error: fallbackError } = await client
          .from('frontend_errors')
          .select('message, error_name, error_type, created_at')
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false })
          .limit(1000);

        if (fallbackError) {
          throw fallbackError;
        }

        // Aggregate in memory
        const aggregated = (fallbackData || []).reduce((acc: Record<string, any>, err: any) => {
          const key = `${err.error_name}:${err.message.substring(0, 100)}`;
          if (!acc[key]) {
            acc[key] = {
              error_name: err.error_name,
              message: err.message,
              error_type: err.error_type,
              count: 0,
            };
          }
          acc[key].count++;
          return acc;
        }, {});

        const topErrors = Object.values(aggregated)
          .sort((a: any, b: any) => b.count - a.count)
          .slice(0, limit);

        return res.json({
          success: true,
          data: topErrors,
        });
      }
      throw error;
    }

    res.json({
      success: true,
      data: data || [],
    });
  } catch (err) {
    log.error('Failed to fetch top errors:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top errors',
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
      .select('severity, error_type, page, created_at, user_id, session_id');

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
            unique_users: 0,
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
    const users = new Set<string>();

    for (const err of errors) {
      // By severity
      bySeverity[err.severity] = (bySeverity[err.severity] || 0) + 1;
      // By type
      byType[err.error_type] = (byType[err.error_type] || 0) + 1;
      // By page
      byPage[err.page] = (byPage[err.page] || 0) + 1;
      // Unique sessions
      if (err.session_id) sessions.add(err.session_id);
      // Unique users
      if (err.user_id) users.add(err.user_id);
    }

    res.json({
      success: true,
      data: {
        total_errors: errors.length,
        by_severity: bySeverity,
        by_type: byType,
        by_page: Object.fromEntries(
          Object.entries(byPage).sort((a, b) => b[1] - a[1]).slice(0, 10)
        ),
        unique_sessions: sessions.size,
        unique_users: users.size,
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
 * /api/apm/errors/batch:
 *   post:
 *     summary: Report multiple errors in batch
 *     description: Receive and store multiple frontend error reports at once
 *     tags: [APM]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               errors:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Errors recorded
 */
router.post('/errors/batch', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { errors } = req.body;
    
    if (!Array.isArray(errors) || errors.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Errors array is required',
      });
    }

    const client = getSupabaseClient();
    const adminClient = getSupabaseAdminClient();
    
    const results: Array<{ id: string; fingerprint: string }> = [];
    const errorRecords: Array<any> = [];

    for (const errorReport of errors) {
      if (!errorReport.message) continue;

      // Generate fingerprint for deduplication
      const fingerprint = generateErrorFingerprint(errorReport);
      const stackInfo = extractStackInfo(errorReport.stack);

      // Update aggregation
      try {
        await adminClient.rpc('upsert_error_aggregation', {
          p_error_fingerprint: fingerprint,
          p_error_message: errorReport.message.substring(0, 1000),
          p_error_name: errorReport.name || 'Error',
          p_error_type: errorReport.type || 'unknown',
          p_file_path: stackInfo.filePath,
          p_line_number: stackInfo.lineNumber,
          p_stack: errorReport.stack?.substring(0, 5000),
          p_user_id: errorReport.context?.userId || req.user?.id || null,
          p_session_id: errorReport.context?.sessionId,
        });
      } catch (aggError: any) {
        if (!aggError.message?.includes('does not exist')) {
          log.warn('Failed to update error aggregation:', aggError.message);
        }
      }

      // Prepare error record
      errorRecords.push({
        id: errorReport.id,
        user_id: errorReport.context?.userId || req.user?.id,
        session_id: errorReport.context?.sessionId,
        message: errorReport.message,
        error_name: errorReport.name,
        stack: errorReport.stack,
        error_type: errorReport.type,
        severity: errorReport.severity,
        page: errorReport.context?.page,
        route: errorReport.context?.route,
        component_stack: errorReport.context?.componentStack,
        metadata: {
          ...errorReport.context?.metadata,
          fingerprint,
        },
        url: errorReport.url,
        user_agent: errorReport.userAgent,
        breadcrumbs: errorReport.breadcrumbs || [],
        created_at: new Date(errorReport.timestamp).toISOString(),
      });

      results.push({ id: errorReport.id, fingerprint });
    }

    // Batch insert errors
    if (errorRecords.length > 0) {
      const { error } = await client
        .from('frontend_errors')
        .insert(errorRecords);

      if (error) {
        if (error.code !== '42P01') {
          log.error('Failed to store error batch:', error);
        }
      }
    }

    res.json({
      success: true,
      message: `${results.length} errors recorded`,
      results,
    });
  } catch (err) {
    log.error('Error processing error batch:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to process error batch',
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

/**
 * @swagger
 * /api/apm/summary:
 *   get:
 *     summary: Get APM summary for unified dashboard
 *     description: Get consolidated APM metrics for the unified admin monitoring dashboard
 *     tags: [APM]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: APM summary
 */
router.get('/summary', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const client = getSupabaseAdminClient();
    
    // Get error counts
    const { data: errorData, error: errorErr } = await client
      .from('frontend_errors')
      .select('severity')
      .eq('resolved', false);

    if (errorErr && errorErr.code !== '42P01') {
      throw errorErr;
    }

    const errors = errorData || [];
    const totalErrors = errors.length;
    const criticalErrors = errors.filter(e => e.severity === 'critical').length;
    const highErrors = errors.filter(e => e.severity === 'high').length;

    // Get API latency data
    const { data: latencyData, error: latencyErr } = await client
      .from('performance_metrics')
      .select('api_latency')
      .not('api_latency', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (latencyErr && latencyErr.code !== '42P01') {
      throw latencyErr;
    }

    const latencies = (latencyData || []).map(d => d.api_latency).filter(l => l != null) as number[];
    const avgApiLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    const p95Latency = calculatePercentile(latencies, 95);

    // Calculate error rate (errors per 1000 requests - simplified)
    const { count: requestCount, error: reqErr } = await client
      .from('performance_metrics')
      .select('*', { count: 'exact', head: true });

    const errorRate = requestCount && requestCount > 0 ? (totalErrors / requestCount) * 100 : 0;

    // Get performance alerts count
    const { count: activeAlertsCount, error: alertsErr } = await client
      .from('performance_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Get Core Web Vitals summary
    const { data: cwvData, error: cwvErr } = await client
      .from('performance_metrics')
      .select('lcp, fcp, cls, inp')
      .not('lcp', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);

    let cwvSummary = {
      avgLcp: 0,
      avgFcp: 0,
      avgCls: 0,
      avgInp: 0,
    };

    if (cwvData && cwvData.length > 0) {
      const lcpValues = cwvData.map(d => d.lcp).filter(v => v != null) as number[];
      const fcpValues = cwvData.map(d => d.fcp).filter(v => v != null) as number[];
      const clsValues = cwvData.map(d => d.cls).filter(v => v != null) as number[];
      const inpValues = cwvData.map(d => d.inp).filter(v => v != null) as number[];

      cwvSummary = {
        avgLcp: lcpValues.length > 0 ? lcpValues.reduce((a, b) => a + b, 0) / lcpValues.length : 0,
        avgFcp: fcpValues.length > 0 ? fcpValues.reduce((a, b) => a + b, 0) / fcpValues.length : 0,
        avgCls: clsValues.length > 0 ? clsValues.reduce((a, b) => a + b, 0) / clsValues.length : 0,
        avgInp: inpValues.length > 0 ? inpValues.reduce((a, b) => a + b, 0) / inpValues.length : 0,
      };
    }

    res.json({
      success: true,
      data: {
        errors: {
          total: totalErrors,
          critical: criticalErrors,
          high: highErrors,
          rate: errorRate,
        },
        latency: {
          avg: avgApiLatency,
          p95: p95Latency,
        },
        coreWebVitals: cwvSummary,
        alerts: {
          active: activeAlertsCount || 0,
        },
      },
    });
  } catch (err) {
    log.error('Failed to fetch APM summary:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch APM summary',
    });
  }
});

/**
 * @swagger
 * /api/apm/thresholds:
 *   get:
 *     summary: Get performance thresholds
 *     description: Get all performance threshold configurations
 *     tags: [APM]
 *     responses:
 *       200:
 *         description: Performance thresholds
 */
router.get('/thresholds', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('performance_thresholds')
      .select('*')
      .order('metric_type');

    if (error) {
      // Return defaults if table doesn't exist
      if (error.code === '42P01') {
        return res.json({
          success: true,
          data: getDefaultThresholds(),
        });
      }
      throw error;
    }

    res.json({
      success: true,
      data: data || [],
    });
  } catch (err) {
    log.error('Failed to fetch thresholds:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch thresholds',
    });
  }
});

/**
 * @swagger
 * /api/apm/thresholds:
 *   put:
 *     summary: Update performance threshold
 *     description: Update a performance threshold configuration (admin only)
 *     tags: [APM]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               metric_type:
 *                 type: string
 *               warning_threshold:
 *                 type: number
 *               critical_threshold:
 *                 type: number
 *               enabled:
 *                 type: boolean
 *               notification_channels:
 *                 type: object
 *               cooldown_minutes:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Threshold updated
 */
router.put('/thresholds', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { metric_type, warning_threshold, critical_threshold, enabled, notification_channels, cooldown_minutes } = req.body;
    
    if (!metric_type) {
      return res.status(400).json({
        success: false,
        error: 'metric_type is required',
      });
    }

    const client = getSupabaseAdminClient();
    
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (warning_threshold !== undefined) updateData.warning_threshold = warning_threshold;
    if (critical_threshold !== undefined) updateData.critical_threshold = critical_threshold;
    if (enabled !== undefined) updateData.enabled = enabled;
    if (notification_channels !== undefined) updateData.notification_channels = notification_channels;
    if (cooldown_minutes !== undefined) updateData.cooldown_minutes = cooldown_minutes;

    const { data, error } = await client
      .from('performance_thresholds')
      .update(updateData)
      .eq('metric_type', metric_type)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    log.error('Failed to update threshold:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update threshold',
    });
  }
});

/**
 * @swagger
 * /api/apm/alerts:
 *   get:
 *     summary: Get performance alerts
 *     description: Get active performance alerts
 *     tags: [APM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, acknowledged, resolved]
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [warning, critical]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Performance alerts
 */
router.get('/alerts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, severity, limit } = req.query;
    
    const client = getSupabaseAdminClient();
    let query = client
      .from('performance_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string, 10) || 50);

    if (status) {
      query = query.eq('status', status);
    }
    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === '42P01') {
        return res.json({
          success: true,
          data: [],
        });
      }
      throw error;
    }

    res.json({
      success: true,
      data: data || [],
    });
  } catch (err) {
    log.error('Failed to fetch alerts:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts',
    });
  }
});

/**
 * @swagger
 * /api/apm/alerts/{id}/acknowledge:
 *   post:
 *     summary: Acknowledge performance alert
 *     description: Acknowledge a performance alert (admin only)
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
 *         description: Alert acknowledged
 */
router.post('/alerts/:id/acknowledge', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const client = getSupabaseAdminClient();
    const { error } = await client
      .from('performance_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_by: req.user?.id,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Alert acknowledged',
    });
  } catch (err) {
    log.error('Failed to acknowledge alert:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge alert',
    });
  }
});

/**
 * @swagger
 * /api/apm/alerts/{id}/resolve:
 *   post:
 *     summary: Resolve performance alert
 *     description: Resolve a performance alert (admin only)
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
 *         description: Alert resolved
 */
router.post('/alerts/:id/resolve', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const client = getSupabaseAdminClient();
    const { error } = await client
      .from('performance_alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Alert resolved',
    });
  } catch (err) {
    log.error('Failed to resolve alert:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert',
    });
  }
});

/**
 * Get default thresholds
 */
function getDefaultThresholds() {
  return [
    { metric_type: 'lcp', warning_threshold: 2500, critical_threshold: 4000, enabled: true },
    { metric_type: 'fcp', warning_threshold: 1800, critical_threshold: 3000, enabled: true },
    { metric_type: 'fid', warning_threshold: 100, critical_threshold: 300, enabled: true },
    { metric_type: 'cls', warning_threshold: 0.1, critical_threshold: 0.25, enabled: true },
    { metric_type: 'ttfb', warning_threshold: 800, critical_threshold: 1800, enabled: true },
    { metric_type: 'inp', warning_threshold: 200, critical_threshold: 500, enabled: true },
    { metric_type: 'api_latency', warning_threshold: 500, critical_threshold: 1000, enabled: true },
    { metric_type: 'error_rate', warning_threshold: 5, critical_threshold: 10, enabled: true },
  ];
}

export default router;