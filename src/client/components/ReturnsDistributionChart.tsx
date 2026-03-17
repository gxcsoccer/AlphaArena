/**
 * ReturnsDistributionChart - 收益分布图组件
 * 
 * Shows distribution of returns with histogram and statistics
 */

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { Card, Spin, Empty, Typography, Space, Grid, Statistic } from '@arco-design/web-react';

const { Text, Title } = Typography;
const { Row, Col } = Grid;

export interface ReturnDataPoint {
  return: number; // Percentage return
  count: number;
  binStart: number;
  binEnd: number;
}

interface ReturnsDistributionChartProps {
  data: ReturnDataPoint[];
  loading?: boolean;
  title?: string;
  height?: number;
}

const formatPercent = (value: number): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
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
        <Text style={{ fontWeight: 'bold', display: 'block', marginBottom: 4 }}>
          {formatPercent(data.binStart)} ~ {formatPercent(data.binEnd)}
        </Text>
        <Text type="secondary">交易次数: {data.count}</Text>
      </div>
    );
  }
  return null;
};

export const ReturnsDistributionChart: React.FC<ReturnsDistributionChartProps> = ({
  data,
  loading = false,
  title = '收益分布',
  height = 250,
}) => {
  const stats = useMemo(() => {
    if (!data || data.length === 0) return null;
    
    let totalTrades = 0;
    let weightedSum = 0;
    let positiveTrades = 0;
    let negativeTrades = 0;
    
    for (const point of data) {
      totalTrades += point.count;
      weightedSum += point.return * point.count;
      if (point.return >= 0) {
        positiveTrades += point.count;
      } else {
        negativeTrades += point.count;
      }
    }
    
    const avgReturn = totalTrades > 0 ? weightedSum / totalTrades : 0;
    const winRate = totalTrades > 0 ? (positiveTrades / totalTrades) * 100 : 0;
    
    return {
      totalTrades,
      avgReturn,
      winRate,
      positiveTrades,
      negativeTrades,
    };
  }, [data]);

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return data.map((point) => ({
      ...point,
      label: formatPercent(point.binStart),
      color: point.return >= 0 ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))',
    }));
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
    <Card title={title}>
      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Statistic title="总交易次数" value={stats.totalTrades} />
          </Col>
          <Col span={6}>
            <Statistic
              title="平均收益"
              value={stats.avgReturn.toFixed(2)}
              suffix="%"
              valueStyle={{
                color: stats.avgReturn >= 0 ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))',
              }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="胜率"
              value={stats.winRate.toFixed(1)}
              suffix="%"
              valueStyle={{ color: 'rgb(var(--primary-6))' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="盈/亏比"
              value={`${stats.positiveTrades}/${stats.negativeTrades}`}
            />
          </Col>
        </Row>
      )}
      
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            stroke="var(--color-text-3)"
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            stroke="var(--color-text-3)"
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="var(--color-text-3)" />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};

export default ReturnsDistributionChart;
