/**
 * ML Strategy Templates Tests
 */

import { TimeSeriesPredictionStrategy, TimeSeriesStrategyConfig } from '../../../src/strategy/ml/TimeSeriesPredictionStrategy';
import { ClassificationStrategy, ClassificationStrategyConfig } from '../../../src/strategy/ml/ClassificationStrategy';
import { AnomalyDetectionStrategy, AnomalyDetectionStrategyConfig } from '../../../src/strategy/ml/AnomalyDetectionStrategy';
import { RLStrategy, RLStrategyConfig } from '../../../src/strategy/ml/RLStrategy';
import { StrategyContext, OrderSignal } from '../../../src/strategy';
import { MLStrategyBaseConfig, FeatureType } from '../../../src/strategy/ml/MLTypes';

/**
 * Mock OrderBook for testing
 */
class MockOrderBook {
  private bestBidPrice: number;
  private bestAskPrice: number;

  constructor(bid: number, ask: number) {
    this.bestBidPrice = bid;
    this.bestAskPrice = ask;
  }

  getBestBid(): number | null {
    return this.bestBidPrice;
  }

  getBestAsk(): number | null {
    return this.bestAskPrice;
  }

  setPrices(bid: number, ask: number) {
    this.bestBidPrice = bid;
    this.bestAskPrice = ask;
  }
}

/**
 * Create mock context
 */
function createMockContext(orderBook: MockOrderBook, cash: number = 100000): StrategyContext {
  return {
    portfolio: {
      cash,
      positions: [],
      totalValue: cash,
      unrealizedPnL: 0,
      timestamp: Date.now(),
    },
    clock: Date.now(),
    getMarketData: () => ({
      orderBook: orderBook as any,
      trades: [],
      timestamp: Date.now(),
    }),
    getPosition: (_symbol: string) => 0,
    getCash: () => cash,
  };
}

/**
 * Create base ML config
 */
function createBaseMLConfig(features: FeatureType[]): MLStrategyBaseConfig {
  return {
    features: {
      features,
      lookbackPeriod: 20,
      normalization: 'zscore',
    },
    model: {
      type: 'classification',
    },
    prediction: {
      minConfidence: 0.5,
    },
  };
}

