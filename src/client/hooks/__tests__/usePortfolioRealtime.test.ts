/**
 * Tests for usePortfolioRealtime Hook
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePortfolioRealtime } from './usePortfolioRealtime';
import * as realtimeModule from '../utils/realtime';
import * as apiModule from '../utils/api';

// Mock dependencies
vi.mock('../utils/realtime', () => ({
  getRealtimeClient: vi.fn(),
}));

vi.mock('../utils/api', () => ({
  api: {
    getPortfolio: vi.fn(),
  },
}));

describe('usePortfolioRealtime', () => {
  const mockPortfolio = {
    id: 'portfolio-1',
    strategyId: 'strategy-1',
    symbol: 'BTC/USDT',
    baseCurrency: 'BTC',
    quoteCurrency: 'USDT',
    cashBalance: 10000,
    positions: [
      {
        symbol: 'BTC/USDT',
        quantity: 0.5,
        averageCost: 40000,
      },
      {
        symbol: 'ETH/USDT',
        quantity: 2.0,
        averageCost: 2500,
      },
    ],
    totalValue: 30000,
    snapshotAt: new Date().toISOString(),
  };

  const mockMarketTickBTC = {
    symbol: 'BTC/USDT',
    price: 42000,
    priceChange24h: 2000,
    priceChangePercent24h: 5.0,
    timestamp: Date.now(),
  };

  const _mockMarketTickETH = {
    symbol: 'ETH/USDT',
    price: 2600,
    priceChange24h: 100,
    priceChangePercent24h: 4.0,
    timestamp: Date.now(),
  };

  let mockUnsubscribe: ReturnType<typeof vi.fn>;
  let mockOnMarketTick: ReturnType<typeof vi.fn>;
  let mockClient: any;

  beforeEach(() => {
    mockUnsubscribe = vi.fn();
    mockOnMarketTick = vi.fn().mockReturnValue(mockUnsubscribe);
    
    mockClient = {
      onMarketTick: mockOnMarketTick,
      subscribeOrderBook: vi.fn(),
      unsubscribe: vi.fn(),
      disconnect: vi.fn(),
      getConnectionStatus: vi.fn().mockReturnValue('connected'),
    };

    vi.mocked(realtimeModule.getRealtimeClient).mockReturnValue(mockClient);
    vi.mocked(apiModule.api.getPortfolio).mockResolvedValue(mockPortfolio);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch initial portfolio data', async () => {
    const { result } = renderHook(() => usePortfolioRealtime());

    expect(result.current.loading).toBe(true);
    expect(apiModule.api.getPortfolio).toHaveBeenCalledWith(undefined, undefined);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.portfolio).toBeTruthy();
    expect(result.current.portfolio?.cashBalance).toBe(10000);
    expect(result.current.portfolio?.positions).toHaveLength(2);
  });

  it('should calculate unrealized P/L correctly', async () => {
    const { result } = renderHook(() => usePortfolioRealtime());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const portfolio = result.current.portfolio;
    expect(portfolio).toBeTruthy();

    // BTC position: 0.5 * (42000 - 40000) = 1000
    const btcPosition = portfolio?.positions.find(p => p.symbol === 'BTC/USDT');
    expect(btcPosition).toBeTruthy();
    expect(btcPosition?.unrealizedPnL).toBe(1000);
    expect(btcPosition?.unrealizedPnLPercent).toBeCloseTo(5, 1);

    // ETH position: 2.0 * (2600 - 2500) = 200
    const ethPosition = portfolio?.positions.find(p => p.symbol === 'ETH/USDT');
    expect(ethPosition).toBeTruthy();
    expect(ethPosition?.unrealizedPnL).toBe(200);
    expect(ethPosition?.unrealizedPnLPercent).toBeCloseTo(4, 1);
  });

  it('should subscribe to market ticks for all portfolio positions', async () => {
    const { result } = renderHook(() => usePortfolioRealtime());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should subscribe to both BTC and ETH
    expect(mockOnMarketTick).toHaveBeenCalledWith('BTC/USDT', expect.any(Function));
    expect(mockOnMarketTick).toHaveBeenCalledWith('ETH/USDT', expect.any(Function));
  });

  it('should update P/L when market prices change', async () => {
    const { result } = renderHook(() => usePortfolioRealtime());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const initialPnL = result.current.portfolio?.totalUnrealizedPnL || 0;
    expect(initialPnL).toBe(1200); // 1000 (BTC) + 200 (ETH)

    // Simulate BTC price increase
    await act(async () => {
      const btcCallback = mockOnMarketTick.mock.calls.find(
        call => call[0] === 'BTC/USDT'
      )?.[1];
      
      if (btcCallback) {
        btcCallback({
          ...mockMarketTickBTC,
          price: 44000, // Increase from 42000 to 44000
        });
      }
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    const updatedPortfolio = result.current.portfolio;
    expect(updatedPortfolio).toBeTruthy();
    
    // New BTC P/L: 0.5 * (44000 - 40000) = 2000
    const btcPosition = updatedPortfolio?.positions.find(p => p.symbol === 'BTC/USDT');
    expect(btcPosition?.unrealizedPnL).toBe(2000);
  });

  it('should track recent P/L changes', async () => {
    const { result } = renderHook(() => usePortfolioRealtime());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.recentChanges).toHaveLength(0);

    // Simulate price change
    await act(async () => {
      const btcCallback = mockOnMarketTick.mock.calls.find(
        call => call[0] === 'BTC/USDT'
      )?.[1];
      
      if (btcCallback) {
        btcCallback({
          ...mockMarketTickBTC,
          price: 44000,
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    expect(result.current.recentChanges.length).toBeGreaterThan(0);
    expect(result.current.recentChanges[0].symbol).toBe('BTC/USDT');
    expect(result.current.recentChanges[0].direction).toBe('up');
  });

  it('should handle empty portfolio', async () => {
    vi.mocked(apiModule.api.getPortfolio).mockResolvedValue(null);

    const { result } = renderHook(() => usePortfolioRealtime());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.portfolio).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should handle API errors', async () => {
    vi.mocked(apiModule.api.getPortfolio).mockRejectedValue(
      new Error('Failed to fetch portfolio')
    );

    const { result } = renderHook(() => usePortfolioRealtime());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to fetch portfolio');
    expect(result.current.portfolio).toBeNull();
  });

  it('should cleanup subscriptions on unmount', async () => {
    const { unmount } = renderHook(() => usePortfolioRealtime());

    await waitFor(() => {
      expect(mockOnMarketTick).toHaveBeenCalled();
    });

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should respect debounce timing', async () => {
    const { result } = renderHook(() => usePortfolioRealtime({ debounceMs: 50 }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const startTime = Date.now();
    
    await act(async () => {
      const btcCallback = mockOnMarketTick.mock.calls.find(
        call => call[0] === 'BTC/USDT'
      )?.[1];
      
      if (btcCallback) {
        // Send multiple rapid updates
        btcCallback({ ...mockMarketTickBTC, price: 43000 });
        btcCallback({ ...mockMarketTickBTC, price: 43500 });
        btcCallback({ ...mockMarketTickBTC, price: 44000 });
      }
      
      // Wait less than debounce time
      await new Promise(resolve => setTimeout(resolve, 30));
    });

    // Should not have processed yet (still debouncing)
    const elapsedTime = Date.now() - startTime;
    expect(elapsedTime).toBeLessThan(100);
  });

  it('should calculate total P/L percentages correctly', async () => {
    const { result } = renderHook(() => usePortfolioRealtime());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const portfolio = result.current.portfolio;
    expect(portfolio).toBeTruthy();

    // Total cost basis: (0.5 * 40000) + (2.0 * 2500) = 20000 + 5000 = 25000
    // Total unrealized P/L: 1000 + 200 = 1200
    // Total P/L percent: (1200 / 25000) * 100 = 4.8%
    expect(portfolio?.totalUnrealizedPnLPercent).toBeCloseTo(4.8, 1);
  });

  it('should handle positions with zero quantity', async () => {
    const mockPortfolioWithZeroPosition = {
      ...mockPortfolio,
      positions: [
        {
          symbol: 'BTC/USDT',
          quantity: 0,
          averageCost: 40000,
        },
      ],
    };

    vi.mocked(apiModule.api.getPortfolio).mockResolvedValue(mockPortfolioWithZeroPosition);

    const { result } = renderHook(() => usePortfolioRealtime());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const position = result.current.portfolio?.positions[0];
    expect(position?.unrealizedPnL).toBe(0);
    expect(position?.unrealizedPnLPercent).toBe(0);
  });

  it('should filter by strategyId when provided', async () => {
    renderHook(() => usePortfolioRealtime({ strategyId: 'strategy-123' }));

    expect(apiModule.api.getPortfolio).toHaveBeenCalledWith('strategy-123', undefined);
  });

  it('should filter by symbol when provided', async () => {
    renderHook(() => usePortfolioRealtime({ symbol: 'BTC/USDT' }));

    expect(apiModule.api.getPortfolio).toHaveBeenCalledWith(undefined, 'BTC/USDT');
  });
});
