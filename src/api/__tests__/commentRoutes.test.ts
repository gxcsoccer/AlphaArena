/**
 * Tests for Comment Routes
 */

import request from 'supertest';
import express from 'express';
import commentRoutes from '../commentRoutes';

// Mock CommentsDAO
jest.mock('../../database/comments.dao', () => {
  const mockCommentsDAO = {
    createComment: jest.fn(),
    getCommentById: jest.fn(),
    getComments: jest.fn(),
    getReplies: jest.fn(),
    updateComment: jest.fn(),
    deleteComment: jest.fn(),
    likeComment: jest.fn(),
    unlikeComment: jest.fn(),
    toggleLike: jest.fn(),
    getCommentLikes: jest.fn(),
    reportComment: jest.fn(),
    getReports: jest.fn(),
    moderateComment: jest.fn(),
    getCommentCount: jest.fn(),
    isUserLikedComment: jest.fn(),
  };

  return {
    CommentsDAO: jest.fn(() => mockCommentsDAO),
  };
});

// Mock auth middleware - with admin role for admin tests
jest.mock('../authMiddleware', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    // Set admin role for admin endpoints
    const isAdminEndpoint = req.path.includes('/admin/');
    req.user = { 
      id: 'test-user-id', 
      email: 'test@example.com',
      role: isAdminEndpoint ? 'admin' : 'user'
    };
    next();
  },
  optionalAuthMiddleware: (req: any, res: any, next: any) => {
    if (req.headers.authorization) {
      req.user = { id: 'test-user-id', email: 'test@example.com', role: 'user' };
    }
    next();
  },
}));

const app = express();
app.use(express.json());
app.use('/api', commentRoutes);

