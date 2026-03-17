/**
 * Tests for Backtest Visualization Components
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Mock recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  ScatterChart: ({ children }: any) => <div data-testid="scatter-chart">{children}</div>,
  Scatter: () => <div data-testid="scatter" />,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  RadarChart: ({ children }: any) => <div data-testid="radar-chart">{children}</div>,
  Radar: () => <div data-testid="radar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  ZAxis: () => <div data-testid="z-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  ReferenceLine: () => <div data-testid="reference-line" />,
  Cell: () => <div data-testid="cell" />,
  PolarGrid: () => <div data-testid="polar-grid" />,
  PolarAngleAxis: () => <div data-testid="polar-angle-axis" />,
  PolarRadiusAxis: () => <div data-testid="polar-radius-axis" />,
}));

// Import components after mocks
import { EquityCurveChart } from '../EquityCurveChart';
import { DrawdownChart } from '../DrawdownChart';
import { ReturnsDistributionChart } from '../ReturnsDistributionChart';
import { ReturnsHeatmapChart } from '../ReturnsHeatmapChart';
import { StrategyComparisonChart } from '../StrategyComparisonChart';
import { TradeAnalysisChart } from '../TradeAnalysisChart';
import { HoldingTimeChart } from '../HoldingTimeChart';

describe('EquityCurveChart', () => {
  const mockData = [
    { timestamp: 1000, date: '2024-01-01', equity: 10000, drawdown: 0, highWaterMark: 10000 },
    { timestamp: 2000, date: '2024-01-02', equity: 10500, drawdown: 0, highWaterMark: 10500 },
    { timestamp: 3000, date: '2024-01-03', equity: 9800, drawdown: -6.67, highWaterMark: 10500 },
  ];

  it('renders with data', () => {
    render(<EquityCurveChart data={mockData} />);
    expect(screen.getByText('资金曲线')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<EquityCurveChart data={[]} loading />);
    expect(screen.getByTestId('spin') || document.querySelector('.arco-spin')).toBeTruthy();
  });

  it('shows empty state when no data', () => {
    render(<EquityCurveChart data={[]} />);
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
  });

  it('displays stats when data provided', () => {
    render(<EquityCurveChart data={mockData} />);
    expect(screen.getByText(/收益:/)).toBeInTheDocument();
  });
});

describe('DrawdownChart', () => {
  const mockData = [
    { timestamp: 1000, date: '2024-01-01', drawdown: 0, peak: 10000, trough: 10000 },
    { timestamp: 2000, date: '2024-01-02', drawdown: -5, peak: 10500, trough: 9975 },
  ];

  it('renders with data', () => {
    render(<DrawdownChart data={mockData} />);
    expect(screen.getByText('回撤曲线')).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    render(<DrawdownChart data={[]} />);
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
  });
});

describe('ReturnsDistributionChart', () => {
  const mockData = [
    { return: -2, count: 5, binStart: -3, binEnd: -1 },
    { return: 0, count: 10, binStart: -1, binEnd: 1 },
    { return: 2, count: 8, binStart: 1, binEnd: 3 },
  ];

  it('renders with data', () => {
    render(<ReturnsDistributionChart data={mockData} />);
    expect(screen.getByText('收益分布')).toBeInTheDocument();
  });

  it('shows stats when data provided', () => {
    render(<ReturnsDistributionChart data={mockData} />);
    expect(screen.getByText('总交易次数')).toBeInTheDocument();
  });
});

describe('ReturnsHeatmapChart', () => {
  const mockData = [
    { year: 2024, month: 1, return: 5.2, trades: 15 },
    { year: 2024, month: 2, return: -2.1, trades: 12 },
  ];

  it('renders with data', () => {
    render(<ReturnsHeatmapChart data={mockData} />);
    expect(screen.getByText('月度收益热力图')).toBeInTheDocument();
  });

  it('shows year labels', () => {
    render(<ReturnsHeatmapChart data={mockData} />);
    expect(screen.getByText('2024')).toBeInTheDocument();
  });
});

describe('StrategyComparisonChart', () => {
  const mockStrategies = [
    {
      id: 'sma',
      name: 'SMA',
      totalReturn: 25.5,
      annualizedReturn: 25.5,
      sharpeRatio: 1.8,
      maxDrawdown: 15.2,
      winRate: 60,
      profitFactor: 2.5,
      totalTrades: 150,
      avgReturn: 0.17,
    },
  ];

  it('renders with strategies', () => {
    render(<StrategyComparisonChart strategies={mockStrategies} />);
    expect(screen.getByText('策略对比')).toBeInTheDocument();
  });

  it('shows strategy table', () => {
    render(<StrategyComparisonChart strategies={mockStrategies} />);
    expect(screen.getByText('SMA')).toBeInTheDocument();
  });
});

describe('TradeAnalysisChart', () => {
  const mockTrades = [
    { timestamp: 1000, date: '2024-01-01', price: 100, side: 'buy' as const, quantity: 10, type: 'entry' as const },
    { timestamp: 2000, date: '2024-01-02', price: 105, side: 'sell' as const, quantity: 10, pnl: 50, type: 'exit' as const },
  ];

  it('renders with trades', () => {
    render(<TradeAnalysisChart trades={mockTrades} />);
    expect(screen.getByText('交易分析')).toBeInTheDocument();
  });

  it('shows trade statistics', () => {
    render(<TradeAnalysisChart trades={mockTrades} />);
    expect(screen.getByText('总交易')).toBeInTheDocument();
  });
});

describe('HoldingTimeChart', () => {
  const mockData = [
    { duration: 1, count: 20, avgPnL: 50, winRate: 60, category: '< 1小时' },
    { duration: 12, count: 15, avgPnL: 30, winRate: 55, category: '4-24小时' },
  ];

  it('renders with data', () => {
    render(<HoldingTimeChart data={mockData} />);
    expect(screen.getByText('持仓时间分布')).toBeInTheDocument();
  });

  it('shows holding time stats', () => {
    render(<HoldingTimeChart data={mockData} />);
    expect(screen.getByText('总交易')).toBeInTheDocument();
  });
});
