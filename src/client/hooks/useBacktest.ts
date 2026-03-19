/**
 * useBacktest - 回测数据 Hook
 * 
 * Manages backtest execution and data retrieval
 */

import { useState, useCallback } from 'react';
import { createLogger } from '../../utils/logger';

const log = createLogger('useBacktest');

// Types
export interface BacktestConfig {
  capital: number;
  symbol: string;
  startTime: number;
  endTime: number;
  strategy: string;
  strategyParams?: Record<string, any>;
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

export interface PortfolioSnapshot {
  timestamp: number;
  cash: number;
  positions: Record<string, { quantity: number; avgPrice: number; currentPrice: number; value: number; unrealizedPnL: number }>;
  totalValue: number;
  unrealizedPnL: number;
}

export interface Trade {
  id: string;
  timestamp: number;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  realizedPnL: number;
}

export interface BacktestResult {
  config: BacktestConfig;
  stats: BacktestStats;
  snapshots: PortfolioSnapshot[];
  trades: Trade[];
  startTime: number;
  endTime: number;
  duration: number;
}

export interface UseBacktestReturn {
  loading: boolean;
  error: string | null;
  result: BacktestResult | null;
  runBacktest: (config: BacktestConfig) => Promise<void>;
  clearResult: () => void;
  exportToCSV: () => string | null;
  exportToJSON: () => string | null;
}

// Available strategies
export const STRATEGIES = [
  { value: 'sma', label: 'SMA 均线交叉' },
  { value: 'rsi', label: 'RSI 相对强弱指标' },
  { value: 'macd', label: 'MACD 指标' },
  { value: 'bollinger', label: '布林带策略' },
];

// Available symbols
export const SYMBOLS = [
  { value: 'BTC/USDT', label: 'BTC/USDT' },
  { value: 'ETH/USDT', label: 'ETH/USDT' },
  { value: 'AAPL', label: 'AAPL' },
  { value: 'GOOGL', label: 'GOOGL' },
  { value: 'TSLA', label: 'TSLA' },
];

/**
 * Generate mock backtest result for demo
 */
function generateMockBacktestResult(config: BacktestConfig): BacktestResult {
  const numDays = Math.floor((config.endTime - config.startTime) / (24 * 60 * 60 * 1000));
  const numSnapshots = Math.min(numDays, 365);
  const snapshots: PortfolioSnapshot[] = [];
  const trades: Trade[] = [];
  
  let equity = config.capital;
  const cash = config.capital;
  const positions: Record<string, any> = {};
  let tradeId = 0;
  
  // Generate daily snapshots
  for (let i = 0; i < numSnapshots; i++) {
    const timestamp = config.startTime + i * 24 * 60 * 60 * 1000;
    const dailyReturn = (Math.random() - 0.45) * 0.03; // Slight positive bias
    equity *= (1 + dailyReturn);
    
    // Random trades
    if (Math.random() < 0.3) {
      const side = Math.random() < 0.5 ? 'buy' : 'sell';
      const price = 100 + Math.random() * 50;
      const quantity = Math.floor(Math.random() * 100) + 10;
      
      trades.push({
        id: `trade-${tradeId++}`,
        timestamp,
        side,
        price,
        quantity,
        realizedPnL: side === 'sell' ? (Math.random() - 0.4) * 500 : 0,
      });
    }
    
    snapshots.push({
      timestamp,
      cash: cash * (1 - Math.random() * 0.3),
      positions,
      totalValue: equity,
      unrealizedPnL: equity - config.capital,
    });
  }
  
  // Calculate stats
  const finalEquity = snapshots[snapshots.length - 1]?.totalValue || config.capital;
  const totalReturn = ((finalEquity - config.capital) / config.capital) * 100;
  const winningTrades = trades.filter((t) => t.realizedPnL > 0);
  const losingTrades = trades.filter((t) => t.realizedPnL <= 0);
  const totalPnL = trades.reduce((sum, t) => sum + t.realizedPnL, 0);
  
  // Calculate max drawdown
  let peak = config.capital;
  let maxDrawdown = 0;
  for (const snapshot of snapshots) {
    peak = Math.max(peak, snapshot.totalValue);
    const dd = ((peak - snapshot.totalValue) / peak) * 100;
    maxDrawdown = Math.max(maxDrawdown, dd);
  }
  
  const stats: BacktestStats = {
    totalReturn,
    annualizedReturn: totalReturn * (365 / numDays),
    sharpeRatio: Math.random() * 2 + 0.5,
    maxDrawdown,
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
    avgWin: winningTrades.length > 0 ? winningTrades.reduce((s, t) => s + t.realizedPnL, 0) / winningTrades.length : 0,
    avgLoss: losingTrades.length > 0 ? Math.abs(losingTrades.reduce((s, t) => s + t.realizedPnL, 0) / losingTrades.length) : 0,
    profitFactor: Math.random() * 2 + 0.5,
    initialCapital: config.capital,
    finalCapital: finalEquity,
    totalPnL,
  };
  
  return {
    config,
    stats,
    snapshots,
    trades,
    startTime: Date.now(),
    endTime: Date.now() + numDays * 1000,
    duration: numDays * 1000,
  };
}

export function useBacktest(): UseBacktestReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const runBacktest = useCallback(async (config: BacktestConfig) => {
    setLoading(true);
    setError(null);
    
    try {
      log.info('Running backtest with config:', config);
      
      // For now, generate mock data
      // In production, this would call the actual backtest API
      await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));
      
      const mockResult = generateMockBacktestResult(config);
      setResult(mockResult);
      
      log.info('Backtest completed:', mockResult.stats);
    } catch (err: any) {
      log.error('Backtest failed:', err);
      setError(err.message || '回测执行失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  const exportToCSV = useCallback((): string | null => {
    if (!result) return null;
    
    let csv = 'timestamp,cash,totalValue,unrealizedPnL\n';
    for (const snapshot of result.snapshots) {
      csv += `${snapshot.timestamp},${snapshot.cash.toFixed(2)},${snapshot.totalValue.toFixed(2)},${snapshot.unrealizedPnL.toFixed(2)}\n`;
    }
    
    return csv;
  }, [result]);

  const exportToJSON = useCallback((): string | null => {
    if (!result) return null;
    return JSON.stringify(result, null, 2);
  }, [result]);

  return {
    loading,
    error,
    result,
    runBacktest,
    clearResult,
    exportToCSV,
    exportToJSON,
  };
}

export default useBacktest;
