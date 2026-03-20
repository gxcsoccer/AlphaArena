import React, { useState, useEffect, useMemo, useCallback, memo, lazy, Suspense } from 'react';
import { Typography, Card, Statistic, Table, Tag, Space, Button, Grid, Tabs, Collapse, Spin } from '@arco-design/web-react';
const { Row, Col } = Grid;
const { TabPane } = Tabs;
const CollapseItem = Collapse.Item;
import {
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
import { ErrorBoundary } from '../components/ErrorBoundary';
import MobileTableCard from '../components/MobileTableCard';
import { LazyLoadWrapper } from '../components/LazyLoadWrapper';
import type { TableProps } from '@arco-design/web-react';
import type { Trade, Strategy } from '../utils/api';

const { Title, _Text } = Typography;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

// Lazy load heavy components for better initial load time
const TradeHistoryPanel = lazy(() => import('../components/TradeHistoryPanel'));
const OrdersPanel = lazy(() => import('../components/OrdersPanel'));
const ConditionalOrdersPanel = lazy(() => import('../components/ConditionalOrdersPanel'));
const PriceAlertsPanel = lazy(() => import('../components/PriceAlertsPanel'));
const UsageDashboard = lazy(() => import('../components/UsageDashboard'));

// Loading fallback component
const LoadingFallback: React.FC<{ height?: number }> = memo(({ height = 200 }) => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
    <Spin />
  </div>
));

// Memoized mobile detection hook
const useMobileDetection = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    
    // Use passive listener for better scroll performance
    window.addEventListener('resize', checkMobile, { passive: true });
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};

// Memoized Stats Card component
const StatsCard: React.FC<{
  title: string;
  value: number | string;
  suffixText?: string;
  prefixText?: string;
  loading: boolean;
}> = memo(({ title, value, suffixText, prefixText, loading }) => (
  <Card loading={loading} className="stats-card">
    <Statistic
      title={title}
      value={value}
      suffixText={suffixText}
      prefixText={prefixText}
    />
  </Card>
));

StatsCard.displayName = 'StatsCard';

// Memoized Stats Grid component
const StatsGrid: React.FC<{
  stats: {
    totalStrategies?: number;
    activeStrategies?: number;
    totalTrades?: number;
    totalVolume?: number;
    buyTrades?: number;
    sellTrades?: number;
  } | null;
  loading: boolean;
  isMobile: boolean;
}> = memo(({ stats, loading, isMobile }) => (
  <Row gutter={isMobile ? 8 : 16}>
    <Col xs={12} sm={12} md={6}>
      <StatsCard
        title="Total Strategies"
        value={stats?.totalStrategies || 0}
        suffixText={'(' + (stats?.activeStrategies || 0) + ' active)'}
        loading={loading}
      />
    </Col>
    <Col xs={12} sm={12} md={6}>
      <StatsCard
        title="Total Trades"
        value={stats?.totalTrades || 0}
        loading={loading}
      />
    </Col>
    <Col xs={12} sm={12} md={6}>
      <StatsCard
        title="Total Volume"
        value={stats?.totalVolume ? (stats.totalVolume / 1000).toFixed(1) + 'K' : '0'}
        prefixText="$"
        loading={loading}
      />
    </Col>
    <Col xs={12} sm={12} md={6}>
      <StatsCard
        title="Buy/Sell Ratio"
        value={
          stats?.buyTrades && stats.sellTrades
            ? (stats.buyTrades / stats.sellTrades).toFixed(2)
            : '0'
        }
        loading={loading}
      />
    </Col>
  </Row>
));

StatsGrid.displayName = 'StatsGrid';

