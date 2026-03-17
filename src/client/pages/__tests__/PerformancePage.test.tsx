import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock ResizeObserver first
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock the config module first
jest.mock('../../utils/config', () => ({
  validateConfig: jest.fn(() => ({
    apiUrl: 'http://localhost:3000/api',
    wsUrl: 'ws://localhost:3000',
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'test-key',
    isConfigured: true,
    missingVars: [],
  })),
  isSupabaseConfigValid: jest.fn(() => true),
  getConfigErrorMessage: jest.fn(() => ''),
}));

// Mock recharts
jest.mock('recharts', () => {
  const MockComponent = ({ children, 'data-testid': testId }: any) => 
    React.createElement('div', { 'data-testid': testId }, children);
  
  return {
    ResponsiveContainer: (props: any) => MockComponent({ ...props, 'data-testid': 'responsive-container' }),
    AreaChart: (props: any) => MockComponent({ ...props, 'data-testid': 'area-chart' }),
    ComposedChart: (props: any) => MockComponent({ ...props, 'data-testid': 'composed-chart' }),
    BarChart: (props: any) => MockComponent({ ...props, 'data-testid': 'bar-chart' }),
    PieChart: (props: any) => MockComponent({ ...props, 'data-testid': 'pie-chart' }),
    ScatterChart: (props: any) => MockComponent({ ...props, 'data-testid': 'scatter-chart' }),
    Line: () => React.createElement('div', { 'data-testid': 'line' }),
    Area: () => React.createElement('div', { 'data-testid': 'area' }),
    Bar: () => React.createElement('div', { 'data-testid': 'bar' }),
    Pie: () => React.createElement('div', { 'data-testid': 'pie' }),
    Scatter: () => React.createElement('div', { 'data-testid': 'scatter' }),
    Cell: () => React.createElement('div', { 'data-testid': 'cell' }),
    XAxis: () => React.createElement('div', { 'data-testid': 'x-axis' }),
    YAxis: () => React.createElement('div', { 'data-testid': 'y-axis' }),
    ZAxis: () => React.createElement('div', { 'data-testid': 'z-axis' }),
    CartesianGrid: () => React.createElement('div', { 'data-testid': 'cartesian-grid' }),
    Tooltip: () => React.createElement('div', { 'data-testid': 'tooltip' }),
    Legend: () => React.createElement('div', { 'data-testid': 'legend' }),
    ReferenceLine: () => React.createElement('div', { 'data-testid': 'reference-line' }),
  };
});

// Mock the hooks
jest.mock('../../hooks/useData', () => ({
  useStats: jest.fn(() => ({
    stats: {
      totalStrategies: 5,
      activeStrategies: 3,
      totalTrades: 100,
      totalVolume: 50000,
      buyTrades: 60,
      sellTrades: 40,
    },
    loading: false,
  })),
  useStrategies: jest.fn(() => ({
    strategies: [
      {
        id: 'strategy-1',
        name: 'Test Strategy 1',
        symbol: 'BTC/USDT',
        status: 'active',
        description: 'A test strategy',
        config: {},
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      },
    ],
    loading: false,
  })),
  useTrades: jest.fn(() => ({
    trades: [
      {
        id: 'trade-1',
        strategyId: 'strategy-1',
        symbol: 'BTC/USDT',
        side: 'buy' as const,
        price: 50000,
        quantity: 0.1,
        total: 5000,
        executedAt: '2024-01-01T10:00:00Z',
      },
      {
        id: 'trade-2',
        strategyId: 'strategy-1',
        symbol: 'BTC/USDT',
        side: 'sell' as const,
        price: 51000,
        quantity: 0.1,
        total: 5100,
        executedAt: '2024-01-01T11:00:00Z',
      },
    ],
    loading: false,
  })),
  usePortfolio: jest.fn(() => ({
    portfolio: {
      id: 'portfolio-1',
      strategyId: 'strategy-1',
      symbol: 'BTC/USDT',
      baseCurrency: 'USDT',
      quoteCurrency: 'BTC',
      cashBalance: 50000,
      positions: [
        {
          symbol: 'BTC',
          quantity: 0.5,
          averageCost: 48000,
        },
      ],
      totalValue: 74000,
      snapshotAt: '2024-01-01T00:00:00Z',
    },
    loading: false,
  })),
}));

