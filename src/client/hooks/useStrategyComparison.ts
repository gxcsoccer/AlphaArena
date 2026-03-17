/**
 * useStrategyComparison - 策略比较数据 Hook
 *
 * Manages strategy comparison execution and data retrieval
 */

import { useState, useCallback } from 'react';
import { api } from '../utils/api';
import { createLogger } from '../../utils/logger';

const log = createLogger('useStrategyComparison');

// Types
export interface StrategyConfig {
  id: string;
  name: string;
  params?: Record<string, unknown>;
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

      // Call the actual API endpoint
      const response = await api.post<{ success: boolean; result: StrategyComparisonResult }>(
        '/api/strategies/compare',
        config
      );

      if (!response.data.success || !response.data.result) {
        throw new Error('Strategy comparison failed: invalid response');
      }

      setResult(response.data.result);

      log.info('Strategy comparison completed:', response.data.result.rankings);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '策略比较执行失败';
      log.error('Strategy comparison failed:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const getComparison = useCallback(async (id: string): Promise<StrategyComparisonResult | null> => {
    try {
      const response = await api.get<{ success: boolean; result: StrategyComparisonResult }>(
        `/api/strategies/compare/${id}`
      );
      
      if (!response.data.success || !response.data.result) {
        return null;
      }
      
      return response.data.result;
    } catch (err) {
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
