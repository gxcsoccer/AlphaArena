/**
 * useBalance Hook Tests
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useBalance } from '../../src/client/hooks/useBalance';

// Mock the API module
jest.mock('../../src/client/utils/api', () => ({
  api: {
    getPortfolio: jest.fn(),
  },
}));

// Mock the realtime client
jest.mock('../../src/client/utils/realtime', () => ({
  getRealtimeClient: jest.fn(() => ({
    on: jest.fn(() => jest.fn()), // Returns unsubscribe function
  })),
}));

const { api } = require('../../src/client/utils/api');

describe('useBalance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockPortfolio = {
    id: 'portfolio_1',
    strategyId: 'strategy_1',
    symbol: 'BTC/USD',
    baseCurrency: 'CNY',
    quoteCurrency: 'USD',
    cashBalance: 5000.00,
    positions: [],
    totalValue: 10000.00,
    snapshotAt: new Date().toISOString(),
  };

  it('should load balance successfully', async () => {
    api.getPortfolio.mockResolvedValue(mockPortfolio);

    const { result } = renderHook(() => useBalance());

    // Initial state
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();

    // After loading
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.totalBalance).toBe(10000.00);
    expect(result.current.availableBalance).toBe(5000.00);
    expect(result.current.error).toBeNull();
  });

  it('should handle empty portfolio (no data yet)', async () => {
    api.getPortfolio.mockResolvedValue(null);

    const { result } = renderHook(() => useBalance());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.totalBalance).toBe(0);
    expect(result.current.availableBalance).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('should handle API errors', async () => {
    api.getPortfolio.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useBalance());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.totalBalance).toBe(0);
    expect(result.current.availableBalance).toBe(0);
  });

  it('should provide refresh function', async () => {
    api.getPortfolio.mockResolvedValueOnce(mockPortfolio);
    api.getPortfolio.mockResolvedValueOnce({
      ...mockPortfolio,
      totalValue: 15000.00,
      cashBalance: 7500.00,
    });

    const { result } = renderHook(() => useBalance());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.totalBalance).toBe(10000.00);

    // Call refresh
    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.totalBalance).toBe(15000.00);
    });
  });

  it('should subscribe to realtime updates', async () => {
    api.getPortfolio.mockResolvedValue(mockPortfolio);

    const { result } = renderHook(() => useBalance());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Verify realtime subscription was set up
    const { getRealtimeClient } = require('../../src/client/utils/realtime');
    expect(getRealtimeClient).toHaveBeenCalled();
  });
});

// Helper for act
function act(callback: () => void) {
  callback();
}
