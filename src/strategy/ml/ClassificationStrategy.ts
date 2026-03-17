/**
 * Classification Strategy
 *
 * Classifies market conditions as buy/sell/hold signals
 */

import { StrategyContext, OrderSignal, MarketData } from '../types';
import { FeatureVector, ClassificationResult, PredictionResult } from './MLTypes';
import { MLStrategy, MLStrategyConfig } from './MLStrategy';

/**
 * Classification Strategy configuration
 */
export interface ClassificationStrategyConfig extends MLStrategyConfig {
  params?: MLStrategyConfig['params'] & {
    /** Classification-specific parameters */
    classification?: {
      /** Minimum probability for the predicted class */
      minProbability?: number;
      /** Use probability threshold for signal generation */
      useProbabilityThreshold?: boolean;
      /** Class weights for imbalanced data */
      classWeights?: {
        buy: number;
        sell: number;
        hold: number;
      };
      /** Enable multi-class voting */
      enableVoting?: boolean;
      /** Number of recent predictions to vote on */
      votingWindow?: number;
    };
  };
}

/**
 * Classification Strategy - 分类信号策略
 *
 * Predicts market direction using classification models:
 * - Buy/Sell/Hold classification
 * - Probability-based decision making
 * - Multi-class voting for stability
 */
export class ClassificationStrategy extends MLStrategy {
  private predictionHistory: ClassificationResult[] = [];
  private readonly minProbability: number;
  private readonly useProbabilityThreshold: boolean;
  private readonly classWeights: { buy: number; sell: number; hold: number };
  private readonly enableVoting: boolean;
  private readonly votingWindow: number;

  // Feature history for voting
  private featureHistory: FeatureVector[] = [];

  constructor(config: ClassificationStrategyConfig) {
    super(config);
    
    this.minProbability = config.params?.classification?.minProbability ?? 0.6;
    this.useProbabilityThreshold = config.params?.classification?.useProbabilityThreshold ?? true;
    this.classWeights = config.params?.classification?.classWeights ?? {
      buy: 1.0,
      sell: 1.0,
      hold: 1.0,
    };
    this.enableVoting = config.params?.classification?.enableVoting ?? false;
    this.votingWindow = config.params?.classification?.votingWindow ?? 5;
  }

  /**
   * Make a prediction
   */
  protected predict(features: FeatureVector): PredictionResult | null {
    // Store feature history
    this.featureHistory.push(features);
    if (this.featureHistory.length > this.votingWindow * 2) {
      this.featureHistory.shift();
    }

    // If we have a model, use it
    if (this.model && typeof this.model.predict === 'function') {
      try {
        const modelOutput = this.model.predict(features.values);
        return this.createClassificationResult(modelOutput, features);
      } catch (error: any) {
        this.log('Model prediction failed', { error: error.message });
      }
    }

    // Fallback: Rule-based classification
    return this.ruleBasedClassification(features);
  }

