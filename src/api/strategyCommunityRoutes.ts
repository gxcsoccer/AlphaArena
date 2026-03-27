/**
 * Strategy Community API Routes
 */

import { Router, Request, Response } from 'express';
import { getStrategyCommunityService } from '../strategy-community';
import { LeaderboardType } from '../database/strategy-community.dao';
import { createLogger } from '../utils/logger';

const log = createLogger('StrategyCommunityRoutes');

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

// Helper to get user ID from request
function getUserId(req: Request): string {
  const headerUserId = req.headers['x-user-id'];
  const queryUserId = req.query.userId;

  if (typeof headerUserId === 'string') return headerUserId;
  if (typeof queryUserId === 'string') return queryUserId;
  if (Array.isArray(queryUserId) && typeof queryUserId[0] === 'string') return queryUserId[0];

  return 'anonymous';
}

// Validate leaderboard type
function isValidLeaderboardType(value: string): value is LeaderboardType {
  return ['returns', 'popularity', 'stability', 'win_rate', 'recent'].includes(value);
}

export function createStrategyCommunityRouter(): Router {
  const router = Router();
  const service = getStrategyCommunityService();

  // ==================== Community Overview ====================

  /**
   * @openapi
   * /community/overview:
   *   get:
   *     summary: Get community overview with highlights
   *     tags: [Community]
   */
  router.get('/overview', async (req: Request, res: Response) => {
    try {
      const overview = await service.getCommunityOverview();

      res.json({
        success: true,
        data: overview,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /community/overview:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /community/stats:
   *   get:
   *     summary: Get community statistics
   *     tags: [Community]
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const stats = await service.getCommunityStats();

      res.json({
        success: true,
        data: stats,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /community/stats:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==================== Strategy Sharing ====================

  /**
   * @openapi
   * /community/share:
   *   post:
   *     summary: Share a strategy to the community
   *     tags: [Community]
   */
  router.post('/share', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const input = {
        ...req.body,
        publisherId: req.body.publisherId || userId,
      };

      const strategy = await service.shareStrategy(input);

      res.json({
        success: true,
        data: strategy,
        message: 'Strategy shared successfully',
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in POST /community/share:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /community/strategies/{id}/publish:
   *   post:
   *     summary: Publish a strategy to the community
   *     tags: [Community]
   */
  router.post('/strategies/:id/publish', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const strategyId = getParam(req.params.id) || '';

      const strategy = await service.publishToCommunity(strategyId, userId);

      res.json({
        success: true,
        data: strategy,
        message: 'Strategy published to community',
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in POST /community/strategies/:id/publish:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /community/strategies/{id}/settings:
   *   patch:
   *     summary: Update strategy sharing settings
   *     tags: [Community]
   */
  router.patch('/strategies/:id/settings', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const strategyId = getParam(req.params.id) || '';

      const strategy = await service.updateSharingSettings(strategyId, userId, req.body);

      res.json({
        success: true,
        data: strategy,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in PATCH /community/strategies/:id/settings:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==================== Strategy Discovery ====================

  /**
   * @openapi
   * /community/leaderboard:
   *   get:
   *     summary: Get strategy leaderboard
   *     tags: [Community]
   *     parameters:
   *       - name: type
   *         in: query
   *         schema:
   *           type: string
   *           enum: [returns, popularity, stability, win_rate, recent]
   *           default: returns
   *       - name: period
   *         in: query
   *         schema:
   *           type: string
   *           enum: [daily, weekly, monthly, all_time]
   *           default: all_time
   *       - name: category
   *         in: query
   *         schema:
   *           type: string
   *       - name: limit
   *         in: query
   *         schema:
   *           type: integer
   *           default: 20
   */
  router.get('/leaderboard', async (req: Request, res: Response) => {
    try {
      const typeStr = getQueryParam(req.query.type) || 'returns';
      const period = getQueryParam(req.query.period) || 'all_time';
      const category = getQueryParam(req.query.category);
      const limit = parseIntParam(req.query.limit, 20);

      if (!isValidLeaderboardType(typeStr)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid leaderboard type. Must be one of: returns, popularity, stability, win_rate, recent',
        });
      }

      const leaderboard = await service.getLeaderboard({
        type: typeStr,
        period: period as 'daily' | 'weekly' | 'monthly' | 'all_time',
        category,
        limit,
      });

      res.json({
        success: true,
        data: leaderboard,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /community/leaderboard:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /community/categories:
   *   get:
   *     summary: Get available categories with counts
   *     tags: [Community]
   */
  router.get('/categories', async (req: Request, res: Response) => {
    try {
      const categories = await service.getCategories();

      res.json({
        success: true,
        data: categories,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /community/categories:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /community/categories/{category}/strategies:
   *   get:
   *     summary: Browse strategies by category
   *     tags: [Community]
   */
  router.get('/categories/:category/strategies', async (req: Request, res: Response) => {
    try {
      const category = getParam(req.params.category) || '';
      const limit = parseIntParam(req.query.limit, 20);
      const offset = parseIntParam(req.query.offset);
      const orderBy = getQueryParam(req.query.orderBy) as 'rating_avg' | 'subscriber_count' | 'created_at' || 'rating_avg';
      const orderDirection = getQueryParam(req.query.orderDirection) as 'asc' | 'desc' || 'desc';

      const strategies = await service.browseByCategory(category, {
        limit,
        offset,
        orderBy,
        orderDirection,
      });

      res.json({
        success: true,
        data: strategies,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /community/categories/:category/strategies:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /community/tags:
   *   get:
   *     summary: Get popular tags
   *     tags: [Community]
   */
  router.get('/tags', async (req: Request, res: Response) => {
    try {
      const tags = await service.getPopularTags();

      res.json({
        success: true,
        data: tags,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /community/tags:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /community/search:
   *   get:
   *     summary: Search strategies
   *     tags: [Community]
   */
  router.get('/search', async (req: Request, res: Response) => {
    try {
      const query = getQueryParam(req.query.q) || getQueryParam(req.query.query) || '';
      const category = getQueryParam(req.query.category);
      const tagsStr = getQueryParam(req.query.tags);
      const minRating = parseIntParam(req.query.minRating);
      const limit = parseIntParam(req.query.limit, 20);

      const strategies = await service.searchStrategies(query, {
        category,
        tags: tagsStr ? tagsStr.split(',') : undefined,
        minRating,
        limit,
      });

      res.json({
        success: true,
        data: strategies,
        query,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /community/search:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /community/trending:
   *   get:
   *     summary: Get trending strategies
   *     tags: [Community]
   */
  router.get('/trending', async (req: Request, res: Response) => {
    try {
      const limit = parseIntParam(req.query.limit, 10);
      const strategies = await service.getTrendingStrategies(limit);

      res.json({
        success: true,
        data: strategies,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /community/trending:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==================== Strategy Details ====================

  /**
   * @openapi
   * /community/strategies/{id}:
   *   get:
   *     summary: Get full strategy details with community data
   *     tags: [Community]
   */
  router.get('/strategies/:id', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const strategyId = getParam(req.params.id) || '';

      const details = await service.getStrategyDetails(strategyId, userId);

      if (!details) {
        return res.status(404).json({
          success: false,
          error: 'Strategy not found',
        });
      }

      res.json({
        success: true,
        data: details,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /community/strategies/:id:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==================== Strategy Subscription ====================

  /**
   * @openapi
   * /community/subscribe:
   *   post:
   *     summary: Subscribe to a strategy
   *     tags: [Community]
   */
  router.post('/subscribe', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const input = {
        ...req.body,
        subscriberId: req.body.subscriberId || userId,
      };

      const result = await service.subscribeToStrategy(input);

      res.json({
        success: true,
        data: result,
        message: result.isNew ? 'Successfully subscribed' : 'Subscription reactivated',
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in POST /community/subscribe:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /community/subscriptions:
   *   get:
   *     summary: Get user's subscriptions
   *     tags: [Community]
   */
  router.get('/subscriptions', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const result = await service.getMySubscriptions(userId);

      res.json({
        success: true,
        data: result.subscriptions,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /community/subscriptions:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /community/subscriptions/{id}:
   *   patch:
   *     summary: Update subscription settings
   *     tags: [Community]
   */
  router.patch('/subscriptions/:id', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const subscriptionId = getParam(req.params.id) || '';

      const subscription = await service.updateSubscription(subscriptionId, userId, req.body);

      res.json({
        success: true,
        data: subscription,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in PATCH /community/subscriptions/:id:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /community/subscriptions/{id}:
   *   delete:
   *     summary: Unsubscribe from a strategy
   *     tags: [Community]
   */
  router.delete('/subscriptions/:id', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const subscriptionId = getParam(req.params.id) || '';

      await service.unsubscribeFromStrategy(subscriptionId, userId);

      res.json({
        success: true,
        message: 'Successfully unsubscribed',
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in DELETE /community/subscriptions/:id:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==================== Strategy Evaluation ====================

  /**
   * @openapi
   * /community/strategies/{id}/reviews:
   *   get:
   *     summary: Get reviews for a strategy
   *     tags: [Community]
   */
  router.get('/strategies/:id/reviews', async (req: Request, res: Response) => {
    try {
      const strategyId = getParam(req.params.id) || '';
      const limit = parseIntParam(req.query.limit, 20);
      const offset = parseIntParam(req.query.offset);

      const reviews = await service.getStrategyReviews(strategyId, { limit, offset });

      res.json({
        success: true,
        data: reviews,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /community/strategies/:id/reviews:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /community/strategies/{id}/reviews:
   *   post:
   *     summary: Submit a review for a strategy
   *     tags: [Community]
   */
  router.post('/strategies/:id/reviews', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const strategyId = getParam(req.params.id) || '';

      const review = await service.reviewStrategy({
        ...req.body,
        strategyId,
        userId,
      });

      res.json({
        success: true,
        data: review,
        message: 'Review submitted successfully',
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in POST /community/strategies/:id/reviews:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /community/reviews/{id}:
   *   patch:
   *     summary: Update a review
   *     tags: [Community]
   */
  router.patch('/reviews/:id', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const reviewId = getParam(req.params.id) || '';

      const review = await service.updateReview(reviewId, userId, req.body);

      res.json({
        success: true,
        data: review,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in PATCH /community/reviews/:id:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==================== Strategy Reporting ====================

  /**
   * @openapi
   * /community/strategies/{id}/report:
   *   post:
   *     summary: Report a strategy
   *     tags: [Community]
   */
  router.post('/strategies/:id/report', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const strategyId = getParam(req.params.id) || '';

      const report = await service.reportStrategy({
        ...req.body,
        reporterId: userId,
        strategyId,
      });

      res.json({
        success: true,
        data: report,
        message: 'Report submitted successfully',
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in POST /community/strategies/:id/report:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /community/reports:
   *   get:
   *     summary: Get reports (admin only)
   *     tags: [Community]
   */
  router.get('/reports', async (req: Request, res: Response) => {
    try {
      const status = getQueryParam(req.query.status) as ReportStatus | undefined;
      const reportType = getQueryParam(req.query.reportType) as ReportType | undefined;
      const limit = parseIntParam(req.query.limit, 50);
      const offset = parseIntParam(req.query.offset);

      const reports = await service.getReports({
        status,
        reportType,
        limit,
        offset,
      });

      res.json({
        success: true,
        data: reports,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /community/reports:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /community/reports/{id}/resolve:
   *   post:
   *     summary: Resolve a report (admin only)
   *     tags: [Community]
   */
  router.post('/reports/:id/resolve', async (req: Request, res: Response) => {
    try {
      const adminId = getUserId(req);
      const reportId = getParam(req.params.id) || '';
      const { resolution, action } = req.body;

      if (!resolution || !action) {
        return res.status(400).json({
          success: false,
          error: 'resolution and action are required',
        });
      }

      if (!['dismiss', 'warning', 'delist'].includes(action)) {
        return res.status(400).json({
          success: false,
          error: 'action must be one of: dismiss, warning, delist',
        });
      }

      const report = await service.resolveReport(reportId, adminId, resolution, action);

      res.json({
        success: true,
        data: report,
        message: 'Report resolved successfully',
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in POST /community/reports/:id/resolve:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

// Import types for documentation
import { ReportStatus, ReportType } from '../database/strategy-community.dao';