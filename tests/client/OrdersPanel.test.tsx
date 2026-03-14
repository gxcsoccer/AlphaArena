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

const { api } = require('../../src/client/utils/api');

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
      expect(screen.getByText('BTC/USD')).toBeInTheDocument();
    });

    expect(screen.getByText('ETH/USD')).toBeInTheDocument();
    expect(screen.getByText(/买入/i)).toBeInTheDocument();
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
      const cancelButtons = screen.getAllByText('取消');
      // Should have 3 cancel buttons (one per row), but only first should be enabled
      expect(cancelButtons).toHaveLength(3);
    });

    // First order (pending) should have enabled cancel button
    const pendingCancelBtn = screen.getAllByText('取消')[0];
    expect(pendingCancelBtn).not.toBeDisabled();

    // Second order (filled) should have disabled cancel button
    const filledCancelBtn = screen.getAllByText('取消')[1];
    expect(filledCancelBtn).toBeDisabled();

    // Third order (cancelled) should have disabled cancel button
    const cancelledCancelBtn = screen.getAllByText('取消')[2];
    expect(cancelledCancelBtn).toBeDisabled();
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
      expect(screen.getByText('BTC/USD')).toBeInTheDocument();
    });

    // Click cancel button for first order
    const cancelButtons = screen.getAllByText('取消');
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

    // Click refresh button
    const refreshButton = screen.getByText('刷新');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(api.getOrders).toHaveBeenCalledTimes(2);
    });
  });

  it('should show error message when getOrders fails', async () => {
    api.getOrders.mockRejectedValue(new Error('Network error'));

    // Mock Message.error
    const mockMessage = {
      error: jest.fn(),
      success: jest.fn(),
    };
    jest.mock('@arco-design/web-react', () => ({
      Message: mockMessage,
    }));

    render(<OrdersPanel />);

    await waitFor(() => {
      expect(mockMessage.error).toHaveBeenCalled();
    });
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

  it('should respect limit prop', async () => {
    api.getOrders.mockResolvedValue(mockOrders);

    render(<OrdersPanel limit={10} />);

    await waitFor(() => {
      expect(api.getOrders).toHaveBeenCalledWith({
        limit: 10,
      });
    });
  });

  it('should display order price correctly', async () => {
    api.getOrders.mockResolvedValue(mockOrders);

    render(<OrdersPanel />);

    await waitFor(() => {
      expect(screen.getByText('$50,000')).toBeInTheDocument();
      expect(screen.getByText('$49,000')).toBeInTheDocument();
    });
  });

  it('should display order quantity with 4 decimal places', async () => {
    api.getOrders.mockResolvedValue(mockOrders);

    render(<OrdersPanel />);

    await waitFor(() => {
      expect(screen.getByText('0.1000')).toBeInTheDocument();
      expect(screen.getByText('1.5000')).toBeInTheDocument();
    });
  });

  it('should show order type tags', async () => {
    api.getOrders.mockResolvedValue(mockOrders);

    render(<OrdersPanel />);

    await waitFor(() => {
      expect(screen.getByText(/限价/i)).toBeInTheDocument();
      expect(screen.getByText(/市价/i)).toBeInTheDocument();
    });
  });
});
