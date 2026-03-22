/**
 * Tests for Feedback DAO
 */

import { feedbackDAO, FeedbackType, FeedbackStatus } from '../feedback.dao';

// Mock Supabase client
jest.mock('../client', () => ({
  getSupabaseAdminClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: {
              id: 'fb_test_123',
              user_id: 'user_123',
              type: 'bug',
              description: 'Test bug description',
              status: 'new',
              environment: {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          })),
        })),
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: {
              id: 'fb_test_123',
              type: 'bug',
              description: 'Test feedback',
              status: 'new',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          })),
        })),
        order: jest.fn(() => ({
          range: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => Promise.resolve({
                data: [],
                error: null,
              })),
            })),
          })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: {
                id: 'fb_test_123',
                status: 'resolved',
                updated_at: new Date().toISOString(),
              },
              error: null,
            })),
          })),
        })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  })),
}));

describe('FeedbackDAO', () => {
  describe('createFeedback', () => {
    it('should create a feedback successfully', async () => {
      const input = {
        type: FeedbackType.BUG,
        description: 'Test bug description',
        environment: {
          url: 'https://example.com',
          userAgent: 'Mozilla/5.0',
          screenSize: '1920x1080',
          timestamp: new Date().toISOString(),
          locale: 'en-US',
          referrer: 'https://google.com',
        },
      };

      const feedback = await feedbackDAO.createFeedback(input);

      expect(feedback).toBeDefined();
      expect(feedback.type).toBe(FeedbackType.BUG);
      expect(feedback.description).toBe('Test bug description');
      expect(feedback.status).toBe(FeedbackStatus.NEW);
    });

    it('should create feedback with optional fields', async () => {
      const input = {
        userId: 'user_123',
        type: FeedbackType.SUGGESTION,
        description: 'Feature suggestion',
        screenshot: 'data:image/png;base64,test',
        screenshotName: 'screenshot.png',
        contactInfo: 'user@example.com',
        environment: {
          url: 'https://example.com',
          userAgent: 'Mozilla/5.0',
          screenSize: '1920x1080',
          timestamp: new Date().toISOString(),
          locale: 'en-US',
          referrer: '',
        },
      };

      const feedback = await feedbackDAO.createFeedback(input);

      expect(feedback).toBeDefined();
      expect(feedback.userId).toBe('user_123');
      expect(feedback.type).toBe(FeedbackType.SUGGESTION);
    });
  });

  describe('getFeedbackById', () => {
    it('should get feedback by id', async () => {
      const feedback = await feedbackDAO.getFeedbackById('fb_test_123');

      expect(feedback).toBeDefined();
      expect(feedback?.id).toBe('fb_test_123');
    });

    it('should return null for non-existent feedback', async () => {
      // Mock returns null for this test
      const { getSupabaseAdminClient } = require('../client');
      getSupabaseAdminClient().from().select().eq().single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const feedback = await feedbackDAO.getFeedbackById('non_existent');

      expect(feedback).toBeNull();
    });
  });

  describe('getFeedbacks', () => {
    it('should get feedbacks with filters', async () => {
      const feedbacks = await feedbackDAO.getFeedbacks({
        status: FeedbackStatus.NEW,
        type: FeedbackType.BUG,
        limit: 10,
        offset: 0,
      });

      expect(Array.isArray(feedbacks)).toBe(true);
    });
  });

  describe('updateFeedback', () => {
    it('should update feedback status', async () => {
      const feedback = await feedbackDAO.updateFeedback('fb_test_123', {
        status: FeedbackStatus.RESOLVED,
        adminNotes: 'Fixed in v1.0.0',
      });

      expect(feedback).toBeDefined();
      expect(feedback.status).toBe(FeedbackStatus.RESOLVED);
    });
  });

  describe('deleteFeedback', () => {
    it('should delete feedback successfully', async () => {
      await expect(feedbackDAO.deleteFeedback('fb_test_123')).resolves.not.toThrow();
    });
  });

  describe('getFeedbackStats', () => {
    it('should return feedback statistics', async () => {
      const { getSupabaseAdminClient } = require('../client');
      getSupabaseAdminClient().from().select.mockResolvedValueOnce({
        data: [
          { type: 'bug', status: 'new' },
          { type: 'suggestion', status: 'resolved' },
          { type: 'bug', status: 'in_progress' },
        ],
        error: null,
      });

      const stats = await feedbackDAO.getFeedbackStats();

      expect(stats).toBeDefined();
      expect(stats.total).toBe(3);
      expect(stats.byType[FeedbackType.BUG]).toBe(2);
      expect(stats.byType[FeedbackType.SUGGESTION]).toBe(1);
    });
  });
});