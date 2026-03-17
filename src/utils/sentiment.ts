/**
 * Sentiment Types
 * 
 * Type definitions for market sentiment analysis and dashboard components.
 */

/**
 * Fear and Greed Index levels
 */
export type FearGreedLevel = 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed';

/**
 * Sentiment signal type
 */
export type SentimentSignal = 
  | 'extreme_fear_buy'      // Extreme fear = potential buying opportunity
  | 'fear_caution'          // Fear = proceed with caution
  | 'neutral_hold'          // Neutral = hold position
  | 'greed_watch'           // Greed = watch for reversal
  | 'extreme_greed_sell';   // Extreme greed = potential selling opportunity

/**
 * Market sentiment dimensions
 */
export interface SentimentDimensions {
  /** Technical sentiment based on technical indicators */
  technical: number;        // 0-100
  /** Capital flow sentiment based on buy/sell pressure */
  capitalFlow: number;     // 0-100
  /** Volatility sentiment based on market fear */
  volatility: number;      // 0-100
  /** Momentum sentiment based on price trends */
  momentum: number;        // 0-100
}

/**
 * Comprehensive sentiment data
 */
export interface SentimentData {
  /** Overall fear and greed index (0-100) */
  fearGreedIndex: number;
  /** Human-readable level */
  level: FearGreedLevel;
  /** Trading signal recommendation */
  signal: SentimentSignal;
  /** Multi-dimensional sentiment breakdown */
  dimensions: SentimentDimensions;
  /** Market volatility indicator */
  volatility: number;
  /** Volume anomaly score (0-100, higher = more anomalous) */
  volumeAnomaly: number;
  /** Price momentum score (-100 to 100) */
  priceMomentum: number;
  /** Timestamp of data */
  timestamp: Date;
  /** Previous value for comparison */
  previousValue?: number;
  /** Change from previous value */
  change?: number;
}

/**
 * Historical sentiment data point
 */
export interface SentimentHistoryPoint {
  timestamp: Date;
  fearGreedIndex: number;
  level: FearGreedLevel;
  dimensions: SentimentDimensions;
  volume: number;
  price: number;
}

/**
 * Sentiment alert configuration
 */
export interface SentimentAlert {
  id: string;
  type: 'threshold' | 'change' | 'signal';
  condition: 'above' | 'below' | 'crosses_up' | 'crosses_down';
  threshold: number;
  signalTypes?: SentimentSignal[];
  channels: ('ui' | 'email' | 'webhook')[];
  enabled: boolean;
  triggeredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Sentiment alert notification
 */
export interface SentimentNotification {
  id: string;
  type: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  sentimentValue: number;
  signal?: SentimentSignal;
  timestamp: Date;
  acknowledged: boolean;
}

/**
 * Market data for sentiment calculation
 */
export interface MarketDataForSentiment {
  symbol: string;
  price: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  bid?: number;
  ask?: number;
  timestamp: Date;
}

/**
 * Aggregated market data for overall sentiment
 */
export interface AggregatedMarketData {
  symbols: MarketDataForSentiment[];
  totalVolume: number;
  averageChange: number;
  advancingCount: number;
  decliningCount: number;
  timestamp: Date;
}

/**
 * Sentiment calculation config
 */
export interface SentimentConfig {
  /** Weight for technical indicators in overall score */
  technicalWeight: number;
  /** Weight for capital flow in overall score */
  capitalFlowWeight: number;
  /** Weight for volatility in overall score */
  volatilityWeight: number;
  /** Weight for momentum in overall score */
  momentumWeight: number;
  /** Period for momentum calculation (in data points) */
  momentumPeriod: number;
  /** Threshold for extreme fear */
  extremeFearThreshold: number;
  /** Threshold for fear */
  fearThreshold: number;
  /** Threshold for greed */
  greedThreshold: number;
  /** Threshold for extreme greed */
  extremeGreedThreshold: number;
}

/**
 * Default sentiment configuration
 */
export const DEFAULT_SENTIMENT_CONFIG: SentimentConfig = {
  technicalWeight: 0.25,
  capitalFlowWeight: 0.25,
  volatilityWeight: 0.25,
  momentumWeight: 0.25,
  momentumPeriod: 14,
  extremeFearThreshold: 20,
  fearThreshold: 40,
  greedThreshold: 60,
  extremeGreedThreshold: 80,
};

/**
 * Helper to get FearGreedLevel from index value
 */
export function getFearGreedLevel(value: number, config: SentimentConfig = DEFAULT_SENTIMENT_CONFIG): FearGreedLevel {
  if (value < config.extremeFearThreshold) return 'extreme_fear';
  if (value < config.fearThreshold) return 'fear';
  if (value < config.greedThreshold) return 'neutral';
  if (value < config.extremeGreedThreshold) return 'greed';
  return 'extreme_greed';
}

/**
 * Helper to get SentimentSignal from FearGreedLevel
 */
export function getSentimentSignal(level: FearGreedLevel): SentimentSignal {
  const signalMap: Record<FearGreedLevel, SentimentSignal> = {
    'extreme_fear': 'extreme_fear_buy',
    'fear': 'fear_caution',
    'neutral': 'neutral_hold',
    'greed': 'greed_watch',
    'extreme_greed': 'extreme_greed_sell',
  };
  return signalMap[level];
}

/**
 * Get color for fear/greed level
 */
export function getSentimentColor(value: number): string {
  if (value < 20) return 'rgb(245, 63, 63)';      // Extreme Fear - Red
  if (value < 40) return 'rgb(255, 125, 0)';     // Fear - Orange
  if (value < 60) return 'rgb(255, 200, 0)';     // Neutral - Yellow
  if (value < 80) return 'rgb(125, 200, 0)';     // Greed - Light Green
  return 'rgb(0, 180, 42)';                       // Extreme Greed - Green
}

/**
 * Get display text for fear/greed level
 */
export function getSentimentDisplayText(level: FearGreedLevel): string {
  const textMap: Record<FearGreedLevel, string> = {
    'extreme_fear': '极度恐惧',
    'fear': '恐惧',
    'neutral': '中性',
    'greed': '贪婪',
    'extreme_greed': '极度贪婪',
  };
  return textMap[level];
}

/**
 * Get signal display text
 */
export function getSignalDisplayText(signal: SentimentSignal): string {
  const textMap: Record<SentimentSignal, string> = {
    'extreme_fear_buy': '极度恐惧 - 潜在买入机会',
    'fear_caution': '恐惧 - 谨慎操作',
    'neutral_hold': '中性 - 持仓观望',
    'greed_watch': '贪婪 - 关注反转',
    'extreme_greed_sell': '极度贪婪 - 潜在卖出机会',
  };
  return textMap[signal];
}
