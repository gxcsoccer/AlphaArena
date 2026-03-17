/**
 * DrawdownChart - 回撤曲线图组件
 * 
 * Visualizes drawdown over time with severity zones
 */

import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, Spin, Empty, Typography, Space, Tag } from '@arco-design/web-react';

const { Text } = Typography;

export interface DrawdownDataPoint {
  timestamp: number;
  date: string;
  drawdown: number; // Negative percentage
  peak: number;
  trough: number;
}

interface DrawdownChartProps {
  data: DrawdownDataPoint[];
  loading?: boolean;
  title?: string;
  height?: number;
}

const formatPercent = (value: number): string => {
  return `${value.toFixed(2)}%`;
};

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: any[];
}> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div
        style={{
          backgroundColor: 'var(--color-bg-3)',
          border: '1px solid var(--color-border)',
          borderRadius: 4,
          padding: 12,
        }}
      >
        <Text style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>
          {data.date}
        </Text>
        <Space direction="vertical" size={4}>
          <Text type="error">回撤: {formatPercent(data.drawdown)}</Text>
          <Text type="secondary">峰值: ${data.peak.toLocaleString()}</Text>
          <Text type="secondary">谷值: ${data.trough.toLocaleString()}</Text>
        </Space>
      </div>
    );
  }
  return null;
};

export const DrawdownChart: React.FC<DrawdownChartProps> = ({
  data,
  loading = false,
  title = '回撤曲线',
  height = 200,
}) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return data.map((point) => ({
      ...point,
      date: point.date || formatDate(point.timestamp),
    }));
  }, [data]);

  const maxDrawdown = useMemo(() => {
    if (!data || data.length === 0) return 0;
    return Math.min(...data.map((d) => d.drawdown));
  }, [data]);

  const drawdownSeverity = useMemo(() => {
    const absMax = Math.abs(maxDrawdown);
    if (absMax < 5) return { level: 'low', color: 'green', text: '低风险' };
    if (absMax < 10) return { level: 'medium', color: 'orange', text: '中风险' };
    if (absMax < 20) return { level: 'high', color: 'red', text: '高风险' };
    return { level: 'critical', color: 'purple', text: '极高风险' };
  }, [maxDrawdown]);

  if (loading) {
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <Empty description="暂无数据" />
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <span>{title}</span>
          <Tag color={drawdownSeverity.color}>
            最大回撤: {formatPercent(maxDrawdown)} ({drawdownSeverity.text})
          </Tag>
        </Space>
      }
    >
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="rgb(var(--danger-6))" stopOpacity={0.4} />
              <stop offset="95%" stopColor="rgb(var(--danger-6))" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            stroke="var(--color-text-3)"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            stroke="var(--color-text-3)"
            tickFormatter={(value) => `${value.toFixed(0)}%`}
            domain={[Math.min(maxDrawdown * 1.1, -5), 0]}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={-5} stroke="green" strokeDasharray="3 3" />
          <ReferenceLine y={-10} stroke="orange" strokeDasharray="3 3" />
          <ReferenceLine y={-20} stroke="red" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="drawdown"
            stroke="rgb(var(--danger-6))"
            fillOpacity={1}
            fill="url(#drawdownGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
};

export default DrawdownChart;
