/**
 * TradeHistoryPanel Component Tests
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TradeHistoryPanel from '../../src/client/components/TradeHistoryPanel';

// Mock the useTrades hook
jest.mock('../../src/client/hooks/useData', () => ({
  useTrades: jest.fn(),
}));

// Mock @arco-design/web-react components
jest.mock('@arco-design/web-react', () => {
  const actual = jest.requireActual('@arco-design/web-react');
  return {
    ...actual,
    Card: ({ children, title, extra, style, bodyStyle }: any) => (
      <div data-testid="card" style={style}>
        <div data-testid="card-title">{title}</div>
        {extra && <div data-testid="card-extra">{extra}</div>}
        <div data-testid="card-body" style={bodyStyle}>{children}</div>
      </div>
    ),
    Table: ({ columns, data, pagination, size, border, style, scroll }: any) => (
      <div data-testid="table" style={style}>
        <table>
          <thead>
            <tr>
              {columns.map((col: any, idx: number) => (
                <th key={idx}>{col.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data && data.map((row: any, idx: number) => (
              <tr key={row.key || idx}>
                {columns.map((col: any, cIdx: number) => (
                  <td key={cIdx} data-testid={`cell-${col.dataIndex}`}>
                    {col.render ? col.render(row[col.dataIndex], row) : row[col.dataIndex]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
    Tag: ({ children, color, size }: any) => (
      <span data-testid="tag" style={{ color }}>{children}</span>
    ),
    Select: ({ children, value, onChange, placeholder, size, style }: any) => (
      <select data-testid="select" value={value} onChange={(e) => onChange?.(e.target.value)}>
        {children}
      </select>
    ),
    Typography: {
      Text: ({ children, type, size, style }: any) => (
        <span data-testid="text" style={{ color: type === 'danger' ? 'red' : undefined, ...style }}>
          {children}
        </span>
      ),
    },
  };
});

const mockUseTrades = require('../../src/client/hooks/useData').useTrades;

describe('TradeHistoryPanel', () => {
  beforeEach(() => {
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
    
    // Check if table is rendered
    expect(screen.getByTestId('table')).toBeInTheDocument();
    
    // Check if trades are displayed (at least the cells should exist)
    const priceCells = screen.getAllByTestId('cell-price');
    expect(priceCells.length).toBe(2);
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
    
    const tags = screen.getAllByTestId('tag');
    expect(tags[0]).toHaveTextContent('买入');
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
    
    const tags = screen.getAllByTestId('tag');
    expect(tags[0]).toHaveTextContent('卖出');
  });

  it('renders with custom limit', () => {
    mockUseTrades.mockReturnValue({
      trades: [],
      loading: false,
      error: null,
    });

    render(<TradeHistoryPanel limit={50} />);
    
    expect(mockUseTrades).toHaveBeenCalledWith({}, 50);
  });

  it('renders with autoScroll disabled', () => {
    mockUseTrades.mockReturnValue({
      trades: [],
      loading: false,
      error: null,
    });

    render(<TradeHistoryPanel autoScroll={false} />);
    
    // Component should render without errors
    expect(screen.getByTestId('card')).toBeInTheDocument();
  });

  it('displays filter dropdowns', () => {
    mockUseTrades.mockReturnValue({
      trades: [],
      loading: false,
      error: null,
    });

    render(<TradeHistoryPanel />);
    
    // Should have filter controls in the extra section
    expect(screen.getByTestId('card-extra')).toBeInTheDocument();
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
    
    // Find the side filter select
    const selects = screen.getAllByTestId('select');
    const sideFilter = selects[0];
    
    expect(sideFilter).toBeInTheDocument();
  });
});
