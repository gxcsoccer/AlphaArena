/**
 * Signal Notification API Routes
 * RESTful endpoints for signal notification management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getSignalNotificationService } from '../notification/SignalNotificationService';
import { getNotificationHistoryDAO } from '../database/notification-history.dao';
import { getStrategyNotificationConfigDAO } from '../database/strategy-notification-config.dao';
import { getSignalPushConfigDAO } from '../database/signal-push-config.dao';
import getSupabaseClient from '../database/client';

const router = Router();

/**
 * Authentication middleware
 */
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

/**
 * GET /api/signal-notifications/history
 * Get notification history for signals
 */
router.get('/history', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { type, entity_id, start_date, end_date, limit, offset } = req.query;

    const service = getSignalNotificationService();
    const result = await service.getNotificationHistory(userId, {
      type: type as string,
      entityId: entity_id as string,
      startDate: start_date ? new Date(start_date as string) : undefined,
      endDate: end_date ? new Date(end_date as string) : undefined,
      limit: limit ? parseInt(String(limit), 10) : 50,
      offset: offset ? parseInt(String(offset), 10) : 0,
    });

    res.json({
      success: true,
      data: result.history,
      total: result.total,
    });
  } catch (err) {
    console.error('Error getting notification history:', err);
    res.status(500).json({ error: 'Failed to get notification history' });
  }
});

/**
 * GET /api/signal-notifications/comparison
 * Get signal comparison (signal predictions vs actual outcomes)
 */
router.get('/comparison', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { strategy_id, symbol, start_date, end_date, limit } = req.query;

    const service = getSignalNotificationService();
    const result = await service.getSignalComparison(userId, {
      strategyId: strategy_id as string,
      symbol: symbol as string,
      startDate: start_date ? new Date(start_date as string) : undefined,
      endDate: end_date ? new Date(end_date as string) : undefined,
      limit: limit ? parseInt(String(limit), 10) : 50,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('Error getting signal comparison:', err);
    res.status(500).json({ error: 'Failed to get signal comparison' });
  }
});

/**
 * GET /api/signal-notifications/stats
 * Get notification statistics
 */
router.get('/stats', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { period } = req.query;

    // Calculate period dates
    const now = new Date();
    let start: Date;

    switch (period) {
      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const historyDAO = getNotificationHistoryDAO();
    const stats = await historyDAO.getStats(userId, { start, end: now });

    res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    console.error('Error getting notification stats:', err);
    res.status(500).json({ error: 'Failed to get notification statistics' });
  }
});

/**
 * GET /api/signal-notifications/strategy-configs
 * Get all strategy notification configs for user
 */
router.get('/strategy-configs', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const service = getSignalNotificationService();
    const configs = await service.getStrategyConfigs(userId);

    res.json({
      success: true,
      data: configs,
    });
  } catch (err) {
    console.error('Error getting strategy configs:', err);
    res.status(500).json({ error: 'Failed to get strategy configurations' });
  }
});

/**
 * GET /api/signal-notifications/strategy-configs/:strategyId
 * Get notification config for a specific strategy
 */
router.get('/strategy-configs/:strategyId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const strategyId = Array.isArray(req.params.strategyId) ? req.params.strategyId[0] : req.params.strategyId;

    const configDAO = getStrategyNotificationConfigDAO();
    const config = await configDAO.getOrCreate(userId, strategyId);

    res.json({
      success: true,
      data: config,
    });
  } catch (err) {
    console.error('Error getting strategy config:', err);
    res.status(500).json({ error: 'Failed to get strategy configuration' });
  }
});

/**
 * PUT /api/signal-notifications/strategy-configs/:strategyId
 * Update notification config for a specific strategy
 */
router.put('/strategy-configs/:strategyId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const strategyId = Array.isArray(req.params.strategyId) ? req.params.strategyId[0] : req.params.strategyId;
    const updates = req.body;

    const service = getSignalNotificationService();
    const config = await service.updateStrategyConfig(userId, strategyId, updates);

    res.json({
      success: true,
      data: config,
    });
  } catch (err) {
    console.error('Error updating strategy config:', err);
    res.status(500).json({ error: 'Failed to update strategy configuration' });
  }
});

/**
 * GET /api/signal-notifications/push-config
 * Get user's global push notification config
 */
router.get('/push-config', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const pushConfigDAO = getSignalPushConfigDAO();
    const config = await pushConfigDAO.getOrCreate(userId);

    res.json({
      success: true,
      data: config,
    });
  } catch (err) {
    console.error('Error getting push config:', err);
    res.status(500).json({ error: 'Failed to get push configuration' });
  }
});

/**
 * PUT /api/signal-notifications/push-config
 * Update user's global push notification config
 */
router.put('/push-config', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const updates = req.body;

    const pushConfigDAO = getSignalPushConfigDAO();
    const config = await pushConfigDAO.update(userId, updates);

    res.json({
      success: true,
      data: config,
    });
  } catch (err) {
    console.error('Error updating push config:', err);
    res.status(500).json({ error: 'Failed to update push configuration' });
  }
});

/**
 * POST /api/signal-notifications/test
 * Send a test signal notification
 */
router.post('/test', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { symbol = 'BTC', side = 'buy', strategy_name = '测试策略' } = req.body;

    const service = getSignalNotificationService();
    const result = await service.sendSignalNotification({
      userId,
      signalId: `test-${Date.now()}`,
      strategyName: strategy_name,
      symbol,
      side,
      signalType: 'entry',
      entryPrice: 50000,
      targetPrice: 55000,
      stopLossPrice: 48000,
      confidenceScore: 0.85,
      riskLevel: 'medium',
      title: '测试信号通知',
      analysis: '这是一个测试通知，用于验证通知功能是否正常工作。',
    });

    res.json({
      success: result.success,
      data: result,
    });
  } catch (err) {
    console.error('Error sending test notification:', err);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

/**
 * POST /api/signal-notifications/:id/read
 * Mark a notification as read
 */
router.post('/:id/read', authenticateUser, async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const historyDAO = getNotificationHistoryDAO();
    const history = await historyDAO.markAsRead(id);

    if (!history) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    res.json({
      success: true,
      data: history,
    });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

/**
 * POST /api/signal-notifications/:id/click
 * Record a notification click
 */
router.post('/:id/click', authenticateUser, async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { action } = req.body;

    const historyDAO = getNotificationHistoryDAO();
    const history = await historyDAO.recordClick(id, action);

    if (!history) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    res.json({
      success: true,
      data: history,
    });
  } catch (err) {
    console.error('Error recording notification click:', err);
    res.status(500).json({ error: 'Failed to record click' });
  }
});

export default router;