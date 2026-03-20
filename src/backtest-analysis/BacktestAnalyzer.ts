/**
 * Backtest Analyzer
 *
 * @module backtest-analysis/BacktestAnalyzer
 * @description Core analyzer for deep backtest analysis
 */

import {
  BacktestResult,
  TradeAnalysis,
  EquityCurvePoint,
  DrawdownAnalysis,
  DrawdownPeriod,
  PositionAnalysis,
  MonthlyPerformance,
  RiskMetrics,
  TradeDistribution,
  SizeBucket,
  DurationBucket,
  PnLBucket,
  DeepAnalysisReport,
  PerformanceScorecard,
} from './types';
import { BacktestStats } from '../backtest/types';
import { PortfolioSnapshot } from '../portfolio/types';

/**
 * BacktestAnalyzer
 * Performs comprehensive analysis on backtest results
 */
export class BacktestAnalyzer {
  private result: BacktestResult;

  constructor(result: BacktestResult) {
    this.result = result;
  }

  /**
   * Generate complete deep analysis report
   */
  generateReport(): DeepAnalysisReport {
    const tradeAnalysis = this.analyzeTrades();
    const equityCurve = this.generateEquityCurve();
    const drawdownAnalysis = this.analyzeDrawdowns(equityCurve);
    const positionAnalysis = this.analyzePositions();
    const monthlyPerformance = this.analyzeMonthlyPerformance();
    const tradeDistribution = this.analyzeTradeDistribution();
    const riskMetrics = this.calculateRiskMetrics(equityCurve);
    const performanceScorecard = this.calculatePerformanceScorecard(
      this.result.stats,
      riskMetrics,
      tradeAnalysis
    );
    const recommendations = this.generateRecommendations(
      this.result.stats,
      riskMetrics,
      tradeAnalysis,
      drawdownAnalysis
    );

    return {
      generatedAt: Date.now(),
      config: {
        symbol: this.result.config.symbol,
        strategy: this.result.config.strategy,
        strategyParams: this.result.config.strategyParams,
        initialCapital: this.result.config.capital,
        startTime: this.result.config.startTime,
        endTime: this.result.config.endTime,
        duration: this.result.duration,
      },
      basicStats: this.result.stats,
      riskMetrics,
      tradeAnalysis,
      equityCurve,
      drawdownAnalysis,
      positionAnalysis,
      monthlyPerformance,
      tradeDistribution,
      performanceScorecard,
      recommendations,
    };
  }

  /**
   * Analyze individual trades
   */
  private analyzeTrades(): TradeAnalysis[] {
    const trades = this.result.trades;
    if (!trades || trades.length === 0) {
      return [];
    }

    const analysis: TradeAnalysis[] = [];
    const positions = new Map<string, { entryPrice: number; quantity: number; entryTime: number }>();

    // Sort trades by timestamp
    const sortedTrades = [...trades].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    for (const trade of sortedTrades) {
      const symbol = trade.symbol || this.result.config.symbol;
      const side = trade.side?.toLowerCase() || 'buy';
      const price = trade.price;
      const quantity = trade.quantity;
      const timestamp = trade.timestamp;

      if (side === 'buy') {
        // Opening or adding to position
        const existing = positions.get(symbol);
        if (existing) {
          // Average in
          const totalQuantity = existing.quantity + quantity;
          const avgPrice = (existing.entryPrice * existing.quantity + price * quantity) / totalQuantity;
          positions.set(symbol, { entryPrice: avgPrice, quantity: totalQuantity, entryTime: existing.entryTime });
        } else {
          positions.set(symbol, { entryPrice: price, quantity, entryTime: timestamp });
        }
      } else if (side === 'sell') {
        // Closing position
        const existing = positions.get(symbol);
        if (existing) {
          const pnl = (price - existing.entryPrice) * Math.min(quantity, existing.quantity);
          const pnlPercent = ((price - existing.entryPrice) / existing.entryPrice) * 100;
          const duration = timestamp - existing.entryTime;

          analysis.push({
            id: trade.id || `trade-${timestamp}`,
            entryTime: existing.entryTime,
            exitTime: timestamp,
            side: 'long',
            entryPrice: existing.entryPrice,
            exitPrice: price,
            quantity: Math.min(quantity, existing.quantity),
            pnl,
            pnlPercent,
            duration,
            mfe: this.calculateMFE(existing.entryPrice, price, this.result.snapshots, existing.entryTime, timestamp),
            mae: this.calculateMAE(existing.entryPrice, price, this.result.snapshots, existing.entryTime, timestamp),
            riskRewardRatio: pnlPercent > 0 ? pnlPercent / Math.abs(this.calculateMAE(existing.entryPrice, price, this.result.snapshots, existing.entryTime, timestamp) || 1) : 0,
            holdingReturn: pnlPercent,
            isWinner: pnl > 0,
            exitReason: 'signal',
          });

          // Update or remove position
          if (quantity >= existing.quantity) {
            positions.delete(symbol);
          } else {
            positions.set(symbol, { ...existing, quantity: existing.quantity - quantity });
          }
        }
      }
    }

    return analysis;
  }

