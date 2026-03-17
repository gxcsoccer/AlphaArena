/**
 * Multi-Timeframe Types
 * 
 * Type definitions for multi-timeframe analysis functionality
 * Supports multiple timeframe K-line data and strategy signals
 */

/**
 * Supported timeframe values
 * - 1m: 1 minute
 * - 5m: 5 minutes
 * - 15m: 15 minutes
 * - 1h: 1 hour
 * - 4h: 4 hours
 * - 1d: 1 day
 */
export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

/**
 * All supported timeframes array for iteration
 */
export const ALL_TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

/**
 * Timeframe display labels in Chinese
 */
export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  '1m': '1分钟',
  '5m': '5分钟',
  '15m': '15分钟',
  '1h': '1小时',
  '4h': '4小时',
  '1d': '1天',
};

/**
 * Timeframe duration in milliseconds
 */
export const TIMEFRAME_DURATIONS: Record<Timeframe, number> = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

/**
 * K-line data point with timeframe information
 */
export interface TimeframeKLineData {
  /** Timeframe of this data */
  timeframe: Timeframe;
  /** Symbol (e.g., 'BTC/USDT') */
  symbol: string;
  /** Array of OHLCV data points */
  data: KLineDataPoint[];
}

/**
 * Single K-line OHLCV data point
 */
export interface KLineDataPoint {
  /** Timestamp in seconds (Unix timestamp) */
  time: number;
  /** Opening price */
  open: number;
  /** Highest price */
  high: number;
  /** Lowest price */
  low: number;
  /** Closing price */
  close: number;
  /** Trading volume */
  volume: number;
}

/**
 * Multi-timeframe K-line data response
 * Contains K-line data for multiple timeframes
 */
export interface MultiTimeframeKLineData {
  /** Symbol (e.g., 'BTC/USDT') */
  symbol: string;
  /** K-line data mapped by timeframe */
  data: Map<Timeframe, KLineDataPoint[]>;
  /** Data timestamp */
  timestamp: number;
}

/**
 * Strategy signal from a specific timeframe
 */
export interface TimeframeSignal {
  /** Timeframe that generated this signal */
  timeframe: Timeframe;
  /** Signal type */
  type: 'buy' | 'sell' | 'hold';
  /** Signal strength (0-1) */
  strength: number;
  /** Price when signal was generated */
  price: number;
  /** Timestamp of signal */
  timestamp: number;
  /** Additional signal metadata */
  metadata?: Record<string, any>;
}

/**
 * Multi-timeframe signal aggregation
 * Combines signals from multiple timeframes into a unified signal
 */
export interface MultiTimeframeSignal {
  /** Symbol */
  symbol: string;
  /** Combined signal type */
  combinedType: 'buy' | 'sell' | 'hold';
  /** Combined signal strength (weighted average) */
  combinedStrength: number;
  /** Individual timeframe signals */
  signals: TimeframeSignal[];
  /** Timestamp of combined signal */
  timestamp: number;
  /** Confidence score based on signal alignment */
  confidence: number;
}

/**
 * Timeframe weight configuration
 * Used for weighted signal aggregation
 */
export interface TimeframeWeight {
  /** Timeframe */
  timeframe: Timeframe;
  /** Weight (0-1, weights should sum to 1) */
  weight: number;
}

/**
 * Multi-timeframe strategy configuration
 */
export interface MultiTimeframeStrategyConfig {
  /** Strategy ID */
  id: string;
  /** Strategy name */
  name: string;
  /** Timeframes to analyze */
  timeframes: Timeframe[];
  /** Weight for each timeframe (optional, defaults to equal weights) */
  timeframeWeights?: TimeframeWeight[];
  /** Minimum signal threshold to generate combined signal */
  signalThreshold?: number;
  /** Strategy-specific parameters */
  params?: Record<string, any>;
}

/**
 * Multi-timeframe data context for strategies
 * Provides access to data across multiple timeframes
 */
export interface MultiTimeframeContext {
  /** Symbol being analyzed */
  symbol: string;
  /** Get K-line data for a specific timeframe */
  getKLineData(timeframe: Timeframe): KLineDataPoint[] | null;
  /** Get current price */
  getCurrentPrice(): number;
  /** Get signal for a specific timeframe */
  getSignal(timeframe: Timeframe): TimeframeSignal | null;
  /** Get all timeframe signals */
  getAllSignals(): TimeframeSignal[];
  /** Get combined multi-timeframe signal */
  getCombinedSignal(): MultiTimeframeSignal | null;
  /** Timestamp of context */
  timestamp: number;
}

