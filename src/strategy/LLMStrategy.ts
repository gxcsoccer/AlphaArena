/**
 * LLM Strategy - 大语言模型交易策略
 *
 * A trading strategy that uses large language models to analyze market data
 * and generate trading signals.
 */

import { Strategy } from './Strategy';
import { StrategyConfig, StrategyContext, OrderSignal, MarketData } from './types';
import { LLMClient, LLMClientConfig, MarketDataForLLM, LLMTradingSignal } from './LLMClient';

/**
 * LLM Strategy configuration
 */
export interface LLMStrategyConfig extends StrategyConfig {
  params?: {
    /** LLM API configuration */
    llm?: {
      /** API URL (default: from environment) */
      apiUrl?: string;
      /** Model name */
      model: string;
      /** Temperature (0-2) */
      temperature?: number;
      /** Max tokens per request */
      maxTokens?: number;
    };
    /** Trading parameters */
    trading?: {
      /** Default trade quantity */
      quantity?: number;
      /** Minimum confidence threshold (0-1) */
      minConfidence?: number;
      /** Maximum risk level allowed */
      maxRiskLevel?: 'low' | 'medium' | 'high';
      /** Cooldown period between signals (ms) */
      cooldownPeriod?: number;
    };
    /** Rate limiting */
    rateLimit?: {
      /** Maximum requests per minute */
      requestsPerMinute?: number;
      /** Maximum daily budget in USD */
      dailyBudget?: number;
    };
    /** Enable detailed logging */
    enableLogging?: boolean;
  };
}

/**
 * LLM Strategy decision log entry
 */
export interface LLMDecisionLog {
  /** Timestamp of decision */
  timestamp: number;
  /** Market data snapshot */
  marketData: Partial<MarketDataForLLM>;
  /** LLM signal received */
  llmSignal: LLMTradingSignal;
  /** Final order signal (or null if filtered out) */
  orderSignal: OrderSignal | null;
  /** Reason for filtering (if applicable) */
  filterReason?: string;
  /** Token usage for this decision */
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
  };
}

/**
 * Prompt template system
 */
export interface PromptTemplate {
  /** Template name */
  name: string;
  /** Template content */
  template: string;
  /** Variables that can be substituted */
  variables: string[];
}

/**
 * LLM Strategy - uses LLM for trading decisions
 */
export class LLMStrategy extends Strategy {
  private llmClient: LLMClient | null = null;
  private lastSignalTime: number = 0;
  private decisionLog: LLMDecisionLog[] = [];
  private dailyTokenCost: number = 0;
  private lastCostReset: number = Date.now();
  private promptTemplates: Map<string, PromptTemplate> = new Map();
  
  // Async signal cache
  private cachedSignal: LLMTradingSignal | null = null;
  private cacheTimestamp: number = 0;
  private cacheValidityMs: number = 5000; // 5 seconds cache
  private signalFetchInProgress: boolean = false;
  private pendingMarketData: MarketDataForLLM | null = null;

