/**
 * Portfolio Analytics Utilities
 * 
 * Provides calculation functions for portfolio risk metrics and performance analysis.
 * All calculations are designed to be non-blocking for UI rendering.
 */

import type { Trade, Portfolio } from '../utils/api';

/**
 * Position with extended analytics data
 */
export interface PositionAnalytics {
  symbol: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  costBasis: number;
  weight: number; // Percentage of total portfolio
  priceChange24h: number;
  priceChangePercent24h: number;
}

/**
 * Portfolio risk metrics
 */
export interface RiskMetrics {
  volatility: number; // Standard deviation of returns (annualized)
  maxDrawdown: number; // Maximum peak-to-trough decline
  maxDrawdownPercent: number;
  sharpeRatio: number; // Risk-adjusted return (annualized)
  sortinoRatio: number; // Downside risk-adjusted return
  valueAtRisk95: number; // 95% VaR (daily)
  expectedShortfall: number; // CVaR (average loss beyond VaR)
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
  dailyPnLPercent: number;
  weeklyPnLPercent: number;
  monthlyPnLPercent: number;
  winRate: number;
  averageTradeDuration: number; // in hours
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number; // Gross profit / Gross loss
  bestTrade: number;
  worstTrade: number;
}

/**
 * Position analysis result
 */
export interface PositionAnalysis {
  positions: PositionAnalytics[];
  topGainers: PositionAnalytics[];
  topLosers: PositionAnalytics[];
  concentrationRisk: number; // Herfindahl index
  largestPositionWeight: number;
}

/**
 * P&L breakdown by period
 */
export interface PnLBreakdown {
  daily: { realized: number; unrealized: number; total: number };
  weekly: { realized: number; unrealized: number; total: number };
  monthly: { realized: number; unrealized: number; total: number };
  allTime: { realized: number; unrealized: number; total: number };
}

/**
 * Correlation matrix entry
 */
export interface CorrelationEntry {
  symbol1: string;
  symbol2: string;
  correlation: number; // -1 to 1
}

/**
 * Historical data point for calculations
 */
export interface HistoricalDataPoint {
  timestamp: Date;
  value: number;
  return?: number; // Percentage return from previous period
}

/**
 * Calculate volatility (annualized standard deviation of returns)
 * Uses population standard deviation for consistency
 */
export function calculateVolatility(
  returns: number[],
  periodsPerYear: number = 252
): number {
  if (returns.length < 2) return 0;

  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / returns.length;
  
  // Annualize the volatility
  return Math.sqrt(variance * periodsPerYear);
}

/**
 * Calculate maximum drawdown from historical values
 */
export function calculateMaxDrawdown(
  values: number[]
): { maxDrawdown: number; maxDrawdownPercent: number } {
  if (values.length < 2) {
    return { maxDrawdown: 0, maxDrawdownPercent: 0 };
  }

  let peak = values[0];
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;

  for (const value of values) {
    if (value > peak) {
      peak = value;
    }
    
    const drawdown = peak - value;
    const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;
    
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPercent = drawdownPercent;
    }
  }

  return { maxDrawdown, maxDrawdownPercent };
}

/**
 * Calculate Sharpe Ratio (annualized)
 * Assumes risk-free rate of 0 for simplicity
 */
export function calculateSharpeRatio(
  returns: number[],
  riskFreeRate: number = 0,
  periodsPerYear: number = 252
): number {
  if (returns.length < 2) return 0;

  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const volatility = calculateVolatility(returns, periodsPerYear);
  
  if (volatility === 0) return 0;

  // Annualize the average return
  const annualizedReturn = avgReturn * periodsPerYear;
  const annualizedRiskFree = riskFreeRate;

  return (annualizedReturn - annualizedRiskFree) / volatility;
}

/**
 * Calculate Sortino Ratio (downside risk-adjusted return)
 */
export function calculateSortinoRatio(
  returns: number[],
  riskFreeRate: number = 0,
  periodsPerYear: number = 252
): number {
  if (returns.length < 2) return 0;

  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  
  // Calculate downside deviation (only negative returns)
  const negativeReturns = returns.filter(r => r < 0);
  if (negativeReturns.length === 0) return Infinity;

  const squaredDownside = negativeReturns.map(r => Math.pow(r, 2));
  const downsideVariance = squaredDownside.reduce((sum, d) => sum + d, 0) / returns.length;
  const downsideDeviation = Math.sqrt(downsideVariance * periodsPerYear);

  if (downsideDeviation === 0) return 0;

  const annualizedReturn = avgReturn * periodsPerYear;
  return (annualizedReturn - riskFreeRate) / downsideDeviation;
}