  /**
   * Create classification result from model output
   */
  private createClassificationResult(
    modelOutput: any,
    features: FeatureVector
  ): ClassificationResult {
    // Assume model outputs probabilities [buy, sell, hold] or class index
    let probabilities: { buy: number; sell: number; hold: number };
    
    if (Array.isArray(modelOutput)) {
      // Assume [buy_prob, sell_prob, hold_prob]
      probabilities = {
        buy: modelOutput[0] || 0,
        sell: modelOutput[1] || 0,
        hold: modelOutput[2] || 0,
      };
    } else if (typeof modelOutput === 'object') {
      probabilities = modelOutput;
    } else {
      // Assume class index
      const idx = Number(modelOutput);
      probabilities = { buy: 0, sell: 0, hold: 0 };
      if (idx === 0) probabilities.buy = 1;
      else if (idx === 1) probabilities.sell = 1;
      else probabilities.hold = 1;
    }

    // Apply class weights
    probabilities = {
      buy: probabilities.buy * this.classWeights.buy,
      sell: probabilities.sell * this.classWeights.sell,
      hold: probabilities.hold * this.classWeights.hold,
    };

    // Normalize
    const total = probabilities.buy + probabilities.sell + probabilities.hold;
    if (total > 0) {
      probabilities = {
        buy: probabilities.buy / total,
        sell: probabilities.sell / total,
        hold: probabilities.hold / total,
      };
    }

    // Determine class
    const maxProb = Math.max(probabilities.buy, probabilities.sell, probabilities.hold);
    let predictedClass: 'buy' | 'sell' | 'hold';
    
    if (probabilities.buy === maxProb) predictedClass = 'buy';
    else if (probabilities.sell === maxProb) predictedClass = 'sell';
    else predictedClass = 'hold';

    const result: ClassificationResult = {
      prediction: maxProb,
      confidence: maxProb,
      timestamp: Date.now(),
      modelId: this.mlConfig.model.modelId || 'builtin',
      class: predictedClass,
      probabilities,
    };

    this.predictionHistory.push(result);
    if (this.predictionHistory.length > 100) {
      this.predictionHistory.shift();
    }

    return result;
  }

  /**
   * Rule-based classification fallback
   */
  private ruleBasedClassification(features: FeatureVector): ClassificationResult {
    const names = features.names;
    const values = features.values;

    // Helper to get feature value
    const getFeature = (name: string): number => {
      const idx = names.indexOf(name);
      return idx >= 0 ? values[idx] : 0;
    };

    // Get relevant features
    const rsi = getFeature('rsi-14') || 50;
    const macd = getFeature('macd') || 0;
    const macdHistogram = getFeature('macd-histogram') || 0;
    const returns = getFeature('returns') || 0;
    
    // Calculate momentum score
    let buyScore = 0;
    let sellScore = 0;
    let holdScore = 0;

    // RSI signals
    if (rsi < 30) buyScore += 2;
    else if (rsi < 40) buyScore += 1;
    else if (rsi > 70) sellScore += 2;
    else if (rsi > 60) sellScore += 1;
    else holdScore += 1;

    // MACD signals
    if (macd > 0 && macdHistogram > 0) buyScore += 1;
    else if (macd < 0 && macdHistogram < 0) sellScore += 1;
    else holdScore += 0.5;

    // Returns momentum
    if (returns > 0.01) buyScore += 1;
    else if (returns < -0.01) sellScore += 1;
    else holdScore += 0.5;

    // Normalize to probabilities
    const total = buyScore + sellScore + holdScore;
    const probabilities = {
      buy: total > 0 ? buyScore / total : 0.33,
      sell: total > 0 ? sellScore / total : 0.33,
      hold: total > 0 ? holdScore / total : 0.34,
    };

    // Determine class
    const maxProb = Math.max(probabilities.buy, probabilities.sell, probabilities.hold);
    let predictedClass: 'buy' | 'sell' | 'hold';
    
    if (probabilities.buy === maxProb) predictedClass = 'buy';
    else if (probabilities.sell === maxProb) predictedClass = 'sell';
    else predictedClass = 'hold';

    const result: ClassificationResult = {
      prediction: maxProb,
      confidence: maxProb,
      timestamp: Date.now(),
      modelId: 'rule-based',
      class: predictedClass,
      probabilities,
    };

    this.predictionHistory.push(result);
    if (this.predictionHistory.length > 100) {
      this.predictionHistory.shift();
    }

    return result;
  }

