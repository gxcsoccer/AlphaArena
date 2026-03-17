/**
 * StrategyComparisonService - 策略性能比较服务
 *
 * 提供多策略并行回测和对比分析功能
 *
 * @module strategy/StrategyComparisonService
 */

import { BacktestEngine } from '../backtest/BacktestEngine';
import { BacktestConfig, BacktestResult, BacktestStats } from '../backtest/types';
import { createLogger } from '../utils/logger';

const log = createLogger('StrategyComparisonService');

/**
 * 策略比较配置
 */
export interface ComparisonConfig {
  /** 初始资金 */
  capital: number;
  /** 交易对 */
  symbol: string;
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime: number;
  /** 策略列表 */
  strategies: ComparisonStrategyConfig[];
  /** tick 间隔（可选） */
  tickInterval?: number;
}

/**
 * 单个策略配置
 */
export interface ComparisonStrategyConfig {
  /** 策略ID */
  id: string;
  /** 策略名称 */
  name: string;
  /** 策略参数 */
  params?: Record<string, any>;
}

/**
 * 策略比较结果
 */
export interface StrategyComparisonResult {
  /** 比较ID */
  id: string;
  /** 配置 */
  config: ComparisonConfig;
  /** 各策略结果 */
  results: StrategyResult[];
  /** 相对表现排名 */
  rankings: StrategyRanking[];
  /** 执行时间 */
  executionTime: number;
  /** 创建时间 */
  createdAt: number;
}

/**
 * 单个策略结果
 */
export interface StrategyResult {
  /** 策略ID */
  strategyId: string;
  /** 策略名称 */
  strategyName: string;
  /** 回测统计 */
  stats: BacktestStats;
  /** 权益曲线 */
  equityCurve: EquityPoint[];
  /** 回撤曲线 */
  drawdownCurve: DrawdownPoint[];
  /** 月度收益 */
  monthlyReturns: MonthlyReturn[];
  /** 相对基准表现 */
  relativePerformance?: RelativePerformance;
}

/**
 * 权益曲线点
 */
export interface EquityPoint {
  timestamp: number;
  equity: number;
  return: number;
}

/**
 * 回撤曲线点
 */
export interface DrawdownPoint {
  timestamp: number;
  drawdown: number;
  duration: number;
}

/**
 * 月度收益
 */
export interface MonthlyReturn {
  year: number;
  month: number;
  return: number;
  trades: number;
}

/**
 * 相对表现
 */
export interface RelativePerformance {
  /** 相对于基准的超额收益 */
  excessReturn: number;
  /** 相对于基准的信息比率 */
  informationRatio: number;
  /** 跟踪误差 */
  trackingError: number;
}

/**
 * 策略排名
 */
export interface StrategyRanking {
  /** 策略ID */
  strategyId: string;
  /** 策略名称 */
  strategyName: string;
  /** 总排名 */
  overallRank: number;
  /** 各维度排名 */
  metricRanks: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
  };
  /** 综合得分 (0-100) */
  compositeScore: number;
}

/**
 * 比较存储
 */
interface ComparisonStorage {
  [id: string]: StrategyComparisonResult;
}

/**
 * 策略比较服务
 */
export class StrategyComparisonService {
  private storage: ComparisonStorage = {};
  private comparisonCounter: number = 0;

  /**
   * 执行策略比较
   */
  async compare(config: ComparisonConfig): Promise<StrategyComparisonResult> {
    const startTime = Date.now();
    const comparisonId = `comparison-${++this.comparisonCounter}-${Date.now()}`;

    log.info(`Starting strategy comparison [${comparisonId}]`, {
      strategies: config.strategies.length,
      symbol: config.symbol,
      capital: config.capital,
    });

    // 验证配置
    this.validateConfig(config);

    // 并行执行所有策略回测
    const results = await Promise.all(
      config.strategies.map((strategy) => this.runStrategyBacktest(config, strategy))
    );

    // 计算相对表现（如果有多个策略）
    if (results.length > 1) {
      this.calculateRelativePerformance(results);
    }

    // 计算排名
    const rankings = this.calculateRankings(results);

    const executionTime = Date.now() - startTime;

    const comparisonResult: StrategyComparisonResult = {
      id: comparisonId,
      config,
      results,
      rankings,
      executionTime,
      createdAt: Date.now(),
    };

    // 存储结果
    this.storage[comparisonId] = comparisonResult;

    log.info(`Strategy comparison completed [${comparisonId}]`, {
      executionTime,
      topStrategy: rankings[0]?.strategyName,
    });

    return comparisonResult;
  }

  /**
   * 获取比较结果
   */
  getComparison(id: string): StrategyComparisonResult | null {
    return this.storage[id] || null;
  }

