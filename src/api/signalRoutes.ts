/**
 * Signal API Routes
 * RESTful endpoints for trading signal subscription service
 */

import { Router, Request, Response } from 'express';
import { getTradingSignalService } from '../signal/TradingSignalService';
import { getSignalSubscriptionService } from '../signal/SignalSubscriptionService';
import getSupabaseClient from '../database/client';
import { createLogger } from '../utils/logger';

const log = createLogger('SignalRoutes');

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

export function createSignalRouter(): Router {
  const router = Router();
  const signalService = getTradingSignalService();
  const subscriptionService = getSignalSubscriptionService();

  // ============================================
  // Signal Routes
  // ============================================

  /**
   * POST /api/signals
   * Publish a new trading signal
   */
  router.post('/', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const {
        strategyId,
        symbol,
        side,
        signalType,
        entryPrice,
        entryPriceRangeLow,
        entryPriceRangeHigh,
        targetPrice,
        stopLossPrice,
        quantity,
        title,
        description,
        analysis,
        riskLevel,
        confidenceScore,
        expiresAt,
      } = req.body;

      if (!symbol || !side) {
        return res.status(400).json({
          success: false,
          error: 'symbol and side are required',
        });
      }

      const signal = await signalService.publishSignal({
        publisherId: userId,
        strategyId,
        symbol,
        side,
        signalType,
        entryPrice,
        entryPriceRangeLow,
        entryPriceRangeHigh,
        targetPrice,
        stopLossPrice,
        quantity,
        title,
        description,
        analysis,
        riskLevel,
        confidenceScore,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });

      res.json({
        success: true,
        data: signal,
      });
    } catch (error: any) {
      log.error('Error publishing signal:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/signals
   * Get active signals (signal marketplace)
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { symbol, riskLevel, limit, offset, orderBy } = req.query;

      const signals = await signalService.getActiveSignals({
        symbol: getParam(symbol as string),
        riskLevel: getParam(riskLevel as string) as any,
        limit: limit ? parseInt(String(limit), 10) : 50,
        offset: offset ? parseInt(String(offset), 10) : undefined,
        orderBy: getParam(orderBy as string) as any,
      });

      res.json({
        success: true,
        data: signals,
      });
    } catch (error: any) {
      log.error('Error getting signals:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/signals/feed
   * Get personalized signal feed for authenticated user
   */
  router.get('/feed', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { symbols, limit, offset } = req.query;

      const signals = await signalService.getSignalFeed({
        userId,
        symbols: symbols ? String(symbols).split(',') : undefined,
        limit: limit ? parseInt(String(limit), 10) : 20,
        offset: offset ? parseInt(String(offset), 10) : undefined,
      });

      res.json({
        success: true,
        data: signals,
      });
    } catch (error: any) {
      log.error('Error getting signal feed:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/signals/:id
   * Get a specific signal
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const signalId = getParam(req.params.id) || '';

      const signal = await signalService.getSignal(signalId);

      if (!signal) {
        return res.status(404).json({
          success: false,
          error: 'Signal not found',
        });
      }

      res.json({
        success: true,
        data: signal,
      });
    } catch (error: any) {
      log.error('Error getting signal:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /api/signals/:id
   * Cancel a signal
   */
  router.delete('/:id', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const signalId = getParam(req.params.id) || '';

      const signal = await signalService.cancelSignal(signalId, userId);

      res.json({
        success: true,
        data: signal,
      });
    } catch (error: any) {
      log.error('Error cancelling signal:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/signals/publisher/:publisherId
   * Get signals by publisher
   */
  router.get('/publisher/:publisherId', async (req: Request, res: Response) => {
    try {
      const publisherId = getParam(req.params.publisherId) || '';
      const { status, limit, offset } = req.query;

      const signals = await signalService.getPublisherSignals(publisherId, {
        status: getParam(status as string) as any,
        limit: limit ? parseInt(String(limit), 10) : 50,
        offset: offset ? parseInt(String(offset), 10) : undefined,
      });

      res.json({
        success: true,
        data: signals,
      });
    } catch (error: any) {
      log.error('Error getting publisher signals:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/signals/publisher/:publisherId/stats
   * Get publisher statistics
   */
  router.get('/publisher/:publisherId/stats', async (req: Request, res: Response) => {
    try {
      const publisherId = getParam(req.params.publisherId) || '';

      const stats = await signalService.getPublisherStats(publisherId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      log.error('Error getting publisher stats:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============================================
  // Subscription Routes
  // ============================================

  /**
   * POST /api/signals/subscriptions
   * Subscribe to a signal source
   */
  router.post('/subscriptions', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const {
        sourceType,
        sourceId,
        autoExecute,
        copyRatio,
        fixedAmount,
        maxAmount,
        maxRiskPerTrade,
        allowedSymbols,
        blockedSymbols,
        notifyInApp,
        notifyPush,
        notifyEmail,
      } = req.body;

      if (!sourceType || !sourceId) {
        return res.status(400).json({
          success: false,
          error: 'sourceType and sourceId are required',
        });
      }

      const subscription = await subscriptionService.subscribe({
        subscriberId: userId,
        sourceType,
        sourceId,
        autoExecute,
        copyRatio,
        fixedAmount,
        maxAmount,
        maxRiskPerTrade,
        allowedSymbols,
        blockedSymbols,
        notifyInApp,
        notifyPush,
        notifyEmail,
      });

      res.json({
        success: true,
        data: subscription,
      });
    } catch (error: any) {
      log.error('Error creating subscription:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/signals/subscriptions
   * Get user's subscriptions
   */
  router.get('/subscriptions', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { status } = req.query;

      const subscriptions = await subscriptionService.getUserSubscriptions(
        userId,
        getParam(status as string) as any
      );

      res.json({
        success: true,
        data: subscriptions,
      });
    } catch (error: any) {
      log.error('Error getting subscriptions:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/signals/subscriptions/:id
   * Get a specific subscription
   */
  router.get('/subscriptions/:id', authenticateUser, async (req: Request, res: Response) => {
    try {
      const subscriptionId = getParam(req.params.id) || '';

      const subscription = await subscriptionService.getSubscription(subscriptionId);

      if (!subscription) {
        return res.status(404).json({
          success: false,
          error: 'Subscription not found',
        });
      }

      res.json({
        success: true,
        data: subscription,
      });
    } catch (error: any) {
      log.error('Error getting subscription:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * PATCH /api/signals/subscriptions/:id
   * Update subscription settings
   */
  router.patch('/subscriptions/:id', authenticateUser, async (req: Request, res: Response) => {
    try {
      const subscriptionId = getParam(req.params.id) || '';

      const subscription = await subscriptionService.updateSubscription(
        subscriptionId,
        req.body
      );

      res.json({
        success: true,
        data: subscription,
      });
    } catch (error: any) {
      log.error('Error updating subscription:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /api/signals/subscriptions/:id
   * Unsubscribe from a signal source
   */
  router.delete('/subscriptions/:id', authenticateUser, async (req: Request, res: Response) => {
    try {
      const subscriptionId = getParam(req.params.id) || '';

      await subscriptionService.unsubscribe(subscriptionId);

      res.json({
        success: true,
      });
    } catch (error: any) {
      log.error('Error unsubscribing:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/signals/subscriptions/:id/pause
   * Pause a subscription
   */
  router.post('/subscriptions/:id/pause', authenticateUser, async (req: Request, res: Response) => {
    try {
      const subscriptionId = getParam(req.params.id) || '';

      const subscription = await subscriptionService.pauseSubscription(subscriptionId);

      res.json({
        success: true,
        data: subscription,
      });
    } catch (error: any) {
      log.error('Error pausing subscription:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/signals/subscriptions/:id/resume
   * Resume a subscription
   */
  router.post('/subscriptions/:id/resume', authenticateUser, async (req: Request, res: Response) => {
    try {
      const subscriptionId = getParam(req.params.id) || '';

      const subscription = await subscriptionService.resumeSubscription(subscriptionId);

      res.json({
        success: true,
        data: subscription,
      });
    } catch (error: any) {
      log.error('Error resuming subscription:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/signals/subscriptions/stats
   * Get user's subscription statistics
   */
  router.get('/subscriptions/stats', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;

      const stats = await subscriptionService.getSubscriptionStats(userId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      log.error('Error getting subscription stats:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============================================
  // Execution Routes
  // ============================================

  /**
   * POST /api/signals/:id/execute
   * Execute a signal
   */
  router.post('/:id/execute', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const signalId = getParam(req.params.id) || '';
      const { executionType, quantity, price } = req.body;

      if (!quantity || !price) {
        return res.status(400).json({
          success: false,
          error: 'quantity and price are required',
        });
      }

      const execution = await subscriptionService.executeSignal({
        signalId,
        userId,
        executionType: executionType || 'manual',
        quantity,
        price,
      });

      res.json({
        success: true,
        data: execution,
      });
    } catch (error: any) {
      log.error('Error executing signal:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/signals/:id/executions
   * Get executions for a signal
   */
  router.get('/:id/executions', async (req: Request, res: Response) => {
    try {
      const signalId = getParam(req.params.id) || '';

      const executions = await subscriptionService.getSignalExecutions(signalId);

      res.json({
        success: true,
        data: executions,
      });
    } catch (error: any) {
      log.error('Error getting signal executions:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/signals/executions
   * Get user's execution history
   */
  router.get('/executions', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { limit } = req.query;

      const executions = await subscriptionService.getUserExecutions(
        userId,
        limit ? parseInt(String(limit), 10) : 50
      );

      res.json({
        success: true,
        data: executions,
      });
    } catch (error: any) {
      log.error('Error getting user executions:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/signals/executions/stats
   * Get user's execution statistics
   */
  router.get('/executions/stats', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;

      const stats = await subscriptionService.getExecutionStats(userId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      log.error('Error getting execution stats:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

export default createSignalRouter;