  /**
   * Apply filters to generate order signal
   */
  protected applyFilters(
    prediction: PredictionResult,
    marketData: MarketData,
    context: StrategyContext
  ): OrderSignal | null {
    const classPred = prediction as ClassificationResult;
    
    // Hold signal - no action
    if (classPred.class === 'hold') {
      return null;
    }

    // Check confidence threshold
    if (!this.checkConfidence(prediction.confidence)) {
      this.log('Confidence below threshold', {
        confidence: prediction.confidence,
        threshold: this.mlConfig.prediction.minConfidence,
      });
      return null;
    }

    // Check probability threshold if enabled
    if (this.useProbabilityThreshold) {
      const classProb = classPred.probabilities[classPred.class];
      if (classProb < this.minProbability) {
        this.log('Class probability below threshold', {
          class: classPred.class,
          probability: classProb,
          threshold: this.minProbability,
        });
        return null;
      }
    }

    // Voting mechanism
    if (this.enableVoting && !this.checkVotingConsensus(classPred.class)) {
      this.log('No voting consensus', { predicted: classPred.class });
      return null;
    }

    // Get current price
    const orderBook = marketData.orderBook;
    const price = classPred.class === 'buy'
      ? (orderBook.getBestAsk?.() || orderBook.getBestBid?.() || 0)
      : (orderBook.getBestBid?.() || orderBook.getBestAsk?.() || 0);

    if (!price) return null;

    // Check position constraints
    const symbol = this.config.id;
    const currentPosition = context.getPosition(symbol);
    
    if (classPred.class === 'sell' && currentPosition <= 0) {
      this.log('No position to sell', { currentPosition });
      return null;
    }

    // Calculate quantity
    const quantity = this.calculateQuantity(classPred, context.getCash(), price);

    // Validate cash for buy orders
    if (classPred.class === 'buy') {
      const requiredCash = price * quantity;
      if (requiredCash > context.getCash()) {
        this.log('Insufficient cash', {
          required: requiredCash,
          available: context.getCash(),
        });
        return null;
      }
    }

    return this.createSignal(classPred.class, price, quantity, {
      confidence: prediction.confidence,
      reason: `Classification: ${classPred.class} (${(classPred.probabilities[classPred.class] * 100).toFixed(1)}%)`,
      bid: orderBook.getBestBid?.() ?? undefined,
      ask: orderBook.getBestAsk?.() ?? undefined,
    });
  }

  /**
   * Check voting consensus
   */
  private checkVotingConsensus(predictedClass: 'buy' | 'sell' | 'hold'): boolean {
    if (this.predictionHistory.length < 3) return true;

    const recent = this.predictionHistory.slice(-this.votingWindow);
    const votes = { buy: 0, sell: 0, hold: 0 };

    for (const pred of recent) {
      votes[pred.class]++;
    }

    // Check if predicted class has majority
    const majorityThreshold = Math.ceil(this.votingWindow / 2);
    return votes[predictedClass] >= majorityThreshold;
  }

  /**
   * Calculate order quantity based on prediction confidence
   */
  private calculateQuantity(
    prediction: ClassificationResult,
    availableCash: number,
    price: number
  ): number {
    const baseQuantity = this.config.params?.trading?.quantity ?? 10;
    const prob = prediction.probabilities[prediction.class];

    // Scale quantity by probability
    const scaledQuantity = Math.floor(baseQuantity * prob);
    
    // Ensure we can afford it for buy orders
    if (prediction.class === 'buy') {
      const maxAffordable = Math.floor(availableCash / price);
      return Math.min(scaledQuantity, maxAffordable);
    }

    return scaledQuantity;
  }

  /**
   * Get prediction history
   */
  getPredictionHistory(): ClassificationResult[] {
    return [...this.predictionHistory];
  }

  /**
   * Get classification statistics
   */
  getStatistics(): {
    totalPredictions: number;
    classDistribution: { buy: number; sell: number; hold: number };
    averageConfidence: number;
    recentAccuracy?: number;
  } {
    const history = this.predictionHistory;
    const distribution = { buy: 0, sell: 0, hold: 0 };
    let totalConfidence = 0;

    for (const pred of history) {
      distribution[pred.class]++;
      totalConfidence += pred.confidence;
    }

    return {
      totalPredictions: history.length,
      classDistribution: distribution,
      averageConfidence: history.length > 0 ? totalConfidence / history.length : 0,
    };
  }
}
