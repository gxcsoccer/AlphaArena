/**
 * Tests for Multi-Timeframe Types
 */

import {
  Timeframe,
  ALL_TIMEFRAMES,
  TIMEFRAME_LABELS,
  TIMEFRAME_DURATIONS,
  parseTimeframe,
  isValidTimeframe,
  getDefaultTimeframeWeights,
  aggregateSignals,
  TimeframeSignal,
  TimeframeWeight,
} from '../types';

describe('Multi-Timeframe Types', () => {
  describe('ALL_TIMEFRAMES', () => {
    it('should contain all supported timeframes', () => {
      expect(ALL_TIMEFRAMES).toEqual(['1m', '5m', '15m', '1h', '4h', '1d']);
    });
  });

  describe('TIMEFRAME_LABELS', () => {
    it('should have labels for all timeframes', () => {
      for (const tf of ALL_TIMEFRAMES) {
        expect(TIMEFRAME_LABELS[tf]).toBeDefined();
        expect(typeof TIMEFRAME_LABELS[tf]).toBe('string');
      }
    });
  });

  describe('TIMEFRAME_DURATIONS', () => {
    it('should have correct durations in milliseconds', () => {
      expect(TIMEFRAME_DURATIONS['1m']).toBe(60 * 1000);
      expect(TIMEFRAME_DURATIONS['5m']).toBe(5 * 60 * 1000);
      expect(TIMEFRAME_DURATIONS['15m']).toBe(15 * 60 * 1000);
      expect(TIMEFRAME_DURATIONS['1h']).toBe(60 * 60 * 1000);
      expect(TIMEFRAME_DURATIONS['4h']).toBe(4 * 60 * 60 * 1000);
      expect(TIMEFRAME_DURATIONS['1d']).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe('parseTimeframe', () => {
    it('should return valid timeframe', () => {
      expect(parseTimeframe('1h')).toBe('1h');
      expect(parseTimeframe('1d')).toBe('1d');
      expect(parseTimeframe('15m')).toBe('15m');
    });

    it('should return null for invalid timeframe', () => {
      expect(parseTimeframe('2h')).toBeNull();
      expect(parseTimeframe('invalid')).toBeNull();
      expect(parseTimeframe('')).toBeNull();
    });
  });

  describe('isValidTimeframe', () => {
    it('should return true for valid timeframes', () => {
      expect(isValidTimeframe('1m')).toBe(true);
      expect(isValidTimeframe('1h')).toBe(true);
      expect(isValidTimeframe('1d')).toBe(true);
    });

    it('should return false for invalid timeframes', () => {
      expect(isValidTimeframe('2h')).toBe(false);
      expect(isValidTimeframe('invalid')).toBe(false);
    });
  });

  describe('getDefaultTimeframeWeights', () => {
    it('should return weights that sum to 1', () => {
      const weights = getDefaultTimeframeWeights(['1h', '4h', '1d']);
      const sum = weights.reduce((acc, w) => acc + w.weight, 0);
      expect(sum).toBeCloseTo(1, 5);
    });

    it('should return weights for all provided timeframes', () => {
      const timeframes: Timeframe[] = ['1h', '4h', '1d'];
      const weights = getDefaultTimeframeWeights(timeframes);
      
      expect(weights).toHaveLength(3);
      expect(weights.map(w => w.timeframe)).toEqual(timeframes);
    });

    it('should give higher weights to longer timeframes', () => {
      const weights = getDefaultTimeframeWeights(['1m', '1h', '1d']);
      
      const weight1m = weights.find(w => w.timeframe === '1m')?.weight ?? 0;
      const weight1h = weights.find(w => w.timeframe === '1h')?.weight ?? 0;
      const weight1d = weights.find(w => w.timeframe === '1d')?.weight ?? 0;
      
      expect(weight1h).toBeGreaterThan(weight1m);
      expect(weight1d).toBeGreaterThan(weight1m);
    });
  });

  describe('aggregateSignals', () => {
    const createMockSignal = (
      timeframe: Timeframe,
      type: 'buy' | 'sell' | 'hold',
      strength: number
    ): TimeframeSignal => ({
      timeframe,
      type,
      strength,
      price: 100,
      timestamp: Date.now(),
      metadata: { symbol: 'BTC/USDT' },
    });

    const createMockWeights = (timeframes: Timeframe[]): TimeframeWeight[] => {
      const weight = 1 / timeframes.length;
      return timeframes.map(tf => ({ timeframe: tf, weight }));
    };

    it('should return null for empty signals', () => {
      const result = aggregateSignals([], []);
      expect(result).toBeNull();
    });

    it('should aggregate buy signals correctly', () => {
      const signals: TimeframeSignal[] = [
        createMockSignal('1h', 'buy', 0.8),
        createMockSignal('4h', 'buy', 0.7),
      ];
      const weights = createMockWeights(['1h', '4h']);

      const result = aggregateSignals(signals, weights);

      expect(result).not.toBeNull();
      expect(result?.combinedType).toBe('buy');
      expect(result?.confidence).toBe(1.0); // All signals agree
    });

    it('should aggregate sell signals correctly', () => {
      const signals: TimeframeSignal[] = [
        createMockSignal('1h', 'sell', 0.6),
        createMockSignal('4h', 'sell', 0.8),
      ];
      const weights = createMockWeights(['1h', '4h']);

      const result = aggregateSignals(signals, weights);

      expect(result).not.toBeNull();
      expect(result?.combinedType).toBe('sell');
      expect(result?.confidence).toBe(1.0);
    });

    it('should handle mixed signals with reduced confidence', () => {
      const signals: TimeframeSignal[] = [
        createMockSignal('1h', 'buy', 0.8),
        createMockSignal('4h', 'sell', 0.6),
      ];
      const weights = createMockWeights(['1h', '4h']);

      const result = aggregateSignals(signals, weights);

      expect(result).not.toBeNull();
      expect(result?.confidence).toBe(0.7); // Two different signal types
    });

    it('should handle three different signal types', () => {
      const signals: TimeframeSignal[] = [
        createMockSignal('1h', 'buy', 0.8),
        createMockSignal('4h', 'sell', 0.6),
        createMockSignal('1d', 'hold', 0.5),
      ];
      const weights = createMockWeights(['1h', '4h', '1d']);

      const result = aggregateSignals(signals, weights);

      expect(result).not.toBeNull();
      expect(result?.confidence).toBe(0.4); // Three different signal types
    });
  });
});