// Mock usePortfolioAnalytics
jest.mock('../../hooks/usePortfolioAnalytics', () => ({
  usePortfolioAnalytics: jest.fn(() => ({
    riskMetrics: {
      volatility: 15.5,
      maxDrawdown: 5000,
      maxDrawdownPercent: 8.5,
      sharpeRatio: 1.2,
      sortinoRatio: 1.5,
      valueAtRisk95: 2000,
      expectedShortfall: 2500,
    },
    performanceMetrics: {
      totalReturn: 10000,
      totalReturnPercent: 12.5,
      dailyPnL: 500,
      weeklyPnL: 2000,
      monthlyPnL: 5000,
      dailyPnLPercent: 0.5,
      weeklyPnLPercent: 2.0,
      monthlyPnLPercent: 5.0,
      winRate: 65.0,
      averageTradeDuration: 24,
      totalTrades: 100,
      winningTrades: 65,
      losingTrades: 35,
      averageWin: 200,
      averageLoss: 100,
      profitFactor: 2.0,
      bestTrade: 500,
      worstTrade: -200,
    },
    positionAnalysis: {
      positions: [],
      topGainers: [],
      topLosers: [],
      concentrationRisk: 0.25,
      largestPositionWeight: 50,
    },
    pnlBreakdown: {
      daily: { realized: 500, unrealized: 100, total: 600 },
      weekly: { realized: 2000, unrealized: 300, total: 2300 },
      monthly: { realized: 5000, unrealized: 500, total: 5500 },
      allTime: { realized: 10000, unrealized: 1000, total: 11000 },
    },
    isLoading: false,
  })),
}));

// Mock API
jest.mock('../../utils/api', () => ({
  api: {
    getStrategyRank: jest.fn().mockResolvedValue({
      metrics: {
        strategyId: 'strategy-1',
        strategyName: 'Test Strategy 1',
        status: 'active',
        totalTrades: 50,
        totalVolume: 25000,
        totalPnL: 5000,
        roi: 10.5,
        winRate: 65.0,
        sharpeRatio: 1.2,
        maxDrawdown: 5.0,
        avgTradeSize: 500,
        profitableTrades: 32,
        losingTrades: 18,
        consecutiveWins: 5,
        consecutiveLosses: 2,
        bestTrade: 500,
        worstTrade: -200,
        calculatedAt: '2024-01-01T00:00:00Z',
      },
    }),
  },
  Strategy: {},
  Trade: {},
  StrategyMetrics: {},
}));

// Import after mocks
import PerformancePage from '../PerformancePage';

describe('PerformancePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the page title', () => {
    render(<PerformancePage />);
    
    expect(screen.getByText('交易绩效监控')).toBeInTheDocument();
  });

  it('should render metric cards', () => {
    render(<PerformancePage />);
    
    expect(screen.getByText('总收益')).toBeInTheDocument();
    expect(screen.getByText('收益率')).toBeInTheDocument();
    expect(screen.getByText('最大回撤')).toBeInTheDocument();
    expect(screen.getByText('夏普比率')).toBeInTheDocument();
  });

  it('should render chart sections', () => {
    render(<PerformancePage />);
    
    expect(screen.getByText('收益曲线')).toBeInTheDocument();
    expect(screen.getByText('回撤曲线')).toBeInTheDocument();
    expect(screen.getByText('月度收益')).toBeInTheDocument();
    expect(screen.getByText('资产配置')).toBeInTheDocument();
  });

  it('should render strategy comparison section', () => {
    render(<PerformancePage />);
    
    expect(screen.getByText('策略对比')).toBeInTheDocument();
    expect(screen.getByText('策略风险收益分布')).toBeInTheDocument();
  });

  it('should display time range selector', async () => {
    render(<PerformancePage />);
    
    // Find the select component by its default value
    const selectElement = document.querySelector('.arco-select');
    expect(selectElement).toBeInTheDocument();
  });

  it('should handle empty trades data gracefully', () => {
    const { useTrades } = require('../../hooks/useData');
    useTrades.mockReturnValueOnce({ trades: [], loading: false });

    render(<PerformancePage />);
    
    // Should show empty state
    expect(screen.getByText(/暂无交易数据/)).toBeInTheDocument();
  });
});