  // Default templates
  private readonly DEFAULT_MARKET_ANALYSIS_PROMPT = `You are an expert quantitative trader and financial analyst. Your task is to analyze market data and provide trading recommendations.

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

  private readonly DEFAULT_RISK_ASSESSMENT_PROMPT = `You are a risk management expert. Analyze the current market conditions and assess the risk level.

Output a JSON object:
{
  "riskLevel": "low" | "medium" | "high",
  "riskFactors": ["list of identified risk factors"],
  "recommendedPositionSize": 0.0-1.0,
  "stopLossSuggestion": <suggested stop loss price or null>,
  "takeProfitSuggestion": <suggested take profit price or null>
}

Consider:
1. Market volatility
2. Recent price movements
3. Liquidity conditions
4. Correlation with broader market
5. Potential black swan events`;

  private readonly DEFAULT_TRADING_DECISION_PROMPT = `Based on the market analysis and risk assessment, make a final trading decision.

Market Analysis: {marketAnalysis}
Risk Assessment: {riskAssessment}
Current Position: {position}
Available Cash: {cash}

Output a JSON object:
{
  "action": "buy" | "sell" | "hold",
  "confidence": 0.0-1.0,
  "reason": "comprehensive reasoning",
  "price": <entry price>,
  "quantity": <position size>,
  "riskLevel": "low" | "medium" | "high",
  "stopLoss": <stop loss price>,
  "takeProfit": <take profit price>
}`;

  constructor(config: LLMStrategyConfig) {
    super(config);

    // Validate required parameters
    if (!config.params?.llm?.model) {
      throw new Error('LLM model name is required in config.params.llm.model');
    }
  }

  /**
   * Initialize strategy
   */
  protected init(_context: StrategyContext): void {
    this.initializeLLMClient();
    this.initializePromptTemplates();
    this.lastSignalTime = 0;
    this.decisionLog = [];
    this.dailyTokenCost = 0;
    this.lastCostReset = Date.now();
    
    this.log('LLMStrategy initialized', {
      model: this.config.params?.llm?.model,
      minConfidence: this.config.params?.trading?.minConfidence ?? 0.6,
    });
  }

  /**
   * Initialize LLM client
   */
  private initializeLLMClient(): void {
    const llmConfig: LLMClientConfig = {
      apiUrl: this.config.params?.llm?.apiUrl || process.env.LLM_API_URL || 'https://space.ai-builders.com/backend',
      model: this.config.params!.llm!.model,
      temperature: this.config.params?.llm?.temperature ?? 0.7,
      maxTokens: this.config.params?.llm?.maxTokens ?? 1000,
      enableLogging: this.config.params?.enableLogging ?? false,
    };

    this.llmClient = new LLMClient(llmConfig);
    
    // Set up event listeners for monitoring
    this.llmClient.on('token-usage', (event) => {
      this.dailyTokenCost += event.usage.estimatedCost;
      this.checkDailyBudget();
    });

    this.llmClient.on('rate-limit', () => {
      this.log('Rate limit hit', {});
    });

    this.llmClient.on('error', (event) => {
      this.log('LLM client error', { error: event.error });
    });
  }

  /**
   * Initialize prompt templates
   */
  private initializePromptTemplates(): void {
    this.promptTemplates.set('market-analysis', {
      name: 'Market Analysis',
      template: this.DEFAULT_MARKET_ANALYSIS_PROMPT,
      variables: [],
    });

    this.promptTemplates.set('risk-assessment', {
      name: 'Risk Assessment',
      template: this.DEFAULT_RISK_ASSESSMENT_PROMPT,
      variables: [],
    });

    this.promptTemplates.set('trading-decision', {
      name: 'Trading Decision',
      template: this.DEFAULT_TRADING_DECISION_PROMPT,
      variables: ['marketAnalysis', 'riskAssessment', 'position', 'cash'],
    });
  }

  /**
   * Handle tick event - main trading logic
   */
  onTick(context: StrategyContext): OrderSignal | null {
    try {
      // Check cooldown period
      if (!this.checkCooldown()) {
        return null;
      }

      // Check daily budget
      if (!this.checkDailyBudget()) {
        this.log('Daily budget exceeded, skipping signal generation', {
          dailyCost: this.dailyTokenCost,
          budget: this.config.params?.rateLimit?.dailyBudget,
        });
        return null;
      }

      // Get market data
      const marketData = context.getMarketData();
      
      // Format market data for LLM
      const marketDataForLLM = this.formatMarketData(marketData, context);
      
      // Store for async fetch
      this.pendingMarketData = marketDataForLLM;

      // Trigger async signal fetch if cache is stale
      if (this.isCacheStale() && !this.signalFetchInProgress) {
        this.fetchSignalAsync(marketDataForLLM);
      }

      // Use cached signal if available
      const llmSignal = this.cachedSignal;
      if (!llmSignal) {
        // No signal available yet, return null
        return null;
      }

      // Apply filters and generate final signal
      const orderSignal = this.applyFilters(llmSignal, marketData, context);

      // Log decision
      this.logDecision({
        marketData: marketDataForLLM,
        llmSignal,
        orderSignal,
      });

      if (orderSignal) {
        this.lastSignalTime = Date.now();
      }

      return orderSignal;
    } catch (error: any) {
      this.log('Error in onTick', { error: error.message });
      return null;
    }
  }

  /**
   * Check if signal cache is stale
   */
  private isCacheStale(): boolean {
    if (!this.cachedSignal) return true;
    return Date.now() - this.cacheTimestamp > this.cacheValidityMs;
  }

  /**
   * Asynchronously fetch trading signal from LLM
   */
  private async fetchSignalAsync(marketData: MarketDataForLLM): Promise<void> {
    if (this.signalFetchInProgress || !this.llmClient) return;
    
    this.signalFetchInProgress = true;
    
    try {
      const customPrompt = this.getPromptTemplate('market-analysis')?.template;
      const signal = await this.llmClient.analyzeMarket(marketData, customPrompt);
      
      this.cachedSignal = signal;
      this.cacheTimestamp = Date.now();
      
      this.log('Signal fetched successfully', {
        action: signal.action,
        confidence: signal.confidence,
      });
    } catch (error: any) {
      this.log('Failed to fetch signal', { error: error.message });
    } finally {
      this.signalFetchInProgress = false;
    }
  }

  /**
   * Format market data for LLM consumption
   */
  private formatMarketData(marketData: MarketData, context: StrategyContext): MarketDataForLLM {
    const orderBook = marketData.orderBook;
    
    // Get best bid/ask
    const bestBid = orderBook.getBestBid?.();
    const bestAsk = orderBook.getBestAsk?.();
    const lastTrade = marketData.trades[0];

    // Build price history from recent trades (simplified)
    const priceHistory = marketData.trades.slice(0, 100).map(trade => ({
      timestamp: trade.timestamp,
      open: trade.price,
      high: trade.price,
      low: trade.price,
      close: trade.price,
      volume: trade.quantity,
    }));

    // Calculate simple indicators
    const indicators: MarketDataForLLM['indicators'] = {};
    if (priceHistory.length >= 20) {
      const closes = priceHistory.map(t => t.close);
      indicators.sma = this.calculateSMA(closes, 20);
      indicators.ema = this.calculateEMA(closes, 20);
    }

    return {
      symbol: this.config.id,
      bid: bestBid ?? undefined,
      ask: bestAsk ?? undefined,
      lastPrice: lastTrade?.price,
      priceHistory,
      orderBookDepth: {
        bids: [], // Could extract from order book if available
        asks: [],
      },
      recentTrades: marketData.trades.slice(0, 10).map(trade => ({
        timestamp: trade.timestamp,
        price: trade.price,
        quantity: trade.quantity,
        side: 'buy' as const, // Trade doesn't have side, derive from order IDs if needed
      })),
      indicators,
    };
  }

  /**
   * Apply filters to LLM signal
   */
  private applyFilters(
    llmSignal: LLMTradingSignal,
    marketData: MarketData,
    context: StrategyContext
  ): OrderSignal | null {
    const tradingConfig = this.config.params?.trading;
    
    // Check confidence threshold
    const minConfidence = tradingConfig?.minConfidence ?? 0.6;
    if (llmSignal.confidence < minConfidence) {
      this.log('Signal filtered: confidence too low', {
        confidence: llmSignal.confidence,
        threshold: minConfidence,
      });
      return null;
    }

    // Check risk level
    const maxRiskLevel = tradingConfig?.maxRiskLevel ?? 'high';
    const riskOrder = ['low', 'medium', 'high'];
    if (riskOrder.indexOf(llmSignal.riskLevel) > riskOrder.indexOf(maxRiskLevel)) {
      this.log('Signal filtered: risk level too high', {
        riskLevel: llmSignal.riskLevel,
        maxAllowed: maxRiskLevel,
      });
      return null;
    }

    // Hold signal - no action
    if (llmSignal.action === 'hold') {
      return null;
    }

    // Get current position and cash
    const symbol = this.config.id;
    const currentPosition = context.getPosition(symbol);
    const availableCash = context.getCash();

    // Validate action against current position
    if (llmSignal.action === 'sell' && currentPosition <= 0) {
      this.log('Signal filtered: no position to sell', { currentPosition });
      return null;
    }

    if (llmSignal.action === 'buy') {
      const suggestedPrice = llmSignal.price ?? marketData.orderBook.getBestAsk?.();
      const suggestedQuantity = llmSignal.quantity ?? tradingConfig?.quantity ?? 1;
      const requiredCash = (suggestedPrice || 0) * suggestedQuantity;

      if (requiredCash > availableCash) {
        this.log('Signal filtered: insufficient cash', {
          required: requiredCash,
          available: availableCash,
        });
        return null;
      }
    }

    // Create order signal
    const price = llmSignal.price ?? 
      (llmSignal.action === 'buy' ? marketData.orderBook.getBestAsk?.() : marketData.orderBook.getBestBid?.());
    
    const quantity = llmSignal.quantity ?? tradingConfig?.quantity ?? 1;

    if (!price) {
      this.log('Signal filtered: no valid price', {});
      return null;
    }

    return this.createSignal(llmSignal.action, price, quantity, {
      confidence: llmSignal.confidence,
      reason: llmSignal.reason,
    });
  }

  /**
   * Check cooldown period
   */
  private checkCooldown(): boolean {
    const cooldownPeriod = this.config.params?.trading?.cooldownPeriod ?? 5000; // 5 seconds default
    const elapsed = Date.now() - this.lastSignalTime;
    
    if (elapsed < cooldownPeriod && this.lastSignalTime > 0) {
      return false;
    }
    
    return true;
  }

  /**
   * Check daily budget
   */
  private checkDailyBudget(): boolean {
    // Reset daily cost if new day
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;
    if (now - this.lastCostReset > msPerDay) {
      this.dailyTokenCost = 0;
      this.lastCostReset = now;
    }

    const dailyBudget = this.config.params?.rateLimit?.dailyBudget;
    if (dailyBudget !== undefined && this.dailyTokenCost >= dailyBudget) {
      return false;
    }

    return true;
  }

  /**
   * Log decision to history
   */
  private logDecision(decision: {
    marketData: Partial<MarketDataForLLM>;
    llmSignal: LLMTradingSignal;
    orderSignal: OrderSignal | null;
  }): void {
    const llmUsage = this.llmClient?.getTokenUsage() || {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    };

    const logEntry: LLMDecisionLog = {
      timestamp: Date.now(),
      marketData: decision.marketData,
      llmSignal: decision.llmSignal,
      orderSignal: decision.orderSignal,
      filterReason: decision.orderSignal === null ? 'Filtered by rules' : undefined,
      tokenUsage: {
        promptTokens: llmUsage.promptTokens,
        completionTokens: llmUsage.completionTokens,
        totalTokens: llmUsage.totalTokens,
        cost: llmUsage.estimatedCost,
      },
    };

    this.decisionLog.push(logEntry);

    // Keep only last 1000 decisions
    if (this.decisionLog.length > 1000) {
      this.decisionLog.shift();
    }
  }

  /**
   * Get prompt template by name
   */
  getPromptTemplate(name: string): PromptTemplate | undefined {
    return this.promptTemplates.get(name);
  }

  /**
   * Set custom prompt template
   */
  setPromptTemplate(template: PromptTemplate): void {
    this.promptTemplates.set(template.name.toLowerCase(), template);
    this.log('Prompt template updated', { name: template.name });
  }

  /**
   * Get decision log
   */
  getDecisionLog(limit: number = 100): LLMDecisionLog[] {
    return this.decisionLog.slice(-limit);
  }

  /**
   * Get LLM client statistics
   */
  getLLMStats(): {
    tokenUsage: any;
    requestStats: any;
    dailyCost: number;
  } | null {
    if (!this.llmClient) {
      return null;
    }

    return {
      tokenUsage: this.llmClient.getTokenUsage(),
      requestStats: this.llmClient.getStats(),
      dailyCost: this.dailyTokenCost,
    };
  }

  /**
   * Cleanup strategy
   */
  protected cleanup(_context: StrategyContext): void {
    this.log('LLMStrategy cleanup', {
      totalDecisions: this.decisionLog.length,
      dailyCost: this.dailyTokenCost,
    });
  }

  /**
   * Simple moving average calculation
   */
  private calculateSMA(values: number[], period: number): number {
    if (values.length < period) return 0;
    const slice = values.slice(-period);
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / period;
  }

  /**
   * Exponential moving average calculation
   */
  private calculateEMA(values: number[], period: number): number {
    if (values.length < period) return 0;
    const multiplier = 2 / (period + 1);
    let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    for (let i = period; i < values.length; i++) {
      ema = (values[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  /**
   * Log message if logging is enabled
   */
  private log(message: string, data?: any): void {
    if (this.config.params?.enableLogging) {
      console.log(`[LLMStrategy:${this.config.id}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }
}
