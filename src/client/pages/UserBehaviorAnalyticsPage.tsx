/**
 * User Behavior Analytics Dashboard Page
 *
 * Visualizes user behavior data including:
 * - DAU/MAU metrics
 * - User retention rates
 * - Funnel conversions
 * - Page view heatmaps
 *
 * @module pages/UserBehaviorAnalyticsPage
 */

import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Statistic,
  Grid,
  Tabs,
  Spin,
  Empty,
  Message,
  Space,
  Button,
  Select,
  Progress,
  Tag,
  Table,
  Tooltip as ArcoTooltip,
} from '@arco-design/web-react';
import {
  IconUser,
  IconUserGroup,
  IconDashboard,
  IconRefresh,
  IconDownload,
  IconCalendar,
  IconFire,
} from '@arco-design/web-react/icon';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList,
  Cell,
} from 'recharts';
import { useAuth } from '../hooks/useAuth';
import { ErrorBoundary } from '../components/ErrorBoundary';

const { Row, Col } = Grid;
const { Title, Text } = Typography;
const TabPane = Tabs.TabPane;

// Types
interface EngagementMetrics {
  dau: number;
  wau: number;
  mau: number;
  stickiness: number;
  retention: {
    day1: number;
    day7: number;
    day30: number;
  };
  avgSessionDuration: number;
  avgSessionsPerUser: number;
}

interface FunnelStep {
  name: string;
  order: number;
  count: number;
  conversionRate: number;
  dropOffRate: number;
}

interface DashboardFunnel {
  name: string;
  steps: FunnelStep[];
  totalUsers: number;
  completedUsers: number;
  overallConversionRate: number;
}

interface FeatureUsage {
  feature: string;
  category: string;
  usageCount: number;
  uniqueUsers: number;
}

interface HeatmapCell {
  hour: number;
  day: number;
  value: number;
  normalizedValue: number;
}

interface ActivityHeatmap {
  type: 'hourly' | 'daily';
  data: HeatmapCell[];
  maxValue: number;
  minValue: number;
}

interface PageView {
  url: string;
  views: number;
  uniqueVisitors: number;
}

interface RealTimeStats {
  activeUsers: number;
  pageViewsLastHour: number;
  eventsLastHour: number;
  topPages: Array<{ url: string; views: number }>;
  topEvents: Array<{ type: string; count: number }>;
  timestamp: string;
}

interface DashboardData {
  overview: {
    northStar: { name: string; value: number; trend: number; unit: string };
    metrics: Record<string, { name: string; value: number; trend: number; unit: string }>;
  };
  funnels: {
    signupToTrade: DashboardFunnel;
    strategyExecution: DashboardFunnel;
    subscriptionConversion: DashboardFunnel;
  };
  featureUsage: FeatureUsage[];
  heatmap: ActivityHeatmap;
  realTime: RealTimeStats;
}

// Colors for charts
const COLORS = [
  'rgb(var(--primary-6))',
  'rgb(var(--success-6))',
  'rgb(var(--warning-6))',
  'rgb(var(--danger-6))',
  'rgb(var(--purple-6))',
];
const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// Custom tooltip for charts
const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: any[];
  label?: string;
}> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          backgroundColor: 'var(--color-bg-3)',
          border: '1px solid var(--color-border)',
          borderRadius: 4,
          padding: 12,
        }}
      >
        <Text style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>
          {label}
        </Text>
        {payload.map((entry, index) => (
          <Text key={index} style={{ display: 'block', color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </Text>
        ))}
      </div>
    );
  }
  return null;
};

// Metric Card Component
const MetricCard: React.FC<{
  title: string;
  value: number | string;
  trend?: number;
  icon?: React.ReactNode;
  unit?: string;
  loading?: boolean;
}> = ({ title, value, trend, icon, unit, loading }) => (
  <Card loading={loading} style={{ height: '100%' }}>
    <Statistic
      title={
        <Space>
          {icon}
          <span>{title}</span>
        </Space>
      }
      value={value}
      suffix={unit}
      trend={trend !== undefined ? (trend > 0 ? 'up' : trend < 0 ? 'down' : 'none') : undefined}
      trendValue={trend !== undefined ? `${Math.abs(trend).toFixed(1)}%` : undefined}
    />
  </Card>
);