  /**
   * Calculate Maximum Favorable Excursion
   */
  private calculateMFE(
    entryPrice: number,
    exitPrice: number,
    _snapshots: PortfolioSnapshot[],
    _entryTime: number,
    _exitTime: number
  ): number {
    // Simplified - would need price data to calculate accurately
    const favorable = exitPrice > entryPrice;
    if (favorable) {
      return ((exitPrice - entryPrice) / entryPrice) * 100;
    }
    return 0;
  }

  /**
   * Calculate Maximum Adverse Excursion
   */
  private calculateMAE(
    entryPrice: number,
    exitPrice: number,
    _snapshots: PortfolioSnapshot[],
    _entryTime: number,
    _exitTime: number
  ): number {
    // Simplified - would need price data to calculate accurately
    const adverse = exitPrice < entryPrice;
    if (adverse) {
      return ((entryPrice - exitPrice) / entryPrice) * 100;
    }
    return 0;
  }

  /**
   * Generate equity curve with detailed metrics
   */
  private generateEquityCurve(): EquityCurvePoint[] {
    const snapshots = this.result.snapshots;
    if (!snapshots || snapshots.length === 0) {
      return [];
    }

    const equityCurve: EquityCurvePoint[] = [];
    const initialCapital = this.result.config.capital;
    let peak = initialCapital;

    for (let i = 0; i < snapshots.length; i++) {
      const snapshot = snapshots[i];
      const value = snapshot.totalValue;
      const cash = snapshot.cash;
      const positionValue = value - cash;

      // Track peak for drawdown calculation
      if (value > peak) {
        peak = value;
      }

      const drawdown = peak - value;
      const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;
      const cumulativeReturn = initialCapital > 0 ? ((value - initialCapital) / initialCapital) * 100 : 0;

      // Calculate daily return
      let dailyReturn = 0;
      if (i > 0) {
        const prevValue = snapshots[i - 1].totalValue;
        dailyReturn = prevValue > 0 ? ((value - prevValue) / prevValue) * 100 : 0;
      }

      equityCurve.push({
        timestamp: snapshot.timestamp,
        value,
        cash,
        positionValue,
        drawdown,
        drawdownPercent,
        dailyReturn,
        cumulativeReturn,
      });
    }

    return equityCurve;
  }

