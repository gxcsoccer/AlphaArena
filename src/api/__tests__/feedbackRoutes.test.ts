/**
 * Tests for Feedback API Routes
 * 
 * Note: These tests mock the database module
 */

import request from 'supertest';
import express, { Application } from 'express';

// Mock the database module
jest.mock('../../database', () => ({
  feedbackDAO: {
    createFeedback: jest.fn().mockResolvedValue({
      id: 'fb_test_123',
      type: 'bug',
      description: 'Test bug',
      status: 'new',
      created_at: new Date().toISOString(),
    }),
    getFeedbacks: jest.fn().mockResolvedValue([]),
    getFeedbackById: jest.fn().mockImplementation((id: string) => {
      // Return null for non-existent IDs
      if (id === 'non-existent-id') {
        return Promise.resolve(null);
      }
      return Promise.resolve({
        id: id,
        type: 'bug',
        description: 'Test bug',
        status: 'new',
        created_at: new Date().toISOString(),
      });
    }),
    updateFeedback: jest.fn().mockResolvedValue({
      id: 'fb_test_123',
      status: 'in_progress',
    }),
    deleteFeedback: jest.fn().mockResolvedValue(undefined),
    getFeedbackStats: jest.fn().mockResolvedValue({
      total: 0,
      byType: { bug: 0, suggestion: 0, other: 0 },
      byStatus: { new: 0, in_progress: 0, resolved: 0, closed: 0 },
    }),
  },
  FeedbackType: { BUG: 'bug', SUGGESTION: 'suggestion', OTHER: 'other' },
  FeedbackStatus: { NEW: 'new', IN_PROGRESS: 'in_progress', RESOLVED: 'resolved', CLOSED: 'closed' },
}));

// Import after mock
import { createFeedbackRouter } from '../feedbackRoutes';

describe('Feedback Routes', () => {
  let app: Application;

  beforeAll(() => {
    // Polyfill setImmediate for Express 5 compatibility
    if (typeof setImmediate === 'undefined') {
      global.setImmediate = (fn: (...args: any[]) => void) => setTimeout(fn, 0) as unknown as NodeJS.Immediate;
    }
  });

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/feedback', createFeedbackRouter());
  });

  describe('POST /api/feedback', () => {
    it('should submit feedback successfully', async () => {
      const feedbackData = {
        type: 'bug',
        description: 'Test bug report with enough characters',
      };

      const response = await request(app)
        .post('/api/feedback')
        .send(feedbackData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.message).toBe('Feedback submitted successfully');
    });

    it('should reject invalid feedback type', async () => {
      const feedbackData = {
        type: 'invalid_type',
        description: 'Test description',
      };

      const response = await request(app)
        .post('/api/feedback')
        .send(feedbackData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid feedback type');
    });

    it('should reject missing description', async () => {
      const feedbackData = {
        type: 'bug',
      };

      const response = await request(app)
        .post('/api/feedback')
        .send(feedbackData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Description is required');
    });

    it('should reject short description', async () => {
      const feedbackData = {
        type: 'bug',
        description: 'abc',
      };

      const response = await request(app)
        .post('/api/feedback')
        .send(feedbackData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('at least 5 characters');
    });

    it('should accept suggestion type', async () => {
      const feedbackData = {
        type: 'suggestion',
        description: 'I have a great suggestion for you',
      };

      const response = await request(app)
        .post('/api/feedback')
        .send(feedbackData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should accept other type', async () => {
      const feedbackData = {
        type: 'other',
        description: 'Some other feedback here',
      };

      const response = await request(app)
        .post('/api/feedback')
        .send(feedbackData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/feedback', () => {
    it('should list feedbacks', async () => {
      const response = await request(app)
        .get('/api/feedback');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/feedback')
        .query({ limit: 10, offset: 0 });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/feedback/:id', () => {
    it('should return 404 for non-existent feedback', async () => {
      const response = await request(app)
        .get('/api/feedback/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/feedback/:id/status', () => {
    it('should reject invalid status', async () => {
      const response = await request(app)
        .patch('/api/feedback/fb_test_123/status')
        .send({ status: 'invalid_status' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/feedback/stats', () => {
    it('should return feedback statistics', async () => {
      const response = await request(app)
        .get('/api/feedback/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('byType');
      expect(response.body.data).toHaveProperty('byStatus');
    });
  });
});