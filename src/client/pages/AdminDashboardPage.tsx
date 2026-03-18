/**
 * AdminDashboardPage - Revenue Analytics Dashboard
 * Admin-only page for monitoring revenue, subscriptions, and business metrics
 */

import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Grid,
  Spin,
  Message,
  DatePicker,
  Select,
  Button,
  Space,
  Tag,
  Statistic,
  Divider,
  Table,
  Progress,
  Tooltip,
  Modal,
  Empty,
} from '@arco-design/web-react';
import {
  IconDownload,
  IconRefresh,
  IconArrowRise,
  IconUser,
  IconTrophy,
  IconExclamationCircle,
  IconDashboard,
  IconApps,
  IconFire,
} from '@arco-design/web-react/icon';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList,
  Treemap,
} from 'recharts';
import { ErrorBoundary } from '../components/ErrorBoundary';

const { Title, Text, Paragraph } = Typography;
const { Row, Col } = Grid;
const { RangePicker } = DatePicker;

// Types
interface RevenueMetrics {
  mrr: number;
  arr: number;
  arpu: number;
  totalRevenue: number;
  activeSubscribers: number;
  trialUsers: number;
  churnRate: number;
  ltv: number;
  conversionRate: number;
}

interface RevenueTrend {
  date: string;
  revenue: number;
  subscriptions: number;
  churned: number;
  newSubscribers: number;
}

interface SubscriptionDistribution {
  planId: string;
  planName: string;
  count: number;
  percentage: number;
  revenue: number;
}

interface ConversionFunnel {
  stage: string;
  count: number;
  percentage: number;
}

interface ChurnData {
  month: string;
  churnedUsers: number;
  totalUsers: number;
  churnRate: number;
  topReasons: string[];
}

interface SummaryData {
  metrics: RevenueMetrics;
  distribution: SubscriptionDistribution[];
  funnel: ConversionFunnel[];
  churn: ChurnData[];
  trend: RevenueTrend[];
}

// Colors for charts
const COLORS = ['#165DFF', '#14C9C9', '#F7BA1E', '#F53F3F', '#722ED1', '#00B42A'];

