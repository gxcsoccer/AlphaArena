/**
 * Optimized Chart Components
 * High-performance chart components with data sampling and memoization
 */

import React, { useMemo, memo, useCallback, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LineChart,
  Line,
  BarChart,
  Bar,
} from 'recharts';
import { Card, Spin, Empty, Typography, Space, Button } from '@arco-design/web-react';
import { IconDownload, IconFullscreen } from '@arco-design/web-react/icon';
import { sampleDataForChart } from '../utils/performance';
import { SkeletonChart } from './Skeleton';

const { Text, _Title } = Typography;

// Maximum points to render for smooth performance
const MAX_CHART_POINTS = 500;
const MAX_CHART_POINTS_HIGH_DPI = 1000;

interface ChartDataPoint {
  timestamp: number;
  date?: string;
  [key: string]: any;
}

interface OptimizedChartProps {
  data: ChartDataPoint[];
  loading?: boolean;
  title?: string;
  height?: number;
  dataKey?: string;
  xAxisKey?: string;
  color?: string;
  gradientId?: string;
  onExport?: () => void;
  showStats?: boolean;
  enableZoom?: boolean;
  enableSampling?: boolean;
  maxPoints?: number;
}

/**
 * Optimized Area Chart Component
 */
export const OptimizedAreaChart: React.FC<OptimizedChartProps> = memo(
  ({
    data,
    loading = false,
    title,
    height = 300,
    dataKey = 'value',
    xAxisKey = 'date',
    color = 'rgb(var(--primary-6))',
    gradientId = 'chartGradient',
    onExport,
    showStats = true,
    enableZoom = false,
    enableSampling = true,
    maxPoints,
  }) => {
    const [zoomDomain, setZoomDomain] = useState<{ start?: number; end?: number }>({});
    const [isZoomed, setIsZoomed] = useState(false);

    // Sample data for better performance
    const sampledData = useMemo(() => {
      if (!enableSampling || !data || data.length === 0) return data;

      const maxPts = maxPoints || (window.devicePixelRatio > 1 ? MAX_CHART_POINTS_HIGH_DPI : MAX_CHART_POINTS);

      if (data.length <= maxPts) return data;

      return sampleDataForChart(data, maxPts);
    }, [data, enableSampling, maxPoints]);

    // Calculate statistics
    const stats = useMemo(() => {
      if (!sampledData || sampledData.length === 0 || !showStats) return null;

      const values = sampledData.map((d) => d[dataKey]).filter((v) => typeof v === 'number');
      if (values.length === 0) return null;

      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const current = values[values.length - 1];
      const change = current - values[0];
      const changePercent = values[0] !== 0 ? (change / values[0]) * 100 : 0;

      return { min, max, avg, current, change, changePercent };
    }, [sampledData, dataKey, showStats]);

    // Handle zoom
    const handleZoomReset = useCallback(() => {
      setZoomDomain({});
      setIsZoomed(false);
    }, []);

    if (loading) {
      return <SkeletonChart height={height} showTitle={!!title} />;
    }

    if (!data || data.length === 0) {
      return (
        <Card title={title}>
          <Empty description="暂无数据" />
        </Card>
      );
    }

    return (
      <Card
        title={
          <Space>
            <span>{title}</span>
            {stats && showStats && (
              <Space size="large" style={{ marginLeft: 16 }}>
                <Text type={stats.change >= 0 ? 'success' : 'error'}>
                  {stats.change >= 0 ? '+' : ''}
                  {stats.changePercent.toFixed(2)}%
                </Text>
              </Space>
            )}
          </Space>
        }
        extra={
          <Space>
            {isZoomed && (
              <Button size="small" onClick={handleZoomReset}>
                重置缩放
              </Button>
            )}
            {onExport && (
              <Button icon={<IconDownload />} size="small" onClick={onExport}>
                导出
              </Button>
            )}
          </Space>
        }
      >
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={sampledData}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey={xAxisKey}
              tick={{ fontSize: 12 }}
              stroke="var(--color-text-3)"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              stroke="var(--color-text-3)"
              tickFormatter={(value) => {
                if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
                return value.toFixed(0);
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-bg-3)',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
              }}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
              isAnimationActive={sampledData.length < 100}
              animationDuration={300}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    );
  }
);

