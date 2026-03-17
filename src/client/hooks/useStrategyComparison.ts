/**
 * useStrategyComparison - 策略比较数据 Hook
 *
 * Manages strategy comparison execution and data retrieval
 */

import { useState, useCallback, useMemo } from 'react';
import { api } from '../utils/api';
import { createLogger } from '../../utils/logger';

const log = createLogger('useStrategyComparison');

// Types
export interface StrategyConfig {
  id: string;
  name: string;
  params?: Record<string, any>;
}

export interface ComparisonConfig {
  capital: number;
  symbol: string;
  startTime: number;
  endTime: number;
  strategies: StrategyConfig[];
  tickInterval?: number;
}

export interface BacktestStats {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  initialCapital: number;
  finalCapital: number;
  totalPnL: number;
}

export interface EquityPoint {
  timestamp: number;
  equity: number;
  return: number;
}

export interface DrawdownPoint {
  timestamp: number;
  drawdown: number;
  duration: number;
}

export interface MonthlyReturn {
  year: number;
  month: number;
  return: number;
  trades: number;
}

export interface RelativePerformance {
  excessReturn: number;
  informationRatio: number;
  trackingError: number;
}

export interface StrategyResult {
  strategyId: string;
  strategyName: string;
  stats: BacktestStats;
  equityCurve: EquityPoint[];
  drawdownCurve: DrawdownPoint[];
  monthlyReturns: MonthlyReturn[];
  relativePerformance?: RelativePerformance;
}

export interface StrategyRanking {
  strategyId: string;
  strategyName: string;
  overallRank: number;
  metricRanks: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
  };
  compositeScore: number;
}

export interface StrategyComparisonResult {
  id: string;
  config: ComparisonConfig;
  results: StrategyResult[];
  rankings: StrategyRanking[];
  executionTime: number;
  createdAt: number;
}

export interface UseStrategyComparisonReturn {
  loading: boolean;
  error: string | null;
  result: StrategyComparisonResult | null;
  compareStrategies: (config: ComparisonConfig) => Promise<void>;
  getComparison: (id: string) => Promise<StrategyComparisonResult | null>;
  clearResult: () => void;
  exportToCSV: () => string | null;
}

// Available strategies for comparison
export const AVAILABLE_STRATEGIES = [
  { id: 'sma', name: 'SMA 均线交叉', description: '简单移动平均线交叉策略', category: 'trend' },
  { id: 'rsi', name: 'RSI 相对强弱指标', description: '基于RSI超买超卖信号', category: 'oscillator' },
  { id: 'macd', name: 'MACD 指标', description: 'MACD金叉死叉策略', category: 'trend' },
  { id: 'bollinger', name: '布林带策略', description: '布林带突破策略', category: 'volatility' },
  { id: 'atr', name: 'ATR 策略', description: '平均真实波幅策略', category: 'volatility' },
  { id: 'stochastic', name: '随机指标策略', description: 'KDJ随机指标策略', category: 'oscillator' },
  { id: 'ichimoku', name: '一目均衡表', description: 'Ichimoku Cloud策略', category: 'trend' },
  { id: 'fibonacci', name: '斐波那契策略', description: '斐波那契回撤策略', category: 'support' },
  { id: 'elliott', name: '艾略特波浪', description: 'Elliott Wave策略', category: 'advanced' },
  { id: 'vwap', name: 'VWAP策略', description: '成交量加权平均价策略', category: 'volume' },
];

// Available symbols
export const AVAILABLE_SYMBOLS = [
  { id: 'BTC/USDT', name: 'Bitcoin', category: 'crypto' },
  { id: 'ETH/USDT', name: 'Ethereum', category: 'crypto' },
  { id: 'SOL/USDT', name: 'Solana', category: 'crypto' },
  { id: 'AAPL', name: 'Apple Inc.', category: 'stock' },
  { id: 'GOOGL', name: 'Alphabet Inc.', category: 'stock' },
  { id: 'TSLA', name: 'Tesla Inc.', category: 'stock' },
  { id: 'MSFT', name: 'Microsoft Corp.', category: 'stock' },
  { id: 'NVDA', name: 'NVIDIA Corp.', category: 'stock' },
];

