/**
 * useSentiment Hook
 * 
 * Provides real-time market sentiment data with:
 * - Fear/Greed Index calculation
 * - Multi-dimensional sentiment analysis
 * - Historical sentiment tracking
 * - Alert detection
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMarketData } from './useMarketData';
import {
  type SentimentData,
  type SentimentHistoryPoint,
  type SentimentConfig,
  DEFAULT_SENTIMENT_CONFIG,
} from '../../utils/sentiment';
import {
  calculateAggregatedSentiment,
  tradingPairToSentimentData,
  generateHistoricalSentiment,
  checkSentimentAlert,
} from '../utils/sentimentService';
import { createLogger } from '../../utils/logger';

const log = createLogger('useSentiment');

/**
 * Sentiment alert configuration for the hook
 */
export interface SentimentAlertConfig {
  threshold: number;
  condition: 'above' | 'below' | 'crosses_up' | 'crosses_down';
  onTrigger?: (value: number) => void;
}

/**
 * Hook options
 */
export interface UseSentimentOptions {
  /** Refresh interval for sentiment calculation (ms) */
  refreshInterval?: number;
  /** Number of days of historical data to generate */
  historyDays?: number;
  /** Custom sentiment configuration */
  config?: SentimentConfig;
  /** Alert configurations */
  alerts?: SentimentAlertConfig[];
  /** Whether to enable historical data generation */
  enableHistory?: boolean;
}

/**
 * Hook return type
 */
export interface UseSentimentResult {
  /** Current sentiment data */
  sentiment: SentimentData | null;
  /** Historical sentiment data points */
  history: SentimentHistoryPoint[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: string | null;
  /** Manual refresh function */
  refresh: () => void;
  /** Whether sentiment is currently being calculated */
  calculating: boolean;
}

/**
 * Hook for market sentiment analysis
 */
export function useSentiment(options: UseSentimentOptions = {}): UseSentimentResult {
  const {
    refreshInterval = 10000,
    historyDays = 30,
    config = DEFAULT_SENTIMENT_CONFIG,
    alerts = [],
    enableHistory = true,
  } = options;

  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [history, setHistory] = useState<SentimentHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);

  const previousSentimentRef = useRef<number | undefined>(undefined);
  const historyInitializedRef = useRef(false);

  // Get market data
  const { marketData, loading: marketLoading, error: marketError, refresh: refreshMarket } = useMarketData(refreshInterval);

  // Calculate sentiment from market data
  const calculateSentimentFromData = useCallback(() => {
    if (!marketData || marketData.length === 0) {
      return null;
    }

    setCalculating(true);
    try {
      // Transform trading pairs to sentiment data format
      const sentimentInputs = marketData.map(tradingPairToSentimentData);

      // Calculate aggregated sentiment
      const newSentiment = calculateAggregatedSentiment(
        sentimentInputs,
        config,
        previousSentimentRef.current
      );

      // Check alerts
      alerts.forEach(alert => {
        if (checkSentimentAlert(alert, newSentiment.fearGreedIndex, previousSentimentRef.current)) {
          log.info(`Sentiment alert triggered: ${alert.condition} ${alert.threshold}`);
          alert.onTrigger?.(newSentiment.fearGreedIndex);
        }
      });

      // Update previous value reference
      previousSentimentRef.current = newSentiment.fearGreedIndex;

      setSentiment(newSentiment);
      setError(null);

      // Initialize history if needed
      if (enableHistory && !historyInitializedRef.current && newSentiment) {
        const generatedHistory = generateHistoricalSentiment(newSentiment, historyDays);
        setHistory(generatedHistory);
        historyInitializedRef.current = true;
      } else if (enableHistory && newSentiment) {
        // Add new point to history
        setHistory(prev => {
          const newPoint: SentimentHistoryPoint = {
            timestamp: newSentiment.timestamp,
            fearGreedIndex: newSentiment.fearGreedIndex,
            level: newSentiment.level,
            dimensions: newSentiment.dimensions,
            volume: marketData.reduce((sum, p) => sum + (p.volume24h || 0), 0),
            price: marketData[0]?.lastPrice || 0,
          };
          
          // Keep only last N days
          const maxPoints = historyDays + 1;
          const updated = [...prev, newPoint].slice(-maxPoints);
          return updated;
        });
      }
    } catch (err: any) {
      log.error('Error calculating sentiment:', err);
      setError(err.message || 'Failed to calculate sentiment');
    } finally {
      setCalculating(false);
    }
  }, [marketData, config, alerts, enableHistory, historyDays]);

  // Update sentiment when market data changes
  useEffect(() => {
    if (!marketLoading) {
      setLoading(true);
      calculateSentimentFromData();
      setLoading(false);
    }
  }, [marketData, marketLoading, calculateSentimentFromData]);

  // Set error from market data
  useEffect(() => {
    if (marketError) {
      setError(marketError);
    }
  }, [marketError]);

  // Manual refresh
  const refresh = useCallback(() => {
    log.debug('Manual sentiment refresh triggered');
    refreshMarket();
  }, [refreshMarket]);

  return {
    sentiment,
    history,
    loading: loading || marketLoading,
    error,
    refresh,
    calculating,
  };
}

export default useSentiment;
