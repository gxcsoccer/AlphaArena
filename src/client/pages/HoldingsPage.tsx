import React, { useState, useMemo, useEffect } from 'react';
import { Typography, Card, Table, Statistic, Select, Grid, Radio, Space, Progress, Tooltip, Empty, Collapse, Tabs } from '@arco-design/web-react';
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
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useStrategies, useTrades, usePortfolioHistory } from '../hooks/useData';
import { usePortfolioRealtime } from '../hooks/usePortfolioRealtime';
import { usePortfolioAnalytics } from '../hooks/usePortfolioAnalytics';
import { ErrorBoundary } from '../components/ErrorBoundary';
import MobileTableCard from '../components/MobileTableCard';
import { formatPercent, formatDuration } from '../utils/portfolioAnalytics';
import type { TableProps } from '@arco-design/web-react';
import type { PortfolioWithPnL } from '../hooks/usePortfolioRealtime';

const { Row, Col } = Grid;
const { Title, Text } = Typography;
const TabPane = Tabs.TabPane;
const CollapseItem = Collapse.Item;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6B6B'];

// Default initial capital for calculations
const DEFAULT_INITIAL_CAPITAL = 100000;

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

  // Prepare historical data for analytics
  const historicalDataPoints = useMemo(() => {
    return pnlHistory.map(item => ({
      timestamp: new Date(item.timestamp),
      value: item.totalValue,
    }));
  }, [pnlHistory]);

  // Calculate comprehensive analytics
  const analytics = usePortfolioAnalytics({
    trades,
    portfolioValue: portfolio?.totalValue || 0,
    initialCapital: DEFAULT_INITIAL_CAPITAL,
    positions: portfolio?.positions || [],
    historicalValues: historicalDataPoints,
    currentUnrealizedPnL: portfolio?.totalUnrealizedPnL || 0,
  });

  // Calculate P&L from trades
  const _pnlData: PnLData = useMemo(() => {
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

  // Prepare drawdown chart data
  const drawdownData = useMemo(() => {
    if (pnlHistory.length < 2) return [];

    let peak = pnlHistory[0]?.totalValue || 0;
    return pnlHistory.map((item) => {
      const value = item.totalValue;
      if (value > peak) peak = value;
      const drawdown = peak > 0 ? ((peak - value) / peak) * 100 : 0;
      return {
        time: new Date(item.timestamp).toLocaleString(),
        drawdown: Math.max(0, drawdown),
      };
    });
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

  // Mobile card fields for positions
  const positionCardFields = useMemo(() => [
    { 
      key: 'symbol', 
      label: 'Symbol', 
      priority: 'high' as const,
      type: 'text' as const,
    },
    { 
      key: 'quantity', 
      label: 'Quantity', 
      priority: 'medium' as const,
      render: (v: number) => v.toFixed(6),
    },
    { 
      key: 'currentPrice', 
      label: 'Price', 
      priority: 'high' as const,
      render: (v: number, record: any) => (
        <span style={{ 
          color: record.priceChange24h >= 0 ? '#3f8600' : '#cf1322',
        }}>
          ${v?.toLocaleString()}
        </span>
      ),
    },
    { 
      key: 'unrealizedPnL', 
      label: 'P/L', 
      priority: 'high' as const,
      render: (v: number, record: any) => {
        const pnl = v || 0;
        const pnlPercent = record.unrealizedPnLPercent || 0;
        return (
          <div>
            <div style={{ color: pnl >= 0 ? '#3f8600' : '#cf1322', fontWeight: 600 }}>
              {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
            </div>
            <div style={{ fontSize: '11px', color: pnl >= 0 ? '#3f8600' : '#cf1322' }}>
              {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
            </div>
          </div>
        );
      },
    },
    { 
      key: 'marketValue', 
      label: 'Value', 
      priority: 'medium' as const,
      render: (v: number, record: any) => `$${(v || (record.quantity * record.averageCost)).toLocaleString()}`,
    },
  ], []);

  const loading = strategiesLoading || portfolioLoading || tradesLoading;

  // Risk metric display component
  const RiskMetricCard: React.FC<{
    title: string;
    value: number;
    format: 'percent' | 'number' | 'ratio';
    tooltip?: string;
    goodThreshold?: { low: number; high: number };
  }> = ({ title, value, format, tooltip, goodThreshold }) => {
    const formattedValue = format === 'percent' 
      ? formatPercent(value) 
      : format === 'ratio' 
        ? value.toFixed(2) 
        : value.toFixed(4);
    
    let color = 'inherit';
    if (goodThreshold) {
      color = value >= goodThreshold.low && value <= goodThreshold.high ? '#3f8600' : '#cf1322';
    }

    return (
      <Tooltip content={tooltip}>
        <Card style={{ height: '100%' }}>
          <Statistic
            title={title}
            value={formattedValue}
            valueStyle={{ color, fontSize: isMobile ? '18px' : '24px' }}
          />
        </Card>
      </Tooltip>
    );
  };

  return (
    <ErrorBoundary>
      <div>
        {/* Page Title */}
        <Title heading={3} style={{ marginBottom: isMobile ? 12 : 24 }}>
          Holdings & Analytics
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

        {/* Mobile Layout with Tabs */}
        {isMobile ? (
          <Tabs type="rounded" size="small">
            <TabPane key="overview" title="Overview">
              {/* Portfolio Overview - Mobile */}
              <Row gutter={8} style={{ marginBottom: 12 }}>
                <Col span={12}>
                  <Card loading={loading}>
                    <Statistic
                      title="Total Value"
                      value={portfolio?.totalValue || 0}
                      prefixText="$"
                      precision={2}
                    />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card loading={loading}>
                    <Statistic
                      title="Cash"
                      value={portfolio?.cashBalance || 0}
                      prefixText="$"
                      precision={2}
                    />
                  </Card>
                </Col>
              </Row>
              <Row gutter={8} style={{ marginBottom: 12 }}>
                <Col span={12}>
                  <Card loading={loading}>
                    <Statistic
                      title="Return"
                      value={analytics.performanceMetrics.totalReturnPercent}
                      suffixText="%"
                      precision={2}
                      valueStyle={{ 
                        color: analytics.performanceMetrics.totalReturnPercent >= 0 ? '#3f8600' : '#cf1322',
                      }}
                    />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card loading={loading}>
                    <Statistic
                      title="Win Rate"
                      value={analytics.performanceMetrics.winRate}
                      suffixText="%"
                      precision={1}
                    />
                  </Card>
                </Col>
              </Row>

              {/* P&L Summary - Mobile */}
              <Card title="P&L Summary" style={{ marginBottom: 12 }} loading={loading}>
                <Row gutter={8}>
                  <Col span={8}>
                    <Statistic
                      title="Daily"
                      value={analytics.pnlBreakdown.daily.total}
                      prefixText="$"
                      precision={0}
                      valueStyle={{ 
                        fontSize: '14px',
                        color: analytics.pnlBreakdown.daily.total >= 0 ? '#3f8600' : '#cf1322',
                      }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Weekly"
                      value={analytics.pnlBreakdown.weekly.total}
                      prefixText="$"
                      precision={0}
                      valueStyle={{ 
                        fontSize: '14px',
                        color: analytics.pnlBreakdown.weekly.total >= 0 ? '#3f8600' : '#cf1322',
                      }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Monthly"
                      value={analytics.pnlBreakdown.monthly.total}
                      prefixText="$"
                      precision={0}
                      valueStyle={{ 
                        fontSize: '14px',
                        color: analytics.pnlBreakdown.monthly.total >= 0 ? '#3f8600' : '#cf1322',
                      }}
                    />
                  </Col>
                </Row>
              </Card>

              {/* Top Gainers/Losers - Mobile */}
              <Card title="Top Performers" style={{ marginBottom: 12 }} loading={loading}>
                <Collapse accordion>
                  <CollapseItem header="Top Gainers" name="gainers">
                    {analytics.positionAnalysis.topGainers.length > 0 ? (
                      analytics.positionAnalysis.topGainers.slice(0, 3).map((pos) => (
                        <div key={pos.symbol} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          padding: '8px 0',
                          borderBottom: '1px solid #f0f0f0'
                        }}>
                          <Text strong>{pos.symbol}</Text>
                          <Text style={{ color: '#3f8600' }}>
                            +${pos.unrealizedPnL.toFixed(2)}
                          </Text>
                        </div>
                      ))
                    ) : (
                      <Text type="secondary">No gainers</Text>
                    )}
                  </CollapseItem>
                  <CollapseItem header="Top Losers" name="losers">
                    {analytics.positionAnalysis.topLosers.length > 0 ? (
                      analytics.positionAnalysis.topLosers.slice(0, 3).map((pos) => (
                        <div key={pos.symbol} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          padding: '8px 0',
                          borderBottom: '1px solid #f0f0f0'
                        }}>
                          <Text strong>{pos.symbol}</Text>
                          <Text style={{ color: '#cf1322' }}>
                            ${pos.unrealizedPnL.toFixed(2)}
                          </Text>
                        </div>
                      ))
                    ) : (
                      <Text type="secondary">No losers</Text>
                    )}
                  </CollapseItem>
                </Collapse>
              </Card>
            </TabPane>

            <TabPane key="positions" title="Positions">
              {/* Positions Cards - Mobile */}
              <Card loading={loading}>
                {portfolio?.positions && portfolio.positions.length > 0 ? (
                  portfolio.positions.map((position) => (
                    <MobileTableCard
                      key={position.symbol}
                      data={position}
                      fields={positionCardFields}
                      title={position.symbol}
                    />
                  ))
                ) : (
                  <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>
                    No positions held
                  </div>
                )}
              </Card>
            </TabPane>

            <TabPane key="charts" title="Charts">
              {/* Charts - Mobile with Collapse */}
              <Collapse accordion>
                <CollapseItem header="Asset Allocation" name="allocation">
                  {allocationData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={allocationData}
                          cx="50%"
                          cy="50%"
                          labelLine
                          label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                          outerRadius={60}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {allocationData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty description="No positions" style={{ padding: 20 }} />
                  )}
                </CollapseItem>
                <CollapseItem header="Equity Curve" name="equity">
                  <Space direction="vertical" style={{ width: '100%', marginBottom: 8 }}>
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
                  {equityCurveData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={equityCurveData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
                        <RechartsTooltip formatter={(value: number) => [`$${value.toLocaleString()}`]} />
                        <Area type="monotone" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty description="No data" style={{ padding: 20 }} />
                  )}
                </CollapseItem>
                <CollapseItem header="Drawdown" name="drawdown">
                  {drawdownData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={drawdownData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => `${value.toFixed(0)}%`} />
                        <RechartsTooltip formatter={(value: number) => [`${value.toFixed(2)}%`]} />
                        <Area type="monotone" dataKey="drawdown" stroke="#cf1322" fill="#cf1322" fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty description="No data" style={{ padding: 20 }} />
                  )}
                </CollapseItem>
                <CollapseItem header="P&L History" name="pnl">
                  {pnlHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={pnlHistory}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="timestamp" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => `$${value.toLocaleString()}`} />
                        <RechartsTooltip formatter={(value: number) => [`$${value.toLocaleString()}`]} />
                        <Line type="monotone" dataKey="realizedPnL" stroke="#3f8600" name="Realized" dot={false} />
                        <Line type="monotone" dataKey="unrealizedPnL" stroke="#1890ff" name="Unrealized" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty description="No data" style={{ padding: 20 }} />
                  )}
                </CollapseItem>
              </Collapse>
            </TabPane>

            <TabPane key="risk" title="Risk">
              {/* Risk Metrics - Mobile */}
              <Row gutter={8} style={{ marginBottom: 12 }}>
                <Col span={12}>
                  <RiskMetricCard
                    title="Volatility"
                    value={analytics.riskMetrics.volatility}
                    format="percent"
                    tooltip="Annualized volatility"
                  />
                </Col>
                <Col span={12}>
                  <RiskMetricCard
                    title="Max DD"
                    value={analytics.riskMetrics.maxDrawdownPercent}
                    format="percent"
                    tooltip="Maximum drawdown"
                  />
                </Col>
              </Row>
              <Row gutter={8} style={{ marginBottom: 12 }}>
                <Col span={12}>
                  <RiskMetricCard
                    title="Sharpe"
                    value={analytics.riskMetrics.sharpeRatio}
                    format="ratio"
                    tooltip="Risk-adjusted return"
                  />
                </Col>
                <Col span={12}>
                  <RiskMetricCard
                    title="Sortino"
                    value={analytics.riskMetrics.sortinoRatio}
                    format="ratio"
                    tooltip="Downside risk-adjusted return"
                  />
                </Col>
              </Row>

              {/* Concentration - Mobile */}
              <Card title="Concentration" style={{ marginBottom: 12 }} loading={loading}>
                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>HHI Risk</Text>
                  <Progress
                    percent={analytics.positionAnalysis.concentrationRisk / 100}
                    strokeColor={analytics.positionAnalysis.concentrationRisk > 2500 ? '#cf1322' : '#3f8600'}
                    showText={false}
                    style={{ marginTop: 4 }}
                  />
                  <Text style={{ fontSize: '12px' }}>
                    {analytics.positionAnalysis.concentrationRisk.toFixed(0)} / 10000
                  </Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>Largest Position</Text>
                  <Progress
                    percent={analytics.positionAnalysis.largestPositionWeight}
                    strokeColor={analytics.positionAnalysis.largestPositionWeight > 30 ? '#cf1322' : '#3f8600'}
                    showText={false}
                    style={{ marginTop: 4 }}
                  />
                  <Text style={{ fontSize: '12px' }}>
                    {analytics.positionAnalysis.largestPositionWeight.toFixed(1)}%
                  </Text>
                </div>
              </Card>

              {/* Performance - Mobile */}
              <Card title="Performance" loading={loading}>
                <Row gutter={8}>
                  <Col span={8}>
                    <Statistic
                      title="Trades"
                      value={analytics.performanceMetrics.totalTrades}
                      valueStyle={{ fontSize: '14px' }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Wins"
                      value={analytics.performanceMetrics.winningTrades}
                      valueStyle={{ fontSize: '14px', color: '#3f8600' }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Losses"
                      value={analytics.performanceMetrics.losingTrades}
                      valueStyle={{ fontSize: '14px', color: '#cf1322' }}
                    />
                  </Col>
                </Row>
                <Row gutter={8} style={{ marginTop: 12 }}>
                  <Col span={12}>
                    <Statistic
                      title="Avg Win"
                      value={analytics.performanceMetrics.averageWin}
                      prefixText="$"
                      precision={0}
                      valueStyle={{ fontSize: '14px', color: '#3f8600' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Avg Loss"
                      value={Math.abs(analytics.performanceMetrics.averageLoss)}
                      prefixText="$"
                      precision={0}
                      valueStyle={{ fontSize: '14px', color: '#cf1322' }}
                    />
                  </Col>
                </Row>
              </Card>
            </TabPane>
          </Tabs>
        ) : (
          // Desktop Layout
          <>
            {/* Portfolio Overview */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
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
                    title="Total Return"
                    value={analytics.performanceMetrics.totalReturnPercent}
                    suffixText="%"
                    precision={2}
                    valueStyle={{ 
                      color: analytics.performanceMetrics.totalReturnPercent >= 0 ? '#3f8600' : '#cf1322',
                    }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={12} md={6}>
                <Card loading={loading}>
                  <Statistic
                    title="Win Rate"
                    value={analytics.performanceMetrics.winRate}
                    suffixText="%"
                    precision={1}
                  />
                </Card>
              </Col>
            </Row>

            {/* Risk Metrics Section */}
            <Title heading={5} style={{ marginBottom: 12 }}>Risk Metrics</Title>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col xs={12} sm={12} md={6}>
                <RiskMetricCard
                  title="Volatility (Ann.)"
                  value={analytics.riskMetrics.volatility}
                  format="percent"
                  tooltip="Annualized standard deviation of returns. Higher = more risk."
                />
              </Col>
              <Col xs={12} sm={12} md={6}>
                <RiskMetricCard
                  title="Max Drawdown"
                  value={analytics.riskMetrics.maxDrawdownPercent}
                  format="percent"
                  tooltip="Largest peak-to-trough decline in portfolio value."
                  goodThreshold={{ low: 0, high: 20 }}
                />
              </Col>
              <Col xs={12} sm={12} md={6}>
                <RiskMetricCard
                  title="Sharpe Ratio"
                  value={analytics.riskMetrics.sharpeRatio}
                  format="ratio"
                  tooltip="Risk-adjusted return. >1 is good, >2 is excellent."
                  goodThreshold={{ low: 1, high: 100 }}
                />
              </Col>
              <Col xs={12} sm={12} md={6}>
                <RiskMetricCard
                  title="Sortino Ratio"
                  value={analytics.riskMetrics.sortinoRatio}
                  format="ratio"
                  tooltip="Downside risk-adjusted return. Higher is better."
                  goodThreshold={{ low: 1, high: 100 }}
                />
              </Col>
            </Row>

            {/* P&L Breakdown Section */}
            <Title heading={5} style={{ marginBottom: 12 }}>P&L Breakdown</Title>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col xs={24} sm={12} md={6}>
                <Card loading={loading}>
                  <Statistic
                    title="Daily P&L"
                    value={analytics.pnlBreakdown.daily.total}
                    prefixText="$"
                    precision={2}
                    valueStyle={{ 
                      color: analytics.pnlBreakdown.daily.total >= 0 ? '#3f8600' : '#cf1322',
                    }}
                    extra={<Text type="secondary" style={{ fontSize: '12px' }}>
                      {formatPercent(analytics.performanceMetrics.dailyPnLPercent)}
                    </Text>}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card loading={loading}>
                  <Statistic
                    title="Weekly P&L"
                    value={analytics.pnlBreakdown.weekly.total}
                    prefixText="$"
                    precision={2}
                    valueStyle={{ 
                      color: analytics.pnlBreakdown.weekly.total >= 0 ? '#3f8600' : '#cf1322',
                    }}
                    extra={<Text type="secondary" style={{ fontSize: '12px' }}>
                      {formatPercent(analytics.performanceMetrics.weeklyPnLPercent)}
                    </Text>}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card loading={loading}>
                  <Statistic
                    title="Monthly P&L"
                    value={analytics.pnlBreakdown.monthly.total}
                    prefixText="$"
                    precision={2}
                    valueStyle={{ 
                      color: analytics.pnlBreakdown.monthly.total >= 0 ? '#3f8600' : '#cf1322',
                    }}
                    extra={<Text type="secondary" style={{ fontSize: '12px' }}>
                      {formatPercent(analytics.performanceMetrics.monthlyPnLPercent)}
                    </Text>}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card loading={loading}>
                  <Statistic
                    title="Avg Trade Duration"
                    value={formatDuration(analytics.performanceMetrics.averageTradeDuration)}
                  />
                </Card>
              </Col>
            </Row>

            {/* Charts */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col xs={24} md={12}>
                <Card title="Asset Allocation" loading={loading}>
                  {allocationData.length > 0 ? (
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
                        <RechartsTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty description="No positions" style={{ height: 300, display: 'flex', flexDirection: 'column', justifyContent: 'center' }} />
                  )}
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card
                  title={
                    <Space>
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
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={equityCurveData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="time"
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => {
                            const date = new Date(value);
                            return timeRange === '1d'
                              ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                          }}
                        />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                        />
                        <RechartsTooltip
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
                        height: 300,
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

            {/* Drawdown Chart */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={24}>
                <Card title="Drawdown History" loading={loading || historyLoading}>
                  {drawdownData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={drawdownData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="time"
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => {
                            const date = new Date(value);
                            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                          }}
                        />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => `${value.toFixed(0)}%`}
                        />
                        <RechartsTooltip
                          formatter={(value: number) => [`${value.toFixed(2)}%`, 'Drawdown']}
                        />
                        <Area
                          type="monotone"
                          dataKey="drawdown"
                          stroke="#cf1322"
                          fill="#cf1322"
                          fillOpacity={0.3}
                          name="Drawdown"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div
                      style={{
                        height: 250,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#999',
                      }}
                    >
                      No drawdown data available
                    </div>
                  )}
                </Card>
              </Col>
            </Row>

            {/* Top Gainers / Losers */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col xs={24} md={12}>
                <Card title="Top Gainers" loading={loading}>
                  {analytics.positionAnalysis.topGainers.length > 0 ? (
                    <div>
                      {analytics.positionAnalysis.topGainers.map((pos) => (
                        <div key={pos.symbol} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          padding: '8px 0',
                          borderBottom: '1px solid #f0f0f0'
                        }}>
                          <Text strong>{pos.symbol}</Text>
                          <Text style={{ color: '#3f8600' }}>
                            +${pos.unrealizedPnL.toFixed(2)} ({formatPercent(pos.unrealizedPnLPercent)})
                          </Text>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty description="No gainers" />
                  )}
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title="Top Losers" loading={loading}>
                  {analytics.positionAnalysis.topLosers.length > 0 ? (
                    <div>
                      {analytics.positionAnalysis.topLosers.map((pos) => (
                        <div key={pos.symbol} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          padding: '8px 0',
                          borderBottom: '1px solid #f0f0f0'
                        }}>
                          <Text strong>{pos.symbol}</Text>
                          <Text style={{ color: '#cf1322' }}>
                            ${pos.unrealizedPnL.toFixed(2)} ({formatPercent(pos.unrealizedPnLPercent)})
                          </Text>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty description="No losers" />
                  )}
                </Card>
              </Col>
            </Row>

            {/* Position Concentration */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={24}>
                <Card title="Position Concentration" loading={loading}>
                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Statistic
                        title="Concentration Risk (HHI)"
                        value={analytics.positionAnalysis.concentrationRisk.toFixed(2)}
                        suffix="/ 10000"
                      />
                      <Progress
                        percent={analytics.positionAnalysis.concentrationRisk / 100}
                        strokeColor={analytics.positionAnalysis.concentrationRisk > 2500 ? '#cf1322' : '#3f8600'}
                        showText={false}
                        style={{ marginTop: 8 }}
                      />
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        HHI &lt; 1500 = Diversified, &gt; 2500 = Concentrated
                      </Text>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Statistic
                        title="Largest Position"
                        value={analytics.positionAnalysis.largestPositionWeight.toFixed(1)}
                        suffix="%"
                      />
                      <Progress
                        percent={analytics.positionAnalysis.largestPositionWeight}
                        strokeColor={analytics.positionAnalysis.largestPositionWeight > 30 ? '#cf1322' : '#3f8600'}
                        showText={false}
                        style={{ marginTop: 8 }}
                      />
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        &lt; 20% = Healthy, &gt; 30% = High Risk
                      </Text>
                    </Col>
                  </Row>
                </Card>
              </Col>
            </Row>

            {/* Performance Metrics */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={24}>
                <Card title="Trading Performance" loading={loading}>
                  <Row gutter={16}>
                    <Col xs={12} sm={8} md={4}>
                      <Statistic
                        title="Total Trades"
                        value={analytics.performanceMetrics.totalTrades}
                      />
                    </Col>
                    <Col xs={12} sm={8} md={4}>
                      <Statistic
                        title="Winning"
                        value={analytics.performanceMetrics.winningTrades}
                        valueStyle={{ color: '#3f8600' }}
                      />
                    </Col>
                    <Col xs={12} sm={8} md={4}>
                      <Statistic
                        title="Losing"
                        value={analytics.performanceMetrics.losingTrades}
                        valueStyle={{ color: '#cf1322' }}
                      />
                    </Col>
                    <Col xs={12} sm={8} md={4}>
                      <Statistic
                        title="Avg Win"
                        value={analytics.performanceMetrics.averageWin}
                        prefixText="$"
                        precision={2}
                        valueStyle={{ color: '#3f8600' }}
                      />
                    </Col>
                    <Col xs={12} sm={8} md={4}>
                      <Statistic
                        title="Avg Loss"
                        value={Math.abs(analytics.performanceMetrics.averageLoss)}
                        prefixText="$"
                        precision={2}
                        valueStyle={{ color: '#cf1322' }}
                      />
                    </Col>
                    <Col xs={12} sm={8} md={4}>
                      <Statistic
                        title="Profit Factor"
                        value={analytics.performanceMetrics.profitFactor.toFixed(2)}
                        valueStyle={{ 
                          color: analytics.performanceMetrics.profitFactor >= 1 ? '#3f8600' : '#cf1322' 
                        }}
                      />
                    </Col>
                  </Row>
                  <Row gutter={16} style={{ marginTop: 16 }}>
                    <Col xs={12} sm={8}>
                      <Statistic
                        title="Best Trade"
                        value={analytics.performanceMetrics.bestTrade}
                        prefixText="$"
                        precision={2}
                        valueStyle={{ color: '#3f8600' }}
                      />
                    </Col>
                    <Col xs={12} sm={8}>
                      <Statistic
                        title="Worst Trade"
                        value={analytics.performanceMetrics.worstTrade}
                        prefixText="$"
                        precision={2}
                        valueStyle={{ color: '#cf1322' }}
                      />
                    </Col>
                    <Col xs={12} sm={8}>
                      <Statistic
                        title="Avg Duration"
                        value={formatDuration(analytics.performanceMetrics.averageTradeDuration)}
                      />
                    </Col>
                  </Row>
                </Card>
              </Col>
            </Row>

            {/* P&L History Chart */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={24}>
                <Card title="P&L History" loading={loading || historyLoading}>
                  {pnlHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={pnlHistory}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="timestamp"
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => {
                            const date = new Date(value);
                            return timeRange === '1d'
                              ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                          }}
                        />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => `$${value.toLocaleString()}`}
                        />
                        <RechartsTooltip
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
                        height: 300,
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
          </>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default HoldingsPage;
