/**
 * Signal Comment Routes - Trading Signal Comments and Discussion System
 */

import { Router, Request, Response } from 'express';
import { SignalCommentsDAO, SignalComment, SignalCommentReport } from '../database/signal-comments.dao';
import { authMiddleware, optionalAuthMiddleware, requireAdmin } from './authMiddleware';
import { createLogger } from '../utils/logger';
import { checkContent, isContentClean } from '../utils/content-filter';
import { createCommentNotification } from '../notification/NotificationService';
import { TradingSignalsDAO } from '../database/trading-signals.dao';

const log = createLogger('SignalCommentRoutes');
const router = Router();
const signalCommentsDAO = new SignalCommentsDAO();
const tradingSignalsDAO = new TradingSignalsDAO();

// Helper to get string from query
const getStringParam = (value: any): string | undefined => {
  if (Array.isArray(value)) return value[0];
  return value;
};

// ============ Comment Routes ============

/**
 * @openapi
 * /api/signals/{signalId}/comments:
 *   get:
 *     summary: Get comments for a trading signal
 *     tags: [Signal Comments]
 *     parameters:
 *       - in: path
 *         name: signalId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, oldest, likes]
 *         description: Sort order for comments
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
 *         description: List of comments
 */
router.get('/signals/:signalId/comments', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const signalId = req.params.signalId as string;
    const sortBy = getStringParam(req.query.sort) as 'newest' | 'oldest' | 'likes' || 'newest';
    const limit = parseInt(getStringParam(req.query.limit) || '20', 10);
    const offset = parseInt(getStringParam(req.query.offset) || '0', 10);
    const currentUserId = req.user?.id;

    const { comments, total } = await signalCommentsDAO.getComments({
      signalId,
      sortBy,
      limit,
      offset,
      currentUserId,
    });

    res.json({
      success: true,
      data: comments.map((c: SignalComment) => ({
        id: c.id,
        content: c.content,
        contentHtml: c.contentHtml,
        likesCount: c.likesCount,
        repliesCount: c.repliesCount,
        isEdited: c.isEdited,
        isPinned: c.isPinned,
        isLikedByUser: c.isLikedByUser,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        user: {
          id: c.userId,
          username: c.username || 'unknown',
          displayName: c.displayName,
          avatarUrl: c.avatarUrl,
        },
      })),
      pagination: { limit, offset, total, hasMore: offset + limit < total },
    });
  } catch (error: any) {
    log.error('Error fetching signal comments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch comments' });
  }
});

/**
 * @openapi
 * /api/signals/{signalId}/comments:
 *   post:
 *     summary: Create a new comment on a trading signal
 *     tags: [Signal Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: signalId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 maxLength: 5000
 *               parentId:
 *                 type: string
 *                 description: Parent comment ID for replies
 *     responses:
 *       201:
 *         description: Comment created successfully
 */
