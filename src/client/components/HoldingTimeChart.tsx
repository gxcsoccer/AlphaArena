/**
 * HoldingTimeChart - 持仓时间分布图组件
 * 
 * Shows distribution of holding periods for trades
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
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Card, Spin, Empty, Typography, Space, Grid, Statistic, Tabs, TabPane } from '@arco-design/web-react';

const { Text, Title } = Typography;
const { Row, Col } = Grid;

export interface HoldingPeriod {
  duration: number; // in hours
  count: number;
  avgPnL: number;
  winRate: number;
  category: string;
}

interface HoldingTimeChartProps {
  data: HoldingPeriod[];
  loading?: boolean;
  title?: string;
  height?: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658'];

const formatDuration = (hours: number): string => {
  if (hours < 1) return `${Math.round(hours * 60)}分钟`;
  if (hours < 24) return `${Math.round(hours)}小时`;
  if (hours < 168) return `${Math.round(hours / 24)}天`;
  return `${Math.round(hours / 168)}周`;
};

const DurationTooltip: React.FC<{
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
          {data.category}
        </Text>
        <Space direction="vertical" size={2}>
          <Text>交易次数: {data.count}</Text>
          <Text type={data.avgPnL >= 0 ? 'success' : 'error'}>
            平均收益: ${data.avgPnL.toFixed(2)}
          </Text>
          <Text type="secondary">胜率: {data.winRate.toFixed(1)}%</Text>
        </Space>
      </div>
    );
  }
  return null;
};

export const HoldingTimeChart: React.FC<HoldingTimeChartProps> = ({
  data,
  loading = false,
  title = '持仓时间分布',
  height = 300,
}) => {
  const stats = useMemo(() => {
    if (!data || data.length === 0) return null;
    
    const totalTrades = data.reduce((sum, d) => sum + d.count, 0);
    const weightedDuration = data.reduce((sum, d) => sum + d.duration * d.count, 0);
    const avgDuration = totalTrades > 0 ? weightedDuration / totalTrades : 0;
    
    const bestCategory = [...data].sort((a, b) => b.avgPnL - a.avgPnL)[0];
    const mostFrequent = [...data].sort((a, b) => b.count - a.count)[0];
    
    return {
      totalTrades,
      avgDuration,
      bestCategory,
      mostFrequent,
    };
  }, [data]);

  const pieData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return data.map((d) => ({
      name: d.category,
      value: d.count,
      avgPnL: d.avgPnL,
    }));
  }, [data]);

  if (loading) {
    return (
      <Card title={title}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card title={title}>
        <Empty description="暂无持仓数据" />
      </Card>
    );
  }

  return (
    <Card title={title}>
      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Statistic title="总交易" value={stats.totalTrades} />
          </Col>
          <Col span={6}>
            <Statistic title="平均持仓" value={formatDuration(stats.avgDuration)} />
          </Col>
          <Col span={6}>
            <Statistic
              title="最佳持仓周期"
              value={stats.bestCategory?.category || '-'}
              suffix={`$${stats.bestCategory?.avgPnL.toFixed(0) || 0}`}
            />
          </Col>
          <Col span={6}>
            <Statistic title="最常见周期" value={stats.mostFrequent?.category || '-'} />
          </Col>
        </Row>
      )}
      
      <Tabs defaultActiveTab="bar">
        <TabPane key="bar" title="柱状图">
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="category" tick={{ fontSize: 10 }} stroke="var(--color-text-3)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--color-text-3)" />
              <Tooltip content={<DurationTooltip />} />
              <Bar dataKey="count" fill="rgb(var(--primary-6))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </TabPane>
        
        <TabPane key="pie" title="饼图">
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </TabPane>
      </Tabs>
    </Card>
  );
};

export default HoldingTimeChart;
