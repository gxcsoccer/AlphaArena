/**
 * Multi-Timeframe Charts Component
 * VIP-only feature for displaying multiple timeframes simultaneously
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, Grid, Spin, Message, Button, Space, Select, Typography, Tag } from '@arco-design/web-react';
import { IconFullscreen, IconFullscreenExit, IconPlus, IconDelete } from '@arco-design/web-react/icon';
import { createChart, IChartApi, CandlestickData, Time } from 'lightweight-charts';
import { useSubscription } from '../hooks/useSubscription';
import FeatureGate from './FeatureGate';
import { useKLineData, KLineDataPoint } from '../hooks/useKLineData';
import { createLogger } from '../../utils/logger';

const log = createLogger('MultiTimeframeCharts');
const { Row, Col } = Grid;
const { Text, Title } = Typography;

// Timeframe types
export type TimeFrame = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

const TIMEFRAME_LABELS: Record<TimeFrame, string> = {
  '1m': '1分钟',
  '5m': '5分钟',
  '15m': '15分钟',
  '1h': '1小时',
  '4h': '4小时',
  '1d': '1天',
};

interface TimeframeChart {
  id: string;
  timeframe: TimeFrame;
  chart: IChartApi | null;
  data: KLineDataPoint[];
}

interface MultiTimeframeChartsProps {
  symbol: string;
  defaultTimeframes?: TimeFrame[];
  maxTimeframes?: number;
}

/**
 * Multi-Timeframe Charts Component
 * Allows VIP users to view multiple timeframes side by side
 */
const MultiTimeframeCharts: React.FC<MultiTimeframeChartsProps> = ({
  symbol,
  defaultTimeframes = ['1h', '4h', '1d'],
  maxTimeframes = 4,
}) => {
  const { isPro } = useSubscription();
  const [selectedTimeframes, setSelectedTimeframes] = useState<TimeFrame[]>(defaultTimeframes);
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);
  const [charts, setCharts] = useState<Map<string, IChartApi>>(new Map());

  // Get chart data for each timeframe
  const timeframeDataHooks = useMemo(() => {
    const hooks: Record<TimeFrame, { data: KLineDataPoint[]; loading: boolean; error: string | null }> = {} as any;
    return hooks;
  }, []);

  // Handle add timeframe
  const addTimeframe = (timeframe: TimeFrame) => {
    if (selectedTimeframes.includes(timeframe)) {
      Message.warning('该时间框架已添加');
      return;
    }
    if (selectedTimeframes.length >= maxTimeframes) {
      Message.warning(`最多只能添加 ${maxTimeframes} 个时间框架`);
      return;
    }
    setSelectedTimeframes([...selectedTimeframes, timeframe]);
  };

  // Handle remove timeframe
  const removeTimeframe = (timeframe: TimeFrame) => {
    if (selectedTimeframes.length <= 1) {
      Message.warning('至少需要保留一个时间框架');
      return;
    }
    setSelectedTimeframes(selectedTimeframes.filter((tf) => tf !== timeframe));
  };

  // Toggle fullscreen for a chart
  const toggleFullscreen = (id: string) => {
    setFullscreenId(fullscreenId === id ? null : id);
  };

  // Available timeframes not yet selected
  const availableTimeframes = Object.keys(TIMEFRAME_LABELS).filter(
    (tf) => !selectedTimeframes.includes(tf as TimeFrame)
  ) as TimeFrame[];

  // Render individual chart component
  const ChartCard: React.FC<{ timeframe: TimeFrame }> = ({ timeframe }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const { klineData, loading, error } = useKLineData(symbol, timeframe);

    useEffect(() => {
      if (!chartContainerRef.current || loading || error || klineData.length === 0) return;

      // Initialize chart
      chartRef.current = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 300,
        layout: {
          background: { color: 'transparent' },
          textColor: '#333',
        },
        grid: {
          vertLines: { color: '#f0f0f0' },
          horzLines: { color: '#f0f0f0' },
        },
        crosshair: {
          mode: 1,
        },
        rightPriceScale: {
          borderColor: '#cccccc',
        },
        timeScale: {
          borderColor: '#cccccc',
          timeVisible: true,
        },
      });

      // Add candlestick series
      const candlestickSeries = chartRef.current.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });

      // Set data
      const chartData = klineData.map((d) => ({
        time: d.time as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));
      candlestickSeries.setData(chartData);

      // Fit content
      chartRef.current.timeScale().fitContent();

      // Store reference
      setCharts((prev) => {
        const newMap = new Map(prev);
        newMap.set(timeframe, chartRef.current!);
        return newMap;
      });

      // Cleanup
      return () => {
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
          setCharts((prev) => {
            const newMap = new Map(prev);
            newMap.delete(timeframe);
            return newMap;
          });
        }
      };
    }, [timeframe, klineData, loading, error]);

    // Handle resize
    useEffect(() => {
      const handleResize = () => {
        if (chartRef.current && chartContainerRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
          });
        }
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isFullscreen = fullscreenId === timeframe;

    return (
      <Card
        title={
          <Space>
            <Text bold>{TIMEFRAME_LABELS[timeframe]}</Text>
            <Tag color="arcoblue">{symbol}</Tag>
          </Space>
        }
        extra={
          <Space>
            <Button
              size="small"
              icon={isFullscreen ? <IconFullscreenExit /> : <IconFullscreen />}
              onClick={() => toggleFullscreen(timeframe)}
            />
            <Button
              size="small"
              icon={<IconDelete />}
              status="danger"
              onClick={() => removeTimeframe(timeframe)}
            />
          </Space>
        }
        style={isFullscreen ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 } : {}}
      >
        <div
          ref={chartContainerRef}
          style={{ width: '100%', height: isFullscreen ? 'calc(100vh - 100px)' : 300 }}
        >
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Spin />
            </div>
          )}
          {error && <Text type="error">{error}</Text>}
        </div>
      </Card>
    );
  };

  // Main render - wrapped in FeatureGate
  return (
    <FeatureGate featureKey="multi_timeframe_charts" featureName="多时间框架图表">
      <Card
        title="多时间框架对比"
        extra={
          <Space>
            <Select
              style={{ width: 150 }}
              placeholder="添加时间框架"
              onChange={(value) => addTimeframe(value as TimeFrame)}
              disabled={availableTimeframes.length === 0}
              value={undefined}
            >
              {availableTimeframes.map((tf) => (
                <Select.Option key={tf} value={tf}>
                  {TIMEFRAME_LABELS[tf]}
                </Select.Option>
              ))}
            </Select>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size="medium">
          {/* Info banner */}
          <div style={{ background: 'var(--color-fill-1)', padding: 12, borderRadius: 4 }}>
            <Text bold>VIP 多时间框架功能</Text>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-2)' }}>
              同时查看多个时间框架，更好地判断趋势和入场时机。最多可添加 {maxTimeframes} 个时间框架。
            </div>
          </div>

          {/* Charts grid */}
          <Row gutter={[16, 16]}>
            {selectedTimeframes.map((timeframe) => (
              <Col span={fullscreenId === timeframe ? 24 : 12} key={timeframe}>
                <ChartCard timeframe={timeframe} />
              </Col>
            ))}
          </Row>

          {/* Feature comparison */}
          <div style={{ marginTop: 16 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              提示：点击图表右上角的全屏按钮可以放大查看单个时间框架
            </Text>
          </div>
        </Space>
      </Card>
    </FeatureGate>
  );
};

export default MultiTimeframeCharts;