  /**
   * Analyze drawdowns in detail
   */
  private analyzeDrawdowns(equityCurve: EquityCurvePoint[]): DrawdownAnalysis {
    if (equityCurve.length === 0) {
      return {
        maxDrawdown: 0,
        maxDrawdownDuration: 0,
        avgDrawdown: 0,
        drawdownPeriods: [],
        recoveryFactor: 0,
        timeUnderwater: 0,
      };
    }

    const drawdownPeriods: DrawdownPeriod[] = [];
    let maxDrawdown = 0;
    let maxDrawdownDuration = 0;
    let totalDrawdown = 0;
    let underwaterCount = 0;
    let peak = equityCurve[0].value;
    let peakTime = equityCurve[0].timestamp;
    let inDrawdown = false;
    let drawdownStart = 0;
    let troughValue = peak;
    let troughTime = peakTime;

    for (const point of equityCurve) {
      if (point.value > peak) {
        // New peak - end drawdown if in one
        if (inDrawdown) {
          const drawdownPercent = ((peak - troughValue) / peak) * 100;
          const duration = troughTime - drawdownStart;
          const recoveryDuration = point.timestamp - troughTime;

          drawdownPeriods.push({
            startTimestamp: drawdownStart,
            troughTimestamp: troughTime,
            endTimestamp: point.timestamp,
            peakValue: peak,
            troughValue,
            drawdownPercent,
            duration,
            recoveryDuration,
          });

          if (drawdownPercent > maxDrawdown) {
            maxDrawdown = drawdownPercent;
            maxDrawdownDuration = duration + (recoveryDuration || 0);
          }

          if (duration > maxDrawdownDuration) {
            maxDrawdownDuration = duration;
          }
        }

        peak = point.value;
        peakTime = point.timestamp;
        troughValue = peak;
        troughTime = peakTime;
        inDrawdown = false;
      } else {
        // In drawdown
        if (!inDrawdown) {
          inDrawdown = true;
          drawdownStart = peakTime;
        }

        if (point.value < troughValue) {
          troughValue = point.value;
          troughTime = point.timestamp;
        }

        totalDrawdown += point.drawdownPercent;
        underwaterCount++;
      }
    }

    // Handle ongoing drawdown
    if (inDrawdown) {
      const drawdownPercent = ((peak - troughValue) / peak) * 100;
      drawdownPeriods.push({
        startTimestamp: drawdownStart,
        troughTimestamp: troughTime,
        endTimestamp: null,
        peakValue: peak,
        troughValue,
        drawdownPercent,
        duration: troughTime - drawdownStart,
        recoveryDuration: null,
      });

      if (drawdownPercent > maxDrawdown) {
        maxDrawdown = drawdownPercent;
      }
    }

    const avgDrawdown = underwaterCount > 0 ? totalDrawdown / underwaterCount : 0;
    const timeUnderwater = equityCurve.length > 0 ? (underwaterCount / equityCurve.length) * 100 : 0;
    const totalReturn = this.result.stats.totalReturn;
    const recoveryFactor = maxDrawdown > 0 ? Math.abs(totalReturn / maxDrawdown) : 0;

    return {
      maxDrawdown,
      maxDrawdownDuration,
      avgDrawdown,
      drawdownPeriods,
      recoveryFactor,
      timeUnderwater,
    };
  }

