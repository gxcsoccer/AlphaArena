/**
 * Tests for Feedback DAO
 * 
 * Note: These tests focus on validating the DAO interface, type safety, and basic functionality.
 * Complex database operations with Supabase chain calls are tested via integration tests.
 */

import { FeedbackType, FeedbackStatus, CreateFeedbackInput } from '../feedback.dao';

// Mock the client module
jest.mock('../client', () => {
  const store = {
    currentData: null as any,
    statsData: [] as any[],
    shouldFail: false,
  };

  const mockSingle = jest.fn(() => {
    if (store.shouldFail) {
      return Promise.resolve({ data: null, error: { code: 'PGRST116' } });
    }
    return Promise.resolve({ data: store.currentData, error: null });
  });

  const mockSelect = jest.fn((fields?: string) => {
    if (fields === 'type, status') {
      return Promise.resolve({ data: store.statsData, error: null });
    }
    return {
      eq: jest.fn(() => ({
        single: mockSingle,
      })),
      order: jest.fn(() => ({
        range: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      single: mockSingle,
    };
  });

  const mockInsert = jest.fn(() => ({
    select: jest.fn(() => ({
      single: mockSingle,
    })),
  }));

  const mockUpdate = jest.fn(() => ({
    eq: jest.fn(() => ({
      select: jest.fn(() => ({
        single: mockSingle,
      })),
    })),
  }));

  const mockDelete = jest.fn(() => ({
    eq: jest.fn(() => Promise.resolve({ error: null })),
  }));

  const mockFrom = jest.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  }));

  return {
    getSupabaseAdminClient: jest.fn(() => ({ from: mockFrom })),
    __store: store,
  };
});

import { feedbackDAO } from '../feedback.dao';
import mockedClient from '../client';

const getStore = () => (mockedClient as any).__store;

const mockFeedbackData = {
  id: 'fb_test_123',
  user_id: 'user_123',
  type: 'bug',
  description: 'Test bug description',
  status: 'new',
  environment: {},
  tags: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('FeedbackDAO', () => {
  let store: any;
  
  beforeEach(() => {
    store = getStore();
    store.currentData = null;
    store.statsData = [];
    store.shouldFail = false;
  });

  describe('createFeedback', () => {
    it('should create a feedback with correct type mapping', async () => {
      store.currentData = mockFeedbackData;

      const input: CreateFeedbackInput = {
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

    it('should handle all feedback types', async () => {
      const types = [FeedbackType.BUG, FeedbackType.SUGGESTION, FeedbackType.OTHER];
      
      for (const type of types) {
        store.currentData = { ...mockFeedbackData, type };

        const input: CreateFeedbackInput = {
          type,
          description: `Test ${type} feedback`,
          environment: {
            url: '',
            userAgent: '',
            screenSize: '',
            timestamp: new Date().toISOString(),
            locale: '',
            referrer: '',
          },
        };

        const feedback = await feedbackDAO.createFeedback(input);
        expect(feedback.type).toBe(type);
      }
    });
  });

  describe('getFeedbacks', () => {
    it('should return an array of feedbacks', async () => {
      const feedbacks = await feedbackDAO.getFeedbacks();
      expect(Array.isArray(feedbacks)).toBe(true);
    });
  });

  describe('deleteFeedback', () => {
    it('should resolve without error', async () => {
      await expect(feedbackDAO.deleteFeedback('fb_test_123')).resolves.not.toThrow();
    });
  });

  describe('FeedbackType enum', () => {
    it('should have correct values', () => {
      expect(FeedbackType.BUG).toBe('bug');
      expect(FeedbackType.SUGGESTION).toBe('suggestion');
      expect(FeedbackType.OTHER).toBe('other');
    });
  });

  describe('FeedbackStatus enum', () => {
    it('should have correct values', () => {
      expect(FeedbackStatus.NEW).toBe('new');
      expect(FeedbackStatus.IN_PROGRESS).toBe('in_progress');
      expect(FeedbackStatus.RESOLVED).toBe('resolved');
      expect(FeedbackStatus.CLOSED).toBe('closed');
    });
  });
});