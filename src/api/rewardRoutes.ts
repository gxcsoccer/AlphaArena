/**
 * Reward Management Routes
 * API endpoints for reward rules, fraud detection, and reward processing
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from './authMiddleware';
import { createLogger } from '../utils/logger';
import {
  getRewardRulesEngine,
  getAntiFraudService,
  getRewardService,
  getRewardNotificationService,
  CreateRewardRuleInput,
  FraudSeverity,
} from '../services/reward';

const log = createLogger('RewardRoutes');

const router = Router();

/**
 * Admin middleware - checks if user has admin role
 */
const adminMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;

  // Check if user has admin role
  // This can be customized based on your auth system
  const isAdmin = (user as any)?.role === 'admin' ||
                  (user as any)?.user_metadata?.role === 'admin' ||
                  process.env.ADMIN_EMAILS?.split(',').includes((user as any)?.email) ||
                  (user as any)?.email?.endsWith('@alphaarena.io');

  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
    });
  }

  next();
};

// ============================================
// Reward Rules Management
// ============================================

/**
 * GET /api/reward/rules
 * Get all active reward rules (admin only)
 */
router.get('/rules', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    const rulesEngine = getRewardRulesEngine();
    const rules = await rulesEngine.getActiveRules();

    res.json({
      success: true,
      data: rules.map(rule => ({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        triggerEvent: rule.triggerEvent,
        rewardType: rule.rewardType,
        rewardLevel: rule.rewardLevel,
        referrerReward: rule.referrerReward,
        inviteeReward: rule.inviteeReward,
        conditions: rule.conditions,
        isActive: rule.isActive,
        priority: rule.priority,
        validFrom: rule.validFrom,
        validUntil: rule.validUntil,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      })),
    });
  } catch (error) {
    log.error('Failed to get reward rules:', error);
    res.status(500).json({ success: false, error: 'Failed to get reward rules' });
  }
});

/**
 * POST /api/reward/rules
 * Create a new reward rule (admin only)
 */
router.post('/rules', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    const input: CreateRewardRuleInput = {
      name: req.body.name,
      description: req.body.description,
      triggerEvent: req.body.triggerEvent,
      rewardType: req.body.rewardType,
      rewardLevel: req.body.rewardLevel || 'level_1',
      referrerReward: req.body.referrerReward,
      inviteeReward: req.body.inviteeReward,
      conditions: req.body.conditions,
      priority: req.body.priority,
      validFrom: req.body.validFrom ? new Date(req.body.validFrom) : undefined,
      validUntil: req.body.validUntil ? new Date(req.body.validUntil) : undefined,
    };

    if (!input.name || !input.triggerEvent || !input.rewardType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, triggerEvent, rewardType',
      });
    }

    const rulesEngine = getRewardRulesEngine();
    const rule = await rulesEngine.createRule(input);

    res.status(201).json({
      success: true,
      data: rule,
    });
  } catch (error) {
    log.error('Failed to create reward rule:', error);
    res.status(500).json({ success: false, error: 'Failed to create reward rule' });
  }
});

/**
 * PUT /api/reward/rules/:ruleId
 * Update a reward rule (admin only)
 */
router.put('/rules/:ruleId', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const ruleId = String(req.params.ruleId);
    const rulesEngine = getRewardRulesEngine();
    const rule = await rulesEngine.updateRule(ruleId, req.body);

    res.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    log.error('Failed to update reward rule:', error);
    res.status(500).json({ success: false, error: 'Failed to update reward rule' });
  }
});

/**
 * DELETE /api/reward/rules/:ruleId
 * Delete a reward rule (admin only)
 */
router.delete('/rules/:ruleId', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const ruleId = String(req.params.ruleId);
    const rulesEngine = getRewardRulesEngine();
    await rulesEngine.deleteRule(ruleId);

    res.json({
      success: true,
      message: 'Reward rule deleted',
    });
  } catch (error) {
    log.error('Failed to delete reward rule:', error);
    res.status(500).json({ success: false, error: 'Failed to delete reward rule' });
  }
});