  /**
   * Analyze positions by symbol
   */
  private analyzePositions(): PositionAnalysis[] {
    const trades = this.result.trades;
    if (!trades || trades.length === 0) {
      return [];
    }

    const symbolStats = new Map<string, {
      totalTrades: number;
      winners: number;
      losers: number;
      totalPnL: number;
      maxPositionSize: number;
      totalPositionSize: number;
      longTrades: number;
      shortTrades: number;
      longWinners: number;
      shortWinners: number;
    }>();

    for (const trade of trades) {
      const symbol = trade.symbol || this.result.config.symbol;
      const stats = symbolStats.get(symbol) || {
        totalTrades: 0,
        winners: 0,
        losers: 0,
        totalPnL: 0,
        maxPositionSize: 0,
        totalPositionSize: 0,
        longTrades: 0,
        shortTrades: 0,
        longWinners: 0,
        shortWinners: 0,
      };

      stats.totalTrades++;
      stats.totalPnL += trade.realizedPnL || 0;

      if ((trade.realizedPnL || 0) > 0) {
        stats.winners++;
      } else if ((trade.realizedPnL || 0) < 0) {
        stats.losers++;
      }

      const side = trade.side?.toLowerCase() || 'buy';
      if (side === 'buy') {
        stats.longTrades++;
        if ((trade.realizedPnL || 0) > 0) {
          stats.longWinners++;
        }
      } else {
        stats.shortTrades++;
        if ((trade.realizedPnL || 0) > 0) {
          stats.shortWinners++;
        }
      }

      stats.totalPositionSize += trade.quantity || 0;
      stats.maxPositionSize = Math.max(stats.maxPositionSize, trade.quantity || 0);

      symbolStats.set(symbol, stats);
    }

    const analysis: PositionAnalysis[] = [];

    for (const [symbol, stats] of symbolStats) {
      analysis.push({
        symbol,
        totalTrades: stats.totalTrades,
        winningTrades: stats.winners,
        losingTrades: stats.losers,
        winRate: stats.totalTrades > 0 ? (stats.winners / stats.totalTrades) * 100 : 0,
        totalPnL: stats.totalPnL,
        avgPnL: stats.totalTrades > 0 ? stats.totalPnL / stats.totalTrades : 0,
        maxPositionSize: stats.maxPositionSize,
        avgPositionSize: stats.totalTrades > 0 ? stats.totalPositionSize / stats.totalTrades : 0,
        longTrades: stats.longTrades,
        shortTrades: stats.shortTrades,
        longWinRate: stats.longTrades > 0 ? (stats.longWinners / stats.longTrades) * 100 : 0,
        shortWinRate: stats.shortTrades > 0 ? (stats.shortWinners / stats.shortTrades) * 100 : 0,
      });
    }

    return analysis;
  }

  /**
   * Analyze monthly performance
   */
  private analyzeMonthlyPerformance(): MonthlyPerformance[] {
    const snapshots = this.result.snapshots;
    if (!snapshots || snapshots.length === 0) {
      return [];
    }

    const monthlyData = new Map<string, {
      year: number;
      month: number;
      startCapital: number;
      endCapital: number;
      startTimestamp: number;
      trades: number;
      totalPnL: number;
      winners: number;
      losers: number;
      maxDrawdown: number;
      snapshots: PortfolioSnapshot[];
    }>();

    // Group snapshots by month
    for (const snapshot of snapshots) {
      const date = new Date(snapshot.timestamp);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;

      const data = monthlyData.get(key) || {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        startCapital: snapshot.totalValue,
        endCapital: snapshot.totalValue,
        startTimestamp: snapshot.timestamp,
        trades: 0,
        totalPnL: 0,
        winners: 0,
        losers: 0,
        maxDrawdown: 0,
        snapshots: [],
      };

      data.endCapital = snapshot.totalValue;
      data.snapshots.push(snapshot);
      monthlyData.set(key, data);
    }

    // Add trade data to months
    for (const trade of this.result.trades) {
      if (!trade.timestamp) continue;
      const date = new Date(trade.timestamp);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      const data = monthlyData.get(key);
      if (data) {
        data.trades++;
        data.totalPnL += trade.realizedPnL || 0;
        if ((trade.realizedPnL || 0) > 0) {
          data.winners++;
        } else if ((trade.realizedPnL || 0) < 0) {
          data.losers++;
        }
      }
    }

    // Calculate monthly metrics
    const performance: MonthlyPerformance[] = [];
    let peak = 0;

    for (const [, data] of monthlyData) {
      const returnPercent = data.startCapital > 0 
        ? ((data.endCapital - data.startCapital) / data.startCapital) * 100 
        : 0;
      
      // Calculate max drawdown for the month
      let monthMaxDD = 0;
      peak = data.snapshots[0]?.totalValue || 0;
      for (const snap of data.snapshots) {
        if (snap.totalValue > peak) {
          peak = snap.totalValue;
        }
        const dd = peak > 0 ? ((peak - snap.totalValue) / peak) * 100 : 0;
        monthMaxDD = Math.max(monthMaxDD, dd);
      }

      performance.push({
        year: data.year,
        month: data.month,
        returnPercent,
        trades: data.trades,
        winRate: data.trades > 0 ? (data.winners / data.trades) * 100 : 0,
        maxDrawdown: monthMaxDD,
        totalPnL: data.totalPnL,
        startCapital: data.startCapital,
        endCapital: data.endCapital,
      });
    }

    // Sort by year and month
    return performance.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  }

