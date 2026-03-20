import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, UTCTimestamp, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import { Card, Radio, Spin, Empty, Typography, Space, Button, Tooltip } from '@arco-design/web-react';
import { IconFullscreen, IconFullscreenExit } from '@arco-design/web-react/icon';
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
  '1m': '1分',
  '5m': '5分',
  '15m': '15分',
  '1h': '1时',
  '4h': '4时',
  '1d': '1天',
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
  const [chartReady, setChartReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { klineData, loading, error, currentSymbol } = useKLineData(symbol, timeframe);

  // Pinch-to-zoom state
  const pinchStateRef = useRef<{
    initialDistance: number;
    initialScale: number;
  } | null>(null);

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
  const adjustedHeight = isFullscreen 
    ? window.innerHeight - 120 
    : (isMobile ? Math.min(height, 300) : height);

  /**
   * Cleanup function that safely removes chart and observers.
   */
  const cleanupChart = useCallback(() => {
    log.debug('Cleaning up chart resources...');
    setChartReady(false);

    if (initRafRef.current) {
      cancelAnimationFrame(initRafRef.current);
      initRafRef.current = null;
    }

    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }

    if (chartRef.current) {
      safeRemoveChart(chartRef.current);
      chartRef.current = null;
    }

    candleSeriesRef.current = null;
    volumeSeriesRef.current = null;
  }, []);

  // Handle pinch-to-zoom gesture
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      pinchStateRef.current = {
        initialDistance: distance,
        initialScale: 1,
      };
      
      // Prevent default zoom behavior
      e.preventDefault();
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pinchStateRef.current || e.touches.length !== 2) return;
    
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const scale = distance / pinchStateRef.current.initialDistance;
    
    // Apply scale to chart time scale
    if (chartRef.current) {
      const timeScale = chartRef.current.timeScale();
      const visibleRange = timeScale.getVisibleRange();
      
      if (visibleRange) {
        // Scale the visible range based on pinch gesture
        const center = (visibleRange.from as number + visibleRange.to as number) / 2;
        const halfRange = (visibleRange.to as number - visibleRange.from as number) / 2;
        const newHalfRange = halfRange / scale;
        
        // Clamp to prevent over-zooming
        const clampedHalfRange = Math.max(60, Math.min(newHalfRange, 86400 * 30)); // Min 1 min, max 30 days
        
        timeScale.setVisibleRange({
          from: (center - clampedHalfRange) as Time,
          to: (center + clampedHalfRange) as Time,
        });
      }
    }
    
    pinchStateRef.current.initialDistance = distance;
    
    e.preventDefault();
  }, []);

  const handleTouchEnd = useCallback((_e: TouchEvent) => {
    pinchStateRef.current = null;
  }, []);

  // Clear chart data when symbol changes
  useEffect(() => {
    if (prevSymbolRef.current !== symbol) {
      log.debug('Symbol changed', { from: prevSymbolRef.current, to: symbol });
      prevSymbolRef.current = symbol;
      
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

  // Initialize chart
  useLayoutEffect(() => {
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

    const initializeChart = (): boolean => {
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

        if (!(container instanceof HTMLElement)) {
          throw new Error('Chart container is not a valid HTML element');
        }
        log.debug('Container validation passed');

        container.innerHTML = '';
        log.debug('Container cleared');

        const chartOptions = {
          width: containerWidth,
          height: adjustedHeight > 0 ? adjustedHeight : 400,
          layout: {
            background: { type: 'solid', color: 'var(--color-bg-1)' },
            textColor: 'var(--color-text-2)',
          },
          grid: {
            vertLines: { color: 'var(--color-border-1)' },
            horzLines: { color: 'var(--color-border-1)' },
          },
          crosshair: {
            mode: 1,
          },
          timeScale: {
            borderColor: 'var(--color-border-1)',
            timeVisible: true,
            secondsVisible: false,
          },
          rightPriceScale: {
            borderColor: 'var(--color-border-1)',
          },
          handleScroll: {
            vertTouchDrag: true,
            horzTouchDrag: true,
            mouseWheel: true,
            pressedMouseMove: true,
          },
          handleScale: {
            axisPressedMouseMove: true,
            mouseWheel: true,
            pinch: true,
          },
        };
        log.debug('Chart options', chartOptions);

        const chart = createChart(container, chartOptions);
        log.debug('createChart called', { valid: !!chart });

        if (!chart) {
          throw new Error('createChart returned null/undefined');
        }

        chartRef.current = chart;

        log.debug('Creating candlestick series...');
        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: '#00b42a',
          downColor: '#f53f3f',
          borderVisible: false,
          wickUpColor: '#00b42a',
          wickDownColor: '#f53f3f',
        });
        log.debug('Candlestick series created', { valid: !!candleSeries });

        if (!candleSeries) {
          throw new Error('Failed to create candlestick series');
        }

        candleSeriesRef.current = candleSeries;

        if (showVolume) {
          log.debug('Creating volume series...');
          const volumeSeries = chart.addSeries(HistogramSeries, {
            color: '#00b42a80',
            priceFormat: {
              type: 'volume',
            },
            priceScaleId: '',
            scaleMargins: {
              top: 0.8,
              bottom: 0,
            },
          });
          log.debug('Volume series created', { valid: !!volumeSeries });

          if (!volumeSeries) {
            throw new Error('Failed to create volume series');
          }

          volumeSeriesRef.current = volumeSeries;
        }

        // Add touch event listeners for pinch-to-zoom
        container.addEventListener('touchstart', handleTouchStart, { passive: false });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd);

        log.info('Chart initialized successfully');
        setChartError(null);
        setChartReady(true);
        return true;
      } catch (err: any) {
        log.error('Failed to initialize chart', err, {
          message: err.message,
          name: err.name,
        });
        if (isMountedRef.current) {
          setChartError('图表初始化失败：' + (err.message || '未知错误'));
        }
        return false;
      }
    };

    initRafRef.current = requestAnimationFrame(() => {
      if (!isMountedRef.current) {
        log.debug('Component unmounted during RAF, aborting');
        return;
      }

      const initialized = initializeChart();

      if (!initialized && isMountedRef.current) {
        const resizeObserver = new ResizeObserver(() => {
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

    const handleResize = () => {
      if (!isMountedRef.current) return;
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: adjustedHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      cleanupChart();
    };
  }, [adjustedHeight, showVolume, loading, cleanupChart, handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Update data when chart is ready or data changes
  useEffect(() => {
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
          color: point.close >= point.open ? '#00b42a80' : '#f53f3f80',
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
        setChartError('图表数据更新失败：' + (err.message || ''));
      }
    }
  }, [chartReady, klineData, showVolume, symbol, currentSymbol]);

  // Handle timeframe change
  const handleTimeframeChange = useCallback((value: TimeFrame) => {
    setTimeframe(value);
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  if (error || chartError) {
    return (
      <Card>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <Text type="danger" style={{ fontSize: 16, marginBottom: 16, display: 'block' }}>
            {error ? '数据加载失败：' + error : chartError}
          </Text>
          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
            {error ? '请检查网络连接或 API 配置' : '图表初始化失败，请检查浏览器控制台日志'}
          </Text>
        </div>
      </Card>
    );
  }

  // Mobile-optimized timeframe selector
  const TimeframeSelector = () => {
    if (isMobile) {
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {Object.entries(TIMEFRAME_LABELS).map(([value, label]) => (
            <Button
              key={value}
              size="small"
              type={timeframe === value ? 'primary' : 'default'}
              onClick={() => handleTimeframeChange(value as TimeFrame)}
              style={{ minWidth: 44, minHeight: 36 }}
            >
              {label}
            </Button>
          ))}
        </div>
      );
    }
    
    return (
      <Radio.Group
        value={timeframe}
        onChange={handleTimeframeChange}
        options={Object.entries(TIMEFRAME_LABELS).map(([value, label]) => ({
          value,
          label,
        }))}
        size="small"
        style={{ flexWrap: 'wrap' }}
      />
    );
  };

  return (
    <Card
      title={symbol + ' K 线图'}
      extra={
        <Space>
          <TimeframeSelector />
          {isMobile && (
            <Tooltip content={isFullscreen ? '退出全屏' : '全屏'}>
              <Button
                type="text"
                icon={isFullscreen ? <IconFullscreenExit /> : <IconFullscreen />}
                onClick={toggleFullscreen}
              />
            </Tooltip>
          )}
        </Space>
      }
      style={isFullscreen ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 } : {}}
    >
      {/* Touch hint for mobile users */}
      {isMobile && !chartError && (
        <div
          className="chart-touch-hint visible"
          style={{
            position: 'absolute',
            bottom: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0, 0, 0, 0.6)',
            color: 'white',
            padding: '4px 12px',
            borderRadius: 12,
            fontSize: 11,
            zIndex: 10,
          }}
        >
          双指缩放 · 滑动查看更多
        </div>
      )}
      
      <Spin loading={loading} style={{ width: '100%' }}>
        <div
          ref={chartContainerRef}
          className="kline-chart-container"
          data-testid="kline-chart"
          style={{ 
            height: adjustedHeight + 'px', 
            position: 'relative', 
            width: '100%',
            touchAction: 'pan-y',
          }}
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
