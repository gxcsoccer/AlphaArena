/**
 * Tests for Feedback API Routes
 */

import request from 'supertest';
import express from 'express';
import { createFeedbackRouter, FeedbackStatus, FeedbackType } from '../feedbackRoutes';

// Mock Supabase - must be at the top level
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

// Import after mocking to ensure mock is applied

describe('Feedback Routes', () => {
  let app: express.Application;

  // Create fresh app for each test to avoid state leakage
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
        environment: {
          url: 'https://example.com/test',
          userAgent: 'Mozilla/5.0',
          screenSize: '1920x1080',
          timestamp: new Date().toISOString(),
          locale: 'en-US',
          referrer: 'https://google.com',
        },
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
        description: 'abc', // Less than 5 characters
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

    it('should accept optional screenshot', async () => {
      const feedbackData = {
        type: 'bug',
        description: 'Bug with screenshot attached',
        screenshot: 'data:image/png;base64,testbase64string',
        screenshotName: 'screenshot.png',
      };

      const response = await request(app)
        .post('/api/feedback')
        .send(feedbackData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should accept optional contact info', async () => {
      const feedbackData = {
        type: 'suggestion',
        description: 'Please contact me about this suggestion',
        contactInfo: 'user@example.com',
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
      // First submit a feedback
      await request(app)
        .post('/api/feedback')
        .send({
          type: 'bug',
          description: 'Test bug for listing',
        });

      const response = await request(app)
        .get('/api/feedback');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/feedback')
        .query({ status: 'new' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should filter by type', async () => {
      const response = await request(app)
        .get('/api/feedback')
        .query({ type: 'bug' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/feedback')
        .query({ limit: 10, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body.limit).toBe(10);
      expect(response.body.offset).toBe(0);
    });
  });

  describe('GET /api/feedback/:id', () => {
    it('should get specific feedback', async () => {
      // First submit a feedback
      const submitResponse = await request(app)
        .post('/api/feedback')
        .send({
          type: 'bug',
          description: 'Test bug for retrieval',
        });

      const feedbackId = submitResponse.body.data.id;

      const response = await request(app)
        .get(`/api/feedback/${feedbackId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(feedbackId);
      expect(response.body.data.type).toBe('bug');
    });

    it('should return 404 for non-existent feedback', async () => {
      const response = await request(app)
        .get('/api/feedback/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/feedback/:id/status', () => {
    it('should update feedback status', async () => {
      // First submit a feedback
      const submitResponse = await request(app)
        .post('/api/feedback')
        .send({
          type: 'bug',
          description: 'Test bug for status update',
        });

      const feedbackId = submitResponse.body.data.id;

      const response = await request(app)
        .patch(`/api/feedback/${feedbackId}/status`)
        .send({ status: 'in_progress' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('in_progress');
    });

    it('should reject invalid status', async () => {
      // First submit a feedback
      const submitResponse = await request(app)
        .post('/api/feedback')
        .send({
          type: 'bug',
          description: 'Test bug for invalid status',
        });

      const feedbackId = submitResponse.body.data.id;

      const response = await request(app)
        .patch(`/api/feedback/${feedbackId}/status`)
        .send({ status: 'invalid_status' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should accept admin notes', async () => {
      // First submit a feedback
      const submitResponse = await request(app)
        .post('/api/feedback')
        .send({
          type: 'bug',
          description: 'Test bug with admin notes',
        });

      const feedbackId = submitResponse.body.data.id;

      const response = await request(app)
        .patch(`/api/feedback/${feedbackId}/status`)
        .send({ 
          status: 'resolved',
          adminNotes: 'Fixed in v1.2.3',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.admin_notes).toBe('Fixed in v1.2.3');
    });

    it('should accept tags', async () => {
      // First submit a feedback
      const submitResponse = await request(app)
        .post('/api/feedback')
        .send({
          type: 'bug',
          description: 'Test bug with tags',
        });

      const feedbackId = submitResponse.body.data.id;

      const response = await request(app)
        .patch(`/api/feedback/${feedbackId}/status`)
        .send({ 
          status: 'new',
          tags: ['ui', 'critical'],
        });

      expect(response.status).toBe(200);
      expect(response.body.data.tags).toEqual(['ui', 'critical']);
    });
  });

  describe('GET /api/feedback/stats/summary', () => {
    it('should return feedback statistics', async () => {
      // Submit multiple feedbacks
      await request(app)
        .post('/api/feedback')
        .send({ type: 'bug', description: 'Bug report one' });
      
      await request(app)
        .post('/api/feedback')
        .send({ type: 'suggestion', description: 'Feature suggestion' });
      
      await request(app)
        .post('/api/feedback')
        .send({ type: 'bug', description: 'Another bug report' });

      const response = await request(app)
        .get('/api/feedback/stats/summary');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBeGreaterThanOrEqual(3);
      expect(response.body.data.byType.bug).toBeGreaterThanOrEqual(2);
      expect(response.body.data.byType.suggestion).toBeGreaterThanOrEqual(1);
      expect(response.body.data.byStatus.new).toBeGreaterThanOrEqual(3);
    });
  });
});