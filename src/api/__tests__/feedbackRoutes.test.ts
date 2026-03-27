/**
 * Tests for Feedback Routes
 */

import request from 'supertest';
import express, { Application } from 'express';
import { authMiddleware, requireAdmin } from '../authMiddleware';

// Mock dependencies
jest.mock('../../database/feedback.dao', () => {
  const mockInstance = {
    createFeedback: jest.fn(),
    getFeedbackById: jest.fn(),
    getFeedbacks: jest.fn(),
    updateFeedback: jest.fn(),
    deleteFeedback: jest.fn(),
    adminUpdateFeedback: jest.fn(),
    getStatusHistory: jest.fn(),
    getStatistics: jest.fn(),
    getHotTopics: jest.fn(),
    markAsReadByAdmin: jest.fn(),
    getUnreadCountForAdmin: jest.fn(),
    getUserFeedbackCount: jest.fn(),
  };
  
  return {
    FeedbackDAO: jest.fn(() => mockInstance),
    feedbackDAO: mockInstance,
  };
});

jest.mock('../authMiddleware');
jest.mock('../../notification/NotificationService', () => ({
  createSystemNotification: jest.fn().mockResolvedValue({}),
}));

const mockAuthMiddleware = authMiddleware as jest.MockedFunction<typeof authMiddleware>;
const mockRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;

// Import after mocking
import { feedbackDAO } from '../../database/feedback.dao';
import feedbackRoutes from '../feedbackRoutes';

const mockFeedbackDAO = feedbackDAO as jest.Mocked<typeof feedbackDAO>;

