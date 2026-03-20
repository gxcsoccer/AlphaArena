/**
 * ML Strategy Base Class
 *
 * Abstract base class for machine learning trading strategies
 */

import { Strategy } from '../Strategy';
import { StrategyConfig, StrategyContext, OrderSignal, MarketData } from '../types';
import {
  MLStrategyBaseConfig,
  FeatureVector,
  MarketDataPoint,
  PredictionResult,
} from './MLTypes';
import { FeatureExtractor } from './FeatureExtractor';
import { ModelManager } from './ModelManager';

/**
 * ML Strategy configuration
 */
export interface MLStrategyConfig extends StrategyConfig {
  params?: {
    /** ML configuration */
    ml: MLStrategyBaseConfig;
    /** Trading parameters */
    trading?: {
      /** Default trade quantity */
      quantity?: number;
      /** Cooldown period between signals (ms) */
      cooldownPeriod?: number;
      /** Enable logging */
      enableLogging?: boolean;
    };
  };
}

/**
 * ML Strategy Decision Log
 */
export interface MLDecisionLog {
  timestamp: number;
  features: FeatureVector;
  prediction: PredictionResult | null;
  orderSignal: OrderSignal | null;
  filterReason?: string;
}

/**
 * ML Strategy Base - ML策略基类
 *
 * Provides common functionality for all ML-based strategies:
 * - Feature extraction
 * - Model management
 * - Prediction filtering
 * - Decision logging
 */
export abstract class MLStrategy extends Strategy {
  protected mlConfig: MLStrategyBaseConfig;
  protected featureExtractor: FeatureExtractor;
  protected modelManager: ModelManager;
  protected lastSignalTime: number = 0;
  protected decisionLog: MLDecisionLog[] = [];
  protected model: any = null;
  protected tickCount: number = 0;

  constructor(config: MLStrategyConfig) {
    super(config);

    if (!config.params?.ml) {
      throw new Error('ML configuration is required');
    }

    this.mlConfig = config.params.ml;
    this.featureExtractor = new FeatureExtractor(this.mlConfig.features);
    this.modelManager = new ModelManager();
  }

  /**
   * Initialize strategy
   */
  protected init(_context: StrategyContext): void {
    // Load model if specified
    if (this.mlConfig.model.modelId) {
      this.loadModel(this.mlConfig.model.modelId);
    }

    // Initialize feature extractor
    this.initializeFeatureExtractor();

    this.log('MLStrategy initialized', {
      modelType: this.mlConfig.model.type,
      features: this.mlConfig.features.features,
    });
  }