  /**
   * Analyze trade distribution
   */
  private analyzeTradeDistribution(): TradeDistribution {
    const trades = this.result.trades;
    const byHour = new Array(24).fill(0);
    const byDayOfWeek = new Array(7).fill(0);
    const byMonth = new Array(12).fill(0);

    // Size buckets
    const sizeBuckets: SizeBucket[] = [
      { label: '0-10', min: 0, max: 10, count: 0, winRate: 0, avgPnL: 0 },
      { label: '10-50', min: 10, max: 50, count: 0, winRate: 0, avgPnL: 0 },
      { label: '50-100', min: 50, max: 100, count: 0, winRate: 0, avgPnL: 0 },
      { label: '100-500', min: 100, max: 500, count: 0, winRate: 0, avgPnL: 0 },
      { label: '500+', min: 500, max: Infinity, count: 0, winRate: 0, avgPnL: 0 },
    ];

    // Duration buckets (in milliseconds)
    const durationBuckets: DurationBucket[] = [
      { label: '<1min', minMs: 0, maxMs: 60000, count: 0, winRate: 0, avgPnL: 0 },
      { label: '1-5min', minMs: 60000, maxMs: 300000, count: 0, winRate: 0, avgPnL: 0 },
      { label: '5-15min', minMs: 300000, maxMs: 900000, count: 0, winRate: 0, avgPnL: 0 },
      { label: '15-60min', minMs: 900000, maxMs: 3600000, count: 0, winRate: 0, avgPnL: 0 },
      { label: '1-4h', minMs: 3600000, maxMs: 14400000, count: 0, winRate: 0, avgPnL: 0 },
      { label: '>4h', minMs: 14400000, maxMs: Infinity, count: 0, winRate: 0, avgPnL: 0 },
    ];

    // P&L buckets
    const pnlBuckets: PnLBucket[] = [
      { label: 'Large Loss (<-10%)', min: -Infinity, max: -10, count: 0 },
      { label: 'Moderate Loss (-10% to -5%)', min: -10, max: -5, count: 0 },
      { label: 'Small Loss (-5% to 0%)', min: -5, max: 0, count: 0 },
      { label: 'Small Win (0% to 5%)', min: 0, max: 5, count: 0 },
      { label: 'Moderate Win (5% to 10%)', min: 5, max: 10, count: 0 },
      { label: 'Large Win (>10%)', min: 10, max: Infinity, count: 0 },
    ];

    if (!trades || trades.length === 0) {
      return { byHour, byDayOfWeek, byMonth, bySize: sizeBuckets, byDuration: durationBuckets, byPnL: pnlBuckets };
    }

    // Process trades
    for (const trade of trades) {
      if (trade.timestamp) {
        const date = new Date(trade.timestamp);
        byHour[date.getHours()]++;
        byDayOfWeek[date.getDay()]++;
        byMonth[date.getMonth()]++;
      }

      const quantity = trade.quantity || 0;
      const pnl = trade.realizedPnL || 0;
      const pnlPercent = trade.price ? (pnl / trade.price) * 100 : 0;

      // Size bucket
      for (const bucket of sizeBuckets) {
        if (quantity >= bucket.min && quantity < bucket.max) {
          bucket.count++;
          break;
        }
      }

      // Duration bucket (using trade duration if available)
      const duration = trade.duration || 0;
      for (const bucket of durationBuckets) {
        if (duration >= bucket.minMs && duration < bucket.maxMs) {
          bucket.count++;
          break;
        }
      }

      // P&L bucket (using percentage)
      for (const bucket of pnlBuckets) {
        if (pnlPercent >= bucket.min && pnlPercent < bucket.max) {
          bucket.count++;
          break;
        }
      }
    }

    return { byHour, byDayOfWeek, byMonth, bySize: sizeBuckets, byDuration: durationBuckets, byPnL: pnlBuckets };
  }

