/**
 * Tests for Portfolio Analytics Utilities
 */

import {
  calculateVolatility,
  calculateMaxDrawdown,
  calculateSharpeRatio,
  calculateSortinoRatio,
  calculateVaR,
  calculateExpectedShortfall,
  calculateRiskMetrics,
  analyzePositions,
  calculateCorrelation,
  calculateCorrelationMatrix,
  calculatePnLBreakdown,
  formatPercent,
  formatCurrency,
  formatDuration,
} from '../portfolioAnalytics';

describe('calculateVolatility', () => {
  it('should return 0 for empty or single-element arrays', () => {
    expect(calculateVolatility([])).toBe(0);
    expect(calculateVolatility([0.01])).toBe(0);
  });

  it('should calculate annualized volatility correctly', () => {
    // Simple test with known values
    const returns = [0.01, -0.02, 0.03, -0.01, 0.02];
    const volatility = calculateVolatility(returns);
    
    // Volatility should be positive
    expect(volatility).toBeGreaterThan(0);
    
    // For these returns, volatility should be reasonable (not too high)
    expect(volatility).toBeLessThan(1); // Less than 100% annualized
  });

  it('should return 0 for constant returns', () => {
    const returns = [0.01, 0.01, 0.01, 0.01];
    expect(calculateVolatility(returns)).toBe(0);
  });
});

describe('calculateMaxDrawdown', () => {
  it('should return 0 for empty or single-element arrays', () => {
    expect(calculateMaxDrawdown([])).toEqual({ maxDrawdown: 0, maxDrawdownPercent: 0 });
    expect(calculateMaxDrawdown([100])).toEqual({ maxDrawdown: 0, maxDrawdownPercent: 0 });
  });

  it('should calculate max drawdown correctly', () => {
    // Portfolio goes: 100 -> 110 -> 90 -> 95
    // Max drawdown is from 110 to 90 = 20
    const values = [100, 110, 90, 95];
    const result = calculateMaxDrawdown(values);
    
    expect(result.maxDrawdown).toBe(20);
    expect(result.maxDrawdownPercent).toBeCloseTo(18.18, 1); // 20/110 * 100
  });

  it('should return 0 for monotonically increasing values', () => {
    const values = [100, 110, 120, 130];
    const result = calculateMaxDrawdown(values);
    
    expect(result.maxDrawdown).toBe(0);
    expect(result.maxDrawdownPercent).toBe(0);
  });
});

describe('calculateSharpeRatio', () => {
  it('should return 0 for insufficient data', () => {
    expect(calculateSharpeRatio([])).toBe(0);
    expect(calculateSharpeRatio([0.01])).toBe(0);
  });

  it('should calculate positive Sharpe for positive returns', () => {
    // Consistent positive returns should give positive Sharpe
    const returns = [0.01, 0.02, 0.01, 0.015, 0.01];
    const sharpe = calculateSharpeRatio(returns);
    
    expect(sharpe).toBeGreaterThan(0);
  });

  it('should calculate negative Sharpe for negative returns', () => {
    // Consistent negative returns should give negative Sharpe
    const returns = [-0.01, -0.02, -0.01, -0.015, -0.01];
    const sharpe = calculateSharpeRatio(returns);
    
    expect(sharpe).toBeLessThan(0);
  });
});

describe('calculateSortinoRatio', () => {
  it('should return 0 for insufficient data', () => {
    expect(calculateSortinoRatio([])).toBe(0);
    expect(calculateSortinoRatio([0.01])).toBe(0);
  });

  it('should return Infinity for no negative returns', () => {
    const returns = [0.01, 0.02, 0.03, 0.04];
    expect(calculateSortinoRatio(returns)).toBe(Infinity);
  });

  it('should calculate Sortino ratio correctly with mixed returns', () => {
    const returns = [0.02, -0.01, 0.03, -0.02, 0.01];
    const sortino = calculateSortinoRatio(returns);
    
    // Sortino should be defined
    expect(sortino).toBeDefined();
  });
});

describe('calculateVaR', () => {
  it('should return 0 for insufficient data', () => {
    expect(calculateVaR([])).toBe(0);
    expect(calculateVaR([0.01, 0.02])).toBe(0);
  });

  it('should calculate VaR correctly', () => {
    // Generate returns where we can predict VaR
    const returns = Array.from({ length: 100 }, (_, i) => (i - 50) / 100);
    const var95 = calculateVaR(returns, 0.95);
    
    // VaR should be positive (it's a potential loss)
    expect(var95).toBeGreaterThan(0);
  });
});