  /**
   * Handle tick event
   */
  onTick(context: StrategyContext): OrderSignal | null {
    try {
      this.tickCount++;

      // Check cooldown
      if (!this.checkCooldown()) {
        return null;
      }

      // Get market data
      const marketData = context.getMarketData();
      
      // Convert to market data points
      const dataPoints = this.convertMarketData(marketData);
      
      // Extract features
      const features = this.featureExtractor.extract(dataPoints);
      const normalizedFeatures = this.featureExtractor.normalize(features);

      // Get prediction
      const prediction = this.predict(normalizedFeatures);

      // Log decision
      this.logDecision({
        timestamp: Date.now(),
        features: normalizedFeatures,
        prediction,
        orderSignal: null,
      });

      if (!prediction) {
        return null;
      }

      // Apply filters
      const orderSignal = this.applyFilters(prediction, marketData, context);

      // Update decision log
      if (this.decisionLog.length > 0) {
        this.decisionLog[this.decisionLog.length - 1].orderSignal = orderSignal;
        if (!orderSignal) {
          this.decisionLog[this.decisionLog.length - 1].filterReason = 'Filtered by rules';
        }
      }

      // Online learning if enabled
      if (this.mlConfig.onlineLearning && this.tickCount % (this.mlConfig.updateFrequency || 100) === 0) {
        this.updateModel(normalizedFeatures, marketData);
      }

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
   * Load a model
   */
  async loadModel(modelId: string): Promise<void> {
    try {
      this.model = await this.modelManager.loadModel(modelId);
      this.log('Model loaded', { modelId });
    } catch (error: any) {
      this.log('Failed to load model', { modelId, error: error.message });
      throw error;
    }
  }

  /**
   * Save current model
   */
  async saveModel(metrics?: any): Promise<string> {
    if (!this.model) {
      throw new Error('No model to save');
    }

    const modelId = await this.modelManager.saveModel(
      this.model,
      this.config.name,
      this.mlConfig.model.type,
      metrics
    );

    this.log('Model saved', { modelId });
    return modelId;
  }

  /**
   * Get decision log
   */
  getDecisionLog(limit: number = 100): MLDecisionLog[] {
    return this.decisionLog.slice(-limit);
  }

  /**
   * Get feature extractor
   */
  getFeatureExtractor(): FeatureExtractor {
    return this.featureExtractor;
  }

  /**
   * Get model manager
   */
  getModelManager(): ModelManager {
    return this.modelManager;
  }

  // ==================== Abstract Methods ====================

  /**
   * Make a prediction - to be implemented by subclasses
   */
  protected abstract predict(features: FeatureVector): PredictionResult | null;

  /**
   * Apply filters to prediction - to be implemented by subclasses
   */
  protected abstract applyFilters(
    prediction: PredictionResult,
    marketData: MarketData,
    context: StrategyContext
  ): OrderSignal | null;

  /**
   * Update model (for online learning) - optional
   */
  protected updateModel(_features: FeatureVector, _marketData: MarketData): void {
    // Default: no-op
  }

  // ==================== Protected Methods ====================

  /**
   * Initialize feature extractor with normalization params
   */
  protected initializeFeatureExtractor(): void {
    // Override in subclasses if needed
  }

  /**
   * Convert market data to data points
   */
  protected convertMarketData(marketData: MarketData): MarketDataPoint[] {
    const dataPoints: MarketDataPoint[] = [];
    const orderBook = marketData.orderBook;
    const trades = marketData.trades;

    // Convert trades to data points
    for (const trade of trades.slice(-100).reverse()) {
      dataPoints.push({
        timestamp: trade.timestamp,
        open: trade.price,
        high: trade.price,
        low: trade.price,
        close: trade.price,
        volume: trade.quantity,
      });
    }

    // If no trades, create a point from order book
    if (dataPoints.length === 0) {
      const bestBid = orderBook.getBestBid?.() || 0;
      const bestAsk = orderBook.getBestAsk?.() || 0;
      const midPrice = (bestBid + bestAsk) / 2;

      dataPoints.push({
        timestamp: Date.now(),
        open: midPrice,
        high: bestAsk,
        low: bestBid,
        close: midPrice,
        volume: 0,
      });
    }

    return dataPoints;
  }

  /**
   * Check cooldown period
   */
  protected checkCooldown(): boolean {
    const cooldownPeriod = this.config.params?.trading?.cooldownPeriod ?? 5000;
    const elapsed = Date.now() - this.lastSignalTime;
    
    return elapsed >= cooldownPeriod || this.lastSignalTime === 0;
  }

  /**
   * Check if confidence meets threshold
   */
  protected checkConfidence(confidence: number): boolean {
    return confidence >= this.mlConfig.prediction.minConfidence;
  }

  /**
   * Log decision
   */
  protected logDecision(decision: MLDecisionLog): void {
    this.decisionLog.push(decision);

    // Keep only last 1000 decisions
    if (this.decisionLog.length > 1000) {
      this.decisionLog.shift();
    }
  }

  /**
   * Log message
   */
  protected log(message: string, data?: any): void {
    if (this.config.params?.trading?.enableLogging) {
      console.log(
        `[${this.constructor.name}:${this.config.id}] ${message}`,
        data ? JSON.stringify(data, null, 2) : ''
      );
    }
  }

  /**
   * Cleanup strategy
   */
  protected cleanup(_context: StrategyContext): void {
    this.log('MLStrategy cleanup', {
      totalDecisions: this.decisionLog.length,
      totalTicks: this.tickCount,
    });
  }

  /**
   * Helper to get optional bid/ask values
   */
  protected getOptionalBidAsk(orderBook: any): { bid?: number; ask?: number } {
    const bid = orderBook.getBestBid?.();
    const ask = orderBook.getBestAsk?.();
    return {
      bid: bid !== null && bid !== undefined ? bid : undefined,
      ask: ask !== null && ask !== undefined ? ask : undefined,
    };
  }
}
