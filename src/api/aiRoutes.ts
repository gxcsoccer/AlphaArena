/**
 * AI Strategy Assistant API Routes
 * RESTful endpoints for AI-powered trading assistance
 */

import { Router, Request, Response, NextFunction } from 'express';
import { strategyAssistant } from '../ai/StrategyAssistant.js';
import getSupabaseClient from '../database/client.js';

const router = Router();

/**
 * Authentication middleware
 * Extracts user ID from Supabase auth token
 */
async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }
  
  const token = authHeader.substring(7);
  
  try {
    const supabase = getSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
    
    (req as any).userId = user.id;
    next();
  } catch (err) {
    console.error('Auth error:', err);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Pro user check middleware
 * Verifies user has Pro subscription for AI features
 */
async function requireProUser(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).userId;
  
  try {
    const supabase = getSupabaseClient();
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('plan_type, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();
    
    if (error || !subscription || subscription.plan_type !== 'pro') {
      res.status(403).json({ 
        error: 'AI features require a Pro subscription',
        upgrade_required: true 
      });
      return;
    }
    
    next();
  } catch (err) {
    console.error('Pro check error:', err);
    // For now, allow access even if check fails (development)
    next();
  }
}

/**
 * GET /api/ai/usage
 * Get user's AI usage statistics
 */
router.get('/usage', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const supabase = getSupabaseClient();
    
    // Check subscription status
    const { data: subscription, error: _subError } = await supabase
      .from('subscriptions')
      .select('plan_type, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    
    const isPro = subscription?.plan_type === 'pro';
    
    // Get today's message count from ai_messages table
    const today = new Date().toISOString().split('T')[0];
    const { data: messages, error: _msgError } = await supabase
      .from('ai_messages')
      .select('id, tokens_used')
      .eq('role', 'user')
      .gte('created_at', today);
    
    // Calculate usage
    const messagesToday = messages?.length || 0;
    const tokensUsed = messages?.reduce((sum: number, m: any) => sum + (m.tokens_used || 0), 0) || 0;
    
    res.json({
      success: true,
      data: {
        planType: isPro ? 'pro' : 'free',
        messagesToday,
        messagesLimit: isPro ? -1 : 5,
        tokensUsed,
        tokensLimit: isPro ? -1 : 10000,
      },
    });
  } catch (err) {
    console.error('Error getting usage:', err);
    res.status(500).json({ error: 'Failed to get usage statistics' });
  }
});

/**
 * POST /api/ai/chat
 * Send a message to the AI assistant
 */
router.post('/chat', authenticateUser, requireProUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { message, conversation_id, context } = req.body;
    
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }
    
    const result = await strategyAssistant.chat(userId, message, conversation_id, context);
    
    res.json({
      success: true,
      data: {
        response: result.response,
        conversation_id: result.conversationId,
        tokens_used: result.tokensUsed,
      },
    });
  } catch (err) {
    console.error('Error in AI chat:', err);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

/**
 * GET /api/ai/conversations
 * List user's conversations
 */
router.get('/conversations', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const limit = parseInt(String(req.query.limit)) || 20;
    const offset = parseInt(String(req.query.offset)) || 0;
    
    const result = await strategyAssistant.listUserConversations(userId, limit, offset);
    
    res.json({
      success: true,
      data: result.conversations,
      total: result.total,
    });
  } catch (err) {
    console.error('Error listing conversations:', err);
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

/**
 * GET /api/ai/conversations/:id
 * Get conversation history
 */
router.get('/conversations/:id', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const id = String(req.params.id);
    const limit = parseInt(String(req.query.limit)) || 50;
    
    const result = await strategyAssistant.getConversationHistory(userId, id, limit);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('Error getting conversation:', err);
    if ((err as Error).message === 'Conversation not found') {
      res.status(404).json({ error: 'Conversation not found' });
    } else {
      res.status(500).json({ error: 'Failed to get conversation' });
    }
  }
});

/**
 * DELETE /api/ai/conversations/:id
 * Delete a conversation
 */
router.delete('/conversations/:id', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const id = String(req.params.id);
    
    await strategyAssistant.deleteConversation(userId, id);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting conversation:', err);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

/**
 * DELETE /api/ai/conversations
 * Delete all conversations for a user
 */
router.delete('/conversations', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    
    await strategyAssistant.deleteAllUserConversations(userId);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting all conversations:', err);
    res.status(500).json({ error: 'Failed to delete conversations' });
  }
});

/**
 * POST /api/ai/analyze/market
 * Analyze market for a symbol
 */
router.post('/analyze/market', authenticateUser, requireProUser, async (req: Request, res: Response) => {
  try {
    const { symbol, market_data } = req.body;
    
    if (!symbol || typeof symbol !== 'string') {
      res.status(400).json({ error: 'Symbol is required' });
      return;
    }
    
    const analysis = await strategyAssistant.analyzeMarket(symbol, market_data);
    
    res.json({
      success: true,
      data: analysis,
    });
  } catch (err) {
    console.error('Error analyzing market:', err);
    res.status(500).json({ error: 'Failed to analyze market' });
  }
});

/**
 * POST /api/ai/analyze/strategy
 * Analyze and optimize a strategy
 */
router.post('/analyze/strategy', authenticateUser, requireProUser, async (req: Request, res: Response) => {
  try {
    const { strategy_id, strategy_data, performance_data } = req.body;
    
    if (!strategy_id) {
      res.status(400).json({ error: 'Strategy ID is required' });
      return;
    }
    
    const optimization = await strategyAssistant.optimizeStrategy(
      strategy_id,
      strategy_data,
      performance_data
    );
    
    res.json({
      success: true,
      data: optimization,
    });
  } catch (err) {
    console.error('Error analyzing strategy:', err);
    res.status(500).json({ error: 'Failed to analyze strategy' });
  }
});

/**
 * POST /api/ai/suggest
 * Get trading suggestions
 */
router.post('/suggest', authenticateUser, requireProUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { context, question } = req.body;
    
    if (!context) {
      res.status(400).json({ error: 'Context is required' });
      return;
    }
    
    const advice = await strategyAssistant.generateAdvice(
      { userId, ...context },
      question
    );
    
    res.json({
      success: true,
      data: advice,
    });
  } catch (err) {
    console.error('Error generating advice:', err);
    res.status(500).json({ error: 'Failed to generate advice' });
  }
});

/**
 * POST /api/ai/explain
 * Explain a trading concept
 */
router.post('/explain', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { topic, context } = req.body;
    
    if (!topic || typeof topic !== 'string') {
      res.status(400).json({ error: 'Topic is required' });
      return;
    }
    
    const explanation = await strategyAssistant.explain(topic, context);
    
    res.json({
      success: true,
      data: { explanation },
    });
  } catch (err) {
    console.error('Error explaining topic:', err);
    res.status(500).json({ error: 'Failed to explain topic' });
  }
});

export default router;
