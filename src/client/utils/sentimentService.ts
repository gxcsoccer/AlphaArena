/**
 * Sentiment Service
 * 
 * Provides market sentiment analysis and calculation functions.
 * Implements fear/greed index, volatility analysis, volume anomaly detection,
 * and multi-dimensional sentiment scoring.
 */

import type { TradingPair } from '../components/TradingPairList';
import {
  type SentimentData,
  type SentimentDimensions,
  type SentimentHistoryPoint,
  type MarketDataForSentiment,
  type SentimentConfig,
  DEFAULT_SENTIMENT_CONFIG,
  getFearGreedLevel,
  getSentimentSignal,
} from '../../utils/sentiment';
import { createLogger } from '../../utils/logger';

const log = createLogger('SentimentService');

/**
 * Calculate technical sentiment score based on price action
 * 
 * Uses RSI-like calculation based on price position relative to 24h range
 * and price momentum.
 */
export function calculateTechnicalScore(data: MarketDataForSentiment): number {
  const { high24h, low24h, price, priceChangePercent24h } = data;
  
  // Price position in 24h range (0-100)
  const range = high24h - low24h;
  let rangePosition = 50;
  if (range > 0) {
    rangePosition = ((price - low24h) / range) * 100;
  }
  
  // Momentum contribution (price change)
  // Scale price change percent to 0-100 range
  // Assuming typical daily moves of -10% to +10%
  const momentumContribution = Math.max(0, Math.min(100, 50 + priceChangePercent24h * 5));
  
  // Combine with weights
  // Higher weight on momentum for short-term sentiment
  const score = rangePosition * 0.4 + momentumContribution * 0.6;
  
  return Math.round(score);
}

/**
 * Calculate capital flow sentiment based on buy/sell pressure
 * 
 * Uses bid/ask spread and volume analysis to estimate buying vs selling pressure.
 */
export function calculateCapitalFlowScore(data: MarketDataForSentiment): number {
  const { bid, ask, volume24h, priceChangePercent24h } = data;
  
  let flowScore = 50; // Neutral baseline
  
  // Bid-ask spread analysis
  if (bid && ask) {
    const spread = ask - bid;
    const midPrice = (bid + ask) / 2;
    const spreadPercent = (spread / midPrice) * 100;
    
    // Tighter spread = more confident market = higher sentiment
    // Typical spread is 0.1% for liquid markets
    const spreadScore = Math.max(0, Math.min(100, 100 - spreadPercent * 100));
    
    // If ask is closer to mid than bid, more buying pressure
    const askDistance = ask - midPrice;
    const bidDistance = midPrice - bid;
    const pressureScore = 50 + (bidDistance - askDistance) / midPrice * 5000;
    
    flowScore = flowScore * 0.5 + spreadScore * 0.25 + pressureScore * 0.25;
  } else {
    // Fallback to price change
    flowScore = Math.max(0, Math.min(100, 50 + priceChangePercent24h * 5));
  }
  
  return Math.round(Math.max(0, Math.min(100, flowScore)));
}

/**
 * Calculate volatility sentiment score
 * 
 * Higher volatility = more fear = lower score
 */
export function calculateVolatilityScore(data: MarketDataForSentiment): number {
  const { high24h, low24h, price } = data;
  
  // Calculate 24h volatility as percentage of price
  const range = high24h - low24h;
  const volatilityPercent = (range / price) * 100;
  
  // Map volatility to score
  // Low volatility (<1%) = high score (greed/confidence)
  // High volatility (>10%) = low score (fear)
  const score = Math.max(0, Math.min(100, 100 - volatilityPercent * 10));
  
  return Math.round(score);
}

/**
 * Calculate momentum sentiment score
 * 
 * Based on price change percentage over the period.
 */
export function calculateMomentumScore(data: MarketDataForSentiment): number {
  const { priceChangePercent24h } = data;
  
  // Scale price change to 0-100 range
  // -10% daily change = 0 score (extreme fear)
  // +10% daily change = 100 score (extreme greed)
  const score = Math.max(0, Math.min(100, 50 + priceChangePercent24h * 5));
  
  return Math.round(score);
}

