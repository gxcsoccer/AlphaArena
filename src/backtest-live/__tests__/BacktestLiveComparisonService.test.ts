/**
 * Tests for BacktestLiveComparisonService
 *
 * @module backtest-live/__tests__/BacktestLiveComparisonService.test
 */

import { BacktestLiveComparisonService } from '../BacktestLiveComparisonService';
import { ComparisonReportConfig } from '../ComparisonTypes';
import { backtestLiveDAO } from '../../database/backtest-live.dao';

// Mock the DAO
jest.mock('../../database/backtest-live.dao', () => ({
  backtestLiveDAO: {
    getIntegration: jest.fn(),
    getBacktestResult: jest.fn(),
    getLatestComparison: jest.fn(),
    getHistoricalComparisons: jest.fn(),
  },
}));

const mockBacktestLiveDAO = backtestLiveDAO as jest.Mocked<typeof backtestLiveDAO>;

describe('BacktestLiveComparisonService', () => {
  let service: BacktestLiveComparisonService;

  beforeEach(() => {
    service = new BacktestLiveComparisonService();
    jest.clearAllMocks();
  });

  describe('generateComparisonReport', () => {
    const mockConfig: ComparisonReportConfig = {
      integrationId: 'test-integration',
      userId: 'test-user',
      periodStart: Date.now() - 30 * 24 * 60 * 60 * 1000,
      periodEnd: Date.now(),
    };

    const mockIntegration = {
      id: 'test-integration',
      userId: 'test-user',
      strategy: {
        id: 'strategy-1',
        name: 'Test Strategy',
        type: 'sma',
        params: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
        userId: 'test-user',
      },
      backtestConfig: {
        capital: 10000,
        symbol: 'BTC/USDT',
        startTime: Date.now() - 90 * 24 * 60 * 60 * 1000,
        endTime: Date.now(),
      },
      environment: 'live',
      monitoring: {
        enableComparison: true,
        deviationThreshold: 20,
        comparisonInterval: 60000,
        enableOptimization: true,
        notificationChannels: [],
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'live',
      backtestResultId: 'backtest-result-1',
    };

    const mockBacktestResult = {
      id: 'backtest-result-1',
      userId: 'test-user',
      config: {} as any,
      stats: {
        totalReturn: 25.5,
        annualizedReturn: 35.2,
        sharpeRatio: 1.8,
        maxDrawdown: 12.3,
        winRate: 58.5,
        profitFactor: 1.65,
        totalTrades: 120,
        winningTrades: 70,
        losingTrades: 50,
        avgWin: 150,
        avgLoss: 80,
        initialCapital: 10000,
        finalCapital: 12550,
        totalPnL: 2550,
      },
      tradeSummary: {
        totalTrades: 120,
        buyTrades: 60,
        sellTrades: 60,
        avgTradeSize: 1000,
      },
      createdAt: Date.now(),
    };

    const mockComparison = {
      id: 'comparison-1',
      integrationId: 'test-integration',
      timestamp: Date.now(),
      comparison: {
        integrationId: 'test-integration',
        timestamp: Date.now(),
        periodStart: Date.now() - 30 * 24 * 60 * 60 * 1000,
        periodEnd: Date.now(),
        backtestMetrics: {
          totalReturn: 25.5,
          annualizedReturn: 35.2,
          sharpeRatio: 1.8,
          maxDrawdown: 12.3,
          winRate: 58.5,
          profitFactor: 1.65,
          totalTrades: 120,
          winningTrades: 70,
          losingTrades: 50,
          avgWin: 150,
          avgLoss: 80,
          initialCapital: 10000,
          finalCapital: 12550,
          totalPnL: 2550,
        },
        liveMetrics: {
          totalReturn: 18.2,
          annualizedReturn: 25.1,
          sharpeRatio: 1.2,
          maxDrawdown: 15.8,
          winRate: 52.3,
          profitFactor: 1.35,
          totalTrades: 95,
          winningTrades: 50,
          losingTrades: 45,
          avgWin: 120,
          avgLoss: 95,
          currentEquity: 11820,
          cashBalance: 5000,
          unrealizedPnL: 320,
          openPositions: 2,
        },
        deviation: {
          returnDeviation: -28.6,
          sharpeDeviation: -33.3,
          drawdownDeviation: 28.5,
          winRateDeviation: -10.6,
          tradeCountDeviation: -20.8,
          overallScore: 24.2,
          significantDeviations: [],
        },
        alertStatus: {
          hasAlerts: true,
          level: 'warning',
          messages: [],
        },
      },
      createdAt: Date.now(),
    };

    it('should generate a comparison report successfully', async () => {
      mockBacktestLiveDAO.getIntegration.mockResolvedValue(mockIntegration as any);
      mockBacktestLiveDAO.getBacktestResult.mockResolvedValue(mockBacktestResult as any);
      mockBacktestLiveDAO.getLatestComparison.mockResolvedValue(mockComparison as any);
      mockBacktestLiveDAO.getHistoricalComparisons.mockResolvedValue([mockComparison] as any);

      const report = await service.generateComparisonReport(mockConfig);

      expect(report).toBeDefined();
      expect(report.id).toBeDefined();
      expect(report.generatedAt).toBeLessThanOrEqual(Date.now());
      expect(report.config).toEqual(mockConfig);
      expect(report.backtestMetrics).toBeDefined();
      expect(report.liveMetrics).toBeDefined();
      expect(report.deviation).toBeDefined();
      expect(report.metricComparisons).toBeInstanceOf(Array);
      expect(report.insights).toBeInstanceOf(Array);
      expect(report.summary).toBeDefined();
      expect(report.visualizationData).toBeDefined();
    });

    it('should throw error if integration not found', async () => {
      mockBacktestLiveDAO.getIntegration.mockResolvedValue(null);

      await expect(service.generateComparisonReport(mockConfig)).rejects.toThrow(
        'Integration test-integration not found'
      );
    });

    it('should throw error if no backtest results available', async () => {
      mockBacktestLiveDAO.getIntegration.mockResolvedValue({
        ...mockIntegration,
        backtestResultId: undefined,
      } as any);

      await expect(service.generateComparisonReport(mockConfig)).rejects.toThrow(
        'No backtest results available'
      );
    });

    it('should generate metric comparisons with correct calculations', async () => {
      mockBacktestLiveDAO.getIntegration.mockResolvedValue(mockIntegration as any);
      mockBacktestLiveDAO.getBacktestResult.mockResolvedValue(mockBacktestResult as any);
      mockBacktestLiveDAO.getLatestComparison.mockResolvedValue(mockComparison as any);
      mockBacktestLiveDAO.getHistoricalComparisons.mockResolvedValue([mockComparison] as any);

      const report = await service.generateComparisonReport(mockConfig);

      // Check metric comparisons
      const totalReturnComparison = report.metricComparisons.find(
        (m) => m.key === 'totalReturn'
      );
      expect(totalReturnComparison).toBeDefined();
      expect(totalReturnComparison?.backtestValue).toBe(25.5);
      expect(totalReturnComparison?.liveValue).toBe(18.2);
      expect(totalReturnComparison?.deviation).toBeDefined();
      expect(totalReturnComparison?.severity).toBeDefined();
    });

    it('should generate insights based on deviation', async () => {
      mockBacktestLiveDAO.getIntegration.mockResolvedValue(mockIntegration as any);
      mockBacktestLiveDAO.getBacktestResult.mockResolvedValue(mockBacktestResult as any);
      mockBacktestLiveDAO.getLatestComparison.mockResolvedValue(mockComparison as any);
      mockBacktestLiveDAO.getHistoricalComparisons.mockResolvedValue([mockComparison] as any);

      const report = await service.generateComparisonReport(mockConfig);

      expect(report.insights.length).toBeGreaterThan(0);
      expect(report.insights[0]).toHaveProperty('id');
      expect(report.insights[0]).toHaveProperty('category');
      expect(report.insights[0]).toHaveProperty('priority');
      expect(report.insights[0]).toHaveProperty('title');
      expect(report.insights[0]).toHaveProperty('description');
      expect(report.insights[0]).toHaveProperty('recommendedAction');
    });

    it('should generate visualization data', async () => {
      mockBacktestLiveDAO.getIntegration.mockResolvedValue(mockIntegration as any);
      mockBacktestLiveDAO.getBacktestResult.mockResolvedValue(mockBacktestResult as any);
      mockBacktestLiveDAO.getLatestComparison.mockResolvedValue(mockComparison as any);
      mockBacktestLiveDAO.getHistoricalComparisons.mockResolvedValue([mockComparison] as any);

      const report = await service.generateComparisonReport(mockConfig);

      expect(report.visualizationData).toBeDefined();
      expect(report.visualizationData.equityCurveComparison).toBeDefined();
      expect(report.visualizationData.equityCurveComparison.backtest).toBeInstanceOf(Array);
      expect(report.visualizationData.equityCurveComparison.live).toBeInstanceOf(Array);
      expect(report.visualizationData.metricsRadar).toBeInstanceOf(Array);
      expect(report.visualizationData.divergenceTimeline).toBeInstanceOf(Array);
      expect(report.visualizationData.performanceHeatmap).toBeInstanceOf(Array);
    });

    it('should determine correct overall assessment', async () => {
      mockBacktestLiveDAO.getIntegration.mockResolvedValue(mockIntegration as any);
      mockBacktestLiveDAO.getBacktestResult.mockResolvedValue(mockBacktestResult as any);
      mockBacktestLiveDAO.getLatestComparison.mockResolvedValue(mockComparison as any);
      mockBacktestLiveDAO.getHistoricalComparisons.mockResolvedValue([mockComparison] as any);

      const report = await service.generateComparisonReport(mockConfig);

      expect(['outperforming', 'on_track', 'underperforming', 'critical']).toContain(
        report.summary.overallAssessment
      );
    });

    it('should include slippage analysis when requested', async () => {
      const configWithSlippage: ComparisonReportConfig = {
        ...mockConfig,
        includeSlippageAnalysis: true,
      };

      mockBacktestLiveDAO.getIntegration.mockResolvedValue(mockIntegration as any);
      mockBacktestLiveDAO.getBacktestResult.mockResolvedValue(mockBacktestResult as any);
      mockBacktestLiveDAO.getLatestComparison.mockResolvedValue(mockComparison as any);
      mockBacktestLiveDAO.getHistoricalComparisons.mockResolvedValue([mockComparison] as any);

      const report = await service.generateComparisonReport(configWithSlippage);

      expect(report.slippageImpact).toBeDefined();
      expect(report.slippageImpact?.avgSlippagePercent).toBeDefined();
      expect(report.slippageImpact?.totalSlippageCost).toBeDefined();
      expect(report.slippageImpact?.returnImpact).toBeDefined();
    });

    it('should include fee analysis when requested', async () => {
      const configWithFee: ComparisonReportConfig = {
        ...mockConfig,
        includeFeeAnalysis: true,
      };

      mockBacktestLiveDAO.getIntegration.mockResolvedValue(mockIntegration as any);
      mockBacktestLiveDAO.getBacktestResult.mockResolvedValue(mockBacktestResult as any);
      mockBacktestLiveDAO.getLatestComparison.mockResolvedValue(mockComparison as any);
      mockBacktestLiveDAO.getHistoricalComparisons.mockResolvedValue([mockComparison] as any);

      const report = await service.generateComparisonReport(configWithFee);

      expect(report.feeImpact).toBeDefined();
      expect(report.feeImpact?.totalFees).toBeDefined();
      expect(report.feeImpact?.feeRate).toBeDefined();
      expect(report.feeImpact?.returnImpact).toBeDefined();
    });

    it('should include market environment comparison when requested', async () => {
      const configWithMarket: ComparisonReportConfig = {
        ...mockConfig,
        includeMarketEnvironment: true,
      };

      mockBacktestLiveDAO.getIntegration.mockResolvedValue(mockIntegration as any);
      mockBacktestLiveDAO.getBacktestResult.mockResolvedValue(mockBacktestResult as any);
      mockBacktestLiveDAO.getLatestComparison.mockResolvedValue(mockComparison as any);
      mockBacktestLiveDAO.getHistoricalComparisons.mockResolvedValue([mockComparison] as any);

      const report = await service.generateComparisonReport(configWithMarket);

      expect(report.marketEnvironment).toBeDefined();
      expect(report.marketEnvironment?.backtestPeriod).toBeDefined();
      expect(report.marketEnvironment?.livePeriod).toBeDefined();
      expect(report.marketEnvironment?.similarityScore).toBeDefined();
    });
  });
});