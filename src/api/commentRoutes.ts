/**
 * Comment Routes - Strategy Comments and Discussion System
 */

import { Router, Request, Response } from 'express';
import { CommentsDAO, StrategyComment, CommentReport } from '../database/comments.dao';
import { authMiddleware, optionalAuthMiddleware, requireAdmin } from './authMiddleware';
import { createLogger } from '../utils/logger';

const log = createLogger('CommentRoutes');
const router = Router();
const commentsDAO = new CommentsDAO();

// Helper to get string from query
const getStringParam = (value: any): string | undefined => {
  if (Array.isArray(value)) return value[0];
  return value;
};
// ============ Comment Routes ============

router.get('/templates/:templateId/comments', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const templateId = req.params.templateId as string;
    const sortBy = getStringParam(req.query.sort) as 'newest' | 'oldest' | 'likes' || 'newest';
    const limit = parseInt(getStringParam(req.query.limit) || '20', 10);
    const offset = parseInt(getStringParam(req.query.offset) || '0', 10);
    const currentUserId = req.user?.id;

    const { comments, total } = await commentsDAO.getComments({
      strategyId: templateId,
      sortBy,
      limit,
      offset,
      currentUserId,
    });

    res.json({
      success: true,
      data: comments.map((c: StrategyComment) => ({
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
    log.error('Error fetching comments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch comments' });
  }
});

router.post('/templates/:templateId/comments', authMiddleware, async (req: Request, res: Response) => {
  try {
    const templateId = req.params.templateId as string;
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

    const comment = await commentsDAO.createComment({
      strategyId: templateId,
      userId,
      parentId,
      content: content.trim(),
    });

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
    log.error('Error creating comment:', error);
    res.status(500).json({ success: false, error: 'Failed to create comment' });
  }
});

router.get('/comments/:commentId', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const commentId = req.params.commentId as string;
    const currentUserId = req.user?.id;

    const comment = await commentsDAO.getCommentById(commentId, currentUserId);

    if (!comment || comment.isDeleted) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    res.json({
      success: true,
      data: {
        id: comment.id,
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
    log.error('Error fetching comment:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch comment' });
  }
});

router.put('/comments/:commentId', authMiddleware, async (req: Request, res: Response) => {
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

    const comment = await commentsDAO.updateComment(commentId, userId, { content: content.trim() });

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
    log.error('Error updating comment:', error);
    if (error.message === 'Comment not found') {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }
    if (error.message === 'Not authorized to update this comment') {
      return res.status(403).json({ success: false, error: 'Not authorized to update this comment' });
    }
    res.status(500).json({ success: false, error: 'Failed to update comment' });
  }
});

router.delete('/comments/:commentId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const commentId = req.params.commentId as string;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    await commentsDAO.deleteComment(commentId, userId);

    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error: any) {
    log.error('Error deleting comment:', error);
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

router.get('/comments/:commentId/replies', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const commentId = req.params.commentId as string;
    const limit = parseInt(getStringParam(req.query.limit) || '10', 10);
    const offset = parseInt(getStringParam(req.query.offset) || '0', 10);
    const currentUserId = req.user?.id;

    const { replies, total } = await commentsDAO.getReplies(commentId, { limit, offset, currentUserId });

    res.json({
      success: true,
      data: replies.map((r: StrategyComment) => ({
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
    log.error('Error fetching replies:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch replies' });
  }
});

router.post('/comments/:commentId/replies', authMiddleware, async (req: Request, res: Response) => {
  try {
    const parentId = req.params.commentId as string;
    const userId = req.user?.id;
    const { content } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Reply content is required' });
    }

    const parentComment = await commentsDAO.getCommentById(parentId);
    if (!parentComment) {
      return res.status(404).json({ success: false, error: 'Parent comment not found' });
    }

    const reply = await commentsDAO.createComment({
      strategyId: parentComment.strategyId,
      userId,
      parentId,
      content: content.trim(),
    });

    res.status(201).json({
      success: true,
      data: {
        id: reply.id,
        content: reply.content,
        contentHtml: reply.contentHtml,
        likesCount: reply.likesCount,
        createdAt: reply.createdAt,
        parentId: reply.parentId,
        user: { id: userId, email: req.user?.email || 'unknown' },
      },
    });
  } catch (error: any) {
    log.error('Error creating reply:', error);
    res.status(500).json({ success: false, error: 'Failed to create reply' });
  }
});

// ============ Like Routes ============

router.post('/comments/:commentId/like', authMiddleware, async (req: Request, res: Response) => {
  try {
    const commentId = req.params.commentId as string;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    await commentsDAO.likeComment(commentId, userId);

    res.json({ success: true, message: 'Comment liked successfully' });
  } catch (error: any) {
    log.error('Error liking comment:', error);
    if (error.message === 'Already liked this comment') {
      return res.status(400).json({ success: false, error: 'Already liked this comment' });
    }
    res.status(500).json({ success: false, error: 'Failed to like comment' });
  }
});

router.delete('/comments/:commentId/like', authMiddleware, async (req: Request, res: Response) => {
  try {
    const commentId = req.params.commentId as string;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    await commentsDAO.unlikeComment(commentId, userId);

    res.json({ success: true, message: 'Comment unliked successfully' });
  } catch (error: any) {
    log.error('Error unliking comment:', error);
    res.status(500).json({ success: false, error: 'Failed to unlike comment' });
  }
});

router.post('/comments/:commentId/toggle-like', authMiddleware, async (req: Request, res: Response) => {
  try {
    const commentId = req.params.commentId as string;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { liked } = await commentsDAO.toggleLike(commentId, userId);

    res.json({
      success: true,
      data: { liked },
      message: liked ? 'Comment liked successfully' : 'Comment unliked successfully',
    });
  } catch (error: any) {
    log.error('Error toggling like:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle like' });
  }
});

router.get('/comments/:commentId/likes', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const commentId = req.params.commentId as string;
    const limit = parseInt(getStringParam(req.query.limit) || '50', 10);
    const offset = parseInt(getStringParam(req.query.offset) || '0', 10);

    const { users, total } = await commentsDAO.getCommentLikes(commentId, limit, offset);

    res.json({
      success: true,
      data: users,
      pagination: { limit, offset, total, hasMore: offset + limit < total },
    });
  } catch (error: any) {
    log.error('Error fetching likes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch likes' });
  }
});