OptimizedAreaChart.displayName = 'OptimizedAreaChart';

/**
 * Optimized Line Chart Component
 */
export const OptimizedLineChart: React.FC<OptimizedChartProps & { lines?: { dataKey: string; color: string; name?: string }[] }> = memo(
  ({
    data,
    loading = false,
    title,
    height = 300,
    dataKey = 'value',
    xAxisKey = 'date',
    color = 'rgb(var(--primary-6))',
    lines,
    onExport,
    enableSampling = true,
    maxPoints,
  }) => {
    // Sample data for better performance
    const sampledData = useMemo(() => {
      if (!enableSampling || !data || data.length === 0) return data;

      const maxPts = maxPoints || (window.devicePixelRatio > 1 ? MAX_CHART_POINTS_HIGH_DPI : MAX_CHART_POINTS);

      if (data.length <= maxPts) return data;

      return sampleDataForChart(data, maxPts);
    }, [data, enableSampling, maxPoints]);

    if (loading) {
      return <SkeletonChart height={height} showTitle={!!title} />;
    }

    if (!data || data.length === 0) {
      return (
        <Card title={title}>
          <Empty description="暂无数据" />
        </Card>
      );
    }

    return (
      <Card
        title={title}
        extra={
          onExport && (
            <Button icon={<IconDownload />} size="small" onClick={onExport}>
              导出
            </Button>
          )
        }
      >
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={sampledData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} stroke="var(--color-text-3)" />
            <YAxis tick={{ fontSize: 12 }} stroke="var(--color-text-3)" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-bg-3)',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
              }}
            />
            {lines ? (
              lines.map((line, index) => (
                <Line
                  key={index}
                  type="monotone"
                  dataKey={line.dataKey}
                  stroke={line.color}
                  name={line.name || line.dataKey}
                  dot={false}
                  isAnimationActive={sampledData.length < 100}
                  animationDuration={300}
                />
              ))
            ) : (
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                dot={false}
                isAnimationActive={sampledData.length < 100}
                animationDuration={300}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </Card>
    );
  }
);

OptimizedLineChart.displayName = 'OptimizedLineChart';

/**
 * Optimized Bar Chart Component
 */
export const OptimizedBarChart: React.FC<OptimizedChartProps & { bars?: { dataKey: string; color: string; name?: string }[] }> = memo(
  ({
    data,
    loading = false,
    title,
    height = 300,
    dataKey = 'value',
    xAxisKey = 'date',
    color = 'rgb(var(--primary-6))',
    bars,
    onExport,
    enableSampling = true,
    maxPoints,
  }) => {
    // Sample data for better performance
    const sampledData = useMemo(() => {
      if (!enableSampling || !data || data.length === 0) return data;

      const maxPts = maxPoints || 100; // Bar charts typically need fewer points

      if (data.length <= maxPts) return data;

      return sampleDataForChart(data, maxPts);
    }, [data, enableSampling, maxPoints]);

    if (loading) {
      return <SkeletonChart height={height} showTitle={!!title} />;
    }

    if (!data || data.length === 0) {
      return (
        <Card title={title}>
          <Empty description="暂无数据" />
        </Card>
      );
    }

    return (
      <Card
        title={title}
        extra={
          onExport && (
            <Button icon={<IconDownload />} size="small" onClick={onExport}>
              导出
            </Button>
          )
        }
      >
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={sampledData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} stroke="var(--color-text-3)" />
            <YAxis tick={{ fontSize: 12 }} stroke="var(--color-text-3)" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-bg-3)',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
              }}
            />
            {bars ? (
              bars.map((bar, index) => (
                <Bar
                  key={index}
                  dataKey={bar.dataKey}
                  fill={bar.color}
                  name={bar.name || bar.dataKey}
                  isAnimationActive={sampledData.length < 50}
                  animationDuration={300}
                />
              ))
            ) : (
              <Bar
                dataKey={dataKey}
                fill={color}
                isAnimationActive={sampledData.length < 50}
                animationDuration={300}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </Card>
    );
  }
);