describe('Comment Routes', () => {
  let mockDAO: any;

  beforeEach(() => {
    jest.clearAllMocks();
    const { CommentsDAO } = require('../../database/comments.dao');
    mockDAO = new CommentsDAO();
  });

  describe('GET /api/templates/:templateId/comments', () => {
    it('should return comments for a template', async () => {
      mockDAO.getComments.mockResolvedValue({
        comments: [
          {
            id: 'comment-1',
            strategyId: 'template-1',
            userId: 'user-1',
            content: 'Great strategy!',
            contentHtml: '<p>Great strategy!</p>',
            likesCount: 5,
            repliesCount: 2,
            isEdited: false,
            isPinned: false,
            isDeleted: false,
            isHidden: false,
            reportedCount: 0,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
            username: 'john_doe',
            displayName: 'John Doe',
            avatarUrl: 'https://example.com/avatar.png',
          },
        ],
        total: 1,
      });

      const response = await request(app)
        .get('/api/templates/template-1/comments')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].content).toBe('Great strategy!');
    });

    it('should return empty array when no comments', async () => {
      mockDAO.getComments.mockResolvedValue({
        comments: [],
        total: 0,
      });

      const response = await request(app)
        .get('/api/templates/template-1/comments');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });

    it('should support sorting options', async () => {
      mockDAO.getComments.mockResolvedValue({
        comments: [],
        total: 0,
      });

      await request(app)
        .get('/api/templates/template-1/comments?sort=likes');

      expect(mockDAO.getComments).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: 'likes' })
      );
    });
  });

  describe('POST /api/templates/:templateId/comments', () => {
    it('should create a new comment', async () => {
      mockDAO.createComment.mockResolvedValue({
        id: 'comment-1',
        strategyId: 'template-1',
        userId: 'test-user-id',
        content: 'Nice strategy!',
        contentHtml: '<p>Nice strategy!</p>',
        likesCount: 0,
        repliesCount: 0,
        isEdited: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      });

      const response = await request(app)
        .post('/api/templates/template-1/comments')
        .set('Authorization', 'Bearer test-token')
        .send({ content: 'Nice strategy!' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe('Nice strategy!');
    });

    it('should reject empty content', async () => {
      const response = await request(app)
        .post('/api/templates/template-1/comments')
        .set('Authorization', 'Bearer test-token')
        .send({ content: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Comment content is required');
    });

    it('should reject content over 5000 characters', async () => {
      const longContent = 'a'.repeat(5001);

      const response = await request(app)
        .post('/api/templates/template-1/comments')
        .set('Authorization', 'Bearer test-token')
        .send({ content: longContent });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('5000 characters');
    });
  });

  describe('GET /api/comments/:commentId', () => {
    it('should return a single comment', async () => {
      mockDAO.getCommentById.mockResolvedValue({
        id: 'comment-1',
        strategyId: 'template-1',
        userId: 'user-1',
        content: 'Test comment',
        contentHtml: '<p>Test comment</p>',
        likesCount: 3,
        repliesCount: 1,
        isEdited: false,
        isDeleted: false,
        isPinned: false,
        isHidden: false,
        reportedCount: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        username: 'testuser',
        displayName: 'Test User',
        avatarUrl: null,
      });

      const response = await request(app)
        .get('/api/comments/comment-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('comment-1');
    });

    it('should return 404 for non-existent comment', async () => {
      mockDAO.getCommentById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/comments/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Comment not found');
    });
  });

  describe('PUT /api/comments/:commentId', () => {
    it('should update a comment', async () => {
      mockDAO.updateComment.mockResolvedValue({
        id: 'comment-1',
        content: 'Updated content',
        contentHtml: '<p>Updated content</p>',
        isEdited: true,
        updatedAt: new Date('2024-01-02'),
      });

      const response = await request(app)
        .put('/api/comments/comment-1')
        .set('Authorization', 'Bearer test-token')
        .send({ content: 'Updated content' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isEdited).toBe(true);
    });

    it('should reject empty content on update', async () => {
      const response = await request(app)
        .put('/api/comments/comment-1')
        .set('Authorization', 'Bearer test-token')
        .send({ content: '' });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/comments/:commentId', () => {
    it('should soft delete a comment', async () => {
      mockDAO.deleteComment.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/comments/comment-1')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Comment deleted successfully');
    });
  });

  describe('GET /api/comments/:commentId/replies', () => {
    it('should return replies for a comment', async () => {
      mockDAO.getReplies.mockResolvedValue({
        replies: [
          {
            id: 'reply-1',
            strategyId: 'template-1',
            userId: 'user-2',
            parentId: 'comment-1',
            content: 'I agree!',
            contentHtml: '<p>I agree!</p>',
            likesCount: 2,
            repliesCount: 0,
            isEdited: false,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
            username: 'jane_doe',
            displayName: 'Jane Doe',
            avatarUrl: null,
          },
        ],
        total: 1,
      });

      const response = await request(app)
        .get('/api/comments/comment-1/replies');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('POST /api/comments/:commentId/like', () => {
    it('should like a comment', async () => {
      mockDAO.likeComment.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/comments/comment-1/like')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/comments/:commentId/like', () => {
    it('should unlike a comment', async () => {
      mockDAO.unlikeComment.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/comments/comment-1/like')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/comments/:commentId/toggle-like', () => {
    it('should toggle like on a comment', async () => {
      mockDAO.toggleLike.mockResolvedValue({ liked: true });

      const response = await request(app)
        .post('/api/comments/comment-1/toggle-like')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.data.liked).toBe(true);
    });
  });

  describe('GET /api/comments/:commentId/likes', () => {
    it('should return users who liked a comment', async () => {
      mockDAO.getCommentLikes.mockResolvedValue({
        users: [
          { id: 'user-1', username: 'john', displayName: 'John' },
          { id: 'user-2', username: 'jane', displayName: 'Jane' },
        ],
        total: 2,
      });

      const response = await request(app)
        .get('/api/comments/comment-1/likes');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/comments/:commentId/report', () => {
    it('should report a comment', async () => {
      mockDAO.reportComment.mockResolvedValue({
        id: 'report-1',
        commentId: 'comment-1',
        reporterId: 'test-user-id',
        reason: 'spam',
        status: 'pending',
        createdAt: new Date('2024-01-01'),
      });

      const response = await request(app)
        .post('/api/comments/comment-1/report')
        .set('Authorization', 'Bearer test-token')
        .send({ reason: 'spam', description: 'This is spam' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.reason).toBe('spam');
    });

    it('should reject invalid report reason', async () => {
      const response = await request(app)
        .post('/api/comments/comment-1/report')
        .set('Authorization', 'Bearer test-token')
        .send({ reason: 'invalid_reason' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid report reason');
    });
  });

  describe('Admin endpoints', () => {
    describe('GET /api/admin/comments/reports', () => {
      it('should return reports for admin', async () => {
        mockDAO.getReports.mockResolvedValue({
          reports: [
            {
              id: 'report-1',
              commentId: 'comment-1',
              reporterId: 'user-1',
              reason: 'spam',
              status: 'pending',
              createdAt: new Date('2024-01-01'),
            },
          ],
          total: 1,
        });

        const response = await request(app)
          .get('/api/admin/comments/reports')
          .set('Authorization', 'Bearer test-token');

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
      });
    });

    describe('POST /api/admin/comments/:commentId/moderate', () => {
      it('should moderate a comment', async () => {
        mockDAO.moderateComment.mockResolvedValue({
          id: 'comment-1',
          isHidden: true,
          isPinned: false,
        });

        const response = await request(app)
          .post('/api/admin/comments/comment-1/moderate')
          .set('Authorization', 'Bearer test-token')
          .send({ action: 'hide' });

        expect(response.status).toBe(200);
        expect(response.body.data.isHidden).toBe(true);
      });

      it('should reject invalid action', async () => {
        const response = await request(app)
          .post('/api/admin/comments/comment-1/moderate')
          .set('Authorization', 'Bearer test-token')
          .send({ action: 'invalid' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid action');
      });
    });
  });
});
