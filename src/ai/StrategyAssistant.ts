/**
 * AI Strategy Assistant
 * Main service for AI-powered trading strategy assistance
 */

import {
  createLLMProvider,
  getDefaultLLMConfig,
  type ILLMProvider,
  type ChatMessage,
} from './LLMProvider.js';
import {
  createConversation,
  createMessage,
  getConversationById,
  getConversationMessages,
  listConversations,
  updateConversation,
  deleteConversation,
  deleteAllConversations,
  getMarketAnalysisCache,
  saveMarketAnalysisCache,
  getStrategySuggestionCache,
  saveStrategySuggestionCache,
  type AIConversation,
  type AIMessage,
} from '../database/ai.dao.js';

export interface MarketAnalysis {
  symbol: string;
  trend: 'bullish' | 'bearish' | 'neutral';
  trend_strength: number;
  support_levels: number[];
  resistance_levels: number[];
  market_sentiment: string;
  key_indicators: Record<string, unknown>;
  recommendations: string[];
  timestamp: string;
}

export interface StrategyOptimization {
  strategy_id: string;
  strategy_name: string;
  current_parameters: Record<string, unknown>;
  suggested_parameters: Record<string, unknown>;
  reasoning: string;
  expected_improvement: string;
  risk_level: 'low' | 'medium' | 'high';
  timestamp: string;
}

export interface TradingAdvice {
  action: 'buy' | 'sell' | 'hold' | 'wait';
  symbol: string;
  confidence: number;
  reasoning: string;
  entry_price?: number;
  stop_loss?: number;
  take_profit?: number;
  risk_reward_ratio?: number;
  time_horizon: 'short' | 'medium' | 'long';
  timestamp: string;
}

export interface UserContext {
  userId: string;
  currentStrategy?: Record<string, unknown>;
  currentPortfolio?: Record<string, unknown>;
  currentPosition?: Record<string, unknown>;
  marketData?: Record<string, unknown>;
}

export class StrategyAssistant {
  private llm: ILLMProvider;
  private systemPrompt: string;

  constructor(llmConfig?: ReturnType<typeof getDefaultLLMConfig>) {
    this.llm = createLLMProvider(llmConfig || getDefaultLLMConfig());
    this.systemPrompt = this.buildSystemPrompt();
  }

  private buildSystemPrompt(): string {
    return `You are an expert AI trading strategy assistant for AlphaArena, a quantitative trading platform.

Your capabilities include:
- Analyzing market trends and patterns
- Optimizing trading strategy parameters
- Providing risk management recommendations
- Explaining trading concepts and strategies
- Generating trading signals and advice

Guidelines:
1. Always provide clear, actionable insights
2. Explain your reasoning in simple terms
3. Consider risk management in every recommendation
4. Be transparent about uncertainty and limitations
5. Support your analysis with technical indicators when relevant
6. Consider market context and current conditions

When analyzing markets:
- Use technical analysis (RSI, MACD, SMA, EMA, Bollinger Bands)
- Identify support and resistance levels
- Assess market sentiment
- Consider volume patterns

When optimizing strategies:
- Analyze historical performance
- Consider market conditions
- Balance risk and reward
- Provide specific parameter recommendations

When providing advice:
- Give confidence levels
- Include stop-loss and take-profit levels
- Consider risk-reward ratios
- Be specific about time horizons`;
  }

  /**
   * Send a message and get AI response
   */
  async chat(
    userId: string,
    message: string,
    conversationId?: string,
    context?: UserContext
  ): Promise<{ response: string; conversationId: string; tokensUsed: number }> {
    // Get or create conversation
    let conversation: AIConversation;
    if (conversationId) {
      const existing = await getConversationById(conversationId, userId);
      if (!existing) {
        throw new Error('Conversation not found');
      }
      conversation = existing;
    } else {
      conversation = await createConversation({
        user_id: userId,
        title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
        context: context ? JSON.parse(JSON.stringify(context)) : {},
      });
    }

    // Get conversation history
    const history = await getConversationMessages(conversation.id, userId, 20);

    // Build messages array
    const messages: ChatMessage[] = [
      { role: 'system', content: this.systemPrompt },
    ];

    // Add context if provided
    if (context) {
      messages.push({
        role: 'system',
        content: `Current context:\n${JSON.stringify(context, null, 2)}`,
      });
    }

    // Add conversation history
    for (const msg of history) {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }

    // Add user message
    messages.push({ role: 'user', content: message });

    // Save user message
    await createMessage({
      conversation_id: conversation.id,
      role: 'user',
      content: message,
      context: context ? JSON.parse(JSON.stringify(context)) : undefined,
    });

    // Get AI response
    const response = await this.llm.chat(messages);

    // Save AI response
    await createMessage({
      conversation_id: conversation.id,
      role: 'assistant',
      content: response.content,
      tokens_used: response.tokensUsed,
      model: response.model,
    });

    // Update conversation title if this is the first message
    if (history.length === 0) {
      await updateConversation(conversation.id, userId, {
        title: message.substring(0, 100),
      });
    }

    return {
      response: response.content,
      conversationId: conversation.id,
      tokensUsed: response.tokensUsed,
    };
  }