// Funnel Chart Component
const FunnelChartComponent: React.FC<{
  funnel: DashboardFunnel;
  loading?: boolean;
}> = ({ funnel, loading }) => {
  if (loading) {
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!funnel || !funnel.steps || funnel.steps.length === 0) {
    return (
      <Card>
        <Empty description="暂无数据" />
      </Card>
    );
  }

  const data = funnel.steps.map((step) => ({
    name: step.name,
    value: step.count,
    fill: `hsl(${200 + step.order * 20}, 70%, 50%)`,
  }));

  return (
    <Card
      title={funnel.name}
      extra={
        <Tag color="blue">
          总转化率: {funnel.overallConversionRate.toFixed(1)}%
        </Tag>
      }
    >
      <ResponsiveContainer width="100%" height={300}>
        <FunnelChart>
          <Tooltip content={<CustomTooltip />} />
          <Funnel
            dataKey="value"
            data={data}
            isAnimationActive
          >
            <LabelList
              position="right"
              fill="#000"
              stroke="none"
              dataKey="name"
            />
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
      <div style={{ marginTop: 16 }}>
        {funnel.steps.map((step, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: index < funnel.steps.length - 1 ? '1px solid var(--color-border)' : 'none',
            }}
          >
            <Text>{step.name}</Text>
            <Space>
              <Text type="secondary">{step.count.toLocaleString()} 用户</Text>
              {index > 0 && (
                <Tag color={step.conversionRate > 50 ? 'green' : step.conversionRate > 20 ? 'orange' : 'red'}>
                  转化: {step.conversionRate.toFixed(1)}%
                </Tag>
              )}
            </Space>
          </div>
        ))}
      </div>
    </Card>
  );
};

