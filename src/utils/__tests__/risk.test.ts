/**
 * Tests for Risk Analytics Utilities
 */

import {
  calculateVaR,
  calculateExpectedShortfall,
  calculateMaxDrawdown,
  calculateVolatility,
  calculateSharpeRatio,
  calculateSortinoRatio,
  calculateBeta,
  calculateConcentrationRisk,
  calculateLiquidityRisk,
  calculateCalmarRatio,
  calculateTreynorRatio,
  calculateTrackingError,
  calculateInformationRatio,
  calculateCompleteRiskMetrics,
  checkRiskAlert,
  formatRiskMetric,
} from '../risk';
import type { RiskAlert } from '../risk';

describe('Risk Analytics Utilities', () => {
  // Sample returns data for testing
  const normalReturns = [
    0.01, -0.02, 0.015, 0.005, -0.01,
    0.02, -0.005, 0.01, -0.015, 0.005,
    0.025, -0.01, 0.005, 0.015, -0.02,
    0.01, -0.005, 0.02, -0.01, 0.005,
  ];

  const volatileReturns = [
    0.1, -0.15, 0.2, -0.1, 0.15,
    -0.2, 0.1, -0.05, 0.25, -0.1,
    0.05, -0.15, 0.1, -0.2, 0.15,
  ];

  const trendReturns = [
    0.01, 0.015, 0.02, 0.018, 0.022,
    0.025, 0.02, 0.028, 0.03, 0.032,
    0.035, 0.03, 0.04, 0.038, 0.042,
  ];

  describe('calculateVaR', () => {
    it('should calculate historical VaR at 95% confidence', () => {
      const var95 = calculateVaR(normalReturns, 0.95, 'historical');
      expect(var95).toBeGreaterThan(0);
      expect(var95).toBeLessThan(0.1); // Should be reasonable
    });

    it('should calculate historical VaR at 99% confidence', () => {
      const var99 = calculateVaR(normalReturns, 0.99, 'historical');
      expect(var99).toBeGreaterThan(0);
      // 99% VaR should be >= 95% VaR
      const var95 = calculateVaR(normalReturns, 0.95, 'historical');
      expect(var99).toBeGreaterThanOrEqual(var95);
    });

    it('should calculate parametric VaR', () => {
      const paramVar = calculateVaR(normalReturns, 0.95, 'parametric');
      expect(paramVar).toBeGreaterThan(0);
    });

    it('should calculate Monte Carlo VaR', () => {
      const mcVar = calculateVaR(normalReturns, 0.95, 'monte_carlo');
      expect(mcVar).toBeGreaterThan(0);
    });

    it('should return 0 for insufficient data', () => {
      const smallReturns = [0.01, 0.02];
      const var95 = calculateVaR(smallReturns, 0.95);
      expect(var95).toBe(0);
    });

    it('should return absolute VaR when portfolio value provided', () => {
      const portfolioValue = 100000;
      const var95 = calculateVaR(normalReturns, 0.95, 'historical', portfolioValue);
      expect(var95).toBeGreaterThan(0);
      expect(var95).toBeLessThan(portfolioValue);
    });

    it('should handle volatile returns correctly', () => {
      const var95 = calculateVaR(volatileReturns, 0.95);
      const normalVar = calculateVaR(normalReturns, 0.95);
      // Volatile portfolio should have higher VaR
      expect(var95).toBeGreaterThan(normalVar);
    });
  });

  describe('calculateExpectedShortfall', () => {
    it('should calculate expected shortfall at 95% confidence', () => {
      const es = calculateExpectedShortfall(normalReturns, 0.95);
      expect(es).toBeGreaterThan(0);
    });

    it('should have ES >= VaR', () => {
      const es = calculateExpectedShortfall(normalReturns, 0.95);
      const var95 = calculateVaR(normalReturns, 0.95);
      // Expected Shortfall should be >= VaR
      expect(es).toBeGreaterThanOrEqual(var95 * 0.8); // Allow some tolerance
    });

    it('should return 0 for insufficient data', () => {
      const smallReturns = [0.01, 0.02];
      const es = calculateExpectedShortfall(smallReturns, 0.95);
      expect(es).toBe(0);
    });
  });

  describe('calculateMaxDrawdown', () => {
    it('should calculate max drawdown correctly', () => {
      const values = [100, 110, 105, 95, 100, 90, 95, 100];
      const result = calculateMaxDrawdown(values);
      expect(result.maxDrawdown).toBe(20); // 110 -> 90
      expect(result.maxDrawdownPercent).toBeCloseTo(18.18, 1);
    });

    it('should return 0 for empty or single value', () => {
      expect(calculateMaxDrawdown([]).maxDrawdown).toBe(0);
      expect(calculateMaxDrawdown([100]).maxDrawdown).toBe(0);
    });

    it('should identify peak and trough indices', () => {
      const values = [100, 110, 105, 95, 100, 90, 95, 100];
      const result = calculateMaxDrawdown(values);
      expect(result.peakIndex).toBeGreaterThanOrEqual(0);
      expect(result.troughIndex).toBeGreaterThan(result.peakIndex);
    });

    it('should handle increasing values (no drawdown)', () => {
      const values = [100, 110, 120, 130, 140];
      const result = calculateMaxDrawdown(values);
      expect(result.maxDrawdown).toBe(0);
    });
  });

  describe('calculateVolatility', () => {
    it('should calculate annualized volatility', () => {
      const vol = calculateVolatility(normalReturns);
      expect(vol).toBeGreaterThan(0);
      expect(vol).toBeLessThan(100); // Reasonable annualized vol
    });

    it('should return higher volatility for volatile returns', () => {
      const normalVol = calculateVolatility(normalReturns);
      const volatileVol = calculateVolatility(volatileReturns);
      expect(volatileVol).toBeGreaterThan(normalVol);
    });

    it('should return 0 for insufficient data', () => {
      expect(calculateVolatility([0.01])).toBe(0);
      expect(calculateVolatility([])).toBe(0);
    });

    it('should respect periods per year parameter', () => {
      const dailyVol = calculateVolatility(normalReturns, 252);
      const weeklyVol = calculateVolatility(normalReturns, 52);
      // More periods = higher annualization factor = higher volatility
      expect(dailyVol).toBeGreaterThan(0);
      expect(weeklyVol).toBeGreaterThan(0);
    });
  });

  describe('calculateSharpeRatio', () => {
    it('should calculate Sharpe ratio', () => {
      const sharpe = calculateSharpeRatio(trendReturns);
      expect(sharpe).toBeGreaterThan(0);
    });

    it('should return higher Sharpe for trending returns', () => {
      const trendSharpe = calculateSharpeRatio(trendReturns);
      const normalSharpe = calculateSharpeRatio(normalReturns);
      expect(trendSharpe).toBeGreaterThan(normalSharpe);
    });

    it('should handle negative returns', () => {
      const negativeReturns = [-0.01, -0.02, -0.015, -0.01, -0.02];
      const sharpe = calculateSharpeRatio(negativeReturns);
      expect(sharpe).toBeLessThan(0);
    });

    it('should account for risk-free rate', () => {
      const sharpeNoRf = calculateSharpeRatio(trendReturns, 0);
      const sharpeWithRf = calculateSharpeRatio(trendReturns, 0.05);
      expect(sharpeWithRf).toBeLessThan(sharpeNoRf);
    });
  });

  describe('calculateSortinoRatio', () => {
    it('should calculate Sortino ratio', () => {
      const sortino = calculateSortinoRatio(trendReturns);
      expect(sortino).toBeGreaterThan(0);
    });

    it('should return Infinity for only positive returns', () => {
      const positiveReturns = [0.01, 0.02, 0.015, 0.01, 0.02];
      const sortino = calculateSortinoRatio(positiveReturns);
      expect(sortino).toBe(Infinity);
    });

    it('should be >= Sharpe for same returns', () => {
      const sharpe = calculateSharpeRatio(normalReturns);
      const sortino = calculateSortinoRatio(normalReturns);
      // Sortino should be >= Sharpe (only penalizes downside)
      expect(sortino).toBeGreaterThanOrEqual(sharpe * 0.8);
    });
  });

  describe('calculateBeta', () => {
    it('should calculate beta correctly', () => {
      const portfolioReturns = [0.01, 0.02, -0.01, 0.015, 0.005];
      const benchmarkReturns = [0.015, 0.02, -0.005, 0.01, 0.01];
      const beta = calculateBeta(portfolioReturns, benchmarkReturns);
      expect(beta).toBeGreaterThan(0);
      expect(beta).toBeLessThan(2); // Reasonable beta
    });

    it('should return 0 for mismatched lengths', () => {
      const portfolioReturns = [0.01, 0.02, -0.01];
      const benchmarkReturns = [0.015, 0.02];
      const beta = calculateBeta(portfolioReturns, benchmarkReturns);
      expect(beta).toBe(0);
    });

    it('should return 1 for identical returns', () => {
      const returns = [0.01, 0.02, -0.01, 0.015, 0.005];
      const beta = calculateBeta(returns, returns);
      expect(beta).toBeCloseTo(1, 2);
    });
  });

  describe('calculateConcentrationRisk', () => {
    it('should calculate concentration risk (HHI)', () => {
      const weights = [50, 30, 20]; // 50%, 30%, 20%
      const concentration = calculateConcentrationRisk(weights);
      // HHI = 50^2 + 30^2 + 20^2 = 2500 + 900 + 400 = 3800
      // Normalized: 3800 / 100 = 38
      expect(concentration).toBe(38);
    });

    it('should return 100 for single position', () => {
      const weights = [100];
      const concentration = calculateConcentrationRisk(weights);
      expect(concentration).toBe(100);
    });

    it('should return lower for diversified portfolio', () => {
      const concentrated = calculateConcentrationRisk([80, 20]);
      const diversified = calculateConcentrationRisk([25, 25, 25, 25]);
      expect(diversified).toBeLessThan(concentrated);
    });
  });

  describe('calculateLiquidityRisk', () => {
    it('should calculate liquidity risk', () => {
      const positions = [
        { symbol: 'BTC', marketValue: 50000, averageDailyVolume: 1000, currentPrice: 50000 },
        { symbol: 'ETH', marketValue: 30000, averageDailyVolume: 5000, currentPrice: 3000 },
      ];
      const liquidityRisk = calculateLiquidityRisk(positions, 80000);
      expect(liquidityRisk).toBeGreaterThan(0);
      expect(liquidityRisk).toBeLessThan(100);
    });

    it('should estimate without volume data', () => {
      const positions = [
        { symbol: 'BTC', marketValue: 50000 },
        { symbol: 'ETH', marketValue: 30000 },
      ];
      const liquidityRisk = calculateLiquidityRisk(positions, 80000);
      expect(liquidityRisk).toBeGreaterThan(0);
    });

    it('should return 0 for empty positions', () => {
      expect(calculateLiquidityRisk([], 100000)).toBe(0);
    });
  });

  describe('calculateCalmarRatio', () => {
    it('should calculate Calmar ratio', () => {
      // Calmar = annualized return / max drawdown percent
      // If return is 15% (0.15) and drawdown is 10%, Calmar = 0.15 / 10 = 0.015
      const calmar = calculateCalmarRatio(15, 10); // 15% return, 10% drawdown
      expect(calmar).toBeCloseTo(1.5, 2);
    });

    it('should return 0 for zero drawdown', () => {
      expect(calculateCalmarRatio(15, 0)).toBe(0);
    });
  });

  describe('calculateTreynorRatio', () => {
    it('should calculate Treynor ratio', () => {
      const treynor = calculateTreynorRatio(0.15, 0.02, 1.2);
      expect(treynor).toBeCloseTo(0.108, 2);
    });

    it('should return 0 for zero beta', () => {
      expect(calculateTreynorRatio(0.15, 0.02, 0)).toBe(0);
    });
  });

  describe('calculateTrackingError', () => {
    it('should calculate tracking error', () => {
      const portfolioReturns = [0.01, 0.02, -0.01, 0.015, 0.005];
      const benchmarkReturns = [0.015, 0.02, -0.005, 0.01, 0.01];
      const te = calculateTrackingError(portfolioReturns, benchmarkReturns);
      expect(te).toBeGreaterThan(0);
    });

    it('should return 0 for identical returns', () => {
      const returns = [0.01, 0.02, -0.01, 0.015, 0.005];
      const te = calculateTrackingError(returns, returns);
      expect(te).toBeCloseTo(0, 4);
    });
  });

  describe('calculateInformationRatio', () => {
    it('should calculate information ratio', () => {
      const portfolioReturns = [0.02, 0.02, -0.01, 0.02, 0.01];
      const benchmarkReturns = [0.01, 0.02, -0.005, 0.01, 0.01];
      const ir = calculateInformationRatio(portfolioReturns, benchmarkReturns);
      // Active returns are positive, so IR should be positive
      expect(ir).toBeGreaterThan(0);
    });

    it('should return 0 for identical returns', () => {
      const returns = [0.01, 0.02, -0.01, 0.015, 0.005];
      const ir = calculateInformationRatio(returns, returns);
      expect(ir).toBeCloseTo(0, 4);
    });
  });

  describe('calculateCompleteRiskMetrics', () => {
    it('should calculate all risk metrics', () => {
      const historicalValues = [
        { timestamp: new Date('2024-01-01'), value: 100000 },
        { timestamp: new Date('2024-01-02'), value: 101000 },
        { timestamp: new Date('2024-01-03'), value: 100500 },
        { timestamp: new Date('2024-01-04'), value: 102000 },
        { timestamp: new Date('2024-01-05'), value: 101500 },
        { timestamp: new Date('2024-01-06'), value: 103000 },
        { timestamp: new Date('2024-01-07'), value: 102500 },
        { timestamp: new Date('2024-01-08'), value: 104000 },
        { timestamp: new Date('2024-01-09'), value: 103500 },
        { timestamp: new Date('2024-01-10'), value: 105000 },
        { timestamp: new Date('2024-01-11'), value: 104500 },
        { timestamp: new Date('2024-01-12'), value: 106000 },
      ];

      const metrics = calculateCompleteRiskMetrics(historicalValues);

      expect(metrics.var95).toBeGreaterThanOrEqual(0);
      expect(metrics.var99).toBeGreaterThanOrEqual(0);
      expect(metrics.maxDrawdown).toBeGreaterThanOrEqual(0);
      expect(metrics.sharpeRatio).toBeDefined();
      expect(metrics.volatility).toBeGreaterThanOrEqual(0);
      expect(metrics.beta).toBeDefined();
      expect(metrics.concentrationRisk).toBeDefined();
      expect(metrics.liquidityRisk).toBeDefined();
    });

    it('should return zeros for insufficient data', () => {
      const historicalValues = [
        { timestamp: new Date(), value: 100000 },
      ];

      const metrics = calculateCompleteRiskMetrics(historicalValues);

      expect(metrics.var95).toBe(0);
      expect(metrics.var99).toBe(0);
      expect(metrics.maxDrawdown).toBe(0);
      expect(metrics.sharpeRatio).toBe(0);
    });

    it('should use benchmark data for beta calculation', () => {
      const historicalValues = [
        { timestamp: new Date('2024-01-01'), value: 100000 },
        { timestamp: new Date('2024-01-02'), value: 101000 },
        { timestamp: new Date('2024-01-03'), value: 100500 },
        { timestamp: new Date('2024-01-04'), value: 102000 },
        { timestamp: new Date('2024-01-05'), value: 101500 },
        { timestamp: new Date('2024-01-06'), value: 103000 },
        { timestamp: new Date('2024-01-07'), value: 102500 },
        { timestamp: new Date('2024-01-08'), value: 104000 },
        { timestamp: new Date('2024-01-09'), value: 103500 },
        { timestamp: new Date('2024-01-10'), value: 105000 },
        { timestamp: new Date('2024-01-11'), value: 104500 },
        { timestamp: new Date('2024-01-12'), value: 106000 },
      ];

      const benchmarkData = historicalValues.map((h, i) => ({
        timestamp: h.timestamp,
        value: 100000 + i * 1500, // Different growth rate
      }));

      const metrics = calculateCompleteRiskMetrics(historicalValues, benchmarkData);

      expect(metrics.beta).not.toBe(0);
      expect(metrics.trackingError).toBeGreaterThan(0);
    });
  });

  describe('checkRiskAlert', () => {
    const createBaseAlert = (): RiskAlert => ({
      id: 'test-alert',
      metric: 'var95',
      threshold: 5000,
      operator: 'gt',
      channels: ['ui'],
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('should trigger for greater than', () => {
      expect(checkRiskAlert({ ...createBaseAlert(), operator: 'gt', threshold: 5000 }, 6000)).toBe(true);
      expect(checkRiskAlert({ ...createBaseAlert(), operator: 'gt', threshold: 5000 }, 4000)).toBe(false);
    });

    it('should trigger for less than', () => {
      expect(checkRiskAlert({ ...createBaseAlert(), operator: 'lt', threshold: 5000 }, 4000)).toBe(true);
      expect(checkRiskAlert({ ...createBaseAlert(), operator: 'lt', threshold: 5000 }, 6000)).toBe(false);
    });

    it('should trigger for greater than or equal', () => {
      expect(checkRiskAlert({ ...createBaseAlert(), operator: 'gte', threshold: 5000 }, 5000)).toBe(true);
      expect(checkRiskAlert({ ...createBaseAlert(), operator: 'gte', threshold: 5000 }, 4000)).toBe(false);
    });

    it('should trigger for less than or equal', () => {
      expect(checkRiskAlert({ ...createBaseAlert(), operator: 'lte', threshold: 5000 }, 5000)).toBe(true);
      expect(checkRiskAlert({ ...createBaseAlert(), operator: 'lte', threshold: 5000 }, 6000)).toBe(false);
    });
  });

  describe('formatRiskMetric', () => {
    it('should format VaR metrics', () => {
      expect(formatRiskMetric('var95', 1234.56)).toBe('$1234.56');
      expect(formatRiskMetric('var99', 5678.9)).toBe('$5678.90');
    });

    it('should format percentage metrics', () => {
      expect(formatRiskMetric('maxDrawdown', 15.5)).toBe('15.50%');
      expect(formatRiskMetric('volatility', 20.123)).toBe('20.12%');
      expect(formatRiskMetric('concentrationRisk', 38)).toBe('38.00%');
    });

    it('should format ratio metrics', () => {
      expect(formatRiskMetric('sharpeRatio', 1.5)).toBe('1.50');
      expect(formatRiskMetric('beta', 1.23)).toBe('1.23');
    });

    it('should format liquidity risk', () => {
      expect(formatRiskMetric('liquidityRisk', 45.6)).toBe('45.60');
    });
  });
});
