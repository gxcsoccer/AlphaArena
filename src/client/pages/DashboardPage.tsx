import React, { useState, useEffect, useMemo, useCallback, memo, lazy, Suspense } from 'react';
import { Typography, Card, Statistic, Table, Tag, Space, Button, Grid, Tabs, Collapse, Spin, Message } from '@arco-design/web-react';
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
import {
  IconArrowRise,
  IconArrowFall,
  IconApps,
  IconSwap,
  IconTrophy,
} from '@arco-design/web-react/icon';
import { useStats, useStrategies, useTrades } from '../hooks/useData';
import { ErrorBoundary } from '../components/ErrorBoundary';
import MobileTableCard from '../components/MobileTableCard';
import { LazyLoadWrapper } from '../components/LazyLoadWrapper';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import PullToRefreshIndicator from '../components/PullToRefreshIndicator';
import { useTranslation } from 'react-i18next';
import type { TableProps } from '@arco-design/web-react';
import type { Trade, Strategy } from '../utils/api';
import '../styles/visual-optimization.css';

const { Title, _Text } = Typography;

// 使用设计系统的颜色 tokens
const CHART_COLORS = [
  'var(--color-primary-500)',
  'var(--color-success-500)',
  'var(--color-warning-500)',
  'var(--color-error-500)',
  'var(--color-secondary-500)',
];

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
LoadingFallback.displayName = 'LoadingFallback';

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

// Enhanced Stats Card component with trend indicator
interface StatsCardProps {
  title: string;
  value: number | string;
  suffixText?: string;
  prefixText?: string;
  loading: boolean;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  accent?: 'primary' | 'success' | 'warning' | 'danger';
}

const StatsCard: React.FC<StatsCardProps> = memo(({
  title,
  value,
  suffixText,
  prefixText,
  loading,
  trend,
  trendValue,
  accent,
}) => (
  <Card 
    loading={loading} 
    className={`stats-card ${accent ? `stats-card--${accent}` : ''}`}
  >
    <div className="stats-card__title">{title}</div>
    <div className="stats-card__value">
      {prefixText}{typeof value === 'number' ? value.toLocaleString() : value}{suffixText}
    </div>
    {trend && trendValue && (
      <div className={`stats-card__trend stats-card__trend--${trend}`}>
        {trend === 'up' && <IconArrowRise />}
        {trend === 'down' && <IconArrowFall />}
        {trendValue}
      </div>
    )}
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
    volumeTrend?: 'up' | 'down' | 'neutral';
    volumeTrendValue?: string;
  } | null;
  loading: boolean;
  isMobile: boolean;
}> = memo(({ stats, loading, isMobile }) => (
  <div className="stats-card-container">
    <StatsCard
      title="策略总数"
      value={stats?.totalStrategies || 0}
      suffixText={stats?.activeStrategies ? ` (${stats.activeStrategies} 个运行中)` : ''}
      loading={loading}
      accent="primary"
    />
    <StatsCard
      title="总交易次数"
      value={stats?.totalTrades || 0}
      loading={loading}
      accent="success"
    />
    <StatsCard
      title="总交易额"
      value={stats?.totalVolume ? (stats.totalVolume / 1000).toFixed(1) + 'K' : '0'}
      prefixText="$"
      loading={loading}
      trend={stats?.volumeTrend}
      trendValue={stats?.volumeTrendValue}
      accent="warning"
    />
    <StatsCard
      title="买卖比"
      value={
        stats?.buyTrades && stats.sellTrades
          ? (stats.buyTrades / stats.sellTrades).toFixed(2)
          : '0'
      }
      loading={loading}
      accent="danger"
    />
  </div>
));

StatsGrid.displayName = 'StatsGrid';

