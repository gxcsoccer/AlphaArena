/**
 * AI Routes Tests
 */

import request from 'supertest';
import express from 'express';
import aiRoutes from '../aiRoutes.js';
import { strategyAssistant } from '../../ai/StrategyAssistant.js';
import { getSupabaseClient } from '../../database/client.js';

// Mock dependencies
jest.mock('../../ai/StrategyAssistant.js');
jest.mock('../../database/client.js');

// Create a mock Supabase client with all needed methods
const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(),
};

// Mock getSupabaseClient to return our mock
(getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

// Helper to create chainable query mock
function createQueryMock(result: any) {
  const query: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
  // Make it thenable
  query.then = (resolve: any) => Promise.resolve(result).then(resolve);
  return query;
}

// Create test app
const app = express();
app.use(express.json());
app.use('/api/ai', aiRoutes);

describe('AI Routes', () => {
  const mockUserId = 'test-user-id';
  const mockToken = 'test-token';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup auth mock
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });
    
    // Setup subscription query mock - return pro subscription
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'subscriptions') {
        return createQueryMock({
          data: { plan_type: 'pro', status: 'active' },
          error: null,
        });
      }
      if (table === 'ai_messages') {
        return createQueryMock({
          data: [],
          error: null,
        });
      }
      return createQueryMock({ data: null, error: null });
    });
  });

  describe('POST /api/ai/chat', () => {
    it('should send a message and receive a response', async () => {
      const mockResponse = {
        response: 'This is an AI response',
        conversationId: 'conv-123',
        tokensUsed: 150,
      };

      (strategyAssistant.chat as jest.Mock).mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          message: 'What is the current trend for BTC?',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.response).toBe('This is an AI response');
      expect(strategyAssistant.chat).toHaveBeenCalled();
    });

    it('should return 400 if message is missing', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Message is required');
    });

    it('should return 401 if no auth token provided', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .send({ message: 'test' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/ai/conversations', () => {
    it('should list user conversations', async () => {
      const mockConversations = [
        { id: 'conv-1', title: 'Test conversation' },
        { id: 'conv-2', title: 'Another conversation' },
      ];

      (strategyAssistant.listUserConversations as jest.Mock).mockResolvedValue({
        conversations: mockConversations,
        total: 2,
      });

      const response = await request(app)
        .get('/api/ai/conversations')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/ai/conversations/:id', () => {
    it('should get conversation history', async () => {
      const mockHistory = {
        conversation: { id: 'conv-1', title: 'Test' },
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
      };

      (strategyAssistant.getConversationHistory as jest.Mock).mockResolvedValue(mockHistory);

      const response = await request(app)
        .get('/api/ai/conversations/conv-1')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.messages).toHaveLength(2);
    });

    it('should return 404 if conversation not found', async () => {
      (strategyAssistant.getConversationHistory as jest.Mock).mockRejectedValue(
        new Error('Conversation not found')
      );

      const response = await request(app)
        .get('/api/ai/conversations/nonexistent')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/ai/conversations/:id', () => {
    it('should delete a conversation', async () => {
      (strategyAssistant.deleteConversation as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/ai/conversations/conv-1')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/ai/analyze/market', () => {
    it('should analyze market for a symbol', async () => {
      const mockAnalysis = {
        symbol: 'BTC/USDT',
        trend: 'bullish',
        trend_strength: 75,
        support_levels: [50000, 48000],
        resistance_levels: [55000, 58000],
        market_sentiment: 'positive',
        key_indicators: {},
        recommendations: ['Consider long positions'],
        timestamp: new Date().toISOString(),
      };

      (strategyAssistant.analyzeMarket as jest.Mock).mockResolvedValue(mockAnalysis);

      const response = await request(app)
        .post('/api/ai/analyze/market')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          symbol: 'BTC/USDT',
          market_data: { price: 52000 },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.trend).toBe('bullish');
    });

    it('should return 400 if symbol is missing', async () => {
      const response = await request(app)
        .post('/api/ai/analyze/market')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Symbol is required');
    });
  });

  describe('POST /api/ai/analyze/strategy', () => {
    it('should analyze and optimize a strategy', async () => {
      const mockOptimization = {
        strategy_id: 'strat-1',
        strategy_name: 'SMA Crossover',
        current_parameters: { shortPeriod: 5, longPeriod: 20 },
        suggested_parameters: { shortPeriod: 10, longPeriod: 30 },
        reasoning: 'Market conditions suggest longer periods',
        expected_improvement: 'Reduced false signals',
        risk_level: 'low',
        timestamp: new Date().toISOString(),
      };

      (strategyAssistant.optimizeStrategy as jest.Mock).mockResolvedValue(mockOptimization);

      const response = await request(app)
        .post('/api/ai/analyze/strategy')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          strategy_id: 'strat-1',
          strategy_data: { name: 'SMA Crossover', parameters: { shortPeriod: 5 } },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.suggested_parameters).toBeDefined();
    });

    it('should return 400 if strategy_id is missing', async () => {
      const response = await request(app)
        .post('/api/ai/analyze/strategy')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Strategy ID is required');
    });
  });

  describe('POST /api/ai/suggest', () => {
    it('should generate trading advice', async () => {
      const mockAdvice = {
        action: 'buy',
        symbol: 'BTC/USDT',
        confidence: 75,
        reasoning: 'Technical indicators suggest upward momentum',
        entry_price: 52000,
        stop_loss: 50000,
        take_profit: 58000,
        risk_reward_ratio: 1.5,
        time_horizon: 'medium',
        timestamp: new Date().toISOString(),
      };

      (strategyAssistant.generateAdvice as jest.Mock).mockResolvedValue(mockAdvice);

      const response = await request(app)
        .post('/api/ai/suggest')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          context: { currentPosition: { symbol: 'BTC/USDT' } },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.action).toBe('buy');
    });

    it('should return 400 if context is missing', async () => {
      const response = await request(app)
        .post('/api/ai/suggest')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Context is required');
    });
  });

  describe('POST /api/ai/explain', () => {
    it('should explain a trading concept', async () => {
      const mockExplanation = 'MACD (Moving Average Convergence Divergence) is a trend-following momentum indicator...';

      (strategyAssistant.explain as jest.Mock).mockResolvedValue(mockExplanation);

      const response = await request(app)
        .post('/api/ai/explain')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          topic: 'MACD',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.explanation).toBe(mockExplanation);
    });

    it('should return 400 if topic is missing', async () => {
      const response = await request(app)
        .post('/api/ai/explain')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Topic is required');
    });
  });
});