/**
 * Request parameters for multi-timeframe K-line API
 */
export interface MultiTimeframeKLineRequest {
  /** Symbol (e.g., 'BTC/USDT') */
  symbol: string;
  /** Timeframes to fetch */
  timeframes: Timeframe[];
  /** Number of candles per timeframe (optional, default varies by timeframe) */
  limit?: number;
}

/**
 * Response from multi-timeframe K-line API
 */
export interface MultiTimeframeKLineResponse {
  /** Success flag */
  success: boolean;
  /** Symbol */
  symbol: string;
  /** K-line data by timeframe */
  data: Record<string, KLineDataPoint[]>;
  /** Error message if failed */
  error?: string;
  /** Response timestamp */
  timestamp: number;
}

/**
 * Backtest configuration with multi-timeframe support
 */
export interface MultiTimeframeBacktestConfig {
  /** Initial capital */
  capital: number;
  /** Trading symbol */
  symbol: string;
  /** Backtest start time */
  startTime: number;
  /** Backtest end time */
  endTime: number;
  /** Strategy to use */
  strategy: string;
  /** Strategy parameters */
  strategyParams?: Record<string, any>;
  /** Timeframes to use in analysis */
  timeframes: Timeframe[];
  /** Primary timeframe for trade execution */
  primaryTimeframe: Timeframe;
  /** Timeframe weights for signal aggregation */
  timeframeWeights?: TimeframeWeight[];
  /** Tick interval in milliseconds */
  tickInterval?: number;
}

/**
 * Utility function to parse timeframe string
 */
export function parseTimeframe(tf: string): Timeframe | null {
  if (ALL_TIMEFRAMES.includes(tf as Timeframe)) {
    return tf as Timeframe;
  }
  return null;
}

/**
 * Utility function to validate timeframe
 */
export function isValidTimeframe(tf: string): tf is Timeframe {
  return ALL_TIMEFRAMES.includes(tf as Timeframe);
}

/**
 * Utility function to get default timeframe weights
 * Higher timeframes get higher weights by default
 */
export function getDefaultTimeframeWeights(timeframes: Timeframe[]): TimeframeWeight[] {
  const weights: Record<Timeframe, number> = {
    '1m': 0.05,
    '5m': 0.10,
    '15m': 0.15,
    '1h': 0.25,
    '4h': 0.25,
    '1d': 0.20,
  };

  const totalWeight = timeframes.reduce((sum, tf) => sum + weights[tf], 0);
  
  return timeframes.map(tf => ({
    timeframe: tf,
    weight: weights[tf] / totalWeight, // Normalize weights
  }));
}

/**
 * Utility function to aggregate signals from multiple timeframes
 */
export function aggregateSignals(
  signals: TimeframeSignal[],
  weights: TimeframeWeight[]
): MultiTimeframeSignal | null {
  if (signals.length === 0) return null;

  // Filter valid signals and map to weights
  const weightedSignals = signals.map(signal => {
    const weight = weights.find(w => w.timeframe === signal.timeframe);
    return {
      signal,
      weight: weight?.weight ?? 0,
    };
  });

  // Calculate weighted strength for each signal type
  let buyStrength = 0;
  let sellStrength = 0;
  let holdStrength = 0;

  for (const { signal, weight } of weightedSignals) {
    const weightedValue = signal.strength * weight;
    switch (signal.type) {
      case 'buy':
        buyStrength += weightedValue;
        break;
      case 'sell':
        sellStrength += weightedValue;
        break;
      case 'hold':
        holdStrength += weightedValue;
        break;
    }
  }

  // Determine combined signal type and strength
  let combinedType: 'buy' | 'sell' | 'hold';
  let combinedStrength: number;

  if (buyStrength > sellStrength && buyStrength > holdStrength) {
    combinedType = 'buy';
    combinedStrength = buyStrength;
  } else if (sellStrength > buyStrength && sellStrength > holdStrength) {
    combinedType = 'sell';
    combinedStrength = sellStrength;
  } else {
    combinedType = 'hold';
    combinedStrength = holdStrength;
  }

  // Calculate confidence based on signal alignment
  const signalTypes = new Set(signals.map(s => s.type));
  const confidence = signalTypes.size === 1 ? 1.0 : 
                     signalTypes.size === 2 ? 0.7 : 0.4;

  return {
    symbol: signals[0].metadata?.symbol ?? '',
    combinedType,
    combinedStrength,
    signals,
    timestamp: Date.now(),
    confidence,
  };
}
