/**
 * Risk Calculator Tests
 */

import { RiskCalculator } from '../RiskCalculator';
import { PortfolioData, PositionData } from '../types';

describe('RiskCalculator', () => {
  let calculator: RiskCalculator;

  beforeEach(() => {
    calculator = new RiskCalculator();
  });

  describe('calculateConcentrationRisk', () => {
    it('should return zero for empty portfolio', () => {
      const portfolio: PortfolioData = {
        totalValue: 10000,
        cash: 10000,
        positions: [],
      };

      const result = calculator.calculateConcentrationRisk(portfolio);

      expect(result.maxPositionRatio).toBe(0);
      expect(result.topThreeRatio).toBe(0);
      expect(result.herfindahlIndex).toBe(0);
    });

    it('should calculate concentration for single position', () => {
      const portfolio: PortfolioData = {
        totalValue: 10000,
        cash: 0,
        positions: [
          {
            symbol: 'BTC',
            quantity: 1,
            averageCost: 10000,
            currentPrice: 10000,
            marketValue: 10000,
            unrealizedPnL: 0,
          },
        ],
      };

      const result = calculator.calculateConcentrationRisk(portfolio);

      expect(result.maxPositionRatio).toBe(1);
      expect(result.topThreeRatio).toBe(1);
      expect(result.herfindahlIndex).toBe(1);
    });

    it('should calculate concentration for diversified portfolio', () => {
      const portfolio: PortfolioData = {
        totalValue: 10000,
        cash: 0,
        positions: [
          {
            symbol: 'BTC',
            quantity: 0.5,
            averageCost: 5000,
            currentPrice: 5000,
            marketValue: 5000,
            unrealizedPnL: 0,
          },
          {
            symbol: 'ETH',
            quantity: 2,
            averageCost: 2500,
            currentPrice: 2500,
            marketValue: 5000,
            unrealizedPnL: 0,
          },
        ],
      };

      const result = calculator.calculateConcentrationRisk(portfolio);

      expect(result.maxPositionRatio).toBe(0.5);
      expect(result.topThreeRatio).toBe(1);
      expect(result.herfindahlIndex).toBeCloseTo(0.5, 2);
    });
  });

  describe('calculateDrawdown', () => {
    it('should return zero for portfolio at high water mark', () => {
      const portfolio: PortfolioData = {
        totalValue: 10000,
        cash: 5000,
        positions: [],
        equityHighWaterMark: 10000,
      };

      const result = calculator.calculateDrawdown(portfolio);

      expect(result.current).toBe(0);
    });

    it('should calculate current drawdown correctly', () => {
      const portfolio: PortfolioData = {
        totalValue: 9000,
        cash: 4000,
        positions: [],
        equityHighWaterMark: 10000,
      };

      const result = calculator.calculateDrawdown(portfolio);

      expect(result.current).toBeCloseTo(0.1, 2);
    });

    it('should calculate max drawdown from history', () => {
      const portfolio: PortfolioData = {
        totalValue: 9000,
        cash: 4000,
        positions: [],
        equityHighWaterMark: 10000,
        equityHistory: [10000, 9500, 9000, 9200, 8800, 9000],
      };

      const result = calculator.calculateDrawdown(portfolio);

      expect(result.max).toBeCloseTo(0.12, 1);
    });
  });

  describe('calculateVolatility', () => {
    it('should return zero for insufficient data', () => {
      const portfolio: PortfolioData = {
        totalValue: 10000,
        cash: 10000,
        positions: [],
      };

      const result = calculator.calculateVolatility(portfolio);

      expect(result.daily).toBe(0);
      expect(result.weekly).toBe(0);
      expect(result.monthly).toBe(0);
    });

    it('should calculate volatility from equity history', () => {
      // Create a simple equity history with some variation
      const baseValue = 10000;
      const equityHistory: number[] = [];
      for (let i = 0; i < 30; i++) {
        // Add some random-ish variation
        const variation = Math.sin(i * 0.5) * 100 + (i % 3 - 1) * 50;
        equityHistory.push(baseValue + variation);
      }

      const portfolio: PortfolioData = {
        totalValue: equityHistory[equityHistory.length - 1],
        cash: 5000,
        positions: [],
        equityHistory,
      };

      const result = calculator.calculateVolatility(portfolio);

      // Volatility should be positive and reasonable
      expect(result.daily).toBeGreaterThan(0);
      expect(result.daily).toBeLessThan(1);
    });
  });

  describe('calculateLeverage', () => {
    it('should return leverage of 1 for unleveraged portfolio', () => {
      const portfolio: PortfolioData = {
        totalValue: 10000,
        cash: 10000,
        positions: [],
      };

      const result = calculator.calculateLeverage(portfolio);

      expect(result.total).toBe(1);
    });

    it('should calculate leverage correctly', () => {
      const portfolio: PortfolioData = {
        totalValue: 20000, // Total exposure
        cash: 10000,       // Actual equity
        positions: [
          {
            symbol: 'BTC',
            quantity: 1,
            averageCost: 20000,
            currentPrice: 20000,
            marketValue: 20000,
            unrealizedPnL: 0,
          },
        ],
        marginUsed: 10000,
        marginAvailable: 10000,
      };

      const result = calculator.calculateLeverage(portfolio);

      expect(result.total).toBe(2);
      expect(result.marginRatio).toBe(1);
    });
  });

  describe('calculateLiquidity', () => {
    it('should return perfect score for empty portfolio', () => {
      const portfolio: PortfolioData = {
        totalValue: 10000,
        cash: 10000,
        positions: [],
      };

      const result = calculator.calculateLiquidity(portfolio);

      expect(result.liquidityScore).toBe(100);
      expect(result.illiquidPositions).toBe(0);
    });

    it('should calculate liquidity score for positions', () => {
      const portfolio: PortfolioData = {
        totalValue: 100000,
        cash: 0,
        positions: [
          {
            symbol: 'BTC',
            quantity: 1,
            averageCost: 50000,
            currentPrice: 50000,
            marketValue: 50000,
            unrealizedPnL: 0,
            dailyVolume: 1000, // High volume
          },
          {
            symbol: 'LOW',
            quantity: 1000,
            averageCost: 50,
            currentPrice: 50,
            marketValue: 50000,
            unrealizedPnL: 0,
            dailyVolume: 10,   // Low volume
          },
        ],
      };

      const result = calculator.calculateLiquidity(portfolio);

      expect(result.liquidityScore).toBeLessThan(100);
      expect(result.illiquidPositions).toBeGreaterThanOrEqual(1);
    });
  });

  describe('checkRiskThreshold', () => {
    it('should detect threshold exceeded', () => {
      const portfolio: PortfolioData = {
        totalValue: 10000,
        cash: 0,
        positions: [
          {
            symbol: 'BTC',
            quantity: 1,
            averageCost: 10000,
            currentPrice: 10000,
            marketValue: 10000,
            unrealizedPnL: 0,
          },
        ],
      };

      const metrics = calculator.calculateRiskMetrics(portfolio);
      const result = calculator.checkRiskThreshold(metrics, 'concentration', 0.5);

      expect(result.exceeded).toBe(true);
      expect(result.value).toBe(1);
      expect(result.threshold).toBe(0.5);
    });

    it('should not detect threshold when not exceeded', () => {
      const portfolio: PortfolioData = {
        totalValue: 10000,
        cash: 0,
        positions: [
          {
            symbol: 'BTC',
            quantity: 0.2,
            averageCost: 2500,
            currentPrice: 2500,
            marketValue: 2500,
            unrealizedPnL: 0,
          },
          {
            symbol: 'ETH',
            quantity: 1,
            averageCost: 2500,
            currentPrice: 2500,
            marketValue: 2500,
            unrealizedPnL: 0,
          },
          {
            symbol: 'SOL',
            quantity: 25,
            averageCost: 200,
            currentPrice: 200,
            marketValue: 5000,
            unrealizedPnL: 0,
          },
        ],
      };

      const metrics = calculator.calculateRiskMetrics(portfolio);
      const result = calculator.checkRiskThreshold(metrics, 'concentration', 0.5);

      expect(result.exceeded).toBe(false);
      expect(result.severity).toBe('low');
    });

    it('should determine severity correctly', () => {
      const portfolio: PortfolioData = {
        totalValue: 10000,
        cash: 0,
        positions: [
          {
            symbol: 'BTC',
            quantity: 1,
            averageCost: 10000,
            currentPrice: 10000,
            marketValue: 10000,
            unrealizedPnL: 0,
          },
        ],
      };

      const metrics = calculator.calculateRiskMetrics(portfolio);
      
      // value = 1.0 (100% concentration)
      // Test different thresholds to get different severities
      // ratio = value / threshold
      // severity: medium (ratio >= 1 and < 1.5), high (ratio >= 1.5 and < 2), critical (ratio >= 2)
      
      const lowResult = calculator.checkRiskThreshold(metrics, 'concentration', 0.8);
      // ratio = 1.0 / 0.8 = 1.25 -> medium
      expect(lowResult.severity).toBe('medium');

      const mediumResult = calculator.checkRiskThreshold(metrics, 'concentration', 0.6);
      // ratio = 1.0 / 0.6 = 1.67 -> high
      expect(mediumResult.severity).toBe('high');

      const highResult = calculator.checkRiskThreshold(metrics, 'concentration', 0.5);
      // ratio = 1.0 / 0.5 = 2.0 -> critical
      expect(highResult.severity).toBe('critical');
    });
  });

  describe('getTopConcentratedPositions', () => {
    it('should return empty array for empty portfolio', () => {
      const portfolio: PortfolioData = {
        totalValue: 10000,
        cash: 10000,
        positions: [],
      };

      const result = calculator.getTopConcentratedPositions(portfolio);

      expect(result).toEqual([]);
    });

    it('should return positions sorted by concentration', () => {
      const portfolio: PortfolioData = {
        totalValue: 10000,
        cash: 0,
        positions: [
          {
            symbol: 'BTC',
            quantity: 0.5,
            averageCost: 5000,
            currentPrice: 5000,
            marketValue: 5000,
            unrealizedPnL: 0,
          },
          {
            symbol: 'ETH',
            quantity: 1,
            averageCost: 3000,
            currentPrice: 3000,
            marketValue: 3000,
            unrealizedPnL: 0,
          },
          {
            symbol: 'SOL',
            quantity: 20,
            averageCost: 100,
            currentPrice: 100,
            marketValue: 2000,
            unrealizedPnL: 0,
          },
        ],
      };

      const result = calculator.getTopConcentratedPositions(portfolio, 2);

      expect(result).toHaveLength(2);
      expect(result[0].symbol).toBe('BTC');
      expect(result[0].concentration).toBeCloseTo(0.5, 1);
    });
  });
});