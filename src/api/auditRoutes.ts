/**
 * Audit Log API Routes
 * Issue #641: Security Audit - API Permissions, Data Access Logging
 *
 * Admin-only endpoints for viewing and analyzing audit logs.
 */

import { Router, Request, Response } from 'express';
import { authMiddleware, requireAdmin } from './authMiddleware';
import { AuditDAO, AuditLog, AuditActionCategory, AuditRiskLevel } from '../database/audit.dao';
import { createLogger } from '../utils/logger';

const log = createLogger('AuditRoutes');

const router = Router();

/**
 * @openapi
 * /api/audit/logs:
 *   get:
 *     tags:
 *       - Audit
 *     summary: Get audit logs
 *     description: Retrieve audit logs with filtering and pagination (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action
 *       - in: query
 *         name: action_category
 *         schema:
 *           type: string
 *           enum: [auth, data_access, payment, subscription, export, admin, security]
 *         description: Filter by action category
 *       - in: query
 *         name: resource_type
 *         schema:
 *           type: string
 *         description: Filter by resource type
 *       - in: query
 *         name: risk_level
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         description: Filter by risk level
 *       - in: query
 *         name: is_sensitive
 *         schema:
 *           type: boolean
 *         description: Filter sensitive actions only
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date filter
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date filter
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 200
 *         description: Number of results
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Offset for pagination
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [created_at, response_time_ms, risk_level]
 *           default: created_at
 *         description: Sort field
 *       - in: query
 *         name: sort_order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AuditLog'
 *                 total:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 offset:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get(
  '/logs',
  authMiddleware,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const {
        user_id,
        action,
        action_category,
        resource_type,
        resource_id,
        ip_address,
        risk_level,
        is_sensitive,
        start_date,
        end_date,
        limit = '50',
        offset = '0',
        sort_by = 'created_at',
        sort_order = 'desc',
      } = req.query;

      // Parse and validate limit
      const parsedLimit = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 200);

      // Build query options
      const options = {
        user_id: user_id as string,
        action: action as string,
        action_category: action_category as AuditActionCategory,
        resource_type: resource_type as string,
        resource_id: resource_id as string,
        ip_address: ip_address as string,
        risk_level: risk_level as AuditRiskLevel,
        is_sensitive: is_sensitive === 'true' ? true : is_sensitive === 'false' ? false : undefined,
        start_date: start_date as string,
        end_date: end_date as string,
        limit: parsedLimit,
        offset: parseInt(offset as string, 10) || 0,
        sort_by: sort_by as 'created_at' | 'response_time_ms' | 'risk_level',
        sort_order: sort_order as 'asc' | 'desc',
      };

      const result = await AuditDAO.getAuditLogs(options);

      res.json({
        success: true,
        data: result.logs,
        total: result.total,
        limit: parsedLimit,
        offset: options.offset,
      });
    } catch (error: any) {
      log.error('Failed to get audit logs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve audit logs',
        message: error.message,
      });
    }
  }
);

/**
 * @openapi
 * /api/audit/logs/{id}:
 *   get:
 *     tags:
 *       - Audit
 *     summary: Get audit log by ID
 *     description: Retrieve a specific audit log entry (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Audit log ID
 *     responses:
 *       200:
 *         description: Audit log retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Audit log not found
 */
router.get(
  '/logs/:id',
  authMiddleware,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const auditLog = await AuditDAO.getAuditLogById(id);

      if (!auditLog) {
        return res.status(404).json({
          success: false,
          error: 'Audit log not found',
        });
      }

      res.json({
        success: true,
        data: auditLog,
      });
    } catch (error: any) {
      log.error('Failed to get audit log:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve audit log',
      });
    }
  }
);

/**
 * @openapi
 * /api/audit/stats:
 *   get:
 *     tags:
 *       - Audit
 *     summary: Get daily audit statistics
 *     description: Get aggregated daily audit statistics (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get(
  '/stats',
  authMiddleware,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { start_date, end_date } = req.query;
      const stats = await AuditDAO.getDailyStats(
        start_date as string,
        end_date as string
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      log.error('Failed to get audit stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve audit statistics',
      });
    }
  }
);

/**
 * @openapi
 * /api/audit/stats/today:
 *   get:
 *     tags:
 *       - Audit
 *     summary: Get today's audit statistics
 *     description: Get today's aggregated audit statistics (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Today's statistics retrieved successfully
 */