describe('Feedback Routes', () => {
  let app: Application;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create fresh app and routes for each test
    app = express();
    app.use(express.json());
    app.use('/api', feedbackRoutes);

    // Default auth middleware - authenticated user
    mockAuthMiddleware.mockImplementation((req: any, res: any, next: any) => {
      req.user = { id: 'user-1', email: 'test@example.com', role: 'user' };
      next();
    });

    mockRequireAdmin.mockImplementation((req: any, res: any, next: any) => {
      if (req.user?.role === 'admin') {
        next();
      } else {
        res.status(403).json({ success: false, error: 'Admin access required' });
      }
    });
  });

  describe('POST /api/feedback', () => {
    it('should create feedback successfully', async () => {
      const mockFeedback = {
        id: 'feedback-1',
        userId: 'user-1',
        type: 'feature_request',
        status: 'pending',
        title: 'New Feature',
        content: 'I would like a new feature',
        images: [],
        sentiment: 'positive',
        tags: ['feature'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFeedbackDAO.createFeedback.mockResolvedValue(mockFeedback as any);

      const response = await request(app)
        .post('/api/feedback')
        .send({
          type: 'feature_request',
          title: 'New Feature',
          content: 'I would like a new feature',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('feature_request');
      expect(mockFeedbackDAO.createFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: 'feature_request',
          title: 'New Feature',
          content: 'I would like a new feature',
        })
      );
    });

    it('should reject invalid feedback type', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .send({
          type: 'invalid_type',
          title: 'Test',
          content: 'Test content',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid feedback type');
    });

    it('should reject missing title', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .send({
          type: 'bug_report',
          content: 'Test content',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Title is required');
    });

    it('should reject missing content', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .send({
          type: 'bug_report',
          title: 'Test',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Content is required');
    });

    it('should reject title exceeding max length', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .send({
          type: 'bug_report',
          title: 'a'.repeat(201),
          content: 'Test content',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('200 characters');
    });

    it('should reject content exceeding max length', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .send({
          type: 'bug_report',
          title: 'Test',
          content: 'a'.repeat(5001),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('5000 characters');
    });

    it('should return 401 for unauthenticated user', async () => {
      mockAuthMiddleware.mockImplementation((req: any, res: any, next: any) => {
        req.user = undefined;
        next();
      });

      const response = await request(app)
        .post('/api/feedback')
        .send({
          type: 'bug_report',
          title: 'Test',
          content: 'Test content',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/feedback', () => {
    it('should return user feedbacks', async () => {
      const mockFeedbacks = [
        {
          id: 'feedback-1',
          userId: 'user-1',
          type: 'feature_request',
          status: 'pending',
          title: 'Feature 1',
          content: 'Content 1',
          images: [],
          tags: ['feature'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockFeedbackDAO.getFeedbacks.mockResolvedValue({
        feedbacks: mockFeedbacks,
        total: 1,
      });

      const response = await request(app).get('/api/feedback');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination.total).toBe(1);
    });

    it('should filter by type and status', async () => {
      mockFeedbackDAO.getFeedbacks.mockResolvedValue({
        feedbacks: [],
        total: 0,
      });

      await request(app)
        .get('/api/feedback')
        .query({ type: 'bug_report', status: 'pending' });

      expect(mockFeedbackDAO.getFeedbacks).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'bug_report',
          status: 'pending',
        })
      );
    });
  });

  describe('GET /api/feedback/:id', () => {
    it('should return feedback by ID', async () => {
      const mockFeedback = {
        id: 'feedback-1',
        userId: 'user-1',
        type: 'feature_request',
        status: 'pending',
        title: 'Feature',
        content: 'Content',
        images: [],
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFeedbackDAO.getFeedbackById.mockResolvedValue(mockFeedback as any);

      const response = await request(app).get('/api/feedback/feedback-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('feedback-1');
    });

    it('should return 404 for non-existent feedback', async () => {
      mockFeedbackDAO.getFeedbackById.mockResolvedValue(null);

      const response = await request(app).get('/api/feedback/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Feedback not found');
    });
  });

  describe('PUT /api/feedback/:id', () => {
    it('should update feedback successfully', async () => {
      const mockFeedback = {
        id: 'feedback-1',
        userId: 'user-1',
        title: 'Updated Title',
        content: 'Updated Content',
        images: [],
        sentiment: 'neutral',
        tags: [],
        updatedAt: new Date(),
      };

      mockFeedbackDAO.updateFeedback.mockResolvedValue(mockFeedback as any);

      const response = await request(app)
        .put('/api/feedback/feedback-1')
        .send({
          title: 'Updated Title',
          content: 'Updated Content',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Title');
    });

    it('should return 404 for non-existent feedback', async () => {
      mockFeedbackDAO.updateFeedback.mockRejectedValue(new Error('Feedback not found'));

      const response = await request(app)
        .put('/api/feedback/non-existent')
        .send({ title: 'Test' });

      expect(response.status).toBe(404);
    });

    it('should return 403 for unauthorized user', async () => {
      mockFeedbackDAO.updateFeedback.mockRejectedValue(
        new Error('Not authorized to update this feedback')
      );

      const response = await request(app)
        .put('/api/feedback/feedback-1')
        .send({ title: 'Test' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/feedback/:id', () => {
    it('should delete feedback successfully', async () => {
      mockFeedbackDAO.deleteFeedback.mockResolvedValue(undefined);

      const response = await request(app).delete('/api/feedback/feedback-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 for already processed feedback', async () => {
      mockFeedbackDAO.deleteFeedback.mockRejectedValue(
        new Error('Cannot delete feedback that is already being processed')
      );

      const response = await request(app).delete('/api/feedback/feedback-1');

      expect(response.status).toBe(400);
    });
  });

  describe('Admin Routes', () => {
    beforeEach(() => {
      mockAuthMiddleware.mockImplementation((req: any, res: any, next: any) => {
        req.user = { id: 'admin-1', email: 'admin@example.com', role: 'admin' };
        next();
      });
    });

    describe('GET /api/admin/feedback', () => {
      it('should return all feedbacks for admin', async () => {
        mockFeedbackDAO.getFeedbacks.mockResolvedValue({
          feedbacks: [],
          total: 0,
        });

        const response = await request(app).get('/api/admin/feedback');

        expect(response.status).toBe(200);
        expect(mockFeedbackDAO.getFeedbacks).toHaveBeenCalledWith(
          expect.objectContaining({
            isAdmin: true,
          })
        );
      });

      it('should return 403 for non-admin', async () => {
        mockAuthMiddleware.mockImplementation((req: any, res: any, next: any) => {
          req.user = { id: 'user-1', email: 'user@example.com', role: 'user' };
          next();
        });

        const response = await request(app).get('/api/admin/feedback');

        expect(response.status).toBe(403);
      });
    });

    describe('PUT /api/admin/feedback/:id', () => {
      it('should update feedback status', async () => {
        const mockFeedback = {
          id: 'feedback-1',
          userId: 'user-1',
          status: 'in_progress',
          updatedAt: new Date(),
        };

        mockFeedbackDAO.adminUpdateFeedback.mockResolvedValue(mockFeedback as any);

        const response = await request(app)
          .put('/api/admin/feedback/feedback-1')
          .send({ status: 'in_progress' });

        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe('in_progress');
      });

      it('should add admin reply', async () => {
        const mockFeedback = {
          id: 'feedback-1',
          userId: 'user-1',
          adminReply: 'Thank you for your feedback!',
          adminReplyAt: new Date(),
          updatedAt: new Date(),
        };

        mockFeedbackDAO.adminUpdateFeedback.mockResolvedValue(mockFeedback as any);

        const response = await request(app)
          .put('/api/admin/feedback/feedback-1')
          .send({ adminReply: 'Thank you for your feedback!' });

        expect(response.status).toBe(200);
        expect(response.body.data.adminReply).toBe('Thank you for your feedback!');
      });

      it('should reject invalid status', async () => {
        const response = await request(app)
          .put('/api/admin/feedback/feedback-1')
          .send({ status: 'invalid_status' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid status');
      });
    });

    describe('GET /api/admin/feedback/stats', () => {
      it('should return feedback statistics', async () => {
        const mockStats = {
          totalFeedback: 100,
          pendingCount: 20,
          inProgressCount: 30,
          resolvedCount: 40,
          closedCount: 10,
        };

        mockFeedbackDAO.getStatistics.mockResolvedValue(mockStats as any);
        mockFeedbackDAO.getUnreadCountForAdmin.mockResolvedValue(5);

        const response = await request(app).get('/api/admin/feedback/stats');

        expect(response.status).toBe(200);
        expect(response.body.data.totalFeedback).toBe(100);
        expect(response.body.data.unreadCount).toBe(5);
      });
    });

    describe('GET /api/admin/feedback/hot-topics', () => {
      it('should return hot topics', async () => {
        const mockTopics = [
          { tag: 'trading', occurrenceCount: 50, recentCount: 10 },
          { tag: 'ui', occurrenceCount: 40, recentCount: 8 },
        ];

        mockFeedbackDAO.getHotTopics.mockResolvedValue(mockTopics as any);

        const response = await request(app).get('/api/admin/feedback/hot-topics');

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.data[0].tag).toBe('trading');
      });
    });

    describe('POST /api/admin/feedback/:id/read', () => {
      it('should mark feedback as read', async () => {
        mockFeedbackDAO.markAsReadByAdmin.mockResolvedValue(undefined);

        const response = await request(app).post('/api/admin/feedback/feedback-1/read');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });
});