/**
 * Detect volume anomaly
 * 
 * Returns a score 0-100 where higher means more anomalous.
 */
export function detectVolumeAnomaly(
  currentVolume: number,
  averageVolume: number
): number {
  if (!averageVolume || averageVolume === 0) return 0;
  
  const ratio = currentVolume / averageVolume;
  
  // Ratio of 1.0 = normal (0 anomaly score)
  // Ratio of 3.0+ = highly anomalous (100 score)
  const anomalyScore = Math.max(0, Math.min(100, (ratio - 1) * 50));
  
  return Math.round(anomalyScore);
}

/**
 * Calculate overall sentiment data from market data
 */
export function calculateSentiment(
  marketData: MarketDataForSentiment,
  config: SentimentConfig = DEFAULT_SENTIMENT_CONFIG,
  previousValue?: number
): SentimentData {
  // Calculate individual dimension scores
  const technical = calculateTechnicalScore(marketData);
  const capitalFlow = calculateCapitalFlowScore(marketData);
  const volatility = calculateVolatilityScore(marketData);
  const momentum = calculateMomentumScore(marketData);
  
  const dimensions: SentimentDimensions = {
    technical,
    capitalFlow,
    volatility,
    momentum,
  };
  
  // Calculate weighted overall fear/greed index
  const fearGreedIndex = Math.round(
    technical * config.technicalWeight +
    capitalFlow * config.capitalFlowWeight +
    volatility * config.volatilityWeight +
    momentum * config.momentumWeight
  );
  
  // Determine level and signal
  const level = getFearGreedLevel(fearGreedIndex, config);
  const signal = getSentimentSignal(level);
  
  // Calculate additional metrics
  const volatilityMetric = 100 - volatility; // Invert for display
  const priceMomentum = Math.round((momentum - 50) * 2); // Scale to -100 to 100
  
  // Volume anomaly (using price as proxy for volume average)
  const volumeAnomaly = detectVolumeAnomaly(
    marketData.volume24h,
    marketData.volume24h * 0.7 // Assume average is 70% of current
  );
  
  const sentimentData: SentimentData = {
    fearGreedIndex,
    level,
    signal,
    dimensions,
    volatility: volatilityMetric,
    volumeAnomaly,
    priceMomentum,
    timestamp: new Date(),
    previousValue,
    change: previousValue !== undefined ? fearGreedIndex - previousValue : undefined,
  };
  
  log.debug('Calculated sentiment:', sentimentData);
  
  return sentimentData;
}

/**
 * Calculate aggregated market sentiment from multiple symbols
 */
export function calculateAggregatedSentiment(
  symbols: MarketDataForSentiment[],
  config: SentimentConfig = DEFAULT_SENTIMENT_CONFIG,
  previousValue?: number
): SentimentData {
  if (!symbols || symbols.length === 0) {
    // Return neutral sentiment if no data
    return {
      fearGreedIndex: 50,
      level: 'neutral',
      signal: 'neutral_hold',
      dimensions: {
        technical: 50,
        capitalFlow: 50,
        volatility: 50,
        momentum: 50,
      },
      volatility: 50,
      volumeAnomaly: 0,
      priceMomentum: 0,
      timestamp: new Date(),
      previousValue,
      change: previousValue !== undefined ? 50 - previousValue : undefined,
    };
  }
  
  // Calculate individual sentiments
  const sentiments = symbols.map(s => calculateSentiment(s, config));
  
  // Average the dimension scores
  const avgDimensions: SentimentDimensions = {
    technical: Math.round(sentiments.reduce((sum, s) => sum + s.dimensions.technical, 0) / sentiments.length),
    capitalFlow: Math.round(sentiments.reduce((sum, s) => sum + s.dimensions.capitalFlow, 0) / sentiments.length),
    volatility: Math.round(sentiments.reduce((sum, s) => sum + s.dimensions.volatility, 0) / sentiments.length),
    momentum: Math.round(sentiments.reduce((sum, s) => sum + s.dimensions.momentum, 0) / sentiments.length),
  };
  
  // Calculate weighted overall fear/greed index
  const fearGreedIndex = Math.round(
    avgDimensions.technical * config.technicalWeight +
    avgDimensions.capitalFlow * config.capitalFlowWeight +
    avgDimensions.volatility * config.volatilityWeight +
    avgDimensions.momentum * config.momentumWeight
  );
  
  const level = getFearGreedLevel(fearGreedIndex, config);
  const signal = getSentimentSignal(level);
  
  // Calculate aggregated volatility (higher = more fear)
  const avgVolatility = Math.round(
    sentiments.reduce((sum, s) => sum + s.volatility, 0) / sentiments.length
  );
  
  // Calculate aggregated momentum
  const avgMomentum = Math.round(
    sentiments.reduce((sum, s) => sum + s.priceMomentum, 0) / sentiments.length
  );
  
  // Volume anomaly (average across symbols)
  const avgVolumeAnomaly = Math.round(
    sentiments.reduce((sum, s) => sum + s.volumeAnomaly, 0) / sentiments.length
  );
  
  return {
    fearGreedIndex,
    level,
    signal,
    dimensions: avgDimensions,
    volatility: avgVolatility,
    volumeAnomaly: avgVolumeAnomaly,
    priceMomentum: avgMomentum,
    timestamp: new Date(),
    previousValue,
    change: previousValue !== undefined ? fearGreedIndex - previousValue : undefined,
  };
}