// Activity Heatmap Component
const ActivityHeatmapChart: React.FC<{
  heatmap: ActivityHeatmap;
  loading?: boolean;
}> = ({ heatmap, loading }) => {
  if (loading) {
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!heatmap || !heatmap.data || heatmap.data.length === 0) {
    return (
      <Card>
        <Empty description="暂无数据" />
      </Card>
    );
  }

  // Group data by day for display
  const groupedData: Record<number, HeatmapCell[]> = {};
  for (const cell of heatmap.data) {
    if (!groupedData[cell.day]) {
      groupedData[cell.day] = [];
    }
    groupedData[cell.day].push(cell);
  }

  const getColor = (value: number, maxValue: number) => {
    const intensity = value / maxValue;
    if (intensity === 0) return 'var(--color-fill-1)';
    if (intensity < 0.25) return 'rgb(var(--primary-1))';
    if (intensity < 0.5) return 'rgb(var(--primary-3))';
    if (intensity < 0.75) return 'rgb(var(--primary-5))';
    return 'rgb(var(--primary-7))';
  };

  return (
    <Card title="用户活跃度热力图">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ width: 60, padding: 8 }}></th>
              {Array.from({ length: 24 }, (_, h) => (
                <th
                  key={h}
                  style={{
                    padding: 4,
                    fontSize: 10,
                    textAlign: 'center',
                    minWidth: 24,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3, 4, 5, 6].map((day) => (
              <tr key={day}>
                <td style={{ padding: 8, fontSize: 12 }}>
                  {DAY_NAMES[day]}
                </td>
                {Array.from({ length: 24 }, (_, h) => {
                  const cell = heatmap.data.find((c) => c.day === day && c.hour === h);
                  const value = cell?.value || 0;
                  return (
                    <td key={h} style={{ padding: 2 }}>
                      <ArcoTooltip
                        content={`${DAY_NAMES[day]} ${h}:00 - ${value} 次事件`}
                      >
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            backgroundColor: getColor(value, heatmap.maxValue),
                            borderRadius: 2,
                          }}
                        />
                      </ArcoTooltip>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <Text type="secondary" style={{ marginRight: 8 }}>活跃度:</Text>
        <div style={{ display: 'flex', gap: 4 }}>
          {['var(--color-fill-1)', 'rgb(var(--primary-1))', 'rgb(var(--primary-3))', 'rgb(var(--primary-5))', 'rgb(var(--primary-7))'].map((color, i) => (
            <div
              key={i}
              style={{
                width: 16,
                height: 16,
                backgroundColor: color,
                borderRadius: 2,
              }}
            />
          ))}
        </div>
        <Text type="secondary" style={{ marginLeft: 8 }}>低 → 高</Text>
      </div>
    </Card>
  );
};

// Page Views Table
const PageViewsTable: React.FC<{
  data: PageView[];
  loading?: boolean;
}> = ({ data, loading }) => {
  const columns = [
    {
      title: '页面 URL',
      dataIndex: 'url',
      key: 'url',
      render: (url: string) => (
        <Text style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
          {url}
        </Text>
      ),
    },
    {
      title: '访问量',
      dataIndex: 'views',
      key: 'views',
      sorter: (a: PageView, b: PageView) => a.views - b.views,
      render: (views: number) => views.toLocaleString(),
    },
    {
      title: '独立访客',
      dataIndex: 'uniqueVisitors',
      key: 'uniqueVisitors',
      sorter: (a: PageView, b: PageView) => a.uniqueVisitors - b.uniqueVisitors,
      render: (visitors: number) => visitors.toLocaleString(),
    },
  ];

  return (
    <Card title="热门页面">
      <Table
        columns={columns}
        data={data}
        loading={loading}
        pagination={{ pageSize: 10 }}
        rowKey="url"
        style={{ marginTop: 16 }}
      />
    </Card>
  );
};

// Feature Usage Chart
const FeatureUsageChart: React.FC<{
  data: FeatureUsage[];
  loading?: boolean;
}> = ({ data, loading }) => {
  if (loading) {
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card title="功能使用统计">
        <Empty description="暂无数据" />
      </Card>
    );
  }

  return (
    <Card title="功能使用统计">
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data.slice(0, 10)} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis type="number" stroke="var(--color-text-3)" />
          <YAxis dataKey="feature" type="category" width={120} stroke="var(--color-text-3)" />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="usageCount" name="使用次数" fill="rgb(var(--primary-6))" />
          <Bar dataKey="uniqueUsers" name="使用用户数" fill="rgb(var(--success-6))" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};

// Real-time Stats Card
const RealTimeStatsCard: React.FC<{
  stats: RealTimeStats;
  loading?: boolean;
}> = ({ stats, loading }) => (
  <Card title="实时数据" extra={<Tag color="green">在线</Tag>} loading={loading}>
    <Row gutter={[16, 16]}>
      <Col span={8}>
        <Statistic
          title="当前活跃用户"
          value={stats?.activeUsers || 0}
          prefix={<IconUser />}
        />
      </Col>
      <Col span={8}>
        <Statistic
          title="最近1小时页面访问"
          value={stats?.pageViewsLastHour || 0}
          prefix={<IconDashboard />}
        />
      </Col>
      <Col span={8}>
        <Statistic
          title="最近1小时事件"
          value={stats?.eventsLastHour || 0}
          prefix={<IconFire />}
        />
      </Col>
    </Row>
    {stats?.topPages && stats.topPages.length > 0 && (
      <div style={{ marginTop: 24 }}>
        <Title heading={6}>热门页面（最近1小时）</Title>
        {stats.topPages.slice(0, 5).map((page, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <Text>{page.url}</Text>
            <Tag>{page.views} 次</Tag>
          </div>
        ))}
      </div>
    )}
  </Card>
);

// Retention Chart Component
const RetentionChart: React.FC<{
  retention: { day1: number; day7: number; day30: number };
  loading?: boolean;
}> = ({ retention, loading }) => {
  if (loading) {
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  const data = [
    { name: '次日留存', value: retention?.day1 || 0, fill: 'rgb(var(--success-6))' },
    { name: '7日留存', value: retention?.day7 || 0, fill: 'rgb(var(--primary-6))' },
    { name: '30日留存', value: retention?.day30 || 0, fill: 'rgb(var(--warning-6))' },
  ];

  return (
    <Card title="用户留存率">
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: 20 }}>
        {data.map((item, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <Progress
              type="circle"
              percent={item.value}
              style={{ '--progress-circle-stroke-color': item.fill } as any}
            />
            <Text style={{ display: 'block', marginTop: 8 }}>{item.name}</Text>
          </div>
        ))}
      </div>
    </Card>
  );
};

// Main Page Component
const UserBehaviorAnalyticsPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [days, setDays] = useState(7);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [engagement, setEngagement] = useState<EngagementMetrics | null>(null);
  const [pageViews, setPageViews] = useState<PageView[]>([]);

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/user-analytics/dashboard?days=${days}`);
      const result = await response.json();
      
      if (result.success) {
        setDashboardData(result.data);
      } else {
        Message.error('获取仪表板数据失败');
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      Message.error('获取仪表板数据失败');
    } finally {
      setLoading(false);
    }
  };

  // Fetch engagement metrics
  const fetchEngagement = async () => {
    try {
      const response = await fetch(`/api/user-analytics/engagement?days=${days}`);
      const result = await response.json();
      
      if (result.success) {
        setEngagement(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch engagement:', error);
    }
  };

  // Fetch page views
  const fetchPageViews = async () => {
    try {
      const response = await fetch(`/api/user-analytics/page-views?days=${days}&limit=20`);
      const result = await response.json();
      
      if (result.success) {
        setPageViews(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch page views:', error);
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchDashboardData(), fetchEngagement(), fetchPageViews()]);
    setRefreshing(false);
    Message.success('数据已刷新');
  };

  // Fetch data on mount and when days change
  useEffect(() => {
    fetchDashboardData();
    fetchEngagement();
    fetchPageViews();
  }, [days]);

  // Auto-refresh real-time data
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchDashboardData();
      }
    }, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, [days]);

  return (
    <ErrorBoundary>
      <div className="user-behavior-analytics-page">
        {/* Header */}
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title heading={4}>
            <IconUserGroup style={{ marginRight: 8 }} />
            用户行为分析仪表板
          </Title>
          <Space>
            <Select
              value={days}
              onChange={setDays}
              style={{ width: 150 }}
            >
              <Select.Option value={7}>最近7天</Select.Option>
              <Select.Option value={14}>最近14天</Select.Option>
              <Select.Option value={30}>最近30天</Select.Option>
            </Select>
            <Button
              icon={<IconRefresh />}
              loading={refreshing}
              onClick={handleRefresh}
            >
              刷新
            </Button>
            <Button icon={<IconDownload />}>
              导出报告
            </Button>
          </Space>
        </div>

        {/* Key Metrics */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <MetricCard
              title="日活跃用户 (DAU)"
              value={engagement?.dau || 0}
              icon={<IconUser />}
              loading={loading}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <MetricCard
              title="月活跃用户 (MAU)"
              value={engagement?.mau || 0}
              icon={<IconUserGroup />}
              loading={loading}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <MetricCard
              title="粘性系数 (DAU/MAU)"
              value={(engagement?.stickiness || 0).toFixed(1)}
              unit="%"
              icon={<IconDashboard />}
              loading={loading}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <MetricCard
              title="平均会话时长"
              value={Math.floor((engagement?.avgSessionDuration || 0) / 60)}
              unit="分钟"
              icon={<IconCalendar />}
              loading={loading}
            />
          </Col>
        </Row>

        {/* Tabs for different views */}
        <Tabs defaultActiveTab="overview">
          <TabPane key="overview" title="概览">
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={16}>
                <RealTimeStatsCard
                  stats={dashboardData?.realTime || { activeUsers: 0, pageViewsLastHour: 0, eventsLastHour: 0, topPages: [], topEvents: [], timestamp: new Date().toISOString() }}
                  loading={loading}
                />
              </Col>
              <Col xs={24} lg={8}>
                <RetentionChart
                  retention={engagement?.retention || { day1: 0, day7: 0, day30: 0 }}
                  loading={loading}
                />
              </Col>
            </Row>
          </TabPane>

          <TabPane key="funnels" title="漏斗分析">
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={8}>
                <FunnelChartComponent
                  funnel={dashboardData?.funnels?.signupToTrade || { name: '', steps: [], totalUsers: 0, completedUsers: 0, overallConversionRate: 0 }}
                  loading={loading}
                />
              </Col>
              <Col xs={24} lg={8}>
                <FunnelChartComponent
                  funnel={dashboardData?.funnels?.strategyExecution || { name: '', steps: [], totalUsers: 0, completedUsers: 0, overallConversionRate: 0 }}
                  loading={loading}
                />
              </Col>
              <Col xs={24} lg={8}>
                <FunnelChartComponent
                  funnel={dashboardData?.funnels?.subscriptionConversion || { name: '', steps: [], totalUsers: 0, completedUsers: 0, overallConversionRate: 0 }}
                  loading={loading}
                />
              </Col>
            </Row>
          </TabPane>

          <TabPane key="heatmap" title="活跃度热力图">
            <ActivityHeatmapChart
              heatmap={dashboardData?.heatmap || { type: 'hourly', data: [], maxValue: 0, minValue: 0 }}
              loading={loading}
            />
          </TabPane>

          <TabPane key="pages" title="页面分析">
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <PageViewsTable data={pageViews} loading={loading} />
              </Col>
              <Col span={24}>
                <FeatureUsageChart
                  data={dashboardData?.featureUsage || []}
                  loading={loading}
                />
              </Col>
            </Row>
          </TabPane>
        </Tabs>
      </div>
    </ErrorBoundary>
  );
};

export default UserBehaviorAnalyticsPage;