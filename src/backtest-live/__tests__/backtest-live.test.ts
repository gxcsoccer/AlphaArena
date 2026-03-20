/**
 * Tests for Backtest-Live Integration
 */

import { ConfigSync } from '../ConfigSync';
import { PerformanceMonitor } from '../PerformanceMonitor';
import { OptimizationFeedback } from '../OptimizationFeedback';
import { BacktestLiveIntegration } from '../BacktestLiveIntegration';
import type {
  IntegratedStrategyConfig,
  PerformanceComparison,
  OptimizationSuggestion,
} from '../types';
import type { BacktestStats } from '../../backtest/types';

// Mock the database DAO
jest.mock('../../database/backtest-live.dao', () => ({
  backtestLiveDAO: {
    createIntegration: jest.fn(),
    getIntegration: jest.fn(),
    updateIntegration: jest.fn(),
    updateStatus: jest.fn(),
    deleteIntegration: jest.fn(),
    getUserIntegrations: jest.fn(),
    saveBacktestResult: jest.fn(),
    getBacktestResult: jest.fn(),
    getUserBacktestResults: jest.fn(),
    deleteBacktestResult: jest.fn(),
    savePerformanceComparison: jest.fn(),
    getHistoricalComparisons: jest.fn(),
    getLatestComparison: jest.fn(),
    saveOptimizationSuggestion: jest.fn(),
    getOptimizationSuggestions: jest.fn(),
    applySuggestion: jest.fn(),
    deleteSuggestion: jest.fn(),
  },
}));

import { backtestLiveDAO } from '../../database/backtest-live.dao';

