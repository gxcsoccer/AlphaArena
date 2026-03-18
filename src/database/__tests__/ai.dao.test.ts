/**
 * AI DAO Tests
 * Note: These tests focus on the function signatures and basic structure
 * Integration tests would be more appropriate for database operations
 */

import * as aiDAO from '../ai.dao';

// Mock Supabase client
jest.mock('../client', () => {
  const mockChain = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    range: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
  };

  return {
    __esModule: true,
    default: () => mockChain,
  };
});

describe('AI DAO Types', () => {
  it('should export createConversation function', () => {
    expect(typeof aiDAO.createConversation).toBe('function');
  });

  it('should export getConversationById function', () => {
    expect(typeof aiDAO.getConversationById).toBe('function');
  });

  it('should export listConversations function', () => {
    expect(typeof aiDAO.listConversations).toBe('function');
  });

  it('should export updateConversation function', () => {
    expect(typeof aiDAO.updateConversation).toBe('function');
  });

  it('should export deleteConversation function', () => {
    expect(typeof aiDAO.deleteConversation).toBe('function');
  });

  it('should export createMessage function', () => {
    expect(typeof aiDAO.createMessage).toBe('function');
  });

  it('should export getConversationMessages function', () => {
    expect(typeof aiDAO.getConversationMessages).toBe('function');
  });

  it('should export deleteAllConversations function', () => {
    expect(typeof aiDAO.deleteAllConversations).toBe('function');
  });

  it('should export cache functions', () => {
    expect(typeof aiDAO.getMarketAnalysisCache).toBe('function');
    expect(typeof aiDAO.saveMarketAnalysisCache).toBe('function');
    expect(typeof aiDAO.getStrategySuggestionCache).toBe('function');
    expect(typeof aiDAO.saveStrategySuggestionCache).toBe('function');
  });

  it('should export cleanupExpiredCache function', () => {
    expect(typeof aiDAO.cleanupExpiredCache).toBe('function');
  });
});

describe('AI DAO Interfaces', () => {
  it('should have correct type exports', () => {
    // Test that types are correctly defined by using them
    const conversation: aiDAO.AIConversation = {
      id: 'test-id',
      user_id: 'user-id',
      title: 'Test',
      context: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(conversation.id).toBe('test-id');

    const message: aiDAO.AIMessage = {
      id: 'msg-id',
      conversation_id: 'conv-id',
      role: 'user',
      content: 'Test message',
      created_at: new Date().toISOString(),
    };

    expect(message.role).toBe('user');
  });
});
