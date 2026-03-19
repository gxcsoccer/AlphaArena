/**
 * Strategy Comparator
 *
 * @module backtest-analysis/StrategyComparator
 * @description Compare multiple strategy backtest results
 */

import { BacktestEngine } from '../backtest/BacktestEngine';
import { BacktestConfig } from '../backtest/types';
import {
  StrategyComparisonOptions,
  StrategyComparisonResult,
  ComparisonReport,
  ComparisonRanking,
  EquityCurvePoint,
  MonthlyPerformance,
  RiskMetrics,
} from './types';
import { BacktestAnalyzer } from './BacktestAnalyzer';

/**
 * StrategyComparator
 * Compares multiple strategy backtest results
 */
export class StrategyComparator {
  /**
   * Compare multiple strategies
   */
  async compare(options: StrategyComparisonOptions): Promise<ComparisonReport> {
    const results: StrategyComparisonResult[] = [];
    const equityCurves: { strategyName: string; data: EquityCurvePoint[] }[] = [];

    // Run backtest for each strategy
    for (const strategy of options.strategies) {
      const config: BacktestConfig = {
        capital: options.backtestConfig.capital,
        symbol: options.backtestConfig.symbol,
        startTime: options.backtestConfig.startTime,
        endTime: options.backtestConfig.endTime,
        strategy: strategy.type,
        strategyParams: strategy.params,
        tickInterval: options.backtestConfig.tickInterval,
      };

      const engine = new BacktestEngine(config);
      const backtestResult = engine.run();

      // Generate deep analysis
      const analyzer = new BacktestAnalyzer(backtestResult);
      const report = analyzer.generateReport();

      // Store equity curve for comparison charts
      equityCurves.push({
        strategyName: strategy.name,
        data: report.equityCurve,
      });

      // Build result
      results.push({
        strategyName: strategy.name,
        parameters: strategy.params || {},
        stats: backtestResult.stats,
        riskMetrics: report.riskMetrics,
        tradeSummary: {
          totalTrades: backtestResult.stats.totalTrades,
          winners: backtestResult.stats.winningTrades,
          losers: backtestResult.stats.losingTrades,
          avgWin: backtestResult.stats.avgWin,
          avgLoss: backtestResult.stats.avgLoss,
          profitFactor: backtestResult.stats.profitFactor,
          expectancy: this.calculateExpectancy(backtestResult.stats),
        },
        drawdownAnalysis: {
          maxDrawdown: report.drawdownAnalysis.maxDrawdown,
          maxDrawdownDuration: report.drawdownAnalysis.maxDrawdownDuration,
          recoveryFactor: report.drawdownAnalysis.recoveryFactor,
        },
        returnAnalysis: {
          totalReturn: backtestResult.stats.totalReturn,
          annualizedReturn: backtestResult.stats.annualizedReturn,
          monthlyReturns: report.monthlyPerformance,
        },
        executionMetrics: {
          duration: backtestResult.duration,
          tradesPerSecond: backtestResult.duration > 0 
            ? backtestResult.stats.totalTrades / (backtestResult.duration / 1000) 
            : 0,
        },
      });
    }

    // Generate rankings
    const rankings = this.generateRankings(results);

    // Generate summary
    const summary = this.generateSummary(results);

    // Generate comparison charts data
    const comparisonCharts = {
      equityCurves,
      drawdownComparison: results.map(r => ({
        strategyName: r.strategyName,
        maxDrawdown: r.drawdownAnalysis.maxDrawdown,
      })),
      returnDistribution: results.map(r => ({
        strategyName: r.strategyName,
        returns: r.returnAnalysis.monthlyReturns.map(m => m.returnPercent),
      })),
    };

    return {
      generatedAt: Date.now(),
      config: options,
      results,
      rankings,
      summary,
      comparisonCharts,
    };
  }

  /**
   * Calculate expectancy
   */
  private calculateExpectancy(stats: { winRate: number; avgWin: number; avgLoss: number }): number {
    const winProbability = stats.winRate / 100;
    const lossProbability = 1 - winProbability;
    return winProbability * stats.avgWin - lossProbability * stats.avgLoss;
  }

  /**
   * Generate rankings for each metric
   */
  private generateRankings(results: StrategyComparisonResult[]): ComparisonRanking[] {
    const metrics = [
      { key: 'totalReturn', label: '总回报率', higherIsBetter: true },
      { key: 'sharpeRatio', label: '夏普比率', higherIsBetter: true },
      { key: 'maxDrawdown', label: '最大回撤', higherIsBetter: false },
      { key: 'profitFactor', label: '盈亏比', higherIsBetter: true },
      { key: 'winRate', label: '胜率', higherIsBetter: true },
      { key: 'recoveryFactor', label: '恢复因子', higherIsBetter: true },
    ];

    const rankings: ComparisonRanking[] = [];

    for (const metric of metrics) {
      const values = results.map(r => ({
        strategyName: r.strategyName,
        value: this.getMetricValue(r, metric.key),
      }));

      // Sort based on whether higher is better
      values.sort((a, b) => 
        metric.higherIsBetter ? b.value - a.value : a.value - b.value
      );

      // Assign ranks
      const rankingsWithRank = values.map((v, index) => ({
        ...v,
        rank: index + 1,
      }));

      rankings.push({
        metric: metric.label,
        rankings: rankingsWithRank,
      });
    }

    // Overall ranking (composite score)
    const overallScores = results.map(r => ({
      strategyName: r.strategyName,
      value: this.calculateOverallScore(r),
    }));

    overallScores.sort((a, b) => b.value - a.value);

    rankings.push({
      metric: '综合评分',
      rankings: overallScores.map((v, index) => ({
        ...v,
        rank: index + 1,
      })),
    });

    return rankings;
  }

