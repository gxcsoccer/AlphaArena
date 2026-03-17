/**
 * Time Series Prediction Strategy
 *
 * Uses LSTM/Transformer models for price prediction
 */

import { StrategyContext, OrderSignal, MarketData } from '../types';
import { FeatureVector, TimeSeriesPredictionResult, PredictionResult } from './MLTypes';
import { MLStrategy, MLStrategyConfig } from './MLStrategy';

/**
 * Time Series Prediction Strategy configuration
 */
export interface TimeSeriesStrategyConfig extends MLStrategyConfig {
  params?: MLStrategyConfig['params'] & {
    /** Prediction-specific parameters */
    prediction?: {
      /** Number of future steps to predict */
      horizon?: number;
      /** Use confidence intervals for trading */
      useConfidenceIntervals?: boolean;
      /** Minimum price change percentage to trade */
      minPriceChangePercent?: number;
      /** Position sizing based on prediction confidence */
      positionSizingMethod?: 'fixed' | 'confidence-based' | 'volatility-adjusted';
    };
  };
}

/**
 * Time Series Prediction Strategy - 时间序列预测策略
 *
 * Predicts future prices using neural network models:
 * - LSTM for sequential patterns
 * - Transformer for attention-based prediction
 * - Confidence intervals for risk management
 */
export class TimeSeriesPredictionStrategy extends MLStrategy {
  private priceHistory: number[] = [];
  private predictionHistory: TimeSeriesPredictionResult[] = [];
  private readonly horizon: number;
  private readonly useConfidenceIntervals: boolean;
  private readonly minPriceChangePercent: number;
  private readonly positionSizingMethod: string;

  constructor(config: TimeSeriesStrategyConfig) {
    super(config);
    
    this.horizon = config.params?.prediction?.horizon ?? 5;
    this.useConfidenceIntervals = config.params?.prediction?.useConfidenceIntervals ?? true;
    this.minPriceChangePercent = config.params?.prediction?.minPriceChangePercent ?? 0.5;
    this.positionSizingMethod = config.params?.prediction?.positionSizingMethod ?? 'fixed';
  }

  /**
   * Make a prediction
   */
  protected predict(features: FeatureVector): PredictionResult | null {
    // Get current price from features
    const currentPrice = features.values[features.names.indexOf('price')] || 
                         features.values[0];
    
    this.priceHistory.push(currentPrice);
    if (this.priceHistory.length > 100) {
      this.priceHistory.shift();
    }

    // If we have a model, use it
    if (this.model && typeof this.model.predict === 'function') {
      try {
        const modelPrediction = this.model.predict(features.values);
        return this.createTimeSeriesResult(modelPrediction, features);
      } catch (error: any) {
        this.log('Model prediction failed', { error: error.message });
      }
    }

    // Fallback: Simple linear extrapolation
    return this.linearExtrapolation(features);
  }

  /**
   * Create time series prediction result
   */
  private createTimeSeriesResult(
    modelOutput: any,
    features: FeatureVector
  ): TimeSeriesPredictionResult {
    const predictions = Array.isArray(modelOutput) ? modelOutput : [modelOutput];
    const horizon = predictions.length;
    
    // Calculate confidence based on model output or variance
    const confidence = this.calculateConfidence(predictions);
    
    // Calculate confidence intervals (simplified)
    const std = this.calculatePredictionStd(predictions);
    const currentPrice = features.values[features.names.indexOf('price')] || features.values[0];

    const result: TimeSeriesPredictionResult = {
      prediction: predictions,
      predictions,
      confidence,
      timestamp: Date.now(),
      modelId: this.mlConfig.model.modelId || 'builtin',
      horizon,
      confidenceIntervals: this.useConfidenceIntervals ? {
        lower: predictions.map(p => p - std * 1.96),
        upper: predictions.map(p => p + std * 1.96),
      } : undefined,
    };

    this.predictionHistory.push(result);
    if (this.predictionHistory.length > 100) {
      this.predictionHistory.shift();
    }

    return result;
  }