describe('ConfigSync', () => {
  let configSync: ConfigSync;

  beforeEach(() => {
    configSync = new ConfigSync();
    jest.clearAllMocks();
  });

  describe('createIntegratedStrategy', () => {
    it('should create a new integrated strategy', async () => {
      const mockIntegration: IntegratedStrategyConfig = {
        id: 'test-integration-id',
        userId: 'user-123',
        strategy: {
          id: 'strategy-123',
          name: 'Test SMA Strategy',
          type: 'sma',
          params: { shortPeriod: 5, longPeriod: 20 },
          userId: 'user-123',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        backtestConfig: {
          capital: 100000,
          symbol: 'BTC/USDT',
          startTime: Date.now() - 86400000 * 30,
          endTime: Date.now(),
          strategy: 'sma',
        },
        environment: 'backtest',
        monitoring: {
          enableComparison: true,
          deviationThreshold: 10,
          comparisonInterval: 60000,
          enableOptimization: true,
          notificationChannels: [],
        },
        status: 'draft',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (backtestLiveDAO.createIntegration as jest.Mock).mockResolvedValue(mockIntegration);

      const result = await configSync.createIntegratedStrategy(
        'user-123',
        {
          name: 'Test SMA Strategy',
          type: 'sma',
          params: { shortPeriod: 5, longPeriod: 20 },
        },
        {
          capital: 100000,
          symbol: 'BTC/USDT',
          startTime: Date.now() - 86400000 * 30,
          endTime: Date.now(),
          strategy: 'sma',
        }
      );

      expect(result).toBeDefined();
      expect(result.userId).toBe('user-123');
      expect(result.strategy.type).toBe('sma');
      expect(result.environment).toBe('backtest');
      expect(backtestLiveDAO.createIntegration).toHaveBeenCalled();
    });
  });

  describe('migrateEnvironment', () => {
    it('should migrate from backtest to paper', async () => {
      const mockIntegration: IntegratedStrategyConfig = {
        id: 'test-integration-id',
        userId: 'user-123',
        strategy: {
          id: 'strategy-123',
          name: 'Test Strategy',
          type: 'sma',
          params: { shortPeriod: 5, longPeriod: 20 },
          userId: 'user-123',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        backtestConfig: {
          capital: 100000,
          symbol: 'BTC/USDT',
          startTime: Date.now() - 86400000 * 30,
          endTime: Date.now(),
          strategy: 'sma',
        },
        environment: 'backtest',
        backtestResultId: 'result-123',
        monitoring: {
          enableComparison: true,
          deviationThreshold: 10,
          comparisonInterval: 60000,
          enableOptimization: true,
          notificationChannels: [],
        },
        status: 'draft',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (backtestLiveDAO.getIntegration as jest.Mock).mockResolvedValue(mockIntegration);
      (backtestLiveDAO.updateIntegration as jest.Mock).mockResolvedValue({
        ...mockIntegration,
        environment: 'paper',
        status: 'paper_trading',
      });

      const result = await configSync.migrateEnvironment({
        integrationId: 'test-integration-id',
        targetEnvironment: 'paper',
      });

      expect(result.success).toBe(true);
      expect(result.environment).toBe('paper');
    });

    it('should fail migration if live config is missing for live environment', async () => {
      const mockIntegration: IntegratedStrategyConfig = {
        id: 'test-integration-id',
        userId: 'user-123',
        strategy: {
          id: 'strategy-123',
          name: 'Test Strategy',
          type: 'sma',
          params: { shortPeriod: 5, longPeriod: 20 },
          userId: 'user-123',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        backtestConfig: {
          capital: 100000,
          symbol: 'BTC/USDT',
          startTime: Date.now() - 86400000 * 30,
          endTime: Date.now(),
          strategy: 'sma',
        },
        environment: 'paper',
        backtestResultId: 'result-123',
        monitoring: {
          enableComparison: true,
          deviationThreshold: 10,
          comparisonInterval: 60000,
          enableOptimization: true,
          notificationChannels: [],
        },
        status: 'paper_trading',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (backtestLiveDAO.getIntegration as jest.Mock).mockResolvedValue(mockIntegration);

      const result = await configSync.migrateEnvironment({
        integrationId: 'test-integration-id',
        targetEnvironment: 'live',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Live trading configuration is required');
    });
  });

  describe('updateStrategyParams', () => {
    it('should update strategy parameters', async () => {
      const mockIntegration: IntegratedStrategyConfig = {
        id: 'test-integration-id',
        userId: 'user-123',
        strategy: {
          id: 'strategy-123',
          name: 'Test Strategy',
          type: 'sma',
          params: { shortPeriod: 5, longPeriod: 20 },
          userId: 'user-123',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        backtestConfig: {
          capital: 100000,
          symbol: 'BTC/USDT',
          startTime: Date.now() - 86400000 * 30,
          endTime: Date.now(),
          strategy: 'sma',
        },
        environment: 'backtest',
        monitoring: {
          enableComparison: true,
          deviationThreshold: 10,
          comparisonInterval: 60000,
          enableOptimization: true,
          notificationChannels: [],
        },
        status: 'draft',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (backtestLiveDAO.getIntegration as jest.Mock).mockResolvedValue(mockIntegration);
      (backtestLiveDAO.updateIntegration as jest.Mock).mockResolvedValue({
        ...mockIntegration,
        strategy: {
          ...mockIntegration.strategy,
          params: { shortPeriod: 10, longPeriod: 20 },
        },
      });

      const result = await configSync.updateStrategyParams('test-integration-id', {
        shortPeriod: 10,
      });

      expect(result.strategy.params.shortPeriod).toBe(10);
    });
  });
});

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
    jest.clearAllMocks();
  });

  afterEach(() => {
    performanceMonitor.stopAllMonitoring();
  });

  describe('calculateDeviation', () => {
    it('should calculate deviation correctly', async () => {
      const monitor = performanceMonitor as any;

      const backtest: BacktestStats = {
        totalReturn: 20,
        annualizedReturn: 20,
        sharpeRatio: 1.5,
        maxDrawdown: 10,
        totalTrades: 100,
        winningTrades: 60,
        losingTrades: 40,
        winRate: 60,
        avgWin: 500,
        avgLoss: 300,
        profitFactor: 2.5,
        initialCapital: 100000,
        finalCapital: 120000,
        totalPnL: 20000,
      };

      const live = {
        totalReturn: 15,
        annualizedReturn: 15,
        sharpeRatio: 1.2,
        maxDrawdown: 12,
        totalTrades: 80,
        winningTrades: 45,
        losingTrades: 35,
        winRate: 56.25,
        avgWin: 450,
        avgLoss: 280,
        profitFactor: 2.0,
        currentEquity: 115000,
        cashBalance: 50000,
        unrealizedPnL: 5000,
        openPositions: 2,
      };

      const deviation = monitor.calculateDeviation(backtest, live, 10);

      expect(deviation.returnDeviation).toBeCloseTo(-25, 0);
      expect(deviation.sharpeDeviation).toBeCloseTo(-20, 0);
      expect(deviation.drawdownDeviation).toBeCloseTo(20, 0);
      expect(deviation.overallScore).toBeGreaterThan(0);
    });

    it('should detect significant deviations', async () => {
      const monitor = performanceMonitor as any;

      const backtest: BacktestStats = {
        totalReturn: 20,
        annualizedReturn: 20,
        sharpeRatio: 1.5,
        maxDrawdown: 10,
        totalTrades: 100,
        winningTrades: 60,
        losingTrades: 40,
        winRate: 60,
        avgWin: 500,
        avgLoss: 300,
        profitFactor: 2.5,
        initialCapital: 100000,
        finalCapital: 120000,
        totalPnL: 20000,
      };

      const live = {
        totalReturn: -10,
        annualizedReturn: -10,
        sharpeRatio: 0.5,
        maxDrawdown: 25,
        totalTrades: 150,
        winningTrades: 60,
        losingTrades: 90,
        winRate: 40,
        avgWin: 300,
        avgLoss: 500,
        profitFactor: 0.8,
        currentEquity: 90000,
        cashBalance: 40000,
        unrealizedPnL: -5000,
        openPositions: 3,
      };

      const deviation = monitor.calculateDeviation(backtest, live, 10);

      expect(deviation.significantDeviations.length).toBeGreaterThan(0);
      expect(deviation.significantDeviations[0].severity).toBeDefined();
      expect(deviation.significantDeviations[0].possibleCauses.length).toBeGreaterThan(0);
    });
  });

  describe('getSeverity', () => {
    it('should return correct severity levels', () => {
      const monitor = performanceMonitor as any;

      expect(monitor.getSeverity(35, 10)).toBe('critical');
      expect(monitor.getSeverity(25, 10)).toBe('high');
      expect(monitor.getSeverity(16, 10)).toBe('medium');
      expect(monitor.getSeverity(11, 10)).toBe('low');
    });
  });
});

describe('OptimizationFeedback', () => {
  let optimizationFeedback: OptimizationFeedback;

  beforeEach(() => {
    optimizationFeedback = new OptimizationFeedback();
    jest.clearAllMocks();
  });

  describe('analyzeTrends', () => {
    it('should detect improving trend', () => {
      const feedback = optimizationFeedback as any;
      
      const values = [10, 12, 14, 16, 18, 20];
      const trend = feedback.getTrend(values);

      expect(trend).toBe('improving');
    });

    it('should detect declining trend', () => {
      const feedback = optimizationFeedback as any;
      
      const values = [20, 18, 16, 14, 12, 10];
      const trend = feedback.getTrend(values);

      expect(trend).toBe('declining');
    });

    it('should detect stable trend', () => {
      const feedback = optimizationFeedback as any;
      
      const values = [15, 15, 15, 15, 15, 15];
      const trend = feedback.getTrend(values);

      expect(trend).toBe('stable');
    });
  });

  describe('analyzePerformance', () => {
    it('should return empty suggestions when not enough data', async () => {
      (backtestLiveDAO.getHistoricalComparisons as jest.Mock).mockResolvedValue([]);

      const mockIntegration: IntegratedStrategyConfig = {
        id: 'test-integration-id',
        userId: 'user-123',
        strategy: {
          id: 'strategy-123',
          name: 'Test Strategy',
          type: 'sma',
          params: { shortPeriod: 5, longPeriod: 20 },
          userId: 'user-123',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        backtestConfig: {
          capital: 100000,
          symbol: 'BTC/USDT',
          startTime: Date.now() - 86400000 * 30,
          endTime: Date.now(),
          strategy: 'sma',
        },
        environment: 'paper',
        monitoring: {
          enableComparison: true,
          deviationThreshold: 10,
          comparisonInterval: 60000,
          enableOptimization: true,
          notificationChannels: [],
        },
        status: 'paper_trading',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = await optimizationFeedback.analyzePerformance(mockIntegration);

      expect(result.suggestions).toHaveLength(0);
      expect(result.confidence).toBe(0);
    });
  });
});

describe('BacktestLiveIntegration', () => {
  let integration: BacktestLiveIntegration;

  beforeEach(() => {
    integration = new BacktestLiveIntegration();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await integration.shutdown();
  });

  describe('createStrategy', () => {
    it('should create a new integrated strategy', async () => {
      const mockIntegration: IntegratedStrategyConfig = {
        id: 'test-integration-id',
        userId: 'user-123',
        strategy: {
          id: 'strategy-123',
          name: 'Test Strategy',
          type: 'sma',
          params: { shortPeriod: 5, longPeriod: 20 },
          userId: 'user-123',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        backtestConfig: {
          capital: 100000,
          symbol: 'BTC/USDT',
          startTime: Date.now() - 86400000 * 30,
          endTime: Date.now(),
          strategy: 'sma',
        },
        environment: 'backtest',
        monitoring: {
          enableComparison: true,
          deviationThreshold: 10,
          comparisonInterval: 60000,
          enableOptimization: true,
          notificationChannels: [],
        },
        status: 'draft',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (backtestLiveDAO.createIntegration as jest.Mock).mockResolvedValue(mockIntegration);

      const result = await integration.createStrategy(
        'user-123',
        {
          name: 'Test Strategy',
          type: 'sma',
          params: { shortPeriod: 5, longPeriod: 20 },
        },
        {
          capital: 100000,
          symbol: 'BTC/USDT',
          startTime: Date.now() - 86400000 * 30,
          endTime: Date.now(),
          strategy: 'sma',
        }
      );

      expect(result).toBeDefined();
      expect(result.userId).toBe('user-123');
    });
  });

  describe('pauseIntegration', () => {
    it('should pause an integration', async () => {
      (backtestLiveDAO.updateStatus as jest.Mock).mockResolvedValue(undefined);

      await integration.pauseIntegration('test-integration-id');

      expect(backtestLiveDAO.updateStatus).toHaveBeenCalledWith('test-integration-id', 'paused');
    });
  });

  describe('stopIntegration', () => {
    it('should stop an integration', async () => {
      (backtestLiveDAO.updateStatus as jest.Mock).mockResolvedValue(undefined);
      (backtestLiveDAO.deleteIntegration as jest.Mock).mockResolvedValue(undefined);

      await integration.stopIntegration('test-integration-id');

      expect(backtestLiveDAO.updateStatus).toHaveBeenCalledWith('test-integration-id', 'stopped');
    });
  });
});