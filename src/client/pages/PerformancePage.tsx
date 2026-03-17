import React, { useState, useMemo } from 'react';
import {
  Typography,
  Card,
  Statistic,
  Table,
  Tag,
  Space,
  
  Grid,
  Select,
  
  Empty,
  Tooltip,
} from '@arco-design/web-react';
const { Row, Col } = Grid;
const { Title, Text } = Typography;

import {
  
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceLine,
} from 'recharts';

import { useStats, useStrategies, useTrades, usePortfolio } from '../hooks/useData';
import { usePortfolioAnalytics } from '../hooks/usePortfolioAnalytics';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { api, Trade, StrategyMetrics } from '../utils/api';
import {
  formatPercent,
  formatCurrency,
  formatDuration,
  
  
  
} from '../utils/portfolioAnalytics';
import type { HistoricalDataPoint } from '../utils/portfolioAnalytics';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

// Time range options
const TIME_RANGES = [
  { label: '今日', value: '1d' },
  { label: '本周', value: '1w' },
  { label: '本月', value: '1m' },
  { label: '全部', value: 'all' },
];

// Performance metrics card component
interface MetricsCardProps {
  title: string;
  value: number | string;
  suffix?: string;
  prefix?: string;
  precision?: number;
  loading?: boolean;
  trend?: 'up' | 'down' | 'neutral';
  tooltip?: string;
}

const MetricsCard: React.FC<MetricsCardProps> = ({
  title,
  value,
  suffix,
  prefix,
  precision = 2,
  loading = false,
  trend,
  tooltip,
}) => {
  const getValueColor = () => {
    if (trend === 'up') return 'rgb(0, 180, 42)';
    if (trend === 'down') return 'rgb(245, 63, 63)';
    return undefined;
  };

  return (
    <Card loading={loading} hoverable>
      <Tooltip content={tooltip}>
        <Statistic
          title={title}
          value={typeof value === 'number' ? value.toFixed(precision) : value}
          suffix={suffix}
          prefix={prefix}
          style={{ color: getValueColor() }}
        />
      </Tooltip>
    </Card>
  );
};

// Drawdown calculation helper
const calculateDrawdownCurve = (values: number[]): number[] => {
  const result: number[] = [];
  let peak = values[0];
  
  for (const value of values) {
    if (value > peak) peak = value;
    const drawdown = peak > 0 ? ((peak - value) / peak) * 100 : 0;
    result.push(drawdown);
  }
  
  return result;
};

