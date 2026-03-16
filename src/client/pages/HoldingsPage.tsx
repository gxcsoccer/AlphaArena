import React, { useState, useMemo, useEffect } from 'react';
import { Typography, Card, Table, Tag, Statistic, Select, Grid, Radio, Space } from '@arco-design/web-react';
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
import { useStrategies, useTrades, usePortfolioHistory } from '../hooks/useData';
import { usePortfolioRealtime } from '../hooks/usePortfolioRealtime';
import { ErrorBoundary } from '../components/ErrorBoundary';
import type { TableProps } from '@arco-design/web-react';
import type { PortfolioWithPnL } from '../hooks/usePortfolioRealtime';

const { Row, Col } = Grid;
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
  const [timeRange, setTimeRange] = useState<'1d' | '1w' | '1m' | 'all'>('1w');
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile on mount and resize
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Update selected strategy when strategies are loaded
  React.useEffect(() => {
    if (strategies.length > 0 && !selectedStrategyId) {
      setSelectedStrategyId(strategies[0].id);
    }
  }, [strategies, selectedStrategyId]);

  const { portfolio, loading: portfolioLoading, recentChanges } = usePortfolioRealtime({
    strategyId: selectedStrategyId,
    debounceMs: 100,
  });
  // Memoize filters to prevent infinite re-renders
  const tradesFilters = useMemo(() => ({ strategyId: selectedStrategyId }), [selectedStrategyId]);
  const { trades, loading: tradesLoading } = useTrades(tradesFilters, 500);
  const { history: pnlHistory, loading: historyLoading } = usePortfolioHistory(
    selectedStrategyId,
    timeRange
  );

  // Track which positions recently changed for flash animation
  const [flashingPositions, setFlashingPositions] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    if (recentChanges.length > 0) {
      const changedSymbols = new Set(recentChanges.map(c => c.symbol));
      setFlashingPositions(changedSymbols);
      
      // Remove flash after animation completes (300ms)
      const timer = setTimeout(() => {
        setFlashingPositions(new Set());
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [recentChanges]);

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

  // Prepare equity curve data from PnL history
  const equityCurveData = useMemo(() => {
    if (pnlHistory.length === 0) return [];

    return pnlHistory.map((item) => ({
      time: new Date(item.timestamp).toLocaleString(),
      value: item.totalValue,
      realizedPnL: item.realizedPnL,
      unrealizedPnL: item.unrealizedPnL,
    }));
  }, [pnlHistory]);

  // Position table columns with real-time P/L
  const positionColumns: TableProps<NonNullable<PortfolioWithPnL['positions']>[0]>['columns'] = [
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
      title: 'Current Price',
      dataIndex: 'currentPrice',
      key: 'currentPrice',
      width: 120,
      render: (price: number, record: any) => (
        <span style={{ 
          color: record.priceChange24h >= 0 ? '#3f8600' : '#cf1322',
          fontWeight: 500 
        }}>
          ${price?.toLocaleString()}
          {record.priceChangePercent24h !== 0 && (
            <span style={{ fontSize: '12px', marginLeft: '4px' }}>
              ({record.priceChangePercent24h >= 0 ? '+' : ''}{record.priceChangePercent24h.toFixed(2)}%)
            </span>
          )}
        </span>
      ),
    },
    {
      title: 'Market Value',
      key: 'marketValue',
      width: 120,
      render: (_: any, record: any) => `$${(record.marketValue || (record.quantity * record.averageCost)).toLocaleString()}`,
    },
    {
      title: 'Unrealized P/L',
      key: 'unrealizedPnL',
      width: 140,
      render: (_: any, record: any) => {
        const pnl = record.unrealizedPnL || 0;
        const pnlPercent = record.unrealizedPnLPercent || 0;
        const isFlashing = flashingPositions.has(record.symbol);
        
        return (
          <div style={{
            padding: '4px 8px',
            borderRadius: '4px',
            backgroundColor: isFlashing ? (pnl >= 0 ? 'rgba(63, 134, 0, 0.1)' : 'rgba(207, 19, 34, 0.1)') : 'transparent',
            transition: 'background-color 0.3s ease',
          }}>
            <div style={{ 
              color: pnl >= 0 ? '#3f8600' : '#cf1322',
              fontWeight: 600,
            }}>
              {pnl >= 0 ? '+' : ''}${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ 
              fontSize: '12px',
              color: pnl >= 0 ? '#3f8600' : '#cf1322',
            }}>
              {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
            </div>
          </div>
        );
      },
    },
    {
      title: 'Allocation',
      key: 'allocation',
      width: 100,
      render: (_: any, record: any) => {
        const total = allocationData.reduce((sum, item) => sum + item.value, 0);
        const percentage = total > 0 ? ((record.marketValue || (record.quantity * record.averageCost)) / total) * 100 : 0;
        return `${percentage.toFixed(1)}%`;
      },
    },
  ];

  const loading = strategiesLoading || portfolioLoading || tradesLoading;

  return (
    <ErrorBoundary>
      <div>
        {/* Page Title */}
        <Title heading={3} style={{ marginBottom: isMobile ? 12 : 24 }}>
          Holdings
        </Title>

        {/* Strategy Selector */}
        <Card style={{ marginBottom: isMobile ? 16 : 24 }}>
          <Select
            placeholder="Select Strategy"
            style={{ width: isMobile ? '100%' : 300 }}
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
        <Row gutter={isMobile ? 8 : 16} style={{ marginBottom: isMobile ? 16 : 24 }}>
          <Col xs={12} sm={12} md={6}>
            <Card loading={loading}>
              <Statistic
                title="Total Value"
                value={portfolio?.totalValue || 0}
                prefixText="$"
                precision={2}
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card loading={loading}>
              <Statistic
                title="Cash Balance"
                value={portfolio?.cashBalance || 0}
                prefixText="$"
                precision={2}
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card loading={loading}>
              <Statistic
                title="Unrealized P&L"
                value={portfolio?.totalUnrealizedPnL || 0}
                prefixText="$"
                precision={2}
                valueStyle={{ 
                  color: (portfolio?.totalUnrealizedPnL || 0) >= 0 ? '#3f8600' : '#cf1322',
                  transition: 'color 0.3s ease',
                }}
                extra={
                  <span style={{ fontSize: '14px', color: (portfolio?.totalUnrealizedPnLPercent || 0) >= 0 ? '#3f8600' : '#cf1322' }}>
                    {(portfolio?.totalUnrealizedPnLPercent || 0) >= 0 ? '+' : ''}{portfolio?.totalUnrealizedPnLPercent?.toFixed(2)}%
                  </span>
                }
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card loading={loading}>
              <Statistic
                title="Win Rate"
                value={pnlData.winRate}
                suffixText="%"
                precision={1}
              />
            </Card>
          </Col>
        </Row>

        {/* Charts */}
        <Row gutter={isMobile ? 8 : 16} style={{ marginBottom: isMobile ? 16 : 24 }}>
          <Col xs={24} md={12}>
            <Card title="Asset Allocation" loading={loading}>
              <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
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
          <Col xs={24} md={12}>
            <Card
              title={
                <Space direction={isMobile ? 'vertical' : 'horizontal'}>
                  <span>Equity Curve</span>
                  <Radio.Group
                    value={timeRange}
                    onChange={(value) => setTimeRange(value)}
                    options={[
                      { label: '1D', value: '1d' },
                      { label: '1W', value: '1w' },
                      { label: '1M', value: '1m' },
                      { label: 'All', value: 'all' },
                    ]}
                    optionType="button"
                    size="small"
                  />
                </Space>
              }
              loading={loading || historyLoading}
            >
              {equityCurveData.length > 0 ? (
                <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                  <AreaChart data={equityCurveData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: isMobile ? 10 : 12 }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return timeRange === '1d'
                          ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: isMobile ? 10 : 12 }}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                    />
                    <Tooltip
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Portfolio Value']}
                      labelFormatter={(label) => `Time: ${label}`}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.3}
                      name="Portfolio Value"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div
                  style={{
                    height: isMobile ? 250 : 300,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#999',
                  }}
                >
                  No portfolio data available
                </div>
              )}
            </Card>
          </Col>
        </Row>

        {/* P&L Analysis */}
        <Row gutter={isMobile ? 8 : 16} style={{ marginBottom: isMobile ? 16 : 24 }}>
          <Col span={24}>
            <Card title="P&L Analysis" loading={loading}>
              <Row gutter={isMobile ? 8 : 16}>
                <Col xs={24} sm={8}>
                  <Statistic
                    title="Total Cost Basis"
                    value={pnlData.totalCost}
                    prefixText="$"
                    precision={2}
                  />
                </Col>
                <Col xs={24} sm={8}>
                  <Statistic
                    title="Total Proceeds"
                    value={pnlData.totalProceeds}
                    prefixText="$"
                    precision={2}
                  />
                </Col>
                <Col xs={24} sm={8}>
                  <Statistic
                    title="Total P&L"
                    value={(portfolio?.totalPnL || 0) + pnlData.realizedPnL}
                    prefixText="$"
                    precision={2}
                    valueStyle={{ 
                      color: ((portfolio?.totalPnL || 0) + pnlData.realizedPnL) >= 0 ? '#3f8600' : '#cf1322',
                    }}
                    extra={
                      <span style={{ fontSize: '14px' }}>
                        (Unrealized: ${portfolio?.totalUnrealizedPnL?.toFixed(2) || '0.00'})
                      </span>
                    }
                  />
                </Col>
              </Row>
              <Row gutter={isMobile ? 8 : 16} style={{ marginTop: 16 }}>
                <Col span={12}>
                  <Text type="secondary">
                    Winning Trades:{' '}
                    <Text strong style={{ color: '#3f8600' }}>
                      {pnlData.winningTrades}
                    </Text>
                  </Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">
                    Losing Trades:{' '}
                    <Text strong style={{ color: '#cf1322' }}>
                      {pnlData.losingTrades}
                    </Text>
                  </Text>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        {/* P&L History Chart */}
        <Row gutter={isMobile ? 8 : 16} style={{ marginBottom: isMobile ? 16 : 24 }}>
          <Col span={24}>
            <Card title="P&L History" loading={loading || historyLoading}>
              {pnlHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                  <LineChart data={pnlHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="timestamp"
                      tick={{ fontSize: isMobile ? 10 : 12 }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return timeRange === '1d'
                          ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: isMobile ? 10 : 12 }}
                      tickFormatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <Tooltip
                      formatter={(value: number) => [`$${value.toLocaleString()}`]}
                      labelFormatter={(label) => `Time: ${new Date(label).toLocaleString()}`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="realizedPnL"
                      stroke="#3f8600"
                      name="Realized P&L"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="unrealizedPnL"
                      stroke="#1890ff"
                      name="Unrealized P&L"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div
                  style={{
                    height: isMobile ? 250 : 300,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#999',
                  }}
                >
                  No P&L history available
                </div>
              )}
            </Card>
          </Col>
        </Row>

        {/* Positions Table - Scrollable on mobile */}
        <Card
          title="Current Positions"
          loading={loading}
          bodyStyle={isMobile ? { padding: 0, overflowX: 'auto' } : undefined}
        >
          {portfolio?.positions && portfolio.positions.length > 0 ? (
            <div className={isMobile ? 'mobile-table-container' : ''}>
              <Table
                columns={positionColumns}
                dataSource={portfolio.positions}
                rowKey="symbol"
                pagination={false}
                size="small"
                scroll={isMobile ? { x: 600 } : undefined}
              />
            </div>
          ) : (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                color: '#999',
              }}
            >
              No positions held
            </div>
          )}
        </Card>
      </div>
    </ErrorBoundary>
  );
};

export default HoldingsPage;