router.post('/signals/:signalId/comments', authMiddleware, async (req: Request, res: Response) => {
  try {
    const signalId = req.params.signalId as string;
    const userId = req.user?.id;
    const { content, parentId } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Comment content is required' });
    }

    if (content.length > 5000) {
      return res.status(400).json({ success: false, error: 'Comment content must be less than 5000 characters' });
    }

    // Check for sensitive content
    const filterResult = checkContent(content);
    if (!filterResult.isClean) {
      log.warn('Sensitive content detected in comment', { 
        userId, 
        signalId, 
        detectedWords: filterResult.detectedWords 
      });
      // We still allow the comment but log the warning
      // For stricter moderation, we could reject the comment:
      // return res.status(400).json({ success: false, error: 'Comment contains inappropriate content' });
    }

    // Check if signal exists
    const signal = await tradingSignalsDAO.getById(signalId);
    if (!signal) {
      return res.status(404).json({ success: false, error: 'Signal not found' });
    }

    const comment = await signalCommentsDAO.createComment({
      signalId,
      userId,
      parentId,
      content: content.trim(),
    });

    // Send notification to signal author (if not self-commenting)
    if (signal.publisherId !== userId) {
      try {
        await createCommentNotification(
          signal.publisherId,
          'New comment on your signal',
          `Someone commented on your signal for ${signal.symbol}`,
          {
            signal_id: signalId,
            signal_title: signal.title,
            comment_id: comment.id,
            comment_preview: content.substring(0, 100),
            is_reply: false,
          },
          {
            actionUrl: `/signals/${signalId}#comment-${comment.id}`,
          }
        );
      } catch (notifError) {
        log.error('Failed to send comment notification:', notifError);
        // Don't fail the request if notification fails
      }
    }

    // If this is a reply, notify the parent comment author
    if (parentId) {
      try {
        const parentComment = await signalCommentsDAO.getCommentById(parentId);
        if (parentComment && parentComment.userId !== userId) {
          await createCommentNotification(
            parentComment.userId,
            'New reply to your comment',
            `Someone replied to your comment on signal ${signal.symbol}`,
            {
              signal_id: signalId,
              signal_title: signal.title,
              comment_id: comment.id,
              comment_preview: content.substring(0, 100),
              parent_id: parentId,
              is_reply: true,
            },
            {
              actionUrl: `/signals/${signalId}#comment-${comment.id}`,
            }
          );
        }
      } catch (notifError) {
        log.error('Failed to send reply notification:', notifError);
      }
    }

    res.status(201).json({
      success: true,
      data: {
        id: comment.id,
        content: comment.content,
        contentHtml: comment.contentHtml,
        likesCount: comment.likesCount,
        repliesCount: comment.repliesCount,
        createdAt: comment.createdAt,
        user: { id: userId, email: req.user?.email || 'unknown' },
      },
    });
  } catch (error: any) {
    log.error('Error creating signal comment:', error);
    res.status(500).json({ success: false, error: 'Failed to create comment' });
  }
});

/**
 * @openapi
 * /api/signal-comments/{commentId}:
 *   get:
 *     summary: Get a specific comment
 *     tags: [Signal Comments]
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comment details
 */
router.get('/signal-comments/:commentId', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const commentId = req.params.commentId as string;
    const currentUserId = req.user?.id;

    const comment = await signalCommentsDAO.getCommentById(commentId, currentUserId);

    if (!comment || comment.isDeleted) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    res.json({
      success: true,
      data: {
        id: comment.id,
        signalId: comment.signalId,
        content: comment.content,
        contentHtml: comment.contentHtml,
        likesCount: comment.likesCount,
        repliesCount: comment.repliesCount,
        isEdited: comment.isEdited,
        isPinned: comment.isPinned,
        isLikedByUser: comment.isLikedByUser,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        user: {
          id: comment.userId,
          username: comment.username || 'unknown',
          displayName: comment.displayName,
          avatarUrl: comment.avatarUrl,
        },
      },
    });
  } catch (error: any) {
    log.error('Error fetching signal comment:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch comment' });
  }
});

/**
 * @openapi
 * /api/signal-comments/{commentId}:
 *   put:
 *     summary: Update a comment
 *     tags: [Signal Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 maxLength: 5000
 *     responses:
 *       200:
 *         description: Comment updated successfully
 */
router.put('/signal-comments/:commentId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const commentId = req.params.commentId as string;
    const userId = req.user?.id;
    const { content } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Comment content is required' });
    }

    if (content.length > 5000) {
      return res.status(400).json({ success: false, error: 'Comment content must be less than 5000 characters' });
    }

    // Check for sensitive content
    if (!isContentClean(content)) {
      log.warn('Sensitive content detected in updated comment', { userId, commentId });
    }

    const comment = await signalCommentsDAO.updateComment(commentId, userId, { content: content.trim() });

    res.json({
      success: true,
      data: {
        id: comment.id,
        content: comment.content,
        contentHtml: comment.contentHtml,
        isEdited: comment.isEdited,
        updatedAt: comment.updatedAt,
      },
    });
  } catch (error: any) {
    log.error('Error updating signal comment:', error);
    if (error.message === 'Comment not found') {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }
    if (error.message === 'Not authorized to update this comment') {
      return res.status(403).json({ success: false, error: 'Not authorized to update this comment' });
    }
    res.status(500).json({ success: false, error: 'Failed to update comment' });
  }
});

