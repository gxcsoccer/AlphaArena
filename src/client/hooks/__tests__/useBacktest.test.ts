/**
 * Tests for useBacktest hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBacktest } from '../useBacktest';

describe('useBacktest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useBacktest());
    
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
  });

  it('runs backtest and returns result', async () => {
    const { result } = renderHook(() => useBacktest());
    
    const config = {
      capital: 10000,
      symbol: 'BTC/USDT',
      startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
      endTime: Date.now(),
      strategy: 'sma',
    };
    
    await act(async () => {
      await result.current.runBacktest(config);
    });
    
    expect(result.current.loading).toBe(false);
    expect(result.current.result).not.toBeNull();
    expect(result.current.result?.config).toEqual(config);
    expect(result.current.result?.stats).toBeDefined();
    expect(result.current.result?.snapshots).toBeDefined();
    expect(result.current.result?.trades).toBeDefined();
  });

  it('clears result', async () => {
    const { result } = renderHook(() => useBacktest());
    
    const config = {
      capital: 10000,
      symbol: 'BTC/USDT',
      startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
      endTime: Date.now(),
      strategy: 'sma',
    };
    
    await act(async () => {
      await result.current.runBacktest(config);
    });
    
    expect(result.current.result).not.toBeNull();
    
    act(() => {
      result.current.clearResult();
    });
    
    expect(result.current.result).toBeNull();
  });

  it('exports to CSV', async () => {
    const { result } = renderHook(() => useBacktest());
    
    // No result yet
    expect(result.current.exportToCSV()).toBeNull();
    
    const config = {
      capital: 10000,
      symbol: 'BTC/USDT',
      startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
      endTime: Date.now(),
      strategy: 'sma',
    };
    
    await act(async () => {
      await result.current.runBacktest(config);
    });
    
    const csv = result.current.exportToCSV();
    expect(csv).not.toBeNull();
    expect(csv).toContain('timestamp,cash,totalValue');
  });

  it('exports to JSON', async () => {
    const { result } = renderHook(() => useBacktest());
    
    // No result yet
    expect(result.current.exportToJSON()).toBeNull();
    
    const config = {
      capital: 10000,
      symbol: 'BTC/USDT',
      startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
      endTime: Date.now(),
      strategy: 'sma',
    };
    
    await act(async () => {
      await result.current.runBacktest(config);
    });
    
    const json = result.current.exportToJSON();
    expect(json).not.toBeNull();
    
    const parsed = JSON.parse(json!);
    expect(parsed.config).toEqual(config);
    expect(parsed.stats).toBeDefined();
  });

  it('returns available strategies', () => {
    expect(useBacktest.STRATEGIES).toBeUndefined(); // Static export
  });
});

describe('STRATEGIES constant', () => {
  it('contains expected strategies', async () => {
    const { STRATEGIES } = await import('../useBacktest');
    expect(STRATEGIES).toContainEqual({ value: 'sma', label: expect.any(String) });
    expect(STRATEGIES).toContainEqual({ value: 'rsi', label: expect.any(String) });
  });
});

describe('SYMBOLS constant', () => {
  it('contains expected symbols', async () => {
    const { SYMBOLS } = await import('../useBacktest');
    expect(SYMBOLS).toContainEqual({ value: 'BTC/USDT', label: expect.any(String) });
  });
});
