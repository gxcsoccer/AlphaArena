/**
 * Business Metrics Dashboard Page
 *
 * Displays key business metrics including:
 * - Subscription conversion funnel
 * - DAU/MAU metrics and trends
 * - User retention analysis
 * - Revenue metrics (MRR, ARPU, LTV)
 *
 * Issue #652: 业务指标仪表盘 - 订阅转化率、DAU/MAU、留存率
 */

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  Typography,
  Card,
  Statistic,
  Table,
  Tag,
  Space,
  Button,
  Grid,
  Tabs,
  Spin,
  Message,
  Select,
  DatePicker,
  Progress,
  Empty,
  Tooltip as ArcoTooltip,
} from '@arco-design/web-react';
const { Row, Col } = Grid;
const { TabPane } = Tabs;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList,
  Treemap,
} from 'recharts';
import {
  IconArrowRise,
  IconArrowFall,
  IconUser,
  IconTrophy,
  IconDashboard,
  IconDatabase,
  IconSync,
} from '@arco-design/web-react/icon';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useTranslation } from 'react-i18next';
import '../styles/visual-optimization.css';

// Chart colors
const CHART_COLORS = {
  primary: '#165DFF',
  success: '#00B42A',
  warning: '#FF7D00',
  danger: '#F53F3F',
  purple: '#722ED1',
  cyan: '#14C9C9',
  pink: '#F5319D',
};

const FUNNEL_COLORS = ['#165DFF', '#14C9C9', '#FF7D00', '#00B42A'];
const RETENTION_COLORS = ['#165DFF', '#14C9C9', '#722ED1', '#F5319D', '#FF7D00'];

// Types
interface ConversionFunnel {
  name: string;
  steps: Array<{
    step: string;
    order: number;
    count: number;
    conversionRate: number;
    dropOffRate: number;
  }>;
  totalUsers: number;
  completedUsers: number;
  overallConversionRate: number;
}

interface DAUMAUMetric {
  date: string;
  dau: number;
  mau: number;
  stickiness: number;
}

interface RetentionCohort {
  cohortDate: string;
  cohortSize: number;
  retentionRates: Record<string, number>;
}

interface RevenueMetrics {
  mrr: number;
  mrrGrowth: number;
  arr: number;
  arpu: number;
  ltv: number;
  customerCount: number;
  payingCustomerCount: number;
  mrrTrend: Array<{ date: string; mrr: number }>;
}

interface BusinessMetricsDashboard {
  conversionFunnel: ConversionFunnel;
  dauMau: {
    current: DAUMAUMetric;
    trend: DAUMAUMetric[];
    hourlyDistribution: Array<{ hour: number; count: number; uniqueUsers: number }>;
  };
  retention: {
    avgDay1: number;
    avgDay7: number;
    avgDay30: number;
    cohorts: RetentionCohort[];
  };
  revenue: RevenueMetrics;
  period: { start: string; end: string };
  updatedAt: string;
}

// Loading skeleton component
const LoadingSkeleton: React.FC<{ height?: number }> = memo(({ height = 200 }) => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
    <Spin size={40} />
  </div>
));
LoadingSkeleton.displayName = 'LoadingSkeleton';

// Stats Card component
interface StatsCardProps {
  title: string;
  value: number | string;
  suffix?: string;
  prefix?: string;
  trend?: 'up' | 'down';
  trendValue?: string;
  icon?: React.ReactNode;
  loading?: boolean;
  color?: string;
}

const StatsCard: React.FC<StatsCardProps> = memo(({
  title,
  value,
  suffix,
  prefix,
  trend,
  trendValue,
  icon,
  loading,
  color = CHART_COLORS.primary,
}) => (
  <Card
    className="stats-card"
    style={{ borderLeft: `4px solid ${color}` }}
    loading={loading}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <Text type="secondary" size="small">{title}</Text>
        <div style={{ fontSize: 28, fontWeight: 600, color, marginTop: 8 }}>
          {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
        </div>
        {trend && trendValue && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            {trend === 'up' ? (
              <IconArrowRise style={{ color: CHART_COLORS.success }} />
            ) : (
              <IconArrowFall style={{ color: CHART_COLORS.danger }} />
            )}
            <Text
              size="small"
              style={{ color: trend === 'up' ? CHART_COLORS.success : CHART_COLORS.danger }}
            >
              {trendValue}
            </Text>
          </div>
        )}
      </div>
      {icon && (
        <div style={{
          padding: 12,
          borderRadius: 8,
          backgroundColor: `${color}15`,
          color,
        }}>
          {icon}
        </div>
      )}
    </div>
  </Card>
));
StatsCard.displayName = 'StatsCard';

