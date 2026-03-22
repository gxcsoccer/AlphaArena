/**
 * Tests for Feedback DAO
 * 
 * Uses the global Supabase mock from tests/__mocks__/supabase.ts
 */

import { feedbackDAO, FeedbackType, FeedbackStatus } from '../feedback.dao';
import { seedMockData, clearMockData } from '../../../tests/__mocks__/supabase';

describe('FeedbackDAO', () => {
  beforeEach(() => {
    clearMockData();
  });

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
    it('should return feedback when found', async () => {
      // Seed the mock database
      seedMockData('feedbacks', [
        {
          id: 'fb_test_123',
          user_id: null,
          type: 'bug',
          description: 'Test feedback',
          screenshot: null,
          screenshot_name: null,
          contact_info: null,
          environment: {},
          status: 'new',
          tags: [],
          admin_notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      const feedback = await feedbackDAO.getFeedbackById('fb_test_123');

      expect(feedback).toBeDefined();
      expect(feedback?.id).toBe('fb_test_123');
      expect(feedback?.type).toBe(FeedbackType.BUG);
    });

    it('should return null for non-existent feedback', async () => {
      const feedback = await feedbackDAO.getFeedbackById('non_existent');

      expect(feedback).toBeNull();
    });
  });

  describe('getFeedbacks', () => {
    it('should get feedbacks with filters', async () => {
      // Seed the mock database
      seedMockData('feedbacks', [
        {
          id: 'fb_1',
          user_id: null,
          type: 'bug',
          description: 'Bug 1',
          screenshot: null,
          screenshot_name: null,
          contact_info: null,
          environment: {},
          status: 'new',
          tags: [],
          admin_notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'fb_2',
          user_id: null,
          type: 'bug',
          description: 'Bug 2',
          screenshot: null,
          screenshot_name: null,
          contact_info: null,
          environment: {},
          status: 'in_progress',
          tags: [],
          admin_notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      const feedbacks = await feedbackDAO.getFeedbacks({
        status: FeedbackStatus.NEW,
        type: FeedbackType.BUG,
        limit: 10,
        offset: 0,
      });

      expect(Array.isArray(feedbacks)).toBe(true);
      // The mock should return 1 feedback with status 'new' and type 'bug'
      expect(feedbacks.length).toBe(1);
      expect(feedbacks[0].id).toBe('fb_1');
    });

    it('should return empty array when no feedbacks', async () => {
      const feedbacks = await feedbackDAO.getFeedbacks();

      expect(Array.isArray(feedbacks)).toBe(true);
      expect(feedbacks.length).toBe(0);
    });
  });

  describe('updateFeedback', () => {
    it('should update feedback and return updated object', async () => {
      // Seed the mock database
      seedMockData('feedbacks', [
        {
          id: 'fb_test_123',
          user_id: null,
          type: 'bug',
          description: 'Test bug',
          screenshot: null,
          screenshot_name: null,
          contact_info: null,
          environment: {},
          status: 'new',
          tags: [],
          admin_notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      const feedback = await feedbackDAO.updateFeedback('fb_test_123', {
        status: FeedbackStatus.RESOLVED,
        adminNotes: 'Fixed in v1.0.0',
      });

      expect(feedback).toBeDefined();
      expect(feedback.status).toBe(FeedbackStatus.RESOLVED);
      expect(feedback.adminNotes).toBe('Fixed in v1.0.0');
    });
  });

  describe('deleteFeedback', () => {
    it('should delete feedback successfully', async () => {
      // Seed the mock database
      seedMockData('feedbacks', [
        {
          id: 'fb_test_123',
          user_id: null,
          type: 'bug',
          description: 'Test bug',
          screenshot: null,
          screenshot_name: null,
          contact_info: null,
          environment: {},
          status: 'new',
          tags: [],
          admin_notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      await expect(feedbackDAO.deleteFeedback('fb_test_123')).resolves.not.toThrow();
    });
  });

  describe('getFeedbackStats', () => {
    it('should calculate correct statistics', async () => {
      // Seed the mock database
      seedMockData('feedbacks', [
        {
          id: 'fb_1',
          type: 'bug',
          status: 'new',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'fb_2',
          type: 'suggestion',
          status: 'resolved',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'fb_3',
          type: 'bug',
          status: 'in_progress',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      const stats = await feedbackDAO.getFeedbackStats();

      expect(stats).toBeDefined();
      expect(stats.total).toBe(3);
      expect(stats.byType[FeedbackType.BUG]).toBe(2);
      expect(stats.byType[FeedbackType.SUGGESTION]).toBe(1);
      expect(stats.byType[FeedbackType.OTHER]).toBe(0);
      expect(stats.byStatus[FeedbackStatus.NEW]).toBe(1);
      expect(stats.byStatus[FeedbackStatus.IN_PROGRESS]).toBe(1);
      expect(stats.byStatus[FeedbackStatus.RESOLVED]).toBe(1);
      expect(stats.byStatus[FeedbackStatus.CLOSED]).toBe(0);
    });

    it('should return zero stats when no feedbacks', async () => {
      const stats = await feedbackDAO.getFeedbackStats();

      expect(stats.total).toBe(0);
      expect(stats.byType[FeedbackType.BUG]).toBe(0);
      expect(stats.byType[FeedbackType.SUGGESTION]).toBe(0);
      expect(stats.byType[FeedbackType.OTHER]).toBe(0);
    });
  });
});