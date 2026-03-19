import React, { useState, useEffect } from 'react';
import { Typography, Card, Statistic, Table, Tag, Space, Button, Grid, Tabs, Collapse, Skeleton } from '@arco-design/web-react';
const { Row, Col } = Grid;
const { TabPane } = Tabs;
const CollapseItem = Collapse.Item;
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
import TradeHistoryPanel from '../components/TradeHistoryPanel';
import OrdersPanel from '../components/OrdersPanel';
import ConditionalOrdersPanel from '../components/ConditionalOrdersPanel';
import PriceAlertsPanel from '../components/PriceAlertsPanel';
import { ErrorBoundary } from '../components/ErrorBoundary';
import MobileTableCard from '../components/MobileTableCard';
import type { TableProps } from '@arco-design/web-react';
import type { Trade, Strategy } from '../utils/api';
import UsageDashboard from '../components/UsageDashboard';

const { Title, _Text } = Typography;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const DashboardPage: React.FC = () => {
  const { stats, loading: statsLoading } = useStats();
  const { strategies, loading: strategiesLoading } = useStrategies();
  const { trades, loading: tradesLoading } = useTrades(undefined, 10);
  const [isMobile, setIsMobile] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<string>('overview');

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
      render: (price: number) => '$' + price.toLocaleString(),
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
      render: (total: number) => '$' + total.toLocaleString(),
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

  // Mobile card fields for trades
  const tradeCardFields = [
    { key: 'symbol', label: 'Symbol', priority: 1 },
    { key: 'side', label: 'Side', priority: 2, render: (v: string) => (
      <Tag color={v === 'buy' ? 'green' : 'red'}>{v}</Tag>
    )},
    { key: 'price', label: 'Price', priority: 3, render: (v: number) => '$' + v.toLocaleString() },
    { key: 'quantity', label: 'Qty', priority: 4 },
    { key: 'total', label: 'Total', priority: 5, render: (v: number) => '$' + v.toLocaleString() },
  ];

  // Mobile card fields for strategies
  const strategyCardFields = [
    { key: 'name', label: 'Name', priority: 1 },
    { key: 'symbol', label: 'Symbol', priority: 2 },
    { key: 'status', label: 'Status', priority: 3, render: (v: string) => {
      const colorMap: Record<string, string> = { active: 'green', paused: 'orange', stopped: 'red' };
      return <Tag color={colorMap[v] || 'gray'}>{v}</Tag>;
    }},
  ];

  // Stats grid component for reusability
  const StatsGrid = () => (
    <Row gutter={isMobile ? 8 : 16}>
      <Col xs={12} sm={12} md={6}>
        <Card loading={statsLoading} className="stats-card">
          <Statistic
            title="Total Strategies"
            value={stats?.totalStrategies || 0}
            suffixText={'(' + (stats?.activeStrategies || 0) + ' active)'}
          />
        </Card>
      </Col>
      <Col xs={12} sm={12} md={6}>
        <Card loading={statsLoading} className="stats-card">
          <Statistic
            title="Total Trades"
            value={stats?.totalTrades || 0}
          />
        </Card>
      </Col>
      <Col xs={12} sm={12} md={6}>
        <Card loading={statsLoading} className="stats-card">
          <Statistic
            title="Total Volume"
            value={stats?.totalVolume ? (stats.totalVolume / 1000).toFixed(1) + 'K' : '0'}
            prefixText="$"
          />
        </Card>
      </Col>
      <Col xs={12} sm={12} md={6}>
        <Card loading={statsLoading} className="stats-card">
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
  );

  // Charts section
  const ChartsSection = () => (
    <Row gutter={isMobile ? 8 : 16}>
      <Col xs={24} md={12}>
        <Card title="Strategy Status Distribution" loading={strategiesLoading} className="chart-card">
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine
                label={({ name, percent }) => name + ': ' + ((percent || 0) * 100).toFixed(0) + '%'}
                outerRadius={isMobile ? 60 : 80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={'cell-' + index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <Card title="Trading Volume by Strategy" loading={strategiesLoading} className="chart-card">
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
            <BarChart data={tradeVolumeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: isMobile ? 10 : 12 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="volume" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </Col>
    </Row>
  );

  // Mobile layout with tabs
  if (isMobile) {
    return (
      <ErrorBoundary>
        <div className="dashboard-mobile">
          <Title heading={4} style={{ marginBottom: 12, padding: '0 4px' }}>
            Dashboard
          </Title>

          <Tabs
            activeTab={activeMobileTab}
            onChange={setActiveMobileTab}
            type="rounded"
            size="small"
            style={{ marginBottom: 12 }}
          >
            <TabPane key="overview" title="Overview" />
            <TabPane key="trades" title="Trades" />
            <TabPane key="strategies" title="Strategies" />
            <TabPane key="alerts" title="Alerts" />
          </Tabs>

          {activeMobileTab === 'overview' && (
            <div style={{ padding: '0 4px' }}>
              <StatsGrid />
              <div style={{ marginTop: 12 }}>
                <ChartsSection />
              </div>
            </div>
          )}

          {activeMobileTab === 'trades' && (
            <div style={{ padding: '0 4px' }}>
              <Collapse accordion defaultActiveKey={['history']}>
                <CollapseItem header="Real-time Trade History" name="history">
                  <div style={{ height: 300 }}>
                    <TradeHistoryPanel limit={50} autoScroll={true} />
                  </div>
                </CollapseItem>
                <CollapseItem header="Orders" name="orders">
                  <OrdersPanel limit={20} />
                </CollapseItem>
                <CollapseItem header="Conditional Orders" name="conditional">
                  <ConditionalOrdersPanel limit={20} />
                </CollapseItem>
              </Collapse>

              {/* Mobile card view for recent trades */}
              <Card title="Recent Trades" style={{ marginTop: 12 }} loading={tradesLoading}>
                {trades.slice(0, 5).map((trade) => (
                  <MobileTableCard
                    key={trade.id}
                    data={trade}
                    fields={tradeCardFields}
                    titleField="symbol"
                  />
                ))}
              </Card>
            </div>
          )}

          {activeMobileTab === 'strategies' && (
            <div style={{ padding: '0 4px' }}>
              <Card title="Active Strategies" loading={strategiesLoading}>
                {strategies.slice(0, 5).map((strategy) => (
                  <MobileTableCard
                    key={strategy.id}
                    data={strategy}
                    fields={strategyCardFields}
                    titleField="name"
                    actions={
                      <Space>
                        <Button size="mini" disabled={strategy.status === 'active'}>Start</Button>
                        <Button size="mini" disabled={strategy.status !== 'active'}>Stop</Button>
                      </Space>
                    }
                  />
                ))}
              </Card>
            </div>
          )}

          {activeMobileTab === 'alerts' && (
            <div style={{ padding: '0 4px' }}>
              <PriceAlertsPanel limit={20} />
            </div>
          )}
        </div>
      </ErrorBoundary>
    );
  }

  // Desktop layout
  return (
    <ErrorBoundary>
      <div>
        {/* Page Title */}
        <Title heading={3} style={{ marginBottom: 24 }}>
          Dashboard
        </Title>

        {/* Stats Overview */}
        <div style={{ marginBottom: 24 }}>
          <StatsGrid />
        </div>

        {/* Usage Dashboard Widget */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={12}>
            <UsageDashboard compact />
          </Col>
        </Row>

        {/* Charts */}
        <div style={{ marginBottom: 24 }}>
          <ChartsSection />
        </div>

        {/* Real-time Trade History Panel */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <div style={{ height: 500 }}>
              <TradeHistoryPanel limit={100} autoScroll={true} />
            </div>
          </Col>
        </Row>

        {/* Orders Panel */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <OrdersPanel limit={50} />
          </Col>
        </Row>

        {/* Conditional Orders Panel */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <ConditionalOrdersPanel limit={50} />
          </Col>
        </Row>

        {/* Price Alerts Panel */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <PriceAlertsPanel limit={50} />
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
      </div>
    </ErrorBoundary>
  );
};

export default DashboardPage;
