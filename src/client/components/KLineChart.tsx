import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, UTCTimestamp } from 'lightweight-charts';
import { Card, Radio, Spin, Empty, Typography } from '@arco-design/web-react';
import { useKLineData } from '../hooks/useKLineData';

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

const KLineChart: React.FC<KLineChartProps> = ({
  symbol = 'BTC/USD',
  height = 500,
  showVolume = true,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [timeframe, setTimeframe] = useState<TimeFrame>('1h');
  const { klineData, loading, error } = useKLineData(symbol, timeframe);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
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

    chartRef.current = chart;

    // Create candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    candleSeriesRef.current = candleSeries;

    // Create volume series (overlay at bottom)
    if (showVolume) {
      const volumeSeries = chart.addHistogramSeries({
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

      volumeSeriesRef.current = volumeSeries;
    }

    // Handle resize
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
      chart.remove();
    };
  }, [height, showVolume]);

  // Update data when timeframe or symbol changes
  useEffect(() => {
    if (!candleSeriesRef.current || !klineData) return;

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
  }, [klineData, showVolume]);

  // Handle timeframe change
  const handleTimeframeChange = useCallback((value: TimeFrame) => {
    setTimeframe(value);
  }, []);

  if (error) {
    return (
      <Card>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <Text type="danger">加载失败：{error}</Text>
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
          size="small"
        />
      }
    >
      <Spin loading={loading} style={{ width: '100%' }}>
        <div ref={chartContainerRef} style={{ height: `${height}px`, position: 'relative' }}>
          {klineData && klineData.length === 0 && (
            <Empty description="暂无 K 线数据" />
          )}
        </div>
      </Spin>
    </Card>
  );
};

export default KLineChart;
