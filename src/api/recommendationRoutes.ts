/**
 * Strategy Recommendation API Routes
 */

import { Router, Request, Response } from 'express';
import { getStrategyRecommendationService } from '../recommendation';
import { createLogger } from '../utils/logger';

const log = createLogger('RecommendationRoutes');

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

export function createRecommendationRouter(): Router {
  const router = Router();
  const service = getStrategyRecommendationService();

  // ==================== Recommendation Routes ====================

  /**
   * @openapi
   * /recommendations:
   *   get:
   *     summary: Get personalized strategy recommendations
   *     description: Returns AI-powered strategy recommendations based on user history, preferences, and collaborative filtering
   *     tags: [Recommendations]
   *     parameters:
   *       - name: limit
   *         in: query
   *         schema:
   *           type: integer
   *           default: 10
   *           minimum: 1
   *           maximum: 20
   *     responses:
   *       200:
   *         description: List of recommended strategies with match scores and reasons
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
   *                     type: object
   *                     properties:
   *                       strategy:
   *                         $ref: '#/components/schemas/MarketplaceStrategy'
   *                       score:
   *                         type: number
   *                         description: Match score (0-100)
   *                       reasons:
   *                         type: array
   *                         items:
   *                           type: string
   *                       algorithm:
   *                         type: string
   *                         enum: [collaborative, content_based, hybrid, trending]
   */
  router.get('/recommendations', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const limit = Math.min(parseIntParam(req.query.limit, 10) || 10, 20);

      const recommendations = await service.getRecommendations(userId, limit);

      res.json({
        success: true,
        data: recommendations,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /recommendations:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /recommendations/{recommendationId}/dismiss:
   *   post:
   *     summary: Dismiss a recommendation
   *     tags: [Recommendations]
   *     parameters:
   *       - name: recommendationId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Recommendation dismissed
   */
  router.post('/recommendations/:recommendationId/dismiss', async (req: Request, res: Response) => {
    try {
      const recommendationId = getParam(req.params.recommendationId) || '';
      
      await service.dismissRecommendation(recommendationId);

      res.json({
        success: true,
        message: 'Recommendation dismissed',
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in POST /recommendations/:id/dismiss:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /recommendations/{recommendationId}/click:
   *   post:
   *     summary: Mark recommendation as clicked
   *     tags: [Recommendations]
   *     parameters:
   *       - name: recommendationId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Recommendation marked as clicked
   */
  router.post('/recommendations/:recommendationId/click', async (req: Request, res: Response) => {
    try {
      const recommendationId = getParam(req.params.recommendationId) || '';
      
      await service.clickRecommendation(recommendationId);

      res.json({
        success: true,
        message: 'Recommendation clicked',
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in POST /recommendations/:id/click:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /recommendations/explain/{strategyId}:
   *   get:
   *     summary: Get explanation for why a strategy is recommended
   *     tags: [Recommendations]
   *     parameters:
   *       - name: strategyId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Recommendation explanation with score breakdown
   */
  router.get('/recommendations/explain/:strategyId', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const strategyId = getParam(req.params.strategyId) || '';

      const explanation = await service.explainRecommendation(userId, strategyId);

      res.json({
        success: true,
        data: explanation,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /recommendations/explain/:strategyId:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==================== Feedback Routes ====================

  /**
   * @openapi
   * /recommendations/feedback:
   *   post:
   *     summary: Record user feedback on a strategy
   *     description: Submit like/dislike feedback to improve future recommendations
   *     tags: [Recommendations]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - strategyId
   *               - feedbackType
   *             properties:
   *               strategyId:
   *                 type: string
   *               feedbackType:
   *                 type: string
   *                 enum: [like, dislike, not_interested]
   *               reason:
   *                 type: string
   *                 description: Optional reason for feedback
   *     responses:
   *       200:
   *         description: Feedback recorded successfully
   */
  router.post('/recommendations/feedback', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { strategyId, feedbackType, reason } = req.body;

      if (!strategyId || !feedbackType) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: strategyId, feedbackType',
        });
      }

      if (!['like', 'dislike', 'not_interested'].includes(feedbackType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid feedbackType. Must be: like, dislike, or not_interested',
        });
      }

      const feedback = await service.recordFeedback({
        userId,
        strategyId,
        feedbackType,
        reason,
      });

      res.json({
        success: true,
        data: feedback,
        message: 'Feedback recorded. Thank you for helping us improve!',
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in POST /recommendations/feedback:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /recommendations/interactions:
   *   post:
   *     summary: Record user interaction with a strategy
   *     description: Automatically track user interactions to improve recommendations
   *     tags: [Recommendations]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - strategyId
   *               - interactionType
   *             properties:
   *               strategyId:
   *                 type: string
   *               interactionType:
   *                 type: string
   *                 enum: [view, subscribe, review, signal_follow]
   *               metadata:
   *                 type: object
   *                 description: Optional additional data
   *     responses:
   *       200:
   *         description: Interaction recorded
   */
  router.post('/recommendations/interactions', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { strategyId, interactionType, metadata } = req.body;

      if (!strategyId || !interactionType) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: strategyId, interactionType',
        });
      }

      if (!['view', 'subscribe', 'review', 'signal_follow'].includes(interactionType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid interactionType. Must be: view, subscribe, review, or signal_follow',
        });
      }

      const interaction = await service.recordInteraction({
        userId,
        strategyId,
        interactionType,
        metadata,
      });

      res.json({
        success: true,
        data: interaction,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in POST /recommendations/interactions:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==================== User Profile Routes ====================

  /**
   * @openapi
   * /recommendations/profile:
   *   get:
   *     summary: Get user's recommendation profile
   *     tags: [Recommendations]
   *     responses:
   *       200:
   *         description: User profile with preferences
   */
  router.get('/recommendations/profile', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const profile = await service.getUserProfile(userId);

      res.json({
        success: true,
        data: profile,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /recommendations/profile:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /recommendations/profile:
   *   put:
   *     summary: Update user's recommendation profile
   *     description: Set preferences to improve recommendation quality
   *     tags: [Recommendations]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               riskTolerance:
   *                 type: string
   *                 enum: [conservative, moderate, aggressive, very_aggressive]
   *               capitalScale:
   *                 type: string
   *                 enum: [small, medium, large, institutional]
   *               preferredCategories:
   *                 type: array
   *                 items:
   *                   type: string
   *               preferredStrategyTypes:
   *                 type: array
   *                 items:
   *                   type: string
   *               preferredSymbols:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         description: Profile updated
   */
  router.put('/recommendations/profile', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const profile = await service.updateUserProfile(userId, req.body);

      res.json({
        success: true,
        data: profile,
        message: 'Profile updated. Recommendations will be refreshed.',
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in PUT /recommendations/profile:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==================== Admin Routes ====================

  /**
   * @openapi
   * /recommendations/stats:
   *   get:
   *     summary: Get recommendation system statistics
   *     tags: [Recommendations]
   *     responses:
   *       200:
   *         description: System statistics
   */
  router.get('/recommendations/stats', async (req: Request, res: Response) => {
    try {
      const stats = await service.getStats();

      res.json({
        success: true,
        data: stats,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in GET /recommendations/stats:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @openapi
   * /recommendations/cleanup:
   *   post:
   *     summary: Clear expired recommendations (admin)
   *     tags: [Recommendations]
   *     responses:
   *       200:
   *         description: Number of expired recommendations cleared
   */
  router.post('/recommendations/cleanup', async (req: Request, res: Response) => {
    try {
      const count = await service.clearExpiredRecommendations();

      res.json({
        success: true,
        data: { clearedCount: count },
        timestamp: Date.now(),
      });
    } catch (error: any) {
      log.error('Error in POST /recommendations/cleanup:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}