/**
 * Generate mock comparison result for demo
 */
function generateMockComparisonResult(config: ComparisonConfig): StrategyComparisonResult {
  const results: StrategyResult[] = config.strategies.map((strategy, index) => {
    const baseReturn = (Math.random() - 0.3) * 50; // Slight positive bias
    const volatility = Math.random() * 20 + 10;
    const winRate = Math.random() * 30 + 40;
    const trades = Math.floor(Math.random() * 200) + 50;
    
    // Generate equity curve
    const numDays = Math.floor((config.endTime - config.startTime) / (24 * 60 * 60 * 1000));
    const equityCurve: EquityPoint[] = [];
    let equity = config.capital;
    
    for (let i = 0; i <= numDays; i++) {
      const timestamp = config.startTime + i * 24 * 60 * 60 * 1000;
      const dailyReturn = (Math.random() - 0.45) * (volatility / 100);
      equity *= (1 + dailyReturn);
      
      equityCurve.push({
        timestamp,
        equity,
        return: ((equity - config.capital) / config.capital) * 100,
      });
    }
    
    // Generate drawdown curve
    let peak = config.capital;
    const drawdownCurve: DrawdownPoint[] = equityCurve.map((point, i) => {
      peak = Math.max(peak, point.equity);
      const drawdown = ((peak - point.equity) / peak) * 100;
      return {
        timestamp: point.timestamp,
        drawdown,
        duration: Math.floor(Math.random() * 30),
      };
    });
    
    // Generate monthly returns
    const monthlyReturns: MonthlyReturn[] = [];
    const startDate = new Date(config.startTime);
    const endDate = new Date(config.endTime);
    
    for (let year = startDate.getFullYear(); year <= endDate.getFullYear(); year++) {
      const startMonth = year === startDate.getFullYear() ? startDate.getMonth() : 0;
      const endMonth = year === endDate.getFullYear() ? endDate.getMonth() : 11;
      
      for (let month = startMonth; month <= endMonth; month++) {
        monthlyReturns.push({
          year,
          month: month + 1,
          return: (Math.random() - 0.4) * 15,
          trades: Math.floor(Math.random() * 20) + 5,
        });
      }
    }
    
    const stats: BacktestStats = {
      totalReturn: baseReturn,
      annualizedReturn: baseReturn * (365 / numDays),
      sharpeRatio: (baseReturn / volatility) * Math.sqrt(252) / 100,
      maxDrawdown: Math.max(...drawdownCurve.map((d) => d.drawdown)),
      totalTrades: trades,
      winningTrades: Math.floor(trades * winRate / 100),
      losingTrades: Math.floor(trades * (100 - winRate) / 100),
      winRate,
      avgWin: config.capital * 0.02 * (1 + Math.random()),
      avgLoss: config.capital * 0.015 * (1 + Math.random()),
      profitFactor: 0.8 + Math.random() * 1.5,
      initialCapital: config.capital,
      finalCapital: config.capital * (1 + baseReturn / 100),
      totalPnL: config.capital * baseReturn / 100,
    };
    
    const result: StrategyResult = {
      strategyId: strategy.id,
      strategyName: strategy.name,
      stats,
      equityCurve,
      drawdownCurve,
      monthlyReturns,
    };
    
    // Add relative performance for non-first strategies
    if (index > 0) {
      result.relativePerformance = {
        excessReturn: baseReturn - results[0].stats.totalReturn,
        informationRatio: Math.random() * 2 - 0.5,
        trackingError: Math.random() * 10 + 5,
      };
    }
    
    return result;
  });
  
  // Calculate rankings
  const rankings = calculateRankings(results);
  
  return {
    id: `comparison-${Date.now()}`,
    config,
    results,
    rankings,
    executionTime: Math.random() * 3000 + 1000,
    createdAt: Date.now(),
  };
}

