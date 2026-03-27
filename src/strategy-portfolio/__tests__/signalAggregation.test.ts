/**
 * Tests for Signal Aggregation Service
 */

import { SignalAggregationService } from '../signalAggregation.service';
import { StrategySignal, SignalAggregationMethod } from '../types';

describe('SignalAggregationService', () => {
  let service: SignalAggregationService;

  beforeEach(() => {
    service = new SignalAggregationService();
  });

  describe('aggregateSignals', () => {
    const signals: StrategySignal[] = [
      {
        strategyId: 'strategy-1',
        symbol: 'BTC',
        side: 'buy',
        confidence: 0.8,
        quantity: 10,
        price: 50000,
        timestamp: new Date(),
      },
      {
        strategyId: 'strategy-2',
        symbol: 'BTC',
        side: 'buy',
        confidence: 0.6,
        quantity: 5,
        price: 51000,
        timestamp: new Date(),
      },
      {
        strategyId: 'strategy-3',
        symbol: 'BTC',
        side: 'sell',
        confidence: 0.4,
        quantity: 8,
        price: 49000,
        timestamp: new Date(),
      },
    ];

    const weights = new Map([
      ['strategy-1', 0.5],
      ['strategy-2', 0.3],
      ['strategy-3', 0.2],
    ]);

    it('should aggregate signals using weighted_average method', () => {
      const result = service.aggregateSignals(signals, weights, 'weighted_average');

      expect(result).not.toBeNull();
      expect(result!.symbol).toBe('BTC');
      expect(result!.side).toBe('buy');  // Majority want to buy
      expect(result!.aggregationMethod).toBe('weighted_average');
      expect(result!.contributingStrategies).toHaveLength(3);
    });

    it('should aggregate signals using voting method', () => {
      const result = service.aggregateSignals(signals, weights, 'voting');

      expect(result).not.toBeNull();
      expect(result!.symbol).toBe('BTC');
      expect(result!.side).toBe('buy');  // 2 buy vs 1 sell
      expect(result!.aggregationMethod).toBe('voting');
    });

    it('should aggregate signals using consensus method', () => {
      const result = service.aggregateSignals(signals, weights, 'consensus');

      expect(result).not.toBeNull();
      expect(result!.symbol).toBe('BTC');
      expect(result!.aggregationMethod).toBe('consensus');
    });

    it('should aggregate signals using best_performer method', () => {
      const result = service.aggregateSignals(signals, weights, 'best_performer');

      expect(result).not.toBeNull();
      expect(result!.symbol).toBe('BTC');
      expect(result!.side).toBe('buy');  // Highest confidence is buy
      expect(result!.confidence).toBe(0.8);
      expect(result!.aggregationMethod).toBe('best_performer');
    });

    it('should return null for empty signals', () => {
      const result = service.aggregateSignals([], weights);
      expect(result).toBeNull();
    });

    it('should filter out low confidence signals', () => {
      service.updateConfig({ minConfidence: 0.7 });
      
      const result = service.aggregateSignals(signals, weights);
      
      expect(result).not.toBeNull();
      // Only strategy-1 (0.8) should be included
      expect(result!.contributingStrategies.length).toBeLessThanOrEqual(1);
    });
  });

  describe('aggregateAllSignals', () => {
    it('should aggregate signals for multiple symbols', () => {
      const signals: StrategySignal[] = [
        {
          strategyId: 's1',
          symbol: 'BTC',
          side: 'buy',
          confidence: 0.8,
          quantity: 1,
          timestamp: new Date(),
        },
        {
          strategyId: 's2',
          symbol: 'ETH',
          side: 'sell',
          confidence: 0.7,
          quantity: 10,
          timestamp: new Date(),
        },
      ];

      const weights = new Map([['s1', 0.5], ['s2', 0.5]]);

      const results = service.aggregateAllSignals(signals, weights);

      expect(results).toHaveLength(2);
      expect(results.find(r => r.symbol === 'BTC')).toBeDefined();
      expect(results.find(r => r.symbol === 'ETH')).toBeDefined();
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      service.updateConfig({
        method: 'voting',
        minConfidence: 0.5,
        consensusThreshold: 0.7,
      });

      const config = service.getConfig();
      expect(config.method).toBe('voting');
      expect(config.minConfidence).toBe(0.5);
      expect(config.consensusThreshold).toBe(0.7);
    });
  });
});