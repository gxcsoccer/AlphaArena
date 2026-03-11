import React, { useState } from 'react';
import { Layout, Typography, Card, Table, Tag, Row, Col, Statistic, Select } from 'antd';
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
import type { ColumnsType } from 'antd/es/table';
import type { Portfolio } from '../utils/api';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6B6B'];

const HoldingsPage: React.FC = () => {
  const { strategies } = useStrategies();
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | undefined>(
    strategies.length > 0 ? strategies[0].id : undefined
  );

  // Update selected strategy when strategies are loaded
  React.useEffect(() => {
    if (strategies.length > 0 && !selectedStrategyId) {
      setSelectedStrategyId(strategies[0].id);
    }
  }, [strategies, selectedStrategyId]);

  const { portfolio, loading } = usePortfolio(selectedStrategyId);
  const { trades } = useTrades({ strategyId: selectedStrategyId }, 100);

  // Calculate P&L from trades
  const calculatePnL = () => {
    const buys = trades.filter(t => t.side === 'buy');
    const sells = trades.filter(t => t.side === 'sell');

    const totalCost = buys.reduce((sum, t) => sum + t.total, 0);
    const totalProceeds = sells.reduce((sum, t) => sum + t.total, 0);
    const realizedPnL = totalProceeds - totalCost;

    return {
      realizedPnL,
      totalCost,
      totalProceeds,
      winRate: sells.length > 0 ? (sells.filter(s => s.total > buys.find(b => b.id === s.sellOrderId)?.total || 0).length / sells.length) * 100 : 0,
    };
  };

  const pnlData = calculatePnL();

  // Prepare asset allocation data
  const allocationData = portfolio?.positions.map((pos, index) => ({
    name: pos.symbol,
    value: pos.quantity * pos.averageCost,
  })) || [];

  if (portfolio?.cashBalance) {
    allocationData.push({
      name: 'Cash',
      value: portfolio.cashBalance,
    });
  }

  // Prepare equity curve data (simulated from trades)
  const equityCurveData = trades
    .sort((a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime())
    .reduce((acc: any[], trade, index) => {
      const prevValue = acc.length > 0 ? acc[acc.length - 1].value : (portfolio?.totalValue || 0);
      const newValue = trade.side === 'buy' ? prevValue - trade.total : prevValue + trade.total;
      acc.push({
        time: new Date(trade.executedAt).toLocaleDateString(),
        value: newValue,
      });
      return acc;
    }, []);

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
      render: (_: any, record) => {
        const total = allocationData.reduce((sum, item) => sum + item.value, 0);
        const percentage = total > 0 ? ((record.quantity * record.averageCost) / total) * 100 : 0;
        return `${percentage.toFixed(1)}%`;
      },
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header>
        <Title level={2} style={{ color: 'white', margin: 0 }}>
          AlphaArena - Holdings
        </Title>
      </Header>
      <Content style={{ padding: '24px' }}>
        {/* Strategy Selector */}
        <Card style={{ marginBottom: 24 }}>
          <Select
            placeholder="Select Strategy"
            style={{ width: 300 }}
            allowClear
            value={selectedStrategyId}
            onChange={setSelectedStrategyId}
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
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
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
            </Card>
          </Col>
        </Row>

        {/* Positions Table */}
        <Card title="Current Positions" loading={loading}>
          <Table
            columns={positionColumns}
            dataSource={portfolio?.positions || []}
            rowKey="symbol"
            pagination={false}
            size="small"
          />
        </Card>
      </Content>
    </Layout>
  );
};

export default HoldingsPage;
