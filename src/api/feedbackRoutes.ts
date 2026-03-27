/**
 * Feedback Routes - User Feedback System
 * Handles feedback submission, management, and analytics
 */

import { Router, Request, Response } from 'express';
import { FeedbackDAO, UserFeedback, FeedbackType, FeedbackStatus, SentimentType } from '../database/feedback.dao';
import { authMiddleware, optionalAuthMiddleware, requireAdmin } from './authMiddleware';
import { createSystemNotification } from '../notification/NotificationService';
import { createLogger } from '../utils/logger';

const log = createLogger('FeedbackRoutes');
const router = Router();
const feedbackDAO = new FeedbackDAO();

// Helper to get string from query
const getStringParam = (value: any): string | undefined => {
  if (Array.isArray(value)) return value[0];
  return value;
};

// Helper to get string from params
const getIdParam = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0];
  return value || '';
};

// ============ User Feedback Routes ============

/**
 * @openapi
 * /api/feedback:
 *   get:
 *     summary: Get user's feedback list
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [feature_request, bug_report, other]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in_progress, resolved, closed]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of user's feedback
 */
router.get('/feedback', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const type = getStringParam(req.query.type) as FeedbackType | undefined;
    const status = getStringParam(req.query.status) as FeedbackStatus | undefined;
    const limit = parseInt(getStringParam(req.query.limit) || '20', 10);
    const offset = parseInt(getStringParam(req.query.offset) || '0', 10);
    const sortBy = getStringParam(req.query.sort) as 'newest' | 'oldest' | 'status' | undefined;

    const { feedbacks, total } = await feedbackDAO.getFeedbacks({
      userId,
      type,
      status,
      limit,
      offset,
      sortBy,
      isAdmin: false,
    });

    res.json({
      success: true,
      data: feedbacks.map((f: UserFeedback) => ({
        id: f.id,
        type: f.type,
        status: f.status,
        title: f.title,
        content: f.content,
        images: f.images,
        sentiment: f.sentiment,
        tags: f.tags,
        adminReply: f.adminReply,
        adminReplyAt: f.adminReplyAt,
        adminUsername: f.adminUsername,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      })),
      pagination: { limit, offset, total, hasMore: offset + limit < total },
    });
  } catch (error: any) {
    log.error('Error fetching feedbacks:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch feedbacks' });
  }
});

/**
 * @openapi
 * /api/feedback:
 *   post:
 *     summary: Submit new feedback
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - title
 *               - content
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [feature_request, bug_report, other]
 *               title:
 *                 type: string
 *                 maxLength: 200
 *               content:
 *                 type: string
 *                 maxLength: 5000
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Feedback created successfully
 */
router.post('/feedback', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { type, title, content, images } = req.body;

    // Validation
    const validTypes: FeedbackType[] = ['feature_request', 'bug_report', 'other'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid feedback type. Must be one of: feature_request, bug_report, other',
      });
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    if (title.length > 200) {
      return res.status(400).json({ success: false, error: 'Title must be less than 200 characters' });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }

    if (content.length > 5000) {
      return res.status(400).json({ success: false, error: 'Content must be less than 5000 characters' });
    }

    const feedback = await feedbackDAO.createFeedback({
      userId,
      type,
      title: title.trim(),
      content: content.trim(),
      images: images || [],
    });

    res.status(201).json({
      success: true,
      data: {
        id: feedback.id,
        type: feedback.type,
        status: feedback.status,
        title: feedback.title,
        content: feedback.content,
        images: feedback.images,
        sentiment: feedback.sentiment,
        tags: feedback.tags,
        createdAt: feedback.createdAt,
      },
    });
  } catch (error: any) {
    log.error('Error creating feedback:', error);
    res.status(500).json({ success: false, error: 'Failed to create feedback' });
  }
});

/**
 * @openapi
 * /api/feedback/{id}:
 *   get:
 *     summary: Get feedback by ID
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Feedback details
 */
router.get('/feedback/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const feedbackId = getIdParam(req.params.id);
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const feedback = await feedbackDAO.getFeedbackById(feedbackId, userId, isAdmin);

    if (!feedback) {
      return res.status(404).json({ success: false, error: 'Feedback not found' });
    }

    res.json({
      success: true,
      data: {
        id: feedback.id,
        type: feedback.type,
        status: feedback.status,
        title: feedback.title,
        content: feedback.content,
        images: feedback.images,
        sentiment: feedback.sentiment,
        sentimentScore: feedback.sentimentScore,
        tags: feedback.tags,
        adminReply: feedback.adminReply,
        adminReplyAt: feedback.adminReplyAt,
        adminUsername: feedback.adminUsername,
        resolvedAt: feedback.resolvedAt,
        createdAt: feedback.createdAt,
        updatedAt: feedback.updatedAt,
      },
    });
  } catch (error: any) {
    log.error('Error fetching feedback:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch feedback' });
  }
});

/**
 * @openapi
 * /api/feedback/{id}:
 *   put:
 *     summary: Update feedback
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Feedback updated successfully
 */