  /**
   * Analyze market for a given symbol
   */
  async analyzeMarket(
    symbol: string,
    marketData?: Record<string, unknown>
  ): Promise<MarketAnalysis> {
    // Check cache first
    const cacheKey = JSON.stringify({ symbol, marketData });
    const cacheHash = this.hashData(cacheKey);
    
    const cached = await getMarketAnalysisCache(symbol, 'trend', cacheHash);
    if (cached) {
      return cached.analysis_result as unknown as MarketAnalysis;
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: this.systemPrompt },
      {
        role: 'user',
        content: `Analyze the market for ${symbol}. ${marketData ? `Here's the current market data: ${JSON.stringify(marketData)}` : ''}

Provide a comprehensive analysis including:
1. Current trend (bullish/bearish/neutral) and strength (0-100)
2. Key support and resistance levels
3. Market sentiment assessment
4. Key technical indicators
5. Trading recommendations

Respond in JSON format.`,
      },
    ];

    const response = await this.llm.chat(messages);
    const analysis = this.parseJSONResponse<MarketAnalysis>(response.content, {
      symbol,
      trend: 'neutral',
      trend_strength: 50,
      support_levels: [],
      resistance_levels: [],
      market_sentiment: 'neutral',
      key_indicators: {},
      recommendations: [],
      timestamp: new Date().toISOString(),
    });

    // Cache the result
    await saveMarketAnalysisCache({
      symbol,
      analysisType: 'trend',
      analysisResult: JSON.parse(JSON.stringify(analysis)),
      marketDataHash: cacheHash,
      model: this.llm.getModel(),
    });

    return analysis;
  }

  /**
   * Optimize strategy parameters
   */
  async optimizeStrategy(
    strategyId: string,
    strategyData: Record<string, unknown>,
    performanceData?: Record<string, unknown>
  ): Promise<StrategyOptimization> {
    // Check cache
    const cacheKey = JSON.stringify({ strategyId, strategyData, performanceData });
    const cacheHash = this.hashData(cacheKey);
    
    const cached = await getStrategySuggestionCache(strategyId, 'optimization', cacheHash);
    if (cached) {
      return cached.suggestion_result as unknown as StrategyOptimization;
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: this.systemPrompt },
      {
        role: 'user',
        content: `Optimize the following trading strategy:

Strategy: ${strategyData.name || 'Unnamed'}
Type: ${strategyData.type || 'Unknown'}
Current Parameters: ${JSON.stringify(strategyData.parameters || {}, null, 2)}
${performanceData ? `Performance Data: ${JSON.stringify(performanceData, null, 2)}` : ''}

Provide optimization suggestions including:
1. Suggested parameter changes
2. Reasoning for each change
3. Expected improvement
4. Risk level assessment

Respond in JSON format with fields: strategy_id, strategy_name, current_parameters, suggested_parameters, reasoning, expected_improvement, risk_level.`,
      },
    ];

    const response = await this.llm.chat(messages);
    const optimization = this.parseJSONResponse<StrategyOptimization>(response.content, {
      strategy_id: strategyId,
      strategy_name: (strategyData.name as string) || 'Unknown',
      current_parameters: (strategyData.parameters as Record<string, unknown>) || {},
      suggested_parameters: {},
      reasoning: 'Unable to parse optimization suggestions',
      expected_improvement: 'Unknown',
      risk_level: 'medium',
      timestamp: new Date().toISOString(),
    });

    // Cache the result
    await saveStrategySuggestionCache({
      strategyId,
      suggestionType: 'optimization',
      suggestionResult: JSON.parse(JSON.stringify(optimization)),
      strategyDataHash: cacheHash,
      model: this.llm.getModel(),
    });

    return optimization;
  }

  /**
   * Generate trading advice
   */
  async generateAdvice(
    context: UserContext,
    question?: string
  ): Promise<TradingAdvice> {
    const messages: ChatMessage[] = [
      { role: 'system', content: this.systemPrompt },
      {
        role: 'user',
        content: `Based on the following context, provide trading advice:

User Context:
${JSON.stringify(context, null, 2)}

${question || 'What should I do next?'}

Provide advice including:
1. Action (buy/sell/hold/wait)
2. Confidence level (0-100)
3. Reasoning
4. Entry price (if applicable)
5. Stop-loss level
6. Take-profit level
7. Risk-reward ratio
8. Time horizon (short/medium/long)

Respond in JSON format.`,
      },
    ];

    const response = await this.llm.chat(messages);
    return this.parseJSONResponse<TradingAdvice>(response.content, {
      action: 'hold',
      symbol: (context.currentPosition?.symbol as string) || 'UNKNOWN',
      confidence: 50,
      reasoning: 'Unable to parse trading advice',
      time_horizon: 'medium',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Explain a trading concept
   */
  async explain(topic: string, context?: string): Promise<string> {
    const messages: ChatMessage[] = [
      { role: 'system', content: this.systemPrompt },
      {
        role: 'user',
        content: `Explain the following trading concept in simple terms:

Topic: ${topic}
${context ? `Context: ${context}` : ''}

Provide a clear, educational explanation suitable for someone learning about trading.`,
      },
    ];

    const response = await this.llm.chat(messages);
    return response.content;
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(
    userId: string,
    conversationId: string,
    limit: number = 50
  ): Promise<{ conversation: AIConversation; messages: AIMessage[] }> {
    const conversation = await getConversationById(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const messages = await getConversationMessages(conversationId, userId, limit);
    return { conversation, messages };
  }

  /**
   * List user's conversations
   */
  async listUserConversations(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ conversations: AIConversation[]; total: number }> {
    return listConversations({ user_id: userId, limit, offset });
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(userId: string, conversationId: string): Promise<void> {
    await deleteConversation(conversationId, userId);
  }

  /**
   * Delete all conversations for a user
   */
  async deleteAllUserConversations(userId: string): Promise<void> {
    await deleteAllConversations(userId);
  }

  /**
   * Helper to parse JSON response with fallback
   */
  private parseJSONResponse<T>(content: string, fallback: T): T {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * Helper to hash data for cache key
   */
  private hashData(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
}

// Export singleton instance
export const strategyAssistant = new StrategyAssistant();