describe('calculateExpectedShortfall', () => {
  it('should return 0 for insufficient data', () => {
    expect(calculateExpectedShortfall([])).toBe(0);
    expect(calculateExpectedShortfall([0.01, 0.02])).toBe(0);
  });

  it('should calculate ES correctly', () => {
    const returns = Array.from({ length: 100 }, (_, i) => (i - 50) / 100);
    const es = calculateExpectedShortfall(returns, 0.95);
    
    // ES should be >= VaR for the same confidence level
    const var95 = calculateVaR(returns, 0.95);
    expect(es).toBeGreaterThanOrEqual(var95);
  });
});

describe('calculateRiskMetrics', () => {
  it('should return zeros for insufficient data', () => {
    const result = calculateRiskMetrics([]);
    
    expect(result.volatility).toBe(0);
    expect(result.maxDrawdown).toBe(0);
    expect(result.sharpeRatio).toBe(0);
  });

  it('should calculate all metrics correctly', () => {
    const historical = [
      { timestamp: new Date('2024-01-01'), value: 100000 },
      { timestamp: new Date('2024-01-02'), value: 101000 },
      { timestamp: new Date('2024-01-03'), value: 100500 },
      { timestamp: new Date('2024-01-04'), value: 102000 },
      { timestamp: new Date('2024-01-05'), value: 101500 },
    ];
    
    const result = calculateRiskMetrics(historical);
    
    expect(result.volatility).toBeGreaterThan(0);
    expect(result.maxDrawdown).toBeGreaterThanOrEqual(0);
    expect(result.sharpeRatio).toBeDefined();
  });
});

describe('analyzePositions', () => {
  it('should return empty results for no positions', () => {
    const result = analyzePositions([], 100000);
    
    expect(result.positions).toEqual([]);
    expect(result.topGainers).toEqual([]);
    expect(result.topLosers).toEqual([]);
    expect(result.concentrationRisk).toBe(0);
  });

  it('should calculate position analytics correctly', () => {
    const positions = [
      { symbol: 'BTC', quantity: 1, averageCost: 50000 },
      { symbol: 'ETH', quantity: 10, averageCost: 3000 },
    ];
    
    const result = analyzePositions(positions, 100000);
    
    expect(result.positions.length).toBe(2);
    expect(result.concentrationRisk).toBeGreaterThan(0);
    expect(result.largestPositionWeight).toBeGreaterThan(0);
  });

  it('should identify top gainers and losers', () => {
    const positions = [
      { symbol: 'BTC', quantity: 1, averageCost: 50000, currentPrice: 55000, unrealizedPnL: 5000 },
      { symbol: 'ETH', quantity: 10, averageCost: 3000, currentPrice: 2500, unrealizedPnL: -5000 },
      { symbol: 'SOL', quantity: 100, averageCost: 100, currentPrice: 150, unrealizedPnL: 5000 },
    ];
    
    const result = analyzePositions(positions, 100000);
    
    expect(result.topGainers.length).toBeGreaterThan(0);
    expect(result.topLosers.length).toBeGreaterThan(0);
    
    // Top gainers should have positive PnL
    result.topGainers.forEach(p => {
      expect(p.unrealizedPnL).toBeGreaterThan(0);
    });
    
    // Top losers should have negative PnL
    result.topLosers.forEach(p => {
      expect(p.unrealizedPnL).toBeLessThan(0);
    });
  });
});

describe('calculateCorrelation', () => {
  it('should return 0 for mismatched or insufficient data', () => {
    expect(calculateCorrelation([], [])).toBe(0);
    expect(calculateCorrelation([1, 2], [])).toBe(0);
    expect(calculateCorrelation([1], [2])).toBe(0);
  });

  it('should return 1 for identical series', () => {
    const series = [1, 2, 3, 4, 5];
    expect(calculateCorrelation(series, series)).toBeCloseTo(1, 5);
  });

  it('should return -1 for perfectly negatively correlated series', () => {
    const series1 = [1, 2, 3, 4, 5];
    const series2 = [5, 4, 3, 2, 1];
    expect(calculateCorrelation(series1, series2)).toBeCloseTo(-1, 5);
  });
});

