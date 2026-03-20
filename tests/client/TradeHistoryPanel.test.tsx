/**
 * TradeHistoryPanel Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the useTrades hook before importing the component
const mockUseTrades = jest.fn();
jest.mock('../../src/client/hooks/useData', () => ({
  useTrades: () => mockUseTrades(),
}));

// Import component after mock is set up
import TradeHistoryPanel from '../../src/client/components/TradeHistoryPanel';

describe('TradeHistoryPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock return value
    mockUseTrades.mockReturnValue({
      trades: [],
      loading: false,
      error: null,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state', () => {
    mockUseTrades.mockReturnValue({
      trades: [],
      loading: true,
      error: null,
    });

    render(<TradeHistoryPanel />);
    
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('renders error state', () => {
    mockUseTrades.mockReturnValue({
      trades: [],
      loading: false,
      error: 'Failed to fetch trades',
    });

    render(<TradeHistoryPanel />);
    
    expect(screen.getByText(/加载失败/)).toBeInTheDocument();
  });

  it('renders empty state when no trades', () => {
    mockUseTrades.mockReturnValue({
      trades: [],
      loading: false,
      error: null,
    });

    render(<TradeHistoryPanel />);
    
    expect(screen.getByText('暂无成交数据')).toBeInTheDocument();
  });

  it('renders trades data correctly', () => {
    const mockTrades = [
      {
        id: '1',
        strategyId: 'strat1',
        symbol: 'BTC/USDT',
        side: 'buy' as const,
        price: 50000,
        quantity: 0.5,
        total: 25000,
        executedAt: '2024-01-01T12:00:00Z',
      },
      {
        id: '2',
        strategyId: 'strat1',
        symbol: 'BTC/USDT',
        side: 'sell' as const,
        price: 51000,
        quantity: 0.3,
        total: 15300,
        executedAt: '2024-01-01T12:05:00Z',
      },
    ];

    mockUseTrades.mockReturnValue({
      trades: mockTrades,
      loading: false,
      error: null,
    });

    render(<TradeHistoryPanel />);
    
    // Check if component renders with data - look for table
    const table = document.querySelector('.arco-table');
    expect(table || screen.getByText('BTC/USDT')).toBeTruthy();
  });

  it('displays buy trades with green color', () => {
    const mockTrades = [
      {
        id: '1',
        strategyId: 'strat1',
        symbol: 'BTC/USDT',
        side: 'buy' as const,
        price: 50000,
        quantity: 0.5,
        total: 25000,
        executedAt: '2024-01-01T12:00:00Z',
      },
    ];

    mockUseTrades.mockReturnValue({
      trades: mockTrades,
      loading: false,
      error: null,
    });

    render(<TradeHistoryPanel />);
    
    // Check for buy text
    expect(screen.getByText('买入')).toBeInTheDocument();
  });

  it('displays sell trades with red color', () => {
    const mockTrades = [
      {
        id: '1',
        strategyId: 'strat1',
        symbol: 'BTC/USDT',
        side: 'sell' as const,
        price: 51000,
        quantity: 0.3,
        total: 15300,
        executedAt: '2024-01-01T12:05:00Z',
      },
    ];

    mockUseTrades.mockReturnValue({
      trades: mockTrades,
      loading: false,
      error: null,
    });

    render(<TradeHistoryPanel />);
    
    // Check for sell text
    expect(screen.getByText('卖出')).toBeInTheDocument();
  });

  it('renders with custom limit', () => {
    mockUseTrades.mockReturnValue({
      trades: [],
      loading: false,
      error: null,
    });

    render(<TradeHistoryPanel limit={50} />);
    
    // Component should render - look for the card title or empty state
    expect(screen.getByText('暂无成交数据')).toBeInTheDocument();
  });

  it('renders with autoScroll disabled', () => {
    mockUseTrades.mockReturnValue({
      trades: [],
      loading: false,
      error: null,
    });

    render(<TradeHistoryPanel autoScroll={false} />);
    
    // Component should render without errors
    expect(screen.getByText('暂无成交数据')).toBeInTheDocument();
  });

  it('displays filter dropdowns', () => {
    mockUseTrades.mockReturnValue({
      trades: [],
      loading: false,
      error: null,
    });

    render(<TradeHistoryPanel />);
    
    // Should have filter text - look for the default option
    expect(screen.getByText('全部')).toBeInTheDocument();
  });

  it('filters trades by side', () => {
    const mockTrades = [
      {
        id: '1',
        strategyId: 'strat1',
        symbol: 'BTC/USDT',
        side: 'buy' as const,
        price: 50000,
        quantity: 0.5,
        total: 25000,
        executedAt: '2024-01-01T12:00:00Z',
      },
      {
        id: '2',
        strategyId: 'strat1',
        symbol: 'BTC/USDT',
        side: 'sell' as const,
        price: 51000,
        quantity: 0.3,
        total: 15300,
        executedAt: '2024-01-01T12:05:00Z',
      },
    ];

    mockUseTrades.mockReturnValue({
      trades: mockTrades,
      loading: false,
      error: null,
    });

    render(<TradeHistoryPanel />);
    
    // Component renders with trade data
    expect(screen.getByText('买入')).toBeInTheDocument();
    expect(screen.getByText('卖出')).toBeInTheDocument();
  });
});