// Funnel Chart component
const FunnelChartComponent: React.FC<{ data: ConversionFunnel['steps'] }> = memo(({ data }) => {
  const chartData = data.map((step, index) => ({
    name: step.step,
    value: step.count,
    conversionRate: step.conversionRate.toFixed(1),
    fill: FUNNEL_COLORS[index % FUNNEL_COLORS.length],
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <FunnelChart>
        <Tooltip
          formatter={(value: number, name: string) => [value.toLocaleString(), name]}
        />
        <Funnel
          dataKey="value"
          data={chartData}
          isAnimationActive
        >
          <LabelList
            position="right"
            fill="#333"
            stroke="none"
            dataKey="name"
          />
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Funnel>
      </FunnelChart>
    </ResponsiveContainer>
  );
});
FunnelChartComponent.displayName = 'FunnelChartComponent';

// DAU/MAU Trend Chart
const DAUMAUTrendChart: React.FC<{ data: DAUMAUMetric[] }> = memo(({ data }) => (
  <ResponsiveContainer width="100%" height={300}>
    <AreaChart data={data}>
      <defs>
        <linearGradient id="colorDau" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
          <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
        </linearGradient>
        <linearGradient id="colorMau" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={CHART_COLORS.purple} stopOpacity={0.3} />
          <stop offset="95%" stopColor={CHART_COLORS.purple} stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-2)" />
      <XAxis
        dataKey="date"
        tickFormatter={(date) => date.slice(5)}
        stroke="var(--color-text-3)"
      />
      <YAxis stroke="var(--color-text-3)" />
      <Tooltip
        contentStyle={{
          backgroundColor: 'var(--color-bg-3)',
          border: '1px solid var(--color-border-2)',
          borderRadius: 8,
        }}
      />
      <Legend />
      <Area
        type="monotone"
        dataKey="dau"
        name="DAU"
        stroke={CHART_COLORS.primary}
        fillOpacity={1}
        fill="url(#colorDau)"
      />
      <Area
        type="monotone"
        dataKey="mau"
        name="MAU"
        stroke={CHART_COLORS.purple}
        fillOpacity={1}
        fill="url(#colorMau)"
      />
    </AreaChart>
  </ResponsiveContainer>
));
DAUMAUTrendChart.displayName = 'DAUMAUTrendChart';

// Stickiness Trend Chart
const StickinessChart: React.FC<{ data: DAUMAUMetric[] }> = memo(({ data }) => (
  <ResponsiveContainer width="100%" height={250}>
    <LineChart data={data}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-2)" />
      <XAxis
        dataKey="date"
        tickFormatter={(date) => date.slice(5)}
        stroke="var(--color-text-3)"
      />
      <YAxis
        domain={[0, 100]}
        tickFormatter={(v) => `${v}%`}
        stroke="var(--color-text-3)"
      />
      <Tooltip
        formatter={(value: number) => [`${value.toFixed(1)}%`, '粘性']}
        contentStyle={{
          backgroundColor: 'var(--color-bg-3)',
          border: '1px solid var(--color-border-2)',
          borderRadius: 8,
        }}
      />
      <Line
        type="monotone"
        dataKey="stickiness"
        name="粘性 (DAU/MAU)"
        stroke={CHART_COLORS.cyan}
        strokeWidth={2}
        dot={false}
      />
    </LineChart>
  </ResponsiveContainer>
));
StickinessChart.displayName = 'StickinessChart';

// Hourly Distribution Chart
const HourlyDistributionChart: React.FC<{
  data: Array<{ hour: number; count: number; uniqueUsers: number }>;
}> = memo(({ data }) => (
  <ResponsiveContainer width="100%" height={250}>
    <BarChart data={data}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-2)" />
      <XAxis
        dataKey="hour"
        tickFormatter={(h) => `${h}:00`}
        stroke="var(--color-text-3)"
      />
      <YAxis stroke="var(--color-text-3)" />
      <Tooltip
        formatter={(value: number) => [value.toLocaleString(), '活跃用户']}
        labelFormatter={(hour) => `${hour}:00 - ${hour + 1}:00`}
        contentStyle={{
          backgroundColor: 'var(--color-bg-3)',
          border: '1px solid var(--color-border-2)',
          borderRadius: 8,
        }}
      />
      <Bar
        dataKey="uniqueUsers"
        name="活跃用户"
        fill={CHART_COLORS.primary}
        radius={[4, 4, 0, 0]}
      />
    </BarChart>
  </ResponsiveContainer>
));
HourlyDistributionChart.displayName = 'HourlyDistributionChart';

