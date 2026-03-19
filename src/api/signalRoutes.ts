/**
 * Signal Routes
 * API routes for trading signal push configuration and real-time subscriptions
 */

import { Router, Request, Response } from 'express';
import { authMiddleware, optionalAuthMiddleware } from './authMiddleware';
import { SignalPushConfigDAO, UpdatePushConfigInput } from '../database/signal-push-config.dao';
import { SignalSubscriptionsDAO, CreateSubscriptionInput, UpdateSubscriptionInput } from '../database/signal-subscriptions.dao';
import { TradingSignalsDAO } from '../database/trading-signals.dao';
import { getSignalRealtimeService } from '../signal/SignalRealtimeService';
import { createLogger } from '../utils/logger';

const log = createLogger('SignalRoutes');

const router = Router();
const pushConfigDAO = new SignalPushConfigDAO();
const subscriptionsDAO = new SignalSubscriptionsDAO();
const signalsDAO = new TradingSignalsDAO();

// Helper function to get string query param
function getQueryParam(value: any): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

// Helper function to get number query param
function getNumberQueryParam(value: any, defaultValue: number): number {
  const str = getQueryParam(value);
  if (!str) return defaultValue;
  const num = parseInt(str, 10);
  return isNaN(num) ? defaultValue : num;
}

// Helper function to get route param (always string in Express)
function getParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * GET /api/signals/push-config
 * Get current user's push configuration
 */
router.get('/push-config', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const config = await pushConfigDAO.getOrCreate(userId);
    res.json({ success: true, data: config });
  } catch (error: any) {
    log.error('Failed to get push config:', error);
    res.status(500).json({ error: 'Failed to get push configuration' });
  }
});

/**
 * PUT /api/signals/push-config
 * Update user's push configuration
 */
router.put('/push-config', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const update: UpdatePushConfigInput = req.body;
    const config = await pushConfigDAO.update(userId, update);
    
    log.info(`Updated push config for user ${userId}`);
    res.json({ success: true, data: config });
  } catch (error: any) {
    log.error('Failed to update push config:', error);
    res.status(500).json({ error: 'Failed to update push configuration' });
  }
});

/**
 * GET /api/signals/health
 * Get signal push service health status
 */
router.get('/health', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    // Get connection quality from realtime client if available
    const _realtimeService = getSignalRealtimeService();
    
    // Basic health check response
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'signal-push',
      version: '1.0.0',
      stats: {
        totalPushes: 0,
        successfulPushes: 0,
        failedPushes: 0,
        lastPushAt: null as string | null,
      },
      connection: {
        status: 'unknown',
        latency: 0,
        reconnectAttempts: 0,
      },
    };
    
    // If user is authenticated, include user-specific stats
    if (userId) {
      // Get user's push config
      const config = await pushConfigDAO.getOrCreate(userId);
      
      // Add user-specific information
      health.stats = {
        totalPushes: config.totalPushes || 0,
        successfulPushes: config.successfulPushes || 0,
        failedPushes: config.failedPushes || 0,
        lastPushAt: config.lastPushAt ? config.lastPushAt.toISOString() : null,
      };
    }
    
    res.json({ success: true, data: health });
  } catch (error: any) {
    log.error('Failed to get health status:', error);
    res.status(500).json({ error: 'Failed to get health status' });
  }
});

/**
 * POST /api/signals/push-config/reset
 * Reset push config to defaults
 */
router.post('/push-config/reset', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await pushConfigDAO.delete(userId);
    const config = await pushConfigDAO.create({ userId });
    
    log.info(`Reset push config for user ${userId}`);
    res.json({ success: true, data: config });
  } catch (error: any) {
    log.error('Failed to reset push config:', error);
    res.status(500).json({ error: 'Failed to reset push configuration' });
  }
});

/**
 * GET /api/signals/subscriptions
 * Get user's signal subscriptions
 */
router.get('/subscriptions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const status = getQueryParam(req.query.status);
    const subscriptions = await subscriptionsDAO.getSubscriptionsForSubscriber(
      userId,
      status as any
    );

    res.json({ success: true, data: subscriptions });
  } catch (error: any) {
    log.error('Failed to get subscriptions:', error);
    res.status(500).json({ error: 'Failed to get subscriptions' });
  }
});

/**
 * POST /api/signals/subscriptions
 * Subscribe to a signal source
 */