router.put('/feedback/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const feedbackId = getIdParam(req.params.id);
    const userId = req.user?.id;
    const { title, content, images } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    // Validate inputs
    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ success: false, error: 'Title cannot be empty' });
      }
      if (title.length > 200) {
        return res.status(400).json({ success: false, error: 'Title must be less than 200 characters' });
      }
    }

    if (content !== undefined) {
      if (typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ success: false, error: 'Content cannot be empty' });
      }
      if (content.length > 5000) {
        return res.status(400).json({ success: false, error: 'Content must be less than 5000 characters' });
      }
    }

    const feedback = await feedbackDAO.updateFeedback(feedbackId, userId, {
      title: title?.trim(),
      content: content?.trim(),
      images,
    });

    res.json({
      success: true,
      data: {
        id: feedback.id,
        title: feedback.title,
        content: feedback.content,
        images: feedback.images,
        sentiment: feedback.sentiment,
        tags: feedback.tags,
        updatedAt: feedback.updatedAt,
      },
    });
  } catch (error: any) {
    log.error('Error updating feedback:', error);
    if (error.message === 'Feedback not found') {
      return res.status(404).json({ success: false, error: 'Feedback not found' });
    }
    if (error.message === 'Not authorized to update this feedback') {
      return res.status(403).json({ success: false, error: 'Not authorized to update this feedback' });
    }
    if (error.message === 'Cannot update feedback after admin reply') {
      return res.status(400).json({ success: false, error: 'Cannot update feedback after admin reply' });
    }
    res.status(500).json({ success: false, error: 'Failed to update feedback' });
  }
});

/**
 * @openapi
 * /api/feedback/{id}:
 *   delete:
 *     summary: Delete feedback (only pending feedback)
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Feedback deleted successfully
 */
router.delete('/feedback/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const feedbackId = getIdParam(req.params.id);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    await feedbackDAO.deleteFeedback(feedbackId, userId);

    res.json({ success: true, message: 'Feedback deleted successfully' });
  } catch (error: any) {
    log.error('Error deleting feedback:', error);
    if (error.message === 'Feedback not found') {
      return res.status(404).json({ success: false, error: 'Feedback not found' });
    }
    if (error.message === 'Not authorized to delete this feedback') {
      return res.status(403).json({ success: false, error: 'Not authorized to delete this feedback' });
    }
    if (error.message === 'Cannot delete feedback that is already being processed') {
      return res.status(400).json({ success: false, error: 'Cannot delete feedback that is already being processed' });
    }
    res.status(500).json({ success: false, error: 'Failed to delete feedback' });
  }
});

/**
 * @openapi
 * /api/feedback/{id}/history:
 *   get:
 *     summary: Get feedback status history
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status history
 */
router.get('/feedback/:id/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const feedbackId = getIdParam(req.params.id);
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    // Check if user has access to this feedback
    const feedback = await feedbackDAO.getFeedbackById(feedbackId, userId, isAdmin);
    if (!feedback) {
      return res.status(404).json({ success: false, error: 'Feedback not found' });
    }

    const history = await feedbackDAO.getStatusHistory(feedbackId);

    res.json({
      success: true,
      data: history.map(h => ({
        id: h.id,
        oldStatus: h.oldStatus,
        newStatus: h.newStatus,
        changedAt: h.changedAt,
        note: h.note,
      })),
    });
  } catch (error: any) {
    log.error('Error fetching feedback history:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch feedback history' });
  }
});

/**
 * @openapi
 * /api/feedback/stats:
 *   get:
 *     summary: Get user's feedback statistics
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feedback statistics
 */
router.get('/feedback/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const stats = await feedbackDAO.getUserFeedbackCount(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    log.error('Error fetching feedback stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch feedback statistics' });
  }
});

// ============ Admin Feedback Routes ============

/**
 * @openapi
 * /api/admin/feedback:
 *   get:
 *     summary: Get all feedback (admin only)
 *     tags: [Admin, Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [feature_request, bug_report, other]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in_progress, resolved, closed]
 *       - in: query
 *         name: sentiment
 *         schema:
 *           type: string
 *           enum: [positive, neutral, negative]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of all feedback
 */
router.get('/admin/feedback', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const type = getStringParam(req.query.type) as FeedbackType | undefined;
    const status = getStringParam(req.query.status) as FeedbackStatus | undefined;
    const sentiment = getStringParam(req.query.sentiment) as SentimentType | undefined;
    const search = getStringParam(req.query.search);
    const limit = parseInt(getStringParam(req.query.limit) || '20', 10);
    const offset = parseInt(getStringParam(req.query.offset) || '0', 10);
    const sortBy = getStringParam(req.query.sort) as 'newest' | 'oldest' | 'status' | 'sentiment' | undefined;

    const { feedbacks, total } = await feedbackDAO.getFeedbacks({
      type,
      status,
      sentiment,
      search,
      limit,
      offset,
      sortBy,
      isAdmin: true,
    });

    res.json({
      success: true,
      data: feedbacks.map((f: UserFeedback) => ({
        id: f.id,
        userId: f.userId,
        username: f.username,
        displayName: f.displayName,
        avatarUrl: f.avatarUrl,
        type: f.type,
        status: f.status,
        title: f.title,
        content: f.content,
        images: f.images,
        sentiment: f.sentiment,
        sentimentScore: f.sentimentScore,
        tags: f.tags,
        adminReply: f.adminReply,
        adminReplyAt: f.adminReplyAt,
        adminUsername: f.adminUsername,
        resolvedAt: f.resolvedAt,
        isReadByAdmin: f.isReadByAdmin,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      })),
      pagination: { limit, offset, total, hasMore: offset + limit < total },
    });
  } catch (error: any) {
    log.error('Error fetching admin feedbacks:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch feedbacks' });
  }
});

