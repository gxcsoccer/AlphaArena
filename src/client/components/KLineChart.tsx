import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, UTCTimestamp, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import { Card, Radio, Spin, Empty, Typography } from '@arco-design/web-react';
import { useKLineData } from '../hooks/useKLineData';
import ErrorBoundary from './ErrorBoundary';
import { logConfigStatus, validateConfig } from '../utils/config';
import { createLogger } from '../../utils/logger';

const { Text } = Typography;

// Create logger for this module
const log = createLogger('KLineChart');

export interface KLineDataPoint {
  time: number; // timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type TimeFrame = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

interface KLineChartProps {
  symbol?: string;
  height?: number;
  showVolume?: boolean;
}

const TIMEFRAME_LABELS: Record<TimeFrame, string> = {
  '1m': '1 分钟',
  '5m': '5 分钟',
  '15m': '15 分钟',
  '1h': '1 小时',
  '4h': '4 小时',
  '1d': '1 天',
};

/**
 * Safely remove a chart instance, catching DOM-related errors
 * that can occur when React StrictMode or Arco Design Spin component
 * manipulates the DOM during cleanup.
 */
function safeRemoveChart(chart: IChartApi | null): void {
  if (!chart) return;
  try {
    chart.remove();
  } catch (err: any) {
    // Ignore DOM-related errors that occur due to React StrictMode
    // or Arco Design Spin component interactions
    if (!err.message?.includes('removeChild') &&
        !err.message?.includes('not a child') &&
        err.name !== 'NotFoundError') {
      log.error('Unexpected error during chart removal', err);
    }
  }
}

const KLineChartInner: React.FC<KLineChartProps> = ({
  symbol = 'BTC/USD',
  height = 500,
  showVolume = true,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [timeframe, setTimeframe] = useState<TimeFrame>('1h');
  const [isMobile, setIsMobile] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [chartReady, setChartReady] = useState(false); // Track when chart is ready for data
  const { klineData, loading, error, currentSymbol } = useKLineData(symbol, timeframe);

  // Track the current symbol to detect changes and clear chart data
  const prevSymbolRef = useRef<string>(symbol);

  // Mount state tracking to prevent DOM operations after unmount
  const isMountedRef = useRef(true);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const initRafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  // Log configuration on mount for debugging
  useEffect(() => {
    log.debug('Component mounted, checking configuration...');
    const config = validateConfig();
    logConfigStatus(config);
  }, []);

  // Track mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Adjust height for mobile
  const adjustedHeight = isMobile ? Math.min(height, 300) : height;

  /**
   * Cleanup function that safely removes chart and observers.
   * Must be called when component unmounts or when chart needs to be re-initialized.
   */
  const cleanupChart = useCallback(() => {
    log.debug('Cleaning up chart resources...');
    setChartReady(false); // Mark chart as not ready

    // Cancel any pending animation frame
    if (initRafRef.current) {
      cancelAnimationFrame(initRafRef.current);
      initRafRef.current = null;
    }

    // Disconnect resize observer
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }

    // Safely remove chart
    if (chartRef.current) {
      safeRemoveChart(chartRef.current);
      chartRef.current = null;
    }

    // Clear series refs
    candleSeriesRef.current = null;
    volumeSeriesRef.current = null;
  }, []);

  // Clear chart data when symbol changes
  useEffect(() => {
    if (prevSymbolRef.current !== symbol) {
      log.debug('Symbol changed', { from: prevSymbolRef.current, to: symbol });
      prevSymbolRef.current = symbol;
      
      // Clear chart data immediately
      if (candleSeriesRef.current) {
        try {
          candleSeriesRef.current.setData([]);
        } catch (err) {
          log.warn('Error clearing candlestick data', err);
        }
      }
      if (volumeSeriesRef.current) {
        try {
          volumeSeriesRef.current.setData([]);
        } catch (err) {
          log.warn('Error clearing volume data', err);
        }
      }
    }
  }, [symbol]);

  // Initialize chart - use useLayoutEffect for DOM operations
  // Wait for loading to complete before initializing to avoid DOM conflicts with Spin
  useLayoutEffect(() => {
    // Skip if loading - wait for data to be ready
    if (loading) {
      log.debug('Loading in progress, deferring chart initialization...');
      return;
    }

    if (!chartContainerRef.current) {
      log.error('Chart container ref is null');
      setChartError('图表容器未就绪');
      return;
    }

    const container = chartContainerRef.current;

    /**
     * Initialize chart with proper error handling and mount state checks.
     */
    const initializeChart = (): boolean => {
      // Check mount state before proceeding
      if (!isMountedRef.current) {
        log.debug('Component unmounted, aborting initialization');
        return false;
      }

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      log.debug('Initializing chart', { width: containerWidth, containerHeight, height });

      if (containerWidth <= 0) {
        log.warn('Container width is still 0, will retry...');
        return false;
      }

      if (containerHeight <= 0 && height <= 0) {
        log.warn('Container height is 0 and no height prop, will retry...');
        return false;
      }

      try {
        log.info('Starting chart initialization...');

        // Validate container is a valid DOM element
        if (!(container instanceof HTMLElement)) {
          throw new Error('Chart container is not a valid HTML element');
        }
        log.debug('Container validation passed');

        // Clear any existing chart content
        container.innerHTML = '';
        log.debug('Container cleared');

        const chartOptions = {
          width: containerWidth,
          height: height > 0 ? height : 400,
          layout: {
            background: { type: 'solid', color: '#1a1a1a' },
            textColor: '#d1d4dc',
          },
          grid: {
            vertLines: { color: '#2B2B43' },
            horzLines: { color: '#2B2B43' },
          },
          crosshair: {
            mode: 1, // MagnetMode
          },
          timeScale: {
            borderColor: '#2B2B43',
            timeVisible: true,
            secondsVisible: false,
          },
        };
        log.debug('Chart options', chartOptions);

        const chart = createChart(container, chartOptions);
        log.debug('createChart called', { valid: !!chart });

        if (!chart) {
          throw new Error('createChart returned null/undefined');
        }

        chartRef.current = chart;

        // Create candlestick series - lightweight-charts v5.x API
        log.debug('Creating candlestick series...');
        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: '#26a69a',
          downColor: '#ef5350',
          borderVisible: false,
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350',
        });
        log.debug('Candlestick series created', { valid: !!candleSeries });

        if (!candleSeries) {
          throw new Error('Failed to create candlestick series');
        }

        candleSeriesRef.current = candleSeries;

        // Create volume series (overlay at bottom)
        if (showVolume) {
          log.debug('Creating volume series...');
          const volumeSeries = chart.addSeries(HistogramSeries, {
            color: '#26a69a',
            priceFormat: {
              type: 'volume',
            },
            priceScaleId: '', // Overlay on main chart
            scaleMargins: {
              top: 0.8, // Push to bottom
              bottom: 0,
            },
          });
          log.debug('Volume series created', { valid: !!volumeSeries });

          if (!volumeSeries) {
            throw new Error('Failed to create volume series');
          }

          volumeSeriesRef.current = volumeSeries;
        }

        log.info('Chart initialized successfully');
        setChartError(null); // Clear any previous errors
        setChartReady(true); // Mark chart as ready for data
        return true;
      } catch (err: any) {
        log.error('Failed to initialize chart', err, {
          message: err.message,
          name: err.name,
        });
        if (isMountedRef.current) {
          setChartError(`图表初始化失败：${err.message || '未知错误'}`);
        }
        return false;
      }
    };

    // Delay initialization with requestAnimationFrame to ensure DOM is stable
    // This helps avoid conflicts with Arco Design Spin component's DOM operations
    initRafRef.current = requestAnimationFrame(() => {
      if (!isMountedRef.current) {
        log.debug('Component unmounted during RAF, aborting');
        return;
      }

      const initialized = initializeChart();

      // If not initialized (width was 0), set up a ResizeObserver to retry
      if (!initialized && isMountedRef.current) {
        const resizeObserver = new ResizeObserver(() => {
          // Only try to initialize if chart doesn't exist yet and component is mounted
          if (!chartRef.current && chartContainerRef.current && isMountedRef.current) {
            const success = initializeChart();
            if (success && resizeObserverRef.current) {
              resizeObserverRef.current.disconnect();
              resizeObserverRef.current = null;
            }
          }
        });

        resizeObserverRef.current = resizeObserver;
        resizeObserver.observe(container);
      }
    });

    // Handle resize for already-initialized chart
    const handleResize = () => {
      if (!isMountedRef.current) return;
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cleanupChart();
    };
  }, [height, showVolume, loading, cleanupChart]);

  // Update data when chart is ready or data changes
  useEffect(() => {
    // Wait for chart to be ready before setting data
    if (!chartReady) {
      log.debug('Chart not ready yet, waiting...');
      return;
    }

    if (!candleSeriesRef.current) {
      log.warn('Candle series not ready, skipping data update');
      return;
    }

    if (!klineData) {
      log.warn('No K-line data available yet');
      return;
    }

    // Verify data matches current symbol
    if (currentSymbol !== symbol) {
      log.warn('Data symbol mismatch', { got: currentSymbol, expected: symbol });
      return;
    }

    if (!Array.isArray(klineData)) {
      log.error('Invalid klineData: not an array', { type: typeof klineData });
      if (isMountedRef.current) {
        setChartError('K 线数据格式错误');
      }
      return;
    }

    if (klineData.length === 0) {
      log.debug('Empty klineData, clearing chart');
      try {
        candleSeriesRef.current.setData([]);
        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.setData([]);
        }
      } catch (err: any) {
        log.error('Error clearing chart', err);
      }
      return;
    }

    try {
      log.info('Updating chart data', { points: klineData.length, symbol });

      const firstPoint = klineData[0];
      if (!firstPoint || typeof firstPoint.open !== 'number' || typeof firstPoint.close !== 'number') {
        log.error('Invalid data point structure', { point: firstPoint });
        if (isMountedRef.current) {
          setChartError('K 线数据格式无效');
        }
        return;
      }

      // Log price range for debugging
      const prices = klineData.map(d => d.close);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      log.debug('Price range', { symbol, min: minPrice, max: maxPrice, first: firstPoint.close });

      const candleData: CandlestickData<Time>[] = klineData.map((point, idx) => {
        const time = point.time as UTCTimestamp;
        if (typeof time !== 'number' || time <= 0) {
          log.warn('Invalid timestamp', { index: idx, time });
        }
        return {
          time,
          open: point.open,
          high: point.high,
          low: point.low,
          close: point.close,
        };
      });

      log.debug('Data points', { first: candleData[0], last: candleData[candleData.length - 1] });

      candleSeriesRef.current.setData(candleData);
      log.debug('Candlestick data set successfully');

      if (volumeSeriesRef.current && showVolume) {
        const volumeData = klineData.map(point => ({
          time: point.time as UTCTimestamp,
          value: point.volume,
          color: point.close >= point.open ? '#26a69a80' : '#ef535080',
        }));
        volumeSeriesRef.current.setData(volumeData);
        log.debug('Volume data set successfully');
      }

      if (isMountedRef.current) {
        setChartError(null);
      }
      log.info('Chart data update complete');
    } catch (err: any) {
      log.error('Failed to update chart data', err, {
        message: err.message,
        name: err.name,
      });
      if (isMountedRef.current) {
        setChartError(`图表数据更新失败：${err.message}`);
      }
    }
  }, [chartReady, klineData, showVolume, symbol, currentSymbol]);

  // Handle timeframe change
  const handleTimeframeChange = useCallback((value: TimeFrame) => {
    setTimeframe(value);
  }, []);

  if (error || chartError) {
    return (
      <Card>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <Text type="danger" style={{ fontSize: 16, marginBottom: 16, display: 'block' }}>
            {error ? `数据加载失败：${error}` : chartError}
          </Text>
          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
            {error ? '请检查网络连接或 API 配置' : '图表初始化失败，请检查浏览器控制台日志'}
          </Text>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={`${symbol} K 线图`}
      extra={
        <Radio.Group
          value={timeframe}
          onChange={handleTimeframeChange}
          options={Object.entries(TIMEFRAME_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
          size={isMobile ? 'default' : 'small'}
          style={{ flexWrap: 'wrap' }}
        />
      }
    >
      <Spin loading={loading} style={{ width: '100%' }}>
        <div
          ref={chartContainerRef}
          className="kline-chart-container"
          data-testid="kline-chart"
          style={{ height: `${adjustedHeight}px`, position: 'relative', width: '100%' }}
        >
          {klineData && klineData.length === 0 && (
            <Empty description="暂无 K 线数据" />
          )}
        </div>
      </Spin>
    </Card>
  );
};

// Wrap with ErrorBoundary for component-level error handling
const KLineChart: React.FC<KLineChartProps> = (props) => {
  return (
    <ErrorBoundary>
      <KLineChartInner {...props} />
    </ErrorBoundary>
  );
};

export default KLineChart;
