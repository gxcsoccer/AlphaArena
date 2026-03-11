/**
 * LLM Client - 大语言模型客户端
 *
 * Encapsulates OpenAI-compatible API calls for trading decision making.
 * Supports rate limiting, retry mechanism, and token usage tracking.
 */

import { EventEmitter } from 'events';

/**
 * LLM Client configuration
 */
export interface LLMClientConfig {
  /** API base URL */
  apiUrl: string;
  /** API key (read from environment variable) */
  apiKey?: string;
  /** Model name (e.g., 'gpt-4', 'gpt-3.5-turbo') */
  model: string;
  /** Maximum tokens per request */
  maxTokens?: number;
  /** Temperature for response generation (0-2) */
  temperature?: number;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retries on failure */
  maxRetries?: number;
  /** Initial retry delay in milliseconds */
  retryDelay?: number;
  /** Enable detailed logging */
  enableLogging?: boolean;
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
  /** Prompt tokens used */
  promptTokens: number;
  /** Completion tokens used */
  completionTokens: number;
  /** Total tokens used */
  totalTokens: number;
  /** Estimated cost in USD */
  estimatedCost: number;
}

/**
 * LLM Client event types
 */
export type LLMClientEventType =
  | 'request'
  | 'response'
  | 'error'
  | 'retry'
  | 'rate-limit'
  | 'token-usage';

/**
 * LLM Client event
 */
export interface LLMClientEvent {
  type: LLMClientEventType;
  timestamp: number;
  data?: any;
}

/**
 * Trading signal from LLM
 */
export interface LLMTradingSignal {
  /** Action: buy, sell, or hold */
  action: 'buy' | 'sell' | 'hold';
  /** Confidence score (0-1) */
  confidence: number;
  /** Reason for the decision */
  reason: string;
  /** Suggested price (optional) */
  price?: number;
  /** Suggested quantity (optional) */
  quantity?: number;
  /** Risk assessment */
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Market data for LLM analysis
 */
export interface MarketDataForLLM {
  /** Symbol being analyzed */
  symbol: string;
  /** Current bid price */
  bid?: number;
  /** Current ask price */
  ask?: number;
  /** Last trade price */
  lastPrice?: number;
  /** Price history (recent candles) */
  priceHistory: Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  /** Order book depth */
  orderBookDepth?: {
    bids: Array<{ price: number; quantity: number }>;
    asks: Array<{ price: number; quantity: number }>;
  };
  /** Recent trades */
  recentTrades?: Array<{
    timestamp: number;
    price: number;
    quantity: number;
    side: 'buy' | 'sell';
  }>;
  /** Technical indicators (optional) */
  indicators?: {
    sma?: number;
    ema?: number;
    rsi?: number;
    macd?: number;
    [key: string]: number | undefined;
  };
}

/**
 * Rate limiter using token bucket algorithm
 */
class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per millisecond
  private lastRefill: number;

  constructor(requestsPerMinute: number = 60) {
    this.maxTokens = requestsPerMinute;
    this.tokens = requestsPerMinute;
    this.refillRate = requestsPerMinute / (60 * 1000);
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Wait until a token is available
    const waitTime = Math.ceil((1 - this.tokens) / this.refillRate);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    this.tokens -= 1;
  }

  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}

/**
 * LLM Client for trading decision making
 */
