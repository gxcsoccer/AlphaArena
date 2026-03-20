/**
 * Anomaly Detection Strategy
 *
 * Detects price anomalies and generates trading signals
 */

import { StrategyContext, OrderSignal, MarketData } from '../types';
import { FeatureVector, AnomalyResult, PredictionResult } from './MLTypes';
import { MLStrategy, MLStrategyConfig } from './MLStrategy';

/**
 * Anomaly Detection Strategy configuration
 */
export interface AnomalyDetectionStrategyConfig extends MLStrategyConfig {
  params?: MLStrategyConfig['params'] & {
    /** Anomaly detection parameters */
    anomaly?: {
      /** Anomaly score threshold (0-1) */
      threshold?: number;
      /** Types of anomalies to detect */
      detectTypes?: ('spike' | 'drop' | 'volatility' | 'pattern-break')[];
      /** Action to take on anomaly */
      action?: 'alert' | 'trade' | 'both';
      /** Minimum anomaly severity to trade */
      minSeverity?: 'low' | 'medium' | 'high';
      /** Use statistical methods for detection */
      useStatisticalMethods?: boolean;
      /** Z-score threshold for statistical detection */
      zscoreThreshold?: number;
    };
  };
}

/**
 * Anomaly Detection Strategy - 异常检测策略
 *
 * Detects market anomalies using statistical and ML methods:
 * - Price spikes and drops
 * - Volatility anomalies
 * - Pattern breaks
 */
export class AnomalyDetectionStrategy extends MLStrategy {
  private priceHistory: number[] = [];
  private volumeHistory: number[] = [];
  private anomalyHistory: AnomalyResult[] = [];
  
  private readonly threshold: number;
  private readonly detectTypes: string[];
  private readonly action: string;
  private readonly minSeverity: string;
  private readonly useStatisticalMethods: boolean;
  private readonly zscoreThreshold: number;

  // Statistics cache
  private statsCache: {
    mean: number;
    std: number;
    volumeMean: number;
    volumeStd: number;
    lastUpdate: number;
  } | null = null;

  constructor(config: AnomalyDetectionStrategyConfig) {
    super(config);
    
    this.threshold = config.params?.anomaly?.threshold ?? 0.7;
    this.detectTypes = config.params?.anomaly?.detectTypes ?? ['spike', 'drop', 'volatility'];
    this.action = config.params?.anomaly?.action ?? 'alert';
    this.minSeverity = config.params?.anomaly?.minSeverity ?? 'medium';
    this.useStatisticalMethods = config.params?.anomaly?.useStatisticalMethods ?? true;
    this.zscoreThreshold = config.params?.anomaly?.zscoreThreshold ?? 2.5;
  }

  /**
   * Make a prediction
   */
  protected predict(features: FeatureVector): PredictionResult | null {
    // Get current price and volume
    const names = features.names;
    const values = features.values;
    
    const priceIdx = names.indexOf('price');
    const volumeIdx = names.indexOf('volume');
    
    const price = priceIdx >= 0 ? values[priceIdx] : values[0];
    const volume = volumeIdx >= 0 ? values[volumeIdx] : 0;

    // Update history
    this.priceHistory.push(price);
    this.volumeHistory.push(volume);
    
    if (this.priceHistory.length > 200) this.priceHistory.shift();
    if (this.volumeHistory.length > 200) this.volumeHistory.shift();

    // Update statistics
    this.updateStatistics();

    // If we have a model, use it
    if (this.model && typeof this.model.predict === 'function') {
      try {
        const modelOutput = this.model.predict(values);
        return this.createAnomalyResult(modelOutput, features, price);
      } catch (error: any) {
        this.log('Model prediction failed', { error: error.message });
      }
    }

    // Fallback: Statistical anomaly detection
    if (this.useStatisticalMethods) {
      return this.statisticalAnomalyDetection(features, price, volume);
    }

    return null;
  }

