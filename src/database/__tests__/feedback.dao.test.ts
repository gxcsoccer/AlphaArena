/**
 * Tests for Feedback DAO
 */

import { FeedbackDAO, FeedbackType, FeedbackStatus, SentimentType } from '../feedback.dao';

// Mock Supabase client
jest.mock('../client', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          range: jest.fn(() => ({
            order: jest.fn(() => ({
              single: jest.fn(),
            })),
          })),
        })),
        order: jest.fn(() => ({
          range: jest.fn(),
        })),
        limit: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(),
          })),
        })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(),
      })),
    })),
  })),
}));

describe('FeedbackDAO', () => {
  let feedbackDAO: FeedbackDAO;

  beforeEach(() => {
    feedbackDAO = new FeedbackDAO();
    jest.clearAllMocks();
  });

  describe('analyzeSentiment', () => {
    // Access private method for testing
    const dao = new FeedbackDAO() as any;

    it('should detect positive sentiment', () => {
      const result = dao.analyzeSentiment('This is a great feature! I love it.');
      expect(result.sentiment).toBe('positive');
      expect(result.sentimentScore).toBeGreaterThan(0.2);
    });

    it('should detect negative sentiment', () => {
      const result = dao.analyzeSentiment('This is terrible. Bad experience with bug.');
      expect(result.sentiment).toBe('negative');
      expect(result.sentimentScore).toBeLessThan(-0.2);
    });

    it('should detect neutral sentiment', () => {
      const result = dao.analyzeSentiment('I have a question about this feature.');
      expect(result.sentiment).toBe('neutral');
      expect(result.sentimentScore).toBeGreaterThanOrEqual(-0.2);
      expect(result.sentimentScore).toBeLessThanOrEqual(0.2);
    });

    it('should handle Chinese positive sentiment', () => {
      const result = dao.analyzeSentiment('这个功能很好用，非常满意！');
      expect(result.sentiment).toBe('positive');
    });

    it('should handle Chinese negative sentiment', () => {
      const result = dao.analyzeSentiment('这个功能有问题，体验很差。');
      expect(result.sentiment).toBe('negative');
    });
  });

  describe('extractTags', () => {
    const dao = new FeedbackDAO() as any;

    it('should extract UI tag', () => {
      const tags = dao.extractTags('The UI interface needs improvement');
      expect(tags).toContain('ui');
    });

    it('should extract bug tag', () => {
      const tags = dao.extractTags('There is a bug causing crash error');
      expect(tags).toContain('bug');
    });

    it('should extract performance tag', () => {
      const tags = dao.extractTags('The app is slow and performance is bad');
      expect(tags).toContain('performance');
    });

    it('should extract trading tag', () => {
      const tags = dao.extractTags('Trading order feature request');
      expect(tags).toContain('trading');
    });

    it('should extract multiple tags', () => {
      const tags = dao.extractTags('The mobile trading UI has a bug error');
      expect(tags).toContain('mobile');
      expect(tags).toContain('trading');
      expect(tags).toContain('ui');
      expect(tags).toContain('bug');
    });

    it('should extract Chinese tags', () => {
      const tags = dao.extractTags('手机端的交易功能有bug问题');
      expect(tags).toContain('mobile');
      expect(tags).toContain('trading');
      expect(tags).toContain('bug');
    });

    it('should remove duplicate tags', () => {
      const tags = dao.extractTags('bug bug bug error error');
      const bugCount = tags.filter((t: string) => t === 'bug').length;
      expect(bugCount).toBe(1);
    });
  });

  describe('mapToFeedback', () => {
    it('should correctly map database row to UserFeedback', () => {
      const dao = new FeedbackDAO() as any;
      const mockRow = {
        id: '123',
        user_id: 'user-1',
        type: 'feature_request',
        status: 'pending',
        title: 'Test Title',
        content: 'Test Content',
        images: ['image1.png'],
        sentiment: 'positive',
        sentiment_score: 0.5,
        tags: ['feature'],
        admin_reply: null,
        admin_reply_by: null,
        admin_reply_at: null,
        resolved_at: null,
        resolved_by: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        is_read_by_admin: false,
        user: {
          username: 'testuser',
          display_name: 'Test User',
          avatar_url: 'avatar.png',
        },
      };

      const result = dao.mapToFeedback(mockRow);

      expect(result.id).toBe('123');
      expect(result.userId).toBe('user-1');
      expect(result.type).toBe('feature_request');
      expect(result.status).toBe('pending');
      expect(result.title).toBe('Test Title');
      expect(result.content).toBe('Test Content');
      expect(result.images).toEqual(['image1.png']);
      expect(result.sentiment).toBe('positive');
      expect(result.sentimentScore).toBe(0.5);
      expect(result.tags).toEqual(['feature']);
      expect(result.username).toBe('testuser');
      expect(result.displayName).toBe('Test User');
      expect(result.avatarUrl).toBe('avatar.png');
    });
  });

  describe('mapToStatusHistory', () => {
    it('should correctly map database row to FeedbackStatusHistory', () => {
      const dao = new FeedbackDAO() as any;
      const mockRow = {
        id: 'hist-1',
        feedback_id: 'feedback-1',
        old_status: 'pending',
        new_status: 'in_progress',
        changed_by: 'admin-1',
        changed_at: '2024-01-01T00:00:00Z',
        note: 'Started working on it',
      };

      const result = dao.mapToStatusHistory(mockRow);

      expect(result.id).toBe('hist-1');
      expect(result.feedbackId).toBe('feedback-1');
      expect(result.oldStatus).toBe('pending');
      expect(result.newStatus).toBe('in_progress');
      expect(result.changedBy).toBe('admin-1');
      expect(result.note).toBe('Started working on it');
    });
  });
});