/**
 * Calculate Value at Risk (VaR) using historical method
 * @param returns Array of historical returns
 * @param confidence Confidence level (default 95%)
 */
export function calculateVaR(
  returns: number[],
  confidence: number = 0.95
): number {
  if (returns.length < 10) return 0;

  const sortedReturns = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidence) * sortedReturns.length);
  
  return Math.abs(sortedReturns[index] || 0);
}

/**
 * Calculate Expected Shortfall (CVaR)
 * Average of returns below VaR threshold
 */
export function calculateExpectedShortfall(
  returns: number[],
  confidence: number = 0.95
): number {
  if (returns.length < 10) return 0;

  const sortedReturns = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidence) * sortedReturns.length);
  const tailReturns = sortedReturns.slice(0, index + 1);
  
  if (tailReturns.length === 0) return 0;
  
  return Math.abs(tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length);
}

/**
 * Calculate all risk metrics from historical data
 */
export function calculateRiskMetrics(
  historicalValues: HistoricalDataPoint[]
): RiskMetrics {
  if (historicalValues.length < 2) {
    return {
      volatility: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      valueAtRisk95: 0,
      expectedShortfall: 0,
    };
  }

  // Calculate returns
  const returns: number[] = [];
  for (let i = 1; i < historicalValues.length; i++) {
    const prev = historicalValues[i - 1].value;
    const curr = historicalValues[i].value;
    if (prev > 0) {
      returns.push((curr - prev) / prev);
    }
  }

  const values = historicalValues.map(h => h.value);
  const { maxDrawdown, maxDrawdownPercent } = calculateMaxDrawdown(values);

  return {
    volatility: calculateVolatility(returns),
    maxDrawdown,
    maxDrawdownPercent,
    sharpeRatio: calculateSharpeRatio(returns),
    sortinoRatio: calculateSortinoRatio(returns),
    valueAtRisk95: calculateVaR(returns),
    expectedShortfall: calculateExpectedShortfall(returns),
  };
}

/**
 * Calculate performance metrics from trades and portfolio data
 */
