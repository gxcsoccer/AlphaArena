/**
 * Performance Analytics Service
 *
 * Comprehensive performance metrics calculation and analysis
 *
 * @module analytics/PerformanceAnalytics
 */

import { PortfolioSnapshot } from '../portfolio/types';
import {
  ReturnMetrics,
  RiskMetrics,
  RiskAdjustedMetrics,
  TradingMetrics,
  PerformanceMetrics,
  EquityCurve,
  EquityCurvePoint,
  MonthlyReturnsHeatmap,
  MonthlyReturnEntry,
  DrawdownAnalysis,
  DrawdownPoint,
  PositionDistribution,
  PerformanceReport,
  AnalyticsQueryOptions,
  BenchmarkData,
} from './types';
import { createLogger } from '../utils/logger';

const log = createLogger('PerformanceAnalytics');

/**
 * Performance Analytics Service
 *
 * Calculates comprehensive performance metrics for trading strategies
 */
export class PerformanceAnalyticsService {
  private riskFreeRate: number = 0.02; // 2% annual risk-free rate
  private tradingDaysPerYear: number = 252;

  /**
   * Calculate complete performance metrics
   */
  calculatePerformanceMetrics(
    snapshots: PortfolioSnapshot[],
    trades: any[],
    initialCapital: number,
    _options?: AnalyticsQueryOptions
  ): PerformanceMetrics {
    log.debug('Calculating performance metrics', {
      snapshotCount: snapshots.length,
      tradeCount: trades.length,
      initialCapital,
    });

    const returns = this.calculateReturnMetrics(snapshots, trades, initialCapital);
    const risk = this.calculateRiskMetrics(snapshots, initialCapital);
    const riskAdjusted = this.calculateRiskAdjustedMetrics(snapshots, initialCapital, risk);
    const trading = this.calculateTradingMetrics(trades);

    return {
      returns,
      risk,
      riskAdjusted,
      trading,
      calculatedAt: Date.now(),
    };
  }

  /**
   * Calculate return metrics
   */
  calculateReturnMetrics(
    snapshots: PortfolioSnapshot[],
    trades: any[],
    initialCapital: number
  ): ReturnMetrics {
    if (snapshots.length === 0) {
      return this.getEmptyReturnMetrics();
    }

    const finalValue = snapshots[snapshots.length - 1].totalValue;
    const totalPnL = finalValue - initialCapital;
    const totalReturn = (totalPnL / initialCapital) * 100;

    // Calculate annualized return
    const startTimestamp = snapshots[0].timestamp;
    const endTimestamp = snapshots[snapshots.length - 1].timestamp;
    const durationDays = (endTimestamp - startTimestamp) / (1000 * 60 * 60 * 24);
    const annualizedReturn = this.calculateAnnualizedReturn(totalReturn, durationDays);

    // Calculate cumulative returns
    const cumulativeReturns = snapshots.map((s) =>
      ((s.totalValue - initialCapital) / initialCapital) * 100
    );

    // Calculate monthly returns
    const monthlyReturns = this.calculateMonthlyReturns(snapshots, initialCapital);

    // Win rate and profit/loss ratio
    const closedTrades = trades.filter((t) => t.realizedPnL !== undefined);
    const winningTrades = closedTrades.filter((t) => t.realizedPnL > 0);
    const losingTrades = closedTrades.filter((t) => t.realizedPnL < 0);

    const winRate = closedTrades.length > 0
      ? (winningTrades.length / closedTrades.length) * 100
      : 0;

    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + t.realizedPnL, 0) / winningTrades.length
      : 0;