  /**
   * Linear extrapolation fallback
   */
  private linearExtrapolation(features: FeatureVector): TimeSeriesPredictionResult {
    if (this.priceHistory.length < 5) {
      // Not enough data
      const currentPrice = features.values[features.names.indexOf('price')] || features.values[0];
      return {
        prediction: Array(this.horizon).fill(currentPrice),
        predictions: Array(this.horizon).fill(currentPrice),
        confidence: 0.1,
        timestamp: Date.now(),
        modelId: 'linear-extrapolation',
        horizon: this.horizon,
      };
    }

    // Calculate linear trend
    const recentPrices = this.priceHistory.slice(-20);
    const n = recentPrices.length;
    const xMean = (n - 1) / 2;
    const yMean = recentPrices.reduce((a, b) => a + b, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (recentPrices[i] - yMean);
      denominator += Math.pow(i - xMean, 2);
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = yMean - slope * xMean;
    const currentPrice = recentPrices[n - 1];

    // Generate predictions
    const predictions: number[] = [];
    for (let i = 1; i <= this.horizon; i++) {
      predictions.push(intercept + slope * (n - 1 + i));
    }

    // Confidence based on R-squared
    const rSquared = this.calculateRSquared(recentPrices, slope, intercept);
    const confidence = Math.max(0.1, Math.min(0.9, rSquared));

    return {
      prediction: predictions,
      predictions,
      confidence,
      timestamp: Date.now(),
      modelId: 'linear-extrapolation',
      horizon: this.horizon,
      confidenceIntervals: {
        lower: predictions.map(p => p * 0.98),
        upper: predictions.map(p => p * 1.02),
      },
    };
  }

  /**
   * Calculate R-squared for trend line
   */
  private calculateRSquared(
    prices: number[],
    slope: number,
    intercept: number
  ): number {
    const n = prices.length;
    const yMean = prices.reduce((a, b) => a + b, 0) / n;
    
    let ssRes = 0;
    let ssTot = 0;
    
    for (let i = 0; i < n; i++) {
      const predicted = intercept + slope * i;
      ssRes += Math.pow(prices[i] - predicted, 2);
      ssTot += Math.pow(prices[i] - yMean, 2);
    }
    
    return ssTot > 0 ? 1 - (ssRes / ssTot) : 0;
  }

  /**
   * Calculate confidence from predictions
   */
  private calculateConfidence(predictions: number[]): number {
    if (predictions.length < 2) return 0.5;
    
    // Confidence based on prediction consistency
    const variance = this.calculateVariance(predictions);
    const mean = predictions.reduce((a, b) => a + b, 0) / predictions.length;
    
    // Lower variance = higher confidence
    const cv = Math.sqrt(variance) / Math.abs(mean); // Coefficient of variation
    const confidence = Math.max(0.1, Math.min(0.95, 1 - cv));
    
    return confidence;
  }

  /**
   * Calculate prediction standard deviation
   */
  private calculatePredictionStd(predictions: number[]): number {
    if (predictions.length < 2) return 0;
    return Math.sqrt(this.calculateVariance(predictions));
  }

  /**
   * Calculate variance
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  }

  /**
   * Apply filters to generate order signal
   */
  protected applyFilters(
    prediction: PredictionResult,
    marketData: MarketData,
    context: StrategyContext
  ): OrderSignal | null {
    const tsPrediction = prediction as TimeSeriesPredictionResult;
    const predictions = tsPrediction.predictions;
    
    if (predictions.length === 0) return null;

    // Get current price
    const orderBook = marketData.orderBook;
    const currentPrice = orderBook.getBestAsk?.() || 
                         orderBook.getBestBid?.() || 
                         this.priceHistory[this.priceHistory.length - 1];
    
    if (!currentPrice) return null;

    // Calculate expected price change
    const predictedPrice = predictions[0]; // Next step prediction
    const priceChangePercent = ((predictedPrice - currentPrice) / currentPrice) * 100;

    // Check minimum price change threshold
    if (Math.abs(priceChangePercent) < this.minPriceChangePercent) {
      this.log('Price change below threshold', {
        predicted: predictedPrice,
        current: currentPrice,
        changePercent: priceChangePercent,
        threshold: this.minPriceChangePercent,
      });
      return null;
    }

    // Check confidence
    if (!this.checkConfidence(prediction.confidence)) {
      this.log('Confidence below threshold', {
        confidence: prediction.confidence,
        threshold: this.mlConfig.prediction.minConfidence,
      });
      return null;
    }

    // Determine trade direction
    const side = priceChangePercent > 0 ? 'buy' : 'sell';
    
    // Check position constraints
    const symbol = this.config.id;
    const currentPosition = context.getPosition(symbol);
    
    if (side === 'sell' && currentPosition <= 0) {
      this.log('No position to sell', { currentPosition });
      return null;
    }

    // Calculate quantity
    const quantity = this.calculateQuantity(
      prediction.confidence,
      currentPrice,
      context.getCash(),
      side
    );

    // Validate cash for buy orders
    if (side === 'buy') {
      const requiredCash = currentPrice * quantity;
      if (requiredCash > context.getCash()) {
        this.log('Insufficient cash', {
          required: requiredCash,
          available: context.getCash(),
        });
        return null;
      }
    }

    // Set stop loss and take profit if using confidence intervals
    const lower = tsPrediction.confidenceIntervals?.lower?.[0];
    const upper = tsPrediction.confidenceIntervals?.upper?.[0];

    return this.createSignal(side, currentPrice, quantity, {
      confidence: prediction.confidence,
      reason: `Predicted ${priceChangePercent.toFixed(2)}% move to ${predictedPrice.toFixed(2)}`,
      bid: orderBook.getBestBid?.() ?? undefined,
      ask: orderBook.getBestAsk?.() ?? undefined,
    });
  }

  /**
   * Calculate order quantity
   */
  private calculateQuantity(
    confidence: number,
    price: number,
    availableCash: number,
    side: 'buy' | 'sell'
  ): number {
    const baseQuantity = this.config.params?.trading?.quantity ?? 10;

    switch (this.positionSizingMethod) {
      case 'confidence-based':
        // Scale by confidence
        return Math.floor(baseQuantity * confidence);
      
      case 'volatility-adjusted':
        // Adjust based on recent volatility
        const volatility = this.calculateVolatility();
        const volatilityFactor = Math.max(0.5, 1 - volatility);
        return Math.floor(baseQuantity * volatilityFactor);
      
      default:
        return baseQuantity;
    }
  }

  /**
   * Calculate recent volatility
   */
  private calculateVolatility(): number {
    if (this.priceHistory.length < 10) return 0.02;
    
    const recent = this.priceHistory.slice(-10);
    const returns: number[] = [];
    
    for (let i = 1; i < recent.length; i++) {
      returns.push((recent[i] - recent[i - 1]) / recent[i - 1]);
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Get prediction history
   */
  getPredictionHistory(): TimeSeriesPredictionResult[] {
    return [...this.predictionHistory];
  }

  /**
   * Get price history
   */
  getPriceHistory(): number[] {
    return [...this.priceHistory];
  }

  /**
   * Evaluate prediction accuracy
   */
  evaluatePredictions(): {
    mae: number;
    rmse: number;
    directionAccuracy: number;
    withinInterval: number;
  } {
    if (this.predictionHistory.length < 2 || this.priceHistory.length < 2) {
      return { mae: 0, rmse: 0, directionAccuracy: 0, withinInterval: 0 };
    }

    let absErrors: number[] = [];
    let correctDirections = 0;
    let withinInterval = 0;
    let total = 0;

    // Compare predictions with actual prices
    for (let i = 1; i < this.predictionHistory.length && i < this.priceHistory.length; i++) {
      const pred = this.predictionHistory[i - 1];
      const actual = this.priceHistory[i];
      
      if (pred.predictions[0] !== undefined) {
        const error = Math.abs(pred.predictions[0] - actual);
        absErrors.push(error);
        
        // Direction accuracy
        const predictedDir = pred.predictions[0] > this.priceHistory[i - 1];
        const actualDir = actual > this.priceHistory[i - 1];
        if (predictedDir === actualDir) correctDirections++;
        
        // Within confidence interval
        if (pred.confidenceIntervals) {
          const lower = pred.confidenceIntervals.lower[0];
          const upper = pred.confidenceIntervals.upper[0];
          if (actual >= lower && actual <= upper) withinInterval++;
        }
        
        total++;
      }
    }

    const mae = absErrors.length > 0 
      ? absErrors.reduce((a, b) => a + b, 0) / absErrors.length 
      : 0;
    const rmse = absErrors.length > 0
      ? Math.sqrt(absErrors.reduce((sum, e) => sum + e * e, 0) / absErrors.length)
      : 0;

    return {
      mae,
      rmse,
      directionAccuracy: total > 0 ? correctDirections / total : 0,
      withinInterval: total > 0 ? withinInterval / total : 0,
    };
  }
}
