/**
 * PaymentMonitoringPage - Payment Monitoring Dashboard
 * Real-time monitoring of payment success rates, failures, and alerts
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
  Table,
  Modal,
  Form,
  InputNumber,
  Switch,
  Badge,
  Progress,
  Tabs,
  Descriptions,
} from '@arco-design/web-react';
import {
  IconDashboard,
  IconTrophy,
  IconCloseCircle,
  IconRefresh,
  IconExclamationCircle,
  IconCheckCircle,
  IconSettings,
  IconNotification,
  IconCreditCard,
  IconLine,
  IconPieChart,
  IconHistory,
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
interface PaymentMetrics {
  totalPayments: number;
  succeededPayments: number;
  failedPayments: number;
  pendingPayments: number;
  refundedPayments: number;
  successRate: number;
  failureRate: number;
  totalRevenue: number;
  totalRefunded: number;
  avgTransactionValue: number;
  uniqueCustomers: number;
  retryRate: number;
}

interface PaymentMethodMetrics {
  method: string;
  totalPayments: number;
  succeededPayments: number;
  failedPayments: number;
  successRate: number;
  totalAmount: number;
  avgAmount: number;
}

interface FailureReason {
  reason: string;
  count: number;
  percentage: number;
  recentExamples: Array<{
    id: string;
    amount: number;
    currency: string;
    createdAt: string;
    userId: string;
  }>;
}

interface PaymentTrend {
  period: string;
  totalPayments: number;
  succeededPayments: number;
  failedPayments: number;
  successRate: number;
  revenue: number;
}

interface PaymentAlert {
  id: string;
  type: 'success_rate_low' | 'gateway_error' | 'high_failure_rate' | 'large_refund' | 'anomaly';
  severity: 'warning' | 'critical';
  message: string;
  currentValue: number;
  thresholdValue: number;
  metadata?: Record<string, any>;
  status: 'active' | 'acknowledged' | 'resolved';
  createdAt: string;
}

interface AlertThreshold {
  type: string;
  warningThreshold: number;
  criticalThreshold: number;
  enabled: boolean;
  cooldownMinutes: number;
}

// Colors
const COLORS = ['#165DFF', '#14C9C9', '#F7BA1E', '#F53F3F', '#722ED1', '#00B42A'];
const PAYMENT_STATUS_COLORS = {
  succeeded: '#00B42A',
  failed: '#F53F3F',
  pending: '#F7BA1E',
  refunded: '#86909C',
};

const PaymentMonitoringPage: React.FC = () => {
  // State
  const [metrics, setMetrics] = useState<PaymentMetrics | null>(null);
  const [methodMetrics, setMethodMetrics] = useState<PaymentMethodMetrics[]>([]);
  const [failureReasons, setFailureReasons] = useState<FailureReason[]>([]);
  const [trendData, setTrendData] = useState<PaymentTrend[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<PaymentAlert[]>([]);
  const [thresholds, setThresholds] = useState<AlertThreshold[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<[Date, Date]>([
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    new Date(),
  ]);
  const [granularity, setGranularity] = useState<'hour' | 'day' | 'week' | 'month'>('day');
  const [isMobile, setIsMobile] = useState(false);
  const [thresholdModalVisible, setThresholdModalVisible] = useState(false);
  const [selectedThreshold, setSelectedThreshold] = useState<AlertThreshold | null>(null);

  // Check mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
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

      const [metricsRes, methodRes, failureRes, trendRes, alertsRes, thresholdsRes] = await Promise.all([
        fetch(`/api/payment-monitoring/metrics?startDate=${start}&endDate=${end}`, { headers }),
        fetch(`/api/payment-monitoring/method-metrics?startDate=${start}&endDate=${end}`, { headers }),
        fetch(`/api/payment-monitoring/failure-reasons?startDate=${start}&endDate=${end}`, { headers }),
        fetch(`/api/payment-monitoring/trend?startDate=${start}&endDate=${end}&granularity=${granularity}`, { headers }),
        fetch('/api/payment-monitoring/alerts?limit=20', { headers }),
        fetch('/api/payment-monitoring/alerts/thresholds', { headers }),
      ]);

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data.data);
      }

      if (methodRes.ok) {
        const data = await methodRes.json();
        setMethodMetrics(data.data || []);
      }

      if (failureRes.ok) {
        const data = await failureRes.json();
        setFailureReasons(data.data || []);
      }

      if (trendRes.ok) {
        const data = await trendRes.json();
        setTrendData(data.data || []);
      }

      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setActiveAlerts(data.data || []);
      }

      if (thresholdsRes.ok) {
        const data = await thresholdsRes.json();
        setThresholds(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch payment monitoring data:', error);
      Message.error('加载支付监控数据失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange, granularity]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchAllData, 60000);
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
      const response = await fetch(`/api/payment-monitoring/alerts/thresholds/${selectedThreshold.type}`, {
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
      const response = await fetch(`/api/payment-monitoring/alerts/${alertId}/acknowledge`, {
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
      const response = await fetch(`/api/payment-monitoring/alerts/${alertId}/resolve`, {
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
  const formatCurrency = (value: number): string => {
    return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercent = (value: number): string => {
    return `${value.toFixed(2)}%`;
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  // Get success rate rating
  const getSuccessRateRating = (rate: number): 'good' | 'warning' | 'critical' => {
    if (rate >= 95) return 'good';
    if (rate >= 90) return 'warning';
    return 'critical';
  };

  const getRatingColor = (rating: 'good' | 'warning' | 'critical') => {
    const colors = { good: '#00B42A', warning: '#F7BA1E', critical: '#F53F3F' };
    return colors[rating];
  };

  // Metric Card component
  const MetricCard = ({
    title,
    value,
    suffix,
    icon,
    rating,
    tooltip,
  }: {
    title: string;
    value: string | number;
    suffix?: string;
    icon: React.ReactNode;
    rating?: 'good' | 'warning' | 'critical';
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
                <Text style={{ fontSize: 24, fontWeight: 'bold' }}>{value}</Text>
                {suffix && <Text type="secondary" style={{ marginLeft: 4 }}>{suffix}</Text>}
              </div>
            </Tooltip>
            {rating && (
              <div style={{ marginTop: 4 }}>
                <Tag color={rating === 'good' ? 'green' : rating === 'warning' ? 'orange' : 'red'}>
                  {rating === 'good' ? '正常' : rating === 'warning' ? '需关注' : '异常'}
                </Tag>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  };

  // Render success rate gauge
  const renderSuccessRateGauge = () => {
    if (!metrics) return <Empty />;

    const rating = getSuccessRateRating(metrics.successRate);
    const color = getRatingColor(rating);

    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <Progress
          percent={metrics.successRate}
          style={{ width: 200 }}
          strokeWidth={12}
          trailColor="#E5E6EB"
          color={color}
        />
        <div style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 32, fontWeight: 'bold', color }}>
            {metrics.successRate.toFixed(2)}%
          </Text>
        </div>
        <Text type="secondary">支付成功率</Text>
        <div style={{ marginTop: 8 }}>
          <Tag color={rating === 'good' ? 'green' : rating === 'warning' ? 'orange' : 'red'}>
            {rating === 'good' ? '✓ 正常 (>95%)' : rating === 'warning' ? '⚠ 需关注 (90-95%)' : '✗ 异常 (<90%)'}
          </Tag>
        </div>
      </div>
    );
  };

  // Render payment status distribution
  const renderStatusDistribution = () => {
    if (!metrics) return <Empty />;

    const data = [
      { name: '成功', value: metrics.succeededPayments, color: PAYMENT_STATUS_COLORS.succeeded },
      { name: '失败', value: metrics.failedPayments, color: PAYMENT_STATUS_COLORS.failed },
      { name: '待处理', value: metrics.pendingPayments, color: PAYMENT_STATUS_COLORS.pending },
      { name: '已退款', value: metrics.refundedPayments, color: PAYMENT_STATUS_COLORS.refunded },
    ].filter(d => d.value > 0);

    return (
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <RechartsTooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  // Render payment method breakdown
  const renderMethodBreakdown = () => {
    if (!methodMetrics.length) return <Empty />;

    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={methodMetrics} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis dataKey="method" type="category" width={100} />
          <RechartsTooltip />
          <Legend />
          <Bar dataKey="succeededPayments" name="成功" fill="#00B42A" />
          <Bar dataKey="failedPayments" name="失败" fill="#F53F3F" />
        </BarChart>
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
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#165DFF" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#165DFF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <RechartsTooltip
            formatter={(value: any, name: string) => {
              if (name === 'revenue') return formatCurrency(value);
              if (name === 'successRate') return formatPercent(value);
              return value;
            }}
          />
          <Legend />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="revenue"
            name="收入"
            stroke="#165DFF"
            fill="url(#colorRevenue)"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="successRate"
            name="成功率"
            stroke="#00B42A"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  // Render failure reasons
  const renderFailureReasons = () => {
    if (!failureReasons.length) return <Empty description="暂无失败记录" />;

    const columns = [
      {
        title: '失败原因',
        dataIndex: 'reason',
        key: 'reason',
        render: (reason: string) => (
          <Text style={{ fontWeight: 500 }}>{reason}</Text>
        ),
      },
      {
        title: '次数',
        dataIndex: 'count',
        key: 'count',
        sorter: (a: FailureReason, b: FailureReason) => a.count - b.count,
      },
      {
        title: '占比',
        dataIndex: 'percentage',
        key: 'percentage',
        render: (value: number) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Progress percent={value} size="small" style={{ width: 80 }} showText={false} />
            <Text>{value.toFixed(1)}%</Text>
          </div>
        ),
      },
    ];

    return (
      <Table
        data={failureReasons}
        columns={columns}
        rowKey="reason"
        pagination={false}
        size="small"
      />
    );
  };

  // Render alerts section
  const renderAlertsSection = () => {
    const alertColumns = [
      {
        title: '告警类型',
        dataIndex: 'type',
        key: 'type',
        render: (type: string) => (
          <Tag color="blue">{getAlertTypeLabel(type)}</Tag>
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
        title: '详细信息',
        dataIndex: 'message',
        key: 'message',
        render: (msg: string) => (
          <Text style={{ maxWidth: 300 }} ellipsis={{ tooltip: msg }}>
            {msg}
          </Text>
        ),
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
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (date: string) => formatDate(date),
      },
      {
        title: '操作',
        key: 'actions',
        render: (_: any, record: PaymentAlert) => (
          <Space>
            {record.status === 'active' && (
              <Button size="small" onClick={() => handleAcknowledgeAlert(record.id)}>
                确认
              </Button>
            )}
            {record.status !== 'resolved' && (
              <Button size="small" type="primary" status="success" onClick={() => handleResolveAlert(record.id)}>
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
            <span>支付告警</span>
            {activeAlerts.filter(a => a.status === 'active').length > 0 && (
              <Badge count={activeAlerts.filter(a => a.status === 'active').length} />
            )}
          </Space>
        }
        extra={
          <Button icon={<IconSettings />} onClick={() => setThresholdModalVisible(true)}>
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
        title: '告警类型',
        dataIndex: 'type',
        key: 'type',
        render: (type: string) => (
          <Text style={{ fontWeight: 'bold' }}>{getAlertTypeLabel(type)}</Text>
        ),
      },
      {
        title: '警告阈值',
        dataIndex: 'warningThreshold',
        key: 'warningThreshold',
        render: (value: number, record: AlertThreshold) => (
          <Tag color="orange">{value}{record.type === 'success_rate' ? '%' : ''}</Tag>
        ),
      },
      {
        title: '严重阈值',
        dataIndex: 'criticalThreshold',
        key: 'criticalThreshold',
        render: (value: number, record: AlertThreshold) => (
          <Tag color="red">{value}{record.type === 'success_rate' ? '%' : ''}</Tag>
        ),
      },
      {
        title: '状态',
        dataIndex: 'enabled',
        key: 'enabled',
        render: (enabled: boolean) => (
          <Tag color={enabled ? 'green' : 'gray'}>{enabled ? '已启用' : '已禁用'}</Tag>
        ),
      },
      {
        title: '冷却时间',
        dataIndex: 'cooldownMinutes',
        key: 'cooldownMinutes',
        render: (value: number) => `${value} 分钟`,
      },
      {
        title: '操作',
        key: 'actions',
        render: (_: any, record: AlertThreshold) => (
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
          rowKey="type"
          pagination={false}
        />
      </Card>
    );
  };

  // Get alert type label
  const getAlertTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      success_rate_low: '支付成功率过低',
      gateway_error: '支付网关异常',
      high_failure_rate: '高失败率',
      large_refund: '大额退款',
      anomaly: '异常检测',
    };
    return labels[type] || type;
  };

  // Payment method table columns
  const methodColumns = [
    {
      title: '支付方式',
      dataIndex: 'method',
      key: 'method',
      render: (method: string) => (
        <Tag color="blue">{method.toUpperCase()}</Tag>
      ),
    },
    {
      title: '总交易数',
      dataIndex: 'totalPayments',
      key: 'totalPayments',
      sorter: (a: PaymentMethodMetrics, b: PaymentMethodMetrics) => a.totalPayments - b.totalPayments,
    },
    {
      title: '成功率',
      dataIndex: 'successRate',
      key: 'successRate',
      render: (value: number) => (
        <Tag color={value >= 95 ? 'green' : value >= 90 ? 'orange' : 'red'}>
          {value.toFixed(2)}%
        </Tag>
      ),
      sorter: (a: PaymentMethodMetrics, b: PaymentMethodMetrics) => a.successRate - b.successRate,
    },
    {
      title: '总金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (value: number) => formatCurrency(value),
      sorter: (a: PaymentMethodMetrics, b: PaymentMethodMetrics) => a.totalAmount - b.totalAmount,
    },
    {
      title: '平均金额',
      dataIndex: 'avgAmount',
      key: 'avgAmount',
      render: (value: number) => formatCurrency(value),
    },
  ];

  return (
    <ErrorBoundary>
      <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconCreditCard style={{ fontSize: 28, color: '#165DFF' }} />
            <Title heading={3} style={{ margin: 0 }}>支付监控仪表盘</Title>
            {activeAlerts.filter(a => a.status === 'active').length > 0 && (
              <Badge count={activeAlerts.filter(a => a.status === 'active').length}>
                <IconNotification style={{ fontSize: 20, color: '#F53F3F' }} />
              </Badge>
            )}
          </div>
          <Space>
            <RangePicker
              value={dateRange}
              onChange={(dates) => dates && setDateRange(dates as [Date, Date])}
              style={{ width: 280 }}
            />
            <Select value={granularity} onChange={(value) => setGranularity(value)} style={{ width: 120 }}>
              <Select.Option value="hour">按小时</Select.Option>
              <Select.Option value="day">按日</Select.Option>
              <Select.Option value="week">按周</Select.Option>
              <Select.Option value="month">按月</Select.Option>
            </Select>
            <Button type="primary" icon={<IconRefresh />} onClick={handleRefresh} loading={refreshing}>
              刷新
            </Button>
          </Space>
        </div>

        <Spin loading={loading} style={{ display: 'block' }}>
          {/* Key Metrics */}
          <Title heading={4} style={{ marginBottom: 16 }}>核心指标</Title>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                title="支付成功率"
                value={formatPercent(metrics?.successRate || 0)}
                icon={<IconTrophy style={{ fontSize: 24 }} />}
                rating={metrics?.successRate ? getSuccessRateRating(metrics.successRate) : undefined}
                tooltip="目标: ≥95%"
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                title="总交易数"
                value={metrics?.totalPayments || 0}
                suffix="笔"
                icon={<IconCreditCard style={{ fontSize: 24 }} />}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                title="总收入"
                value={formatCurrency(metrics?.totalRevenue || 0)}
                icon={<IconLine style={{ fontSize: 24 }} />}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                title="独立客户数"
                value={metrics?.uniqueCustomers || 0}
                suffix="人"
                icon={<IconDashboard style={{ fontSize: 24 }} />}
              />
            </Col>
          </Row>

          {/* Secondary Metrics */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="成功交易"
                  value={metrics?.succeededPayments || 0}
                  suffix="笔"
                  prefix={<IconCheckCircle style={{ color: '#00B42A' }} />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="失败交易"
                  value={metrics?.failedPayments || 0}
                  suffix="笔"
                  prefix={<IconCloseCircle style={{ color: '#F53F3F' }} />}
                  valueStyle={{ color: metrics?.failedPayments && metrics.failedPayments > 10 ? '#F53F3F' : undefined }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="平均交易金额"
                  value={formatCurrency(metrics?.avgTransactionValue || 0)}
                  prefix="¥"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="重试率"
                  value={metrics?.retryRate || 0}
                  suffix="%"
                  precision={2}
                />
              </Card>
            </Col>
          </Row>

          {/* Charts Row 1 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={8}>
              <Card title="成功率监控">
                {renderSuccessRateGauge()}
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card title="交易状态分布">
                {renderStatusDistribution()}
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card title="支付方式对比">
                {renderMethodBreakdown()}
              </Card>
            </Col>
          </Row>

          {/* Trend Chart */}
          <Card title="收入与成功率趋势" style={{ marginBottom: 24 }}>
            {renderTrendChart()}
          </Card>

          {/* Payment Methods Table */}
          <Card title="支付方式详情" style={{ marginBottom: 24 }}>
            <Table
              data={methodMetrics}
              columns={methodColumns}
              rowKey="method"
              pagination={false}
            />
          </Card>

          {/* Failure Analysis */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={12}>
              <Card title="失败原因分析">
                {renderFailureReasons()}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="最近失败交易">
                {failureReasons.length > 0 && failureReasons[0].recentExamples.length > 0 ? (
                  <Table
                    data={failureReasons[0].recentExamples}
                    columns={[
                      { title: 'ID', dataIndex: 'id', key: 'id', render: (id: string) => <Text code>{id.slice(0, 8)}</Text> },
                      { title: '金额', dataIndex: 'amount', key: 'amount', render: (v: number) => formatCurrency(v) },
                      { title: '时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => formatDate(v) },
                    ]}
                    rowKey="id"
                    pagination={false}
                    size="small"
                  />
                ) : (
                  <Empty description="暂无失败交易记录" />
                )}
              </Card>
            </Col>
          </Row>

          {/* Alerts Section */}
          {renderAlertsSection()}

          {/* Thresholds Configuration */}
          {renderThresholdsSection()}

          {/* Reference Guidelines */}
          <Card title="支付健康指标参考" style={{ marginTop: 16 }}>
            <Row gutter={[24, 16]}>
              <Col xs={24} sm={8}>
                <div style={{ padding: 16, background: '#f7f8fa', borderRadius: 8 }}>
                  <Text style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>成功率</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>支付成功的交易占比</Text>
                  <div style={{ marginTop: 8 }}>
                    <Tag color="green">正常: ≥95%</Tag>
                    <Tag color="orange">需关注: 90-95%</Tag>
                    <Tag color="red">异常: &lt;90%</Tag>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div style={{ padding: 16, background: '#f7f8fa', borderRadius: 8 }}>
                  <Text style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>失败率</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>支付失败的交易占比</Text>
                  <div style={{ marginTop: 8 }}>
                    <Tag color="green">正常: &lt;5%</Tag>
                    <Tag color="orange">需关注: 5-10%</Tag>
                    <Tag color="red">异常: &gt;10%</Tag>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div style={{ padding: 16, background: '#f7f8fa', borderRadius: 8 }}>
                  <Text style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>重试率</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>用户支付失败后重试的比例</Text>
                  <div style={{ marginTop: 8 }}>
                    <Tag color="green">正常: ≥50%</Tag>
                    <Tag color="orange">需关注: 30-50%</Tag>
                    <Tag color="red">异常: &lt;30%</Tag>
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
                warningThreshold: selectedThreshold.warningThreshold,
                criticalThreshold: selectedThreshold.criticalThreshold,
                enabled: selectedThreshold.enabled,
                cooldownMinutes: selectedThreshold.cooldownMinutes,
              }}
              onSubmit={handleUpdateThreshold}
            >
              <Descriptions column={1} border style={{ marginBottom: 16 }}>
                <Descriptions.Item label="告警类型">
                  <Tag color="blue">{getAlertTypeLabel(selectedThreshold.type)}</Tag>
                </Descriptions.Item>
              </Descriptions>

              <Form.Item label="警告阈值" field="warningThreshold">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  suffix={selectedThreshold.type === 'success_rate' ? '%' : ''}
                />
              </Form.Item>

              <Form.Item label="严重阈值" field="criticalThreshold">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  suffix={selectedThreshold.type === 'success_rate' ? '%' : ''}
                />
              </Form.Item>

              <Form.Item label="冷却时间 (分钟)" field="cooldownMinutes">
                <InputNumber style={{ width: '100%' }} min={1} max={1440} />
              </Form.Item>

              <Form.Item label="启用告警" field="enabled" triggerPropName="checked">
                <Switch />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit">保存</Button>
                  <Button onClick={() => setThresholdModalVisible(false)}>取消</Button>
                </Space>
              </Form.Item>
            </Form>
          )}
        </Modal>
      </div>
    </ErrorBoundary>
  );
};

export default PaymentMonitoringPage;