export function calculatePerformanceMetrics(
  trades: Trade[],
  portfolioValue: number,
  initialCapital: number,
  historicalValues: HistoricalDataPoint[]
): PerformanceMetrics {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Calculate realized P&L from trades
  const sells = trades.filter(t => t.side === 'sell');
  const buys = trades.filter(t => t.side === 'buy');

  // Total return
  const totalReturn = portfolioValue - initialCapital;
  const totalReturnPercent = initialCapital > 0 
    ? (totalReturn / initialCapital) * 100 
    : 0;

  // Period P&L calculations
  const dailyTrades = trades.filter(t => new Date(t.executedAt) >= oneDayAgo);
  const weeklyTrades = trades.filter(t => new Date(t.executedAt) >= oneWeekAgo);
  const monthlyTrades = trades.filter(t => new Date(t.executedAt) >= oneMonthAgo);

  const calculateRealizedPnL = (tradeList: Trade[]): number => {
    const periodSells = tradeList.filter(t => t.side === 'sell');
    const periodBuys = tradeList.filter(t => t.side === 'buy');
    const totalCost = periodBuys.reduce((sum, t) => sum + t.total, 0);
    const totalProceeds = periodSells.reduce((sum, t) => sum + t.total, 0);
    return totalProceeds - totalCost;
  };

  const dailyPnL = calculateRealizedPnL(dailyTrades);
  const weeklyPnL = calculateRealizedPnL(weeklyTrades);
  const monthlyPnL = calculateRealizedPnL(monthlyTrades);

  // Estimate P&L percentages based on current portfolio value
  const dailyPnLPercent = portfolioValue > 0 ? (dailyPnL / portfolioValue) * 100 : 0;
  const weeklyPnLPercent = portfolioValue > 0 ? (weeklyPnL / portfolioValue) * 100 : 0;
  const monthlyPnLPercent = portfolioValue > 0 ? (monthlyPnL / portfolioValue) * 100 : 0;

  // Win rate calculation
  const winningTrades = sells.filter((sell, idx) => {
    // Simple heuristic: profitable if sell price > average buy price
    const symbolBuys = buys.filter(b => b.symbol === sell.symbol);
    if (symbolBuys.length === 0) return false;
    const avgBuyPrice = symbolBuys.reduce((sum, b) => sum + b.price * b.quantity, 0) 
      / symbolBuys.reduce((sum, b) => sum + b.quantity, 0);
    return sell.price > avgBuyPrice;
  });

  const losingTrades = sells.filter((sell, idx) => {
    const symbolBuys = buys.filter(b => b.symbol === sell.symbol);
    if (symbolBuys.length === 0) return false;
    const avgBuyPrice = symbolBuys.reduce((sum, b) => sum + b.price * b.quantity, 0) 
      / symbolBuys.reduce((sum, b) => sum + b.quantity, 0);
    return sell.price <= avgBuyPrice;
  });

  const winRate = sells.length > 0 ? (winningTrades.length / sells.length) * 100 : 0;

  // Average trade duration (simplified - assumes FIFO)
  const tradeDurations: number[] = [];
  const positionOpenTimes: Map<string, Date> = new Map();
  
  for (const trade of trades.sort((a, b) => 
    new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime()
  )) {
    if (trade.side === 'buy') {
      positionOpenTimes.set(trade.symbol, new Date(trade.executedAt));
    } else if (trade.side === 'sell') {
      const openTime = positionOpenTimes.get(trade.symbol);
      if (openTime) {
        const duration = (new Date(trade.executedAt).getTime() - openTime.getTime()) / (1000 * 60 * 60);
        tradeDurations.push(duration);
      }
    }
  }

  const averageTradeDuration = tradeDurations.length > 0
    ? tradeDurations.reduce((sum, d) => sum + d, 0) / tradeDurations.length
    : 0;

  // Profit factor
  const grossProfit = winningTrades.reduce((sum, t) => sum + t.total, 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.total, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  // Average win/loss
  const averageWin = winningTrades.length > 0 
    ? winningTrades.reduce((sum, t) => sum + t.total, 0) / winningTrades.length 
    : 0;
  const averageLoss = losingTrades.length > 0 
    ? losingTrades.reduce((sum, t) => sum + t.total, 0) / losingTrades.length 
    : 0;

  // Best and worst trades
  const allTradePnLs = sells.map(sell => {
    const symbolBuys = buys.filter(b => b.symbol === sell.symbol);
    if (symbolBuys.length === 0) return 0;
    const avgBuyPrice = symbolBuys.reduce((sum, b) => sum + b.price * b.quantity, 0) 
      / symbolBuys.reduce((sum, b) => sum + b.quantity, 0);
    return (sell.price - avgBuyPrice) * sell.quantity;
  });

  const bestTrade = allTradePnLs.length > 0 ? Math.max(...allTradePnLs) : 0;
  const worstTrade = allTradePnLs.length > 0 ? Math.min(...allTradePnLs) : 0;

  return {
    totalReturn,
    totalReturnPercent,
    dailyPnL,
    weeklyPnL,
    monthlyPnL,
    dailyPnLPercent,
    weeklyPnLPercent,
    monthlyPnLPercent,
    winRate,
    averageTradeDuration,
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    averageWin,
    averageLoss,
    profitFactor,
    bestTrade,
    worstTrade,
  };
}

/**
 * Analyze positions for risk and performance
 */
export function analyzePositions(
  positions: Array<{
    symbol: string;
    quantity: number;
    averageCost: number;
    currentPrice?: number;
    marketValue?: number;
    unrealizedPnL?: number;
    priceChange24h?: number;
    priceChangePercent24h?: number;
  }>,
  totalPortfolioValue: number
): PositionAnalysis {
  const analytics: PositionAnalytics[] = positions.map(pos => {
    const currentPrice = pos.currentPrice || pos.averageCost;
    const marketValue = pos.marketValue || (pos.quantity * currentPrice);
    const costBasis = pos.quantity * pos.averageCost;
    const unrealizedPnL = pos.unrealizedPnL || (marketValue - costBasis);
    const unrealizedPnLPercent = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;
    const weight = totalPortfolioValue > 0 ? (marketValue / totalPortfolioValue) * 100 : 0;

    return {
      symbol: pos.symbol,
      quantity: pos.quantity,
      averageCost: pos.averageCost,
      currentPrice,
      marketValue,
      unrealizedPnL,
      unrealizedPnLPercent,
      costBasis,
      weight,
      priceChange24h: pos.priceChange24h || 0,
      priceChangePercent24h: pos.priceChangePercent24h || 0,
    };
  });

  // Sort by unrealized P&L for top gainers/losers
  const sorted = [...analytics].sort((a, b) => b.unrealizedPnL - a.unrealizedPnL);
  const topGainers = sorted.filter(p => p.unrealizedPnL > 0).slice(0, 5);
  const topLosers = sorted.filter(p => p.unrealizedPnL < 0).reverse().slice(0, 5);

  // Calculate concentration risk (Herfindahl index)
  const concentrationRisk = analytics.reduce((sum, p) => sum + Math.pow(p.weight, 2), 0);
  const largestPositionWeight = Math.max(...analytics.map(p => p.weight), 0);

  return {
    positions: analytics,
    topGainers,
    topLosers,
    concentrationRisk,
    largestPositionWeight,
  };
}

/**
 * Calculate correlation between two price series
 */
export function calculateCorrelation(
  series1: number[],
  series2: number[]
): number {
  if (series1.length !== series2.length || series1.length < 2) return 0;

  const n = series1.length;
  const mean1 = series1.reduce((sum, v) => sum + v, 0) / n;
  const mean2 = series2.reduce((sum, v) => sum + v, 0) / n;

  let numerator = 0;
  let denom1 = 0;
  let denom2 = 0;

  for (let i = 0; i < n; i++) {
    const diff1 = series1[i] - mean1;
    const diff2 = series2[i] - mean2;
    numerator += diff1 * diff2;
    denom1 += diff1 * diff1;
    denom2 += diff2 * diff2;
  }

  const denominator = Math.sqrt(denom1 * denom2);
  return denominator > 0 ? numerator / denominator : 0;
}

/**
 * Calculate correlation matrix for held assets
 * Requires historical price data for each symbol
 */
export function calculateCorrelationMatrix(
  priceHistory: Map<string, number[]>
): CorrelationEntry[] {
  const symbols = Array.from(priceHistory.keys());
  const entries: CorrelationEntry[] = [];

  for (let i = 0; i < symbols.length; i++) {
    for (let j = i; j < symbols.length; j++) {
      const series1 = priceHistory.get(symbols[i]) || [];
      const series2 = priceHistory.get(symbols[j]) || [];
      
      entries.push({
        symbol1: symbols[i],
        symbol2: symbols[j],
        correlation: i === j ? 1 : calculateCorrelation(series1, series2),
      });
    }
  }

  return entries;
}

/**
 * Calculate P&L breakdown by time period
 */
export function calculatePnLBreakdown(
  trades: Trade[],
  currentUnrealizedPnL: number,
  portfolioValue: number
): PnLBreakdown {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const calculatePeriodPnL = (startDate: Date) => {
    const periodTrades = trades.filter(t => new Date(t.executedAt) >= startDate);
    const buys = periodTrades.filter(t => t.side === 'buy');
    const sells = periodTrades.filter(t => t.side === 'sell');
    const realized = sells.reduce((sum, t) => sum + t.total, 0) 
      - buys.reduce((sum, t) => sum + t.total, 0);
    return realized;
  };

  return {
    daily: {
      realized: calculatePeriodPnL(oneDayAgo),
      unrealized: currentUnrealizedPnL, // Simplified: current unrealized
      total: calculatePeriodPnL(oneDayAgo) + currentUnrealizedPnL,
    },
    weekly: {
      realized: calculatePeriodPnL(oneWeekAgo),
      unrealized: currentUnrealizedPnL,
      total: calculatePeriodPnL(oneWeekAgo) + currentUnrealizedPnL,
    },
    monthly: {
      realized: calculatePeriodPnL(oneMonthAgo),
      unrealized: currentUnrealizedPnL,
      total: calculatePeriodPnL(oneMonthAgo) + currentUnrealizedPnL,
    },
    allTime: {
      realized: calculatePeriodPnL(new Date(0)),
      unrealized: currentUnrealizedPnL,
      total: calculatePeriodPnL(new Date(0)) + currentUnrealizedPnL,
    },
  };
}

/**
 * Format a number as percentage string
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

/**
 * Format a number as currency string
 */
export function formatCurrency(value: number, decimals: number = 2): string {
  const absValue = Math.abs(value);
  if (absValue >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  } else if (absValue >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  } else if (absValue >= 1e3) {
    return `$${(value / 1e3).toFixed(2)}K`;
  }
  return `$${value.toFixed(decimals)}`;
}

/**
 * Format duration in hours to human-readable string
 */
export function formatDuration(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  } else if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  } else {
    const days = hours / 24;
    return `${days.toFixed(1)}d`;
  }
}