  /**
   * Calculate advanced risk metrics
   */
  private calculateRiskMetrics(equityCurve: EquityCurvePoint[]): RiskMetrics {
    if (equityCurve.length < 2) {
      return {
        sharpeRatio: 0,
        sortinoRatio: 0,
        calmarRatio: 0,
        volatility: 0,
        downsideDeviation: 0,
        var95: 0,
        cvar95: 0,
        maxConsecutiveLosses: 0,
        maxConsecutiveWins: 0,
        avgLeverage: 1,
        maxLeverage: 1,
      };
    }

    // Calculate returns
    const returns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const prevValue = equityCurve[i - 1].value;
      const currValue = equityCurve[i].value;
      if (prevValue > 0) {
        returns.push((currValue - prevValue) / prevValue);
      }
    }

    if (returns.length === 0) {
      return {
        sharpeRatio: 0,
        sortinoRatio: 0,
        calmarRatio: 0,
        volatility: 0,
        downsideDeviation: 0,
        var95: 0,
        cvar95: 0,
        maxConsecutiveLosses: 0,
        maxConsecutiveWins: 0,
        avgLeverage: 1,
        maxLeverage: 1,
      };
    }

    // Mean return
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

    // Standard deviation
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Downside deviation (negative returns only)
    const negativeReturns = returns.filter(r => r < 0);
    const downsideVariance = negativeReturns.length > 0
      ? negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length
      : 0;
    const downsideDeviation = Math.sqrt(downsideVariance);

    // Annualized metrics (assuming daily returns)
    const annualizedReturn = meanReturn * 252;
    const annualizedStdDev = stdDev * Math.sqrt(252);
    const riskFreeRate = 0.02; // 2% annual risk-free rate

    // Sharpe ratio
    const sharpeRatio = annualizedStdDev > 0 
      ? (annualizedReturn - riskFreeRate) / annualizedStdDev 
      : 0;

    // Sortino ratio
    const annualizedDownsideDev = downsideDeviation * Math.sqrt(252);
    const sortinoRatio = annualizedDownsideDev > 0 
      ? (annualizedReturn - riskFreeRate) / annualizedDownsideDev 
      : 0;

    // Calmar ratio
    const maxDrawdown = this.result.stats.maxDrawdown;
    const calmarRatio = maxDrawdown > 0 
      ? this.result.stats.annualizedReturn / maxDrawdown 
      : 0;

    // VaR (95%) - using historical simulation
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const var95Index = Math.floor(returns.length * 0.05);
    const var95 = sortedReturns[var95Index] || 0;

    // CVaR (Expected Shortfall)
    const tailReturns = sortedReturns.slice(0, var95Index + 1);
    const cvar95 = tailReturns.length > 0 
      ? tailReturns.reduce((a, b) => a + b, 0) / tailReturns.length 
      : 0;

    // Consecutive wins/losses
    let consecutiveWins = 0;
    let consecutiveLosses = 0;
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;

