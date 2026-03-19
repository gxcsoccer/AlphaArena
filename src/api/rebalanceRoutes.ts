/**
 * Rebalance API Routes
 * RESTful endpoints for portfolio rebalancing automation
 */

import { Router, Request, Response } from 'express';
import { rebalanceDAO } from '../database/rebalance.dao';
import { RebalanceEngine } from '../portfolio/rebalance/RebalanceEngine';
import {
  RebalanceTrigger,
  RebalanceOrderType,
  ScheduleFrequency,
  type TargetAllocation,
  type RebalancePlan,
  type RebalancePreview,
  type AssetAllocation,
} from '../portfolio/rebalance/types';
import getSupabaseClient from '../database/client';
import { createLogger } from '../utils/logger';

const log = createLogger('RebalanceRoutes');

/**
 * Helper to get single string from params/query
 */
function getParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Authentication middleware
 */
async function authenticateUser(req: Request, res: Response, next: Function) {
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

/**
 * Input validation helpers
 */
function validateAllocationWeight(allocations: AssetAllocation[]): { valid: boolean; error?: string } {
  if (!Array.isArray(allocations) || allocations.length === 0) {
    return { valid: false, error: 'Allocations must be a non-empty array' };
  }

  let totalWeight = 0;
  for (const allocation of allocations) {
    if (!allocation.symbol || typeof allocation.targetWeight !== 'number') {
      return { valid: false, error: 'Each allocation must have symbol and targetWeight' };
    }
    if (allocation.targetWeight < 0 || allocation.targetWeight > 100) {
      return { valid: false, error: 'Target weight must be between 0 and 100' };
    }
    totalWeight += allocation.targetWeight;
  }

  // Allow small deviation (e.g., 99-101)
  if (totalWeight < 99 || totalWeight > 101) {
    return { valid: false, error: `Total weight must be 100% (currently ${totalWeight}%)` };
  }

  return { valid: true };
}

export function createRebalanceRouter(): Router {
  const router = Router();

  // ============================================
  // Target Allocation Routes
  // ============================================

  /**
   * POST /api/rebalance/allocations
   * Create a new target allocation configuration
   */
  router.post('/allocations', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { name, description, allocations } = req.body;

      // Validation
      if (!name || typeof name !== 'string') {
        res.status(400).json({ error: 'Name is required' });
        return;
      }

      const validation = validateAllocationWeight(allocations);
      if (!validation.valid) {
        res.status(400).json({ error: validation.error });
        return;
      }

      const totalWeight = allocations.reduce((sum: number, a: AssetAllocation) => sum + a.targetWeight, 0);

      const allocation = await rebalanceDAO.createTargetAllocation({
        name,
        description,
        allocations,
        totalWeight,
      });

      log.info('Created target allocation', { id: allocation.id, name });

      res.status(201).json({
        success: true,
        data: allocation,
      });
    } catch (error) {
      log.error('Failed to create target allocation', { error });
      res.status(500).json({ error: 'Failed to create target allocation' });
    }
  });

  /**
   * GET /api/rebalance/allocations
   * Get all target allocations
   */
  router.get('/allocations', authenticateUser, async (_req: Request, res: Response) => {
    try {
      const allocations = await rebalanceDAO.getTargetAllocations();

      res.json({
        success: true,
        data: allocations,
      });
    } catch (error) {
      log.error('Failed to get target allocations', { error });
      res.status(500).json({ error: 'Failed to get target allocations' });
    }
  });

  /**
   * GET /api/rebalance/allocations/:id
   * Get a specific target allocation
   */
  router.get('/allocations/:id', authenticateUser, async (req: Request, res: Response) => {
    try {
      const id = getParam(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Allocation ID is required' });
        return;
      }

      const allocation = await rebalanceDAO.getTargetAllocation(id);

      if (!allocation) {
        res.status(404).json({ error: 'Target allocation not found' });
        return;
      }

      res.json({
        success: true,
        data: allocation,
      });
    } catch (error) {
      log.error('Failed to get target allocation', { error });
      res.status(500).json({ error: 'Failed to get target allocation' });
    }
  });

  /**
   * PUT /api/rebalance/allocations/:id
   * Update a target allocation
   */
  router.put('/allocations/:id', authenticateUser, async (req: Request, res: Response) => {
    try {
      const id = getParam(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Allocation ID is required' });
        return;
      }

      const { name, description, allocations } = req.body;
      const updates: Partial<TargetAllocation> = {};

      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (allocations !== undefined) {
        const validation = validateAllocationWeight(allocations);
        if (!validation.valid) {
          res.status(400).json({ error: validation.error });
          return;
        }
        updates.allocations = allocations;
        updates.totalWeight = allocations.reduce((sum: number, a: AssetAllocation) => sum + a.targetWeight, 0);
      }

      const allocation = await rebalanceDAO.updateTargetAllocation(id, updates);

      log.info('Updated target allocation', { id });

      res.json({
        success: true,
        data: allocation,
      });
    } catch (error) {
      log.error('Failed to update target allocation', { error });
      res.status(500).json({ error: 'Failed to update target allocation' });
    }
  });

  /**
   * DELETE /api/rebalance/allocations/:id
   * Delete a target allocation
   */
  router.delete('/allocations/:id', authenticateUser, async (req: Request, res: Response) => {
    try {
      const id = getParam(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Allocation ID is required' });
        return;
      }

      await rebalanceDAO.deleteTargetAllocation(id);

      log.info('Deleted target allocation', { id });

      res.json({
        success: true,
        message: 'Target allocation deleted',
      });
    } catch (error) {
      log.error('Failed to delete target allocation', { error });
      res.status(500).json({ error: 'Failed to delete target allocation' });
    }
  });

  // ============================================
  // Rebalance Plan Routes
  // ============================================

  /**
   * POST /api/rebalance/plans
   * Create a new rebalance plan
   */
  router.post('/plans', authenticateUser, async (req: Request, res: Response) => {
    try {
      const {
        name,
        description,
        targetAllocationId,
        trigger,
        threshold,
        schedule,
        isActive,
      } = req.body;

      // Validation
      if (!name || typeof name !== 'string') {
        res.status(400).json({ error: 'Name is required' });
        return;
      }

      if (!targetAllocationId) {
        res.status(400).json({ error: 'Target allocation ID is required' });
        return;
      }

      const triggerType = trigger as RebalanceTrigger;
      if (!Object.values(RebalanceTrigger).includes(triggerType)) {
        res.status(400).json({ error: 'Invalid trigger type' });
        return;
      }

      if (triggerType === RebalanceTrigger.THRESHOLD && (threshold === undefined || threshold <= 0)) {
        res.status(400).json({ error: 'Threshold is required for threshold trigger' });
        return;
      }

      if (triggerType === RebalanceTrigger.SCHEDULED && !schedule) {
        res.status(400).json({ error: 'Schedule is required for scheduled trigger' });
        return;
      }

      const plan = await rebalanceDAO.createPlan({
        name,
        description,
        targetAllocationId,
        trigger: triggerType,
        threshold,
        schedule,
        isActive: isActive ?? true,
      });

      log.info('Created rebalance plan', { id: plan.id, name });

      res.status(201).json({
        success: true,
        data: plan,
      });
    } catch (error) {
      log.error('Failed to create rebalance plan', { error });
      res.status(500).json({ error: 'Failed to create rebalance plan' });
    }
  });

  /**
   * GET /api/rebalance/plans
   * Get all rebalance plans
   */
  router.get('/plans', authenticateUser, async (req: Request, res: Response) => {
    try {
      const activeOnly = getParam(req.query.activeOnly as string) === 'true';
      const plans = await rebalanceDAO.getPlans(activeOnly);

      res.json({
        success: true,
        data: plans,
      });
    } catch (error) {
      log.error('Failed to get rebalance plans', { error });
      res.status(500).json({ error: 'Failed to get rebalance plans' });
    }
  });

  /**
   * GET /api/rebalance/plans/:id
   * Get a specific rebalance plan
   */
  router.get('/plans/:id', authenticateUser, async (req: Request, res: Response) => {
    try {
      const id = getParam(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Plan ID is required' });
        return;
      }

      const plan = await rebalanceDAO.getPlan(id);

      if (!plan) {
        res.status(404).json({ error: 'Rebalance plan not found' });
        return;
      }

      res.json({
        success: true,
        data: plan,
      });
    } catch (error) {
      log.error('Failed to get rebalance plan', { error });
      res.status(500).json({ error: 'Failed to get rebalance plan' });
    }
  });

  /**
   * PUT /api/rebalance/plans/:id
   * Update a rebalance plan
   */
  router.put('/plans/:id', authenticateUser, async (req: Request, res: Response) => {
    try {
      const id = getParam(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Plan ID is required' });
        return;
      }

      const { name, description, targetAllocationId, trigger, threshold, schedule, isActive } = req.body;
      const updates: Partial<RebalancePlan> = {};

      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (targetAllocationId !== undefined) updates.targetAllocationId = targetAllocationId;
      if (trigger !== undefined) updates.trigger = trigger;
      if (threshold !== undefined) updates.threshold = threshold;
      if (schedule !== undefined) updates.schedule = schedule;
      if (isActive !== undefined) updates.isActive = isActive;

      const plan = await rebalanceDAO.updatePlan(id, updates);

      log.info('Updated rebalance plan', { id });

      res.json({
        success: true,
        data: plan,
      });
    } catch (error) {
      log.error('Failed to update rebalance plan', { error });
      res.status(500).json({ error: 'Failed to update rebalance plan' });
    }
  });

  /**
   * DELETE /api/rebalance/plans/:id
   * Delete a rebalance plan
   */
  router.delete('/plans/:id', authenticateUser, async (req: Request, res: Response) => {
    try {
      const id = getParam(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Plan ID is required' });
        return;
      }

      await rebalanceDAO.deletePlan(id);

      log.info('Deleted rebalance plan', { id });

      res.json({
        success: true,
        message: 'Rebalance plan deleted',
      });
    } catch (error) {
      log.error('Failed to delete rebalance plan', { error });
      res.status(500).json({ error: 'Failed to delete rebalance plan' });
    }
  });

  // ============================================
  // Rebalance Execution Routes
  // ============================================

  /**
   * POST /api/rebalance/preview
   * Preview rebalancing operations (dry run)
   */
  router.post('/preview', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { planId, positions, portfolioValue } = req.body;

      if (!planId) {
        res.status(400).json({ error: 'Plan ID is required' });
        return;
      }

      // Get the plan
      const plan = await rebalanceDAO.getPlan(planId);
      if (!plan) {
        res.status(404).json({ error: 'Rebalance plan not found' });
        return;
      }

      // Create price provider mock for now
      // In real implementation, this would fetch from market data
      const priceProvider = {
        getPrice: async (symbol: string) => {
          // Mock price - in production, fetch from market data service
          return 50000; // Default price
        },
        getPrices: async (symbols: string[]) => {
          const prices = new Map<string, number>();
          for (const symbol of symbols) {
            prices.set(symbol, 50000); // Default price
          }
          return prices;
        },
      };

      const engine = new RebalanceEngine(priceProvider);

      // Calculate position states
      const positionStates = await engine.calculatePositionStates(
        positions || [],
        plan.targetAllocation
      );

      // Calculate adjustments
      const adjustments = engine.calculateAdjustments(
        positionStates,
        portfolioValue || 100000
      );

      // Build preview
      const preview: RebalancePreview = {
        planId,
        portfolioValue: portfolioValue || 100000,
        positions: positionStates,
        adjustments,
        totalEstimatedCost: adjustments.reduce((sum, a) => sum + a.estimatedValue, 0),
        totalEstimatedFees: adjustments.reduce((sum, a) => sum + a.estimatedFee, 0),
        estimatedSlippage: adjustments.length * 0.001, // 0.1% per adjustment
        executionStrategy: 'optimized',
        warnings: [],
        timestamp: new Date(),
      };

      log.info('Generated rebalance preview', { planId, userId });

      res.json({
        success: true,
        data: preview,
      });
    } catch (error) {
      log.error('Failed to preview rebalance', { error });
      res.status(500).json({ error: 'Failed to preview rebalance' });
    }
  });

  /**
   * POST /api/rebalance/execute
   * Execute rebalancing operations
   */
  router.post('/execute', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { planId, trigger } = req.body;

      if (!planId) {
        res.status(400).json({ error: 'Plan ID is required' });
        return;
      }

      // Get the plan
      const plan = await rebalanceDAO.getPlan(planId);
      if (!plan) {
        res.status(404).json({ error: 'Rebalance plan not found' });
        return;
      }

      // Create execution record
      const execution = await rebalanceDAO.createExecution({
        planId,
        status: 'pending' as any,
        trigger: trigger || RebalanceTrigger.MANUAL,
        preview: null as any,
        orders: [],
        totalEstimatedCost: 0,
        totalActualCost: 0,
        totalFees: 0,
        startedAt: new Date(),
        metrics: {
          totalOrders: 0,
          successfulOrders: 0,
          failedOrders: 0,
          totalVolume: 0,
          averageExecutionPrice: 0,
          executionTimeMs: 0,
          slippageBps: 0,
        },
      });

      log.info('Created rebalance execution', { executionId: execution.id, planId, userId });

      // In production, this would trigger actual order execution
      // For now, return the execution record
      res.status(202).json({
        success: true,
        data: {
          executionId: execution.id,
          status: 'pending',
          message: 'Rebalance execution started',
        },
      });
    } catch (error) {
      log.error('Failed to execute rebalance', { error });
      res.status(500).json({ error: 'Failed to execute rebalance' });
    }
  });

  /**
   * GET /api/rebalance/history
   * Get rebalance execution history
   */
  router.get('/history', authenticateUser, async (req: Request, res: Response) => {
    try {
      const planId = getParam(req.query.planId as string);
      const limit = parseInt(getParam(req.query.limit as string) || '50', 10);

      if (!planId) {
        res.status(400).json({ error: 'Plan ID is required' });
        return;
      }

      const executions = await rebalanceDAO.getExecutions(planId, limit);

      res.json({
        success: true,
        data: executions,
      });
    } catch (error) {
      log.error('Failed to get rebalance history', { error });
      res.status(500).json({ error: 'Failed to get rebalance history' });
    }
  });

  /**
   * GET /api/rebalance/executions/:id
   * Get a specific execution
   */
  router.get('/executions/:id', authenticateUser, async (req: Request, res: Response) => {
    try {
      const id = getParam(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Execution ID is required' });
        return;
      }

      const execution = await rebalanceDAO.getExecution(id);

      if (!execution) {
        res.status(404).json({ error: 'Execution not found' });
        return;
      }

      res.json({
        success: true,
        data: execution,
      });
    } catch (error) {
      log.error('Failed to get execution', { error });
      res.status(500).json({ error: 'Failed to get execution' });
    }
  });

  // ============================================
  // Scheduler Routes
  // ============================================

  /**
   * POST /api/rebalance/schedule/:planId
   * Schedule a plan for automatic rebalancing
   */
  router.post('/schedule/:planId', authenticateUser, async (req: Request, res: Response) => {
    try {
      const planId = getParam(req.params.planId);
      if (!planId) {
        res.status(400).json({ error: 'Plan ID is required' });
        return;
      }

      // Get the plan
      const plan = await rebalanceDAO.getPlan(planId);
      if (!plan) {
        res.status(404).json({ error: 'Plan not found' });
        return;
      }

      if (plan.trigger !== RebalanceTrigger.SCHEDULED) {
        res.status(400).json({ error: 'Plan is not configured for scheduled rebalancing' });
        return;
      }

      // In production, this would interact with the scheduler service
      // For now, we just update the plan to be active
      await rebalanceDAO.updatePlan(planId, { isActive: true });

      log.info('Scheduled rebalance plan', { planId });

      res.json({
        success: true,
        message: 'Plan scheduled for automatic rebalancing',
        data: {
          planId,
          nextRunTime: plan.schedule ? calculateNextRunTime(plan.schedule) : null,
        },
      });
    } catch (error) {
      log.error('Failed to schedule plan', { error });
      res.status(500).json({ error: 'Failed to schedule plan' });
    }
  });

  /**
   * DELETE /api/rebalance/schedule/:planId
   * Unschedule a plan
   */
  router.delete('/schedule/:planId', authenticateUser, async (req: Request, res: Response) => {
    try {
      const planId = getParam(req.params.planId);
      if (!planId) {
        res.status(400).json({ error: 'Plan ID is required' });
        return;
      }

      // Update plan to be inactive
      await rebalanceDAO.updatePlan(planId, { isActive: false });

      log.info('Unscheduled rebalance plan', { planId });

      res.json({
        success: true,
        message: 'Plan unscheduled',
      });
    } catch (error) {
      log.error('Failed to unschedule plan', { error });
      res.status(500).json({ error: 'Failed to unschedule plan' });
    }
  });

  /**
   * GET /api/rebalance/scheduler/status
   * Get scheduler status
   */
  router.get('/scheduler/status', authenticateUser, async (_req: Request, res: Response) => {
    try {
      // In production, this would return actual scheduler status
      const activePlans = await rebalanceDAO.getPlans(true);
      const scheduledPlans = activePlans.filter(p => p.trigger === RebalanceTrigger.SCHEDULED);

      res.json({
        success: true,
        data: {
          isRunning: true,
          totalScheduledPlans: scheduledPlans.length,
          scheduledPlans: scheduledPlans.map(p => ({
            id: p.id,
            name: p.name,
            schedule: p.schedule,
            nextRunTime: p.schedule ? calculateNextRunTime(p.schedule) : null,
          })),
        },
      });
    } catch (error) {
      log.error('Failed to get scheduler status', { error });
      res.status(500).json({ error: 'Failed to get scheduler status' });
    }
  });

  // ============================================
  // Auto Rebalance Routes
  // ============================================

  /**
   * POST /api/rebalance/check
   * Check if rebalancing is needed for a plan
   */
  router.post('/check', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { planId } = req.body;

      if (!planId) {
        res.status(400).json({ error: 'Plan ID is required' });
        return;
      }

      // Get plan
      const plan = await rebalanceDAO.getPlan(planId);
      if (!plan) {
        res.status(404).json({ error: 'Plan not found' });
        return;
      }

      // Get user's account
      const { VirtualAccountDAO } = await import('../database/virtual-account.dao');
      const account = await VirtualAccountDAO.getAccountByUserId(userId);

      if (!account) {
        res.json({
          success: true,
          data: {
            needsRebalancing: false,
            positionStates: [],
            maxDeviation: 0,
            recommendation: 'No virtual account found. Please create a virtual account first.',
          },
        });
        return;
      }

      const positions = await VirtualAccountDAO.getPositions(account.id);

      // Create price provider
      const priceProvider = {
        getPrice: async (symbol: string) => {
          return 50000; // Mock price
        },
        getPrices: async (symbols: string[]) => {
          const prices = new Map<string, number>();
          for (const symbol of symbols) {
            prices.set(symbol, 50000);
          }
          return prices;
        },
      };

      const engine = new RebalanceEngine(priceProvider);

      // Calculate position states
      const portfolioPositions = positions.map(p => ({
        symbol: p.symbol,
        quantity: p.quantity,
        averageCost: p.average_cost,
      }));

      const positionStates = await engine.calculatePositionStates(
        portfolioPositions,
        plan.targetAllocation
      );

      // Calculate max deviation
      const maxDeviation = Math.max(
        ...positionStates.map(s => s.deviationPercent),
        0
      );

      // Check threshold
      const threshold = plan.threshold || 5;
      const needsRebalancing = maxDeviation > threshold;

      // Generate recommendation
      let recommendation = '';
      if (needsRebalancing) {
        const deviatingAssets = positionStates
          .filter(s => s.deviationPercent > threshold)
          .map(s => `${s.symbol} (${s.deviationPercent.toFixed(1)}% off target)`);
        
        recommendation = `Rebalancing recommended. Assets exceeding threshold: ${deviatingAssets.join(', ')}`;
      } else {
        recommendation = `Portfolio is within tolerance. Max deviation: ${maxDeviation.toFixed(1)}%`;
      }

      log.info('Checked rebalance need', { planId, userId, needsRebalancing, maxDeviation });

      res.json({
        success: true,
        data: {
          needsRebalancing,
          positionStates,
          maxDeviation,
          recommendation,
        },
      });
    } catch (error) {
      log.error('Failed to check rebalance', { error });
      res.status(500).json({ error: 'Failed to check rebalance' });
    }
  });

  /**
   * POST /api/rebalance/auto-execute
   * Execute rebalancing with all optimizations
   */
  router.post('/auto-execute', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { planId, dryRun = false } = req.body;

      if (!planId) {
        res.status(400).json({ error: 'Plan ID is required' });
        return;
      }

      // Get plan
      const plan = await rebalanceDAO.getPlan(planId);
      if (!plan) {
        res.status(404).json({ error: 'Plan not found' });
        return;
      }

      // Create execution record
      const execution = await rebalanceDAO.createExecution({
        planId,
        status: 'pending' as any,
        trigger: RebalanceTrigger.MANUAL,
        preview: null as any,
        orders: [],
        totalEstimatedCost: 0,
        totalActualCost: 0,
        totalFees: 0,
        startedAt: new Date(),
        metrics: {
          totalOrders: 0,
          successfulOrders: 0,
          failedOrders: 0,
          totalVolume: 0,
          averageExecutionPrice: 0,
          executionTimeMs: 0,
          slippageBps: 0,
        },
      });

      log.info('Started auto rebalance execution', { 
        executionId: execution.id, 
        planId, 
        userId,
        dryRun 
      });

      res.status(202).json({
        success: true,
        data: {
          executionId: execution.id,
          status: 'pending',
          message: dryRun 
            ? 'Dry run execution started (preview only)' 
            : 'Auto rebalance execution started',
        },
      });
    } catch (error) {
      log.error('Failed to start auto rebalance', { error });
      res.status(500).json({ error: 'Failed to start auto rebalance' });
    }
  });

  return router;
}

/**
 * Calculate next run time based on schedule config
 */
function calculateNextRunTime(schedule: { frequency: string; time: string; dayOfWeek?: number; dayOfMonth?: number }): Date {
  const now = new Date();
  const [hours, minutes] = schedule.time.split(':').map(Number);
  
  let nextRun = new Date();
  nextRun.setHours(hours, minutes, 0, 0);

  switch (schedule.frequency) {
    case 'daily':
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;

    case 'weekly':
      const targetDay = schedule.dayOfWeek ?? 1;
      const currentDay = now.getDay();
      let daysUntilTarget = targetDay - currentDay;
      
      if (daysUntilTarget < 0 || (daysUntilTarget === 0 && nextRun <= now)) {
        daysUntilTarget += 7;
      }
      
      nextRun.setDate(nextRun.getDate() + daysUntilTarget);
      break;

    case 'monthly':
      const targetDate = schedule.dayOfMonth ?? 1;
      nextRun.setDate(targetDate);
      
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
      break;
  }

  return nextRun;
}

export default createRebalanceRouter;