  /**
   * Create anomaly result from model output
   */
  private createAnomalyResult(
    modelOutput: any,
    features: FeatureVector,
    price: number
  ): AnomalyResult {
    const anomalyScore = typeof modelOutput === 'number' 
      ? modelOutput 
      : (modelOutput.score || modelOutput.anomaly_score || 0);
    
    const isAnomaly = anomalyScore >= this.threshold;
    
    // Determine anomaly type
    let anomalyType: 'spike' | 'drop' | 'volatility' | 'pattern-break' | undefined;
    if (isAnomaly) {
      const prevPrice = this.priceHistory[this.priceHistory.length - 2] || price;
      const change = (price - prevPrice) / prevPrice;
      
      if (change > 0.02) anomalyType = 'spike';
      else if (change < -0.02) anomalyType = 'drop';
      else anomalyType = 'volatility';
    }

    // Determine severity
    let severity: 'low' | 'medium' | 'high' = 'low';
    if (anomalyScore > 0.9) severity = 'high';
    else if (anomalyScore > 0.8) severity = 'medium';

    const result: AnomalyResult = {
      prediction: anomalyScore,
      confidence: anomalyScore,
      timestamp: Date.now(),
      modelId: this.mlConfig.model.modelId || 'builtin',
      isAnomaly,
      anomalyScore,
      anomalyType,
      severity,
    };

    if (isAnomaly) {
      this.anomalyHistory.push(result);
      if (this.anomalyHistory.length > 100) this.anomalyHistory.shift();
    }

    return result;
  }

  /**
   * Statistical anomaly detection
   */
  private statisticalAnomalyDetection(
    features: FeatureVector,
    price: number,
    volume: number
  ): AnomalyResult {
    if (!this.statsCache || this.priceHistory.length < 20) {
      return {
        prediction: 0,
        confidence: 0,
        timestamp: Date.now(),
        modelId: 'statistical',
        isAnomaly: false,
        anomalyScore: 0,
      };
    }

    const { mean, std, volumeMean, volumeStd } = this.statsCache;
    
    // Calculate z-scores
    const priceZscore = std > 0 ? Math.abs((price - mean) / std) : 0;
    const volumeZscore = volumeStd > 0 ? Math.abs((volume - volumeMean) / volumeStd) : 0;
    
    // Detect anomaly types
    const anomalies: { type: string; score: number }[] = [];

    // Price spike/drop detection
    if (this.detectTypes.includes('spike') || this.detectTypes.includes('drop')) {
      if (priceZscore > this.zscoreThreshold) {
        const prevPrice = this.priceHistory[this.priceHistory.length - 2] || price;
        const type = price > prevPrice ? 'spike' : 'drop';
        anomalies.push({
          type,
          score: Math.min(1, priceZscore / (this.zscoreThreshold * 2)),
        });
      }
    }

    // Volume anomaly
    if (volumeZscore > this.zscoreThreshold * 1.5) {
      anomalies.push({
        type: 'volatility',
        score: Math.min(1, volumeZscore / (this.zscoreThreshold * 2)),
      });
    }

    // Volatility detection
    if (this.detectTypes.includes('volatility')) {
      const volatility = this.calculateRecentVolatility();
      if (volatility > 0.05) {
        anomalies.push({
          type: 'volatility',
          score: Math.min(1, volatility / 0.1),
        });
      }
    }

    // Pattern break detection
    if (this.detectTypes.includes('pattern-break')) {
      const patternBreak = this.detectPatternBreak();
      if (patternBreak > 0.5) {
        anomalies.push({
          type: 'pattern-break',
          score: patternBreak,
        });
      }
    }

    // Calculate overall anomaly score
    const maxScore = anomalies.length > 0 
      ? Math.max(...anomalies.map(a => a.score))
      : 0;
    
    const isAnomaly = maxScore >= this.threshold;
    const anomalyType = anomalies.length > 0 
      ? anomalies.sort((a, b) => b.score - a.score)[0].type as any
      : undefined;

    // Determine severity
    let severity: 'low' | 'medium' | 'high' = 'low';
    if (maxScore > 0.9) severity = 'high';
    else if (maxScore > 0.8) severity = 'medium';

    const result: AnomalyResult = {
      prediction: maxScore,
      confidence: maxScore,
      timestamp: Date.now(),
      modelId: 'statistical',
      isAnomaly,
      anomalyScore: maxScore,
      anomalyType,
      severity,
    };

    if (isAnomaly) {
      this.anomalyHistory.push(result);
      if (this.anomalyHistory.length > 100) {
        this.anomalyHistory.shift();
      }
      
      this.log('Anomaly detected', {
        type: anomalyType,
        score: maxScore,
        severity,
        price,
        priceZscore,
        volumeZscore,
      });
    }

    return result;
  }