export class LLMClient extends EventEmitter {
  private config: Required<LLMClientConfig>;
  private rateLimiter: RateLimiter;
  private totalUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
  };
  private requestCount = 0;
  private errorCount = 0;

  constructor(config: LLMClientConfig) {
    super();

    // Read API key from environment if not provided
    const apiKey = config.apiKey || process.env.LLM_API_KEY || '';
    if (!apiKey) {
      throw new Error('LLM_API_KEY environment variable is required');
    }

    this.config = {
      apiUrl: config.apiUrl,
      apiKey,
      model: config.model,
      maxTokens: config.maxTokens ?? 1000,
      temperature: config.temperature ?? 0.7,
      timeout: config.timeout ?? 30000,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      enableLogging: config.enableLogging ?? false,
    };

    // Initialize rate limiter (60 requests per minute by default)
    this.rateLimiter = new RateLimiter(60);

    if (this.config.enableLogging) {
      this.log('LLMClient initialized', {
        model: this.config.model,
        apiUrl: this.config.apiUrl,
      });
    }
  }

  /**
   * Send a chat completion request to the LLM
   */
  async chatCompletion(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<{ content: string; usage: TokenUsage }> {
    await this.rateLimiter.acquire();

    const attempt = async (retryCount: number): Promise<{ content: string; usage: TokenUsage }> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      try {
        const response = await fetch(`${this.config.apiUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            messages,
            max_tokens: options?.maxTokens ?? this.config.maxTokens,
            temperature: options?.temperature ?? this.config.temperature,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          
          // Handle rate limiting
          if (response.status === 429) {
            this.emit('rate-limit', { timestamp: Date.now(), retryAfter: response.headers.get('Retry-After') });
            
            if (retryCount < this.config.maxRetries) {
              const delay = this.config.retryDelay * Math.pow(2, retryCount);
              this.log('Rate limited, retrying after delay', { delay, retryCount });
              this.emit('retry', { timestamp: Date.now(), retryCount, delay });
              await new Promise(resolve => setTimeout(resolve, delay));
              return attempt(retryCount + 1);
            }
          }

          throw new Error(`LLM API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        
        const usage: TokenUsage = {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
          estimatedCost: this.calculateCost(data.usage?.total_tokens || 0),
        };

        // Update total usage
        this.totalUsage.promptTokens += usage.promptTokens;
        this.totalUsage.completionTokens += usage.completionTokens;
        this.totalUsage.totalTokens += usage.totalTokens;
        this.totalUsage.estimatedCost += usage.estimatedCost;
        this.requestCount++;

        // Emit events
        this.emit('request', { timestamp: Date.now(), messages });
        this.emit('response', { timestamp: Date.now(), content: data.choices[0]?.message?.content });
        this.emit('token-usage', { timestamp: Date.now(), usage });

        if (this.config.enableLogging) {
          this.log('Chat completion successful', {
            tokens: usage.totalTokens,
            cost: usage.estimatedCost,
          });
        }

        return {
          content: data.choices[0]?.message?.content || '',
          usage,
        };
      } catch (error: any) {
        clearTimeout(timeoutId);
        this.errorCount++;

        // Retry on network errors
        if (retryCount < this.config.maxRetries && (error.name === 'AbortError' || error.message.includes('network'))) {
          const delay = this.config.retryDelay * Math.pow(2, retryCount);
          this.log('Network error, retrying', { delay, retryCount, error: error.message });
          this.emit('retry', { timestamp: Date.now(), retryCount, delay, error: error.message });
          await new Promise(resolve => setTimeout(resolve, delay));
          return attempt(retryCount + 1);
        }

        this.emit('error', { timestamp: Date.now(), error: error.message });
        throw error;
      }
    };

    return attempt(0);
  }

  /**
   * Analyze market data and generate trading signal
   */
  async analyzeMarket(
    marketData: MarketDataForLLM,
    promptTemplate?: string
  ): Promise<LLMTradingSignal> {
    const systemPrompt = promptTemplate || this.getDefaultSystemPrompt();
    
    const userPrompt = this.formatMarketDataPrompt(marketData);

    const { content } = await this.chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    return this.parseTradingSignal(content);
  }

  /**
   * Get default system prompt for trading analysis
   */
  private getDefaultSystemPrompt(): string {
    return `You are an expert quantitative trader and financial analyst. Your task is to analyze market data and provide trading recommendations.

Analyze the provided market data carefully and output a JSON object with the following structure:
{
  "action": "buy" | "sell" | "hold",
  "confidence": 0.0-1.0,
  "reason": "detailed explanation of your reasoning",
  "price": <suggested entry price, optional>,
  "quantity": <suggested position size, optional>,
  "riskLevel": "low" | "medium" | "high"
}

Consider the following factors:
1. Price trends and momentum
2. Support and resistance levels
3. Volume patterns
4. Risk-reward ratio
5. Market conditions

Be conservative and risk-aware. Only recommend trades with clear rationale.`;
  }

  /**
   * Format market data into a prompt
   */
  private formatMarketDataPrompt(marketData: MarketDataForLLM): string {
    let prompt = `Analyze the following market data for ${marketData.symbol}:\n\n`;

    // Current prices
    if (marketData.lastPrice) {
      prompt += `Current Price: $${marketData.lastPrice.toFixed(2)}\n`;
    }
    if (marketData.bid && marketData.ask) {
      prompt += `Bid: $${marketData.bid.toFixed(2)} | Ask: $${marketData.ask.toFixed(2)}\n`;
      prompt += `Spread: $${(marketData.ask - marketData.bid).toFixed(2)} (${((marketData.ask - marketData.bid) / marketData.bid * 100).toFixed(2)}%)\n`;
    }

    // Technical indicators
    if (marketData.indicators) {
      prompt += `\nTechnical Indicators:\n`;
      Object.entries(marketData.indicators).forEach(([key, value]) => {
        if (value !== undefined) {
          prompt += `  ${key.toUpperCase()}: ${value.toFixed(4)}\n`;
        }
      });
    }

    // Price history
    if (marketData.priceHistory && marketData.priceHistory.length > 0) {
      prompt += `\nRecent Price History (${marketData.priceHistory.length} candles):\n`;
      const recent = marketData.priceHistory.slice(-10);
      recent.forEach((candle, i) => {
        const changePercent = ((candle.close - candle.open) / candle.open * 100);
        const change = changePercent.toFixed(2);
        prompt += `  ${i + 1}. O:${candle.open.toFixed(2)} H:${candle.high.toFixed(2)} L:${candle.low.toFixed(2)} C:${candle.close.toFixed(2)} V:${candle.volume} (${change}%)${changePercent >= 0 ? ' 📈' : ' 📉'}\n`;
      });
    }

    // Order book depth
    if (marketData.orderBookDepth) {
      prompt += `\nOrder Book Depth:\n`;
      prompt += `  Bids: ${marketData.orderBookDepth.bids.length} levels\n`;
      prompt += `  Asks: ${marketData.orderBookDepth.asks.length} levels\n`;
    }

    // Recent trades
    if (marketData.recentTrades && marketData.recentTrades.length > 0) {
      prompt += `\nRecent Trades (${marketData.recentTrades.length}):\n`;
      const recent = marketData.recentTrades.slice(-5);
      recent.forEach(trade => {
        prompt += `  ${trade.side.toUpperCase()}: ${trade.quantity} @ $${trade.price.toFixed(2)}\n`;
      });
    }

    prompt += `\nBased on this data, what is your trading recommendation? Output ONLY a valid JSON object.`;

    return prompt;
  }

  /**
   * Parse LLM response into trading signal
   */
  private parseTradingSignal(content: string): LLMTradingSignal {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (!['buy', 'sell', 'hold'].includes(parsed.action)) {
        throw new Error(`Invalid action: ${parsed.action}`);
      }

      if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
        throw new Error(`Invalid confidence: ${parsed.confidence}`);
      }

      if (!['low', 'medium', 'high'].includes(parsed.riskLevel)) {
        throw new Error(`Invalid risk level: ${parsed.riskLevel}`);
      }

      return {
        action: parsed.action,
        confidence: parsed.confidence,
        reason: parsed.reason || 'No reason provided',
        price: parsed.price,
        quantity: parsed.quantity,
        riskLevel: parsed.riskLevel,
      };
    } catch (error: any) {
      this.log('Failed to parse LLM response', { content: content.substring(0, 200), error: error.message });
      
      // Fallback: return a conservative hold signal
      return {
        action: 'hold',
        confidence: 0.5,
        reason: `Failed to parse LLM response: ${error.message}. Defaulting to hold.`,
        riskLevel: 'low',
      };
    }
  }

  /**
   * Calculate estimated cost based on token count
   * (Adjust pricing based on your LLM provider)
   */
  private calculateCost(totalTokens: number): number {
    // Example pricing for GPT-4 (adjust as needed)
    // $0.03 per 1K prompt tokens, $0.06 per 1K completion tokens
    const promptCost = (this.totalUsage.promptTokens / 1000) * 0.03;
    const completionCost = (this.totalUsage.completionTokens / 1000) * 0.06;
    return promptCost + completionCost;
  }

  /**
   * Get current token usage statistics
   */
  getTokenUsage(): TokenUsage {
    return { ...this.totalUsage };
  }

  /**
   * Get request statistics
   */
  getStats(): {
    requestCount: number;
    errorCount: number;
    successRate: number;
  } {
    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      successRate: this.requestCount > 0 
        ? ((this.requestCount - this.errorCount) / this.requestCount * 100)
        : 100,
    };
  }

  /**
   * Reset usage statistics
   */
  resetUsage(): void {
    this.totalUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    };
    this.requestCount = 0;
    this.errorCount = 0;
  }

  /**
   * Log message if logging is enabled
   */
  private log(message: string, data?: any): void {
    if (this.config.enableLogging) {
      console.log(`[LLMClient] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }
}