/**
 * Transform TradingPair to MarketDataForSentiment
 */
export function tradingPairToSentimentData(pair: TradingPair): MarketDataForSentiment {
  return {
    symbol: pair.symbol,
    price: pair.lastPrice,
    priceChange24h: pair.priceChange24h,
    priceChangePercent24h: pair.priceChangePercent24h,
    high24h: pair.high24h,
    low24h: pair.low24h,
    volume24h: pair.volume24h,
    bid: pair.bid,
    ask: pair.ask,
    timestamp: new Date(pair.timestamp),
  };
}

/**
 * Generate simulated historical sentiment data
 * 
 * Used for demo/testing when actual historical data is not available.
 */
export function generateHistoricalSentiment(
  currentSentiment: SentimentData,
  days: number = 30
): SentimentHistoryPoint[] {
  const history: SentimentHistoryPoint[] = [];
  const now = new Date();
  
  // Start with current sentiment and walk backwards
  let prevValue = currentSentiment.fearGreedIndex;
  
  for (let i = days; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    
    // Add some randomness to create variation
    const randomWalk = (Math.random() - 0.5) * 10;
    let value = prevValue + randomWalk;
    
    // Add mean reversion towards 50
    const meanReversion = (50 - value) * 0.1;
    value += meanReversion;
    
    // Clamp to valid range
    value = Math.max(0, Math.min(100, value));
    
    const level = getFearGreedLevel(value);
    
    // Generate dimensions with some variation
    const dimensions: SentimentDimensions = {
      technical: Math.max(0, Math.min(100, value + (Math.random() - 0.5) * 20)),
      capitalFlow: Math.max(0, Math.min(100, value + (Math.random() - 0.5) * 20)),
      volatility: Math.max(0, Math.min(100, value + (Math.random() - 0.5) * 20)),
      momentum: Math.max(0, Math.min(100, value + (Math.random() - 0.5) * 20)),
    };
    
    history.push({
      timestamp,
      fearGreedIndex: Math.round(value),
      level,
      dimensions,
      volume: 1000000 + Math.random() * 5000000,
      price: 50000 + (value - 50) * 100 + Math.random() * 1000,
    });
    
    prevValue = value;
  }
  
  return history;
}

/**
 * Check if a sentiment alert should be triggered
 */
export function checkSentimentAlert(
  alert: { threshold: number; condition: 'above' | 'below' | 'crosses_up' | 'crosses_down' },
  currentValue: number,
  previousValue: number | undefined
): boolean {
  switch (alert.condition) {
    case 'above':
      return currentValue > alert.threshold;
    case 'below':
      return currentValue < alert.threshold;
    case 'crosses_up':
      return previousValue !== undefined &&
        previousValue <= alert.threshold &&
        currentValue > alert.threshold;
    case 'crosses_down':
      return previousValue !== undefined &&
        previousValue >= alert.threshold &&
        currentValue < alert.threshold;
    default:
      return false;
  }
}