// ============================================
// Reward History & Stats
// ============================================

/**
 * GET /api/reward/history
 * Get reward history for the current user
 */
router.get('/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const status = req.query.status as 'pending' | 'processed' | 'cancelled' | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const rewardService = getRewardService();
    const { rewards, total } = await rewardService.getRewardHistory({
      userId: req.user.id,
      status,
      limit,
      offset,
    });

    res.json({
      success: true,
      data: {
        rewards,
        total,
      },
    });
  } catch (error) {
    log.error('Failed to get reward history:', error);
    res.status(500).json({ success: false, error: 'Failed to get reward history' });
  }
});

/**
 * GET /api/reward/stats
 * Get reward statistics for the current user
 */
router.get('/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const rewardService = getRewardService();
    const stats = await rewardService.getRewardStats(req.user.id);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    log.error('Failed to get reward stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get reward statistics' });
  }
});

// ============================================
// Fraud Detection (Admin)
// ============================================

/**
 * GET /api/reward/fraud/flags
 * Get pending fraud flags for review (admin only)
 */
router.get('/fraud/flags', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const severity = req.query.severity as FraudSeverity | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const antiFraudService = getAntiFraudService();
    const { flags, total } = await antiFraudService.getPendingFlags({
      severity,
      limit,
      offset,
    });

    res.json({
      success: true,
      data: {
        flags,
        total,
      },
    });
  } catch (error) {
    log.error('Failed to get fraud flags:', error);
    res.status(500).json({ success: false, error: 'Failed to get fraud flags' });
  }
});

/**
 * GET /api/reward/fraud/stats
 * Get fraud statistics (admin only)
 */
router.get('/fraud/stats', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const antiFraudService = getAntiFraudService();
    const stats = await antiFraudService.getFraudStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    log.error('Failed to get fraud stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get fraud statistics' });
  }
});

/**
 * POST /api/reward/fraud/flags/:flagId/resolve
 * Resolve a fraud flag (admin only)
 */
router.post('/fraud/flags/:flagId/resolve', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const flagId = String(req.params.flagId);
    const { resolutionNote } = req.body;

    if (!resolutionNote) {
      return res.status(400).json({
        success: false,
        error: 'Resolution note is required',
      });
    }

    const antiFraudService = getAntiFraudService();
    await antiFraudService.resolveFraudFlag(flagId, resolutionNote);

    res.json({
      success: true,
      message: 'Fraud flag resolved',
    });
  } catch (error) {
    log.error('Failed to resolve fraud flag:', error);
    res.status(500).json({ success: false, error: 'Failed to resolve fraud flag' });
  }
});

// ============================================
// Reward Processing (Cron/Admin)
// ============================================

/**
 * POST /api/reward/process-pending
 * Process pending rewards (cron job)
 */
router.post('/process-pending', async (req: Request, res: Response) => {
  try {
    // Simple auth check
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const rewardService = getRewardService();
    const result = await rewardService.processPendingRewards();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    log.error('Failed to process pending rewards:', error);
    res.status(500).json({ success: false, error: 'Failed to process pending rewards' });
  }
});

/**
 * POST /api/reward/retry-failed
 * Retry failed rewards (admin only)
 */
router.post('/retry-failed', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const rewardService = getRewardService();
    const result = await rewardService.retryFailedRewards();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    log.error('Failed to retry failed rewards:', error);
    res.status(500).json({ success: false, error: 'Failed to retry failed rewards' });
  }
});

/**
 * POST /api/reward/initialize-rules
 * Initialize default reward rules (admin only)
 */
router.post('/initialize-rules', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const rulesEngine = getRewardRulesEngine();
    await rulesEngine.initializeDefaultRules();

    res.json({
      success: true,
      message: 'Default rules initialized',
    });
  } catch (error) {
    log.error('Failed to initialize default rules:', error);
    res.status(500).json({ success: false, error: 'Failed to initialize default rules' });
  }
});

export default router;