    const avgLoss = losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((sum, t) => sum + t.realizedPnL, 0) / losingTrades.length)
      : 0;

    const profitLossRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;

    return {
      totalReturn,
      annualizedReturn,
      cumulativeReturns,
      monthlyReturns,
      winRate,
      profitLossRatio: isFinite(profitLossRatio) ? profitLossRatio : 0,
      avgWin,
      avgLoss,
    };
  }

  /**
   * Calculate risk metrics
   */
  calculateRiskMetrics(snapshots: PortfolioSnapshot[], _initialCapital: number): RiskMetrics {
    if (snapshots.length < 2) {
      return this.getEmptyRiskMetrics();
    }

    // Calculate daily returns
    const dailyReturns: number[] = [];
    for (let i = 1; i < snapshots.length; i++) {
      const prevValue = snapshots[i - 1].totalValue;
      const currValue = snapshots[i].totalValue;
      dailyReturns.push((currValue - prevValue) / prevValue);
    }

    // Max drawdown
    const { maxDrawdown, maxDuration } = this.calculateMaxDrawdown(snapshots);

    // Volatility (annualized)
    const volatility = this.calculateVolatility(dailyReturns);

    // Downside risk (semi-deviation)
    const downsideRisk = this.calculateDownsideRisk(dailyReturns);

    // VaR (95% confidence)
    const var95 = this.calculateVaR(dailyReturns, 0.95);

    // CVaR (Expected Shortfall)
    const cvar = this.calculateCVaR(dailyReturns, 0.95);

    return {
      maxDrawdown,
      maxDrawdownDuration: maxDuration,
      volatility,
      downsideRisk,
      var95,
      cvar,
    };
  }

  /**
   * Calculate risk-adjusted metrics
   */
  calculateRiskAdjustedMetrics(
    snapshots: PortfolioSnapshot[],
    initialCapital: number,
    riskMetrics: RiskMetrics
  ): RiskAdjustedMetrics {
    if (snapshots.length < 2) {
      return this.getEmptyRiskAdjustedMetrics();
    }

    const dailyReturns: number[] = [];
    for (let i = 1; i < snapshots.length; i++) {
      const prevValue = snapshots[i - 1].totalValue;
      const currValue = snapshots[i].totalValue;
      dailyReturns.push((currValue - prevValue) / prevValue);
    }

    // Sharpe ratio
    const sharpeRatio = this.calculateSharpeRatio(dailyReturns);

    // Sortino ratio
    const sortinoRatio = this.calculateSortinoRatio(dailyReturns);

    // Calmar ratio
    const calmarRatio = this.calculateCalmarRatio(snapshots, initialCapital, riskMetrics.maxDrawdown);

    return {
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
    };
  }

  /**
   * Calculate trading metrics
   */
  calculateTradingMetrics(trades: any[]): TradingMetrics {
    if (trades.length === 0) {
      return this.getEmptyTradingMetrics();
    }

    const totalTrades = trades.length;

    // Calculate holding times (assuming trades have entry and exit timestamps)
    const holdingTimes: number[] = [];
    for (const trade of trades) {
      if (trade.entryTime && trade.exitTime) {
        holdingTimes.push((trade.exitTime - trade.entryTime) / (1000 * 60 * 60)); // hours
      }
    }
    const avgHoldingTime = holdingTimes.length > 0
      ? holdingTimes.reduce((sum, t) => sum + t, 0) / holdingTimes.length
      : 0;

    // Consecutive wins and losses
    const { maxWins, maxLosses } = this.calculateConsecutiveWinsLosses(trades);

    // Trading frequency (trades per day)
    const timestamps = trades.map((t) => t.timestamp).filter((t) => t);
    if (timestamps.length === 0) {
      return this.getEmptyTradingMetrics();
    }

    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);
    const daysCovered = Math.max(1, (maxTimestamp - minTimestamp) / (1000 * 60 * 60 * 24));
    const tradingFrequency = totalTrades / daysCovered;

    // Turnover rate (simplified calculation)
    const tradeValues = trades.map((t) => Math.abs(t.quantity * t.price));
    const totalTradeValue = tradeValues.reduce((sum, v) => sum + v, 0);
    const avgPortfolioValue = trades.length > 0 ? totalTradeValue / trades.length : 0;
    const turnoverRate = avgPortfolioValue > 0 ? totalTradeValue / avgPortfolioValue / daysCovered : 0;

    // Average trade size
    const avgTradeSize = totalTradeValue / totalTrades;

    // Largest win and loss
    const pnls = trades.map((t) => t.realizedPnL || 0);
    const largestWin = Math.max(...pnls, 0);
    const largestLoss = Math.abs(Math.min(...pnls, 0));

    return {
      totalTrades,
      avgHoldingTime,
      maxConsecutiveWins: maxWins,
      maxConsecutiveLosses: maxLosses,
      tradingFrequency,
      turnoverRate,
      avgTradeSize,
      largestWin,
      largestLoss,
    };
  }

  /**
   * Calculate equity curve
   */
  calculateEquityCurve(
    snapshots: PortfolioSnapshot[],
    initialCapital: number,
    benchmark?: BenchmarkData
  ): EquityCurve {
    if (snapshots.length === 0) {
      return {
        points: [],
        initialCapital,
        finalCapital: initialCapital,
        startTimestamp: Date.now(),
        endTimestamp: Date.now(),
      };
    }

    let peak = initialCapital;
    const points: EquityCurvePoint[] = snapshots.map((snapshot, index) => {
      const returnPct = ((snapshot.totalValue - initialCapital) / initialCapital) * 100;

      if (snapshot.totalValue > peak) {
        peak = snapshot.totalValue;
      }

      const drawdown = ((peak - snapshot.totalValue) / peak) * 100;

      const point: EquityCurvePoint = {
        timestamp: snapshot.timestamp,
        value: snapshot.totalValue,
        return: returnPct,
        drawdown,
      };

      // Add benchmark data if available
      if (benchmark && benchmark.data[index]) {
        point.benchmarkValue = benchmark.data[index].value;
        point.benchmarkReturn = benchmark.data[index].return;
      }

      return point;
    });

    const finalCapital = snapshots[snapshots.length - 1].totalValue;

    return {
      points,
      initialCapital,
      finalCapital,
      startTimestamp: snapshots[0].timestamp,
      endTimestamp: snapshots[snapshots.length - 1].timestamp,
    };
  }

  /**
   * Calculate monthly returns heatmap
   */
  calculateMonthlyReturnsHeatmap(
    snapshots: PortfolioSnapshot[],
    _initialCapital: number
  ): MonthlyReturnsHeatmap {
    const monthlyData = new Map<string, { startValue: number; endValue: number; trades: number; pnl: number }>();

    // Initialize monthly data
    for (const snapshot of snapshots) {
      const date = new Date(snapshot.timestamp);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData.has(key)) {
        monthlyData.set(key, {
          startValue: snapshot.totalValue,
          endValue: snapshot.totalValue,
          trades: 0,
          pnl: 0,
        });
      } else {
        const data = monthlyData.get(key)!;
        data.endValue = snapshot.totalValue;
      }
    }

    // Convert to entries
    const entries: MonthlyReturnEntry[] = [];
    for (const [key, data] of monthlyData) {
      const [year, month] = key.split('-').map(Number);
      const returnPct = ((data.endValue - data.startValue) / data.startValue) * 100;

      entries.push({
        year,
        month,
        return: returnPct,
        trades: data.trades,
        pnl: data.pnl,
      });
    }

    // Sort entries
    entries.sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));

    // Get years
    const years = [...new Set(entries.map((e) => e.year))].sort();

    // Find best and worst months
    let bestMonth = entries[0];
    let worstMonth = entries[0];

    for (const entry of entries) {
      if (entry.return > bestMonth.return) {
        bestMonth = entry;
      }
      if (entry.return < worstMonth.return) {
        worstMonth = entry;
      }
    }

    return {
      entries,
      years,
      bestMonth: bestMonth ? { year: bestMonth.year, month: bestMonth.month, return: bestMonth.return } : { year: 0, month: 0, return: 0 },
      worstMonth: worstMonth ? { year: worstMonth.year, month: worstMonth.month, return: worstMonth.return } : { year: 0, month: 0, return: 0 },
    };
  }

  /**
   * Calculate drawdown analysis
   */
  calculateDrawdownAnalysis(snapshots: PortfolioSnapshot[]): DrawdownAnalysis {
    if (snapshots.length === 0) {
      return {
        periods: [],
        maxDrawdown: 0,
        avgDrawdown: 0,
        avgDuration: 0,
        currentDrawdown: null,
        timeUnderwater: 0,
      };
    }

    const periods: DrawdownPoint[] = [];
    let peak = snapshots[0].totalValue;
    let peakTimestamp = snapshots[0].timestamp;
    let inDrawdown = false;
    let drawdownStart = 0;
    let troughValue = peak;
    let troughTimestamp = peakTimestamp;

    let totalDrawdown = 0;
    let drawdownCount = 0;
    let underwaterPoints = 0;

    for (let i = 0; i < snapshots.length; i++) {
      const snapshot = snapshots[i];
      const value = snapshot.totalValue;

      if (value > peak) {
        // New peak - end current drawdown period if any
        if (inDrawdown) {
          const drawdownPct = ((peak - troughValue) / peak) * 100;
          const duration = (snapshot.timestamp - drawdownStart) / (1000 * 60 * 60 * 24);

          periods.push({
            startTimestamp: drawdownStart,
            endTimestamp: snapshot.timestamp,
            troughTimestamp,
            drawdown: drawdownPct,
            duration,
            recoveryTime: (snapshot.timestamp - troughTimestamp) / (1000 * 60 * 60 * 24),
          });

          totalDrawdown += drawdownPct;
          drawdownCount++;
        }

        peak = value;
        peakTimestamp = snapshot.timestamp;
        troughValue = value;
        troughTimestamp = snapshot.timestamp;
        inDrawdown = false;
      } else {
        // Underwater
        underwaterPoints++;

        if (!inDrawdown) {
          inDrawdown = true;
          drawdownStart = peakTimestamp;
        }

        if (value < troughValue) {
          troughValue = value;
          troughTimestamp = snapshot.timestamp;
        }
      }
    }

    // Check if still in drawdown
    const currentDrawdown = inDrawdown ? ((peak - snapshots[snapshots.length - 1].totalValue) / peak) * 100 : null;

    // Calculate max drawdown from periods
    const maxDrawdown = periods.length > 0
      ? Math.max(...periods.map((p) => p.drawdown))
      : currentDrawdown || 0;

    // Calculate averages
    const avgDrawdown = drawdownCount > 0 ? totalDrawdown / drawdownCount : 0;
    const avgDuration = periods.length > 0
      ? periods.reduce((sum, p) => sum + p.duration, 0) / periods.length
      : 0;

    const timeUnderwater = snapshots.length > 0
      ? (underwaterPoints / snapshots.length) * 100
      : 0;

    return {
      periods,
      maxDrawdown,
      avgDrawdown,
      avgDuration,
      currentDrawdown,
      timeUnderwater,
    };
  }

  /**
   * Calculate position distribution
   */
  calculatePositionDistribution(
    snapshots: PortfolioSnapshot[],
    trades: any[]
  ): PositionDistribution {
    if (snapshots.length === 0) {
      return {
        byAssetClass: new Map(),
        byStrategy: new Map(),
        byPnLStatus: {
          profitable: { count: 0, value: 0 },
          losing: { count: 0, value: 0 },
          breakeven: { count: 0, value: 0 },
        },
      };
    }

    const latestSnapshot = snapshots[snapshots.length - 1];
    const totalValue = latestSnapshot.totalValue;

    // By asset class (simplified - using symbol prefix)
    const byAssetClass = new Map<string, { value: number; percentage: number }>();
    for (const position of latestSnapshot.positions) {
      const assetClass = this.getAssetClass(position.symbol);
      const positionValue = position.quantity * (position.averageCost || 0);
      const existing = byAssetClass.get(assetClass) || { value: 0, percentage: 0 };
      existing.value += positionValue;
      existing.percentage = (existing.value / totalValue) * 100;
      byAssetClass.set(assetClass, existing);
    }

    // By strategy
    const byStrategy = new Map<string, { value: number; percentage: number }>();
    const strategyPositions = new Map<string, number>();
    for (const trade of trades) {
      if (trade.strategyId) {
        const value = strategyPositions.get(trade.strategyId) || 0;
        strategyPositions.set(trade.strategyId, value + Math.abs(trade.quantity * trade.price));
      }
    }
    for (const [strategyId, value] of strategyPositions) {
      byStrategy.set(strategyId, {
        value,
        percentage: (value / totalValue) * 100,
      });
    }

    // By P&L status
    const closedTrades = trades.filter((t) => t.realizedPnL !== undefined);
    const profitable = closedTrades.filter((t) => t.realizedPnL > 0);
    const losing = closedTrades.filter((t) => t.realizedPnL < 0);
    const breakeven = closedTrades.filter((t) => t.realizedPnL === 0);

    const byPnLStatus = {
      profitable: {
        count: profitable.length,
        value: profitable.reduce((sum, t) => sum + t.realizedPnL, 0),
      },
      losing: {
        count: losing.length,
        value: Math.abs(losing.reduce((sum, t) => sum + t.realizedPnL, 0)),
      },
      breakeven: {
        count: breakeven.length,
        value: 0,
      },
    };

    return {
      byAssetClass,
      byStrategy,
      byPnLStatus,
    };
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(
    strategyId: string,
    strategyName: string,
    snapshots: PortfolioSnapshot[],
    trades: any[],
    initialCapital: number,
    options?: AnalyticsQueryOptions
  ): PerformanceReport {
    log.info('Generating performance report', { strategyId, strategyName });

    const metrics = this.calculatePerformanceMetrics(snapshots, trades, initialCapital, options);
    const equityCurve = this.calculateEquityCurve(snapshots, initialCapital);
    const drawdownAnalysis = this.calculateDrawdownAnalysis(snapshots);
    const monthlyReturns = this.calculateMonthlyReturnsHeatmap(snapshots, initialCapital);

    const startTimestamp = snapshots.length > 0 ? snapshots[0].timestamp : Date.now();
    const endTimestamp = snapshots.length > 0 ? snapshots[snapshots.length - 1].timestamp : Date.now();
    const durationDays = (endTimestamp - startTimestamp) / (1000 * 60 * 60 * 24);

    const report: PerformanceReport = {
      id: `report-${strategyId}-${Date.now()}`,
      strategyId,
      strategyName,
      period: {
        start: new Date(startTimestamp),
        end: new Date(endTimestamp),
        duration: this.formatDuration(durationDays),
      },
      summary: {
        totalReturn: metrics.returns.totalReturn,
        annualizedReturn: metrics.returns.annualizedReturn,
        sharpeRatio: metrics.riskAdjusted.sharpeRatio,
        maxDrawdown: metrics.risk.maxDrawdown,
        winRate: metrics.returns.winRate,
        profitFactor: metrics.returns.avgLoss > 0
          ? metrics.returns.avgWin / metrics.returns.avgLoss
          : 0,
      },
      detailedMetrics: metrics,
      equityCurve,
      drawdownAnalysis,
      monthlyReturns,
      generatedAt: new Date(),
    };

    if (options?.includeTrades) {
      report.trades = trades;
    }

    if (options?.includeBenchmark) {
      // Add benchmark comparison placeholder
      // In real implementation, this would fetch benchmark data
    }

    return report;
  }

  // ============== Private Helper Methods ==============

  private calculateAnnualizedReturn(totalReturn: number, durationDays: number): number {
    if (durationDays <= 0) return totalReturn;

    const years = durationDays / 365;
    const annualizedReturn = (Math.pow(1 + totalReturn / 100, 1 / years) - 1) * 100;

    return isFinite(annualizedReturn) ? annualizedReturn : totalReturn;
  }

  private calculateMonthlyReturns(
    snapshots: PortfolioSnapshot[],
    initialCapital: number
  ): Map<string, number> {
    const monthlyReturns = new Map<string, number>();
    let previousValue = initialCapital;
    let previousMonth = '';

    for (const snapshot of snapshots) {
      const date = new Date(snapshot.timestamp);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (previousMonth && previousMonth !== monthKey) {
        // Calculate return for previous month
        const returnPct = ((snapshot.totalValue - previousValue) / previousValue) * 100;
        monthlyReturns.set(previousMonth, returnPct);
        previousValue = snapshot.totalValue;
      }

      previousMonth = monthKey;
    }

    return monthlyReturns;
  }

  private calculateMaxDrawdown(snapshots: PortfolioSnapshot[]): { maxDrawdown: number; maxDuration: number } {
    if (snapshots.length === 0) {
      return { maxDrawdown: 0, maxDuration: 0 };
    }

    let peak = snapshots[0].totalValue;
    let peakTimestamp = snapshots[0].timestamp;
    let maxDrawdown = 0;
    let maxDuration = 0;

    for (const snapshot of snapshots) {
      if (snapshot.totalValue > peak) {
        peak = snapshot.totalValue;
        peakTimestamp = snapshot.timestamp;
      }

      const drawdown = ((peak - snapshot.totalValue) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDuration = (snapshot.timestamp - peakTimestamp) / (1000 * 60 * 60 * 24);
      }
    }

    return { maxDrawdown, maxDuration };
  }

  private calculateVolatility(dailyReturns: number[]): number {
    if (dailyReturns.length === 0) return 0;

    const mean = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / dailyReturns.length;
    const dailyStdDev = Math.sqrt(variance);

    // Annualize
    return dailyStdDev * Math.sqrt(this.tradingDaysPerYear) * 100;
  }

  private calculateDownsideRisk(dailyReturns: number[]): number {
    if (dailyReturns.length === 0) return 0;

    const mean = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
    const negativeReturns = dailyReturns.filter((r) => r < mean);

    if (negativeReturns.length === 0) return 0;

    const variance = negativeReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / negativeReturns.length;
    const dailyDownsideDev = Math.sqrt(variance);

    // Annualize
    return dailyDownsideDev * Math.sqrt(this.tradingDaysPerYear) * 100;
  }

  private calculateVaR(dailyReturns: number[], confidence: number): number {
    if (dailyReturns.length === 0) return 0;

    const sorted = [...dailyReturns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sorted.length);

    return Math.abs(sorted[index] || 0) * 100;
  }

  private calculateCVaR(dailyReturns: number[], confidence: number): number {
    if (dailyReturns.length === 0) return 0;

    const sorted = [...dailyReturns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sorted.length);
    const tailReturns = sorted.slice(0, index + 1);

    if (tailReturns.length === 0) return 0;

    return Math.abs(tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length) * 100;
  }

  private calculateSharpeRatio(dailyReturns: number[]): number {
    if (dailyReturns.length === 0) return 0;

    const avgDailyReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgDailyReturn, 2), 0) / dailyReturns.length;
    const dailyStdDev = Math.sqrt(variance);

    if (dailyStdDev === 0) return 0;

    const annualizedReturn = avgDailyReturn * this.tradingDaysPerYear;
    const annualizedStdDev = dailyStdDev * Math.sqrt(this.tradingDaysPerYear);
    const dailyRiskFreeRate = this.riskFreeRate / this.tradingDaysPerYear;

    return (annualizedReturn - dailyRiskFreeRate * this.tradingDaysPerYear) / annualizedStdDev;
  }

  private calculateSortinoRatio(dailyReturns: number[]): number {
    if (dailyReturns.length === 0) return 0;

    const avgDailyReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
    const negativeReturns = dailyReturns.filter((r) => r < 0);

    if (negativeReturns.length === 0) return 0;

    const downsideVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length;
    const downsideDev = Math.sqrt(downsideVariance);

    if (downsideDev === 0) return 0;

    const annualizedReturn = avgDailyReturn * this.tradingDaysPerYear;
    const annualizedDownsideDev = downsideDev * Math.sqrt(this.tradingDaysPerYear);

    return annualizedReturn / annualizedDownsideDev;
  }

  private calculateCalmarRatio(
    snapshots: PortfolioSnapshot[],
    initialCapital: number,
    maxDrawdown: number
  ): number {
    if (snapshots.length < 2 || maxDrawdown === 0) return 0;

    const finalValue = snapshots[snapshots.length - 1].totalValue;
    const totalReturn = ((finalValue - initialCapital) / initialCapital) * 100;

    const startTimestamp = snapshots[0].timestamp;
    const endTimestamp = snapshots[snapshots.length - 1].timestamp;
    const durationDays = (endTimestamp - startTimestamp) / (1000 * 60 * 60 * 24);
    const annualizedReturn = this.calculateAnnualizedReturn(totalReturn, durationDays);

    return annualizedReturn / maxDrawdown;
  }

  private calculateConsecutiveWinsLosses(trades: any[]): { maxWins: number; maxLosses: number } {
    let maxWins = 0;
    let maxLosses = 0;
    let currentWins = 0;
    let currentLosses = 0;

    for (const trade of trades) {
      const pnl = trade.realizedPnL || 0;

      if (pnl > 0) {
        currentWins++;
        currentLosses = 0;
        maxWins = Math.max(maxWins, currentWins);
      } else if (pnl < 0) {
        currentLosses++;
        currentWins = 0;
        maxLosses = Math.max(maxLosses, currentLosses);
      } else {
        currentWins = 0;
        currentLosses = 0;
      }
    }

    return { maxWins, maxLosses };
  }

  private getAssetClass(symbol: string): string {
    if (symbol.includes('/') || symbol.endsWith('USDT') || symbol.endsWith('USD')) {
      return 'crypto';
    }
    if (/^[A-Z]{1,5}$/.test(symbol)) {
      return 'stock';
    }
    if (symbol.includes('FX') || symbol.includes('/')) {
      return 'forex';
    }
    return 'other';
  }

  private formatDuration(days: number): string {
    if (days < 1) return '< 1 day';
    if (days < 30) return `${Math.round(days)} days`;
    if (days < 365) return `${Math.round(days / 30)} months`;
    const years = Math.floor(days / 365);
    const remainingMonths = Math.round((days % 365) / 30);
    if (remainingMonths === 0) return `${years} year${years > 1 ? 's' : ''}`;
    return `${years} year${years > 1 ? 's' : ''} ${remainingMonths} months`;
  }

  private getEmptyReturnMetrics(): ReturnMetrics {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      cumulativeReturns: [],
      monthlyReturns: new Map(),
      winRate: 0,
      profitLossRatio: 0,
      avgWin: 0,
      avgLoss: 0,
    };
  }

  private getEmptyRiskMetrics(): RiskMetrics {
    return {
      maxDrawdown: 0,
      maxDrawdownDuration: 0,
      volatility: 0,
      downsideRisk: 0,
      var95: 0,
      cvar: 0,
    };
  }

  private getEmptyRiskAdjustedMetrics(): RiskAdjustedMetrics {
    return {
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
    };
  }

  private getEmptyTradingMetrics(): TradingMetrics {
    return {
      totalTrades: 0,
      avgHoldingTime: 0,
      maxConsecutiveWins: 0,
      maxConsecutiveLosses: 0,
      tradingFrequency: 0,
      turnoverRate: 0,
      avgTradeSize: 0,
      largestWin: 0,
      largestLoss: 0,
    };
  }
}

// Singleton instance
export const performanceAnalyticsService = new PerformanceAnalyticsService();

export default PerformanceAnalyticsService;