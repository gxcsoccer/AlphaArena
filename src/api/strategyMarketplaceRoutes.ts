/**
 * Strategy Marketplace API Routes
 */

import { Router, Request, Response } from 'express';
import { getStrategyMarketplaceService } from '../strategy-marketplace';
import { createLogger } from '../utils/logger';

const log = createLogger('StrategyMarketplaceRoutes');

// Helper to get single string from query param
function getQueryParam(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }
  return typeof value === 'string' ? value : undefined;
}

// Helper to get route param as string
function getParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

// Helper to safely parse integer from query param
function parseIntParam(value: unknown, defaultValue?: number): number | undefined {
  const str = getQueryParam(value);
  if (str === undefined) return defaultValue;
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// Helper to safely parse float from query param
function parseFloatParam(value: unknown, defaultValue?: number): number | undefined {
  const str = getQueryParam(value);
  if (str === undefined) return defaultValue;
  const parsed = parseFloat(str);
  return isNaN(parsed) ? defaultValue : parsed;
}

// Helper to get user ID from request (in real app, from auth middleware)
function getUserId(req: Request): string {
  // For now, use header or query param
  // In production, this would come from auth middleware
  const headerUserId = req.headers['x-user-id'];
  const queryUserId = req.query.userId;
  
  if (typeof headerUserId === 'string') return headerUserId;
  if (typeof queryUserId === 'string') return queryUserId;
  if (Array.isArray(queryUserId) && typeof queryUserId[0] === 'string') return queryUserId[0];
  
  return 'anonymous';
}

export function createStrategyMarketplaceRouter(): Router {
  const router = Router();
  const service = getStrategyMarketplaceService();

  // ==================== Strategy Routes ====================

  /**
   * @openapi
   * /marketplace/strategies:
   *   get:
   *     summary: List strategies in the marketplace
   *     tags: [Marketplace]
   *     parameters:
   *       - name: category
   *         in: query
   *         schema:
   *           type: string
   *       - name: strategyType
   *         in: query
   *         schema:
   *           type: string
   *       - name: search
   *         in: query
   *         schema:
   *           type: string
   *       - name: minRating
   *         in: query
   *         schema:
   *           type: number
   *       - name: isFeatured
   *         in: query
   *         schema:
   *           type: boolean
   *       - name: limit
   *         in: query
   *         schema:
   *           type: integer
   *           default: 20
   *       - name: offset
   *         in: query
   *         schema:
   *           type: integer
   *       - name: orderBy
   *         in: query
   *         schema:
   *           type: string
   *           enum: [created_at, rating_avg, subscriber_count, view_count, name]
   *       - name: orderDirection
   *         in: query
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *     responses:
   *       200:
   *         description: List of strategies
   */
  router.get('/strategies', async (req: Request, res: Response) => {
    try {
      const category = getQueryParam(req.query.category);
      const strategyType = getQueryParam(req.query.strategyType);
      const search = getQueryParam(req.query.search);
      const minRatingStr = getQueryParam(req.query.minRating);
      const isFeaturedStr = getQueryParam(req.query.isFeatured);
      const limitStr = getQueryParam(req.query.limit);
      const offsetStr = getQueryParam(req.query.offset);
      const orderBy = getQueryParam(req.query.orderBy);
      const orderDirection = getQueryParam(req.query.orderDirection);
      const tagsStr = getQueryParam(req.query.tags);

      const strategies = await service.listStrategies({
        status: 'approved',
        visibility: 'public',
        category,
        strategyType,
        search,
        minRating: parseFloatParam(minRatingStr),
        isFeatured: isFeaturedStr === 'true' ? true : isFeaturedStr === 'false' ? false : undefined,
        tags: tagsStr ? tagsStr.split(',') : undefined,
        limit: parseIntParam(limitStr, 20),
        offset: parseIntParam(offsetStr),
        orderBy: orderBy as any,
        orderDirection: orderDirection as any,
      });

      res.json({
        success: true,
        data: strategies,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /strategies:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /marketplace/strategies/featured:
   *   get:
   *     summary: Get featured strategies
   *     tags: [Marketplace]
   */
  router.get('/strategies/featured', async (req: Request, res: Response) => {
    try {
      const limitStr = getQueryParam(req.query.limit);
      const strategies = await service.getFeaturedStrategies(parseIntParam(limitStr, 10));

      res.json({
        success: true,
        data: strategies,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /strategies/featured:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /marketplace/strategies/top-rated:
   *   get:
   *     summary: Get top rated strategies
   *     tags: [Marketplace]
   */
  router.get('/strategies/top-rated', async (req: Request, res: Response) => {
    try {
      const limitStr = getQueryParam(req.query.limit);
      const strategies = await service.getTopRatedStrategies(parseIntParam(limitStr, 10));

      res.json({
        success: true,
        data: strategies,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /strategies/top-rated:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /marketplace/strategies/categories:
   *   get:
   *     summary: Get available categories
   *     tags: [Marketplace]
   */
  router.get('/strategies/categories', async (req: Request, res: Response) => {
    try {
      const categories = await service.getCategories();

      res.json({
        success: true,
        data: categories,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /strategies/categories:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /marketplace/strategies/tags:
   *   get:
   *     summary: Get popular tags
   *     tags: [Marketplace]
   */
  router.get('/strategies/tags', async (req: Request, res: Response) => {
    try {
      const tags = await service.getTags();

      res.json({
        success: true,
        data: tags,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /strategies/tags:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /marketplace/strategies/{id}:
   *   get:
   *     summary: Get strategy by ID
   *     tags: [Marketplace]
   */
  router.get('/strategies/:id', async (req: Request, res: Response) => {
    try {
      const strategyId = getParam(req.params.id) || '';
      const strategy = await service.getStrategyWithViews(strategyId);

      if (!strategy) {
        return res.status(404).json({
          success: false,
          error: 'Strategy not found',
        });
      }

      res.json({
        success: true,
        data: strategy,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /strategies/:id:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /marketplace/strategies:
   *   post:
   *     summary: Create a new strategy
   *     tags: [Marketplace]
   */
  router.post('/strategies', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const input = {
        ...req.body,
        publisherId: req.body.publisherId || userId,
      };

      const strategy = await service.createStrategy(input);

      res.json({
        success: true,
        data: strategy,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in POST /strategies:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /marketplace/strategies/{id}:
   *   put:
   *     summary: Update a strategy
   *     tags: [Marketplace]
   */
  router.put('/strategies/:id', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const strategyId = getParam(req.params.id) || '';

      const strategy = await service.updateStrategy(strategyId, userId, req.body);

      res.json({
        success: true,
        data: strategy,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in PUT /strategies/:id:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /marketplace/strategies/{id}/publish:
   *   post:
   *     summary: Publish a strategy to the marketplace
   *     tags: [Marketplace]
   */
  router.post('/strategies/:id/publish', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const strategyId = getParam(req.params.id) || '';

      const strategy = await service.publishStrategy(strategyId, userId);

      res.json({
        success: true,
        data: strategy,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in POST /strategies/:id/publish:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /marketplace/strategies/{id}:
   *   delete:
   *     summary: Delete a strategy
   *     tags: [Marketplace]
   */
  router.delete('/strategies/:id', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const strategyId = getParam(req.params.id) || '';

      await service.deleteStrategy(strategyId, userId);

      res.json({
        success: true,
        message: 'Strategy deleted',
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in DELETE /strategies/:id:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==================== Subscription Routes ====================

  /**
   * @openapi
   * /marketplace/subscriptions:
   *   post:
   *     summary: Subscribe to a strategy
   *     tags: [Marketplace]
   */
  router.post('/subscriptions', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const input = {
        ...req.body,
        subscriberId: req.body.subscriberId || userId,
      };

      const result = await service.subscribe(input);

      res.json({
        success: true,
        data: result,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in POST /subscriptions:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /marketplace/subscriptions:
   *   get:
   *     summary: Get user's subscriptions
   *     tags: [Marketplace]
   */
  router.get('/subscriptions', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const status = getQueryParam(req.query.status);

      const subscriptions = await service.getUserSubscriptions(userId, status);

      res.json({
        success: true,
        data: subscriptions,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /subscriptions:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /marketplace/subscriptions/{id}:
   *   get:
   *     summary: Get subscription by ID
   *     tags: [Marketplace]
   */
  router.get('/subscriptions/:id', async (req: Request, res: Response) => {
    try {
      const subscriptionId = getParam(req.params.id) || '';
      const { getStrategySubscriptionsDAO } = await import('../database/strategy-marketplace.dao');
      const dao = getStrategySubscriptionsDAO();
      const subscription = await dao.getById(subscriptionId);

      if (!subscription) {
        return res.status(404).json({
          success: false,
          error: 'Subscription not found',
        });
      }

      res.json({
        success: true,
        data: subscription,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /subscriptions/:id:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /marketplace/subscriptions/{id}/pause:
   *   post:
   *     summary: Pause a subscription
   *     tags: [Marketplace]
   */
  router.post('/subscriptions/:id/pause', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const subscriptionId = getParam(req.params.id) || '';

      const subscription = await service.pauseSubscription(subscriptionId, userId);

      res.json({
        success: true,
        data: subscription,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in POST /subscriptions/:id/pause:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /marketplace/subscriptions/{id}/resume:
   *   post:
   *     summary: Resume a subscription
   *     tags: [Marketplace]
   */
  router.post('/subscriptions/:id/resume', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const subscriptionId = getParam(req.params.id) || '';

      const subscription = await service.resumeSubscription(subscriptionId, userId);

      res.json({
        success: true,
        data: subscription,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in POST /subscriptions/:id/resume:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /marketplace/subscriptions/{id}:
   *   delete:
   *     summary: Cancel a subscription
   *     tags: [Marketplace]
   */
  router.delete('/subscriptions/:id', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const subscriptionId = getParam(req.params.id) || '';

      await service.unsubscribe(subscriptionId, userId);

      res.json({
        success: true,
        message: 'Subscription cancelled',
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in DELETE /subscriptions/:id:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==================== Review Routes ====================

  /**
   * @openapi
   * /marketplace/strategies/{strategyId}/reviews:
   *   get:
   *     summary: Get reviews for a strategy
   *     tags: [Marketplace]
   */
  router.get('/strategies/:strategyId/reviews', async (req: Request, res: Response) => {
    try {
      const strategyId = getParam(req.params.strategyId) || '';
      const limitStr = getQueryParam(req.query.limit);

      const reviews = await service.getStrategyReviews(strategyId, parseIntParam(limitStr, 10));

      res.json({
        success: true,
        data: reviews,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /strategies/:strategyId/reviews:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /marketplace/strategies/{strategyId}/reviews:
   *   post:
   *     summary: Create a review for a strategy
   *     tags: [Marketplace]
   */
  router.post('/strategies/:strategyId/reviews', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const strategyId = getParam(req.params.strategyId) || '';

      const review = await service.createReview({
        ...req.body,
        strategyId,
        userId,
      });

      res.json({
        success: true,
        data: review,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in POST /strategies/:strategyId/reviews:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /marketplace/reviews/{reviewId}:
   *   put:
   *     summary: Update a review
   *     tags: [Marketplace]
   */
  router.put('/reviews/:reviewId', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const reviewId = getParam(req.params.reviewId) || '';

      const review = await service.updateReview(reviewId, userId, req.body);

      res.json({
        success: true,
        data: review,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in PUT /reviews/:reviewId:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /marketplace/reviews/{reviewId}:
   *   delete:
   *     summary: Delete a review
   *     tags: [Marketplace]
   */
  router.delete('/reviews/:reviewId', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const reviewId = getParam(req.params.reviewId) || '';

      await service.deleteReview(reviewId, userId);

      res.json({
        success: true,
        message: 'Review deleted',
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in DELETE /reviews/:reviewId:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==================== Signal Routes ====================

  /**
   * @openapi
   * /marketplace/strategies/{strategyId}/signals:
   *   get:
   *     summary: Get signals for a strategy
   *     tags: [Marketplace]
   */
  router.get('/strategies/:strategyId/signals', async (req: Request, res: Response) => {
    try {
      const strategyId = getParam(req.params.strategyId) || '';
      const limitStr = getQueryParam(req.query.limit);

      const signals = await service.getStrategySignals(strategyId, parseIntParam(limitStr, 50));

      res.json({
        success: true,
        data: signals,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /strategies/:strategyId/signals:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /marketplace/signals:
   *   post:
   *     summary: Publish a new signal
   *     tags: [Marketplace]
   */
  router.post('/signals', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const input = {
        ...req.body,
        publisherId: req.body.publisherId || userId,
      };

      const result = await service.publishSignal(input);

      res.json({
        success: true,
        data: result.signal,
        subscribersNotified: result.subscribers.length,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in POST /signals:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /marketplace/signals/my:
   *   get:
   *     summary: Get active signals for user's subscribed strategies
   *     tags: [Marketplace]
   */
  router.get('/signals/my', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);

      const signals = await service.getActiveSignalsForSubscriber(userId);

      res.json({
        success: true,
        data: signals,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /signals/my:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /marketplace/signals/{signalId}/execute:
   *   post:
   *     summary: Mark a signal as executed for a subscription
   *     tags: [Marketplace]
   */
  router.post('/signals/:signalId/execute', async (req: Request, res: Response) => {
    try {
      const { subscriptionId, pnl } = req.body;
      const signalId = getParam(req.params.signalId) || '';

      await service.markSignalExecuted(subscriptionId, signalId, pnl);

      res.json({
        success: true,
        message: 'Signal execution recorded',
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in POST /signals/:signalId/execute:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==================== Publisher Stats Routes ====================

  /**
   * @openapi
   * /marketplace/publishers/{publisherId}/stats:
   *   get:
   *     summary: Get publisher stats
   *     tags: [Marketplace]
   */
  router.get('/publishers/:publisherId/stats', async (req: Request, res: Response) => {
    try {
      const publisherId = getParam(req.params.publisherId) || '';
      const stats = await service.getPublisherStats(publisherId);

      res.json({
        success: true,
        data: stats,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /publishers/:publisherId/stats:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /marketplace/publishers/top:
   *   get:
   *     summary: Get top publishers
   *     tags: [Marketplace]
   */
  router.get('/publishers/top', async (req: Request, res: Response) => {
    try {
      const limitStr = getQueryParam(req.query.limit);
      const publishers = await service.getTopPublishers(parseIntParam(limitStr, 10));

      res.json({
        success: true,
        data: publishers,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /publishers/top:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /marketplace/publishers/me/strategies:
   *   get:
   *     summary: Get current user's published strategies
   *     tags: [Marketplace]
   */
  router.get('/publishers/me/strategies', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const strategies = await service.getPublisherStrategies(userId);

      res.json({
        success: true,
        data: strategies,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /publishers/me/strategies:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}