describe('TimeSeriesPredictionStrategy', () => {
  describe('Construction', () => {
    test('should create strategy with valid config', () => {
      const config: TimeSeriesStrategyConfig = {
        id: 'ts-test',
        name: 'TimeSeries Test',
        params: {
          ml: createBaseMLConfig(['price', 'returns', 'sma-20']),
          prediction: {
            horizon: 5,
          },
        },
      };

      const strategy = new TimeSeriesPredictionStrategy(config);
      expect(strategy).toBeDefined();
    });

    test('should throw without ML config', () => {
      const config: any = {
        id: 'ts-test',
        name: 'TimeSeries Test',
      };

      expect(() => new TimeSeriesPredictionStrategy(config)).toThrow();
    });
  });

  describe('Trading Logic', () => {
    test('should initialize correctly', () => {
      const config: TimeSeriesStrategyConfig = {
        id: 'ts-test',
        name: 'TimeSeries Test',
        params: {
          ml: createBaseMLConfig(['price', 'returns']),
        },
      };

      const strategy = new TimeSeriesPredictionStrategy(config);
      const orderBook = new MockOrderBook(100, 101);
      const context = createMockContext(orderBook);

      strategy.onInit(context);
      expect(strategy.isInitialized()).toBe(true);
    });

    test('should handle onTick without model', () => {
      const config: TimeSeriesStrategyConfig = {
        id: 'ts-test',
        name: 'TimeSeries Test',
        params: {
          ml: createBaseMLConfig(['price', 'returns']),
        },
      };

      const strategy = new TimeSeriesPredictionStrategy(config);
      const orderBook = new MockOrderBook(100, 101);
      const context = createMockContext(orderBook);

      strategy.onInit(context);
      
      // First tick - no history
      const signal = strategy.onTick(context);
      // Signal might be null due to cooldown or no prediction
      expect(signal).toBeDefined();
    });

    test('should get prediction history', () => {
      const config: TimeSeriesStrategyConfig = {
        id: 'ts-test',
        name: 'TimeSeries Test',
        params: {
          ml: createBaseMLConfig(['price', 'returns']),
        },
      };

      const strategy = new TimeSeriesPredictionStrategy(config);
      const orderBook = new MockOrderBook(100, 101);
      const context = createMockContext(orderBook);

      strategy.onInit(context);
      
      const history = strategy.getPredictionHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    test('should get price history', () => {
      const config: TimeSeriesStrategyConfig = {
        id: 'ts-test',
        name: 'TimeSeries Test',
        params: {
          ml: createBaseMLConfig(['price', 'returns']),
        },
      };

      const strategy = new TimeSeriesPredictionStrategy(config);
      const orderBook = new MockOrderBook(100, 101);
      const context = createMockContext(orderBook);

      strategy.onInit(context);
      
      const history = strategy.getPriceHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    test('should evaluate predictions', () => {
      const config: TimeSeriesStrategyConfig = {
        id: 'ts-test',
        name: 'TimeSeries Test',
        params: {
          ml: createBaseMLConfig(['price', 'returns']),
        },
      };

      const strategy = new TimeSeriesPredictionStrategy(config);
      const orderBook = new MockOrderBook(100, 101);
      const context = createMockContext(orderBook);

      strategy.onInit(context);
      
      const evaluation = strategy.evaluatePredictions();
      expect(evaluation).toHaveProperty('mae');
      expect(evaluation).toHaveProperty('rmse');
      expect(evaluation).toHaveProperty('directionAccuracy');
    });
  });
});

describe('ClassificationStrategy', () => {
  describe('Construction', () => {
    test('should create strategy with valid config', () => {
      const config: ClassificationStrategyConfig = {
        id: 'cls-test',
        name: 'Classification Test',
        params: {
          ml: createBaseMLConfig(['price', 'rsi-14', 'macd']),
        },
      };

      const strategy = new ClassificationStrategy(config);
      expect(strategy).toBeDefined();
    });

    test('should support custom classification params', () => {
      const config: ClassificationStrategyConfig = {
        id: 'cls-test',
        name: 'Classification Test',
        params: {
          ml: createBaseMLConfig(['price', 'rsi-14']),
          classification: {
            minProbability: 0.7,
            enableVoting: true,
            votingWindow: 7,
          },
        },
      };

      const strategy = new ClassificationStrategy(config);
      expect(strategy).toBeDefined();
    });
  });

  describe('Trading Logic', () => {
    test('should initialize correctly', () => {
      const config: ClassificationStrategyConfig = {
        id: 'cls-test',
        name: 'Classification Test',
        params: {
          ml: createBaseMLConfig(['price', 'rsi-14']),
        },
      };

      const strategy = new ClassificationStrategy(config);
      const orderBook = new MockOrderBook(100, 101);
      const context = createMockContext(orderBook);

      strategy.onInit(context);
      expect(strategy.isInitialized()).toBe(true);
    });

    test('should get prediction history', () => {
      const config: ClassificationStrategyConfig = {
        id: 'cls-test',
        name: 'Classification Test',
        params: {
          ml: createBaseMLConfig(['price', 'rsi-14']),
        },
      };

      const strategy = new ClassificationStrategy(config);
      const orderBook = new MockOrderBook(100, 101);
      const context = createMockContext(orderBook);

      strategy.onInit(context);
      
      const history = strategy.getPredictionHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    test('should get statistics', () => {
      const config: ClassificationStrategyConfig = {
        id: 'cls-test',
        name: 'Classification Test',
        params: {
          ml: createBaseMLConfig(['price', 'rsi-14']),
        },
      };

      const strategy = new ClassificationStrategy(config);
      const orderBook = new MockOrderBook(100, 101);
      const context = createMockContext(orderBook);

      strategy.onInit(context);
      
      const stats = strategy.getStatistics();
      expect(stats).toHaveProperty('totalPredictions');
      expect(stats).toHaveProperty('classDistribution');
      expect(stats).toHaveProperty('averageConfidence');
    });
  });
});

describe('AnomalyDetectionStrategy', () => {
  describe('Construction', () => {
    test('should create strategy with valid config', () => {
      const config: AnomalyDetectionStrategyConfig = {
        id: 'anomaly-test',
        name: 'Anomaly Test',
        params: {
          ml: createBaseMLConfig(['price', 'volume', 'volatility-20']),
        },
      };

      const strategy = new AnomalyDetectionStrategy(config);
      expect(strategy).toBeDefined();
    });

    test('should support custom anomaly params', () => {
      const config: AnomalyDetectionStrategyConfig = {
        id: 'anomaly-test',
        name: 'Anomaly Test',
        params: {
          ml: createBaseMLConfig(['price', 'volume']),
          anomaly: {
            threshold: 0.8,
            detectTypes: ['spike', 'drop'],
            action: 'alert',
          },
        },
      };

      const strategy = new AnomalyDetectionStrategy(config);
      expect(strategy).toBeDefined();
    });
  });

  describe('Trading Logic', () => {
    test('should initialize correctly', () => {
      const config: AnomalyDetectionStrategyConfig = {
        id: 'anomaly-test',
        name: 'Anomaly Test',
        params: {
          ml: createBaseMLConfig(['price', 'volume']),
        },
      };

      const strategy = new AnomalyDetectionStrategy(config);
      const orderBook = new MockOrderBook(100, 101);
      const context = createMockContext(orderBook);

      strategy.onInit(context);
      expect(strategy.isInitialized()).toBe(true);
    });

    test('should get anomaly history', () => {
      const config: AnomalyDetectionStrategyConfig = {
        id: 'anomaly-test',
        name: 'Anomaly Test',
        params: {
          ml: createBaseMLConfig(['price', 'volume']),
        },
      };

      const strategy = new AnomalyDetectionStrategy(config);
      const orderBook = new MockOrderBook(100, 101);
      const context = createMockContext(orderBook);

      strategy.onInit(context);
      
      const history = strategy.getAnomalyHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    test('should get statistics', () => {
      const config: AnomalyDetectionStrategyConfig = {
        id: 'anomaly-test',
        name: 'Anomaly Test',
        params: {
          ml: createBaseMLConfig(['price', 'volume']),
        },
      };

      const strategy = new AnomalyDetectionStrategy(config);
      const orderBook = new MockOrderBook(100, 101);
      const context = createMockContext(orderBook);

      strategy.onInit(context);
      
      const stats = strategy.getStatistics();
      expect(stats).toHaveProperty('totalAnomalies');
      expect(stats).toHaveProperty('byType');
      expect(stats).toHaveProperty('bySeverity');
    });
  });
});

describe('RLStrategy', () => {
  describe('Construction', () => {
    test('should create strategy with valid config', () => {
      const config: RLStrategyConfig = {
        id: 'rl-test',
        name: 'RL Test',
        params: {
          ml: createBaseMLConfig(['price', 'returns', 'rsi-14']),
        },
      };

      const strategy = new RLStrategy(config);
      expect(strategy).toBeDefined();
    });

    test('should support custom RL params', () => {
      const config: RLStrategyConfig = {
        id: 'rl-test',
        name: 'RL Test',
        params: {
          ml: createBaseMLConfig(['price', 'returns']),
          rl: {
            alpha: 0.2,
            gamma: 0.99,
            epsilon: 0.5,
            epsilonDecay: 0.99,
            epsilonMin: 0.05,
          },
        },
      };

      const strategy = new RLStrategy(config);
      expect(strategy).toBeDefined();
    });
  });

  describe('Trading Logic', () => {
    test('should initialize correctly', () => {
      const config: RLStrategyConfig = {
        id: 'rl-test',
        name: 'RL Test',
        params: {
          ml: createBaseMLConfig(['price', 'returns']),
        },
      };

      const strategy = new RLStrategy(config);
      const orderBook = new MockOrderBook(100, 101);
      const context = createMockContext(orderBook);

      strategy.onInit(context);
      expect(strategy.isInitialized()).toBe(true);
    });

    test('should get Q-table size', () => {
      const config: RLStrategyConfig = {
        id: 'rl-test',
        name: 'RL Test',
        params: {
          ml: createBaseMLConfig(['price', 'returns']),
        },
      };

      const strategy = new RLStrategy(config);
      const orderBook = new MockOrderBook(100, 101);
      const context = createMockContext(orderBook);

      strategy.onInit(context);
      
      const size = strategy.getQTableSize();
      expect(typeof size).toBe('number');
    });

    test('should get epsilon', () => {
      const config: RLStrategyConfig = {
        id: 'rl-test',
        name: 'RL Test',
        params: {
          ml: createBaseMLConfig(['price', 'returns']),
          rl: {
            epsilon: 0.3,
          },
        },
      };

      const strategy = new RLStrategy(config);
      const orderBook = new MockOrderBook(100, 101);
      const context = createMockContext(orderBook);

      strategy.onInit(context);
      
      const epsilon = strategy.getEpsilon();
      expect(epsilon).toBe(0.3);
    });

    test('should get action history', () => {
      const config: RLStrategyConfig = {
        id: 'rl-test',
        name: 'RL Test',
        params: {
          ml: createBaseMLConfig(['price', 'returns']),
        },
      };

      const strategy = new RLStrategy(config);
      const orderBook = new MockOrderBook(100, 101);
      const context = createMockContext(orderBook);

      strategy.onInit(context);
      
      const history = strategy.getActionHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    test('should get statistics', () => {
      const config: RLStrategyConfig = {
        id: 'rl-test',
        name: 'RL Test',
        params: {
          ml: createBaseMLConfig(['price', 'returns']),
        },
      };

      const strategy = new RLStrategy(config);
      const orderBook = new MockOrderBook(100, 101);
      const context = createMockContext(orderBook);

      strategy.onInit(context);
      
      const stats = strategy.getStatistics();
      expect(stats).toHaveProperty('qTableSize');
      expect(stats).toHaveProperty('epsilon');
      expect(stats).toHaveProperty('totalActions');
    });

    test('should export and import Q-table', () => {
      const config: RLStrategyConfig = {
        id: 'rl-test',
        name: 'RL Test',
        params: {
          ml: createBaseMLConfig(['price', 'returns']),
        },
      };

      const strategy = new RLStrategy(config);
      const orderBook = new MockOrderBook(100, 101);
      const context = createMockContext(orderBook);

      strategy.onInit(context);
      
      // Export
      const exported = strategy.exportQTable();
      expect(typeof exported).toBe('object');
      
      // Import
      strategy.importQTable(exported);
      
      // Should still work
      expect(strategy.getQTableSize()).toBeGreaterThanOrEqual(0);
    });
  });
});