  /**
   * Get metric value from result
   */
  private getMetricValue(result: StrategyComparisonResult, key: string): number {
    switch (key) {
      case 'totalReturn':
        return result.stats.totalReturn;
      case 'sharpeRatio':
        return result.riskMetrics.sharpeRatio;
      case 'maxDrawdown':
        return result.stats.maxDrawdown;
      case 'profitFactor':
        return result.stats.profitFactor;
      case 'winRate':
        return result.stats.winRate;
      case 'recoveryFactor':
        return result.drawdownAnalysis.recoveryFactor;
      default:
        return 0;
    }
  }

  /**
   * Calculate overall score for ranking
   */
  private calculateOverallScore(result: StrategyComparisonResult): number {
    // Weighted score
    const returnScore = Math.max(0, Math.min(100, result.stats.totalReturn + 50)) * 0.3;
    const sharpeScore = Math.max(0, Math.min(100, result.riskMetrics.sharpeRatio * 30)) * 0.25;
    const drawdownScore = Math.max(0, 100 - result.stats.maxDrawdown) * 0.2;
    const profitFactorScore = Math.max(0, Math.min(100, result.stats.profitFactor * 25)) * 0.15;
    const winRateScore = result.stats.winRate * 0.1;

    return returnScore + sharpeScore + drawdownScore + profitFactorScore + winRateScore;
  }

  /**
   * Generate summary with best strategies
   */
  private generateSummary(results: StrategyComparisonResult[]): ComparisonReport['summary'] {
    if (results.length === 0) {
      return {
        bestOverall: '',
        bestReturn: '',
        lowestRisk: '',
        highestSharpe: '',
        mostConsistent: '',
      };
    }

    // Best overall (highest composite score)
    const sortedByOverall = [...results].sort(
      (a, b) => this.calculateOverallScore(b) - this.calculateOverallScore(a)
    );

    // Best return
    const sortedByReturn = [...results].sort(
      (a, b) => b.stats.totalReturn - a.stats.totalReturn
    );

    // Lowest risk (lowest max drawdown)
    const sortedByRisk = [...results].sort(
      (a, b) => a.stats.maxDrawdown - b.stats.maxDrawdown
    );

    // Highest Sharpe
    const sortedBySharpe = [...results].sort(
      (a, b) => b.riskMetrics.sharpeRatio - a.riskMetrics.sharpeRatio
    );

    // Most consistent (highest win rate with decent trades)
    const sortedByConsistency = [...results]
      .filter(r => r.stats.totalTrades >= 10)
      .sort((a, b) => b.stats.winRate - a.stats.winRate);

    return {
      bestOverall: sortedByOverall[0]?.strategyName || '',
      bestReturn: sortedByReturn[0]?.strategyName || '',
      lowestRisk: sortedByRisk[0]?.strategyName || '',
      highestSharpe: sortedBySharpe[0]?.strategyName || '',
      mostConsistent: sortedByConsistency[0]?.strategyName || '',
    };
  }

  /**
   * Generate comparison table data
   */
  generateComparisonTable(results: StrategyComparisonResult[]): {
    headers: string[];
    rows: string[][];
  } {
    const headers = [
      '策略名称',
      '总回报率',
      '年化回报',
      '夏普比率',
      '最大回撤',
      '总交易数',
      '胜率',
      '盈亏比',
      '恢复因子',
    ];

    const rows = results.map(r => [
      r.strategyName,
      `${r.stats.totalReturn.toFixed(2)}%`,
      `${r.stats.annualizedReturn.toFixed(2)}%`,
      r.riskMetrics.sharpeRatio.toFixed(2),
      `${r.stats.maxDrawdown.toFixed(2)}%`,
      r.stats.totalTrades.toString(),
      `${r.stats.winRate.toFixed(1)}%`,
      r.stats.profitFactor.toFixed(2),
      r.drawdownAnalysis.recoveryFactor.toFixed(2),
    ]);

    return { headers, rows };
  }

  /**
   * Generate pairwise comparison
   */
  generatePairwiseComparison(
    result1: StrategyComparisonResult,
    result2: StrategyComparisonResult
  ): {
    metric: string;
    strategy1: { name: string; value: number };
    strategy2: { name: string; value: number };
    winner: string;
    difference: number;
  }[] {
    const metrics = [
      { name: '总回报率', key1: 'totalReturn', key2: 'totalReturn', higherIsBetter: true },
      { name: '夏普比率', key1: 'sharpeRatio', key2: 'sharpeRatio', higherIsBetter: true },
      { name: '最大回撤', key1: 'maxDrawdown', key2: 'maxDrawdown', higherIsBetter: false },
      { name: '胜率', key1: 'winRate', key2: 'winRate', higherIsBetter: true },
      { name: '盈亏比', key1: 'profitFactor', key2: 'profitFactor', higherIsBetter: true },
    ];

    return metrics.map(m => {
      const value1 = this.getMetricValue(result1, m.key1);
      const value2 = this.getMetricValue(result2, m.key2);

      const winner = m.higherIsBetter
        ? value1 > value2 ? result1.strategyName : result2.strategyName
        : value1 < value2 ? result1.strategyName : result2.strategyName;

      return {
        metric: m.name,
        strategy1: { name: result1.strategyName, value: value1 },
        strategy2: { name: result2.strategyName, value: value2 },
        winner,
        difference: Math.abs(value1 - value2),
      };
    });
  }
}