router.post('/subscriptions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { sourceType, sourceId, ...settings } = req.body;

    if (!sourceType || !sourceId) {
      return res.status(400).json({ error: 'sourceType and sourceId are required' });
    }

    const input: CreateSubscriptionInput = {
      subscriberId: userId,
      sourceType,
      sourceId,
      ...settings,
    };

    const subscription = await subscriptionsDAO.create(input);
    
    log.info(`User ${userId} subscribed to ${sourceType}:${sourceId}`);
    res.status(201).json({ success: true, data: subscription });
  } catch (error: any) {
    log.error('Failed to create subscription:', error);
    res.status(500).json({ error: error.message || 'Failed to create subscription' });
  }
});

/**
 * PUT /api/signals/subscriptions/:id
 * Update subscription settings
 */
router.put('/subscriptions/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = getParam(req.params.id);
    const subscription = await subscriptionsDAO.getById(id);

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    if (subscription.subscriberId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const update: UpdateSubscriptionInput = req.body;
    const updated = await subscriptionsDAO.update(id, update);
    
    log.info(`Updated subscription ${id}`);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    log.error('Failed to update subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

/**
 * DELETE /api/signals/subscriptions/:id
 * Unsubscribe from a signal source
 */
router.delete('/subscriptions/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = getParam(req.params.id);
    const subscription = await subscriptionsDAO.getById(id);

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    if (subscription.subscriberId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await subscriptionsDAO.cancel(id);
    
    log.info(`Unsubscribed from ${id}`);
    res.json({ success: true });
  } catch (error: any) {
    log.error('Failed to unsubscribe:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

/**
 * GET /api/signals/feed
 * Get signal feed (signals from subscribed sources)
 */
router.get('/feed', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limit = getNumberQueryParam(req.query.limit, 20);
    const offset = getNumberQueryParam(req.query.offset, 0);
    const symbolsStr = getQueryParam(req.query.symbols);
    const symbols = symbolsStr ? symbolsStr.split(',') : undefined;

    // Get user's subscriptions
    const subscriptions = await subscriptionsDAO.getSubscriptionsForSubscriber(userId, 'active');

    if (subscriptions.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Get signals from subscribed sources
    const allSignals = [];
    for (const sub of subscriptions) {
      const signals = await signalsDAO.getMany({
        publisherId: sub.sourceType === 'user' ? sub.sourceId : undefined,
        strategyId: sub.sourceType === 'strategy' ? sub.sourceId : undefined,
        status: 'active',
        limit: 50,
      });
      allSignals.push(...signals);
    }

    // Filter by symbols if specified
    let filteredSignals = allSignals;
    if (symbols && symbols.length > 0) {
      filteredSignals = allSignals.filter(s => symbols.includes(s.symbol));
    }

    // Sort by created_at descending
    filteredSignals.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const paginatedSignals = filteredSignals.slice(offset, offset + limit);

    res.json({ 
      success: true, 
      data: paginatedSignals,
      meta: {
        total: filteredSignals.length,
        limit,
        offset,
      }
    });
  } catch (error: any) {
    log.error('Failed to get signal feed:', error);
    res.status(500).json({ error: 'Failed to get signal feed' });
  }
});

/**
 * GET /api/signals
 * Get all active signals (public signal marketplace)
 */
router.get('/', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const symbol = getQueryParam(req.query.symbol);
    const riskLevel = getQueryParam(req.query.riskLevel);
    const limit = getNumberQueryParam(req.query.limit, 50);
    const offset = getNumberQueryParam(req.query.offset, 0);
    const orderBy = getQueryParam(req.query.orderBy) || 'created_at';

    const signals = await signalsDAO.getMany({
      status: 'active',
      symbol,
      riskLevel: riskLevel as any,
      limit,
      offset,
      orderBy: orderBy as any,
    });

    res.json({ success: true, data: signals });
  } catch (error: any) {
    log.error('Failed to get signals:', error);
    res.status(500).json({ error: 'Failed to get signals' });
  }
});

/**
 * GET /api/signals/publisher/:publisherId
 * Get signals from a specific publisher
 * NOTE: This must be defined BEFORE /:id to avoid route conflicts in Express
 */
router.get('/publisher/:publisherId', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const publisherId = getParam(req.params.publisherId);
    const status = getQueryParam(req.query.status);
    const limit = getNumberQueryParam(req.query.limit, 50);
    const offset = getNumberQueryParam(req.query.offset, 0);

    const signals = await signalsDAO.getMany({
      publisherId,
      status: status as any,
      limit,
      offset,
    });

    res.json({ success: true, data: signals });
  } catch (error: any) {
    log.error('Failed to get publisher signals:', error);
    res.status(500).json({ error: 'Failed to get publisher signals' });
  }
});

/**
 * GET /api/signals/history
 * Get user's signal history (published signals)
 * NOTE: This must be defined BEFORE /:id to avoid route conflicts in Express
 */
router.get('/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limit = getNumberQueryParam(req.query.limit, 50);
    const offset = getNumberQueryParam(req.query.offset, 0);

    const signals = await signalsDAO.getMany({
      publisherId: userId,
      limit,
      offset,
    });

    res.json({ success: true, data: signals });
  } catch (error: any) {
    log.error('Failed to get signal history:', error);
    res.status(500).json({ error: 'Failed to get signal history' });
  }
});