OptimizedBarChart.displayName = 'OptimizedBarChart';

/**
 * Performance-optimized Equity Curve Chart
 * Extends EquityCurveChart with data sampling and caching
 */
export const OptimizedEquityCurveChart: React.FC<{
  data: Array<{ timestamp: number; date?: string; equity: number }>;
  loading?: boolean;
  title?: string;
  onExport?: () => void;
  height?: number;
  maxPoints?: number;
}> = memo(({ data, loading, title = '资金曲线', onExport, height = 300, maxPoints }) => {
  // Sample data if needed
  const sampledData = useMemo(() => {
    if (!data || data.length === 0) return data;

    const maxPts = maxPoints || MAX_CHART_POINTS;
    if (data.length <= maxPts) return data;

    return sampleDataForChart(data, maxPts);
  }, [data, maxPoints]);

  // Calculate high water mark and drawdown
  const chartData = useMemo(() => {
    if (!sampledData || sampledData.length === 0) return [];

    let highWaterMark = sampledData[0].equity;
    return sampledData.map((point) => {
      highWaterMark = Math.max(highWaterMark, point.equity);
      const drawdown = ((highWaterMark - point.equity) / highWaterMark) * 100;
      return {
        ...point,
        date: point.date || new Date(point.timestamp).toLocaleDateString(),
        highWaterMark,
        drawdown: -drawdown,
      };
    });
  }, [sampledData]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!data || data.length === 0) return null;

    const startEquity = data[0].equity;
    const endEquity = data[data.length - 1].equity;
    const totalReturn = ((endEquity - startEquity) / startEquity) * 100;

    let maxDrawdown = 0;
    let hwm = startEquity;
    for (const point of data) {
      hwm = Math.max(hwm, point.equity);
      const dd = ((hwm - point.equity) / hwm) * 100;
      maxDrawdown = Math.max(maxDrawdown, dd);
    }

    return {
      startEquity,
      endEquity,
      totalReturn,
      maxDrawdown,
    };
  }, [data]);

  if (loading) {
    return <SkeletonChart height={height} showTitle />;
  }

  if (!data || data.length === 0) {
    return (
      <Card title={title}>
        <Empty description="暂无数据" />
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <span>{title}</span>
          {stats && (
            <Space size="large" style={{ marginLeft: 16 }}>
              <Text type={stats.totalReturn >= 0 ? 'success' : 'error'}>
                收益: {stats.totalReturn >= 0 ? '+' : ''}
                {stats.totalReturn.toFixed(2)}%
              </Text>
              <Text type="error">最大回撤: {stats.maxDrawdown.toFixed(2)}%</Text>
            </Space>
          )}
        </Space>
      }
      extra={
        onExport && (
          <Button icon={<IconDownload />} size="small" onClick={onExport}>
            导出
          </Button>
        )
      }
    >
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="rgb(var(--primary-6))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="rgb(var(--primary-6))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--color-text-3)" />
          <YAxis
            tick={{ fontSize: 12 }}
            stroke="var(--color-text-3)"
            tickFormatter={(value) => `$${value.toLocaleString()}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-bg-3)',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
            }}
          />
          <ReferenceLine y={stats?.startEquity} stroke="var(--color-text-3)" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="equity"
            stroke="rgb(var(--primary-6))"
            fillOpacity={1}
            fill="url(#equityGradient)"
            isAnimationActive={chartData.length < 100}
            animationDuration={300}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
});

OptimizedEquityCurveChart.displayName = 'OptimizedEquityCurveChart';

export default OptimizedAreaChart;