const AdminDashboardPage: React.FC = () => {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<[Date, Date]>([
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    new Date(),
  ]);
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day');
  const [trendData, setTrendData] = useState<RevenueTrend[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    fetchSummary();
    fetchTrend();
  }, []);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('supabase_token');
      const response = await fetch('/api/revenue/summary', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          Message.error('您没有访问此页面的权限');
          return;
        }
        throw new Error('Failed to fetch summary');
      }

      const data = await response.json();
      setSummary(data.data);
    } catch (error) {
      console.error('Failed to fetch summary:', error);
      Message.error('加载收入数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchTrend = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('supabase_token');
      const start = dateRange[0].toISOString();
      const end = dateRange[1].toISOString();
      
      const response = await fetch(
        `/api/revenue/trend?startDate=${start}&endDate=${end}&granularity=${granularity}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch trend');

      const data = await response.json();
      setTrendData(data.data);
    } catch (error) {
      console.error('Failed to fetch trend:', error);
    }
  };

  const exportPayments = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('supabase_token');
      const start = dateRange[0].toISOString();
      const end = dateRange[1].toISOString();
      
      const response = await fetch(
        `/api/revenue/export/payments?startDate=${start}&endDate=${end}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to export payments');

      const csv = await response.text();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `revenue-report-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      
      Message.success('导出成功');
    } catch (error) {
      console.error('Failed to export payments:', error);
      Message.error('导出失败');
    }
  };

  const exportSubscribers = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('supabase_token');
      
      const response = await fetch('/api/revenue/export/subscribers', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to export subscribers');

      const csv = await response.text();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      
      Message.success('导出成功');
    } catch (error) {
      console.error('Failed to export subscribers:', error);
      Message.error('导出失败');
    }
  };

  const formatCurrency = (value: number): string => {
    return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercent = (value: number): string => {
    return `${value.toFixed(2)}%`;
  };

  // Render metric card
  const MetricCard = ({ title, value, suffix, icon, color, trend }: {
    title: string;
    value: string | number;
    suffix?: string;
    icon: React.ReactNode;
    color: string;
    trend?: number;
  }) => (
    <Card style={{ height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            background: `${color}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: color,
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>{title}</Text>
          <div style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold' }}>{value}</Text>
            {suffix && <Text type="secondary" style={{ marginLeft: 4 }}>{suffix}</Text>}
          </div>
          {trend !== undefined && (
            <div style={{ marginTop: 4 }}>
              <Tag color={trend >= 0 ? 'green' : 'red'}>
                {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
              </Tag>
            </div>
          )}
        </div>
      </div>
    </Card>
  );

  // Render pie chart for subscription distribution
  const renderDistributionChart = () => {
    if (!summary?.distribution?.length) return <Empty />;

    const data = summary.distribution.map(d => ({
      name: d.planName,
      value: d.count,
      revenue: d.revenue,
    }));

    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <RechartsTooltip
            formatter={(value: any, name: string, props: any) => [
              `${value} 用户 (¥${props.payload.revenue.toFixed(2)} 收入)`,
              name,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  // Render funnel chart
  const renderFunnelChart = () => {
    if (!summary?.funnel?.length) return <Empty />;

    return (
      <ResponsiveContainer width="100%" height={300}>
        <FunnelChart>
          <Funnel
            dataKey="count"
            data={summary.funnel}
            isAnimationActive
          >
            <LabelList
              position="right"
              fill="#000"
              stroke="none"
              dataKey="stage"
              formatter={(value: string, entry: any) => `${value} (${entry.payload.percentage.toFixed(1)}%)`}
            />
            {summary.funnel.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    );
  };

  // Render churn analysis
  const renderChurnChart = () => {
    if (!summary?.churn?.length) return <Empty />;

    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={summary.churn}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <RechartsTooltip />
          <Legend />
          <Bar yAxisId="left" dataKey="churnedUsers" name="流失用户" fill="#F53F3F" />
          <Bar yAxisId="left" dataKey="totalUsers" name="总用户" fill="#165DFF" />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  // Render revenue trend
  const renderTrendChart = () => {
    if (!trendData?.length) return <Empty />;

    return (
      <ResponsiveContainer width="100%" height={350}>
        <AreaChart data={trendData}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#165DFF" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#165DFF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <RechartsTooltip formatter={(value: any) => formatCurrency(value)} />
          <Legend />
          <Area
            type="monotone"
            dataKey="revenue"
            name="收入"
            stroke="#165DFF"
            fillOpacity={1}
            fill="url(#colorRevenue)"
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  return (
    <ErrorBoundary>
      <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconDashboard style={{ fontSize: 28, color: '#165DFF' }} />
            <Title heading={3} style={{ margin: 0 }}>收入分析仪表板</Title>
          </div>
          <Space>
            <RangePicker
              value={dateRange}
              onChange={(dates) => dates && setDateRange(dates as [Date, Date])}
              style={{ width: 280 }}
            />
            <Select
              value={granularity}
              onChange={(value) => setGranularity(value)}
              style={{ width: 120 }}
            >
              <Select.Option value="day">按日</Select.Option>
              <Select.Option value="week">按周</Select.Option>
              <Select.Option value="month">按月</Select.Option>
            </Select>
            <Button
              type="primary"
              icon={<IconRefresh />}
              onClick={() => { fetchSummary(); fetchTrend(); }}
            >
              刷新
            </Button>
          </Space>
        </div>

        <Spin loading={loading} style={{ display: 'block' }}>
          {/* Key Metrics */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                title="MRR (月经常性收入)"
                value={formatCurrency(summary?.metrics?.mrr || 0)}
                icon={<IconArrowRise style={{ fontSize: 24 }} />}
                color="#165DFF"
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                title="ARR (年经常性收入)"
                value={formatCurrency(summary?.metrics?.arr || 0)}
                icon={<IconDashboard style={{ fontSize: 24 }} />}
                color="#14C9C9"
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                title="ARPU (每用户平均收入)"
                value={formatCurrency(summary?.metrics?.arpu || 0)}
                icon={<IconUser style={{ fontSize: 24 }} />}
                color="#F7BA1E"
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                title="LTV (用户终身价值)"
                value={formatCurrency(summary?.metrics?.ltv || 0)}
                icon={<IconTrophy style={{ fontSize: 24 }} />}
                color="#722ED1"
              />
            </Col>
          </Row>

          {/* Secondary Metrics */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                title="活跃订阅者"
                value={summary?.metrics?.activeSubscribers || 0}
                suffix="人"
                icon={<IconUser style={{ fontSize: 24 }} />}
                color="#00B42A"
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                title="试用用户"
                value={summary?.metrics?.trialUsers || 0}
                suffix="人"
                icon={<IconUser style={{ fontSize: 24 }} />}
                color="#86909C"
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                title="流失率"
                value={formatPercent(summary?.metrics?.churnRate || 0)}
                icon={<IconExclamationCircle style={{ fontSize: 24 }} />}
                color="#F53F3F"
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                title="转化率"
                value={formatPercent(summary?.metrics?.conversionRate || 0)}
                icon={<IconApps style={{ fontSize: 24 }} />}
                color="#165DFF"
              />
            </Col>
          </Row>

          {/* Charts Row 1 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={16}>
              <Card title="收入趋势">
                {renderTrendChart()}
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card title="订阅分布">
                {renderDistributionChart()}
              </Card>
            </Col>
          </Row>

          {/* Charts Row 2 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={12}>
              <Card title="转化漏斗">
                {renderFunnelChart()}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="流失分析 (最近 6 个月)">
                {renderChurnChart()}
              </Card>
            </Col>
          </Row>

          {/* Export Section */}
          <Card title="数据导出">
            <Space wrap>
              <Button
                icon={<IconDownload />}
                onClick={exportPayments}
              >
                导出收入报表 (CSV)
              </Button>
              <Button
                icon={<IconDownload />}
                onClick={exportSubscribers}
              >
                导出订阅用户列表 (CSV)
              </Button>
            </Space>
            <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
              导出数据将包含选定时间范围内的所有交易和订阅信息
            </Paragraph>
          </Card>

          {/* Distribution Table */}
          {summary?.distribution && summary.distribution.length > 0 && (
            <Card title="订阅计划详情" style={{ marginTop: 16 }}>
              <Table
                data={summary.distribution}
                columns={[
                  {
                    title: '计划名称',
                    dataIndex: 'planName',
                    key: 'planName',
                  },
                  {
                    title: '用户数',
                    dataIndex: 'count',
                    key: 'count',
                    sorter: (a, b) => a.count - b.count,
                  },
                  {
                    title: '占比',
                    dataIndex: 'percentage',
                    key: 'percentage',
                    render: (value: number) => (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Progress
                          percent={value}
                          size="small"
                          style={{ width: 100 }}
                          showText={false}
                        />
                        <Text>{value.toFixed(1)}%</Text>
                      </div>
                    ),
                  },
                  {
                    title: '月收入',
                    dataIndex: 'revenue',
                    key: 'revenue',
                    render: (value: number) => formatCurrency(value),
                    sorter: (a, b) => a.revenue - b.revenue,
                  },
                ]}
                rowKey="planId"
                pagination={false}
              />
            </Card>
          )}
        </Spin>
      </div>
    </ErrorBoundary>
  );
};

export default AdminDashboardPage;