/**
 * @openapi
 * /api/signal-comments/{commentId}:
 *   delete:
 *     summary: Delete a comment (soft delete)
 *     tags: [Signal Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 */
router.delete('/signal-comments/:commentId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const commentId = req.params.commentId as string;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    await signalCommentsDAO.deleteComment(commentId, userId);

    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error: any) {
    log.error('Error deleting signal comment:', error);
    if (error.message === 'Comment not found') {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }
    if (error.message === 'Not authorized to delete this comment') {
      return res.status(403).json({ success: false, error: 'Not authorized to delete this comment' });
    }
    res.status(500).json({ success: false, error: 'Failed to delete comment' });
  }
});

// ============ Reply Routes ============

/**
 * @openapi
 * /api/signal-comments/{commentId}/replies:
 *   get:
 *     summary: Get replies for a comment
 *     tags: [Signal Comments]
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of replies
 */
router.get('/signal-comments/:commentId/replies', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const commentId = req.params.commentId as string;
    const limit = parseInt(getStringParam(req.query.limit) || '10', 10);
    const offset = parseInt(getStringParam(req.query.offset) || '0', 10);
    const currentUserId = req.user?.id;

    const { replies, total } = await signalCommentsDAO.getReplies(commentId, { limit, offset, currentUserId });

    res.json({
      success: true,
      data: replies.map((r: SignalComment) => ({
        id: r.id,
        content: r.content,
        contentHtml: r.contentHtml,
        likesCount: r.likesCount,
        isEdited: r.isEdited,
        isLikedByUser: r.isLikedByUser,
        createdAt: r.createdAt,
        user: {
          id: r.userId,
          username: r.username || 'unknown',
          displayName: r.displayName,
          avatarUrl: r.avatarUrl,
        },
      })),
      pagination: { limit, offset, total, hasMore: offset + limit < total },
    });
  } catch (error: any) {
    log.error('Error fetching signal comment replies:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch replies' });
  }
});

// ============ Like Routes ============

/**
 * @openapi
 * /api/signal-comments/{commentId}/toggle-like:
 *   post:
 *     summary: Toggle like on a comment
 *     tags: [Signal Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Like toggled successfully
 */
router.post('/signal-comments/:commentId/toggle-like', authMiddleware, async (req: Request, res: Response) => {
  try {
    const commentId = req.params.commentId as string;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { liked } = await signalCommentsDAO.toggleLike(commentId, userId);

    // Send notification for likes (optional - can be disabled in preferences)
    if (liked) {
      try {
        const comment = await signalCommentsDAO.getCommentById(commentId);
        if (comment && comment.userId !== userId) {
          const signal = await tradingSignalsDAO.getById(comment.signalId);
          await createCommentNotification(
            comment.userId,
            'Someone liked your comment',
            `Your comment on ${signal?.symbol || 'a signal'} received a like`,
            {
              signal_id: comment.signalId,
              comment_id: commentId,
              comment_preview: comment.content.substring(0, 50),
              is_like: true,
            },
            {
              priority: 'LOW',
              actionUrl: `/signals/${comment.signalId}#comment-${commentId}`,
            }
          );
        }
      } catch (notifError) {
        log.error('Failed to send like notification:', notifError);
      }
    }

    res.json({
      success: true,
      data: { liked },
      message: liked ? 'Comment liked successfully' : 'Comment unliked successfully',
    });
  } catch (error: any) {
    log.error('Error toggling like on signal comment:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle like' });
  }
});

/**
 * @openapi
 * /api/signal-comments/{commentId}/likes:
 *   get:
 *     summary: Get users who liked a comment
 *     tags: [Signal Comments]
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of users who liked the comment
 */
