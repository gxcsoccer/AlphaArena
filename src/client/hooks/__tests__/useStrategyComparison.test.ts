/**
 * useStrategyComparison Hook Tests
 */

import { renderHook, act } from '@testing-library/react';
import { useStrategyComparison, ComparisonConfig } from '../useStrategyComparison';

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

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useStrategyComparison());

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
  });

  it('should run comparison successfully', async () => {
    const { result } = renderHook(() => useStrategyComparison());

    await act(async () => {
      await result.current.compareStrategies(mockConfig);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.result).not.toBeNull();
    expect(result.current.result?.results).toHaveLength(2);
    expect(result.current.result?.rankings).toHaveLength(2);
  });

  it('should clear result', async () => {
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

  it('should generate correct rankings', async () => {
    const { result } = renderHook(() => useStrategyComparison());

    await act(async () => {
      await result.current.compareStrategies(mockConfig);
    });

    const rankings = result.current.result?.rankings || [];
    
    // Rankings should be sorted by composite score
    for (let i = 1; i < rankings.length; i++) {
      expect(rankings[i - 1].compositeScore).toBeGreaterThanOrEqual(rankings[i].compositeScore);
    }
    
    // Overall rank should match position
    rankings.forEach((ranking, index) => {
      expect(ranking.overallRank).toBe(index + 1);
    });
  });

  it('should generate equity curves for each strategy', async () => {
    const { result } = renderHook(() => useStrategyComparison());

    await act(async () => {
      await result.current.compareStrategies(mockConfig);
    });

    const results = result.current.result?.results || [];
    
    results.forEach((strategyResult) => {
      expect(strategyResult.equityCurve).toBeDefined();
      expect(strategyResult.equityCurve.length).toBeGreaterThan(0);
      
      // Each equity point should have required fields
      strategyResult.equityCurve.forEach((point) => {
        expect(point).toHaveProperty('timestamp');
        expect(point).toHaveProperty('equity');
        expect(point).toHaveProperty('return');
      });
    });
  });

  it('should generate drawdown curves for each strategy', async () => {
    const { result } = renderHook(() => useStrategyComparison());

    await act(async () => {
      await result.current.compareStrategies(mockConfig);
    });

    const results = result.current.result?.results || [];
    
    results.forEach((strategyResult) => {
      expect(strategyResult.drawdownCurve).toBeDefined();
      expect(strategyResult.drawdownCurve.length).toBeGreaterThan(0);
      
      // Each drawdown point should have required fields
      strategyResult.drawdownCurve.forEach((point) => {
        expect(point).toHaveProperty('timestamp');
        expect(point).toHaveProperty('drawdown');
        expect(point).toHaveProperty('duration');
      });
    });
  });

  it('should calculate relative performance for non-first strategies', async () => {
    const { result } = renderHook(() => useStrategyComparison());

    await act(async () => {
      await result.current.compareStrategies(mockConfig);
    });

    const results = result.current.result?.results || [];
    
    // First strategy should not have relative performance
    expect(results[0].relativePerformance).toBeUndefined();
    
    // Other strategies should have relative performance
    for (let i = 1; i < results.length; i++) {
      expect(results[i].relativePerformance).toBeDefined();
      expect(results[i].relativePerformance).toHaveProperty('excessReturn');
      expect(results[i].relativePerformance).toHaveProperty('informationRatio');
      expect(results[i].relativePerformance).toHaveProperty('trackingError');
    }
  });
});
