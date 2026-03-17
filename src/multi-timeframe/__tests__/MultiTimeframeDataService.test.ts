/**
 * Tests for Multi-Timeframe Data Service
 */

import { MultiTimeframeDataService, getMultiTimeframeDataService } from '../MultiTimeframeDataService';
import { Timeframe, KLineDataPoint } from '../types';

describe('MultiTimeframeDataService', () => {
  let service: MultiTimeframeDataService;

  beforeEach(() => {
    service = new MultiTimeframeDataService({ debug: true });
  });

  afterEach(() => {
    service.clearCache();
  });

  describe('getKLineData', () => {
    it('should return K-line data for a timeframe', async () => {
      const data = await service.getKLineData('BTC/USDT', '1h', 100);

      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeLessThanOrEqual(100);
      expect(data.length).toBeGreaterThan(0);
    });

    it('should return data with correct structure', async () => {
      const data = await service.getKLineData('BTC/USDT', '1h', 10);

      expect(data.length).toBe(10);
      
      for (const point of data) {
        expect(point).toHaveProperty('time');
        expect(point).toHaveProperty('open');
        expect(point).toHaveProperty('high');
        expect(point).toHaveProperty('low');
        expect(point).toHaveProperty('close');
        expect(point).toHaveProperty('volume');
        
        expect(typeof point.time).toBe('number');
        expect(typeof point.open).toBe('number');
        expect(typeof point.high).toBe('number');
        expect(typeof point.low).toBe('number');
        expect(typeof point.close).toBe('number');
        expect(typeof point.volume).toBe('number');
        
        // OHLC constraints
        expect(point.high).toBeGreaterThanOrEqual(point.open);
        expect(point.high).toBeGreaterThanOrEqual(point.close);
        expect(point.low).toBeLessThanOrEqual(point.open);
        expect(point.low).toBeLessThanOrEqual(point.close);
      }
    });

    it('should cache data', async () => {
      const data1 = await service.getKLineData('BTC/USDT', '1h', 100);
      const data2 = await service.getKLineData('BTC/USDT', '1h', 100);

      // Should return same data (from cache)
      expect(data1).toEqual(data2);
    });

    it('should respect limit parameter', async () => {
      const data = await service.getKLineData('BTC/USDT', '1h', 50);
      expect(data.length).toBe(50);
    });

    it('should generate different data for different symbols', async () => {
      const data1 = await service.getKLineData('BTC/USDT', '1h', 10);
      const data2 = await service.getKLineData('ETH/USDT', '1h', 10);

      // Prices should be different (different seeds)
      expect(data1[0].close).not.toBe(data2[0].close);
    });

    it('should generate different data for different timeframes', async () => {
      const data1h = await service.getKLineData('BTC/USDT', '1h', 100);
      const data1d = await service.getKLineData('BTC/USDT', '1d', 100);

      // Both should have data
      expect(data1h.length).toBeGreaterThan(0);
      expect(data1d.length).toBeGreaterThan(0);
    });
  });

  describe('getMultiTimeframeData', () => {
    it('should return data for multiple timeframes', async () => {
      const timeframes: Timeframe[] = ['1h', '4h', '1d'];
      const result = await service.getMultiTimeframeData('BTC/USDT', timeframes, 100);

      expect(result.symbol).toBe('BTC/USDT');
      expect(result.data.size).toBe(3);
      
      expect(result.data.has('1h')).toBe(true);
      expect(result.data.has('4h')).toBe(true);
      expect(result.data.has('1d')).toBe(true);
    });

    it('should return data for all requested timeframes', async () => {
      const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];
      const result = await service.getMultiTimeframeData('BTC/USDT', timeframes);

      for (const tf of timeframes) {
        expect(result.data.has(tf)).toBe(true);
        const data = result.data.get(tf);
        expect(data).toBeDefined();
        expect(data!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('cache management', () => {
    it('should clear cache for specific symbol', async () => {
      await service.getKLineData('BTC/USDT', '1h');
      await service.getKLineData('ETH/USDT', '1h');

      service.clearCache('BTC/USDT');

      const stats = service.getCacheStats();
      expect(stats.symbols.has('BTC/USDT')).toBe(false);
      expect(stats.symbols.has('ETH/USDT')).toBe(true);
    });

    it('should clear all cache', async () => {
      await service.getKLineData('BTC/USDT', '1h');
      await service.getKLineData('ETH/USDT', '1h');

      service.clearCache();

      const stats = service.getCacheStats();
      expect(stats.entries).toBe(0);
    });

    it('should report cache statistics', async () => {
      await service.getKLineData('BTC/USDT', '1h');
      await service.getKLineData('BTC/USDT', '4h');
      await service.getKLineData('ETH/USDT', '1h');

      const stats = service.getCacheStats();

      expect(stats.entries).toBe(3);
      expect(stats.symbols.size).toBe(2);
      expect(stats.timeframes.size).toBe(2);
      expect(stats.totalDataPoints).toBeGreaterThan(0);
    });
  });

  describe('custom data generator', () => {
    it('should use registered data generator', async () => {
      const customData: KLineDataPoint[] = [
        { time: 1000, open: 100, high: 105, low: 95, close: 102, volume: 1000 },
        { time: 2000, open: 102, high: 108, low: 100, close: 105, volume: 1200 },
      ];

      service.registerDataGenerator('1h', () => customData);

      const data = await service.getKLineData('TEST/USDT', '1h');
      
      expect(data).toEqual(customData);
    });
  });
});

describe('getMultiTimeframeDataService singleton', () => {
  it('should return the same instance', () => {
    const instance1 = getMultiTimeframeDataService();
    const instance2 = getMultiTimeframeDataService();

    expect(instance1).toBe(instance2);
  });
});
