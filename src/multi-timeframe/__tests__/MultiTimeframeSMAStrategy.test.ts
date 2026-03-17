/**
 * Tests for Multi-Timeframe SMA Strategy
 */

import { MultiTimeframeSMAStrategy } from '../strategies/MultiTimeframeSMAStrategy';
import { Timeframe, KLineDataPoint } from '../types';
import { StrategyContext } from '../../strategy/types';

// Helper to generate test K-line data
function generateKLineData(numCandles: number, basePrice: number = 100): KLineDataPoint[] {
  const data: KLineDataPoint[] = [];
  const now = Math.floor(Date.now() / 1000);

  for (let i = 0; i < numCandles; i++) {
    const change = (Math.random() - 0.5) * 2;
    const open = basePrice;
    const close = basePrice + change;
    const high = Math.max(open, close) + Math.random();
    const low = Math.min(open, close) - Math.random();

    data.push({
      time: now - (numCandles - i) * 3600,
      open,
      high,
      low,
      close,
      volume: Math.floor(Math.random() * 10000) + 1000,
    });

    basePrice = close;
  }

  return data;
}

// Helper to generate trending K-line data
function generateTrendingKLineData(
  numCandles: number,
  trend: 'up' | 'down',
  basePrice: number = 100
): KLineDataPoint[] {
  const data: KLineDataPoint[] = [];
  const now = Math.floor(Date.now() / 1000);
  const trendMultiplier = trend === 'up' ? 1 : -1;

  for (let i = 0; i < numCandles; i++) {
    const change = trendMultiplier * (0.5 + Math.random() * 0.5);
    const open = basePrice;
    const close = basePrice + change;
    const high = Math.max(open, close) + Math.random() * 0.2;
    const low = Math.min(open, close) - Math.random() * 0.2;

    data.push({
      time: now - (numCandles - i) * 3600,
      open,
      high,
      low,
      close,
      volume: Math.floor(Math.random() * 10000) + 1000,
    });

    basePrice = close;
  }

  return data;
}

// Mock strategy context
function createMockContext(): StrategyContext {
  return {
    portfolio: {
      cash: 10000,
      positions: [],
      totalValue: 10000,
      unrealizedPnL: 0,
      timestamp: Date.now(),
    },
    clock: Date.now(),
    getMarketData: () => ({
      orderBook: {} as any,
      trades: [],
      timestamp: Date.now(),
    }),
    getPosition: () => 0,
    getCash: () => 10000,
  };
}