/**
 * @openapi
 * /api/admin/feedback/{id}:
 *   put:
 *     summary: Update feedback (admin)
 *     tags: [Admin, Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, in_progress, resolved, closed]
 *               adminReply:
 *                 type: string
 *               sentiment:
 *                 type: string
 *                 enum: [positive, neutral, negative]
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Feedback updated successfully
 */
router.put('/admin/feedback/:id', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const feedbackId = getIdParam(req.params.id);
    const adminId = req.user?.id;
    const { status, adminReply, sentiment, sentimentScore, tags, isReadByAdmin } = req.body;

    if (!adminId) {
      return res.status(401).json({ success: false, error: 'Admin not authenticated' });
    }

    // Validate status
    if (status !== undefined) {
      const validStatuses: FeedbackStatus[] = ['pending', 'in_progress', 'resolved', 'closed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status. Must be one of: pending, in_progress, resolved, closed',
        });
      }
    }

    // Validate sentiment
    if (sentiment !== undefined) {
      const validSentiments: SentimentType[] = ['positive', 'neutral', 'negative'];
      if (!validSentiments.includes(sentiment)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid sentiment. Must be one of: positive, neutral, negative',
        });
      }
    }

    const feedback = await feedbackDAO.adminUpdateFeedback(feedbackId, adminId, {
      status,
      adminReply,
      sentiment,
      sentimentScore,
      tags,
      isReadByAdmin,
    });

    // Send notification to user on status change or admin reply
    try {
      if (status || adminReply !== undefined) {
        const title = status
          ? `反馈状态已更新: ${feedback.title}`
          : `您的反馈收到了回复: ${feedback.title}`;
        const message = adminReply || `您的反馈状态已更新为: ${status}`;
        
        await createSystemNotification(
          feedback.userId,
          title,
          message,
          {
            event_type: 'info',
            details: `Feedback ID: ${feedbackId}`,
          },
          {
            actionUrl: `/feedback/${feedbackId}`,
          }
        );
      }
    } catch (notifyError) {
      log.error('Error sending notification:', notifyError);
      // Don't fail the request if notification fails
    }

    res.json({
      success: true,
      data: {
        id: feedback.id,
        status: feedback.status,
        adminReply: feedback.adminReply,
        adminReplyAt: feedback.adminReplyAt,
        adminUsername: feedback.adminUsername,
        resolvedAt: feedback.resolvedAt,
        sentiment: feedback.sentiment,
        sentimentScore: feedback.sentimentScore,
        tags: feedback.tags,
        updatedAt: feedback.updatedAt,
      },
    });
  } catch (error: any) {
    log.error('Error updating admin feedback:', error);
    res.status(500).json({ success: false, error: 'Failed to update feedback' });
  }
});

/**
 * @openapi
 * /api/admin/feedback/stats:
 *   get:
 *     summary: Get feedback statistics (admin)
 *     tags: [Admin, Feedback]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feedback statistics
 */
router.get('/admin/feedback/stats', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await feedbackDAO.getStatistics();
    const unreadCount = await feedbackDAO.getUnreadCountForAdmin();

    res.json({
      success: true,
      data: {
        ...stats,
        unreadCount,
      },
    });
  } catch (error: any) {
    log.error('Error fetching admin feedback stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch feedback statistics' });
  }
});

/**
 * @openapi
 * /api/admin/feedback/hot-topics:
 *   get:
 *     summary: Get hot topics from feedback
 *     tags: [Admin, Feedback]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hot topics
 */
router.get('/admin/feedback/hot-topics', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const topics = await feedbackDAO.getHotTopics();

    res.json({
      success: true,
      data: topics,
    });
  } catch (error: any) {
    log.error('Error fetching hot topics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch hot topics' });
  }
});

/**
 * @openapi
 * /api/admin/feedback/{id}/read:
 *   post:
 *     summary: Mark feedback as read by admin
 *     tags: [Admin, Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Feedback marked as read
 */
router.post('/admin/feedback/:id/read', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const feedbackId = getIdParam(req.params.id);

    await feedbackDAO.markAsReadByAdmin(feedbackId);

    res.json({ success: true, message: 'Feedback marked as read' });
  } catch (error: any) {
    log.error('Error marking feedback as read:', error);
    res.status(500).json({ success: false, error: 'Failed to mark feedback as read' });
  }
});

/**
 * Create feedback router
 */
export function createFeedbackRouter(): Router {
  return router;
}

export default router;