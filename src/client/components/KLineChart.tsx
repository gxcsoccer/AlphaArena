import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, UTCTimestamp, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import { Card, Radio, Spin, Empty, Typography } from '@arco-design/web-react';
import { useKLineData } from '../hooks/useKLineData';
import ErrorBoundary from './ErrorBoundary';

const { Text } = Typography;

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
  const { klineData, loading, error } = useKLineData(symbol, timeframe);

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

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) {
      console.error('[KLineChart] Chart container ref is null');
      setChartError('图表容器未就绪');
      return;
    }

    const container = chartContainerRef.current;
    
    // Function to initialize chart with proper width
    const initializeChart = () => {
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      console.log('[KLineChart] Initializing chart, container size:', { width: containerWidth, height: containerHeight, height: height });
      
      if (containerWidth <= 0) {
        console.warn('[KLineChart] Container width is still 0, will retry...');
        return false;
      }

      if (containerHeight <= 0 && height <= 0) {
        console.warn('[KLineChart] Container height is 0 and no height prop, will retry...');
        return false;
      }

      try {
        // Validate container is a valid DOM element
        if (!(container instanceof HTMLElement)) {
          throw new Error('Chart container is not a valid HTML element');
        }

        // Clear any existing chart content
        container.innerHTML = '';

        const chart = createChart(container, {
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
        });

        if (!chart) {
          throw new Error('createChart returned null/undefined');
        }

        chartRef.current = chart;

        // Create candlestick series - lightweight-charts v5.x API
        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: '#26a69a',
          downColor: '#ef5350',
          borderVisible: false,
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350',
        });

        if (!candleSeries) {
          throw new Error('Failed to create candlestick series');
        }

        candleSeriesRef.current = candleSeries;

        // Create volume series (overlay at bottom)
        if (showVolume) {
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

          if (!volumeSeries) {
            throw new Error('Failed to create volume series');
          }

          volumeSeriesRef.current = volumeSeries;
        }

        console.log('[KLineChart] Chart initialized successfully');
        setChartError(null); // Clear any previous errors
        return true;
      } catch (err: any) {
        console.error('[KLineChart] Failed to initialize chart:', err);
        console.error('[KLineChart] Error details:', {
          message: err.message,
          stack: err.stack,
          name: err.name,
          constructor: err.constructor?.name,
        });
        setChartError(`图表初始化失败：${err.message || '未知错误'}`);
        return false;
      }
    };

    // Try to initialize immediately
    const initialized = initializeChart();
    
    // If not initialized (width was 0), set up a ResizeObserver to retry when container becomes available
    if (!initialized) {
      const resizeObserver = new ResizeObserver(() => {
        // Only try to initialize if chart doesn't exist yet
        if (!chartRef.current && chartContainerRef.current) {
          const success = initializeChart();
          if (success) {
            resizeObserver.disconnect();
          }
        }
      });
      
      resizeObserver.observe(container);
      
      return () => {
        resizeObserver.disconnect();
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }
      };
    }

    // Handle resize for already-initialized chart
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [height, showVolume]);

  // Update data when timeframe or symbol changes
  useEffect(() => {
    if (!candleSeriesRef.current || !klineData) return;

    try {
      // Convert KLineDataPoint to CandlestickData
      const candleData: CandlestickData<Time>[] = klineData.map(point => ({
        time: point.time as UTCTimestamp,
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
      }));

      candleSeriesRef.current.setData(candleData);

      // Update volume data
      if (volumeSeriesRef.current && showVolume) {
        const volumeData = klineData.map(point => ({
          time: point.time as UTCTimestamp,
          value: point.volume,
          color: point.close >= point.open ? '#26a69a80' : '#ef535080',
        }));
        volumeSeriesRef.current.setData(volumeData);
      }
      
      setChartError(null); // Clear errors on successful update
    } catch (err: any) {
      console.error('[KLineChart] Failed to update chart data:', err);
      setChartError(`图表数据更新失败：${err.message}`);
    }
  }, [klineData, showVolume]);

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