// Retention Cohort Table
const RetentionCohortTable: React.FC<{ cohorts: RetentionCohort[] }> = memo(({ cohorts }) => {
  const columns = [
    {
      title: '注册日期',
      dataIndex: 'cohortDate',
      key: 'cohortDate',
      width: 120,
    },
    {
      title: '用户数',
      dataIndex: 'cohortSize',
      key: 'cohortSize',
      width: 80,
      render: (value: number) => value.toLocaleString(),
    },
    {
      title: '次日留存',
      key: 'day1',
      width: 100,
      render: (_: unknown, record: RetentionCohort) => (
        record.retentionRates.day1 !== undefined
          ? <Tag color={record.retentionRates.day1 > 40 ? 'green' : record.retentionRates.day1 > 20 ? 'orange' : 'red'}>
              {record.retentionRates.day1.toFixed(1)}%
            </Tag>
          : '-'
      ),
    },
    {
      title: '7日留存',
      key: 'day7',
      width: 100,
      render: (_: unknown, record: RetentionCohort) => (
        record.retentionRates.day7 !== undefined
          ? <Tag color={record.retentionRates.day7 > 20 ? 'green' : record.retentionRates.day7 > 10 ? 'orange' : 'red'}>
              {record.retentionRates.day7.toFixed(1)}%
            </Tag>
          : '-'
      ),
    },
    {
      title: '30日留存',
      key: 'day30',
      width: 100,
      render: (_: unknown, record: RetentionCohort) => (
        record.retentionRates.day30 !== undefined
          ? <Tag color={record.retentionRates.day30 > 10 ? 'green' : record.retentionRates.day30 > 5 ? 'orange' : 'red'}>
              {record.retentionRates.day30.toFixed(1)}%
            </Tag>
          : '-'
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      data={cohorts}
      rowKey="cohortDate"
      pagination={{ pageSize: 10 }}
      size="small"
      scroll={{ x: 600 }}
    />
  );
});
RetentionCohortTable.displayName = 'RetentionCohortTable';

// Retention Trend Chart
const RetentionTrendChart: React.FC<{
  avgDay1: number;
  avgDay7: number;
  avgDay30: number;
}> = memo(({ avgDay1, avgDay7, avgDay30 }) => {
  const data = [
    { name: '次日留存', value: avgDay1, fill: CHART_COLORS.success },
    { name: '7日留存', value: avgDay7, fill: CHART_COLORS.warning },
    { name: '30日留存', value: avgDay30, fill: CHART_COLORS.primary },
  ];

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-2)" />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
        <YAxis type="category" dataKey="name" width={80} />
        <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`]} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});
RetentionTrendChart.displayName = 'RetentionTrendChart';

// MRR Trend Chart
const MRRTrendChart: React.FC<{ data: Array<{ date: string; mrr: number }> }> = memo(({ data }) => (
  <ResponsiveContainer width="100%" height={250}>
    <AreaChart data={data}>
      <defs>
        <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={CHART_COLORS.success} stopOpacity={0.3} />
          <stop offset="95%" stopColor={CHART_COLORS.success} stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-2)" />
      <XAxis
        dataKey="date"
        tickFormatter={(date) => date.slice(5)}
        stroke="var(--color-text-3)"
      />
      <YAxis stroke="var(--color-text-3)" />
      <Tooltip
        formatter={(value: number) => [`$${value.toLocaleString()}`, 'MRR']}
        contentStyle={{
          backgroundColor: 'var(--color-bg-3)',
          border: '1px solid var(--color-border-2)',
          borderRadius: 8,
        }}
      />
      <Area
        type="monotone"
        dataKey="mrr"
        name="MRR"
        stroke={CHART_COLORS.success}
        fillOpacity={1}
        fill="url(#colorMrr)"
      />
    </AreaChart>
  </ResponsiveContainer>
));
MRRTrendChart.displayName = 'MRRTrendChart';

// Main Business Metrics Page Component
const BusinessMetricsPage: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<BusinessMetricsDashboard | null>(null);
  const [days, setDays] = useState(30);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/business-metrics/dashboard?days=${days}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const result = await response.json();
      if (result.success) {
        setDashboard(result.dashboard);
      } else {
        Message.error('加载业务指标失败');
      }
    } catch (error) {
      console.error('Error fetching business metrics:', error);
      Message.error('加载业务指标失败');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Memoized computed values
  const funnelSteps = useMemo(() => dashboard?.conversionFunnel.steps || [], [dashboard?.conversionFunnel.steps]);

  return (
    <ErrorBoundary>
      <div className="page-container" style={{ padding: 24 }}>
        {/* Header */}
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title heading={4} style={{ margin: 0 }}>
            <IconDashboard style={{ marginRight: 8 }} />
            业务指标仪表盘
          </Title>
          <Space>
            <Select
              value={days}
              onChange={setDays}
              style={{ width: 120 }}
            >
              <Select.Option value={7}>近 7 天</Select.Option>
              <Select.Option value={30}>近 30 天</Select.Option>
              <Select.Option value={90}>近 90 天</Select.Option>
            </Select>
            <Button
              icon={<IconSync />}
              onClick={fetchDashboard}
              loading={loading}
            >
              刷新
            </Button>
          </Space>
        </div>

        {/* Tabs */}
        <Tabs activeTab={activeTab} onChange={setActiveTab}>
          <TabPane key="overview" title="概览">
            {loading ? (
              <LoadingSkeleton height={400} />
            ) : dashboard ? (
              <Row gutter={[16, 16]}>
                {/* Key Metrics Row */}
                <Col xs={24} sm={12} lg={6}>
                  <StatsCard
                    title="DAU"
                    value={dashboard.dauMau.current.dau}
                    icon={<IconUser />}
                    color={CHART_COLORS.primary}
                    loading={loading}
                  />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <StatsCard
                    title="MAU"
                    value={dashboard.dauMau.current.mau}
                    icon={<IconUser />}
                    color={CHART_COLORS.purple}
                    loading={loading}
                  />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <StatsCard
                    title="用户粘性"
                    value={dashboard.dauMau.current.stickiness.toFixed(1)}
                    suffix="%"
                    color={CHART_COLORS.cyan}
                    loading={loading}
                  />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <StatsCard
                    title="MRR"
                    prefix="$"
                    value={dashboard.revenue.mrr}
                    trend={dashboard.revenue.mrrGrowth > 0 ? 'up' : 'down'}
                    trendValue={`${Math.abs(dashboard.revenue.mrrGrowth).toFixed(1)}%`}
                    icon={<IconTrophy />}
                    color={CHART_COLORS.success}
                    loading={loading}
                  />
                </Col>

                {/* Conversion Funnel */}
                <Col xs={24} lg={12}>
                  <Card title="转化漏斗">
                    <FunnelChartComponent data={funnelSteps} />
                    <div style={{ marginTop: 16 }}>
                      <Text type="secondary">总体转化率: </Text>
                      <Text strong style={{ color: CHART_COLORS.success, fontSize: 18 }}>
                        {dashboard.conversionFunnel.overallConversionRate.toFixed(2)}%
                      </Text>
                    </div>
                  </Card>
                </Col>

                {/* Retention Summary */}
                <Col xs={24} lg={12}>
                  <Card title="留存率概览">
                    <RetentionTrendChart
                      avgDay1={dashboard.retention.avgDay1}
                      avgDay7={dashboard.retention.avgDay7}
                      avgDay30={dashboard.retention.avgDay30}
                    />
                  </Card>
                </Col>

                {/* Revenue Metrics */}
                <Col xs={24}>
                  <Card title="收入指标">
                    <Row gutter={[16, 16]}>
                      <Col xs={12} sm={6}>
                        <Statistic
                          title="MRR"
                          value={dashboard.revenue.mrr}
                          prefix="$"
                          suffix="/月"
                        />
                      </Col>
                      <Col xs={12} sm={6}>
                        <Statistic
                          title="ARR"
                          value={dashboard.revenue.arr}
                          prefix="$"
                          suffix="/年"
                        />
                      </Col>
                      <Col xs={12} sm={6}>
                        <Statistic
                          title="ARPU"
                          value={dashboard.revenue.arpu.toFixed(2)}
                          prefix="$"
                        />
                      </Col>
                      <Col xs={12} sm={6}>
                        <Statistic
                          title="LTV"
                          value={dashboard.revenue.ltv.toFixed(2)}
                          prefix="$"
                        />
                      </Col>
                      <Col xs={12} sm={6}>
                        <Statistic
                          title="总用户数"
                          value={dashboard.revenue.customerCount}
                        />
                      </Col>
                      <Col xs={12} sm={6}>
                        <Statistic
                          title="付费用户数"
                          value={dashboard.revenue.payingCustomerCount}
                        />
                      </Col>
                    </Row>
                  </Card>
                </Col>
              </Row>
            ) : (
              <Empty description="暂无数据" />
            )}
          </TabPane>

          <TabPane key="dau-mau" title="DAU/MAU">
            {loading ? (
              <LoadingSkeleton height={400} />
            ) : dashboard ? (
              <Row gutter={[16, 16]}>
                <Col xs={24}>
                  <Card title="DAU/MAU 趋势">
                    <DAUMAUTrendChart data={dashboard.dauMau.trend} />
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title="用户粘性趋势 (DAU/MAU)">
                    <StickinessChart data={dashboard.dauMau.trend} />
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title="分时活跃分布">
                    <HourlyDistributionChart data={dashboard.dauMau.hourlyDistribution} />
                  </Card>
                </Col>
              </Row>
            ) : (
              <Empty description="暂无数据" />
            )}
          </TabPane>

          <TabPane key="retention" title="留存分析">
            {loading ? (
              <LoadingSkeleton height={400} />
            ) : dashboard ? (
              <Row gutter={[16, 16]}>
                <Col xs={24}>
                  <Card title="留存群组分析">
                    <RetentionCohortTable cohorts={dashboard.retention.cohorts} />
                  </Card>
                </Col>
                <Col xs={24}>
                  <Card title="平均留存率">
                    <Row gutter={24}>
                      <Col span={8}>
                        <Statistic
                          title="次日留存率"
                          value={dashboard.retention.avgDay1.toFixed(1)}
                          suffix="%"
                          valueStyle={{ color: CHART_COLORS.success }}
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic
                          title="7日留存率"
                          value={dashboard.retention.avgDay7.toFixed(1)}
                          suffix="%"
                          valueStyle={{ color: CHART_COLORS.warning }}
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic
                          title="30日留存率"
                          value={dashboard.retention.avgDay30.toFixed(1)}
                          suffix="%"
                          valueStyle={{ color: CHART_COLORS.primary }}
                        />
                      </Col>
                    </Row>
                  </Card>
                </Col>
              </Row>
            ) : (
              <Empty description="暂无数据" />
            )}
          </TabPane>

          <TabPane key="revenue" title="收入分析">
            {loading ? (
              <LoadingSkeleton height={400} />
            ) : dashboard ? (
              <Row gutter={[16, 16]}>
                <Col xs={24}>
                  <Card title="MRR 趋势">
                    <MRRTrendChart data={dashboard.revenue.mrrTrend} />
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title="收入概览">
                    <Row gutter={[16, 16]}>
                      <Col span={12}>
                        <Statistic
                          title="月经常性收入 (MRR)"
                          value={dashboard.revenue.mrr}
                          prefix="$"
                          precision={0}
                        />
                      </Col>
                      <Col span={12}>
                        <Statistic
                          title="年经常性收入 (ARR)"
                          value={dashboard.revenue.arr}
                          prefix="$"
                          precision={0}
                        />
                      </Col>
                      <Col span={12}>
                        <Statistic
                          title="每用户平均收入 (ARPU)"
                          value={dashboard.revenue.arpu.toFixed(2)}
                          prefix="$"
                        />
                      </Col>
                      <Col span={12}>
                        <Statistic
                          title="用户生命周期价值 (LTV)"
                          value={dashboard.revenue.ltv.toFixed(2)}
                          prefix="$"
                        />
                      </Col>
                    </Row>
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title="用户统计">
                    <Row gutter={[16, 16]}>
                      <Col span={12}>
                        <Statistic
                          title="总注册用户"
                          value={dashboard.revenue.customerCount}
                        />
                      </Col>
                      <Col span={12}>
                        <Statistic
                          title="付费用户"
                          value={dashboard.revenue.payingCustomerCount}
                        />
                      </Col>
                      <Col span={12}>
                        <Statistic
                          title="付费转化率"
                          value={dashboard.revenue.customerCount > 0
                            ? ((dashboard.revenue.payingCustomerCount / dashboard.revenue.customerCount) * 100).toFixed(1)
                            : '0'}
                          suffix="%"
                        />
                      </Col>
                      <Col span={12}>
                        <Statistic
                          title="MRR 增长"
                          value={dashboard.revenue.mrrGrowth.toFixed(1)}
                          suffix="%"
                          valueStyle={{
                            color: dashboard.revenue.mrrGrowth >= 0 ? CHART_COLORS.success : CHART_COLORS.danger,
                          }}
                        />
                      </Col>
                    </Row>
                  </Card>
                </Col>
              </Row>
            ) : (
              <Empty description="暂无数据" />
            )}
          </TabPane>
        </Tabs>

        {/* Last Updated */}
        {dashboard && (
          <Text type="secondary" style={{ display: 'block', marginTop: 16, textAlign: 'right' }}>
            最后更新: {new Date(dashboard.updatedAt).toLocaleString('zh-CN')}
          </Text>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default BusinessMetricsPage;