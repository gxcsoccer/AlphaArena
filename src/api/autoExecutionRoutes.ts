/**
 * Auto Execution API Routes
 * RESTful endpoints for VIP automated strategy execution
 */

import { Router, Request, Response, NextFunction } from 'express';
import { autoExecutionDAO } from '../auto-execution/auto-execution.dao';
import { getAutoExecutionService } from '../auto-execution/AutoExecutionService';
import { requireFeature } from '../middleware/subscription.middleware';
import getSupabaseClient from '../database/client';
import { createLogger } from '../utils/logger';
import {
  CreateAutoExecutionInput,
  UpdateAutoExecutionInput,
  DEFAULT_RISK_CONTROLS,
} from '../auto-execution/types';

const log = createLogger('AutoExecutionRoutes');

// Helper to get single string from params/query
function getParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

// Authentication middleware
async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const supabase = getSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    (req as any).userId = user.id;
    next();
  } catch (err) {
    console.error('Auth error:', err);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

export function createAutoExecutionRouter(): Router {
  const router = Router();
  const autoExecutionService = getAutoExecutionService();

  // ============================================
  // Configuration Routes
  // ============================================

  /**
   * @route POST /api/auto-execution/configs
   * @description Create a new auto execution configuration
   * @access VIP (Pro, Enterprise)
   */
  router.post(
    '/configs',
    authenticateUser,
    requireFeature('auto_execution'),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).userId;
        const {
          signalSource,
          strategyId,
          signalSubscriptionId,
          copyTradingId,
          executionMode,
          defaultOrderType,
          batchIntervalMinutes,
          signalThreshold,
          tradingPairs,
          executionWindows,
          riskControls,
          notifyOnExecution,
          notifyOnError,
          notifyOnRiskEvent,
        } = req.body;

        if (!signalSource) {
          return res.status(400).json({ error: 'Signal source is required' });
        }

        const input: CreateAutoExecutionInput = {
          userId,
          signalSource,
          strategyId,
          signalSubscriptionId,
          copyTradingId,
          executionMode,
          defaultOrderType,
          batchIntervalMinutes,
          signalThreshold,
          tradingPairs,
          executionWindows,
          riskControls: {
            ...DEFAULT_RISK_CONTROLS,
            ...riskControls,
          },
          notifyOnExecution,
          notifyOnError,
          notifyOnRiskEvent,
        };

        const config = await autoExecutionService.createConfig(input);

        log.info(`Created auto execution config ${config.id} for user ${userId}`);
        res.status(201).json(config);
      } catch (err) {
        log.error('Failed to create auto execution config:', err);
        
        if (err instanceof Error && err.message.includes('VIP-exclusive')) {
          return res.status(403).json({ 
            error: 'VIP Required',
            message: err.message,
            upgrade_url: '/pricing',
          });
        }
        
        res.status(500).json({ error: 'Failed to create auto execution config' });
      }
    }
  );

  /**
   * @route GET /api/auto-execution/configs
   * @description Get user's auto execution configurations
   * @access VIP (Pro, Enterprise)
   */
  router.get(
    '/configs',
    authenticateUser,
    requireFeature('auto_execution'),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).userId;

        const configs = await autoExecutionService.getUserConfigs(userId);

        res.json(configs);
      } catch (err) {
        log.error('Failed to get auto execution configs:', err);
        res.status(500).json({ error: 'Failed to get auto execution configs' });
      }
    }
  );

  /**
   * @route GET /api/auto-execution/configs/:id
   * @description Get a specific auto execution configuration
   * @access VIP (Pro, Enterprise)
   */
  router.get(
    '/configs/:id',
    authenticateUser,
    requireFeature('auto_execution'),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).userId;
        const configId = getParam(req.params.id) || '';

        const config = await autoExecutionService.getConfig(configId, userId);

        res.json(config);
      } catch (err) {
        log.error('Failed to get auto execution config:', err);
        
        if (err instanceof Error && err.message.includes('not found')) {
          return res.status(404).json({ error: 'Configuration not found' });
        }
        
        if (err instanceof Error && err.message.includes('Access denied')) {
          return res.status(403).json({ error: 'Access denied' });
        }
        
        res.status(500).json({ error: 'Failed to get auto execution config' });
      }
    }
  );

  /**
   * @route PUT /api/auto-execution/configs/:id
   * @description Update an auto execution configuration
   * @access VIP (Pro, Enterprise)
   */
  router.put(
    '/configs/:id',
    authenticateUser,
    requireFeature('auto_execution'),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).userId;
        const configId = getParam(req.params.id) || '';

        const input: UpdateAutoExecutionInput = {
          ...req.body,
        };

        const config = await autoExecutionService.updateConfig(configId, userId, input);

        log.info(`Updated auto execution config ${configId}`);
        res.json(config);
      } catch (err) {
        log.error('Failed to update auto execution config:', err);
        
        if (err instanceof Error && err.message.includes('not found')) {
          return res.status(404).json({ error: 'Configuration not found' });
        }
        
        if (err instanceof Error && err.message.includes('Access denied')) {
          return res.status(403).json({ error: 'Access denied' });
        }
        
        res.status(500).json({ error: 'Failed to update auto execution config' });
      }
    }
  );

  /**
   * @route DELETE /api/auto-execution/configs/:id
   * @description Delete an auto execution configuration
   * @access VIP (Pro, Enterprise)
   */
  router.delete(
    '/configs/:id',
    authenticateUser,
    requireFeature('auto_execution'),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).userId;
        const configId = getParam(req.params.id) || '';

        await autoExecutionService.deleteConfig(configId, userId);

        log.info(`Deleted auto execution config ${configId}`);
        res.json({ success: true });
      } catch (err) {
        log.error('Failed to delete auto execution config:', err);
        
        if (err instanceof Error && err.message.includes('not found')) {
          return res.status(404).json({ error: 'Configuration not found' });
        }
        
        if (err instanceof Error && err.message.includes('Access denied')) {
          return res.status(403).json({ error: 'Access denied' });
        }
        
        res.status(500).json({ error: 'Failed to delete auto execution config' });
      }
    }
  );

  // ============================================
  // Control Routes
  // ============================================

  /**
   * @route POST /api/auto-execution/configs/:id/enable
   * @description Enable auto execution
   * @access VIP (Pro, Enterprise)
   */
  router.post(
    '/configs/:id/enable',
    authenticateUser,
    requireFeature('auto_execution'),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).userId;
        const configId = getParam(req.params.id) || '';

        const config = await autoExecutionService.enableConfig(configId, userId);

        log.info(`Enabled auto execution config ${configId}`);
        res.json(config);
      } catch (err) {
        log.error('Failed to enable auto execution config:', err);
        
        if (err instanceof Error && err.message.includes('not found')) {
          return res.status(404).json({ error: 'Configuration not found' });
        }
        
        if (err instanceof Error && err.message.includes('VIP')) {
          return res.status(403).json({ 
            error: 'VIP Required',
            message: err.message,
          });
        }
        
        res.status(500).json({ error: 'Failed to enable auto execution config' });
      }
    }
  );

  /**
   * @route POST /api/auto-execution/configs/:id/disable
   * @description Disable auto execution
   * @access VIP (Pro, Enterprise)
   */
  router.post(
    '/configs/:id/disable',
    authenticateUser,
    requireFeature('auto_execution'),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).userId;
        const configId = getParam(req.params.id) || '';

        const config = await autoExecutionService.disableConfig(configId, userId);

        log.info(`Disabled auto execution config ${configId}`);
        res.json(config);
      } catch (err) {
        log.error('Failed to disable auto execution config:', err);
        res.status(500).json({ error: 'Failed to disable auto execution config' });
      }
    }
  );

  /**
   * @route POST /api/auto-execution/configs/:id/pause
   * @description Pause auto execution
   * @access VIP (Pro, Enterprise)
   */
  router.post(
    '/configs/:id/pause',
    authenticateUser,
    requireFeature('auto_execution'),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).userId;
        const configId = getParam(req.params.id) || '';
        const { reason } = req.body;

        const config = await autoExecutionService.pauseConfig(configId, userId, reason);

        log.info(`Paused auto execution config ${configId}`);
        res.json(config);
      } catch (err) {
        log.error('Failed to pause auto execution config:', err);
        res.status(500).json({ error: 'Failed to pause auto execution config' });
      }
    }
  );

  // ============================================
  // Execution Logs Routes
  // ============================================

  /**
   * @route GET /api/auto-execution/logs
   * @description Get user's execution logs
   * @access VIP (Pro, Enterprise)
   */
  router.get(
    '/logs',
    authenticateUser,
    requireFeature('auto_execution'),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).userId;
        const configId = getParam(req.query.configId as string | string[] | undefined);
        const limit = parseInt(getParam(req.query.limit as string | string[] | undefined) || '50', 10);

        const logs = await autoExecutionService.getExecutionLogs(userId, configId, limit);

        res.json(logs);
      } catch (err) {
        log.error('Failed to get execution logs:', err);
        res.status(500).json({ error: 'Failed to get execution logs' });
      }
    }
  );

  /**
   * @route GET /api/auto-execution/logs/:id
   * @description Get a specific execution log
   * @access VIP (Pro, Enterprise)
   */
  router.get(
    '/logs/:id',
    authenticateUser,
    requireFeature('auto_execution'),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).userId;
        const logId = getParam(req.params.id) || '';

        const executionLog = await autoExecutionService.getExecutionLog(logId, userId);

        if (!executionLog) {
          return res.status(404).json({ error: 'Execution log not found' });
        }

        res.json(executionLog);
      } catch (err) {
        log.error('Failed to get execution log:', err);
        res.status(500).json({ error: 'Failed to get execution log' });
      }
    }
  );

  /**
   * @route GET /api/auto-execution/configs/:id/logs
   * @description Get execution logs for a specific config
   * @access VIP (Pro, Enterprise)
   */
  router.get(
    '/configs/:id/logs',
    authenticateUser,
    requireFeature('auto_execution'),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).userId;
        const configId = getParam(req.params.id) || '';
        const status = getParam(req.query.status as string | string[] | undefined);
        const limit = parseInt(getParam(req.query.limit as string | string[] | undefined) || '50', 10);
        const offset = parseInt(getParam(req.query.offset as string | string[] | undefined) || '0', 10);

        // Verify ownership
        await autoExecutionService.getConfig(configId, userId);

        const logs = await autoExecutionDAO.findExecutionLogsByConfigId(configId, {
          executionStatus: status as any,
          limit,
          offset,
        });

        res.json(logs);
      } catch (err) {
        log.error('Failed to get config execution logs:', err);
        
        if (err instanceof Error && err.message.includes('Access denied')) {
          return res.status(403).json({ error: 'Access denied' });
        }
        
        res.status(500).json({ error: 'Failed to get execution logs' });
      }
    }
  );

  // ============================================
  // Statistics Routes
  // ============================================

  /**
   * @route GET /api/auto-execution/configs/:id/stats
   * @description Get execution statistics for a config
   * @access VIP (Pro, Enterprise)
   */
  router.get(
    '/configs/:id/stats',
    authenticateUser,
    requireFeature('auto_execution'),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).userId;
        const configId = getParam(req.params.id) || '';

        // Verify ownership
        const config = await autoExecutionService.getConfig(configId, userId);

        // Get statistics
        const [
          todayExecutions,
          hourlyExecutions,
          todayVolume,
          consecutiveLosses,
        ] = await Promise.all([
          autoExecutionDAO.getTodayExecutionCount(configId),
          autoExecutionDAO.getHourlyExecutionCount(configId),
          autoExecutionDAO.getTodayVolume(configId),
          autoExecutionDAO.getConsecutiveLossCount(configId),
        ]);

        res.json({
          config: {
            id: config.id,
            status: config.status,
            totalExecutions: config.totalExecutions,
            successfulExecutions: config.successfulExecutions,
            failedExecutions: config.failedExecutions,
            totalVolume: config.totalVolume,
            totalPnl: config.totalPnl,
          },
          today: {
            executions: todayExecutions,
            hourlyExecutions,
            volume: todayVolume,
            maxTrades: config.riskControls.maxDailyTrades,
            maxVolume: config.riskControls.maxDailyVolume,
          },
          risk: {
            consecutiveLosses,
            circuitBreakerThreshold: config.riskControls.circuitBreakerThreshold,
            isPaused: config.status === 'paused',
          },
        });
      } catch (err) {
        log.error('Failed to get config stats:', err);
        
        if (err instanceof Error && err.message.includes('Access denied')) {
          return res.status(403).json({ error: 'Access denied' });
        }
        
        res.status(500).json({ error: 'Failed to get statistics' });
      }
    }
  );

  /**
   * @route GET /api/auto-execution/status
   * @description Get auto execution service status
   * @access Authenticated users
   */
  router.get(
    '/status',
    authenticateUser,
    async (req: Request, res: Response) => {
      try {
        const status = autoExecutionService.getStatus();
        res.json(status);
      } catch (err) {
        log.error('Failed to get service status:', err);
        res.status(500).json({ error: 'Failed to get service status' });
      }
    }
  );

  return router;
}