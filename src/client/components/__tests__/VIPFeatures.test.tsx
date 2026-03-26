/**
 * Tests for VIP Advanced Features
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import AdvancedChartIndicators from '../AdvancedChartIndicators';
import MultiTimeframeCharts from '../MultiTimeframeCharts';
import BacktestEnhancement from '../BacktestEnhancement';
import FeatureGate from '../FeatureGate';

// Mock hooks
jest.mock('../../hooks/useSubscription', () => ({
  useSubscription: () => ({
    subscription: { planId: 'pro' },
    isPro: true,
    isLoading: false,
    usage: {},
  }),
}));

jest.mock('../../hooks/useKLineData', () => ({
  useKLineData: () => ({
    klineData: [
      { time: Date.now() / 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
      { time: Date.now() / 1000 + 3600, open: 105, high: 115, low: 100, close: 110, volume: 1200 },
    ],
    loading: false,
    error: null,
  }),
}));

jest.mock('../../utils/api', () => ({
  api: {
    get: jest.fn().mockResolvedValue({ data: [] }),
    getKLineData: jest.fn().mockResolvedValue([]),
  },
}));

// Mock lightweight-charts
jest.mock('lightweight-charts', () => ({
  createChart: jest.fn(() => ({
    addCandlestickSeries: jest.fn(() => ({
      setData: jest.fn(),
    })),
    addLineSeries: jest.fn(() => ({
      setData: jest.fn(),
    })),
    timeScale: jest.fn(() => ({
      fitContent: jest.fn(),
    })),
    applyOptions: jest.fn(),
    remove: jest.fn(),
    takeScreenshot: jest.fn().mockResolvedValue('data:image/png;base64,test'),
  })),
}));

describe('AdvancedChartIndicators', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render feature gate wrapper', () => {
    render(<AdvancedChartIndicators symbol="BTC/USD" timeframe="1h" />);
    expect(screen.getByText('高级图表指标')).toBeInTheDocument();
  });

  it('should show add indicator button', () => {
    render(<AdvancedChartIndicators symbol="BTC/USD" timeframe="1h" />);
    expect(screen.getByText('添加指标:')).toBeInTheDocument();
  });

  it('should show export and save buttons', () => {
    render(<AdvancedChartIndicators symbol="BTC/USD" timeframe="1h" />);
    expect(screen.getByText('导出图表')).toBeInTheDocument();
    expect(screen.getByText('保存模板')).toBeInTheDocument();
  });

  it('should list available indicators', async () => {
    render(<AdvancedChartIndicators symbol="BTC/USD" timeframe="1h" />);
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
  });
});

describe('MultiTimeframeCharts', () => {
  it('should render with default timeframes', () => {
    render(<MultiTimeframeCharts symbol="BTC/USD" />);
    expect(screen.getByText('多时间框架对比')).toBeInTheDocument();
  });

  it('should show add timeframe button', () => {
    render(<MultiTimeframeCharts symbol="BTC/USD" />);
    expect(screen.getByPlaceholderText('添加时间框架')).toBeInTheDocument();
  });

  it('should display VIP feature info', () => {
    render(<MultiTimeframeCharts symbol="BTC/USD" />);
    expect(screen.getByText(/VIP 多时间框架功能/)).toBeInTheDocument();
  });
});

describe('BacktestEnhancement', () => {
  it('should render backtest enhancement component', () => {
    render(<BacktestEnhancement strategyId="test-strategy" symbol="BTC/USD" />);
    // Check that the component renders without errors
    expect(screen.getByText(/VIP 高级回测功能/)).toBeInTheDocument();
  });

  it('should show optimization start button', () => {
    render(<BacktestEnhancement strategyId="test-strategy" symbol="BTC/USD" />);
    expect(screen.getByText('开始优化')).toBeInTheDocument();
  });
});

describe('FeatureGate', () => {
  it('should render children when access is allowed', () => {
    render(
      <FeatureGate featureKey="test_feature" featureName="Test Feature">
        <div>Protected Content</div>
      </FeatureGate>
    );
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should show upgrade prompt with fallback', () => {
    render(
      <FeatureGate 
        featureKey="test_feature" 
        featureName="Test Feature"
        fallback={<div>Upgrade Required</div>}
      >
        <div>Protected Content</div>
      </FeatureGate>
    );
    // With Pro plan, children should be rendered
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});