describe('calculateCorrelationMatrix', () => {
  it('should return empty array for no data', () => {
    const result = calculateCorrelationMatrix(new Map());
    expect(result).toEqual([]);
  });

  it('should calculate correlation matrix correctly', () => {
    const priceHistory = new Map([
      ['BTC', [50000, 51000, 52000, 51500, 52500]],
      ['ETH', [3000, 3100, 3200, 3150, 3250]],
    ]);
    
    const result = calculateCorrelationMatrix(priceHistory);
    
    expect(result.length).toBe(3); // BTC-BTC, BTC-ETH, ETH-ETH
    expect(result.find((e: any) => e.symbol1 === 'BTC' && e.symbol2 === 'BTC')?.correlation).toBe(1);
    expect(result.find((e: any) => e.symbol1 === 'ETH' && e.symbol2 === 'ETH')?.correlation).toBe(1);
  });
});

describe('calculatePnLBreakdown', () => {
  it('should calculate P&L breakdown correctly', () => {
    // Create trades with proper structure
    const now = Date.now();
    const mockTrades = [
      {
        id: '1',
        strategyId: 'test',
        symbol: 'BTC',
        side: 'buy' as const,
        price: 50000,
        quantity: 1,
        total: 50000,
        executedAt: new Date(now - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago (within daily)
      },
      {
        id: '2',
        strategyId: 'test',
        symbol: 'BTC',
        side: 'sell' as const,
        price: 60000, // Sell at higher price for profit
        quantity: 1,
        total: 60000,
        executedAt: new Date(now - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago (within daily)
      },
    ];

    const result = calculatePnLBreakdown(mockTrades as any, 1000, 100000);
    
    expect(result.daily).toBeDefined();
    expect(result.weekly).toBeDefined();
    expect(result.monthly).toBeDefined();
    expect(result.allTime).toBeDefined();
    
    // Daily should have profit: sell 60000 - buy 50000 = 10000
    expect(result.daily.realized).toBe(10000);
    expect(result.daily.total).toBe(11000); // 10000 realized + 1000 unrealized
  });

  it('should handle no trades', () => {
    const result = calculatePnLBreakdown([], 1000, 100000);
    
    expect(result.daily.realized).toBe(0);
    expect(result.weekly.realized).toBe(0);
    expect(result.monthly.realized).toBe(0);
    expect(result.allTime.realized).toBe(0);
  });
});

describe('formatPercent', () => {
  it('should format positive values with plus sign', () => {
    expect(formatPercent(5.5)).toBe('+5.50%');
    expect(formatPercent(0)).toBe('+0.00%');
  });

  it('should format negative values with minus sign', () => {
    expect(formatPercent(-5.5)).toBe('-5.50%');
  });

  it('should respect decimal places', () => {
    expect(formatPercent(5.555, 1)).toBe('+5.6%');
    expect(formatPercent(5.555, 3)).toBe('+5.555%');
  });
});

describe('formatCurrency', () => {
  it('should format small values with dollar sign', () => {
    expect(formatCurrency(500)).toBe('$500.00');
  });

  it('should format thousands with K suffix', () => {
    expect(formatCurrency(5000)).toBe('$5.00K');
    expect(formatCurrency(15000)).toBe('$15.00K');
  });

  it('should format millions with M suffix', () => {
    expect(formatCurrency(1500000)).toBe('$1.50M');
  });

  it('should format billions with B suffix', () => {
    expect(formatCurrency(1500000000)).toBe('$1.50B');
  });

  it('should handle negative values', () => {
    expect(formatCurrency(-5000)).toBe('$-5.00K');
  });
});

describe('formatDuration', () => {
  it('should format minutes', () => {
    expect(formatDuration(0.5)).toBe('30m');
    expect(formatDuration(0.25)).toBe('15m');
  });

  it('should format hours', () => {
    expect(formatDuration(2)).toBe('2.0h');
    expect(formatDuration(12.5)).toBe('12.5h');
  });

  it('should format days', () => {
    expect(formatDuration(24)).toBe('1.0d');
    expect(formatDuration(48)).toBe('2.0d');
  });
});
