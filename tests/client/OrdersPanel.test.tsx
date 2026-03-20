/**
 * OrdersPanel Component Tests
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import OrdersPanel from '../../src/client/components/OrdersPanel';

// Mock the API module
jest.mock('../../src/client/utils/api', () => ({
  api: {
    getOrders: jest.fn(),
    cancelOrder: jest.fn(),
  },
}));

// Mock Arco Design Message and Modal to avoid ReactDOM.render issues in tests
jest.mock('@arco-design/web-react', () => {
  const actual = jest.requireActual('@arco-design/web-react');
  return {
    ...actual,
    Message: {
      error: jest.fn(),
      success: jest.fn(),
      info: jest.fn(),
      warning: jest.fn(),
    },
    Modal: {
      ...actual.Modal,
      confirm: jest.fn((config) => {
        // Immediately call onOk to simulate user confirming
        if (config.onOk) {
          config.onOk();
        }
        return Promise.resolve();
      }),
    },
  };
});

const { api } = require('../../src/client/utils/api');
const { Message } = require('@arco-design/web-react');

describe('OrdersPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockOrders = [
    {
      id: 'order_1',
      symbol: 'BTC/USD',
      side: 'buy' as const,
      type: 'limit' as const,
      price: 50000,
      quantity: 0.1,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'order_2',
      symbol: 'ETH/USD',
      side: 'sell' as const,
      type: 'market' as const,
      price: 0,
      quantity: 1.5,
      status: 'filled' as const,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'order_3',
      symbol: 'BTC/USD',
      side: 'buy' as const,
      type: 'limit' as const,
      price: 49000,
      quantity: 0.2,
      status: 'cancelled' as const,
      createdAt: new Date().toISOString(),
      cancelledAt: new Date().toISOString(),
    },
  ];

  it('should render loading state initially', async () => {
    api.getOrders.mockResolvedValue([]);

    render(<OrdersPanel />);

    expect(screen.getByText(/加载订单中/i)).toBeInTheDocument();
  });

  it('should render orders list after loading', async () => {
    api.getOrders.mockResolvedValue(mockOrders);

    render(<OrdersPanel />);

    await waitFor(() => {
      expect(screen.getAllByText('BTC/USD')).toHaveLength(2);
    });

    expect(screen.getByText('ETH/USD')).toBeInTheDocument();
    expect(screen.getAllByText(/买入/i)).toHaveLength(2);
    expect(screen.getByText(/卖出/i)).toBeInTheDocument();
  });

  it('should render empty state when no orders', async () => {
    api.getOrders.mockResolvedValue([]);

    render(<OrdersPanel />);

    await waitFor(() => {
      expect(screen.getByText(/暂无订单/i)).toBeInTheDocument();
    });
  });

  it('should display order status correctly', async () => {
    api.getOrders.mockResolvedValue(mockOrders);

    render(<OrdersPanel />);

    await waitFor(() => {
      expect(screen.getByText(/待成交/i)).toBeInTheDocument();
      expect(screen.getByText(/已成交/i)).toBeInTheDocument();
      expect(screen.getByText(/已取消/i)).toBeInTheDocument();
    });
  });

  it('should show cancel button only for pending orders', async () => {
    api.getOrders.mockResolvedValue(mockOrders);

    render(<OrdersPanel />);

    await waitFor(() => {
      const cancelButtons = screen.getAllByRole('button', { name: /取消/i });
      // Should have 3 cancel buttons (one per row), but only first should be enabled
      expect(cancelButtons).toHaveLength(3);
    });

    // First order (pending) should have enabled cancel button
    const cancelButtons = screen.getAllByRole('button', { name: /取消/i });
    expect(cancelButtons[0]).not.toBeDisabled();

    // Second order (filled) should have disabled cancel button
    expect(cancelButtons[1]).toBeDisabled();

    // Third order (cancelled) should have disabled cancel button
    expect(cancelButtons[2]).toBeDisabled();
  });

  it('should call cancelOrder API when cancel button is clicked and confirmed', async () => {
    api.getOrders.mockResolvedValue(mockOrders);
    api.cancelOrder.mockResolvedValue({
      id: 'order_1',
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    });

    render(<OrdersPanel />);

    await waitFor(() => {
      expect(screen.getAllByText('BTC/USD')).toHaveLength(2);
    });

    // Click cancel button for first order
    const cancelButtons = screen.getAllByRole('button', { name: /取消/i });
    fireEvent.click(cancelButtons[0]);

    // Confirm in the modal (mock Modal.confirm)
    // Note: In real tests, you'd need to mock the Modal component properly
    // For now, we verify the API was called
    await waitFor(() => {
      expect(api.cancelOrder).toHaveBeenCalledWith('order_1');
    });
  });

  it('should refresh orders when refresh button is clicked', async () => {
    api.getOrders.mockResolvedValueOnce([]).mockResolvedValueOnce(mockOrders);

    render(<OrdersPanel />);

    await waitFor(() => {
      expect(screen.getByText(/暂无订单/i)).toBeInTheDocument();
    });

    // Click refresh button (it's an icon button with IconRefresh)
    const refreshButton = screen.getByRole('button', { name: '' });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(api.getOrders).toHaveBeenCalledTimes(2);
    });
  });

  it('should handle getOrders failure gracefully', async () => {
    api.getOrders.mockRejectedValue(new Error('network error'));

    render(<OrdersPanel />);

    // Component should handle error and show error message
    await waitFor(() => {
      expect(Message.error).toHaveBeenCalled();
    }, { timeout: 3000 });
    
    // Verify API was called
    expect(api.getOrders).toHaveBeenCalled();
  });

  it('should filter orders by symbol when symbol prop is provided', async () => {
    api.getOrders.mockResolvedValue(mockOrders);

    render(<OrdersPanel symbol="BTC/USD" />);

    await waitFor(() => {
      expect(api.getOrders).toHaveBeenCalledWith({
        symbol: 'BTC/USD',
        limit: 50,
      });
    });
  });
});