router.get(
  '/stats/today',
  authMiddleware,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const stats = await AuditDAO.getTodayStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      log.error('Failed to get today stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve today\'s statistics',
      });
    }
  }
);

/**
 * @openapi
 * /api/audit/users/{userId}:
 *   get:
 *     tags:
 *       - Audit
 *     summary: Get user audit logs
 *     description: Get audit logs for a specific user (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of results
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Offset for pagination
 *     responses:
 *       200:
 *         description: User audit logs retrieved successfully
 */
router.get(
  '/users/:userId',
  authMiddleware,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId as string;
      const { limit, offset } = req.query;

      const result = await AuditDAO.getUserAuditLogs(userId, {
        limit: parseInt(limit as string, 10) || 50,
        offset: parseInt(offset as string, 10) || 0,
      });

      res.json({
        success: true,
        data: result.logs,
        total: result.total,
      });
    } catch (error: any) {
      log.error('Failed to get user audit logs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve user audit logs',
      });
    }
  }
);

/**
 * @openapi
 * /api/audit/users/{userId}/summary:
 *   get:
 *     tags:
 *       - Audit
 *     summary: Get user audit summary
 *     description: Get audit summary for a specific user (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to include
 *     responses:
 *       200:
 *         description: User audit summary retrieved successfully
 */
router.get(
  '/users/:userId/summary',
  authMiddleware,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId as string;
      const { days = '30' } = req.query;

      const summary = await AuditDAO.getUserAuditSummary(
        userId,
        parseInt(days as string, 10) || 30
      );

      res.json({
        success: true,
        data: summary,
      });
    } catch (error: any) {
      log.error('Failed to get user audit summary:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve user audit summary',
      });
    }
  }
);

/**
 * @openapi
 * /api/audit/resources/{resourceType}/{resourceId}:
 *   get:
 *     tags:
 *       - Audit
 *     summary: Get resource audit logs
 *     description: Get audit logs for a specific resource (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: resourceType
 *         required: true
 *         schema:
 *           type: string
 *         description: Resource type
 *       - in: path
 *         name: resourceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Resource ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of results
 *     responses:
 *       200:
 *         description: Resource audit logs retrieved successfully
 */
router.get(
  '/resources/:resourceType/:resourceId',
  authMiddleware,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const resourceType = req.params.resourceType as string;
      const resourceId = req.params.resourceId as string;
      const { limit } = req.query;

      const result = await AuditDAO.getResourceAuditLogs(
        resourceType,
        resourceId,
        {
          limit: parseInt(limit as string, 10) || 50,
        }
      );

      res.json({
        success: true,
        data: result.logs,
        total: result.total,
      });
    } catch (error: any) {
      log.error('Failed to get resource audit logs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve resource audit logs',
      });
    }
  }
);

/**
 * @openapi
 * /api/audit/suspicious:
 *   get:
 *     tags:
 *       - Audit
 *     summary: Detect suspicious activity
 *     description: Detect potentially suspicious activity patterns (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *         description: User ID to check
 *       - in: query
 *         name: ip_address
 *         schema:
 *           type: string
 *         description: IP address to check
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 24
 *         description: Time window in hours
 *     responses:
 *       200:
 *         description: Suspicious activity analysis completed
 */
router.get(
  '/suspicious',
  authMiddleware,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { user_id, ip_address, hours = '24' } = req.query;

      const suspiciousActivity = await AuditDAO.detectSuspiciousActivity(
        user_id as string,
        ip_address as string,
        parseInt(hours as string, 10) || 24
      );

      res.json({
        success: true,
        data: suspiciousActivity,
      });
    } catch (error: any) {
      log.error('Failed to detect suspicious activity:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to detect suspicious activity',
      });
    }
  }
);

/**
 * @openapi
 * /api/audit/aggregate:
 *   post:
 *     tags:
 *       - Audit
 *     summary: Aggregate daily stats
 *     description: Trigger daily stats aggregation for a specific date (admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Date to aggregate (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Aggregation completed successfully
 */
router.post(
  '/aggregate',
  authMiddleware,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { date } = req.body;
      await AuditDAO.aggregateDailyStats(date);

      res.json({
        success: true,
        message: `Aggregated stats for ${date || 'today'}`,
      });
    } catch (error: any) {
      log.error('Failed to aggregate stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to aggregate stats',
      });
    }
  }
);

export default router;