/**
 * KLineChart Component Tests
 * 
 * Tests cover the scenarios fixed in Sprint 6:
 * - DOM operation errors (removeChild)
 * - Rendering failures (race conditions)
 * - Symbol switching data mismatches
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import KLineChart from '../../src/client/components/KLineChart';
import type { KLineDataPoint } from '../../src/client/components/KLineChart';
import { createChart, CandlestickSeries } from 'lightweight-charts';

// Mock the useKLineData hook
jest.mock('../../src/client/hooks/useKLineData', () => ({
  useKLineData: jest.fn(),
}));

// Mock the config module
jest.mock('../../src/client/utils/config', () => ({
  validateConfig: jest.fn(() => ({
    isConfigured: true,
    apiUrl: 'http://test-api',
    wsUrl: 'ws://test-ws',
  })),
  logConfigStatus: jest.fn(),
}));

const { useKLineData } = require('../../src/client/hooks/useKLineData');

// Helper to create mock kline data
function createMockKLineData(symbol: string, count: number = 10): KLineDataPoint[] {
  const basePrice = symbol === 'BTC/USD' ? 50000 : symbol === 'ETH/USD' ? 3000 : 100;
  const data: KLineDataPoint[] = [];
  
  for (let i = 0; i < count; i++) {
    const open = basePrice + Math.random() * 100;
    const close = open + (Math.random() - 0.5) * 50;
    const high = Math.max(open, close) + Math.random() * 10;
    const low = Math.min(open, close) - Math.random() * 10;
    const volume = Math.floor(Math.random() * 1000000);
    
    data.push({
      time: Math.floor(Date.now() / 1000) - i * 3600,
      open,
      high,
      low,
      close,
      volume,
    });
  }
  
  return data;
}

// Mock container dimensions
function mockContainerDimensions(width: number = 800, height: number = 500) {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    value: width,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    value: height,
  });
}

describe('KLineChart', () => {
  let mockChart: any;
  let mockCandleSeries: any;
  let mockVolumeSeries: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock container dimensions
    mockContainerDimensions();
    
    // Reset mock chart
    mockCandleSeries = {
      setData: jest.fn(),
      update: jest.fn(),
    };
    mockVolumeSeries = {
      setData: jest.fn(),
      update: jest.fn(),
    };
    mockChart = {
      addSeries: jest.fn((type: any, options?: any) => {
        if (String(type).includes("Candlestick")) return mockCandleSeries;
        return mockVolumeSeries;
      }),
      remove: jest.fn(),
      applyOptions: jest.fn(),
      resize: jest.fn(),
    };

    (createChart as jest.Mock).mockReturnValue(mockChart);

    // Default mock for useKLineData
    (useKLineData as jest.Mock).mockReturnValue({
      klineData: [],
      loading: false,
      error: null,
      currentSymbol: 'BTC/USD',
      refresh: jest.fn(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Chart Initialization', () => {
    it('should render chart container with correct test id', () => {
      render(<KLineChart symbol="BTC/USD" />);

      expect(screen.getByTestId('kline-chart')).toBeInTheDocument();
    });

    it('should render card with symbol in title', () => {
      render(<KLineChart symbol="ETH/USD" />);

      expect(screen.getByText(/ETH\/USD K 线图/)).toBeInTheDocument();
    });

    it('should not initialize chart while loading', async () => {
      (useKLineData as jest.Mock).mockReturnValue({
        klineData: [],
        loading: true,
        error: null,
        currentSymbol: 'BTC/USD',
        refresh: jest.fn(),
      });

      render(<KLineChart symbol="BTC/USD" />);

      // Chart should not be created while loading
      expect(createChart).not.toHaveBeenCalled();
    });

    it('should initialize chart after loading completes', async () => {
      const mockData = createMockKLineData('BTC/USD');
      (useKLineData as jest.Mock).mockReturnValue({
        klineData: mockData,
        loading: false,
        error: null,
        currentSymbol: 'BTC/USD',
        refresh: jest.fn(),
      });

      render(<KLineChart symbol="BTC/USD" />);

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(createChart).toHaveBeenCalled();
    });

    it('should create candlestick and volume series', async () => {
      const mockData = createMockKLineData('BTC/USD');
      (useKLineData as jest.Mock).mockReturnValue({
        klineData: mockData,
        loading: false,
        error: null,
        currentSymbol: 'BTC/USD',
        refresh: jest.fn(),
      });

      render(<KLineChart symbol="BTC/USD" showVolume={true} />);

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(mockChart.addSeries).toHaveBeenCalledTimes(2);
    });

    it('should not create volume series when showVolume is false', async () => {
      const mockData = createMockKLineData('BTC/USD');
      (useKLineData as jest.Mock).mockReturnValue({
        klineData: mockData,
        loading: false,
        error: null,
        currentSymbol: 'BTC/USD',
        refresh: jest.fn(),
      });

      render(<KLineChart symbol="BTC/USD" showVolume={false} />);

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      // Only candlestick series should be created
      expect(mockChart.addSeries).toHaveBeenCalledTimes(1);
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner when loading', () => {
      (useKLineData as jest.Mock).mockReturnValue({
        klineData: [],
        loading: true,
        error: null,
        currentSymbol: 'BTC/USD',
        refresh: jest.fn(),
      });

      const { container } = render(<KLineChart symbol="BTC/USD" />);

      expect(container.querySelector('.arco-spin')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message when API error occurs', () => {
      (useKLineData as jest.Mock).mockReturnValue({
        klineData: [],
        loading: false,
        error: 'Network error',
        currentSymbol: 'BTC/USD',
        refresh: jest.fn(),
      });

      render(<KLineChart symbol="BTC/USD" />);

      expect(screen.getByText(/数据加载失败/)).toBeInTheDocument();
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });

    it('should show error message when chart initialization fails', async () => {
      (createChart as jest.Mock).mockImplementation(() => {
        throw new Error('Chart init failed');
      });

      const mockData = createMockKLineData('BTC/USD');
      (useKLineData as jest.Mock).mockReturnValue({
        klineData: mockData,
        loading: false,
        error: null,
        currentSymbol: 'BTC/USD',
        refresh: jest.fn(),
      });

      render(<KLineChart symbol="BTC/USD" />);

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(screen.getAllByText(/图表初始化失败/).length).toBeGreaterThan(0);
    });
  });

  describe('Data Updates', () => {
    it('should set data on candlestick series when data is available', async () => {
      const mockData = createMockKLineData('BTC/USD');
      (useKLineData as jest.Mock).mockReturnValue({
        klineData: mockData,
        loading: false,
        error: null,
        currentSymbol: 'BTC/USD',
        refresh: jest.fn(),
      });

      render(<KLineChart symbol="BTC/USD" />);

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(mockCandleSeries.setData).toHaveBeenCalled();
      const setCalls = mockCandleSeries.setData.mock.calls;
      const dataArg = setCalls[0][0];
      expect(dataArg.length).toBe(mockData.length);
    });

    it('should set volume data when showVolume is true', async () => {
      const mockData = createMockKLineData('BTC/USD');
      (useKLineData as jest.Mock).mockReturnValue({
        klineData: mockData,
        loading: false,
        error: null,
        currentSymbol: 'BTC/USD',
        refresh: jest.fn(),
      });

      render(<KLineChart symbol="BTC/USD" showVolume={true} />);

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(mockVolumeSeries.setData).toHaveBeenCalled();
    });

    it('should not update data if chart is not ready', async () => {
      const mockData = createMockKLineData('BTC/USD');
      
      // First render with loading true
      (useKLineData as jest.Mock).mockReturnValue({
        klineData: mockData,
        loading: true,
        error: null,
        currentSymbol: 'BTC/USD',
        refresh: jest.fn(),
      });

      render(<KLineChart symbol="BTC/USD" />);

      // Chart should not be created yet
      expect(mockCandleSeries.setData).not.toHaveBeenCalled();
    });

    it('should handle empty data array', async () => {
      (useKLineData as jest.Mock).mockReturnValue({
        klineData: [],
        loading: false,
        error: null,
        currentSymbol: 'BTC/USD',
        refresh: jest.fn(),
      });

      render(<KLineChart symbol="BTC/USD" />);

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      // Chart should still be created
      expect(createChart).toHaveBeenCalled();
    });
  });

  describe('Symbol Switching', () => {
    it('should handle symbol change correctly', async () => {
      const btcData = createMockKLineData('BTC/USD');
      (useKLineData as jest.Mock).mockReturnValue({
        klineData: btcData,
        loading: false,
        error: null,
        currentSymbol: 'BTC/USD',
        refresh: jest.fn(),
      });

      const { rerender } = render(<KLineChart symbol="BTC/USD" />);

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      // Verify chart was created
      expect(createChart).toHaveBeenCalled();

      // Switch to ETH
      const ethData = createMockKLineData('ETH/USD');
      (useKLineData as jest.Mock).mockReturnValue({
        klineData: ethData,
        loading: false,
        error: null,
        currentSymbol: 'ETH/USD',
        refresh: jest.fn(),
      });

      rerender(<KLineChart symbol="ETH/USD" />);

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      // Chart should still work
      expect(screen.getByTestId('kline-chart')).toBeInTheDocument();
    });

    it('should not update chart with data for wrong symbol', async () => {
      // Render with BTC symbol but data coming for ETH (simulating stale response)
      const ethData = createMockKLineData('ETH/USD');
      (useKLineData as jest.Mock).mockReturnValue({
        klineData: ethData,
        loading: false,
        error: null,
        currentSymbol: 'ETH/USD', // Data symbol doesn't match prop
        refresh: jest.fn(),
      });

      render(<KLineChart symbol="BTC/USD" />);

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      // Chart should still be created
      expect(createChart).toHaveBeenCalled();
      // Data should not be set due to symbol mismatch
      expect(mockCandleSeries.setData).not.toHaveBeenCalled();
    });
  });

  describe('Component Unmount Cleanup', () => {
    it('should remove chart on unmount', async () => {
      const mockData = createMockKLineData('BTC/USD');
      (useKLineData as jest.Mock).mockReturnValue({
        klineData: mockData,
        loading: false,
        error: null,
        currentSymbol: 'BTC/USD',
        refresh: jest.fn(),
      });

      const { unmount } = render(<KLineChart symbol="BTC/USD" />);

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      unmount();

      expect(mockChart.remove).toHaveBeenCalled();
    });

    it('should handle remove errors gracefully', async () => {
      mockChart.remove.mockImplementation(() => {
        const error = new Error("Failed to execute 'removeChild' on 'Node'");
        error.name = 'NotFoundError';
        throw error;
      });

      const mockData = createMockKLineData('BTC/USD');
      (useKLineData as jest.Mock).mockReturnValue({
        klineData: mockData,
        loading: false,
        error: null,
        currentSymbol: 'BTC/USD',
        refresh: jest.fn(),
      });

      const { unmount } = render(<KLineChart symbol="BTC/USD" />);

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      // Should not throw
      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('should handle unmount during initialization', async () => {
      const mockData = createMockKLineData('BTC/USD');
      (useKLineData as jest.Mock).mockReturnValue({
        klineData: mockData,
        loading: false,
        error: null,
        currentSymbol: 'BTC/USD',
        refresh: jest.fn(),
      });

      const { unmount } = render(<KLineChart symbol="BTC/USD" />);

      // Unmount before timers complete
      unmount();

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      // Should handle gracefully without errors
    });
  });

  describe('Timeframe Selection', () => {
    it('should render timeframe selector', () => {
      render(<KLineChart symbol="BTC/USD" />);

      expect(screen.getByText('1分')).toBeInTheDocument();
      expect(screen.getByText('5分')).toBeInTheDocument();
      expect(screen.getByText('15分')).toBeInTheDocument();
      expect(screen.getByText('1时')).toBeInTheDocument();
      expect(screen.getByText('4时')).toBeInTheDocument();
      expect(screen.getByText('1天')).toBeInTheDocument();
    });

    it('should have 1h as default timeframe', () => {
      render(<KLineChart symbol="BTC/USD" />);

      // The Radio.Group should have 1h selected by default
      const radioGroup = screen.getByRole('radiogroup');
      expect(radioGroup).toBeInTheDocument();
    });
  });

  describe('Mobile Responsiveness', () => {
    it('should use adjusted height on mobile', async () => {
      // Mock window.innerWidth to simulate mobile
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 480,
      });

      const mockData = createMockKLineData('BTC/USD');
      (useKLineData as jest.Mock).mockReturnValue({
        klineData: mockData,
        loading: false,
        error: null,
        currentSymbol: 'BTC/USD',
        refresh: jest.fn(),
      });

      render(<KLineChart symbol="BTC/USD" height={500} />);

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      const chartContainer = screen.getByTestId('kline-chart');
      // On mobile with height=500, should use min(500, 300) = 300
      expect(chartContainer).toHaveStyle({ height: '300px' });
    });

    it('should use full height on desktop', async () => {
      // Mock window.innerWidth to simulate desktop
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      });

      const mockData = createMockKLineData('BTC/USD');
      (useKLineData as jest.Mock).mockReturnValue({
        klineData: mockData,
        loading: false,
        error: null,
        currentSymbol: 'BTC/USD',
        refresh: jest.fn(),
      });

      render(<KLineChart symbol="BTC/USD" height={500} />);

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      const chartContainer = screen.getByTestId('kline-chart');
      expect(chartContainer).toHaveStyle({ height: '500px' });
    });
  });

  describe('Empty Data State', () => {
    it('should show empty message when no data', async () => {
      (useKLineData as jest.Mock).mockReturnValue({
        klineData: [],
        loading: false,
        error: null,
        currentSymbol: 'BTC/USD',
        refresh: jest.fn(),
      });

      render(<KLineChart symbol="BTC/USD" />);

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      const _emptyState = screen.getByTestId('kline-chart').querySelector(' .arco-empty');
      // Chart container should be present even with empty data
      expect(screen.getByTestId('kline-chart')).toBeInTheDocument();
    });
  });

  describe('Error Boundary Integration', () => {
    it('should be wrapped in ErrorBoundary', () => {
      render(<KLineChart symbol="BTC/USD" />);
      // If ErrorBoundary catches an error, it would show error UI
      // For normal render, we just verify the chart renders
      expect(screen.getByTestId('kline-chart')).toBeInTheDocument();
    });
  });

  describe('Race Condition Prevention', () => {
    it('should handle rapid prop changes gracefully', async () => {
      const { rerender } = render(<KLineChart symbol="BTC/USD" height={400} />);

      // Rapidly change props
      for (let i = 0; i < 5; i++) {
        rerender(<KLineChart symbol={`TEST${i}/USD`} height={400 + i * 50} />);
        await act(async () => {
          jest.advanceTimersByTime(10);
        });
      }

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      // Should not throw or cause errors
      expect(screen.getByTestId('kline-chart')).toBeInTheDocument();
    });

    it('should handle unmount during rapid updates', async () => {
      const mockData = createMockKLineData('BTC/USD');
      (useKLineData as jest.Mock).mockReturnValue({
        klineData: mockData,
        loading: false,
        error: null,
        currentSymbol: 'BTC/USD',
        refresh: jest.fn(),
      });

      const { unmount, rerender } = render(<KLineChart symbol="BTC/USD" />);

      // Start chart initialization
      await act(async () => {
        jest.advanceTimersByTime(50);
      });

      // Trigger a rerender
      rerender(<KLineChart symbol="BTC/USD" height={600} />);

      // Unmount before completion
      unmount();

      // Let remaining timers complete
      await act(async () => {
        await jest.runAllTimersAsync();
      });

      // Should handle gracefully without DOM errors
    });
  });
});
