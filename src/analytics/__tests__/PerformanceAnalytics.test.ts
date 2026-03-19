/**
 * Performance Analytics Tests
 */

import { PerformanceAnalyticsService } from '../PerformanceAnalytics';
import { PortfolioSnapshot } from '../../portfolio/types';

describe('PerformanceAnalyticsService', () => {
  let service: PerformanceAnalyticsService;

  beforeEach(() => {
    service = new PerformanceAnalyticsService();
  });

  describe('calculatePerformanceMetrics', () => {
    it('should return empty metrics for empty snapshots', () => {
      const metrics = service.calculatePerformanceMetrics([], [], 10000);

      expect(metrics.returns.totalReturn).toBe(0);
      expect(metrics.risk.maxDrawdown).toBe(0);
      expect(metrics.trading.totalTrades).toBe(0);
    });

    it('should calculate correct return metrics', () => {
      const snapshots: PortfolioSnapshot[] = [
        { timestamp: 1000, cash: 10000, positions: [], totalValue: 10000, unrealizedPnL: 0 },
        { timestamp: 2000, cash: 10500, positions: [], totalValue: 10500, unrealizedPnL: 0 },
        { timestamp: 3000, cash: 10200, positions: [], totalValue: 10200, unrealizedPnL: 0 },
        { timestamp: 4000, cash: 10800, positions: [], totalValue: 10800, unrealizedPnL: 0 },
      ];

      const metrics = service.calculatePerformanceMetrics(snapshots, [], 10000);

      expect(metrics.returns.totalReturn).toBeCloseTo(8);
      expect(metrics.returns.cumulativeReturns).toHaveLength(4);
      expect(metrics.returns.cumulativeReturns[3]).toBeCloseTo(8);
    });

    it('should calculate correct risk metrics', () => {
      const snapshots: PortfolioSnapshot[] = [
        { timestamp: 1000, cash: 10000, positions: [], totalValue: 10000, unrealizedPnL: 0 },
        { timestamp: 2000, cash: 12000, positions: [], totalValue: 12000, unrealizedPnL: 0 },
        { timestamp: 3000, cash: 9000, positions: [], totalValue: 9000, unrealizedPnL: 0 },
        { timestamp: 4000, cash: 11000, positions: [], totalValue: 11000, unrealizedPnL: 0 },
      ];

      const metrics = service.calculatePerformanceMetrics(snapshots, [], 10000);

      // Max drawdown: from 12000 to 9000 = 25%
      expect(metrics.risk.maxDrawdown).toBeCloseTo(25);
    });

    it('should calculate win rate correctly', () => {
      const snapshots: PortfolioSnapshot[] = [
        { timestamp: 1000, cash: 10000, positions: [], totalValue: 10000, unrealizedPnL: 0 },
        { timestamp: 2000, cash: 11000, positions: [], totalValue: 11000, unrealizedPnL: 0 },
      ];

      const trades = [
        { realizedPnL: 100, timestamp: 1500 },
        { realizedPnL: -50, timestamp: 1600 },
        { realizedPnL: 200, timestamp: 1700 },
        { realizedPnL: -75, timestamp: 1800 },
      ];

      const metrics = service.calculatePerformanceMetrics(snapshots, trades, 10000);

      expect(metrics.returns.winRate).toBeCloseTo(50); // 2 out of 4
    });
  });

  describe('calculateReturnMetrics', () => {
    it('should calculate annualized return correctly', () => {
      const now = Date.now();
      const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;

      const snapshots: PortfolioSnapshot[] = [
        { timestamp: oneYearAgo, cash: 10000, positions: [], totalValue: 10000, unrealizedPnL: 0 },
        { timestamp: now, cash: 12000, positions: [], totalValue: 12000, unrealizedPnL: 0 },
      ];

      const metrics = service.calculateReturnMetrics(snapshots, [], 10000);

      expect(metrics.totalReturn).toBeCloseTo(20);
      // Annualized return should be close to 20% for 1 year
      expect(metrics.annualizedReturn).toBeCloseTo(20, 0);
    });

    it('should calculate profit/loss ratio correctly', () => {
      const snapshots: PortfolioSnapshot[] = [
        { timestamp: 1000, cash: 10000, positions: [], totalValue: 10000, unrealizedPnL: 0 },
      ];

      const trades = [
        { realizedPnL: 100 },
        { realizedPnL: 200 },
        { realizedPnL: -50 },
        { realizedPnL: -100 },
      ];

      const metrics = service.calculateReturnMetrics(snapshots, trades, 10000);

      // avgWin = (100 + 200) / 2 = 150
      // avgLoss = (50 + 100) / 2 = 75
      // ratio = 150 / 75 = 2
      expect(metrics.profitLossRatio).toBeCloseTo(2);
    });
  });

  describe('calculateRiskMetrics', () => {
    it('should calculate max drawdown correctly', () => {
      const snapshots: PortfolioSnapshot[] = [
        { timestamp: 1000, cash: 10000, positions: [], totalValue: 10000, unrealizedPnL: 0 },
        { timestamp: 2000, cash: 15000, positions: [], totalValue: 15000, unrealizedPnL: 0 }, // peak
        { timestamp: 3000, cash: 12000, positions: [], totalValue: 12000, unrealizedPnL: 0 }, // drawdown
        { timestamp: 4000, cash: 8000, positions: [], totalValue: 8000, unrealizedPnL: 0 },   // max drawdown
        { timestamp: 5000, cash: 11000, positions: [], totalValue: 11000, unrealizedPnL: 0 },
      ];

      const metrics = service.calculateRiskMetrics(snapshots, 10000);

      // Max drawdown: from 15000 to 8000 = 46.67%
      expect(metrics.maxDrawdown).toBeCloseTo(46.67, 0);
    });

    it('should calculate VaR and CVaR correctly', () => {
      const snapshots: PortfolioSnapshot[] = generateTestSnapshots(100, 10000);
      const metrics = service.calculateRiskMetrics(snapshots, 10000);

      // VaR should be positive (potential loss)
      expect(metrics.var95).toBeGreaterThanOrEqual(0);
      expect(metrics.cvar).toBeGreaterThanOrEqual(0);
      // CVaR should be >= VaR
      expect(metrics.cvar).toBeGreaterThanOrEqual(metrics.var95);
    });
  });

  describe('calculateRiskAdjustedMetrics', () => {
    it('should calculate Sharpe ratio', () => {
      const snapshots: PortfolioSnapshot[] = generateTestSnapshots(100, 10000);
      const riskMetrics = service.calculateRiskMetrics(snapshots, 10000);
      const metrics = service.calculateRiskAdjustedMetrics(snapshots, 10000, riskMetrics);

      expect(typeof metrics.sharpeRatio).toBe('number');
      expect(isFinite(metrics.sharpeRatio)).toBe(true);
    });

    it('should calculate Sortino ratio', () => {
      const snapshots: PortfolioSnapshot[] = generateTestSnapshots(100, 10000);
      const riskMetrics = service.calculateRiskMetrics(snapshots, 10000);
      const metrics = service.calculateRiskAdjustedMetrics(snapshots, 10000, riskMetrics);

      expect(typeof metrics.sortinoRatio).toBe('number');
      expect(isFinite(metrics.sortinoRatio)).toBe(true);
    });
  });

  describe('calculateTradingMetrics', () => {
    it('should calculate consecutive wins and losses', () => {
      const trades = [
        { realizedPnL: 100, timestamp: 1000 },
        { realizedPnL: 200, timestamp: 2000 },
        { realizedPnL: -50, timestamp: 3000 },
        { realizedPnL: -100, timestamp: 4000 },
        { realizedPnL: -75, timestamp: 5000 },
        { realizedPnL: 300, timestamp: 6000 },
      ];

      const metrics = service.calculateTradingMetrics(trades);

      expect(metrics.maxConsecutiveWins).toBe(2);
      expect(metrics.maxConsecutiveLosses).toBe(3);
    });

    it('should handle empty trades', () => {
      const metrics = service.calculateTradingMetrics([]);

      expect(metrics.totalTrades).toBe(0);
      expect(metrics.avgHoldingTime).toBe(0);
      expect(metrics.maxConsecutiveWins).toBe(0);
      expect(metrics.maxConsecutiveLosses).toBe(0);
    });
  });

  describe('calculateEquityCurve', () => {
    it('should generate correct equity curve', () => {
      const snapshots: PortfolioSnapshot[] = [
        { timestamp: 1000, cash: 10000, positions: [], totalValue: 10000, unrealizedPnL: 0 },
        { timestamp: 2000, cash: 11000, positions: [], totalValue: 11000, unrealizedPnL: 0 },
        { timestamp: 3000, cash: 10500, positions: [], totalValue: 10500, unrealizedPnL: 0 },
      ];

      const curve = service.calculateEquityCurve(snapshots, 10000);

      expect(curve.points).toHaveLength(3);
      expect(curve.initialCapital).toBe(10000);
      expect(curve.finalCapital).toBe(10500);
      expect(curve.points[0].return).toBeCloseTo(0);
      expect(curve.points[1].return).toBeCloseTo(10);
      expect(curve.points[2].drawdown).toBeCloseTo(4.55, 1); // From 11000 peak
    });
  });

  describe('calculateMonthlyReturnsHeatmap', () => {
    it('should generate monthly returns', () => {
      const now = new Date();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

      const snapshots: PortfolioSnapshot[] = [];
      let value = 10000;

      for (let i = 0; i < 90; i++) {
        const date = new Date(threeMonthsAgo);
        date.setDate(date.getDate() + i);

        value += (Math.random() - 0.5) * 100;

        snapshots.push({
          timestamp: date.getTime(),
          cash: value,
          positions: [],
          totalValue: value,
          unrealizedPnL: 0,
        });
      }

      const heatmap = service.calculateMonthlyReturnsHeatmap(snapshots, 10000);

      expect(heatmap.entries.length).toBeGreaterThan(0);
      expect(heatmap.years.length).toBeGreaterThan(0);
      expect(heatmap.bestMonth).toBeDefined();
      expect(heatmap.worstMonth).toBeDefined();
    });
  });

  describe('calculateDrawdownAnalysis', () => {
    it('should identify drawdown periods', () => {
      const snapshots: PortfolioSnapshot[] = [
        { timestamp: 1000, cash: 10000, positions: [], totalValue: 10000, unrealizedPnL: 0 },
        { timestamp: 2000, cash: 12000, positions: [], totalValue: 12000, unrealizedPnL: 0 },
        { timestamp: 3000, cash: 10000, positions: [], totalValue: 10000, unrealizedPnL: 0 },
        { timestamp: 4000, cash: 13000, positions: [], totalValue: 13000, unrealizedPnL: 0 },
        { timestamp: 5000, cash: 11000, positions: [], totalValue: 11000, unrealizedPnL: 0 },
      ];

      const analysis = service.calculateDrawdownAnalysis(snapshots);

      expect(analysis.periods.length).toBeGreaterThan(0);
      expect(analysis.maxDrawdown).toBeGreaterThan(0);
    });
  });

  describe('generatePerformanceReport', () => {
    it('should generate complete report', () => {
      const snapshots: PortfolioSnapshot[] = generateTestSnapshots(100, 10000);
      const trades = [
        { realizedPnL: 100, timestamp: 50000, quantity: 10, price: 100 },
        { realizedPnL: -50, timestamp: 60000, quantity: 10, price: 95 },
      ];

      const report = service.generatePerformanceReport(
        'test-strategy',
        'Test Strategy',
        snapshots,
        trades,
        10000
      );

      expect(report.strategyId).toBe('test-strategy');
      expect(report.strategyName).toBe('Test Strategy');
      expect(report.summary).toBeDefined();
      expect(report.detailedMetrics).toBeDefined();
      expect(report.equityCurve).toBeDefined();
      expect(report.drawdownAnalysis).toBeDefined();
      expect(report.monthlyReturns).toBeDefined();
    });
  });
});

// Helper function to generate test snapshots
function generateTestSnapshots(count: number, initialValue: number): PortfolioSnapshot[] {
  const snapshots: PortfolioSnapshot[] = [];
  let value = initialValue;
  const baseTimestamp = Date.now() - count * 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    // Random walk
    value += (Math.random() - 0.48) * initialValue * 0.02;

    snapshots.push({
      timestamp: baseTimestamp + i * 24 * 60 * 60 * 1000,
      cash: value,
      positions: [],
      totalValue: value,
      unrealizedPnL: 0,
    });
  }

  return snapshots;
}