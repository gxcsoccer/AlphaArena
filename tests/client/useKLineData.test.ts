/**
 * useKLineData Hook Tests
 * 
 * Tests cover the scenarios fixed in Sprint 6:
 * - Race conditions during symbol switching
 * - Stale API response handling
 * - Data clearing on symbol change
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useKLineData } from '../../src/client/hooks/useKLineData';
import type { KLineDataPoint, TimeFrame } from '../../src/client/components/KLineChart';

// Mock the API module
jest.mock('../../src/client/utils/api', () => ({
  api: {
    getKLineData: jest.fn(),
  },
}));

// Mock the config module
jest.mock('../../src/client/utils/config', () => ({
  validateConfig: jest.fn(() => ({
    isConfigured: true,
    apiUrl: 'http://test-api',
    wsUrl: 'ws://test-ws',
  })),
}));

const { api } = require('../../src/client/utils/api');

// Helper to create mock kline data
function createMockKLineData(symbol: string, count: number = 10): KLineDataPoint[] {
  const basePrice = symbol === 'BTC/USD' ? 50000 : symbol === 'ETH/USD' ? 3000 : 100;
  const data: KLineDataPoint[] = [];
  
  for (let i = 0; i < count; i++) {
    const open = basePrice + Math.random() * 100;
    const close = open + (Math.random() - 0.5) * 50;
    const high = Math.max(open, close) + Math.random() * 10;
    const low = Math.min(open, close) - Math.random() * 10;
    const volume = Math.floor(Math.random() * 1000000);
    
    data.push({
      time: Math.floor(Date.now() / 1000) - i * 3600, // 1 hour intervals
      open,
      high,
      low,
      close,
      volume,
    });
  }
  
  return data;
}

describe('useKLineData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initial Load', () => {
    it('should start with loading state', () => {
      (api.getKLineData as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useKLineData('BTC/USD'));

      expect(result.current.loading).toBe(true);
      expect(result.current.klineData).toEqual([]);
      expect(result.current.error).toBeNull();
      expect(result.current.currentSymbol).toBe('BTC/USD');
    });

    it('should load data successfully', async () => {
      const mockData = createMockKLineData('BTC/USD');
      (api.getKLineData as jest.Mock).mockResolvedValue(mockData);

      const { result } = renderHook(() => useKLineData('BTC/USD'));

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.klineData).toEqual(mockData);
      expect(result.current.klineData.length).toBe(10);
      expect(result.current.error).toBeNull();
      expect(result.current.currentSymbol).toBe('BTC/USD');
    });

    it('should call API with correct parameters', async () => {
      const mockData = createMockKLineData('BTC/USD');
      (api.getKLineData as jest.Mock).mockResolvedValue(mockData);

      renderHook(() => useKLineData('BTC/USD', '1h', 500));

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(api.getKLineData).toHaveBeenCalledWith('BTC/USD', '1h', 500);
    });

    it('should use default timeframe and limit if not specified', async () => {
      const mockData = createMockKLineData('BTC/USD');
      (api.getKLineData as jest.Mock).mockResolvedValue(mockData);

      renderHook(() => useKLineData('BTC/USD'));

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(api.getKLineData).toHaveBeenCalledWith('BTC/USD', '1h', 1000);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors', async () => {
      (api.getKLineData as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useKLineData('BTC/USD'));

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.klineData).toEqual([]);
    });

    it('should handle invalid data format', async () => {
      (api.getKLineData as jest.Mock).mockResolvedValue({ not: 'an array' });

      const { result } = renderHook(() => useKLineData('BTC/USD'));

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('数据格式错误');
      expect(result.current.klineData).toEqual([]);
    });

    it('should handle empty data array', async () => {
      (api.getKLineData as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() => useKLineData('BTC/USD'));

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeNull();
      expect(result.current.klineData).toEqual([]);
    });
  });

  describe('Symbol Switching - Race Condition Prevention', () => {
    it('should clear data immediately when symbol changes', async () => {
      const btcData = createMockKLineData('BTC/USD');
      (api.getKLineData as jest.Mock).mockResolvedValue(btcData);

      const { result, rerender } = renderHook(
        ({ symbol }) => useKLineData(symbol),
        { initialProps: { symbol: 'BTC/USD' } }
      );

      // Wait for initial load
      await act(async () => {
        await jest.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.klineData.length).toBe(10);
      });

      // Now switch symbol
      const ethData = createMockKLineData('ETH/USD');
      (api.getKLineData as jest.Mock).mockResolvedValue(ethData);

      rerender({ symbol: 'ETH/USD' });

      // Data should be cleared immediately after symbol change
      expect(result.current.loading).toBe(true);
      expect(result.current.klineData).toEqual([]);
      expect(result.current.currentSymbol).toBe('ETH/USD');
    });

    it('should ignore stale API responses from previous symbol', async () => {
      // First call for BTC/USD - will be slow
      let btcResolve: (value: any) => void;
      const btcPromise = new Promise<KLineDataPoint[]>((resolve) => {
        btcResolve = resolve;
      });

      // Second call for ETH/USD - will be fast
      const ethData = createMockKLineData('ETH/USD');

      const _callCount = 0;
      (api.getKLineData as jest.Mock).mockImplementation(async (symbol: string) => {
        callCount++;
        if (symbol === 'BTC/USD') {
          return btcPromise;
        }
        return ethData;
      });

      const { result, rerender } = renderHook(
        ({ symbol }) => useKLineData(symbol),
        { initialProps: { symbol: 'BTC/USD' } }
      );

      // Switch to ETH before BTC resolves
      rerender({ symbol: 'ETH/USD' });

      // Let ETH resolve
      await act(async () => {
        await jest.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.currentSymbol).toBe('ETH/USD');
        expect(result.current.klineData).toEqual(ethData);
      });

      // Now resolve BTC - should be ignored
      const btcData = createMockKLineData('BTC/USD');
      await act(async () => {
        btcResolve!(btcData);
        await jest.runAllTimersAsync();
      });

      // Data should still be ETH data, not BTC
      expect(result.current.klineData).toEqual(ethData);
      expect(result.current.currentSymbol).toBe('ETH/USD');
    });

    it('should handle rapid symbol switches correctly', async () => {
      const symbols = ['BTC/USD', 'ETH/USD', 'SOL/USD', 'DOGE/USD'];
      const dataMap: Record<string, KLineDataPoint[]> = {};
      
      symbols.forEach(s => {
        dataMap[s] = createMockKLineData(s);
      });

      let currentSymbol = 'BTC/USD';
      (api.getKLineData as jest.Mock).mockImplementation(async (symbol: string) => {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 100));
        return dataMap[symbol];
      });

      const { result, rerender } = renderHook(
        ({ symbol }) => useKLineData(symbol),
        { initialProps: { symbol: 'BTC/USD' } }
      );

      // Rapidly switch symbols
      for (const symbol of symbols.slice(1)) {
        rerender({ symbol });
        currentSymbol = symbol;
        await act(async () => {
          jest.advanceTimersByTime(10); // Small delay between switches
        });
      }

      // Wait for final request to complete
      await act(async () => {
        await jest.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should only show data for the last symbol
      expect(result.current.currentSymbol).toBe('DOGE/USD');
      expect(result.current.klineData).toEqual(dataMap['DOGE/USD']);
    });

    it('should track request IDs to ignore stale responses', async () => {
      const resolveFunctions: Array<(value: any) => void> = [];
      
      (api.getKLineData as jest.Mock).mockImplementation(() => {
        return new Promise<KLineDataPoint[]>((resolve) => {
          resolveFunctions.push(resolve);
        });
      });

      const { result, rerender } = renderHook(
        ({ symbol }) => useKLineData(symbol),
        { initialProps: { symbol: 'BTC/USD' } }
      );

      // Switch to ETH
      rerender({ symbol: 'ETH/USD' });

      // Resolve in reverse order (stale first)
      const btcData = createMockKLineData('BTC/USD');
      const ethData = createMockKLineData('ETH/USD');

      // Resolve ETH (last request) first
      await act(async () => {
        resolveFunctions[1](ethData);
        await jest.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(result.current.klineData).toEqual(ethData);
      });

      // Resolve BTC (first request) - should be ignored
      await act(async () => {
        resolveFunctions[0](btcData);
        await jest.runAllTimersAsync();
      });

      // Should still have ETH data
      expect(result.current.klineData).toEqual(ethData);
      expect(result.current.currentSymbol).toBe('ETH/USD');
    });
  });

  describe('Refresh Functionality', () => {
    it('should provide a refresh function', async () => {
      const mockData = createMockKLineData('BTC/USD');
      (api.getKLineData as jest.Mock).mockResolvedValue(mockData);

      const { result } = renderHook(() => useKLineData('BTC/USD'));

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.refresh).toBe('function');
    });

    it('should refetch data when refresh is called', async () => {
      const initialData = createMockKLineData('BTC/USD', 5);
      const refreshedData = createMockKLineData('BTC/USD', 10);
      
      (api.getKLineData as jest.Mock)
        .mockResolvedValueOnce(initialData)
        .mockResolvedValueOnce(refreshedData);

      const { result } = renderHook(() => useKLineData('BTC/USD'));

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(result.current.klineData.length).toBe(5);
      });

      // Call refresh
      await act(async () => {
        result.current.refresh();
        await jest.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(result.current.klineData.length).toBe(10);
      });
    });
  });

  describe('Timeframe Changes', () => {
    it('should refetch data when timeframe changes', async () => {
      const data1h = createMockKLineData('BTC/USD', 10);
      const data4h = createMockKLineData('BTC/USD', 20);
      
      (api.getKLineData as jest.Mock)
        .mockResolvedValueOnce(data1h)
        .mockResolvedValueOnce(data4h);

      const { result, rerender } = renderHook(
        ({ timeframe }) => useKLineData('BTC/USD', timeframe),
        { initialProps: { timeframe: '1h' as TimeFrame } }
      );

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(result.current.klineData.length).toBe(10);
      });

      // Change timeframe
      rerender({ timeframe: '4h' });

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(result.current.klineData.length).toBe(20);
      });

      expect(api.getKLineData).toHaveBeenCalledWith('BTC/USD', '4h', 1000);
    });
  });

  describe('Multiple Rapid Updates', () => {
    it('should handle multiple rapid symbol and timeframe changes', async () => {
      const dataMap: Record<string, KLineDataPoint[]> = {
        'BTC/USD-1h': createMockKLineData('BTC/USD', 10),
        'ETH/USD-1h': createMockKLineData('ETH/USD', 15),
        'ETH/USD-4h': createMockKLineData('ETH/USD', 20),
      };

      const _callCount = 0;
      (api.getKLineData as jest.Mock).mockImplementation(async (symbol: string, timeframe: string) => {
        callCount++;
        // Add delay to simulate network
        await new Promise(resolve => setTimeout(resolve, 50));
        return dataMap[`${symbol}-${timeframe}`];
      });

      const { result, rerender } = renderHook(
        ({ symbol, timeframe }) => useKLineData(symbol, timeframe),
        { initialProps: { symbol: 'BTC/USD', timeframe: '1h' as TimeFrame } }
      );

      // Start with BTC
      await act(async () => {
        jest.advanceTimersByTime(10);
      });

      // Switch to ETH (BTC request pending)
      rerender({ symbol: 'ETH/USD', timeframe: '1h' });

      await act(async () => {
        jest.advanceTimersByTime(10);
      });

      // Change timeframe (ETH/1h request pending)
      rerender({ symbol: 'ETH/USD', timeframe: '4h' });

      // Let all timers complete
      await act(async () => {
        await jest.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have data from last request
      expect(result.current.currentSymbol).toBe('ETH/USD');
      expect(result.current.klineData.length).toBe(20);
    });
  });
});