router.get('/signal-comments/:commentId/likes', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const commentId = req.params.commentId as string;
    const limit = parseInt(getStringParam(req.query.limit) || '50', 10);
    const offset = parseInt(getStringParam(req.query.offset) || '0', 10);

    const { users, total } = await signalCommentsDAO.getCommentLikes(commentId, limit, offset);

    res.json({
      success: true,
      data: users,
      pagination: { limit, offset, total, hasMore: offset + limit < total },
    });
  } catch (error: any) {
    log.error('Error fetching signal comment likes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch likes' });
  }
});

// ============ Report Routes ============

/**
 * @openapi
 * /api/signal-comments/{commentId}/report:
 *   post:
 *     summary: Report a comment
 *     tags: [Signal Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 enum: [spam, abuse, inappropriate, other]
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Report created successfully
 */
router.post('/signal-comments/:commentId/report', authMiddleware, async (req: Request, res: Response) => {
  try {
    const commentId = req.params.commentId as string;
    const userId = req.user?.id;
    const { reason, description } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const validReasons = ['spam', 'abuse', 'inappropriate', 'other'];
    if (!reason || !validReasons.includes(reason)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid report reason. Must be one of: spam, abuse, inappropriate, other',
      });
    }

    const report = await signalCommentsDAO.reportComment(commentId, userId, reason, description);

    res.status(201).json({
      success: true,
      data: {
        id: report.id,
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt,
      },
    });
  } catch (error: any) {
    log.error('Error reporting signal comment:', error);
    if (error.message === 'Already reported this comment') {
      return res.status(400).json({ success: false, error: 'Already reported this comment' });
    }
    res.status(500).json({ success: false, error: 'Failed to report comment' });
  }
});

// ============ Admin Moderation Routes ============

/**
 * @openapi
 * /api/admin/signal-comments/reports:
 *   get:
 *     summary: Get reported comments (admin only)
 *     tags: [Signal Comments Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, reviewed, resolved, dismissed]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of reports
 */
router.get('/admin/signal-comments/reports', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const status = getStringParam(req.query.status) as SignalCommentReport['status'] | undefined;
    const limit = parseInt(getStringParam(req.query.limit) || '50', 10);
    const offset = parseInt(getStringParam(req.query.offset) || '0', 10);

    const { reports, total } = await signalCommentsDAO.getReports(status, limit, offset);

    res.json({
      success: true,
      data: reports,
      pagination: { limit, offset, total, hasMore: offset + limit < total },
    });
  } catch (error: any) {
    log.error('Error fetching signal comment reports:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch reports' });
  }
});

/**
 * @openapi
 * /api/admin/signal-comments/{commentId}/moderate:
 *   post:
 *     summary: Moderate a comment (admin only)
 *     tags: [Signal Comments Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [hide, show, pin, unpin]
 *     responses:
 *       200:
 *         description: Comment moderated successfully
 */
router.post('/admin/signal-comments/:commentId/moderate', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const commentId = req.params.commentId as string;
    const userId = req.user?.id;
    const { action } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const validActions = ['hide', 'show', 'pin', 'unpin'];
    if (!action || !validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Must be one of: hide, show, pin, unpin',
      });
    }

    const comment = await signalCommentsDAO.moderateComment(commentId, action, userId);

    res.json({
      success: true,
      data: {
        id: comment.id,
        isHidden: comment.isHidden,
        isPinned: comment.isPinned,
      },
      message: 'Comment ' + action + ' action completed',
    });
  } catch (error: any) {
    log.error('Error moderating signal comment:', error);
    res.status(500).json({ success: false, error: 'Failed to moderate comment' });
  }
});

/**
 * @openapi
 * /api/signals/{signalId}/comments/count:
 *   get:
 *     summary: Get comment count for a signal
 *     tags: [Signal Comments]
 *     parameters:
 *       - in: path
 *         name: signalId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comment count
 */
router.get('/signals/:signalId/comments/count', async (req: Request, res: Response) => {
  try {
    const signalId = req.params.signalId as string;
    const count = await signalCommentsDAO.getCommentCount(signalId);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error: any) {
    log.error('Error getting signal comment count:', error);
    res.status(500).json({ success: false, error: 'Failed to get comment count' });
  }
});

export default router;