// Memoized Pie Chart component
const StrategyPieChart: React.FC<{
  data: Array<{ name: string; value: number }>;
  loading: boolean;
  isMobile: boolean;
}> = memo(({ data, loading, isMobile }) => (
  <Card title="策略状态分布" loading={loading} className="chart-card">
    <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine
          label={({ name, percent }) => name + ': ' + ((percent || 0) * 100).toFixed(0) + '%'}
          outerRadius={isMobile ? 60 : 80}
          fill="var(--color-primary-500)"
          dataKey="value"
        >
          {data.map((_, index) => (
            <Cell key={'cell-' + index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
    <div className="chart-legend">
      {data.map((item, index) => (
        <div key={item.name} className="chart-legend__item">
          <div className={`chart-legend__dot chart-color-${index + 1}`} />
          <span>{item.name}</span>
        </div>
      ))}
    </div>
  </Card>
));

StrategyPieChart.displayName = 'StrategyPieChart';

// Memoized Bar Chart component
const TradeVolumeChart: React.FC<{
  data: Array<{ name: string; volume: number }>;
  loading: boolean;
  isMobile: boolean;
}> = memo(({ data, loading, isMobile }) => (
  <Card title="策略交易量" loading={loading} className="chart-card">
    <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-1)" />
        <XAxis dataKey="name" tick={{ fontSize: isMobile ? 10 : 12, fill: 'var(--color-text-2)' }} />
        <YAxis tick={{ fill: 'var(--color-text-2)' }} />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'var(--color-bg-1)', 
            border: '1px solid var(--color-border-1)',
            borderRadius: 'var(--radius-md)',
          }}
        />
        <Legend />
        <Bar dataKey="volume" fill="var(--color-primary-500)" radius={[4, 4, 0, 0]} />
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
          <CollapseItem header="实时交易历史" name="history">
            <div style={{ height: 300 }}>
              <Suspense fallback={<LoadingFallback height={300} />}>
                <TradeHistoryPanel limit={50} autoScroll={true} />
              </Suspense>
            </div>
          </CollapseItem>
          <CollapseItem header="订单管理" name="orders">
            <Suspense fallback={<LoadingFallback height={200} />}>
              <OrdersPanel limit={20} />
            </Suspense>
          </CollapseItem>
          <CollapseItem header="条件订单" name="conditional">
            <Suspense fallback={<LoadingFallback height={200} />}>
              <ConditionalOrdersPanel limit={20} />
            </Suspense>
          </CollapseItem>
        </Collapse>

        <Card title="最近交易" style={{ marginTop: 12 }} loading={tradesLoading} className="chart-card">
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
        <Card title="运行中的策略" loading={strategiesLoading} className="chart-card">
          {strategies.slice(0, 5).map((strategy) => (
            <MobileTableCard
              key={strategy.id}
              data={strategy}
              fields={strategyCardFields}
              titleField="name"
              actions={
                <Space>
                  <Button size="mini" disabled={strategy.status === 'active'}>启动</Button>
                  <Button size="mini" disabled={strategy.status !== 'active'}>停止</Button>
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
  const { stats, loading: statsLoading, refresh: refreshStats } = useStats();
  const { strategies, loading: strategiesLoading, refresh: refreshStrategies } = useStrategies();
  const { trades, loading: tradesLoading, refresh: refreshTrades } = useTrades(undefined, 10);
  const isMobile = useMobileDetection();
  const [activeMobileTab, setActiveMobileTab] = useState<string>('overview');
  const { t } = useTranslation('dashboard');
  
  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      refreshStats?.(),
      refreshStrategies?.(),
      refreshTrades?.(),
    ]);
    Message.success('数据已刷新');
  }, [refreshStats, refreshStrategies, refreshTrades]);
  
  // Pull-to-refresh hook
  const { isRefreshing, pullDistance, handlers } = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
    enabled: isMobile,
  });

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
      title: t('columns.time'),
      dataIndex: 'executedAt',
      key: 'executedAt',
      render: (text: string) => new Date(text).toLocaleTimeString(),
      width: 100,
    },
    {
      title: t('columns.strategy'),
      dataIndex: 'strategyId',
      key: 'strategyId',
      render: (id: string) => {
        const strategy = strategies.find(s => s.id === id);
        return strategy?.name || id;
      },
      width: 150,
    },
    {
      title: t('columns.symbol'),
      dataIndex: 'symbol',
      key: 'symbol',
      width: 100,
    },
    {
      title: t('columns.side'),
      dataIndex: 'side',
      key: 'side',
      render: (side: 'buy' | 'sell') => (
        <Tag color={side === 'buy' ? 'green' : 'red'} className={side === 'buy' ? 'text-success' : 'text-danger'}>
          {side === 'buy' ? t('trading:order.buy', { ns: 'trading' }) : t('trading:order.sell', { ns: 'trading' })}
        </Tag>
      ),
      width: 80,
    },
    {
      title: t('common:label.price', { ns: 'common' }),
      dataIndex: 'price',
      key: 'price',
      render: (price: number) => '$' + price.toLocaleString(),
      width: 100,
    },
    {
      title: t('common:label.amount', { ns: 'common' }),
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
    },
    {
      title: t('common:label.total', { ns: 'common' }),
      dataIndex: 'total',
      key: 'total',
      render: (total: number) => '$' + total.toLocaleString(),
      width: 100,
    },
  ], [strategies, t]);

  const strategyColumns: TableProps<Strategy>['columns'] = useMemo(() => [
    {
      title: t('common:label.name', { ns: 'common' }),
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: t('chart.trades'),
      dataIndex: 'symbol',
      key: 'symbol',
      width: 100,
    },
    {
      title: t('common:label.status', { ns: 'common' }),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          active: 'green',
          paused: 'orange',
          stopped: 'red',
        };
        const textMap: Record<string, string> = {
          active: t('common:label.active', { ns: 'common' }),
          paused: t('strategy:status.paused', { ns: 'strategy' }),
          stopped: t('strategy:status.stopped', { ns: 'strategy' }),
        };
        return (
          <span className={`strategy-status strategy-status--${status}`}>
            <span className="strategy-status__dot" />
            {textMap[status] || status}
          </span>
        );
      },
      width: 100,
    },
    {
      title: t('common:label.description', { ns: 'common' }),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: t('common:label.action', { ns: 'common' }),
      key: 'actions',
      width: 150,
      render: (_: any, record: Strategy) => (
        <Space>
          <Button size="small" disabled={record.status === 'active'}>
            {t('common:button.start', { ns: 'common' })}
          </Button>
          <Button size="small" disabled={record.status !== 'active'}>
            {t('common:button.stop', { ns: 'common' })}
          </Button>
        </Space>
      ),
    },
  ], [t]);

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

  // Mobile layout with tabs and pull-to-refresh
  if (isMobile) {
    return (
      <ErrorBoundary>
        <div 
          className="dashboard-mobile" 
          style={{ position: 'relative', overflow: 'hidden' }}
          {...handlers}
        >
          {/* Pull-to-refresh indicator */}
          <PullToRefreshIndicator
            pullDistance={pullDistance}
            threshold={80}
            isRefreshing={isRefreshing}
          />
          
          <Title heading={4} style={{ marginBottom: 12, padding: '0 4px' }}>
            仪表板
          </Title>

          <Tabs
            activeTab={activeMobileTab}
            onChange={handleMobileTabChange}
            type="rounded"
            size="small"
            style={{ marginBottom: 12 }}
          >
            <TabPane key="overview" title="概览" />
            <TabPane key="trades" title="交易" />
            <TabPane key="strategies" title="策略" />
            <TabPane key="alerts" title="提醒" />
          </Tabs>

          <MobileTabContent
            activeTab={activeMobileTab}
            stats={stats}
            statsLoading={statsLoading || isRefreshing}
            strategiesLoading={strategiesLoading || isRefreshing}
            pieData={chartData.pieData}
            tradeVolumeData={chartData.tradeVolumeData}
            tradesLoading={tradesLoading || isRefreshing}
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
          仪表板
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
            <Card title="最近交易" loading={tradesLoading} className="chart-card">
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
            <Card title="策略管理" loading={strategiesLoading} className="chart-card">
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