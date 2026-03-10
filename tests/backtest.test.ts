/**
 * BacktestEngine tests
 */

import { BacktestEngine } from '../src/backtest/BacktestEngine';
import { BacktestConfig } from '../src/backtest/types';

describe('BacktestEngine', () => {
  const defaultConfig: BacktestConfig = {
    capital: 100000,
    symbol: 'AAPL',
    startTime: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
    endTime: Date.now(),
    strategy: 'sma',
    strategyParams: {
      shortPeriod: 5,
      longPeriod: 20,
      tradeQuantity: 10
    }
  };

  describe('constructor', () => {
    it('should create engine with valid config', () => {
      const engine = new BacktestEngine(defaultConfig);
      expect(engine).toBeDefined();
    });

    it('should throw error for unknown strategy', () => {
      const invalidConfig: BacktestConfig = {
        ...defaultConfig,
        strategy: 'unknown'
      };
      
      expect(() => new BacktestEngine(invalidConfig)).toThrow('Unknown strategy: unknown');
    });
  });

  describe('run', () => {
    it('should run backtest and return results', () => {
      const engine = new BacktestEngine(defaultConfig);
      const result = engine.run();
      
      expect(result).toBeDefined();
      expect(result.config).toEqual(defaultConfig);
      expect(result.stats).toBeDefined();
      expect(result.snapshots).toBeDefined();
      expect(result.snapshots.length).toBeGreaterThan(0);
      expect(result.trades).toBeDefined();
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should calculate correct initial capital', () => {
      const config: BacktestConfig = {
        ...defaultConfig,
        capital: 50000
      };
      const engine = new BacktestEngine(config);
      const result = engine.run();
      
      expect(result.stats.initialCapital).toBe(50000);
    });

    it('should generate snapshots during backtest', () => {
      const engine = new BacktestEngine(defaultConfig);
      const result = engine.run();
      
      // Should have at least initial and final snapshots
      expect(result.snapshots.length).toBeGreaterThanOrEqual(2);
      
      // Snapshots should be in chronological order
      for (let i = 1; i < result.snapshots.length; i++) {
        expect(result.snapshots[i].timestamp).toBeGreaterThanOrEqual(
          result.snapshots[i - 1].timestamp
        );
      }
    });

    it('should calculate statistics correctly', () => {
      const engine = new BacktestEngine(defaultConfig);
      const result = engine.run();
      const stats = result.stats;
      
      expect(stats.totalReturn).toBeDefined();
      expect(stats.sharpeRatio).toBeDefined();
      expect(stats.maxDrawdown).toBeDefined();
      expect(stats.totalTrades).toBeGreaterThanOrEqual(0);
      expect(stats.winRate).toBeGreaterThanOrEqual(0);
      expect(stats.winRate).toBeLessThanOrEqual(100);
      expect(stats.initialCapital).toBe(defaultConfig.capital);
      expect(stats.finalCapital).toBeGreaterThanOrEqual(0);
    });
  });

  describe('exportToJSON', () => {
    it('should export results as JSON string', () => {
      const engine = new BacktestEngine(defaultConfig);
      const json = engine.exportToJSON();
      
      expect(json).toBeDefined();
      expect(typeof json).toBe('string');
      
      // Should be valid JSON
      const parsed = JSON.parse(json);
      expect(parsed.config).toBeDefined();
      expect(parsed.stats).toBeDefined();
    });
  });

  describe('exportToCSV', () => {
    it('should export results as CSV string', () => {
      const engine = new BacktestEngine(defaultConfig);
      const csv = engine.exportToCSV();
      
      expect(csv).toBeDefined();
      expect(typeof csv).toBe('string');
      expect(csv).toContain('timestamp,cash,totalValue,unrealizedPnL,positions');
    });
  });

  describe('different strategies', () => {
    it('should work with SMA strategy (case insensitive)', () => {
      const configs = [
        { ...defaultConfig, strategy: 'sma' },
        { ...defaultConfig, strategy: 'SMA' },
        { ...defaultConfig, strategy: 'SMACrossover' },
        { ...defaultConfig, strategy: 'smacrossover' }
      ];
      
      for (const config of configs) {
        const engine = new BacktestEngine(config);
        const result = engine.run();
        expect(result).toBeDefined();
        expect(result.stats).toBeDefined();
      }
    });
  });

  describe('different parameters', () => {
    it('should work with different capital amounts', () => {
      const capitals = [10000, 50000, 100000, 1000000];
      
      for (const capital of capitals) {
        const config: BacktestConfig = {
          ...defaultConfig,
          capital
        };
        const engine = new BacktestEngine(config);
        const result = engine.run();
        
        expect(result.stats.initialCapital).toBe(capital);
      }
    });

    it('should work with different symbols', () => {
      const symbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA'];
      
      for (const symbol of symbols) {
        const config: BacktestConfig = {
          ...defaultConfig,
          symbol
        };
        const engine = new BacktestEngine(config);
        const result = engine.run();
        
        expect(result.config.symbol).toBe(symbol);
      }
    });

    it('should work with different SMA periods', () => {
      const params = [
        { shortPeriod: 3, longPeriod: 10 },
        { shortPeriod: 10, longPeriod: 50 },
        { shortPeriod: 20, longPeriod: 100 }
      ];
      
      for (const param of params) {
        const config: BacktestConfig = {
          ...defaultConfig,
          strategyParams: {
            ...defaultConfig.strategyParams,
            shortPeriod: param.shortPeriod,
            longPeriod: param.longPeriod
          }
        };
        const engine = new BacktestEngine(config);
        const result = engine.run();
        
        expect(result).toBeDefined();
      }
    });
  });

  describe('edge cases', () => {
    it('should handle very short duration', () => {
      const config: BacktestConfig = {
        ...defaultConfig,
        startTime: Date.now() - 1000, // 1 second
        endTime: Date.now()
      };
      
      const engine = new BacktestEngine(config);
      const result = engine.run();
      
      expect(result).toBeDefined();
      expect(result.stats).toBeDefined();
    });

    it('should handle large capital', () => {
      const config: BacktestConfig = {
        ...defaultConfig,
        capital: 10000000 // 10 million
      };
      
      const engine = new BacktestEngine(config);
      const result = engine.run();
      
      expect(result.stats.initialCapital).toBe(10000000);
      expect(result.stats.finalCapital).toBeGreaterThan(0);
    });
  });
});
