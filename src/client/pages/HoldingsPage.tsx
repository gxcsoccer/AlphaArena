import React, { useState, useMemo, useEffect } from 'react';
import { Typography, Card, Table, Tag, Row, Col, Statistic, Select } from 'antd';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { usePortfolio, useStrategies, useTrades } from '../hooks/useData';
import { Portfolio, Trade } from '../utils/api';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6B6B'];

interface PnLData {
  realizedPnL: number;
  totalCost: number;
  totalProceeds: number;
  winRate: number;
  winningTrades: number;
  losingTrades: number;
}

const HoldingsPage: React.FC = () => {
  const { strategies, loading: strategiesLoading } = useStrategies();
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | undefined>(
    strategies.length > 0 ? strategies[0].id : undefined
  );

  // Update selected strategy when strategies are loaded
  React.useEffect(() => {
    if (strategies.length > 0 && !selectedStrategyId) {
      setSelectedStrategyId(strategies[0].id);
    }
  }, [strategies, selectedStrategyId]);

  const { portfolio, loading: portfolioLoading } = usePortfolio(selectedStrategyId);
  const { trades, loading: tradesLoading } = useTrades({ strategyId: selectedStrategyId }, 500);

  // Calculate P&L from trades
  const pnlData: PnLData = useMemo(() => {
    if (trades.length === 0) {
      return {
        realizedPnL: 0,
        totalCost: 0,
        totalProceeds: 0,
        winRate: 0,
        winningTrades: 0,
        losingTrades: 0,
      };
    }

    const buys = trades.filter(t => t.side === 'buy');
    const sells = trades.filter(t => t.side === 'sell');

    const totalCost = buys.reduce((sum, t) => sum + t.total, 0);
    const totalProceeds = sells.reduce((sum, t) => sum + t.total, 0);
    const realizedPnL = totalProceeds - totalCost;

    // Simple win rate calculation based on profitable sells
    // This is a simplified model - real P&L would track cost basis per unit
    const avgBuyPrice = buys.length > 0 ? totalCost / buys.reduce((sum, t) => sum + t.quantity, 0) : 0;
    const winningSells = sells.filter(s => s.price > avgBuyPrice);
    const losingSells = sells.filter(s => s.price <= avgBuyPrice);

    return {
      realizedPnL,
      totalCost,
      totalProceeds,
      winRate: sells.length > 0 ? (winningSells.length / sells.length) * 100 : 0,
      winningTrades: winningSells.length,
      losingTrades: losingSells.length,
    };
  }, [trades]);

  // Prepare asset allocation data
  const allocationData = useMemo(() => {
    const data = portfolio?.positions.map((pos) => ({
      name: pos.symbol,
      value: pos.quantity * pos.averageCost,
    })) || [];

    if (portfolio?.cashBalance) {
      data.push({
        name: 'Cash',
        value: portfolio.cashBalance,
      });
    }

    return data;
  }, [portfolio]);

  // Prepare equity curve data (simulated from trades)
  const equityCurveData = useMemo(() => {
    if (trades.length === 0) return [];

    return trades
      .sort((a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime())
      .reduce((acc: Array<{ time: string; value: number }>, trade) => {
        const prevValue = acc.length > 0 ? acc[acc.length - 1].value : (portfolio?.totalValue || 0);
        const newValue = trade.side === 'buy' ? prevValue - trade.total : prevValue + trade.total;
        acc.push({
          time: new Date(trade.executedAt).toLocaleDateString(),
          value: Math.max(0, newValue), // Prevent negative values
        });
        return acc;
      }, []);
  }, [trades, portfolio?.totalValue]);

  // Position table columns
  const positionColumns: ColumnsType<NonNullable<Portfolio['positions']>[0]> = [
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 150,
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 120,
      render: (qty: number) => qty.toFixed(6),
    },
    {
      title: 'Avg Cost',
      dataIndex: 'averageCost',
      key: 'averageCost',
      width: 120,
      render: (cost: number) => `$${cost.toLocaleString()}`,
    },
    {
      title: 'Market Value',
      key: 'marketValue',
      width: 120,
      render: (_: any, record) => `$${(record.quantity * record.averageCost).toLocaleString()}`,
    },
    {
      title: 'Allocation',
      key: 'allocation',
      width: 100,
      render: (_: any, record: NonNullable<Portfolio['positions']>[0]) => {
        const total = allocationData.reduce((sum, item) => sum + item.value, 0);
        const percentage = total > 0 ? ((record.quantity * record.averageCost) / total) * 100 : 0;
        return `${percentage.toFixed(1)}%`;
      },
    },
  ];

  const loading = strategiesLoading || portfolioLoading || tradesLoading;

  return (
    <div>
      <Title level={2}>Holdings</Title>

      {/* Strategy Selector */}
      <Card style={{ marginBottom: 24 }}>
        <Select
          placeholder="Select Strategy"
          style={{ width: 300 }}
          allowClear
          value={selectedStrategyId}
          onChange={setSelectedStrategyId}
          loading={strategiesLoading}
        >
          {strategies.map(s => (
            <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>
          ))}
        </Select>
      </Card>

      {/* Portfolio Overview */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title="Total Value"
              value={portfolio?.totalValue || 0}
              prefix="$"
              precision={2}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title="Cash Balance"
              value={portfolio?.cashBalance || 0}
              prefix="$"
              precision={2}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title="Realized P&L"
              value={pnlData.realizedPnL}
              prefix="$"
              precision={2}
              valueStyle={{ color: pnlData.realizedPnL >= 0 ? '#3f8600' : '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title="Win Rate"
              value={pnlData.winRate}
              suffix="%"
              precision={1}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="Asset Allocation" loading={loading}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={allocationData}
                  cx="50%"
                  cy="50%"
                  labelLine
                  label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {allocationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Equity Curve" loading={loading}>
            {equityCurveData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={equityCurveData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="value" stroke="#8884d8" name="Portfolio Value ($)" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ 
                height: 300, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#999'
              }}>
                No trade data available
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* P&L Analysis */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card title="P&L Analysis" loading={loading}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="Total Cost Basis"
                  value={pnlData.totalCost}
                  prefix="$"
                  precision={2}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Total Proceeds"
                  value={pnlData.totalProceeds}
                  prefix="$"
                  precision={2}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Net P&L"
                  value={pnlData.realizedPnL}
                  prefix="$"
                  precision={2}
                  valueStyle={{ color: pnlData.realizedPnL >= 0 ? '#3f8600' : '#cf1322' }}
                />
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col span={12}>
                <Text type="secondary">
                  Winning Trades: <Text strong style={{ color: '#3f8600' }}>{pnlData.winningTrades}</Text>
                </Text>
              </Col>
              <Col span={12}>
                <Text type="secondary">
                  Losing Trades: <Text strong style={{ color: '#cf1322' }}>{pnlData.losingTrades}</Text>
                </Text>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Positions Table */}
      <Card title="Current Positions" loading={loading}>
        {portfolio?.positions && portfolio.positions.length > 0 ? (
          <Table
            columns={positionColumns}
            dataSource={portfolio.positions}
            rowKey="symbol"
            pagination={false}
            size="small"
          />
        ) : (
          <div style={{ 
            padding: 40, 
            textAlign: 'center', 
            color: '#999' 
          }}>
            No positions held
          </div>
        )}
      </Card>
    </div>
  );
};

export default HoldingsPage;