    for (const r of returns) {
      if (r > 0) {
        consecutiveWins++;
        consecutiveLosses = 0;
        maxConsecutiveWins = Math.max(maxConsecutiveWins, consecutiveWins);
      } else if (r < 0) {
        consecutiveLosses++;
        consecutiveWins = 0;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses);
      }
    }

    return {
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      volatility: annualizedStdDev,
      downsideDeviation: annualizedDownsideDev,
      var95,
      cvar95,
      maxConsecutiveLosses,
      maxConsecutiveWins,
      avgLeverage: 1, // Would need position tracking to calculate
      maxLeverage: 1,
    };
  }

  /**
   * Calculate performance scorecard
   */
  private calculatePerformanceScorecard(
    stats: BacktestStats,
    riskMetrics: RiskMetrics,
    tradeAnalysis: TradeAnalysis[]
  ): PerformanceScorecard {
    // Score each category (0-100)
    const profitabilityScore = this.scoreProfitability(stats);
    const riskScore = this.scoreRisk(stats, riskMetrics);
    const consistencyScore = this.scoreConsistency(tradeAnalysis, stats, riskMetrics);
    const efficiencyScore = this.scoreEfficiency(stats, riskMetrics);

    // Weighted overall score
    const weights = {
      profitability: 0.35,
      risk: 0.30,
      consistency: 0.20,
      efficiency: 0.15,
    };

    const overallScore = 
      profitabilityScore * weights.profitability +
      riskScore * weights.risk +
      consistencyScore * weights.consistency +
      efficiencyScore * weights.efficiency;

    return {
      overallScore: Math.round(overallScore * 10) / 10,
      profitabilityScore: Math.round(profitabilityScore * 10) / 10,
      riskScore: Math.round(riskScore * 10) / 10,
      consistencyScore: Math.round(consistencyScore * 10) / 10,
      efficiencyScore: Math.round(efficiencyScore * 10) / 10,
      breakdown: [
        { category: '盈利能力', score: profitabilityScore, weight: weights.profitability, description: '回报率和利润因子表现' },
        { category: '风险管理', score: riskScore, weight: weights.risk, description: '最大回撤和波动性控制' },
        { category: '一致性', score: consistencyScore, weight: weights.consistency, description: '胜率和交易稳定性' },
        { category: '效率', score: efficiencyScore, weight: weights.efficiency, description: '夏普比率和资金利用' },
      ],
    };
  }

  /**
   * Score profitability (0-100)
   */
  private scoreProfitability(stats: BacktestStats): number {
    let score = 50;

    // Total return contribution
    if (stats.totalReturn > 50) score += 25;
    else if (stats.totalReturn > 30) score += 20;
    else if (stats.totalReturn > 15) score += 15;
    else if (stats.totalReturn > 5) score += 10;
    else if (stats.totalReturn < -10) score -= 20;

    // Profit factor contribution
    if (stats.profitFactor > 3) score += 25;
    else if (stats.profitFactor > 2) score += 20;
    else if (stats.profitFactor > 1.5) score += 10;
    else if (stats.profitFactor < 1) score -= 25;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Score risk management (0-100)
   */
  private scoreRisk(stats: BacktestStats, riskMetrics: RiskMetrics): number {
    let score = 50;

    // Max drawdown contribution
    if (stats.maxDrawdown < 5) score += 25;
    else if (stats.maxDrawdown < 10) score += 20;
    else if (stats.maxDrawdown < 20) score += 10;
    else if (stats.maxDrawdown < 30) score -= 10;
    else if (stats.maxDrawdown > 50) score -= 25;

    // Sharpe ratio contribution
    if (riskMetrics.sharpeRatio > 2) score += 25;
    else if (riskMetrics.sharpeRatio > 1.5) score += 20;
    else if (riskMetrics.sharpeRatio > 1) score += 10;
    else if (riskMetrics.sharpeRatio < 0.5) score -= 15;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Score consistency (0-100)
   */
  private scoreConsistency(tradeAnalysis: TradeAnalysis[], stats: BacktestStats, riskMetrics: RiskMetrics): number {
    let score = 50;

    // Win rate contribution
    if (stats.winRate > 60) score += 20;
    else if (stats.winRate > 50) score += 15;
    else if (stats.winRate > 45) score += 10;
    else if (stats.winRate < 35) score -= 15;

    // Trade count contribution (need enough trades for statistical significance)
    if (stats.totalTrades >= 100) score += 15;
    else if (stats.totalTrades >= 50) score += 10;
    else if (stats.totalTrades >= 30) score += 5;
    else score -= 10;

    // Consecutive loss control
    if (stats.totalTrades > 0) {
      const maxConsecLossRatio = riskMetrics.maxConsecutiveLosses / stats.totalTrades;
      if (maxConsecLossRatio < 0.05) score += 15;
      else if (maxConsecLossRatio < 0.1) score += 10;
      else if (maxConsecLossRatio > 0.2) score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Score efficiency (0-100)
   */
  private scoreEfficiency(stats: BacktestStats, riskMetrics: RiskMetrics): number {
    let score = 50;

    // Sharpe ratio
    if (riskMetrics.sharpeRatio > 2) score += 25;
    else if (riskMetrics.sharpeRatio > 1.5) score += 20;
    else if (riskMetrics.sharpeRatio > 1) score += 15;
    else if (riskMetrics.sharpeRatio < 0.5) score -= 20;

    // Return per trade
    const returnPerTrade = stats.totalTrades > 0 ? stats.totalReturn / stats.totalTrades : 0;
    if (returnPerTrade > 0.5) score += 15;
    else if (returnPerTrade > 0.2) score += 10;
    else if (returnPerTrade < 0.05) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    stats: BacktestStats,
    riskMetrics: RiskMetrics,
    tradeAnalysis: TradeAnalysis[],
    drawdownAnalysis: DrawdownAnalysis
  ): string[] {
    const recommendations: string[] = [];

    // Profitability recommendations
    if (stats.profitFactor < 1.5) {
      recommendations.push('考虑优化止损策略，提高盈亏比。当前盈亏比较低，建议设置更严格的止损或更宽的止盈。');
    }

    if (stats.winRate < 45 && stats.profitFactor > 1.5) {
      recommendations.push('当前胜率较低但盈亏比尚可，可考虑增加过滤条件减少虚假信号。');
    }

    if (stats.winRate > 55 && stats.profitFactor < 1.5) {
      recommendations.push('胜率较高但单笔盈利较小，建议适当放宽止盈目标或使用追踪止损。');
    }

    // Risk management recommendations
    if (stats.maxDrawdown > 25) {
      recommendations.push(`最大回撤 ${stats.maxDrawdown.toFixed(1)}% 偏高，建议降低仓位或增加风险控制措施。`);
    }

    if (riskMetrics.maxConsecutiveLosses > 5) {
      recommendations.push(`最大连续亏损次数为 ${riskMetrics.maxConsecutiveLosses} 次，建议在连续亏损后降低仓位或暂停交易。`);
    }

    if (riskMetrics.sharpeRatio < 1) {
      recommendations.push('夏普比率偏低，考虑增加市场趋势过滤或减少震荡行情中的交易。');
    }

    // Consistency recommendations
    if (stats.totalTrades < 30) {
      recommendations.push('交易样本数量较少，建议延长回测周期以获得更可靠的统计结果。');
    }

    // Drawdown recommendations
    if (drawdownAnalysis.timeUnderwater > 50) {
      recommendations.push(`资金在水下的时间占比 ${drawdownAnalysis.timeUnderwater.toFixed(1)}% 较高，建议优化入场时机。`);
    }

    if (drawdownAnalysis.recoveryFactor < 2) {
      recommendations.push('恢复因子较低，策略从回撤中恢复的能力不足，建议增加仓位管理策略。');
    }

    // Positive feedback
    if (stats.profitFactor > 2 && stats.sharpeRatio > 1.5 && stats.maxDrawdown < 15) {
      recommendations.push('策略表现优秀，盈利能力、风险控制和稳定性均达到较高水平。');
    }

    if (recommendations.length === 0) {
      recommendations.push('策略整体表现良好，继续监控实盘表现以确保回测结果可复现。');
    }

    return recommendations;
  }
}