// Memoized Pie Chart component
const StrategyPieChart: React.FC<{
  data: Array<{ name: string; value: number }>;
  loading: boolean;
  isMobile: boolean;
}> = memo(({ data, loading, isMobile }) => (
  <Card title="Strategy Status Distribution" loading={loading} className="chart-card">
    <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine
          label={({ name, percent }) => name + ': ' + ((percent || 0) * 100).toFixed(0) + '%'}
          outerRadius={isMobile ? 60 : 80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((_, index) => (
            <Cell key={'cell-' + index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  </Card>
));

StrategyPieChart.displayName = 'StrategyPieChart';

// Memoized Bar Chart component
const TradeVolumeChart: React.FC<{
  data: Array<{ name: string; volume: number }>;
  loading: boolean;
  isMobile: boolean;
}> = memo(({ data, loading, isMobile }) => (
  <Card title="Trading Volume by Strategy" loading={loading} className="chart-card">
    <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: isMobile ? 10 : 12 }} />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="volume" fill="#8884d8" />
      </BarChart>
    </ResponsiveContainer>
  </Card>
));

TradeVolumeChart.displayName = 'TradeVolumeChart';

// Memoized Charts Section
const ChartsSection: React.FC<{
  pieData: Array<{ name: string; value: number }>;
  tradeVolumeData: Array<{ name: string; volume: number }>;
  loading: boolean;
  isMobile: boolean;
}> = memo(({ pieData, tradeVolumeData, loading, isMobile }) => (
  <Row gutter={isMobile ? 8 : 16}>
    <Col xs={24} md={12}>
      <StrategyPieChart data={pieData} loading={loading} isMobile={isMobile} />
    </Col>
    <Col xs={24} md={12}>
      <TradeVolumeChart data={tradeVolumeData} loading={loading} isMobile={isMobile} />
    </Col>
  </Row>
));

ChartsSection.displayName = 'ChartsSection';

// Memoized Mobile Tab Content
const MobileTabContent: React.FC<{
  activeTab: string;
  stats: any;
  statsLoading: boolean;
  strategiesLoading: boolean;
  pieData: Array<{ name: string; value: number }>;
  tradeVolumeData: Array<{ name: string; volume: number }>;
  tradesLoading: boolean;
  trades: Trade[];
  strategies: Strategy[];
  tradeCardFields: any[];
  strategyCardFields: any[];
  isMobile: boolean;
}> = memo(({
  activeTab,
  stats,
  statsLoading,
  strategiesLoading,
  pieData,
  tradeVolumeData,
  tradesLoading,
  trades,
  strategies,
  tradeCardFields,
  strategyCardFields,
  isMobile,
}) => {
  if (activeTab === 'overview') {
    return (
      <div style={{ padding: '0 4px' }}>
        <StatsGrid stats={stats} loading={statsLoading} isMobile={isMobile} />
        <div style={{ marginTop: 12 }}>
          <ChartsSection
            pieData={pieData}
            tradeVolumeData={tradeVolumeData}
            loading={strategiesLoading}
            isMobile={isMobile}
          />
        </div>
      </div>
    );
  }

  if (activeTab === 'trades') {
    return (
      <div style={{ padding: '0 4px' }}>
        <Collapse accordion defaultActiveKey={['history']}>
          <CollapseItem header="Real-time Trade History" name="history">
            <div style={{ height: 300 }}>
              <Suspense fallback={<LoadingFallback height={300} />}>
                <TradeHistoryPanel limit={50} autoScroll={true} />
              </Suspense>
            </div>
          </CollapseItem>
          <CollapseItem header="Orders" name="orders">
            <Suspense fallback={<LoadingFallback height={200} />}>
              <OrdersPanel limit={20} />
            </Suspense>
          </CollapseItem>
          <CollapseItem header="Conditional Orders" name="conditional">
            <Suspense fallback={<LoadingFallback height={200} />}>
              <ConditionalOrdersPanel limit={20} />
            </Suspense>
          </CollapseItem>
        </Collapse>

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
    );
  }

  if (activeTab === 'strategies') {
    return (
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
    );
  }

  if (activeTab === 'alerts') {
    return (
      <div style={{ padding: '0 4px' }}>
        <Suspense fallback={<LoadingFallback height={200} />}>
          <PriceAlertsPanel limit={20} />
        </Suspense>
      </div>
    );
  }

  return null;
});

MobileTabContent.displayName = 'MobileTabContent';

// Main Dashboard Page Component
const DashboardPage: React.FC = () => {
  const { stats, loading: statsLoading } = useStats();
  const { strategies, loading: strategiesLoading } = useStrategies();
  const { trades, loading: tradesLoading } = useTrades(undefined, 10);
  const isMobile = useMobileDetection();
  const [activeMobileTab, setActiveMobileTab] = useState<string>('overview');

  // Memoize chart data calculations
  const chartData = useMemo(() => {
    const strategyStatusData = strategies.reduce((acc: Record<string, number>, strategy) => {
      acc[strategy.status] = (acc[strategy.status] || 0) + 1;
      return acc;
    }, {});

    const pieData = Object.entries(strategyStatusData).map(([name, value]) => ({
      name,
      value,
    }));

    const tradeVolumeData = strategies.map(s => ({
      name: s.name,
      volume: trades.filter(t => t.strategyId === s.id).reduce((sum, t) => sum + t.total, 0),
    }));

    return { pieData, tradeVolumeData };
  }, [strategies, trades]);

  // Memoize table columns
  const tradeColumns: TableProps<Trade>['columns'] = useMemo(() => [
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
  ], [strategies]);

  const strategyColumns: TableProps<Strategy>['columns'] = useMemo(() => [
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
  ], []);

  // Memoize mobile card fields
  const tradeCardFields = useMemo(() => [
    { key: 'symbol', label: 'Symbol', priority: 1 },
    { key: 'side', label: 'Side', priority: 2, render: (v: string) => (
      <Tag color={v === 'buy' ? 'green' : 'red'}>{v}</Tag>
    )},
    { key: 'price', label: 'Price', priority: 3, render: (v: number) => '$' + v.toLocaleString() },
    { key: 'quantity', label: 'Qty', priority: 4 },
    { key: 'total', label: 'Total', priority: 5, render: (v: number) => '$' + v.toLocaleString() },
  ], []);

  const strategyCardFields = useMemo(() => [
    { key: 'name', label: 'Name', priority: 1 },
    { key: 'symbol', label: 'Symbol', priority: 2 },
    { key: 'status', label: 'Status', priority: 3, render: (v: string) => {
      const colorMap: Record<string, string> = { active: 'green', paused: 'orange', stopped: 'red' };
      return <Tag color={colorMap[v] || 'gray'}>{v}</Tag>;
    }},
  ], []);

  // Memoize tab change handler
  const handleMobileTabChange = useCallback((tab: string) => {
    setActiveMobileTab(tab);
  }, []);

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
            onChange={handleMobileTabChange}
            type="rounded"
            size="small"
            style={{ marginBottom: 12 }}
          >
            <TabPane key="overview" title="Overview" />
            <TabPane key="trades" title="Trades" />
            <TabPane key="strategies" title="Strategies" />
            <TabPane key="alerts" title="Alerts" />
          </Tabs>

          <MobileTabContent
            activeTab={activeMobileTab}
            stats={stats}
            statsLoading={statsLoading}
            strategiesLoading={strategiesLoading}
            pieData={chartData.pieData}
            tradeVolumeData={chartData.tradeVolumeData}
            tradesLoading={tradesLoading}
            trades={trades}
            strategies={strategies}
            tradeCardFields={tradeCardFields}
            strategyCardFields={strategyCardFields}
            isMobile={isMobile}
          />
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
          <StatsGrid stats={stats} loading={statsLoading} isMobile={isMobile} />
        </div>

        {/* Usage Dashboard Widget - Lazy loaded */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={12}>
            <LazyLoadWrapper minHeight={150}>
              <Suspense fallback={<LoadingFallback height={150} />}>
                <UsageDashboard compact />
              </Suspense>
            </LazyLoadWrapper>
          </Col>
        </Row>

        {/* Charts */}
        <div style={{ marginBottom: 24 }}>
          <ChartsSection
            pieData={chartData.pieData}
            tradeVolumeData={chartData.tradeVolumeData}
            loading={strategiesLoading}
            isMobile={isMobile}
          />
        </div>

        {/* Real-time Trade History Panel - Lazy loaded */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <LazyLoadWrapper minHeight={500}>
              <div style={{ height: 500 }}>
                <Suspense fallback={<LoadingFallback height={500} />}>
                  <TradeHistoryPanel limit={100} autoScroll={true} />
                </Suspense>
              </div>
            </LazyLoadWrapper>
          </Col>
        </Row>

        {/* Orders Panel - Lazy loaded */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <LazyLoadWrapper minHeight={200}>
              <Suspense fallback={<LoadingFallback height={200} />}>
                <OrdersPanel limit={50} />
              </Suspense>
            </LazyLoadWrapper>
          </Col>
        </Row>

        {/* Conditional Orders Panel - Lazy loaded */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <LazyLoadWrapper minHeight={200}>
              <Suspense fallback={<LoadingFallback height={200} />}>
                <ConditionalOrdersPanel limit={50} />
              </Suspense>
            </LazyLoadWrapper>
          </Col>
        </Row>

        {/* Price Alerts Panel - Lazy loaded */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <LazyLoadWrapper minHeight={200}>
              <Suspense fallback={<LoadingFallback height={200} />}>
                <PriceAlertsPanel limit={50} />
              </Suspense>
            </LazyLoadWrapper>
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

export default memo(DashboardPage);