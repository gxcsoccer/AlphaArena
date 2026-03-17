/**
 * StrategyComparisonService Tests
 */

import { StrategyComparisonService, ComparisonConfig } from '../StrategyComparisonService';
import { BacktestEngine } from '../../backtest/BacktestEngine';

// Mock BacktestEngine
jest.mock('../../backtest/BacktestEngine');

describe('StrategyComparisonService', () => {
  let service: StrategyComparisonService;

  const mockBacktestResult = {
    config: {
      capital: 10000,
      symbol: 'BTC/USDT',
      startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
      endTime: Date.now(),
      strategy: 'sma',
    },
    stats: {
      totalReturn: 15.5,
      annualizedReturn: 15.5,
      sharpeRatio: 1.2,
      maxDrawdown: 8.5,
      totalTrades: 100,
      winningTrades: 60,
      losingTrades: 40,
      winRate: 60,
      avgWin: 200,
      avgLoss: 150,
      profitFactor: 1.33,
      initialCapital: 10000,
      finalCapital: 11550,
      totalPnL: 1550,
    },
    snapshots: [
      { timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000, totalValue: 10000 },
      { timestamp: Date.now() - 15 * 24 * 60 * 60 * 1000, totalValue: 10500 },
      { timestamp: Date.now(), totalValue: 11550 },
    ],
    trades: [
      { timestamp: Date.now() - 20 * 24 * 60 * 60 * 1000, realizedPnL: 100 },
      { timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000, realizedPnL: -50 },
    ],
    startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
    endTime: Date.now(),
    duration: 30 * 24 * 60 * 60 * 1000,
  };

  beforeEach(() => {
    service = new StrategyComparisonService();
    jest.clearAllMocks();
    
    // Mock BacktestEngine.run to return mock result
    (BacktestEngine as unknown as jest.Mock).mockImplementation(() => ({
      run: jest.fn().mockResolvedValue(mockBacktestResult),
    }));
  });

  describe('compare', () => {
    const validConfig: ComparisonConfig = {
      capital: 10000,
      symbol: 'BTC/USDT',
      startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
      endTime: Date.now(),
      strategies: [
        { id: 'sma', name: 'SMA Strategy' },
        { id: 'rsi', name: 'RSI Strategy' },
      ],
    };

    it('should execute comparison with valid config', async () => {
      const result = await service.compare(validConfig);

      expect(result).toBeDefined();
      expect(result.id).toMatch(/^comparison-/);
      expect(result.config).toEqual(validConfig);
      expect(result.results).toHaveLength(2);
      expect(result.rankings).toHaveLength(2);
    });

    it('should throw error with less than 2 strategies', async () => {
      const invalidConfig = {
        ...validConfig,
        strategies: [{ id: 'sma', name: 'SMA Strategy' }],
      };

      await expect(service.compare(invalidConfig as any)).rejects.toThrow(
        'At least 2 strategies are required for comparison'
      );
    });

    it('should throw error with more than 5 strategies', async () => {
      const invalidConfig = {
        ...validConfig,
        strategies: [
          { id: 'sma', name: 'SMA' },
          { id: 'rsi', name: 'RSI' },
          { id: 'macd', name: 'MACD' },
          { id: 'bollinger', name: 'Bollinger' },
          { id: 'atr', name: 'ATR' },
          { id: 'stochastic', name: 'Stochastic' },
        ],
      };

      await expect(service.compare(invalidConfig)).rejects.toThrow(
        'Maximum 5 strategies can be compared at once'
      );
    });

    it('should throw error with invalid capital', async () => {
      const invalidConfig = {
        ...validConfig,
        capital: 50,
      };

      await expect(service.compare(invalidConfig)).rejects.toThrow(
        'Initial capital must be at least 100'
      );
    });

    it('should throw error with missing symbol', async () => {
      const invalidConfig = {
        ...validConfig,
        symbol: '',
      };

      await expect(service.compare(invalidConfig)).rejects.toThrow('Symbol is required');
    });

    it('should throw error with invalid date range', async () => {
      const invalidConfig = {
        ...validConfig,
        startTime: Date.now(),
        endTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
      };

      await expect(service.compare(invalidConfig)).rejects.toThrow(
        'Start time must be before end time'
      );
    });

    it('should throw error with duplicate strategy IDs', async () => {
      const invalidConfig = {
        ...validConfig,
        strategies: [
          { id: 'sma', name: 'SMA Strategy' },
          { id: 'sma', name: 'SMA Strategy 2' },
        ],
      };

      await expect(service.compare(invalidConfig)).rejects.toThrow(
        'Strategy IDs must be unique'
      );
    });
  });

  describe('getComparison', () => {
    it('should return null for non-existent comparison', () => {
      const result = service.getComparison('non-existent');
      expect(result).toBeNull();
    });

    it('should return stored comparison', async () => {
      const config: ComparisonConfig = {
        capital: 10000,
        symbol: 'BTC/USDT',
        startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
        endTime: Date.now(),
        strategies: [
          { id: 'sma', name: 'SMA Strategy' },
          { id: 'rsi', name: 'RSI Strategy' },
        ],
      };

      const comparisonResult = await service.compare(config);
      const retrieved = service.getComparison(comparisonResult.id);

      expect(retrieved).toEqual(comparisonResult);
    });
  });

  describe('getAllComparisons', () => {
    it('should return empty array initially', () => {
      const results = service.getAllComparisons();
      expect(results).toHaveLength(0);
    });

    it('should return all comparisons sorted by creation time', async () => {
      const config: ComparisonConfig = {
        capital: 10000,
        symbol: 'BTC/USDT',
        startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
        endTime: Date.now(),
        strategies: [
          { id: 'sma', name: 'SMA Strategy' },
          { id: 'rsi', name: 'RSI Strategy' },
        ],
      };

      await service.compare(config);
      await service.compare(config);

      const results = service.getAllComparisons();
      expect(results).toHaveLength(2);
      expect(results[0].createdAt).toBeGreaterThanOrEqual(results[1].createdAt);
    });
  });

  describe('deleteComparison', () => {
    it('should return false for non-existent comparison', () => {
      const deleted = service.deleteComparison('non-existent');
      expect(deleted).toBe(false);
    });

    it('should delete existing comparison', async () => {
      const config: ComparisonConfig = {
        capital: 10000,
        symbol: 'BTC/USDT',
        startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
        endTime: Date.now(),
        strategies: [
          { id: 'sma', name: 'SMA Strategy' },
          { id: 'rsi', name: 'RSI Strategy' },
        ],
      };

      const result = await service.compare(config);
      const deleted = service.deleteComparison(result.id);

      expect(deleted).toBe(true);
      expect(service.getComparison(result.id)).toBeNull();
    });
  });

  describe('exportToCSV', () => {
    it('should generate valid CSV output', async () => {
      const config: ComparisonConfig = {
        capital: 10000,
        symbol: 'BTC/USDT',
        startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
        endTime: Date.now(),
        strategies: [
          { id: 'sma', name: 'SMA Strategy' },
          { id: 'rsi', name: 'RSI Strategy' },
        ],
      };

      const result = await service.compare(config);
      const csv = service.exportToCSV(result);

      expect(csv).toContain('Strategy,Total Return');
      expect(csv).toContain('SMA Strategy');
      expect(csv).toContain('RSI Strategy');
    });
  });

  describe('clearAll', () => {
    it('should remove all comparisons', async () => {
      const config: ComparisonConfig = {
        capital: 10000,
        symbol: 'BTC/USDT',
        startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
        endTime: Date.now(),
        strategies: [
          { id: 'sma', name: 'SMA Strategy' },
          { id: 'rsi', name: 'RSI Strategy' },
        ],
      };

      await service.compare(config);
      await service.compare(config);

      service.clearAll();
      expect(service.getAllComparisons()).toHaveLength(0);
    });
  });
});
