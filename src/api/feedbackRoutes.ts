/**
 * User Feedback Routes
 *
 * REST endpoints for user feedback submission and management
 */

import { Router, Request, Response } from 'express';
import { feedbackDAO, FeedbackType, FeedbackStatus, CreateFeedbackInput } from '../database';
import { createLogger } from '../utils/logger';

const log = createLogger('FeedbackRoutes');

/**
 * Create feedback router
 */
export function createFeedbackRouter(): Router {
  const router = Router();

  /**
   * POST /api/feedback
   * Submit a new feedback
   * 
   * @body { type, description, screenshot?, screenshotName?, contactInfo?, environment }
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { type, description, screenshot, screenshotName, contactInfo, environment } = req.body;

      // Validation
      if (!type || !['bug', 'suggestion', 'other'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid feedback type. Must be: bug, suggestion, or other',
        });
      }

      if (!description || typeof description !== 'string' || description.trim().length < 5) {
        return res.status(400).json({
          success: false,
          error: 'Description is required and must be at least 5 characters',
        });
      }

      // Get user ID from auth if available
      const userId = req.user?.id;

      // Create feedback input
      const feedbackInput: CreateFeedbackInput = {
        userId,
        type: type as FeedbackType,
        description: description.trim(),
        screenshot: screenshot || undefined,
        screenshotName: screenshotName || undefined,
        contactInfo: contactInfo || undefined,
        environment: environment || {
          url: req.headers.referer || '',
          userAgent: req.headers['user-agent'] || '',
          screenSize: '',
          timestamp: new Date().toISOString(),
          locale: '',
          referrer: req.headers.referer || '',
        },
      };

      // Save to database
      const feedback = await feedbackDAO.createFeedback(feedbackInput);

      log.info(`New feedback received: ${feedback.id} (type: ${type}, user: ${userId || 'anonymous'})`);

      // Return success (don't expose full feedback data)
      res.status(201).json({
        success: true,
        data: {
          id: feedback.id,
          message: 'Feedback submitted successfully',
        },
      });
    } catch (error: any) {
      log.error('Failed to submit feedback:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit feedback',
      });
    }
  });

  /**
   * GET /api/feedback
   * List all feedbacks (admin only)
   * 
   * @query status - Filter by status
   * @query type - Filter by type
   * @query limit - Number of results (default: 50)
   * @query offset - Pagination offset (default: 0)
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      // TODO: Add admin authentication check
      // For now, allow access for testing
      
      const status = req.query.status as FeedbackStatus | undefined;
      const type = req.query.type as FeedbackType | undefined;
      const userId = req.query.userId as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const feedbacks = await feedbackDAO.getFeedbacks({
        status,
        type,
        userId,
        limit,
        offset,
      });

      res.json({
        success: true,
        data: feedbacks,
        total: feedbacks.length,
        limit,
        offset,
      });
    } catch (error: any) {
      log.error('Failed to list feedbacks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list feedbacks',
      });
    }
  });

  /**
   * GET /api/feedback/stats/summary
   * Get feedback statistics (admin only)
   */
  router.get('/stats/summary', async (req: Request, res: Response) => {
    try {
      const stats = await feedbackDAO.getFeedbackStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      log.error('Failed to get feedback stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get feedback statistics',
      });
    }
  });

  /**
   * GET /api/feedback/stats
   * Get feedback statistics (admin only) - alias for /stats/summary
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const stats = await feedbackDAO.getFeedbackStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      log.error('Failed to get feedback stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get feedback statistics',
      });
    }
  });

  /**
   * GET /api/feedback/:id
   * Get a specific feedback (admin only)
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);

      const feedback = await feedbackDAO.getFeedbackById(id);
      if (!feedback) {
        return res.status(404).json({
          success: false,
          error: 'Feedback not found',
        });
      }

      res.json({
        success: true,
        data: feedback,
      });
    } catch (error: any) {
      log.error('Failed to get feedback:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get feedback',
      });
    }
  });

  /**
   * PATCH /api/feedback/:id/status
   * Update feedback status (admin only)
   */
  router.patch('/:id/status', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const { status, adminNotes, tags } = req.body;

      // Validation
      if (!status || !Object.values(FeedbackStatus).includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status. Must be: new, in_progress, resolved, or closed',
        });
      }

      const feedback = await feedbackDAO.updateFeedback(id, {
        status,
        adminNotes,
        tags,
      });

      res.json({
        success: true,
        data: feedback,
      });
    } catch (error: any) {
      log.error('Failed to update feedback status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update feedback status',
      });
    }
  });

  /**
   * DELETE /api/feedback/:id
   * Delete a feedback (admin only)
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);

      await feedbackDAO.deleteFeedback(id);

      res.json({
        success: true,
        message: 'Feedback deleted successfully',
      });
    } catch (error: any) {
      log.error('Failed to delete feedback:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete feedback',
      });
    }
  });

  return router;
}

// Export enums for external use
export { FeedbackType, FeedbackStatus };

export default createFeedbackRouter;