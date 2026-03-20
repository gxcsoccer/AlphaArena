/**
 * Scheduler API Routes
 * RESTful endpoints for automated trading schedules
 */

import { Router, Request, Response, NextFunction } from 'express';
import { 
  tradingSchedulesDAO, 
} from '../database/trading-schedules.dao';
import { getSchedulerService } from '../scheduler/SchedulerService';
import { getSchedulerRealtimeService } from '../realtime/SchedulerRealtimeService';
import getSupabaseClient from '../database/client';
import { createLogger } from '../utils/logger';

const log = createLogger('SchedulerRoutes');

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

// Validation helpers
function validateCronExpression(expression: string): { valid: boolean; error?: string } {
  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 6) {
    return { valid: false, error: 'Cron expression must have 5 or 6 fields' };
  }
  return { valid: true };
}

export function createSchedulerRouter(): Router {
  const router = Router();
  const schedulerService = getSchedulerService();
  const realtimeService = getSchedulerRealtimeService();

  // ============================================
  // Schedule CRUD Routes
  // ============================================

  router.post('/', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const {
        strategyId,
        name,
        description,
        cronExpression,
        timezone,
        scheduleType,
        intervalMinutes,
        conditionType,
        conditionParams,
        params,
        enabled,
        safetyConfig,
      } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const type = scheduleType || 'cron';
      
      if (type === 'cron') {
        if (!cronExpression) {
          return res.status(400).json({ error: 'Cron expression is required for cron schedule type' });
        }
        const cronValidation = validateCronExpression(cronExpression);
        if (!cronValidation.valid) {
          return res.status(400).json({ error: cronValidation.error });
        }
      } else if (type === 'interval') {
        if (!intervalMinutes || intervalMinutes < 1) {
          return res.status(400).json({ error: 'Valid interval minutes is required for interval schedule type' });
        }
      }

      const schedule = await tradingSchedulesDAO.create({
        userId,
        strategyId,
        name,
        description,
        cronExpression: cronExpression || '* * * * *',
        timezone,
        scheduleType: type,
        intervalMinutes,
        conditionType,
        conditionParams,
        params: params || {},
        enabled: enabled ?? true,
      });

      if (safetyConfig) {
        await tradingSchedulesDAO.createSafetyConfig({
          scheduleId: schedule.id,
          ...safetyConfig,
        });
      }

      if (schedule.enabled) {
        await schedulerService.registerSchedule(schedule);
      }

      // Broadcast schedule created event
      realtimeService.broadcastScheduleUpdate(userId, schedule.id, 'created')
        .catch(err => log.error('Failed to broadcast schedule created:', err));

      log.info('Created schedule ' + schedule.id + ' for user ' + userId);
      res.status(201).json(schedule);
    } catch (err) {
      log.error('Failed to create schedule:', err);
      res.status(500).json({ error: 'Failed to create schedule' });
    }
  });

  router.get('/', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const strategyId = getParam(req.query.strategyId as string | string[] | undefined);
      const enabled = req.query.enabled === 'true' ? true : req.query.enabled === 'false' ? false : undefined;
      const scheduleType = getParam(req.query.scheduleType as string | string[] | undefined) as 'cron' | 'interval' | 'condition' | undefined;
      const limit = parseInt(getParam(req.query.limit as string | string[] | undefined) || '50', 10);
      const offset = parseInt(getParam(req.query.offset as string | string[] | undefined) || '0', 10);

      const schedules = await tradingSchedulesDAO.findByUserId(userId, {
        strategyId,
        enabled,
        scheduleType,
        limit,
        offset,
        orderBy: 'created_at',
        orderDirection: 'desc',
      });

      const schedulesWithSafety = await Promise.all(
        schedules.map(async (schedule) => {
          const safetyConfig = await tradingSchedulesDAO.findSafetyConfigByScheduleId(schedule.id);
          return { ...schedule, safetyConfig };
        })
      );

      res.json(schedulesWithSafety);
    } catch (err) {
      log.error('Failed to get schedules:', err);
      res.status(500).json({ error: 'Failed to get schedules' });
    }
  });

  router.get('/:id', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const scheduleId = getParam(req.params.id) || '';

      const schedule = await tradingSchedulesDAO.findById(scheduleId);

      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      if (schedule.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const safetyConfig = await tradingSchedulesDAO.findSafetyConfigByScheduleId(scheduleId);

      res.json({ ...schedule, safetyConfig });
    } catch (err) {
      log.error('Failed to get schedule:', err);
      res.status(500).json({ error: 'Failed to get schedule' });
    }
  });

  router.put('/:id', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const scheduleId = getParam(req.params.id) || '';

      const existingSchedule = await tradingSchedulesDAO.findById(scheduleId);

      if (!existingSchedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      if (existingSchedule.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const {
        name,
        description,
        cronExpression,
        timezone,
        scheduleType,
        intervalMinutes,
        conditionType,
        conditionParams,
        params,
        enabled,
      } = req.body;

      if (cronExpression && (scheduleType === 'cron' || existingSchedule.scheduleType === 'cron')) {
        const cronValidation = validateCronExpression(cronExpression);
        if (!cronValidation.valid) {
          return res.status(400).json({ error: cronValidation.error });
        }
      }

      const updatedSchedule = await tradingSchedulesDAO.update(scheduleId, {
        name,
        description,
        cronExpression,
        timezone,
        scheduleType,
        intervalMinutes,
        conditionType,
        conditionParams,
        params,
        enabled,
      });

      if (updatedSchedule.enabled) {
        await schedulerService.registerSchedule(updatedSchedule);
      } else {
        await schedulerService.unregisterSchedule(scheduleId);
      }

      // Broadcast schedule updated event
      realtimeService.broadcastScheduleUpdate(userId, scheduleId, 'updated')
        .catch(err => log.error('Failed to broadcast schedule updated:', err));

      log.info('Updated schedule ' + scheduleId);
      res.json(updatedSchedule);
    } catch (err) {
      log.error('Failed to update schedule:', err);
      res.status(500).json({ error: 'Failed to update schedule' });
    }
  });

  router.delete('/:id', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const scheduleId = getParam(req.params.id) || '';

      const schedule = await tradingSchedulesDAO.findById(scheduleId);

      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      if (schedule.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await schedulerService.unregisterSchedule(scheduleId);
      await tradingSchedulesDAO.delete(scheduleId);

      // Broadcast schedule deleted event
      realtimeService.broadcastScheduleUpdate(userId, scheduleId, 'deleted')
        .catch(err => log.error('Failed to broadcast schedule deleted:', err));

      log.info('Deleted schedule ' + scheduleId);
      res.json({ success: true });
    } catch (err) {
      log.error('Failed to delete schedule:', err);
      res.status(500).json({ error: 'Failed to delete schedule' });
    }
  });

  // ============================================
  // Schedule Control Routes
  // ============================================

  router.post('/:id/enable', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const scheduleId = getParam(req.params.id) || '';

      const schedule = await tradingSchedulesDAO.findById(scheduleId);

      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      if (schedule.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updatedSchedule = await tradingSchedulesDAO.update(scheduleId, { enabled: true });
      await schedulerService.registerSchedule(updatedSchedule);

      // Broadcast schedule enabled event
      realtimeService.broadcastScheduleUpdate(userId, scheduleId, 'enabled')
        .catch(err => log.error('Failed to broadcast schedule enabled:', err));

      log.info('Enabled schedule ' + scheduleId);
      res.json(updatedSchedule);
    } catch (err) {
      log.error('Failed to enable schedule:', err);
      res.status(500).json({ error: 'Failed to enable schedule' });
    }
  });

  router.post('/:id/disable', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const scheduleId = getParam(req.params.id) || '';

      const schedule = await tradingSchedulesDAO.findById(scheduleId);

      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      if (schedule.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await schedulerService.unregisterSchedule(scheduleId);
      const updatedSchedule = await tradingSchedulesDAO.update(scheduleId, { enabled: false });

      // Broadcast schedule disabled event
      realtimeService.broadcastScheduleUpdate(userId, scheduleId, 'disabled')
        .catch(err => log.error('Failed to broadcast schedule disabled:', err));

      log.info('Disabled schedule ' + scheduleId);
      res.json(updatedSchedule);
    } catch (err) {
      log.error('Failed to disable schedule:', err);
      res.status(500).json({ error: 'Failed to disable schedule' });
    }
  });

  router.post('/:id/execute', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const scheduleId = getParam(req.params.id) || '';

      const schedule = await tradingSchedulesDAO.findById(scheduleId);

      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      if (schedule.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const execution = await schedulerService.executeSchedule(scheduleId, 'manual');

      if (!execution) {
        return res.status(500).json({ error: 'Failed to execute schedule' });
      }

      log.info('Manually executed schedule ' + scheduleId);
      res.json(execution);
    } catch (err) {
      log.error('Failed to execute schedule:', err);
      res.status(500).json({ error: 'Failed to execute schedule' });
    }
  });

  // ============================================
  // Execution History Routes
  // ============================================

  router.get('/:id/executions', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const scheduleId = getParam(req.params.id) || '';
      const status = getParam(req.query.status as string | string[] | undefined) as 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'cancelled' | undefined;
      const triggerType = getParam(req.query.triggerType as string | string[] | undefined) as 'scheduled' | 'manual' | 'condition' | undefined;
      const limit = parseInt(getParam(req.query.limit as string | string[] | undefined) || '50', 10);
      const offset = parseInt(getParam(req.query.offset as string | string[] | undefined) || '0', 10);

      const schedule = await tradingSchedulesDAO.findById(scheduleId);

      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      if (schedule.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const executions = await tradingSchedulesDAO.findExecutionsByScheduleId(scheduleId, {
        status,
        triggerType,
        limit,
        offset,
        orderBy: 'scheduled_at',
        orderDirection: 'desc',
      });

      const total = await tradingSchedulesDAO.countExecutionsByScheduleId(scheduleId);

      res.json({
        executions,
        total,
        limit,
        offset,
      });
    } catch (err) {
      log.error('Failed to get executions:', err);
      res.status(500).json({ error: 'Failed to get executions' });
    }
  });

  router.get('/:id/executions/:executionId', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const scheduleId = getParam(req.params.id) || '';
      const executionId = getParam(req.params.executionId) || '';

      const schedule = await tradingSchedulesDAO.findById(scheduleId);

      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      if (schedule.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const execution = await tradingSchedulesDAO.findExecutionById(executionId);

      if (!execution || execution.scheduleId !== scheduleId) {
        return res.status(404).json({ error: 'Execution not found' });
      }

      res.json(execution);
    } catch (err) {
      log.error('Failed to get execution:', err);
      res.status(500).json({ error: 'Failed to get execution' });
    }
  });

  // ============================================
  // Safety Config Routes
  // ============================================

  router.get('/:id/safety', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const scheduleId = getParam(req.params.id) || '';

      const schedule = await tradingSchedulesDAO.findById(scheduleId);

      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      if (schedule.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const safetyConfig = await tradingSchedulesDAO.findSafetyConfigByScheduleId(scheduleId);

      if (!safetyConfig) {
        return res.status(404).json({ error: 'Safety config not found' });
      }

      res.json(safetyConfig);
    } catch (err) {
      log.error('Failed to get safety config:', err);
      res.status(500).json({ error: 'Failed to get safety config' });
    }
  });

  router.put('/:id/safety', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const scheduleId = getParam(req.params.id) || '';

      const schedule = await tradingSchedulesDAO.findById(scheduleId);

      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      if (schedule.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const {
        maxPositionSize,
        maxPositionPercent,
        maxDailyTrades,
        maxDailyValue,
        stopLossPercent,
        takeProfitPercent,
        minBalanceRequired,
        minMarginAvailable,
        maxConsecutiveFailures,
        cooldownAfterFailureMinutes,
        notifyOnSuccess,
        notifyOnFailure,
        isPaused,
      } = req.body;

      let safetyConfig = await tradingSchedulesDAO.findSafetyConfigByScheduleId(scheduleId);

      if (!safetyConfig) {
        safetyConfig = await tradingSchedulesDAO.createSafetyConfig({
          scheduleId,
          maxPositionSize,
          maxPositionPercent,
          maxDailyTrades,
          maxDailyValue,
          stopLossPercent,
          takeProfitPercent,
          minBalanceRequired,
          minMarginAvailable,
          maxConsecutiveFailures,
          cooldownAfterFailureMinutes,
          notifyOnSuccess,
          notifyOnFailure,
        });
      } else {
        safetyConfig = await tradingSchedulesDAO.updateSafetyConfig(scheduleId, {
          maxPositionSize,
          maxPositionPercent,
          maxDailyTrades,
          maxDailyValue,
          stopLossPercent,
          takeProfitPercent,
          minBalanceRequired,
          minMarginAvailable,
          maxConsecutiveFailures,
          cooldownAfterFailureMinutes,
          notifyOnSuccess,
          notifyOnFailure,
          isPaused,
        });
      }

      log.info('Updated safety config for schedule ' + scheduleId);
      res.json(safetyConfig);
    } catch (err) {
      log.error('Failed to update safety config:', err);
      res.status(500).json({ error: 'Failed to update safety config' });
    }
  });

  router.post('/:id/safety/reset', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const scheduleId = getParam(req.params.id) || '';

      const schedule = await tradingSchedulesDAO.findById(scheduleId);

      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      if (schedule.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const safetyConfig = await tradingSchedulesDAO.updateSafetyConfig(scheduleId, {
        consecutiveFailures: 0,
        lastFailureAt: undefined,
        isPaused: false,
      });

      log.info('Reset safety config for schedule ' + scheduleId);
      res.json(safetyConfig);
    } catch (err) {
      log.error('Failed to reset safety config:', err);
      res.status(500).json({ error: 'Failed to reset safety config' });
    }
  });

  // ============================================
  // Scheduler Status Route
  // ============================================

  router.get('/status/all', authenticateUser, async (req: Request, res: Response) => {
    try {
      const status = schedulerService.getStatus();
      res.json(status);
    } catch (err) {
      log.error('Failed to get scheduler status:', err);
      res.status(500).json({ error: 'Failed to get scheduler status' });
    }
  });

  return router;
}