  /**
   * Update statistics cache
   */
  private updateStatistics(): void {
    if (this.priceHistory.length < 20) return;
    
    const now = Date.now();
    if (this.statsCache && now - this.statsCache.lastUpdate < 1000) {
      return; // Update every second
    }

    const prices = this.priceHistory.slice(-100);
    const volumes = this.volumeHistory.slice(-100);

    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    const std = Math.sqrt(variance);

    const volumeMean = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const volumeVariance = volumes.reduce((sum, v) => sum + Math.pow(v - volumeMean, 2), 0) / volumes.length;
    const volumeStd = Math.sqrt(volumeVariance);

    this.statsCache = {
      mean,
      std,
      volumeMean,
      volumeStd,
      lastUpdate: now,
    };
  }

  /**
   * Calculate recent volatility
   */
  private calculateRecentVolatility(): number {
    if (this.priceHistory.length < 10) return 0;
    
    const recent = this.priceHistory.slice(-10);
    const returns: number[] = [];
    
    for (let i = 1; i < recent.length; i++) {
      const r = (recent[i] - recent[i - 1]) / recent[i - 1];
      returns.push(r);
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Detect pattern break
   */
  private detectPatternBreak(): number {
    if (this.priceHistory.length < 30) return 0;
    
    const recent = this.priceHistory.slice(-30);
    
    // Calculate trend consistency
    let upMoves = 0;
    let downMoves = 0;
    
    for (let i = 1; i < recent.length; i++) {
      if (recent[i] > recent[i - 1]) upMoves++;
      else if (recent[i] < recent[i - 1]) downMoves++;
    }
    
    // Calculate expected pattern
    const totalMoves = upMoves + downMoves;
    if (totalMoves === 0) return 0;
    
    const expectedRatio = Math.max(upMoves, downMoves) / totalMoves;
    
    // Check recent break
    const last5Moves = recent.slice(-6);
    let recentUp = 0;
    let recentDown = 0;
    
    for (let i = 1; i < last5Moves.length; i++) {
      if (last5Moves[i] > last5Moves[i - 1]) recentUp++;
      else if (last5Moves[i] < last5Moves[i - 1]) recentDown++;
    }
    
    const recentRatio = Math.max(recentUp, recentDown) / 5;
    
    // Pattern break if recent ratio is significantly different
    if (expectedRatio > 0.7 && recentRatio < 0.5) {
      return 1 - (recentRatio / expectedRatio);
    }
    
    return 0;
  }

  /**
   * Apply filters to generate order signal
   */
  protected applyFilters(
    prediction: PredictionResult,
    marketData: MarketData,
    context: StrategyContext
  ): OrderSignal | null {
    const anomalyPred = prediction as AnomalyResult;
    
    // Not an anomaly
    if (!anomalyPred.isAnomaly) {
      return null;
    }

    // Check severity threshold
    const severityOrder = { low: 1, medium: 2, high: 3 };
    const minSeverityLevel = severityOrder[this.minSeverity as keyof typeof severityOrder] || 2;
    const currentSeverity = severityOrder[anomalyPred.severity || 'low'];
    
    if (currentSeverity < minSeverityLevel) {
      this.log('Anomaly severity below threshold', {
        severity: anomalyPred.severity,
        minSeverity: this.minSeverity,
      });
      return null;
    }

    // If action is 'alert' only, don't trade
    if (this.action === 'alert') {
      this.log('Anomaly alert only', {
        type: anomalyPred.anomalyType,
        score: anomalyPred.anomalyScore,
      });
      return null;
    }

    // Determine trade direction based on anomaly type
    const orderBook = marketData.orderBook;
    let side: 'buy' | 'sell';
    
    switch (anomalyPred.anomalyType) {
      case 'spike': {
        // Price spike - potential mean reversion (sell)
        side = 'sell';
        break;
      }
      case 'drop': {
        // Price drop - potential mean reversion (buy)
        side = 'buy';
        break;
      }
      case 'volatility': {
        // High volatility - reduce position (sell)
        side = 'sell';
        break;
      }
      case 'pattern-break': {
        // Pattern break - follow the break direction
        const lastPrice = this.priceHistory[this.priceHistory.length - 1];
        const prevPrice = this.priceHistory[this.priceHistory.length - 2] || lastPrice;
        side = lastPrice > prevPrice ? 'buy' : 'sell';
        break;
      }
      default: {
        // Default: don't trade
        return null;
      }
    }

    // Check position constraints
    const symbol = this.config.id;
    const currentPosition = context.getPosition(symbol);
    
    if (side === 'sell' && currentPosition <= 0) {
      this.log('No position to sell on anomaly', { currentPosition });
      return null;
    }

    // Calculate price and quantity
    const price = side === 'buy'
      ? (orderBook.getBestAsk?.() || orderBook.getBestBid?.() || 0)
      : (orderBook.getBestBid?.() || orderBook.getBestAsk?.() || 0);

    if (!price) return null;

    const quantity = this.calculateQuantity(anomalyPred, context.getCash(), price, side);

    // Validate cash for buy orders
    if (side === 'buy') {
      const requiredCash = price * quantity;
      if (requiredCash > context.getCash()) {
        this.log('Insufficient cash for anomaly trade', {
          required: requiredCash,
          available: context.getCash(),
        });
        return null;
      }
    }

    return this.createSignal(side, price, quantity, {
      confidence: anomalyPred.confidence,
      reason: `Anomaly: ${anomalyPred.anomalyType} (${anomalyPred.severity})`,
      bid: orderBook.getBestBid?.() ?? undefined,
      ask: orderBook.getBestAsk?.() ?? undefined,
    });
  }

  /**
   * Calculate order quantity for anomaly trade
   */
  private calculateQuantity(
    anomaly: AnomalyResult,
    availableCash: number,
    price: number,
    side: 'buy' | 'sell'
  ): number {
    const baseQuantity = this.config.params?.trading?.quantity ?? 10;
    
    // Reduce position size for anomaly trades (risk management)
    const riskFactor = anomaly.severity === 'high' ? 0.5 
                     : anomaly.severity === 'medium' ? 0.75 
                     : 1;
    
    const adjustedQuantity = Math.floor(baseQuantity * riskFactor);
    
    if (side === 'buy') {
      const maxAffordable = Math.floor(availableCash / price);
      return Math.min(adjustedQuantity, maxAffordable);
    }
    
    return adjustedQuantity;
  }

  /**
   * Get anomaly history
   */
  getAnomalyHistory(): AnomalyResult[] {
    return [...this.anomalyHistory];
  }

  /**
   * Get anomaly statistics
   */
  getStatistics(): {
    totalAnomalies: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    avgScore: number;
  } {
    const history = this.anomalyHistory;
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let totalScore = 0;

    for (const anomaly of history) {
      const type = anomaly.anomalyType || 'unknown';
      const severity = anomaly.severity || 'low';
      
      byType[type] = (byType[type] || 0) + 1;
      bySeverity[severity] = (bySeverity[severity] || 0) + 1;
      totalScore += anomaly.anomalyScore;
    }

    return {
      totalAnomalies: history.length,
      byType,
      bySeverity,
      avgScore: history.length > 0 ? totalScore / history.length : 0,
    };
  }
}