/**
 * Calculate strategy rankings
 */
function calculateRankings(results: StrategyResult[]): StrategyRanking[] {
  const byReturn = [...results].sort((a, b) => b.stats.totalReturn - a.stats.totalReturn);
  const bySharpe = [...results].sort((a, b) => b.stats.sharpeRatio - a.stats.sharpeRatio);
  const byDrawdown = [...results].sort((a, b) => a.stats.maxDrawdown - b.stats.maxDrawdown);
  const byWinRate = [...results].sort((a, b) => b.stats.winRate - a.stats.winRate);
  const byProfitFactor = [...results].sort((a, b) => b.stats.profitFactor - a.stats.profitFactor);

  const getRank = (sorted: StrategyResult[], id: string): number => {
    return sorted.findIndex((s) => s.strategyId === id) + 1;
  };

  const rankings: StrategyRanking[] = results.map((result) => {
    const metricRanks = {
      totalReturn: getRank(byReturn, result.strategyId),
      sharpeRatio: getRank(bySharpe, result.strategyId),
      maxDrawdown: getRank(byDrawdown, result.strategyId),
      winRate: getRank(byWinRate, result.strategyId),
      profitFactor: getRank(byProfitFactor, result.strategyId),
    };

    const weights = {
      totalReturn: 0.3,
      sharpeRatio: 0.25,
      maxDrawdown: 0.2,
      winRate: 0.15,
      profitFactor: 0.1,
    };

    const maxRank = results.length;
    const compositeScore =
      ((maxRank - metricRanks.totalReturn + 1) / maxRank) * 100 * weights.totalReturn +
      ((maxRank - metricRanks.sharpeRatio + 1) / maxRank) * 100 * weights.sharpeRatio +
      ((maxRank - metricRanks.maxDrawdown + 1) / maxRank) * 100 * weights.maxDrawdown +
      ((maxRank - metricRanks.winRate + 1) / maxRank) * 100 * weights.winRate +
      ((maxRank - metricRanks.profitFactor + 1) / maxRank) * 100 * weights.profitFactor;

    return {
      strategyId: result.strategyId,
      strategyName: result.strategyName,
      overallRank: 0,
      metricRanks,
      compositeScore,
    };
  });

  rankings.sort((a, b) => b.compositeScore - a.compositeScore);
  rankings.forEach((ranking, index) => {
    ranking.overallRank = index + 1;
  });

  return rankings;
}

/**
 * Hook for strategy comparison
 */
export function useStrategyComparison(): UseStrategyComparisonReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StrategyComparisonResult | null>(null);

  const compareStrategies = useCallback(async (config: ComparisonConfig) => {
    setLoading(true);
    setError(null);

    try {
      log.info('Running strategy comparison with config:', config);

      // For now, generate mock data
      // In production, this would call the actual API
      await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 2000));

      const mockResult = generateMockComparisonResult(config);
      setResult(mockResult);

      log.info('Strategy comparison completed:', mockResult.rankings);
    } catch (err: any) {
      log.error('Strategy comparison failed:', err);
      setError(err.message || '策略比较执行失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const getComparison = useCallback(async (id: string): Promise<StrategyComparisonResult | null> => {
    try {
      // In production, this would fetch from the API
      const response = await api.get(`/api/strategies/compare/${id}`);
      return response.data.result;
    } catch (err: any) {
      log.error('Failed to get comparison:', err);
      return null;
    }
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  const exportToCSV = useCallback((): string | null => {
    if (!result) return null;

    const headers = [
      'Strategy',
      'Total Return (%)',
      'Annualized Return (%)',
      'Sharpe Ratio',
      'Max Drawdown (%)',
      'Win Rate (%)',
      'Profit Factor',
      'Total Trades',
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
      ];
      csv += row.join(',') + '\n';
    }

    return csv;
  }, [result]);

  return {
    loading,
    error,
    result,
    compareStrategies,
    getComparison,
    clearResult,
    exportToCSV,
  };
}

export default useStrategyComparison;