/**
 * GET /api/signals/:id
 * Get a specific signal by ID
 */
router.get('/:id', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    const signal = await signalsDAO.getById(id);

    if (!signal) {
      return res.status(404).json({ error: 'Signal not found' });
    }

    // Increment view count
    await signalsDAO.incrementViews(id);

    res.json({ success: true, data: signal });
  } catch (error: any) {
    log.error('Failed to get signal:', error);
    res.status(500).json({ error: 'Failed to get signal' });
  }
});

/**
 * POST /api/signals
 * Publish a new signal
 */
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
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
      strategyId,
    } = req.body;

    if (!symbol || !side) {
      return res.status(400).json({ error: 'symbol and side are required' });
    }

    // Create the signal
    const signal = await signalsDAO.create({
      publisherId: userId,
      strategyId,
      symbol,
      side,
      signalType: signalType || 'entry',
      entryPrice,
      entryPriceRangeLow,
      entryPriceRangeHigh,
      targetPrice,
      stopLossPrice,
      quantity,
      title,
      description,
      analysis,
      riskLevel: riskLevel || 'medium',
      confidenceScore,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    // Get subscriber IDs for this publisher
    const subscriptions = await subscriptionsDAO.getActiveSubscriptionsForSource('user', userId);
    const subscriberIds = subscriptions.map(s => s.subscriberId);

    // Broadcast to subscribers via realtime
    const realtimeService = getSignalRealtimeService();
    await realtimeService.broadcastNewSignal(signal, subscriberIds);

    // Also broadcast to global channel
    await realtimeService.broadcastToGlobal(signal);

    log.info(`Published signal ${signal.id} for ${symbol} by user ${userId}`);
    res.status(201).json({ success: true, data: signal });
  } catch (error: any) {
    log.error('Failed to create signal:', error);
    res.status(500).json({ error: 'Failed to create signal' });
  }
});

/**
 * PUT /api/signals/:id
 * Update a signal
 */
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = getParam(req.params.id);
    const signal = await signalsDAO.getById(id);

    if (!signal) {
      return res.status(404).json({ error: 'Signal not found' });
    }

    if (signal.publisherId !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this signal' });
    }

    const updateData = req.body;
    const updated = await signalsDAO.update(id, updateData);

    log.info(`Updated signal ${id}`);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    log.error('Failed to update signal:', error);
    res.status(500).json({ error: 'Failed to update signal' });
  }
});

/**
 * POST /api/signals/:id/cancel
 * Cancel a signal
 */
router.post('/:id/cancel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = getParam(req.params.id);
    const signal = await signalsDAO.getById(id);

    if (!signal) {
      return res.status(404).json({ error: 'Signal not found' });
    }

    if (signal.publisherId !== userId) {
      return res.status(403).json({ error: 'Not authorized to cancel this signal' });
    }

    if (signal.status !== 'active') {
      return res.status(400).json({ error: 'Signal is not active' });
    }

    const updated = await signalsDAO.update(id, {
      status: 'cancelled',
      cancelledAt: new Date(),
    });

    // Broadcast close event
    const realtimeService = getSignalRealtimeService();
    await realtimeService.broadcastSignalClose(updated, 'cancelled');

    log.info(`Cancelled signal ${id}`);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    log.error('Failed to cancel signal:', error);
    res.status(500).json({ error: 'Failed to cancel signal' });
  }
});

export function createSignalRouter(): Router {
  return router;
}

export default router;