  /**
   * 获取所有比较结果
   */
  getAllComparisons(): StrategyComparisonResult[] {
    return Object.values(this.storage).sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * 删除比较结果
   */
  deleteComparison(id: string): boolean {
    if (this.storage[id]) {
      delete this.storage[id];
      return true;
    }
    return false;
  }

  /**
   * 清除所有比较结果
   */
  clearAll(): void {
    this.storage = {};
  }

  /**
   * 导出比较结果为 CSV
   */
  exportToCSV(result: StrategyComparisonResult): string {
    const headers = [
      'Strategy',
      'Total Return (%)',
      'Annualized Return (%)',
      'Sharpe Ratio',
      'Max Drawdown (%)',
      'Win Rate (%)',
      'Profit Factor',
      'Total Trades',
      'Avg Win',
      'Avg Loss',
      'Final Capital',
    ];

    let csv = headers.join(',') + '\n';

    for (const r of result.results) {
      const row = [
        r.strategyName,
        r.stats.totalReturn.toFixed(2),
        r.stats.annualizedReturn.toFixed(2),
        r.stats.sharpeRatio.toFixed(2),
        r.stats.maxDrawdown.toFixed(2),
        r.stats.winRate.toFixed(2),
        r.stats.profitFactor.toFixed(2),
        r.stats.totalTrades,
        r.stats.avgWin.toFixed(2),
        r.stats.avgLoss.toFixed(2),
        r.stats.finalCapital.toFixed(2),
      ];
      csv += row.join(',') + '\n';
    }

    return csv;
  }

  /**
   * 导出权益曲线为 CSV
   */
  exportEquityCurvesToCSV(result: StrategyComparisonResult): string {
    // 获取所有时间点
    const allTimestamps = new Set<number>();
    for (const r of result.results) {
      for (const point of r.equityCurve) {
        allTimestamps.add(point.timestamp);
      }
    }

    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

    // 构建表头
    const headers = ['Timestamp', 'Date', ...result.results.map((r) => r.strategyName)];
    let csv = headers.join(',') + '\n';

    // 构建数据行
    for (const ts of sortedTimestamps) {
      const date = new Date(ts).toISOString();
      const row: (string | number)[] = [ts.toString(), date];

      for (const r of result.results) {
        const point = r.equityCurve.find((p) => p.timestamp === ts);
        row.push(point ? point.equity.toFixed(2) : '');
      }

      csv += row.join(',') + '\n';
    }

    return csv;
  }

  /**
   * 验证比较配置
   */
  private validateConfig(config: ComparisonConfig): void {
    if (!config.strategies || config.strategies.length < 2) {
      throw new Error('At least 2 strategies are required for comparison');
    }

    if (config.strategies.length > 5) {
      throw new Error('Maximum 5 strategies can be compared at once');
    }

    if (!config.capital || config.capital < 100) {
      throw new Error('Initial capital must be at least 100');
    }

    if (!config.symbol) {
      throw new Error('Symbol is required');
    }

    if (!config.startTime || !config.endTime) {
      throw new Error('Start time and end time are required');
    }

    if (config.startTime >= config.endTime) {
      throw new Error('Start time must be before end time');
    }

    // 检查策略ID唯一性
    const ids = new Set(config.strategies.map((s) => s.id));
    if (ids.size !== config.strategies.length) {
      throw new Error('Strategy IDs must be unique');
    }
  }

  /**
   * 运行单个策略回测
   */
  private async runStrategyBacktest(
    config: ComparisonConfig,
    strategy: ComparisonStrategyConfig
  ): Promise<StrategyResult> {
    log.info(`Running backtest for strategy: ${strategy.name}`);

    const backtestConfig: BacktestConfig = {
      capital: config.capital,
      symbol: config.symbol,
      startTime: config.startTime,
      endTime: config.endTime,
      strategy: strategy.id,
      strategyParams: strategy.params,
      tickInterval: config.tickInterval,
    };

    const engine = new BacktestEngine(backtestConfig);
    const backtestResult = await engine.run();

    // 提取权益曲线
    const equityCurve = this.extractEquityCurve(backtestResult);

    // 提取回撤曲线
    const drawdownCurve = this.extractDrawdownCurve(backtestResult, equityCurve);

    // 计算月度收益
    const monthlyReturns = this.calculateMonthlyReturns(backtestResult);

    return {
      strategyId: strategy.id,
      strategyName: strategy.name,
      stats: backtestResult.stats,
      equityCurve,
      drawdownCurve,
      monthlyReturns,
    };
  }

  /**
   * 提取权益曲线
   */
  private extractEquityCurve(result: BacktestResult): EquityPoint[] {
    const points: EquityPoint[] = [];
    const initialCapital = result.config.capital;

    for (const snapshot of result.snapshots) {
      points.push({
        timestamp: snapshot.timestamp,
        equity: snapshot.totalValue,
        return: ((snapshot.totalValue - initialCapital) / initialCapital) * 100,
      });
    }

    return points;
  }

  /**
   * 提取回撤曲线
   */
  private extractDrawdownCurve(result: BacktestResult, equityCurve: EquityPoint[]): DrawdownPoint[] {
    const points: DrawdownPoint[] = [];
    let peak = result.config.capital;
    let peakIndex = 0;

    for (let i = 0; i < equityCurve.length; i++) {
      const point = equityCurve[i];
      if (point.equity > peak) {
        peak = point.equity;
        peakIndex = i;
      }

      const drawdown = ((peak - point.equity) / peak) * 100;
      const duration = i - peakIndex;

      points.push({
        timestamp: point.timestamp,
        drawdown,
        duration,
      });
    }

    return points;
  }

  /**
   * 计算月度收益
   */
  private calculateMonthlyReturns(result: BacktestResult): MonthlyReturn[] {
    const monthlyData: Map<string, { returns: number; trades: number }> = new Map();

    // 从交易记录计算月度收益
    for (const trade of result.trades) {
      const date = new Date(trade.timestamp);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;

      const existing = monthlyData.get(key) || { returns: 0, trades: 0 };
      existing.returns += trade.realizedPnL || 0;
      existing.trades += 1;
      monthlyData.set(key, existing);
    }

    // 转换为数组
    const returns: MonthlyReturn[] = [];
    for (const [key, data] of monthlyData) {
      const [year, month] = key.split('-').map(Number);
      returns.push({
        year,
        month,
        return: data.returns,
        trades: data.trades,
      });
    }

    return returns.sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));
  }

  /**
   * 计算相对表现
   */
  private calculateRelativePerformance(results: StrategyResult[]): void {
    // 使用第一个策略作为基准
    const benchmark = results[0];
    const benchmarkReturns = benchmark.equityCurve.map((p) => p.return);

    for (let i = 1; i < results.length; i++) {
      const strategy = results[i];
      const strategyReturns = strategy.equityCurve.map((p) => p.return);

      // 计算超额收益
      const excessReturn = strategy.stats.totalReturn - benchmark.stats.totalReturn;

      // 计算跟踪误差
      const trackingError = this.calculateTrackingError(strategyReturns, benchmarkReturns);

      // 计算信息比率
      const informationRatio = trackingError > 0 ? excessReturn / trackingError : 0;

      strategy.relativePerformance = {
        excessReturn,
        informationRatio,
        trackingError,
      };
    }
  }

  /**
   * 计算跟踪误差
   */
  private calculateTrackingError(returns1: number[], returns2: number[]): number {
    const minLength = Math.min(returns1.length, returns2.length);
    if (minLength === 0) return 0;

    const differences: number[] = [];
    for (let i = 0; i < minLength; i++) {
      differences.push(returns1[i] - returns2[i]);
    }

    const mean = differences.reduce((sum, d) => sum + d, 0) / differences.length;
    const variance = differences.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / differences.length;

    return Math.sqrt(variance);
  }

  /**
   * 计算策略排名
   */
  private calculateRankings(results: StrategyResult[]): StrategyRanking[] {
    // 计算各维度排名
    const byReturn = [...results].sort((a, b) => b.stats.totalReturn - a.stats.totalReturn);
    const bySharpe = [...results].sort((a, b) => b.stats.sharpeRatio - a.stats.sharpeRatio);
    const byDrawdown = [...results].sort((a, b) => a.stats.maxDrawdown - b.stats.maxDrawdown);
    const byWinRate = [...results].sort((a, b) => b.stats.winRate - a.stats.winRate);
    const byProfitFactor = [...results].sort((a, b) => b.stats.profitFactor - a.stats.profitFactor);

    const getRank = (sorted: StrategyResult[], id: string): number => {
      const index = sorted.findIndex((s) => s.strategyId === id);
      return index + 1;
    };

    const rankings: StrategyRanking[] = results.map((result) => {
      const metricRanks = {
        totalReturn: getRank(byReturn, result.strategyId),
        sharpeRatio: getRank(bySharpe, result.strategyId),
        maxDrawdown: getRank(byDrawdown, result.strategyId),
        winRate: getRank(byWinRate, result.strategyId),
        profitFactor: getRank(byProfitFactor, result.strategyId),
      };

      // 计算综合得分 (加权平均)
      const weights = {
        totalReturn: 0.3,
        sharpeRatio: 0.25,
        maxDrawdown: 0.2,
        winRate: 0.15,
        profitFactor: 0.1,
      };

      const maxRank = results.length;
      const scoreComponents = {
        totalReturn: (maxRank - metricRanks.totalReturn + 1) / maxRank * 100 * weights.totalReturn,
        sharpeRatio: (maxRank - metricRanks.sharpeRatio + 1) / maxRank * 100 * weights.sharpeRatio,
        maxDrawdown: (maxRank - metricRanks.maxDrawdown + 1) / maxRank * 100 * weights.maxDrawdown,
        winRate: (maxRank - metricRanks.winRate + 1) / maxRank * 100 * weights.winRate,
        profitFactor: (maxRank - metricRanks.profitFactor + 1) / maxRank * 100 * weights.profitFactor,
      };

      const compositeScore = Object.values(scoreComponents).reduce((sum, s) => sum + s, 0);

      return {
        strategyId: result.strategyId,
        strategyName: result.strategyName,
        overallRank: 0, // Will be set after sorting
        metricRanks,
        compositeScore,
      };
    });

    // 按综合得分排序并设置总排名
    rankings.sort((a, b) => b.compositeScore - a.compositeScore);
    rankings.forEach((ranking, index) => {
      ranking.overallRank = index + 1;
    });

    return rankings;
  }
}

// 单例实例
export const strategyComparisonService = new StrategyComparisonService();

export default StrategyComparisonService;