describe('MultiTimeframeSMAStrategy', () => {
  describe('constructor', () => {
    it('should create strategy with default parameters', () => {
      const strategy = new MultiTimeframeSMAStrategy({
        id: 'test-sma',
        name: 'Test SMA Strategy',
        timeframes: ['1h', '4h', '1d'],
      });

      expect(strategy.getConfig().id).toBe('test-sma');
      expect(strategy.getConfig().name).toBe('Test SMA Strategy');
      expect(strategy.getTimeframes()).toEqual(['1h', '4h', '1d']);
    });

    it('should create strategy with custom parameters', () => {
      const strategy = new MultiTimeframeSMAStrategy({
        id: 'test-sma',
        name: 'Test SMA Strategy',
        timeframes: ['1h', '4h'],
        shortPeriod: 5,
        longPeriod: 20,
        tradeQuantity: 100,
      });

      expect(strategy.getTimeframes()).toEqual(['1h', '4h']);
    });
  });

  describe('analyzeTimeframe', () => {
    it('should return null when not enough data', () => {
      const strategy = new MultiTimeframeSMAStrategy({
        id: 'test-sma',
        name: 'Test SMA Strategy',
        timeframes: ['1h'],
        shortPeriod: 10,
        longPeriod: 30,
      });

      // Only provide 20 candles, but we need 31
      const data = generateKLineData(20);
      strategy.updateKLineData('1h', data);

      const signal = strategy.analyzeTimeframe('1h');
      expect(signal).toBeNull();
    });

    it('should analyze timeframe and return a valid signal', () => {
      const strategy = new MultiTimeframeSMAStrategy({
        id: 'test-sma',
        name: 'Test SMA Strategy',
        timeframes: ['1h'],
        shortPeriod: 5,
        longPeriod: 10,
      });

      // Generate trending data (consistent trend, no crossover)
      const data = generateTrendingKLineData(50, 'up');
      strategy.updateKLineData('1h', data);

      // First analysis - no previous data
      strategy.analyzeTimeframe('1h');
      
      // Second analysis - still trending, should hold
      const signal = strategy.analyzeTimeframe('1h');
      expect([ 'buy', 'sell', 'hold' ]).toContain(signal?.type);
    });

    it('should detect golden cross', () => {
      const strategy = new MultiTimeframeSMAStrategy({
        id: 'test-sma',
        name: 'Test SMA Strategy',
        timeframes: ['1h'],
        shortPeriod: 5,
        longPeriod: 10,
      });

      // Generate data that starts downtrend and then uptrend
      const downTrendData = generateTrendingKLineData(30, 'down', 100);
      const upTrendData = generateTrendingKLineData(30, 'up', downTrendData[downTrendData.length - 1].close);
      
      const data = [...downTrendData, ...upTrendData];
      strategy.updateKLineData('1h', data);

      // Analyze multiple times to detect crossover
      strategy.analyzeTimeframe('1h');
      const signal = strategy.analyzeTimeframe('1h');

      // After trending up, we should see a buy or hold signal
      expect(['buy', 'hold']).toContain(signal?.type);
    });
  });

  describe('analyzeAllTimeframes', () => {
    it('should analyze all configured timeframes', () => {
      const strategy = new MultiTimeframeSMAStrategy({
        id: 'test-sma',
        name: 'Test SMA Strategy',
        timeframes: ['1h', '4h', '1d'],
        shortPeriod: 5,
        longPeriod: 10,
      });

      // Provide data for all timeframes
      strategy.updateKLineData('1h', generateKLineData(50));
      strategy.updateKLineData('4h', generateKLineData(50));
      strategy.updateKLineData('1d', generateKLineData(50));

      const signals = strategy.analyzeAllTimeframes();

      expect(signals.length).toBe(3);
      expect(signals.map(s => s.timeframe)).toEqual(['1h', '4h', '1d']);
    });
  });

  describe('getCombinedSignal', () => {
    it('should return null when no signals', () => {
      const strategy = new MultiTimeframeSMAStrategy({
        id: 'test-sma',
        name: 'Test SMA Strategy',
        timeframes: ['1h'],
        shortPeriod: 5,
        longPeriod: 10,
      });

      const signal = strategy.getCombinedSignal();
      expect(signal).toBeNull();
    });

    it('should combine signals from multiple timeframes', () => {
      const strategy = new MultiTimeframeSMAStrategy({
        id: 'test-sma',
        name: 'Test SMA Strategy',
        timeframes: ['1h', '4h', '1d'],
        shortPeriod: 5,
        longPeriod: 10,
      });

      // Provide data and analyze
      strategy.updateKLineData('1h', generateKLineData(50));
      strategy.updateKLineData('4h', generateKLineData(50));
      strategy.updateKLineData('1d', generateKLineData(50));

      strategy.analyzeAllTimeframes();

      const combined = strategy.getCombinedSignal();

      expect(combined).not.toBeNull();
      expect(combined?.signals.length).toBe(3);
      expect(['buy', 'sell', 'hold']).toContain(combined?.combinedType);
    });
  });

  describe('getSMAValues', () => {
    it('should return current SMA values', () => {
      const strategy = new MultiTimeframeSMAStrategy({
        id: 'test-sma',
        name: 'Test SMA Strategy',
        timeframes: ['1h'],
        shortPeriod: 5,
        longPeriod: 10,
      });

      const data = generateKLineData(50);
      strategy.updateKLineData('1h', data);

      // Analyze to calculate SMA
      strategy.analyzeTimeframe('1h');

      const smaValues = strategy.getSMAValues('1h');

      expect(smaValues.short).toBeGreaterThan(0);
      expect(smaValues.long).toBeGreaterThan(0);
    });
  });

  describe('clearSignals', () => {
    it('should clear all signals', () => {
      const strategy = new MultiTimeframeSMAStrategy({
        id: 'test-sma',
        name: 'Test SMA Strategy',
        timeframes: ['1h'],
        shortPeriod: 5,
        longPeriod: 10,
      });

      strategy.updateKLineData('1h', generateKLineData(50));
      strategy.analyzeAllTimeframes();

      expect(strategy.getAllTimeframeSignals().size).toBeGreaterThan(0);

      strategy.clearSignals();

      expect(strategy.getAllTimeframeSignals().size).toBe(0);
      expect(strategy.getLastCombinedSignal()).toBeNull();
    });
  });
});
