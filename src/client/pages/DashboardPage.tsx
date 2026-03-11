import React from 'react';
import { Layout, Typography, Card, Statistic, Table, Tag, Space, Button, Grid } from '@arco-design/web-react';
const { Row, Col } = Grid;
import {
  LineChart,
  Line,
  BarChart,
  Bar,
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
import { useStats, useStrategies, useTrades } from '../hooks/useData';
import type { TableProps } from '@arco-design/web-react';
import type { Trade, Strategy } from '../utils/api';

const { Header, Content } = Layout;
const { Title } = Typography;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const DashboardPage: React.FC = () => {
  const { stats, loading: statsLoading } = useStats();
  const { strategies, loading: strategiesLoading } = useStrategies();
  const { trades, loading: tradesLoading } = useTrades(undefined, 10);

  // Prepare chart data
  const strategyStatusData = strategies.reduce((acc: any, strategy) => {
    acc[strategy.status] = (acc[strategy.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(strategyStatusData).map(([name, value]) => ({
    name,
    value,
  }));

  const tradeVolumeData = strategies.map(s => ({
    name: s.name,
    volume: trades.filter(t => t.strategyId === s.id).reduce((sum, t) => sum + t.total, 0),
  }));

  // Trade table columns
  const tradeColumns: TableProps<Trade>['columns'] = [
    {
      title: 'Time',
      dataIndex: 'executedAt',
      key: 'executedAt',
      render: (text: string) => new Date(text).toLocaleTimeString(),
      width: 100,
    },
    {
      title: 'Strategy',
      dataIndex: 'strategyId',
      key: 'strategyId',
      render: (id: string) => {
        const strategy = strategies.find(s => s.id === id);
        return strategy?.name || id;
      },
      width: 150,
    },
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 100,
    },
    {
      title: 'Side',
      dataIndex: 'side',
      key: 'side',
      render: (side: 'buy' | 'sell') => (
        <Tag color={side === 'buy' ? 'green' : 'red'}>
          {side}
        </Tag>
      ),
      width: 80,
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      render: (price: number) => `$${price.toLocaleString()}`,
      width: 100,
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      render: (total: number) => `$${total.toLocaleString()}`,
      width: 100,
    },
  ];

  // Strategy table columns
  const strategyColumns: TableProps<Strategy>['columns'] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 100,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          active: 'green',
          paused: 'orange',
          stopped: 'red',
        };
        return <Tag color={colorMap[status] || 'gray'}>{status}</Tag>;
      },
      width: 100,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_: any, record: Strategy) => (
        <Space>
          <Button size="small" disabled={record.status === 'active'}>
            Start
          </Button>
          <Button size="small" disabled={record.status !== 'active'}>
            Stop
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header>
        <Title heading={2} style={{ color: 'white', margin: 0 }}>
          AlphaArena - Dashboard
        </Title>
      </Header>
      <Content style={{ padding: '24px' }}>
        {/* Stats Overview */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card loading={statsLoading}>
              <Statistic
                title="Total Strategies"
                value={stats?.totalStrategies || 0}
                suffixText={`(${stats?.activeStrategies || 0} active)`}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card loading={statsLoading}>
              <Statistic
                title="Total Trades"
                value={stats?.totalTrades || 0}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card loading={statsLoading}>
              <Statistic
                title="Total Volume"
                value={stats?.totalVolume ? (stats.totalVolume / 1000).toFixed(1) + 'K' : '0'}
                prefixText="$"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card loading={statsLoading}>
              <Statistic
                title="Buy/Sell Ratio"
                value={
                  stats?.buyTrades && stats.sellTrades
                    ? (stats.buyTrades / stats.sellTrades).toFixed(2)
                    : '0'
                }
              />
            </Card>
          </Col>
        </Row>

        {/* Charts */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={12}>
            <Card title="Strategy Status Distribution" loading={strategiesLoading}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine
                    label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
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
            <Card title="Trading Volume by Strategy" loading={strategiesLoading}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={tradeVolumeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="volume" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        {/* Recent Trades */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Card title="Recent Trades" loading={tradesLoading}>
              <Table
                columns={tradeColumns}
                dataSource={trades}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </Card>
          </Col>
        </Row>

        {/* Active Strategies */}
        <Row gutter={16}>
          <Col span={24}>
            <Card title="Active Strategies" loading={strategiesLoading}>
              <Table
                columns={strategyColumns}
                dataSource={strategies}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </Card>
          </Col>
        </Row>
      </Content>
    </Layout>
  );
};

export default DashboardPage;