// Main Performance Page
const PerformancePage: React.FC = () => {
  const [timeRange, setTimeRange] = useState<string>('1w');
  const [isMobile, setIsMobile] = useState(false);
  const [strategyMetrics, setStrategyMetrics] = useState<StrategyMetrics[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  // Detect mobile
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch data
  const { stats: _stats, loading: statsLoading } = useStats();
  const { strategies, loading: strategiesLoading } = useStrategies();
  const { trades, loading: tradesLoading } = useTrades(undefined, 1000);
  const { portfolio, loading: portfolioLoading } = usePortfolio();

  // Load strategy metrics
  React.useEffect(() => {
    const loadMetrics = async () => {
      try {
        const metricsPromises = strategies.map(async (strategy) => {
          const rank = await api.getStrategyRank(strategy.id);
          return rank?.metrics;
        });
        const metrics = (await Promise.all(metricsPromises)).filter(Boolean) as StrategyMetrics[];
        setStrategyMetrics(metrics);
      } catch (err) {
        console.error('Failed to load strategy metrics:', err);
      } finally {
        setLoadingMetrics(false);
      }
    };

    if (strategies.length > 0) {
      loadMetrics();
    }
  }, [strategies]);

  // Generate mock historical data for equity curve (in production, this would come from API)
  const historicalData = useMemo((): HistoricalDataPoint[] => {
    if (!trades.length) return [];
    
    // Group trades by date
    const tradesByDate = new Map<string, { buys: Trade[]; sells: Trade[] }>();
    
    trades.forEach(trade => {
      const date = new Date(trade.executedAt).toISOString().split('T')[0];
      if (!tradesByDate.has(date)) {
        tradesByDate.set(date, { buys: [], sells: [] });
      }
      const entry = tradesByDate.get(date)!;
      if (trade.side === 'buy') entry.buys.push(trade);
      else entry.sells.push(trade);
    });

    // Build equity curve
    const initialCapital = 100000; // Default starting capital
    let currentValue = initialCapital;
    const data: HistoricalDataPoint[] = [];
    
    const sortedDates = Array.from(tradesByDate.keys()).sort();
    
    sortedDates.forEach(date => {
      const entry = tradesByDate.get(date)!;
      const _buyVolume = entry.buys.reduce((sum, t) => sum + t.total, 0);
      const sellVolume = entry.sells.reduce((sum, t) => sum + t.total, 0);
      
      // Simplified P&L calculation
      const dayPnL = sellVolume * 0.02; // Assume 2% profit on sells
      currentValue += dayPnL;
      
      data.push({
        timestamp: new Date(date),
        value: currentValue,
      });
    });

    return data;
  }, [trades]);

  // Calculate portfolio analytics
  const {
    riskMetrics,
    performanceMetrics,
    positionAnalysis: _positionAnalysis,
    pnlBreakdown: _pnlBreakdown,
    isLoading: analyticsLoading,
  } = usePortfolioAnalytics({
    trades,
    portfolioValue: portfolio?.totalValue || 100000,
    initialCapital: 100000,
    positions: portfolio?.positions || [],
    historicalValues: historicalData,
    currentUnrealizedPnL: 0,
  });

  // Prepare equity curve chart data
  const equityCurveData = useMemo(() => {
    return historicalData.map((point, index) => ({
      date: point.timestamp.toLocaleDateString(),
      value: point.value,
      return: index > 0 
        ? ((point.value - historicalData[index - 1].value) / historicalData[index - 1].value) * 100 
        : 0,
    }));
  }, [historicalData]);

  // Prepare drawdown curve data
  const drawdownCurveData = useMemo(() => {
    const values = historicalData.map(h => h.value);
    const drawdowns = calculateDrawdownCurve(values);
    
    return historicalData.map((point, index) => ({
      date: point.timestamp.toLocaleDateString(),
      drawdown: drawdowns[index],
    }));
  }, [historicalData]);

  // Prepare monthly returns data
  const monthlyReturnsData = useMemo(() => {
    if (!trades.length) return [];
    
    const monthlyPnL = new Map<string, number>();
    
    trades.forEach(trade => {
      const date = new Date(trade.executedAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      const current = monthlyPnL.get(monthKey) || 0;
      // Simplified: count sell trades as realized P&L
      if (trade.side === 'sell') {
        monthlyPnL.set(monthKey, current + trade.total * 0.02); // Assume 2% profit
      } else {
        monthlyPnL.set(monthKey, current - trade.total * 0.005); // Assume 0.5% cost
      }
    });
    
    return Array.from(monthlyPnL.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12) // Last 12 months
      .map(([month, pnl]) => ({
        month,
        pnl,
      }));
  }, [trades]);

  // Prepare asset allocation data
  const assetAllocationData = useMemo(() => {
    if (!portfolio?.positions?.length) return [];
    
    return portfolio.positions.map(pos => ({
      name: pos.symbol,
      value: pos.quantity * (pos.averageCost || 0),
    }));
  }, [portfolio]);

  // Strategy comparison columns
  const strategyColumns = [
    {
      title: '策略名称',
      dataIndex: 'strategyName',
      key: 'strategyName',
      width: 150,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          active: 'green',
          paused: 'orange',
          stopped: 'red',
        };
        return <Tag color={colorMap[status] || 'gray'}>{status}</Tag>;
      },
    },
    {
      title: '总收益',
      dataIndex: 'totalPnL',
      key: 'totalPnL',
      width: 100,
      render: (value: number) => (
        <Text style={{ color: value >= 0 ? 'rgb(0, 180, 42)' : 'rgb(245, 63, 63)' }}>
          {formatCurrency(value)}
        </Text>
      ),
    },
    {
      title: '收益率',
      dataIndex: 'roi',
      key: 'roi',
      width: 100,
      render: (value: number) => (
        <Text style={{ color: value >= 0 ? 'rgb(0, 180, 42)' : 'rgb(245, 63, 63)' }}>
          {formatPercent(value)}
        </Text>
      ),
    },
    {
      title: '胜率',
      dataIndex: 'winRate',
      key: 'winRate',
      width: 80,
      render: (value: number) => `${value.toFixed(1)}%`,
    },
    {
      title: '夏普比率',
      dataIndex: 'sharpeRatio',
      key: 'sharpeRatio',
      width: 100,
      render: (value: number) => value.toFixed(2),
    },
    {
      title: '最大回撤',
      dataIndex: 'maxDrawdown',
      key: 'maxDrawdown',
      width: 100,
      render: (value: number) => (
        <Text style={{ color: 'rgb(245, 63, 63)' }}>
          {formatPercent(-Math.abs(value))}
        </Text>
      ),
    },
    {
      title: '交易次数',
      dataIndex: 'totalTrades',
      key: 'totalTrades',
      width: 80,
    },
  ];

  // Scatter plot data for risk/return
  const scatterData = useMemo(() => {
    return strategyMetrics.map(m => ({
      name: m.strategyName,
      x: m.maxDrawdown, // Risk (max drawdown)
      y: m.roi, // Return
      size: m.totalTrades, // Size by number of trades
    }));
  }, [strategyMetrics]);

  const isLoading = statsLoading || strategiesLoading || tradesLoading || portfolioLoading || analyticsLoading;

  // Empty state
  if (!isLoading && trades.length === 0) {
    return (
      <ErrorBoundary>
        <div style={{ padding: isMobile ? 12 : 24 }}>
          <Title heading={3}>交易绩效监控</Title>
          <Empty description="暂无交易数据，开始交易后即可查看绩效分析" />
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: isMobile ? 12 : 24,
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 12 : 0,
        }}>
          <Title heading={3} style={{ margin: 0 }}>交易绩效监控</Title>
          <Space>
            <Select
              value={timeRange}
              onChange={setTimeRange}
              style={{ width: 120 }}
            >
              {TIME_RANGES.map(range => (
                <Select.Option key={range.value} value={range.value}>
                  {range.label}
                </Select.Option>
              ))}
            </Select>
          </Space>
        </div>

        {/* Core Metrics Cards */}
        <Row gutter={isMobile ? 8 : 16} style={{ marginBottom: isMobile ? 16 : 24 }}>
          <Col xs={12} sm={8} md={6}>
            <MetricsCard
              title="总收益"
              value={performanceMetrics.totalReturn}
              prefix="$"
              loading={isLoading}
              trend={performanceMetrics.totalReturn >= 0 ? 'up' : 'down'}
              tooltip="账户总收益金额"
            />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <MetricsCard
              title="收益率"
              value={performanceMetrics.totalReturnPercent}
              suffix="%"
              loading={isLoading}
              trend={performanceMetrics.totalReturnPercent >= 0 ? 'up' : 'down'}
              tooltip="账户总收益率"
            />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <MetricsCard
              title="最大回撤"
              value={riskMetrics.maxDrawdownPercent}
              suffix="%"
              loading={isLoading}
              trend="down"
              tooltip="历史最大回撤幅度"
            />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <MetricsCard
              title="夏普比率"
              value={riskMetrics.sharpeRatio}
              loading={isLoading}
              tooltip="风险调整后收益指标，越高越好"
            />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <MetricsCard
              title="胜率"
              value={performanceMetrics.winRate}
              suffix="%"
              loading={isLoading}
              trend={performanceMetrics.winRate >= 50 ? 'up' : 'down'}
              tooltip="盈利交易占比"
            />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <MetricsCard
              title="盈亏比"
              value={performanceMetrics.profitFactor}
              loading={isLoading}
              trend={performanceMetrics.profitFactor >= 1 ? 'up' : 'down'}
              tooltip="总盈利与总亏损的比率"
            />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <MetricsCard
              title="平均持仓"
              value={formatDuration(performanceMetrics.averageTradeDuration)}
              loading={isLoading}
              tooltip="平均每笔交易持仓时长"
            />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <MetricsCard
              title="波动率"
              value={riskMetrics.volatility}
              suffix="%"
              loading={isLoading}
              tooltip="年化波动率"
            />
          </Col>
        </Row>

        {/* Charts Row 1: Equity Curve & Drawdown */}
        <Row gutter={isMobile ? 8 : 16} style={{ marginBottom: isMobile ? 16 : 24 }}>
          <Col xs={24} md={12}>
            <Card title="收益曲线" loading={isLoading}>
              <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                <ComposedChart data={equityCurveData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: isMobile ? 10 : 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <RechartsTooltip />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="value"
                    fill="#8884d8"
                    stroke="#8884d8"
                    fillOpacity={0.3}
                    name="账户价值"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="return"
                    stroke="#82ca9d"
                    name="日收益率 (%)"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="回撤曲线" loading={isLoading}>
              <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                <AreaChart data={drawdownCurveData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: isMobile ? 10 : 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis />
                  <RechartsTooltip />
                  <Area
                    type="monotone"
                    dataKey="drawdown"
                    stroke="#ff7300"
                    fill="#ff7300"
                    fillOpacity={0.3}
                    name="回撤 (%)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        {/* Charts Row 2: Monthly Returns & Asset Allocation */}
        <Row gutter={isMobile ? 8 : 16} style={{ marginBottom: isMobile ? 16 : 24 }}>
          <Col xs={24} md={12}>
            <Card title="月度收益" loading={isLoading}>
              {monthlyReturnsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                  <BarChart data={monthlyReturnsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: isMobile ? 10 : 12 }}
                    />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Bar 
                      dataKey="pnl" 
                      name="收益"
                      fill="#8884d8"
                    >
                      {monthlyReturnsData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.pnl >= 0 ? '#00C49F' : '#FF8042'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty description="暂无月度数据" />
              )}
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="资产配置" loading={isLoading}>
              {assetAllocationData.length > 0 ? (
                <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                  <PieChart>
                    <Pie
                      data={assetAllocationData}
                      cx="50%"
                      cy="50%"
                      labelLine={!isMobile}
                      label={({ name, percent }) => 
                        isMobile ? '' : `${name}: ${((percent || 0) * 100).toFixed(0)}%`
                      }
                      outerRadius={isMobile ? 60 : 100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {assetAllocationData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Empty description="暂无持仓数据" />
              )}
            </Card>
          </Col>
        </Row>

        {/* Strategy Comparison Table */}
        <Row gutter={isMobile ? 8 : 16} style={{ marginBottom: isMobile ? 16 : 24 }}>
          <Col span={24}>
            <Card 
              title="策略对比" 
              loading={isLoading || loadingMetrics}
              bodyStyle={isMobile ? { padding: 0, overflowX: 'auto' } : undefined}
            >
              {strategyMetrics.length > 0 ? (
                <div className={isMobile ? 'mobile-table-container' : ''}>
                  <Table
                    columns={strategyColumns}
                    dataSource={strategyMetrics}
                    rowKey="strategyId"
                    pagination={false}
                    size="small"
                    scroll={isMobile ? { x: 900 } : undefined}
                  />
                </div>
              ) : (
                <Empty description="暂无策略数据" />
              )}
            </Card>
          </Col>
        </Row>

        {/* Strategy Risk/Return Scatter */}
        <Row gutter={isMobile ? 8 : 16}>
          <Col span={24}>
            <Card title="策略风险收益分布" loading={isLoading || loadingMetrics}>
              {scatterData.length > 0 ? (
                <ResponsiveContainer width="100%" height={isMobile ? 300 : 400}>
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid />
                    <XAxis 
                      type="number" 
                      dataKey="x" 
                      name="最大回撤" 
                      unit="%" 
                      tick={{ fontSize: isMobile ? 10 : 12 }}
                    />
                    <YAxis 
                      type="number" 
                      dataKey="y" 
                      name="收益率" 
                      unit="%" 
                      tick={{ fontSize: isMobile ? 10 : 12 }}
                    />
                    <ZAxis type="number" dataKey="size" range={[50, 400]} name="交易次数" />
                    <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Legend />
                    <ReferenceLine y={0} stroke="#666" />
                    <Scatter 
                      name="策略" 
                      data={scatterData} 
                      fill="#8884d8"
                    >
                      {scatterData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.y >= 0 ? '#00C49F' : '#FF8042'} 
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <Empty description="暂无策略数据" />
              )}
            </Card>
          </Col>
        </Row>
      </div>
    </ErrorBoundary>
  );
};

export default PerformancePage;
