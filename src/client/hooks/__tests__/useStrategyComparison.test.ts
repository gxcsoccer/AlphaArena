/**
 * useStrategyComparison Hook Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStrategyComparison, ComparisonConfig } from '../useStrategyComparison';
import { api } from '../../utils/api';

// Mock the api module
vi.mock('../../utils/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockApi = vi.mocked(api);

// Mock comparison result
const mockComparisonResult = {
  id: 'comparison-123',
  config: {
    capital: 10000,
    symbol: 'BTC/USDT',
    startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
    endTime: Date.now(),
    strategies: [
      { id: 'sma', name: 'SMA Strategy' },
      { id: 'rsi', name: 'RSI Strategy' },
    ],
  },
  results: [
    {
      strategyId: 'sma',
      strategyName: 'SMA Strategy',
      stats: {
        totalReturn: 25.5,
        annualizedReturn: 30.0,
        sharpeRatio: 1.5,
        maxDrawdown: 15.0,
        totalTrades: 100,
        winningTrades: 60,
        losingTrades: 40,
        winRate: 60,
        avgWin: 200,
        avgLoss: 150,
        profitFactor: 1.33,
        initialCapital: 10000,
        finalCapital: 12550,
        totalPnL: 2550,
      },
      equityCurve: [
        { timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000, equity: 10000, return: 0 },
        { timestamp: Date.now(), equity: 12550, return: 25.5 },
      ],
      drawdownCurve: [
        { timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000, drawdown: 0, duration: 0 },
        { timestamp: Date.now(), drawdown: 15.0, duration: 10 },
      ],
      monthlyReturns: [
        { year: 2024, month: 1, return: 10, trades: 20 },
      ],
    },
    {
      strategyId: 'rsi',
      strategyName: 'RSI Strategy',
      stats: {
        totalReturn: 18.0,
        annualizedReturn: 22.0,
        sharpeRatio: 1.2,
        maxDrawdown: 12.0,
        totalTrades: 80,
        winningTrades: 45,
        losingTrades: 35,
        winRate: 56.25,
        avgWin: 180,
        avgLoss: 140,
        profitFactor: 1.29,
        initialCapital: 10000,
        finalCapital: 11800,
        totalPnL: 1800,
      },
      equityCurve: [
        { timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000, equity: 10000, return: 0 },
        { timestamp: Date.now(), equity: 11800, return: 18.0 },
      ],
      drawdownCurve: [
        { timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000, drawdown: 0, duration: 0 },
        { timestamp: Date.now(), drawdown: 12.0, duration: 8 },
      ],
      monthlyReturns: [
        { year: 2024, month: 1, return: 8, trades: 15 },
      ],
      relativePerformance: {
        excessReturn: -7.5,
        informationRatio: 0.8,
        trackingError: 5.0,
      },
    },
  ],
  rankings: [
    {
      strategyId: 'sma',
      strategyName: 'SMA Strategy',
      overallRank: 1,
      metricRanks: {
        totalReturn: 1,
        sharpeRatio: 1,
        maxDrawdown: 1,
        winRate: 1,
        profitFactor: 1,
      },
      compositeScore: 100,
    },
    {
      strategyId: 'rsi',
      strategyName: 'RSI Strategy',
      overallRank: 2,
      metricRanks: {
        totalReturn: 2,
        sharpeRatio: 2,
        maxDrawdown: 2,
        winRate: 2,
        profitFactor: 2,
      },
      compositeScore: 50,
    },
  ],
  executionTime: 1500,
  createdAt: Date.now(),
};

describe('useStrategyComparison', () => {
  const mockConfig: ComparisonConfig = {
    capital: 10000,
    symbol: 'BTC/USDT',
    startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
    endTime: Date.now(),
    strategies: [
      { id: 'sma', name: 'SMA Strategy' },
      { id: 'rsi', name: 'RSI Strategy' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useStrategyComparison());

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
  });

  it('should run comparison successfully', async () => {
    mockApi.post.mockResolvedValueOnce({
      data: { success: true, result: mockComparisonResult },
    });

    const { result } = renderHook(() => useStrategyComparison());

    await act(async () => {
      await result.current.compareStrategies(mockConfig);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.result).not.toBeNull();
    expect(result.current.result?.results).toHaveLength(2);
    expect(result.current.result?.rankings).toHaveLength(2);
    expect(mockApi.post).toHaveBeenCalledWith('/api/strategies/compare', mockConfig);
  });

  it('should handle API error', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useStrategyComparison());

    await act(async () => {
      await result.current.compareStrategies(mockConfig);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Network error');
    expect(result.current.result).toBeNull();
  });

  it('should handle unsuccessful response', async () => {
    mockApi.post.mockResolvedValueOnce({
      data: { success: false, result: null },
    });

    const { result } = renderHook(() => useStrategyComparison());

    await act(async () => {
      await result.current.compareStrategies(mockConfig);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Strategy comparison failed: invalid response');
  });

  it('should clear result', async () => {
    mockApi.post.mockResolvedValueOnce({
      data: { success: true, result: mockComparisonResult },
    });

    const { result } = renderHook(() => useStrategyComparison());

    await act(async () => {
      await result.current.compareStrategies(mockConfig);
    });

    expect(result.current.result).not.toBeNull();

    act(() => {
      result.current.clearResult();
    });

    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should export to CSV', async () => {
    mockApi.post.mockResolvedValueOnce({
      data: { success: true, result: mockComparisonResult },
    });

    const { result } = renderHook(() => useStrategyComparison());

    // Initially no CSV
    expect(result.current.exportToCSV()).toBeNull();

    // Run comparison
    await act(async () => {
      await result.current.compareStrategies(mockConfig);
    });

    const csv = result.current.exportToCSV();
    expect(csv).not.toBeNull();
    expect(csv).toContain('Strategy,Total Return');
    expect(csv).toContain('SMA Strategy');
  });

  it('should get comparison by id', async () => {
    mockApi.get.mockResolvedValueOnce({
      data: { success: true, result: mockComparisonResult },
    });

    const { result } = renderHook(() => useStrategyComparison());

    const comparison = await result.current.getComparison('comparison-123');

    expect(comparison).not.toBeNull();
    expect(comparison?.id).toBe('comparison-123');
    expect(mockApi.get).toHaveBeenCalledWith('/api/strategies/compare/comparison-123');
  });

  it('should return null for failed getComparison', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Not found'));

    const { result } = renderHook(() => useStrategyComparison());

    const comparison = await result.current.getComparison('non-existent');

    expect(comparison).toBeNull();
  });
});