// ============ Report Routes ============

router.post('/comments/:commentId/report', authMiddleware, async (req: Request, res: Response) => {
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

    const report = await commentsDAO.reportComment(commentId, userId, reason, description);

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
    log.error('Error reporting comment:', error);
    if (error.message === 'Already reported this comment') {
      return res.status(400).json({ success: false, error: 'Already reported this comment' });
    }
    res.status(500).json({ success: false, error: 'Failed to report comment' });
  }
});

// ============ Admin Moderation Routes ============
// All admin routes require authentication AND admin role

router.get('/admin/comments/reports', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const status = getStringParam(req.query.status) as CommentReport['status'] | undefined;
    const limit = parseInt(getStringParam(req.query.limit) || '50', 10);
    const offset = parseInt(getStringParam(req.query.offset) || '0', 10);

    const { reports, total } = await commentsDAO.getReports(status, limit, offset);

    res.json({
      success: true,
      data: reports,
      pagination: { limit, offset, total, hasMore: offset + limit < total },
    });
  } catch (error: any) {
    log.error('Error fetching reports:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch reports' });
  }
});

router.post('/admin/comments/:commentId/moderate', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
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

    const comment = await commentsDAO.moderateComment(commentId, action, userId);

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
    log.error('Error moderating comment:', error);
    res.status(500).json({ success: false, error: 'Failed to moderate comment' });
  }
});

export default router;
