/**
 * Tests for BacktestHistory Component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BacktestHistory } from '../BacktestHistory';

// Mock useSubscription
jest.mock('../../hooks/useSubscription', () => ({
  useSubscription: () => ({
    isPro: true,
    plan: 'pro',
    subscription: { plan: 'pro' },
    loading: false,
  }),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

const mockCurrentResult = {
  config: {
    symbol: 'BTC/USDT',
    strategy: 'sma',
    capital: 10000,
    strategyParams: { fastPeriod: 10, slowPeriod: 20 },
    dateRange: [Date.now() - 90 * 24 * 60 * 60 * 1000, Date.now()],
  },
  stats: {
    totalReturn: 25.5,
    sharpeRatio: 1.5,
    maxDrawdown: 10,
    winRate: 55,
    totalTrades: 100,
    profitFactor: 1.8,
  },
};

describe('BacktestHistory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders correctly with VIP badge', () => {
    render(<BacktestHistory />);
    
    expect(screen.getByText('回测历史记录')).toBeInTheDocument();
    expect(screen.getByText(/VIP/)).toBeInTheDocument();
  });

  it('shows empty state when no records', () => {
    render(<BacktestHistory />);
    
    expect(screen.getByText('暂无保存的回测记录')).toBeInTheDocument();
  });

  it('displays save current result button when result provided', () => {
    render(<BacktestHistory currentResult={mockCurrentResult} />);
    
    expect(screen.getByText('保存当前结果')).toBeInTheDocument();
  });

  it('can save current result', async () => {
    const user = userEvent.setup();
    render(<BacktestHistory currentResult={mockCurrentResult} />);
    
    const saveButton = screen.getByText('保存当前结果');
    await user.click(saveButton);
    
    // Should show modal
    expect(screen.getByText('保存回测记录')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入记录名称')).toBeInTheDocument();
  });

  it('shows export all button', () => {
    render(<BacktestHistory />);
    
    expect(screen.getByText('导出全部')).toBeInTheDocument();
  });

  it('shows refresh button', () => {
    render(<BacktestHistory />);
    
    expect(screen.getByText('刷新')).toBeInTheDocument();
  });

  it('displays records table when records exist', async () => {
    // Pre-populate localStorage with a record
    const mockRecords = [
      {
        id: 'test-1',
        name: 'Test Record',
        symbol: 'BTC/USDT',
        strategy: 'sma',
        strategyParams: {},
        dateRange: [Date.now() - 30 * 24 * 60 * 60 * 1000, Date.now()],
        initialCapital: 10000,
        stats: {
          totalReturn: 15,
          sharpeRatio: 1.2,
          maxDrawdown: 8,
          winRate: 52,
          totalTrades: 50,
          profitFactor: 1.5,
        },
        createdAt: Date.now(),
        starred: false,
        tags: [],
      },
    ];
    localStorage.setItem('backtest_history', JSON.stringify(mockRecords));

    render(<BacktestHistory />);
    
    expect(screen.getByText('Test Record')).toBeInTheDocument();
  });

  it('can load a saved record', async () => {
    const onLoadRecord = jest.fn();
    const mockRecords = [
      {
        id: 'test-1',
        name: 'Test Record',
        symbol: 'BTC/USDT',
        strategy: 'sma',
        strategyParams: { fastPeriod: 10 },
        dateRange: [Date.now() - 30 * 24 * 60 * 60 * 1000, Date.now()],
        initialCapital: 10000,
        stats: {
          totalReturn: 15,
          sharpeRatio: 1.2,
          maxDrawdown: 8,
          winRate: 52,
          totalTrades: 50,
          profitFactor: 1.5,
        },
        createdAt: Date.now(),
        starred: false,
        tags: [],
      },
    ];
    localStorage.setItem('backtest_history', JSON.stringify(mockRecords));

    const user = userEvent.setup();
    render(<BacktestHistory onLoadRecord={onLoadRecord} />);
    
    const loadButton = screen.getByText('加载');
    await user.click(loadButton);
    
    expect(onLoadRecord).toHaveBeenCalled();
  });

  it('can toggle star on a record', async () => {
    const mockRecords = [
      {
        id: 'test-1',
        name: 'Test Record',
        symbol: 'BTC/USDT',
        strategy: 'sma',
        strategyParams: {},
        dateRange: [Date.now() - 30 * 24 * 60 * 60 * 1000, Date.now()],
        initialCapital: 10000,
        stats: {
          totalReturn: 15,
          sharpeRatio: 1.2,
          maxDrawdown: 8,
          winRate: 52,
          totalTrades: 50,
          profitFactor: 1.5,
        },
        createdAt: Date.now(),
        starred: false,
        tags: [],
      },
    ];
    localStorage.setItem('backtest_history', JSON.stringify(mockRecords));

    const user = userEvent.setup();
    render(<BacktestHistory />);
    
    // Find star button (icon button)
    const starButtons = screen.getAllByRole('button');
    const starButton = starButtons.find((btn) => btn.querySelector('svg'));
    
    if (starButton) {
      await user.click(starButton);
    }
    
    // Record should now be starred
    const savedData = JSON.parse(localStorage.getItem('backtest_history') || '[]');
    expect(savedData[0].starred).toBe(true);
  });

  it('shows VIP feature info section', () => {
    render(<BacktestHistory />);
    
    expect(screen.getByText(/VIP 回测历史功能/)).toBeInTheDocument();
  });

  it('displays record count in header', () => {
    const mockRecords = [
      {
        id: 'test-1',
        name: 'Test Record 1',
        symbol: 'BTC/USDT',
        strategy: 'sma',
        strategyParams: {},
        dateRange: [Date.now() - 30 * 24 * 60 * 60 * 1000, Date.now()],
        initialCapital: 10000,
        stats: {
          totalReturn: 15,
          sharpeRatio: 1.2,
          maxDrawdown: 8,
          winRate: 52,
          totalTrades: 50,
          profitFactor: 1.5,
        },
        createdAt: Date.now(),
        starred: false,
        tags: [],
      },
      {
        id: 'test-2',
        name: 'Test Record 2',
        symbol: 'ETH/USDT',
        strategy: 'rsi',
        strategyParams: {},
        dateRange: [Date.now() - 30 * 24 * 60 * 60 * 1000, Date.now()],
        initialCapital: 5000,
        stats: {
          totalReturn: -5,
          sharpeRatio: 0.5,
          maxDrawdown: 15,
          winRate: 45,
          totalTrades: 30,
          profitFactor: 0.8,
        },
        createdAt: Date.now(),
        starred: true,
        tags: [],
      },
    ];
    localStorage.setItem('backtest_history', JSON.stringify(mockRecords));

    render(<BacktestHistory />);
    
    expect(screen.getByText('共 2 条记录')).toBeInTheDocument();
  });
});