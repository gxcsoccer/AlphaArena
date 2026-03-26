/**
 * APM Dashboard Page - Application Performance Monitoring
 * 
 * Comprehensive dashboard for monitoring:
 * - Frontend errors and exceptions
 * - API response times
 * - Core Web Vitals trends
 * - User experience metrics
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Card,
  Grid,
  Spin,
  Message,
  DatePicker,
  Button,
  Space,
  Tag,
  Tooltip,
  Empty,
  Statistic,
  Table,
  Modal,
  Descriptions,
  Badge,
} from '@arco-design/web-react';
import {
  IconBug,
  IconThunderbolt,
  IconClockCircle,
  IconCheckCircle,
  IconCloseCircle,
  IconRefresh,
  IconEye,
} from '@arco-design/web-react/icon';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { ErrorBoundary } from '../components/ErrorBoundary';

const { Title, Text } = Typography;
const { Row, Col } = Grid;
const { RangePicker } = DatePicker;

// Types
interface ErrorRecord {
  id: string;
  message: string;
  error_name: string;
  stack?: string;
  error_type: 'javascript' | 'promise' | 'react' | 'resource' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  page: string;
  route?: string;
  component_stack?: string;
  user_agent?: string;
  breadcrumbs: Breadcrumb[];
  created_at: string;
  resolved: boolean;
}

interface Breadcrumb {
  type: string;
  message: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

interface ErrorSummary {
  total_errors: number;
  by_severity: Record<string, number>;
  by_type: Record<string, number>;
  by_page: Record<string, number>;
}

interface ApiLatencyStats {
  count: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
}

// Severity colors
const SEVERITY_COLORS: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'gold',
  low: 'green',
};

// Error type labels
const ERROR_TYPE_LABELS: Record<string, string> = {
  javascript: 'JavaScript 错误',
  promise: 'Promise 异常',
  react: 'React 错误',
  resource: '资源加载失败',
  unknown: '未知错误',
};

const APMDashboardPage: React.FC = () => {
  // State
  const [errors, setErrors] = useState<ErrorRecord[]>([]);
  const [errorSummary, setErrorSummary] = useState<ErrorSummary | null>(null);
  const [apiLatency, setApiLatency] = useState<ApiLatencyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<[Date, Date]>([
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    new Date(),
  ]);
  const [selectedError, setSelectedError] = useState<ErrorRecord | null>(null);
  const [errorDetailVisible, setErrorDetailVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch data
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('supabase_token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const start = dateRange[0].toISOString();
      const end = dateRange[1].toISOString();
      
      // Fetch errors, summary, and API latency in parallel
      const [errorsRes, summaryRes, latencyRes] = await Promise.all([
        fetch(`/api/apm/errors?start_date=${start}&end_date=${end}&limit=100`, { headers }),
        fetch(`/api/apm/errors/summary?start_date=${start}&end_date=${end}`, { headers }),
        fetch(`/api/apm/api-latency?start_date=${start}&end_date=${end}`, { headers }),
      ]);

      if (errorsRes.ok) {
        const data = await errorsRes.json();
        setErrors(data.data || []);
      }
      
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setErrorSummary(data.data);
      }
      
      if (latencyRes.ok) {
        const data = await latencyRes.json();
        setApiLatency(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch APM data:', err);
      Message.error('加载监控数据失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange]);

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

  // Handle resolve error
  const handleResolveError = async (errorId: string) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('supabase_token');
      const response = await fetch(`/api/apm/errors/${errorId}/resolve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        Message.success('错误已标记为已解决');
        fetchAllData();
      }
    } catch (_err) {
      Message.error('操作失败');
    }
  };

  // View error details
  const viewErrorDetails = (error: ErrorRecord) => {
    setSelectedError(error);
    setErrorDetailVisible(true);
  };

  // Format helpers
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const formatMs = (value: number | null | undefined): string => {
    if (value == null) return '-';
    return `${value.toFixed(0)}ms`;
  };

  // Error table columns
  const errorColumns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (date: string) => (
        <Text style={{ fontSize: 12 }}>{formatDate(date)}</Text>
      ),
    },
    {
      title: '类型',
      dataIndex: 'error_type',
      key: 'error_type',
      width: 120,
      render: (type: string) => (
        <Tag color="blue">{ERROR_TYPE_LABELS[type] || type}</Tag>
      ),
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: string) => (
        <Tag color={SEVERITY_COLORS[severity] || 'gray'}>
          {severity.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: '错误信息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (message: string) => (
        <Tooltip content={message}>
          <Text style={{ maxWidth: 300 }} ellipsis>
            {message}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '页面',
      dataIndex: 'page',
      key: 'page',
      width: 150,
      render: (page: string) => (
        <Text code style={{ fontSize: 11 }}>
          {page}
        </Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'resolved',
      key: 'resolved',
      width: 80,
      render: (resolved: boolean) => (
        <Tag color={resolved ? 'green' : 'red'}>
          {resolved ? '已解决' : '未处理'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: any, record: ErrorRecord) => (
        <Space>
          <Button
            size="small"
            icon={<IconEye />}
            onClick={() => viewErrorDetails(record)}
          >
            详情
          </Button>
          {!record.resolved && (
            <Button
              size="small"
              type="primary"
              status="success"
              onClick={() => handleResolveError(record.id)}
            >
              解决
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // Render error severity chart
  const renderSeverityChart = () => {
    if (!errorSummary?.by_severity) return <Empty />;

    const data = Object.entries(errorSummary.by_severity).map(([key, value]) => ({
      name: key.toUpperCase(),
      value,
      color: SEVERITY_COLORS[key] || 'gray',
    }));

    return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <RechartsTooltip />
          <Bar dataKey="value" name="错误数">
            {data.map((entry, index) => (
              <rect key={`bar-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  // Render error type chart
  const renderTypeChart = () => {
    if (!errorSummary?.by_type) return <Empty />;

    const data = Object.entries(errorSummary.by_type).map(([key, value]) => ({
      name: ERROR_TYPE_LABELS[key] || key,
      value,
    }));

    return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis dataKey="name" type="category" width={100} />
          <RechartsTooltip />
          <Bar dataKey="value" name="错误数" fill="#165DFF" />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  // Render API latency section
  const renderApiLatencySection = () => {
    if (!apiLatency) return null;

    const latencyRating = apiLatency.avg < 200 ? 'good' : apiLatency.avg < 500 ? 'needsImprovement' : 'poor';
    const latencyColor = latencyRating === 'good' ? '#00B42A' : latencyRating === 'needsImprovement' ? '#F7BA1E' : '#F53F3F';

    return (
      <Card title="API 响应时间" style={{ marginTop: 16 }}>
        <Row gutter={[24, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Statistic
              title="平均响应时间"
              value={apiLatency.avg.toFixed(0)}
              suffix="ms"
              valueStyle={{ color: latencyColor }}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Statistic
              title="P95 响应时间"
              value={apiLatency.p95.toFixed(0)}
              suffix="ms"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Statistic
              title="P99 响应时间"
              value={apiLatency.p99.toFixed(0)}
              suffix="ms"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Statistic
              title="请求总数"
              value={apiLatency.count}
            />
          </Col>
        </Row>
        
        <div style={{ marginTop: 24 }}>
          <Text type="secondary">响应时间分布</Text>
          <Row gutter={[16, 8]} style={{ marginTop: 8 }}>
            <Col span={12}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>最小值</Text>
                <Text bold>{formatMs(apiLatency.min)}</Text>
              </div>
            </Col>
            <Col span={12}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>最大值</Text>
                <Text bold>{formatMs(apiLatency.max)}</Text>
              </div>
            </Col>
            <Col span={12}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>P50</Text>
                <Text bold>{formatMs(apiLatency.p50)}</Text>
              </div>
            </Col>
            <Col span={12}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>P75</Text>
                <Text bold>{formatMs(apiLatency.p75)}</Text>
              </div>
            </Col>
            <Col span={12}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>P90</Text>
                <Text bold>{formatMs(apiLatency.p90)}</Text>
              </div>
            </Col>
            <Col span={12}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>P99</Text>
                <Text bold>{formatMs(apiLatency.p99)}</Text>
              </div>
            </Col>
          </Row>
        </div>
      </Card>
    );
  };

  // Render error detail modal
  const renderErrorDetailModal = () => {
    if (!selectedError) return null;

    return (
      <Modal
        title={
          <Space>
            <IconBug style={{ color: '#F53F3F' }} />
            <span>错误详情</span>
            <Tag color={SEVERITY_COLORS[selectedError.severity]}>
              {selectedError.severity.toUpperCase()}
            </Tag>
          </Space>
        }
        visible={errorDetailVisible}
        onCancel={() => {
          setErrorDetailVisible(false);
          setSelectedError(null);
        }}
        footer={
          <Space>
            <Button onClick={() => setErrorDetailVisible(false)}>关闭</Button>
            {!selectedError.resolved && (
              <Button
                type="primary"
                status="success"
                onClick={() => {
                  handleResolveError(selectedError.id);
                  setErrorDetailVisible(false);
                }}
              >
                标记为已解决
              </Button>
            )}
          </Space>
        }
        style={{ width: isMobile ? '95%' : 800 }}
      >
        <Descriptions column={isMobile ? 1 : 2} border>
          <Descriptions.Item label="错误 ID">
            <Text code copyable>{selectedError.id}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="错误类型">
            <Tag color="blue">{ERROR_TYPE_LABELS[selectedError.error_type]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="页面">
            <Text code>{selectedError.page}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="时间">
            {formatDate(selectedError.created_at)}
          </Descriptions.Item>
          <Descriptions.Item label="错误名称" span={2}>
            {selectedError.error_name}
          </Descriptions.Item>
          <Descriptions.Item label="错误信息" span={2}>
            <Text type="error">{selectedError.message}</Text>
          </Descriptions.Item>
        </Descriptions>

        {selectedError.stack && (
          <div style={{ marginTop: 16 }}>
            <Text strong>堆栈跟踪</Text>
            <pre
              style={{
                marginTop: 8,
                padding: 12,
                background: '#1a1a1a',
                color: '#e5e6eb',
                borderRadius: 4,
                overflow: 'auto',
                maxHeight: 200,
                fontSize: 12,
              }}
            >
              {selectedError.stack}
            </pre>
          </div>
        )}

        {selectedError.component_stack && (
          <div style={{ marginTop: 16 }}>
            <Text strong>组件堆栈</Text>
            <pre
              style={{
                marginTop: 8,
                padding: 12,
                background: '#1a1a1a',
                color: '#e5e6eb',
                borderRadius: 4,
                overflow: 'auto',
                maxHeight: 150,
                fontSize: 11,
              }}
            >
              {selectedError.component_stack}
            </pre>
          </div>
        )}

        {selectedError.breadcrumbs && selectedError.breadcrumbs.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Text strong>错误路径 (Breadcrumbs)</Text>
            <div style={{ marginTop: 8, maxHeight: 150, overflow: 'auto' }}>
              {selectedError.breadcrumbs.slice(-10).map((crumb, index) => (
                <div
                  key={index}
                  style={{
                    padding: '4px 8px',
                    background: index % 2 === 0 ? '#f7f8fa' : '#fff',
                    fontSize: 12,
                  }}
                >
                  <Tag size="small" color="gray">{crumb.type}</Tag>
                  <Text style={{ marginLeft: 8 }}>{crumb.message}</Text>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedError.user_agent && (
          <div style={{ marginTop: 16 }}>
            <Text strong>User Agent</Text>
            <Text
              style={{
                display: 'block',
                marginTop: 4,
                fontSize: 11,
                color: '#86909c',
                wordBreak: 'break-all',
              }}
            >
              {selectedError.user_agent}
            </Text>
          </div>
        )}
      </Modal>
    );
  };

  return (
    <ErrorBoundary>
      <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconBug style={{ fontSize: 28, color: '#F53F3F' }} />
            <Title heading={3} style={{ margin: 0 }}>APM 监控面板</Title>
          </div>
          <Space>
            <RangePicker
              value={dateRange}
              onChange={(dates) => dates && setDateRange(dates as [Date, Date])}
              style={{ width: 280 }}
            />
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
          {/* Summary Stats */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="总错误数"
                  value={errorSummary?.total_errors || 0}
                  prefix={<IconBug style={{ color: '#F53F3F' }} />}
                  valueStyle={{ color: errorSummary?.total_errors ? '#F53F3F' : '#00B42A' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="严重错误"
                  value={errorSummary?.by_severity?.critical || 0}
                  prefix={<IconCloseCircle style={{ color: '#F53F3F' }} />}
                  valueStyle={{ color: '#F53F3F' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="平均 API 延迟"
                  value={apiLatency?.avg?.toFixed(0) || '-'}
                  suffix="ms"
                  prefix={<IconClockCircle style={{ color: '#165DFF' }} />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="P95 延迟"
                  value={apiLatency?.p95?.toFixed(0) || '-'}
                  suffix="ms"
                  prefix={<IconThunderbolt style={{ color: '#F7BA1E' }} />}
                />
              </Card>
            </Col>
          </Row>

          {/* Error Charts */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={12}>
              <Card title="错误严重程度分布">
                {renderSeverityChart()}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="错误类型分布">
                {renderTypeChart()}
              </Card>
            </Col>
          </Row>

          {/* API Latency */}
          {renderApiLatencySection()}

          {/* Error List */}
          <Card title="错误列表" style={{ marginTop: 24 }}>
            <Table
              data={errors}
              columns={errorColumns}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              scroll={{ x: 1000 }}
              noDataElement={
                <Empty
                  icon={<IconCheckCircle style={{ color: '#00B42A', fontSize: 48 }} />}
                  description="暂无错误记录"
                />
              }
            />
          </Card>

          {/* Quick Stats */}
          <Card title="页面错误统计" style={{ marginTop: 24 }}>
            {errorSummary?.by_page && Object.keys(errorSummary.by_page).length > 0 ? (
              <Row gutter={[16, 8]}>
                {Object.entries(errorSummary.by_page)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 10)
                  .map(([page, count]) => (
                    <Col xs={24} sm={12} lg={8} key={page}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: '#f7f8fa',
                          borderRadius: 4,
                        }}
                      >
                        <Text code style={{ maxWidth: 200 }} ellipsis>
                          {page}
                        </Text>
                        <Badge count={count} style={{ backgroundColor: '#F53F3F' }} />
                      </div>
                    </Col>
                  ))}
              </Row>
            ) : (
              <Empty description="暂无页面错误数据" />
            )}
          </Card>
        </Spin>

        {/* Error Detail Modal */}
        {renderErrorDetailModal()}
      </div>
    </ErrorBoundary>
  );
};

export default APMDashboardPage;