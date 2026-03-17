/**
 * EquityCurveChart - 资金曲线图组件
 * 
 * Shows portfolio value over time with drawdown visualization
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
import { Card, Spin, Empty, Typography, Space, Button } from '@arco-design/web-react';
import { IconDownload } from '@arco-design/web-react/icon';

const { Text, Title } = Typography;

export interface EquityDataPoint {
  timestamp: number;
  date: string;
  equity: number;
  drawdown: number;
  highWaterMark: number;
}

interface EquityCurveChartProps {
  data: EquityDataPoint[];
  loading?: boolean;
  title?: string;
  onExport?: () => void;
  height?: number;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: any[];
  label?: string;
}> = ({ active, payload, label }) => {
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
          <Text>资产: {formatCurrency(data.equity)}</Text>
          <Text type={data.drawdown < 0 ? 'error' : 'success'}>
            回撤: {data.drawdown.toFixed(2)}%
          </Text>
          <Text type="secondary">
            最高值: {formatCurrency(data.highWaterMark)}
          </Text>
        </Space>
      </div>
    );
  }
  return null;
};

export const EquityCurveChart: React.FC<EquityCurveChartProps> = ({
  data,
  loading = false,
  title = '资金曲线',
  onExport,
  height = 300,
}) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Calculate high water mark and drawdown
    let highWaterMark = data[0].equity;
    return data.map((point) => {
      highWaterMark = Math.max(highWaterMark, point.equity);
      const drawdown = ((highWaterMark - point.equity) / highWaterMark) * 100;
      return {
        ...point,
        date: point.date || formatDate(point.timestamp),
        highWaterMark,
        drawdown: -drawdown,
      };
    });
  }, [data]);

  const stats = useMemo(() => {
    if (!data || data.length === 0) return null;
    
    const startEquity = data[0].equity;
    const endEquity = data[data.length - 1].equity;
    const totalReturn = ((endEquity - startEquity) / startEquity) * 100;
    
    let maxDrawdown = 0;
    let highWaterMark = startEquity;
    for (const point of data) {
      highWaterMark = Math.max(highWaterMark, point.equity);
      const dd = ((highWaterMark - point.equity) / highWaterMark) * 100;
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
          {stats && (
            <Space size="large" style={{ marginLeft: 16 }}>
              <Text type="success">
                收益: {stats.totalReturn.toFixed(2)}%
              </Text>
              <Text type="error">
                最大回撤: {stats.maxDrawdown.toFixed(2)}%
              </Text>
            </Space>
          )}
        </Space>
      }
      extra={
        onExport && (
          <Button
            icon={<IconDownload />}
            size="small"
            onClick={onExport}
          >
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
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            stroke="var(--color-text-3)"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            stroke="var(--color-text-3)"
            tickFormatter={(value) => formatCurrency(value)}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={stats?.startEquity}
            stroke="var(--color-text-3)"
            strokeDasharray="3 3"
          />
          <Area
            type="monotone"
            dataKey="equity"
            stroke="rgb(var(--primary-6))"
            fillOpacity={1}
            fill="url(#equityGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
};

export default EquityCurveChart;
