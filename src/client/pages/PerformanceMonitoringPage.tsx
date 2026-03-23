/**
 * PerformanceMonitoringPage - Performance Monitoring Dashboard
 * 
 * Admin-only page for monitoring mobile/web performance metrics
 * with real-time alerts and threshold configuration.
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  Tooltip,
  Empty,
  Statistic,
  Tabs,
  Table,
  Modal,
  Form,
  InputNumber,
  Switch,
  Badge,
  Descriptions,
} from '@arco-design/web-react';
import {
  IconDashboard,
  IconMobile,
  IconDesktop,
  IconThunderbolt,
  IconWifi,
  IconCloud,
  IconRefresh,
  IconExclamationCircle,
  IconCheckCircle,
  IconSettings,
  IconBell,
} from '@arco-design/web-react/icon';
import {
  Line,
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
  ComposedChart,
} from 'recharts';
import { ErrorBoundary } from '../components/ErrorBoundary';

const { Title, Text } = Typography;
const { Row, Col } = Grid;
const { RangePicker } = DatePicker;
const TabPane = Tabs.TabPane;

// Types
interface PerformanceSummary {
  total_samples: number;
  unique_sessions: number;
  unique_users: number;
  avg_lcp: number;
  avg_fcp: number;
  avg_fid: number;
  avg_cls: number;
  avg_tti: number;
  avg_api_latency: number;
  mobile_samples: number;
  desktop_samples: number;
  tablet_samples: number;
  good_lcp_percent: number;
  needs_improvement_lcp_percent: number;
  poor_lcp_percent: number;
  good_fcp_percent: number;
  needs_improvement_fcp_percent: number;
  poor_fcp_percent: number;
}

interface DeviceDistribution {
  device_type: string;
  count: number;
  percentage: number;
  avg_lcp: number;
  avg_fcp: number;
}

interface ConnectionDistribution {
  connection_type: string;
  count: number;
  percentage: number;
  avg_latency: number;
}

interface PagePerformance {
  page: string;
  count: number;
  avg_lcp: number;
  avg_fcp: number;
  avg_fid: number;
  avg_cls: number;
  avg_tti: number;
}

interface TrendPoint {
  period: string;
  avg_fcp: number;
  avg_lcp: number;
  p50_fcp: number;
  p50_lcp: number;
  p75_fcp: number;
  p75_lcp: number;
  p95_fcp: number;
  p95_lcp: number;
  avg_fid: number;
  avg_cls: number;
  avg_tti: number;
  avg_api_latency: number;
  sample_count: number;
}

interface PerformanceThreshold {
  id: string;
  metric_type: string;
  warning_threshold: number;
  critical_threshold: number;
  enabled: boolean;
  notification_channels: {
    in_app: boolean;
    email: boolean;
    webhook: boolean;
  };
  cooldown_minutes: number;
}

interface PerformanceAlert {
  id: string;
  metric_type: string;
  severity: 'warning' | 'critical';
  current_value: number;
  threshold_value: number;
  page?: string;
  device_type?: string;
  status: 'active' | 'acknowledged' | 'resolved';
  created_at: string;
}

// Colors for charts
const COLORS = ['#165DFF', '#14C9C9', '#F7BA1E', '#F53F3F', '#722ED1', '#00B42A'];
const PERFORMANCE_COLORS = {
  good: '#00B42A',
  needsImprovement: '#F7BA1E',
  poor: '#F53F3F',
};

const PerformanceMonitoringPage: React.FC = () => {
  // State
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [deviceDistribution, setDeviceDistribution] = useState<DeviceDistribution[]>([]);
  const [connectionDistribution, setConnectionDistribution] = useState<ConnectionDistribution[]>([]);
  const [pagePerformance, setPagePerformance] = useState<PagePerformance[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [thresholds, setThresholds] = useState<PerformanceThreshold[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<PerformanceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<[Date, Date]>([
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    new Date(),
  ]);
  const [granularity, setGranularity] = useState<'hour' | 'day' | 'week'>('day');
  const [isMobile, setIsMobile] = useState(false);
  const [thresholdModalVisible, setThresholdModalVisible] = useState(false);
  const [selectedThreshold, setSelectedThreshold] = useState<PerformanceThreshold | null>(null);

  // Check mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('supabase_token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const start = dateRange[0].toISOString();
      const end = dateRange[1].toISOString();
      
      // Fetch all endpoints in parallel
      const [summaryRes, deviceRes, connectionRes, pageRes, trendRes, thresholdsRes, alertsRes] = await Promise.all([
        fetch(`/api/performance/summary?start_date=${start}&end_date=${end}`, { headers }),
        fetch(`/api/performance/device-distribution?start_date=${start}&end_date=${end}`, { headers }),
        fetch(`/api/performance/connection-distribution?start_date=${start}&end_date=${end}`, { headers }),
        fetch(`/api/performance/page-performance?start_date=${start}&end_date=${end}`, { headers }),
        fetch(`/api/performance/trend?start_date=${start}&end_date=${end}&granularity=${granularity}`, { headers }),
        fetch('/api/performance/alerts/thresholds', { headers }),
        fetch('/api/performance/alerts?limit=20', { headers }),
      ]);

      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary(data.data);
      }
      
      if (deviceRes.ok) {
        const data = await deviceRes.json();
        setDeviceDistribution(data.data || []);
      }
      
      if (connectionRes.ok) {
        const data = await connectionRes.json();
        setConnectionDistribution(data.data || []);
      }
      
      if (pageRes.ok) {
        const data = await pageRes.json();
        setPagePerformance(data.data || []);
      }
      
      if (trendRes.ok) {
        const data = await trendRes.json();
        setTrendData(data.data || []);
      }

      if (thresholdsRes.ok) {
        const data = await thresholdsRes.json();
        setThresholds(data.data || []);
      }

      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setActiveAlerts(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch performance data:', error);
      Message.error('加载性能数据失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange, granularity]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAllData();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAllData();
  };

  // Handle threshold update
  const handleUpdateThreshold = async (values: any) => {
    if (!selectedThreshold) return;

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('supabase_token');
      const response = await fetch(`/api/performance/alerts/thresholds/${selectedThreshold.metric_type}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        Message.success('阈值更新成功');
        setThresholdModalVisible(false);
        fetchAllData();
      } else {
        Message.error('更新失败');
      }
    } catch (error) {
      Message.error('更新失败');
    }
  };

  // Handle alert acknowledge
  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('supabase_token');
      const response = await fetch(`/api/performance/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        Message.success('告警已确认');
        fetchAllData();
      }
    } catch (error) {
      Message.error('操作失败');
    }
  };

  // Handle alert resolve
  const handleResolveAlert = async (alertId: string) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('supabase_token');
      const response = await fetch(`/api/performance/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        Message.success('告警已解决');
        fetchAllData();
      }
    } catch (error) {
      Message.error('操作失败');
    }
  };

  // Format helpers
  const formatMs = (value: number | null | undefined): string => {
    if (value == null) return '-';
    return `${value.toFixed(0)}ms`;
  };

  const formatScore = (value: number | null | undefined): string => {
    if (value == null) return '-';
    return value.toFixed(3);
  };

  const formatPercent = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  // Get performance rating
  const getLcpRating = (lcp: number): 'good' | 'needsImprovement' | 'poor' => {
    if (lcp <= 2500) return 'good';
    if (lcp <= 4000) return 'needsImprovement';
    return 'poor';
  };

  const getFcpRating = (fcp: number): 'good' | 'needsImprovement' | 'poor' => {
    if (fcp <= 1800) return 'good';
    if (fcp <= 3000) return 'needsImprovement';
    return 'poor';
  };

  const getRatingColor = (rating: 'good' | 'needsImprovement' | 'poor') => {
    return PERFORMANCE_COLORS[rating];
  };

  // Metric Card component
  const MetricCard = ({ 
    title, 
    value, 
    unit, 
    icon, 
    rating,
    tooltip,
  }: { 
    title: string; 
    value: number | null; 
    unit?: string;
    icon: React.ReactNode; 
    rating?: 'good' | 'needsImprovement' | 'poor';
    tooltip?: string;
  }) => {
    const color = rating ? getRatingColor(rating) : '#165DFF';
    
    return (
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
            <Tooltip content={tooltip}>
              <div style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
                  {value != null ? (unit === 'ms' ? formatMs(value) : value.toFixed(2)) : '-'}
                </Text>
                {unit && unit !== 'ms' && <Text type="secondary" style={{ marginLeft: 4 }}>{unit}</Text>}
              </div>
            </Tooltip>
            {rating && (
              <div style={{ marginTop: 4 }}>
                <Tag color={rating === 'good' ? 'green' : rating === 'needsImprovement' ? 'orange' : 'red'}>
                  {rating === 'good' ? '良好' : rating === 'needsImprovement' ? '需改进' : '较差'}
                </Tag>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  };

  // Render LCP distribution chart
  const renderLcpDistribution = () => {
    if (!summary) return <Empty />;
    
    const data = [
      { name: '良好 (<2.5s)', value: summary.good_lcp_percent, color: PERFORMANCE_COLORS.good },
      { name: '需改进 (2.5-4s)', value: summary.needs_improvement_lcp_percent, color: PERFORMANCE_COLORS.needsImprovement },
      { name: '较差 (>4s)', value: summary.poor_lcp_percent, color: PERFORMANCE_COLORS.poor },
    ].filter(d => d.value > 0);

    return (
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  // Render trend chart
  const renderTrendChart = () => {
    if (!trendData.length) return <Empty />;

    return (
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={trendData}>
          <defs>
            <linearGradient id="colorLcp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#165DFF" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#165DFF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
          <YAxis />
          <RechartsTooltip 
            formatter={(value: any, name: string) => [formatMs(value), name]}
            labelFormatter={(label) => `时间: ${label}`}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="avg_lcp"
            name="平均 LCP"
            stroke="#165DFF"
            fill="url(#colorLcp)"
          />
          <Line
            type="monotone"
            dataKey="p75_lcp"
            name="P75 LCP"
            stroke="#F7BA1E"
            strokeDasharray="5 5"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="p95_lcp"
            name="P95 LCP"
            stroke="#F53F3F"
            strokeDasharray="5 5"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  // Render device distribution chart
  const renderDeviceChart = () => {
    if (!deviceDistribution.length) return <Empty />;

    return (
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={deviceDistribution} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis dataKey="device_type" type="category" width={80} />
          <RechartsTooltip />
          <Legend />
          <Bar dataKey="count" name="样本数" fill="#165DFF" />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  // Render connection distribution
  const renderConnectionChart = () => {
    if (!connectionDistribution.length) return <Empty />;

    return (
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={connectionDistribution}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="connection_type" />
          <YAxis />
          <RechartsTooltip />
          <Legend />
          <Bar dataKey="count" name="样本数" fill="#14C9C9" />
          <Bar dataKey="avg_latency" name="平均延迟(ms)" fill="#F7BA1E" />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  // Render alerts section
  const renderAlertsSection = () => {
    const alertColumns = [
      {
        title: '指标类型',
        dataIndex: 'metric_type',
        key: 'metric_type',
        render: (type: string) => (
          <Tag color="blue">{type.toUpperCase()}</Tag>
        ),
      },
      {
        title: '严重程度',
        dataIndex: 'severity',
        key: 'severity',
        render: (severity: string) => (
          <Tag color={severity === 'critical' ? 'red' : 'orange'}>
            {severity === 'critical' ? '严重' : '警告'}
          </Tag>
        ),
      },
      {
        title: '当前值',
        dataIndex: 'current_value',
        key: 'current_value',
        render: (value: number, record: PerformanceAlert) => (
          <Text>
            {value.toFixed(2)} / {record.threshold_value}
          </Text>
        ),
      },
      {
        title: '页面',
        dataIndex: 'page',
        key: 'page',
        render: (page: string) => page || '-',
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        render: (status: string) => {
          const statusConfig: Record<string, { color: string; text: string }> = {
            active: { color: 'red', text: '活跃' },
            acknowledged: { color: 'orange', text: '已确认' },
            resolved: { color: 'green', text: '已解决' },
          };
          const config = statusConfig[status] || { color: 'gray', text: status };
          return <Tag color={config.color}>{config.text}</Tag>;
        },
      },
      {
        title: '时间',
        dataIndex: 'created_at',
        key: 'created_at',
        render: (date: string) => new Date(date).toLocaleString('zh-CN'),
      },
      {
        title: '操作',
        key: 'actions',
        render: (_: any, record: PerformanceAlert) => (
          <Space>
            {record.status === 'active' && (
              <Button
                size="small"
                onClick={() => handleAcknowledgeAlert(record.id)}
              >
                确认
              </Button>
            )}
            {record.status !== 'resolved' && (
              <Button
                size="small"
                type="primary"
                status="success"
                onClick={() => handleResolveAlert(record.id)}
              >
                解决
              </Button>
            )}
          </Space>
        ),
      },
    ];

    return (
      <Card 
        title={
          <Space>
            <IconExclamationCircle style={{ color: '#F53F3F' }} />
            <span>活跃告警</span>
            {activeAlerts.filter(a => a.status === 'active').length > 0 && (
              <Badge count={activeAlerts.filter(a => a.status === 'active').length} />
            )}
          </Space>
        }
        extra={
          <Button
            icon={<IconSettings />}
            onClick={() => setThresholdModalVisible(true)}
          >
            告警配置
          </Button>
        }
        style={{ marginTop: 24 }}
      >
        <Table
          data={activeAlerts}
          columns={alertColumns}
          rowKey="id"
          pagination={{ pageSize: 5 }}
          scroll={{ x: 800 }}
          noDataElement={
            <Empty
              icon={<IconCheckCircle style={{ color: '#00B42A', fontSize: 48 }} />}
              description="暂无活跃告警"
            />
          }
        />
      </Card>
    );
  };

  // Render thresholds configuration
  const renderThresholdsSection = () => {
    const thresholdColumns = [
      {
        title: '指标',
        dataIndex: 'metric_type',
        key: 'metric_type',
        render: (type: string) => (
          <Text style={{ fontWeight: 'bold' }}>{type.toUpperCase()}</Text>
        ),
      },
      {
        title: '警告阈值',
        dataIndex: 'warning_threshold',
        key: 'warning_threshold',
        render: (value: number, record: PerformanceThreshold) => (
          <Tag color="orange">{value}{record.metric_type === 'cls' ? '' : 'ms'}</Tag>
        ),
      },
      {
        title: '严重阈值',
        dataIndex: 'critical_threshold',
        key: 'critical_threshold',
        render: (value: number, record: PerformanceThreshold) => (
          <Tag color="red">{value}{record.metric_type === 'cls' ? '' : 'ms'}</Tag>
        ),
      },
      {
        title: '状态',
        dataIndex: 'enabled',
        key: 'enabled',
        render: (enabled: boolean) => (
          <Tag color={enabled ? 'green' : 'gray'}>
            {enabled ? '已启用' : '已禁用'}
          </Tag>
        ),
      },
      {
        title: '通知渠道',
        dataIndex: 'notification_channels',
        key: 'notification_channels',
        render: (channels: { in_app: boolean; email: boolean; webhook: boolean }) => (
          <Space>
            {channels.in_app && <Tag color="blue">站内</Tag>}
            {channels.email && <Tag color="purple">邮件</Tag>}
            {channels.webhook && <Tag color="cyan">Webhook</Tag>}
          </Space>
        ),
      },
      {
        title: '操作',
        key: 'actions',
        render: (_: any, record: PerformanceThreshold) => (
          <Button
            size="small"
            icon={<IconSettings />}
            onClick={() => {
              setSelectedThreshold(record);
              setThresholdModalVisible(true);
            }}
          >
            配置
          </Button>
        ),
      },
    ];

    return (
      <Card title="告警阈值配置" style={{ marginTop: 24 }}>
        <Table
          data={thresholds}
          columns={thresholdColumns}
          rowKey="id"
          pagination={false}
        />
      </Card>
    );
  };

  // Page performance table columns
  const pageColumns = [
    {
      title: '页面',
      dataIndex: 'page',
      key: 'page',
      render: (page: string) => (
        <Text code style={{ fontSize: 12 }}>{page}</Text>
      ),
    },
    {
      title: '样本数',
      dataIndex: 'count',
      key: 'count',
      sorter: (a: PagePerformance, b: PagePerformance) => a.count - b.count,
    },
    {
      title: 'LCP',
      dataIndex: 'avg_lcp',
      key: 'avg_lcp',
      render: (value: number) => (
        <Tag color={getLcpRating(value) === 'good' ? 'green' : getLcpRating(value) === 'poor' ? 'red' : 'orange'}>
          {formatMs(value)}
        </Tag>
      ),
      sorter: (a: PagePerformance, b: PagePerformance) => a.avg_lcp - b.avg_lcp,
    },
    {
      title: 'FCP',
      dataIndex: 'avg_fcp',
      key: 'avg_fcp',
      render: (value: number) => (
        <Tag color={getFcpRating(value) === 'good' ? 'green' : getFcpRating(value) === 'poor' ? 'red' : 'orange'}>
          {formatMs(value)}
        </Tag>
      ),
      sorter: (a: PagePerformance, b: PagePerformance) => a.avg_fcp - b.avg_fcp,
    },
    {
      title: 'FID',
      dataIndex: 'avg_fid',
      key: 'avg_fid',
      render: (value: number) => formatMs(value),
    },
    {
      title: 'CLS',
      dataIndex: 'avg_cls',
      key: 'avg_cls',
      render: (value: number) => formatScore(value),
    },
    {
      title: 'TTI',
      dataIndex: 'avg_tti',
      key: 'avg_tti',
      render: (value: number) => formatMs(value),
    },
  ];

  return (
    <ErrorBoundary>
      <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconDashboard style={{ fontSize: 28, color: '#165DFF' }} />
            <Title heading={3} style={{ margin: 0 }}>性能监控面板</Title>
            {activeAlerts.filter(a => a.status === 'active').length > 0 && (
              <Badge count={activeAlerts.filter(a => a.status === 'active').length}>
                <IconBell style={{ fontSize: 20, color: '#F53F3F' }} />
              </Badge>
            )}
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
              <Select.Option value="hour">按小时</Select.Option>
              <Select.Option value="day">按日</Select.Option>
              <Select.Option value="week">按周</Select.Option>
            </Select>
            <Button
              type="primary"
              icon={<IconRefresh />}
              onClick={handleRefresh}
              loading={refreshing}
            >
              刷新
            </Button>
          </Space>
        </div>

        <Spin loading={loading} style={{ display: 'block' }}>
          {/* Core Web Vitals */}
          <Title heading={4} style={{ marginBottom: 16 }}>核心指标 (Core Web Vitals)</Title>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                title="LCP (最大内容绘制)"
                value={summary?.avg_lcp}
                unit="ms"
                icon={<IconThunderbolt style={{ fontSize: 24 }} />}
                rating={summary?.avg_lcp ? getLcpRating(summary.avg_lcp) : undefined}
                tooltip="LCP 应 ≤ 2.5s"
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                title="FCP (首次内容绘制)"
                value={summary?.avg_fcp}
                unit="ms"
                icon={<IconCloud style={{ fontSize: 24 }} />}
                rating={summary?.avg_fcp ? getFcpRating(summary.avg_fcp) : undefined}
                tooltip="FCP 应 ≤ 1.8s"
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                title="FID (首次输入延迟)"
                value={summary?.avg_fid}
                unit="ms"
                icon={<IconThunderbolt style={{ fontSize: 24 }} />}
                rating={summary?.avg_fid && summary.avg_fid <= 100 ? 'good' : summary?.avg_fid && summary.avg_fid <= 300 ? 'needsImprovement' : 'poor'}
                tooltip="FID 应 ≤ 100ms"
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                title="CLS (累积布局偏移)"
                value={summary?.avg_cls}
                icon={<IconDesktop style={{ fontSize: 24 }} />}
                rating={summary?.avg_cls && summary.avg_cls <= 0.1 ? 'good' : summary?.avg_cls && summary.avg_cls <= 0.25 ? 'needsImprovement' : 'poor'}
                tooltip="CLS 应 ≤ 0.1"
              />
            </Col>
          </Row>

          {/* Summary Stats */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="总样本数"
                  value={summary?.total_samples || 0}
                  prefix={<IconDashboard />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="独立会话"
                  value={summary?.unique_sessions || 0}
                  prefix={<IconMobile />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="API 平均延迟"
                  value={summary?.avg_api_latency || 0}
                  suffix="ms"
                  prefix={<IconWifi />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="TTI (可交互时间)"
                  value={summary?.avg_tti || 0}
                  suffix="ms"
                  prefix={<IconThunderbolt />}
                />
              </Card>
            </Col>
          </Row>

          {/* Device Distribution */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={12}>
              <Card title="设备类型分布">
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={8}>
                    <div style={{ textAlign: 'center' }}>
                      <IconMobile style={{ fontSize: 32, color: '#165DFF' }} />
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary">移动端</Text>
                      </div>
                      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>
                        {summary?.mobile_samples || 0}
                      </Text>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ textAlign: 'center' }}>
                      <IconDesktop style={{ fontSize: 32, color: '#14C9C9' }} />
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary">桌面端</Text>
                      </div>
                      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>
                        {summary?.desktop_samples || 0}
                      </Text>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ textAlign: 'center' }}>
                      <IconMobile style={{ fontSize: 32, color: '#F7BA1E' }} />
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary">平板</Text>
                      </div>
                      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>
                        {summary?.tablet_samples || 0}
                      </Text>
                    </div>
                  </Col>
                </Row>
                {renderDeviceChart()}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="网络类型分布">
                {renderConnectionChart()}
              </Card>
            </Col>
          </Row>

          {/* LCP Distribution & Trend */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={8}>
              <Card title="LCP 性能分布">
                {renderLcpDistribution()}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 16 }}>
                  <Tag color="green">良好 (&lt;2.5s): {formatPercent(summary?.good_lcp_percent || 0)}</Tag>
                  <Tag color="orange">需改进: {formatPercent(summary?.needs_improvement_lcp_percent || 0)}</Tag>
                  <Tag color="red">较差: {formatPercent(summary?.poor_lcp_percent || 0)}</Tag>
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={16}>
              <Card title="性能趋势">
                {renderTrendChart()}
              </Card>
            </Col>
          </Row>

          {/* Page Performance Table */}
          <Card title="页面性能详情">
            <Table
              data={pagePerformance}
              columns={pageColumns}
              rowKey="page"
              pagination={{ pageSize: 10 }}
              scroll={{ x: 800 }}
            />
          </Card>

          {/* Alerts Section */}
          {renderAlertsSection()}

          {/* Thresholds Configuration */}
          {renderThresholdsSection()}

          {/* Performance Guidelines */}
          <Card title="性能指标参考标准" style={{ marginTop: 16 }}>
            <Row gutter={[24, 16]}>
              <Col xs={24} sm={12} lg={6}>
                <div style={{ padding: 16, background: '#f7f8fa', borderRadius: 8 }}>
                  <Text style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>LCP (最大内容绘制)</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    视口内最大内容元素的渲染时间
                  </Text>
                  <div style={{ marginTop: 8 }}>
                    <Tag color="green">良好: ≤ 2.5s</Tag>
                    <Tag color="orange">需改进: 2.5-4s</Tag>
                    <Tag color="red">较差: &gt; 4s</Tag>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <div style={{ padding: 16, background: '#f7f8fa', borderRadius: 8 }}>
                  <Text style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>FCP (首次内容绘制)</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    首次渲染任何文本、图像等的时间
                  </Text>
                  <div style={{ marginTop: 8 }}>
                    <Tag color="green">良好: ≤ 1.8s</Tag>
                    <Tag color="orange">需改进: 1.8-3s</Tag>
                    <Tag color="red">较差: &gt; 3s</Tag>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <div style={{ padding: 16, background: '#f7f8fa', borderRadius: 8 }}>
                  <Text style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>FID (首次输入延迟)</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    用户首次交互到浏览器响应的时间
                  </Text>
                  <div style={{ marginTop: 8 }}>
                    <Tag color="green">良好: ≤ 100ms</Tag>
                    <Tag color="orange">需改进: 100-300ms</Tag>
                    <Tag color="red">较差: &gt; 300ms</Tag>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <div style={{ padding: 16, background: '#f7f8fa', borderRadius: 8 }}>
                  <Text style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>CLS (累积布局偏移)</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    页面整个生命周期内的布局偏移分数
                  </Text>
                  <div style={{ marginTop: 8 }}>
                    <Tag color="green">良好: ≤ 0.1</Tag>
                    <Tag color="orange">需改进: 0.1-0.25</Tag>
                    <Tag color="red">较差: &gt; 0.25</Tag>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </Spin>

        {/* Threshold Configuration Modal */}
        <Modal
          title="告警阈值配置"
          visible={thresholdModalVisible}
          onCancel={() => {
            setThresholdModalVisible(false);
            setSelectedThreshold(null);
          }}
          footer={null}
          style={{ width: 600 }}
        >
          {selectedThreshold && (
            <Form
              layout="vertical"
              initialValues={{
                warning_threshold: selectedThreshold.warning_threshold,
                critical_threshold: selectedThreshold.critical_threshold,
                enabled: selectedThreshold.enabled,
                cooldown_minutes: selectedThreshold.cooldown_minutes,
                in_app: selectedThreshold.notification_channels.in_app,
                email: selectedThreshold.notification_channels.email,
                webhook: selectedThreshold.notification_channels.webhook,
              }}
              onSubmit={handleUpdateThreshold}
            >
              <Descriptions column={1} border style={{ marginBottom: 16 }}>
                <Descriptions.Item label="指标类型">
                  <Tag color="blue">{selectedThreshold.metric_type.toUpperCase()}</Tag>
                </Descriptions.Item>
              </Descriptions>
              
              <Form.Item label="警告阈值" field="warning_threshold">
                <InputNumber 
                  style={{ width: '100%' }} 
                  min={0}
                  suffix={selectedThreshold.metric_type === 'cls' ? '' : 'ms'}
                />
              </Form.Item>
              
              <Form.Item label="严重阈值" field="critical_threshold">
                <InputNumber 
                  style={{ width: '100%' }} 
                  min={0}
                  suffix={selectedThreshold.metric_type === 'cls' ? '' : 'ms'}
                />
              </Form.Item>
              
              <Form.Item label="冷却时间 (分钟)" field="cooldown_minutes">
                <InputNumber style={{ width: '100%' }} min={1} max={1440} />
              </Form.Item>
              
              <Form.Item label="启用告警" field="enabled" triggerPropName="checked">
                <Switch />
              </Form.Item>
              
              <Form.Item label="通知渠道">
                <Space>
                  <Form.Item field="in_app" triggerPropName="checked" noStyle>
                    <Switch /> 站内通知
                  </Form.Item>
                  <Form.Item field="email" triggerPropName="checked" noStyle>
                    <Switch /> 邮件
                  </Form.Item>
                  <Form.Item field="webhook" triggerPropName="checked" noStyle>
                    <Switch /> Webhook
                  </Form.Item>
                </Space>
              </Form.Item>
              
              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit">
                    保存
                  </Button>
                  <Button onClick={() => setThresholdModalVisible(false)}>
                    取消
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          )}
        </Modal>
      </div>
    </ErrorBoundary>
  );
};

export default PerformanceMonitoringPage;