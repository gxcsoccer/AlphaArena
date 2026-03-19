/**
 * TradeAnalysisChart - 交易分析图组件
 * 
 * Visualizes trade entries/exits on price chart with PnL analysis
 */

import React, { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  ComposedChart,
  Area,
  ReferenceDot,
} from 'recharts';
import { Card, Spin, Empty, Typography, Space, Grid, Statistic, Tag } from '@arco-design/web-react';

const { Text, _Title } = Typography;
const { Row, Col } = Grid;

export interface TradePoint {
  timestamp: number;
  date: string;
  price: number;
  side: 'buy' | 'sell';
  quantity: number;
  pnl?: number; // For exits
  type: 'entry' | 'exit';
}

export interface PricePoint {
  timestamp: number;
  price: number;
}

interface TradeAnalysisChartProps {
  trades: TradePoint[];
  priceData?: PricePoint[];
  loading?: boolean;
  title?: string;
  height?: number;
}

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const TradeTooltip: React.FC<{
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
          {data.date || formatDate(data.timestamp)}
        </Text>
        <Space direction="vertical" size={2}>
          <Text>价格: ${data.price.toFixed(2)}</Text>
          <Tag color={data.side === 'buy' ? 'green' : 'red'}>
            {data.side === 'buy' ? '买入' : '卖出'}
          </Tag>
          <Text type="secondary">数量: {data.quantity}</Text>
          {data.pnl !== undefined && (
            <Text type={data.pnl >= 0 ? 'success' : 'error'}>
              PnL: ${data.pnl.toFixed(2)}
            </Text>
          )}
        </Space>
      </div>
    );
  }
  return null;
};

export const TradeAnalysisChart: React.FC<TradeAnalysisChartProps> = ({
  trades,
  priceData,
  loading = false,
  title = '交易分析',
  height = 300,
}) => {
  const stats = useMemo(() => {
    if (!trades || trades.length === 0) return null;
    
    const buyTrades = trades.filter((t) => t.side === 'buy');
    const sellTrades = trades.filter((t) => t.side === 'sell');
    const exits = trades.filter((t) => t.type === 'exit' && t.pnl !== undefined);
    
    const winningTrades = exits.filter((t) => (t.pnl || 0) > 0);
    const losingTrades = exits.filter((t) => (t.pnl || 0) <= 0);
    
    const totalPnL = exits.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length
      : 0;
    const avgLoss = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / losingTrades.length
      : 0;
    
    return {
      totalTrades: trades.length,
      buyTrades: buyTrades.length,
      sellTrades: sellTrades.length,
      winRate: exits.length > 0 ? (winningTrades.length / exits.length) * 100 : 0,
      totalPnL,
      avgWin,
      avgLoss: Math.abs(avgLoss),
    };
  }, [trades]);

  const chartData = useMemo(() => {
    if (!trades || trades.length === 0) return [];
    
    return trades.map((trade) => ({
      ...trade,
      date: trade.date || formatDate(trade.timestamp),
    }));
  }, [trades]);

  if (loading) {
    return (
      <Card title={title}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!trades || trades.length === 0) {
    return (
      <Card title={title}>
        <Empty description="暂无交易数据" />
      </Card>
    );
  }

  return (
    <Card title={title}>
      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={4}>
            <Statistic title="总交易" value={stats.totalTrades} />
          </Col>
          <Col span={4}>
            <Statistic title="买入" value={stats.buyTrades} valueStyle={{ color: 'rgb(var(--success-6))' }} />
          </Col>
          <Col span={4}>
            <Statistic title="卖出" value={stats.sellTrades} valueStyle={{ color: 'rgb(var(--danger-6))' }} />
          </Col>
          <Col span={4}>
            <Statistic title="胜率" value={stats.winRate.toFixed(1)} suffix="%" />
          </Col>
          <Col span={4}>
            <Statistic
              title="总收益"
              value={stats.totalPnL.toFixed(2)}
              prefix="$"
              valueStyle={{ color: stats.totalPnL >= 0 ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))' }}
            />
          </Col>
          <Col span={4}>
            <Statistic title="盈亏比" value={(stats.avgWin / (stats.avgLoss || 1)).toFixed(2)} />
          </Col>
        </Row>
      )}
      
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={['dataMin', 'dataMax']}
            tick={{ fontSize: 10 }}
            stroke="var(--color-text-3)"
            tickFormatter={(value) => formatDate(value)}
          />
          <YAxis
            dataKey="price"
            type="number"
            domain={['auto', 'auto']}
            tick={{ fontSize: 10 }}
            stroke="var(--color-text-3)"
            tickFormatter={(value) => `$${value.toFixed(0)}`}
          />
          <ZAxis dataKey="quantity" range={[50, 400]} />
          <Tooltip content={<TradeTooltip />} />
          <Legend />
          
          {/* Buy trades */}
          <Scatter
            name="买入"
            data={chartData.filter((t) => t.side === 'buy')}
            fill="rgb(var(--success-6))"
          />
          
          {/* Sell trades */}
          <Scatter
            name="卖出"
            data={chartData.filter((t) => t.side === 'sell')}
            fill="rgb(var(--danger-6))"
          />
        </ScatterChart>
      </ResponsiveContainer>
    </Card>
  );
};

export default TradeAnalysisChart;
