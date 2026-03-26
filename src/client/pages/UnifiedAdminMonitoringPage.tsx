/**
 * UnifiedAdminMonitoringPage - Unified Admin Monitoring Dashboard
 * 
 * Issue #660: 监控仪表盘可视化完善 - Admin 后台集成
 * 
 * Integrates:
 * - Payment monitoring metrics
 * - APM (Application Performance Monitoring)
 * - Business metrics dashboard
 * - Real-time alerts from all sources
 * - Cross-dashboard navigation
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Card,
  Grid,
  Spin,
  Message,
  Button,
  Space,
  Tag,
  Badge,
  Statistic,
  Table,
  Tabs,
  Progress,
  Empty,
  Tooltip,
  Drawer,
  List,
  Divider,
  Alert,
} from '@arco-design/web-react';
import {
  IconDashboard,
  IconBug,
  IconGift,
  IconThunderbolt,
  IconUser,
  IconTrophy,
  IconExclamationCircle,
  IconCheckCircle,
  IconCloseCircle,
  IconRefresh,
  IconArrowRight,
  IconNotification,
  IconApps,
  IconClockCircle,
  IconArrowRise,
  IconArrowFall,
  IconSettings,
} from '@arco-design/web-react/icon';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary';
import '../styles/visual-optimization.css';

const { Title, Text } = Typography;
const { Row, Col } = Grid;
const TabPane = Tabs.TabPane;

// Types for unified monitoring data
interface UnifiedAlert {
  id: string;
  source: 'apm' | 'payment' | 'business';
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  value?: number;
  threshold?: number;
  timestamp: string;
  status: 'active' | 'acknowledged' | 'resolved';
  link?: string;
}

interface APMSummary {
  totalErrors: number;
  criticalErrors: number;
  avgApiLatency: number;
  p95Latency: number;
  errorRate: number;
}

interface PaymentSummary {
  successRate: number;
  totalPayments: number;
  totalRevenue: number;
  activeAlerts: number;
}

interface BusinessSummary {
  dau: number;
  mau: number;
  stickiness: number;
  mrr: number;
  mrrGrowth: number;
  conversionRate: number;
}

interface UnifiedMonitoringData {
  apm: APMSummary;
  payment: PaymentSummary;
  business: BusinessSummary;
  alerts: UnifiedAlert[];
  systemHealth: 'healthy' | 'warning' | 'critical';
  lastUpdated: string;
}

// Severity colors
const SEVERITY_COLORS: Record<string, string> = {
  info: 'arcoblue',
  warning: 'orange',
  critical: 'red',
};

// Source labels
const SOURCE_LABELS: Record<string, string> = {
  apm: 'APM',
  payment: '支付',
  business: '业务',
};

// Navigation items for quick links
const NAV_ITEMS = [
  { key: 'apm', label: 'APM 监控', icon: <IconBug />, path: '/admin/apm', color: '#F53F3F' },
  { key: 'payment', label: '支付监控', icon: <IconGift />, path: '/admin/payment-monitoring', color: '#165DFF' },
  { key: 'business', label: '业务指标', icon: <IconTrophy />, path: '/admin/business-metrics', color: '#00B42A' },
  { key: 'revenue', label: '收入分析', icon: <IconDashboard />, path: '/admin/revenue', color: '#722ED1' },
];

// Sub-components
const QuickNavCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  metrics?: { label: string; value: string | number; status?: 'good' | 'warning' | 'critical' }[];
  alertCount?: number;
}> = ({ title, icon, path, color, metrics, alertCount }) => {
  const navigate = useNavigate();
  
  return (
    <Card
      className="quick-nav-card"
      style={{ cursor: 'pointer', height: '100%' }}
      hoverable
      onClick={() => navigate(path)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: `${color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color,
            }}
          >
            {icon}
          </div>
          <Text style={{ fontWeight: 600, fontSize: 16 }}>{title}</Text>
        </div>
        <Space>
          {alertCount && alertCount > 0 && (
            <Badge count={alertCount} style={{ backgroundColor: '#F53F3F' }} />
          )}
          <IconArrowRight style={{ color: '#86909C' }} />
        </Space>
      </div>
      
      {metrics && metrics.length > 0 && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {metrics.map((m, idx) => (
            <div key={idx}>
              <Text type="secondary" style={{ fontSize: 12 }}>{m.label}</Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontWeight: 600 }}>
                  {typeof m.value === 'number' ? m.value.toLocaleString() : m.value}
                </Text>
                {m.status && (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: m.status === 'good' ? '#00B42A' : m.status === 'warning' ? '#F7BA1E' : '#F53F3F',
                    }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

const AlertItem: React.FC<{ alert: UnifiedAlert }> = ({ alert }) => {
  const navigate = useNavigate();
  
  const handleClick = () => {
    if (alert.link) {
      navigate(alert.link);
    }
  };
  
  return (
    <List.Item
      style={{ cursor: alert.link ? 'pointer' : 'default' }}
      onClick={handleClick}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Tag color={SEVERITY_COLORS[alert.severity]}>
            {alert.severity === 'critical' ? '严重' : alert.severity === 'warning' ? '警告' : '信息'}
          </Tag>
          <Tag color="blue">{SOURCE_LABELS[alert.source]}</Tag>
          <Text>{alert.message}</Text>
        </div>
        <Space>
          {alert.value !== undefined && alert.threshold !== undefined && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              当前: {alert.value.toFixed(2)} / 阈值: {alert.threshold}
            </Text>
          )}
          <Text type="secondary" style={{ fontSize: 12 }}>
            {new Date(alert.timestamp).toLocaleTimeString('zh-CN')}
          </Text>
          {alert.link && <IconArrowRight style={{ color: '#86909C' }} />}
        </Space>
      </div>
    </List.Item>
  );
};

const SystemHealthIndicator: React.FC<{ health: 'healthy' | 'warning' | 'critical' }> = ({ health }) => {
  const config = {
    healthy: { color: '#00B42A', icon: <IconCheckCircle />, text: '系统健康' },
    warning: { color: '#F7BA1E', icon: <IconExclamationCircle />, text: '需要关注' },
    critical: { color: '#F53F3F', icon: <IconCloseCircle />, text: '系统异常' },
  };
  
  const { color, icon, text } = config[health];
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ color, display: 'flex', alignItems: 'center' }}>
        {icon}
      </div>
      <Text style={{ color, fontWeight: 600 }}>{text}</Text>
    </div>
  );
};

// Main component
const UnifiedAdminMonitoringPage: React.FC = () => {
  const [data, setData] = useState<UnifiedMonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alertDrawerVisible, setAlertDrawerVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch all monitoring data
  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('supabase_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // Fetch data from all monitoring endpoints in parallel
      const [apmRes, paymentRes, businessRes] = await Promise.all([
        fetch('/api/apm/summary', { headers }).catch(() => null),
        fetch('/api/payment-monitoring/summary', { headers }).catch(() => null),
        fetch('/api/business-metrics/summary', { headers }).catch(() => null),
      ]);

      // Parse responses
      const apmData = apmRes?.ok ? await apmRes.json() : null;
      const paymentData = paymentRes?.ok ? await paymentRes.json() : null;
      const businessData = businessRes?.ok ? await businessRes.json() : null;

      // Build unified alerts list
      const alerts: UnifiedAlert[] = [];
      
      // Add APM alerts
      if (apmData?.data?.criticalErrors > 0) {
        alerts.push({
          id: `apm-critical-${Date.now()}`,
          source: 'apm',
          type: 'critical_errors',
          severity: 'critical',
          message: `${apmData.data.criticalErrors} 个严重错误需要处理`,
          value: apmData.data.criticalErrors,
          timestamp: new Date().toISOString(),
          status: 'active',
          link: '/admin/apm',
        });
      }
      
      if (apmData?.data?.avgApiLatency > 500) {
        alerts.push({
          id: `apm-latency-${Date.now()}`,
          source: 'apm',
          type: 'high_latency',
          severity: 'warning',
          message: `API 平均延迟过高: ${apmData.data.avgApiLatency.toFixed(0)}ms`,
          value: apmData.data.avgApiLatency,
          threshold: 500,
          timestamp: new Date().toISOString(),
          status: 'active',
          link: '/admin/apm',
        });
      }
      
      // Add payment alerts
      if (paymentData?.data?.successRate < 95) {
        alerts.push({
          id: `payment-success-${Date.now()}`,
          source: 'payment',
          type: 'low_success_rate',
          severity: paymentData.data.successRate < 90 ? 'critical' : 'warning',
          message: `支付成功率低于标准: ${paymentData.data.successRate.toFixed(2)}%`,
          value: paymentData.data.successRate,
          threshold: 95,
          timestamp: new Date().toISOString(),
          status: 'active',
          link: '/admin/payment-monitoring',
        });
      }
      
      // Add business alerts
      if (businessData?.data?.mrrGrowth < 0) {
        alerts.push({
          id: `business-mrr-${Date.now()}`,
          source: 'business',
          type: 'mrr_decline',
          severity: businessData.data.mrrGrowth < -10 ? 'critical' : 'warning',
          message: `MRR 下降: ${businessData.data.mrrGrowth.toFixed(1)}%`,
          value: businessData.data.mrrGrowth,
          timestamp: new Date().toISOString(),
          status: 'active',
          link: '/admin/business-metrics',
        });
      }

      // Determine system health
      let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (alerts.some(a => a.severity === 'critical')) {
        systemHealth = 'critical';
      } else if (alerts.some(a => a.severity === 'warning')) {
        systemHealth = 'warning';
      }

      setData({
        apm: apmData?.data || { totalErrors: 0, criticalErrors: 0, avgApiLatency: 0, p95Latency: 0, errorRate: 0 },
        payment: paymentData?.data || { successRate: 100, totalPayments: 0, totalRevenue: 0, activeAlerts: 0 },
        business: businessData?.data || { dau: 0, mau: 0, stickiness: 0, mrr: 0, mrrGrowth: 0, conversionRate: 0 },
        alerts,
        systemHealth,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
      Message.error('加载监控数据失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Format helpers
  const formatCurrency = (value: number): string => {
    return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatPercent = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  const formatMs = (value: number): string => {
    return `${value.toFixed(0)}ms`;
  };

  // Active alerts count
  const activeAlertsCount = data?.alerts.filter(a => a.status === 'active').length || 0;
  const criticalAlertsCount = data?.alerts.filter(a => a.severity === 'critical' && a.status === 'active').length || 0;

  return (
    <ErrorBoundary>
      <div className="page-container" style={{ padding: isMobile ? 16 : 24, maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <IconDashboard style={{ fontSize: 28, color: '#165DFF' }} />
            <Title heading={3} style={{ margin: 0 }}>统一监控仪表盘</Title>
            {data && <SystemHealthIndicator health={data.systemHealth} />}
          </div>
          <Space>
            <Button
              icon={<IconNotification />}
              onClick={() => setAlertDrawerVisible(true)}
            >
              告警
              {activeAlertsCount > 0 && (
                <Badge count={activeAlertsCount} style={{ marginLeft: 8 }} />
              )}
            </Button>
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

        {/* Critical Alerts Banner */}
        {criticalAlertsCount > 0 && (
          <Alert
            type="error"
            banner
            closable
            icon={<IconExclamationCircle />}
            style={{ marginBottom: 16 }}
            content={
              <span>
                有 <strong>{criticalAlertsCount}</strong> 个严重告警需要立即处理。
                <Button type="text" size="small" onClick={() => setAlertDrawerVisible(true)}>
                  查看详情
                </Button>
              </span>
            }
          />
        )}

        <Spin loading={loading} style={{ display: 'block' }}>
          {/* System Overview */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="DAU"
                  value={data?.business.dau || 0}
                  prefix={<IconUser style={{ color: '#165DFF' }} />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="MRR"
                  value={formatCurrency(data?.business.mrr || 0)}
                  prefix={data?.business.mrrGrowth && data.business.mrrGrowth > 0 ? <IconArrowRise style={{ color: '#00B42A' }} /> : <IconArrowFall style={{ color: '#F53F3F' }} />}
                  suffix={data?.business.mrrGrowth ? ` (${data.business.mrrGrowth > 0 ? '+' : ''}${data.business.mrrGrowth.toFixed(1)}%)` : ''}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="支付成功率"
                  value={formatPercent(data?.payment.successRate || 100)}
                  prefix={<IconGift style={{ color: data?.payment.successRate && data.payment.successRate >= 95 ? '#00B42A' : '#F53F3F' }} />}
                  valueStyle={{ color: data?.payment.successRate && data.payment.successRate >= 95 ? '#00B42A' : '#F53F3F' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="API 平均延迟"
                  value={formatMs(data?.apm.avgApiLatency || 0)}
                  prefix={<IconThunderbolt style={{ color: data?.apm.avgApiLatency && data.apm.avgApiLatency < 200 ? '#00B42A' : data?.apm.avgApiLatency && data.apm.avgApiLatency < 500 ? '#F7BA1E' : '#F53F3F' }} />}
                  valueStyle={{ color: data?.apm.avgApiLatency && data.apm.avgApiLatency < 200 ? undefined : data?.apm.avgApiLatency && data.apm.avgApiLatency < 500 ? '#F7BA1E' : '#F53F3F' }}
                />
              </Card>
            </Col>
          </Row>

          {/* Quick Navigation Cards */}
          <Title heading={5} style={{ marginBottom: 16 }}>监控面板导航</Title>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} md={12} lg={6}>
              <QuickNavCard
                title="APM 监控"
                icon={<IconBug />}
                path="/admin/apm"
                color="#F53F3F"
                alertCount={data?.apm.criticalErrors || 0}
                metrics={[
                  { label: '总错误', value: data?.apm.totalErrors || 0, status: (data?.apm.totalErrors || 0) > 0 ? 'warning' : 'good' },
                  { label: 'P95延迟', value: formatMs(data?.apm.p95Latency || 0) },
                ]}
              />
            </Col>
            <Col xs={24} md={12} lg={6}>
              <QuickNavCard
                title="支付监控"
                icon={<IconGift />}
                path="/admin/payment-monitoring"
                color="#165DFF"
                alertCount={data?.payment.activeAlerts || 0}
                metrics={[
                  { label: '成功率', value: formatPercent(data?.payment.successRate || 100), status: (data?.payment.successRate || 100) >= 95 ? 'good' : 'critical' },
                  { label: '交易数', value: data?.payment.totalPayments || 0 },
                ]}
              />
            </Col>
            <Col xs={24} md={12} lg={6}>
              <QuickNavCard
                title="业务指标"
                icon={<IconTrophy />}
                path="/admin/business-metrics"
                color="#00B42A"
                metrics={[
                  { label: '用户粘性', value: formatPercent(data?.business.stickiness || 0) },
                  { label: '转化率', value: formatPercent(data?.business.conversionRate || 0) },
                ]}
              />
            </Col>
            <Col xs={24} md={12} lg={6}>
              <QuickNavCard
                title="收入分析"
                icon={<IconDashboard />}
                path="/admin/revenue"
                color="#722ED1"
                metrics={[
                  { label: '总收入', value: formatCurrency(data?.payment.totalRevenue || 0) },
                  { label: 'MAU', value: data?.business.mau || 0 },
                ]}
              />
            </Col>
          </Row>

          {/* Tabs for detailed views */}
          <Tabs defaultActiveTab="alerts">
            <TabPane
              key="alerts"
              tab={
                <span>
                  <IconNotification style={{ marginRight: 4 }} />
                  实时告警
                  {activeAlertsCount > 0 && (
                    <Badge count={activeAlertsCount} style={{ marginLeft: 8 }} />
                  )}
                </span>
              }
            >
              <Card>
                {data?.alerts && data.alerts.length > 0 ? (
                  <List
                    dataSource={data.alerts.filter(a => a.status === 'active')}
                    renderItem={(alert) => <AlertItem alert={alert} />}
                    style={{ maxHeight: 400, overflow: 'auto' }}
                  />
                ) : (
                  <Empty
                    icon={<IconCheckCircle style={{ color: '#00B42A', fontSize: 48 }} />}
                    description="暂无活跃告警"
                  />
                )}
              </Card>
            </TabPane>

            <TabPane
              key="performance"
              tab={
                <span>
                  <IconThunderbolt style={{ marginRight: 4 }} />
                  性能概览
                </span>
              }
            >
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Card title="API 响应时间">
                    <div style={{ padding: '16px 0' }}>
                      <Row gutter={[16, 16]}>
                        <Col span={12}>
                          <Statistic
                            title="平均延迟"
                            value={formatMs(data?.apm.avgApiLatency || 0)}
                          />
                        </Col>
                        <Col span={12}>
                          <Statistic
                            title="P95 延迟"
                            value={formatMs(data?.apm.p95Latency || 0)}
                          />
                        </Col>
                      </Row>
                      <Divider style={{ margin: '16px 0' }} />
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>性能评级</Text>
                        <div style={{ marginTop: 8 }}>
                          {(data?.apm.avgApiLatency || 0) < 200 ? (
                            <Tag color="green" icon={<IconCheckCircle />}>优秀 (&lt;200ms)</Tag>
                          ) : (data?.apm.avgApiLatency || 0) < 500 ? (
                            <Tag color="orange" icon={<IconExclamationCircle />}>需优化 (200-500ms)</Tag>
                          ) : (
                            <Tag color="red" icon={<IconCloseCircle />}>需改进 (&gt;500ms)</Tag>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card title="错误追踪">
                    <div style={{ padding: '16px 0' }}>
                      <Row gutter={[16, 16]}>
                        <Col span={12}>
                          <Statistic
                            title="总错误数"
                            value={data?.apm.totalErrors || 0}
                            valueStyle={{ color: (data?.apm.totalErrors || 0) > 0 ? '#F53F3F' : '#00B42A' }}
                          />
                        </Col>
                        <Col span={12}>
                          <Statistic
                            title="严重错误"
                            value={data?.apm.criticalErrors || 0}
                            valueStyle={{ color: (data?.apm.criticalErrors || 0) > 0 ? '#F53F3F' : '#00B42A' }}
                          />
                        </Col>
                      </Row>
                      {(data?.apm.totalErrors || 0) > 0 && (
                        <>
                          <Divider style={{ margin: '16px 0' }} />
                          <Button
                            type="primary"
                            icon={<IconBug />}
                            onClick={() => window.location.href = '/admin/apm'}
                          >
                            查看错误详情
                          </Button>
                        </>
                      )}
                    </div>
                  </Card>
                </Col>
              </Row>
            </TabPane>

            <TabPane
              key="business"
              tab={
                <span>
                  <IconTrophy style={{ marginRight: 4 }} />
                  业务概览
                </span>
              }
            >
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12} lg={8}>
                  <Card title="用户活跃度">
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                      <Progress
                        percent={data?.business.stickiness || 0}
                        style={{ width: 150 }}
                        strokeWidth={10}
                        trailColor="#E5E6EB"
                        color={(data?.business.stickiness || 0) > 20 ? '#00B42A' : '#F7BA1E'}
                      />
                      <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                        用户粘性 (DAU/MAU)
                      </Text>
                      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
                        {formatPercent(data?.business.stickiness || 0)}
                      </Text>
                    </div>
                  </Card>
                </Col>
                <Col xs={24} md={12} lg={8}>
                  <Card title="收入增长">
                    <div style={{ padding: '16px 0' }}>
                      <Statistic
                        title="MRR"
                        value={formatCurrency(data?.business.mrr || 0)}
                        suffix="/月"
                      />
                      <Divider style={{ margin: '16px 0' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {(data?.business.mrrGrowth || 0) >= 0 ? (
                          <IconArrowRise style={{ color: '#00B42A', fontSize: 24 }} />
                        ) : (
                          <IconArrowFall style={{ color: '#F53F3F', fontSize: 24 }} />
                        )}
                        <Text
                          style={{
                            fontSize: 18,
                            color: (data?.business.mrrGrowth || 0) >= 0 ? '#00B42A' : '#F53F3F',
                          }}
                        >
                          {formatPercent(Math.abs(data?.business.mrrGrowth || 0))}
                        </Text>
                        <Text type="secondary">vs 上月</Text>
                      </div>
                    </div>
                  </Card>
                </Col>
                <Col xs={24} md={12} lg={8}>
                  <Card title="转化率">
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                      <Progress
                        type="circle"
                        percent={data?.business.conversionRate || 0}
                        style={{ width: 120 }}
                        strokeWidth={8}
                        trailColor="#E5E6EB"
                        color="#165DFF"
                      />
                      <div style={{ marginTop: 16 }}>
                        <Text style={{ fontSize: 20, fontWeight: 'bold' }}>
                          {formatPercent(data?.business.conversionRate || 0)}
                        </Text>
                      </div>
                    </div>
                  </Card>
                </Col>
              </Row>
            </TabPane>
          </Tabs>

          {/* Last updated */}
          {data && (
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <IconClockCircle style={{ marginRight: 4 }} />
                最后更新: {new Date(data.lastUpdated).toLocaleString('zh-CN')}
              </Text>
            </div>
          )}
        </Spin>

        {/* Alert Drawer */}
        <Drawer
          title={
            <Space>
              <IconNotification />
              <span>告警中心</span>
              {activeAlertsCount > 0 && (
                <Badge count={activeAlertsCount} style={{ backgroundColor: '#F53F3F' }} />
              )}
            </Space>
          }
          visible={alertDrawerVisible}
          onClose={() => setAlertDrawerVisible(false)}
          width={isMobile ? '100%' : 480}
          footer={
            <Space>
              <Button onClick={() => setAlertDrawerVisible(false)}>关闭</Button>
              <Button type="primary" onClick={() => window.location.href = '/admin/apm'}>
                前往 APM 监控
              </Button>
            </Space>
          }
        >
          <Tabs>
            <TabPane
              key="active"
              tab={`活跃 (${data?.alerts.filter(a => a.status === 'active').length || 0})`}
            >
              {data?.alerts.filter(a => a.status === 'active').length > 0 ? (
                <List
                  dataSource={data.alerts.filter(a => a.status === 'active')}
                  renderItem={(alert) => <AlertItem alert={alert} />}
                />
              ) : (
                <Empty description="暂无活跃告警" />
              )}
            </TabPane>
            <TabPane
              key="all"
              tab={`全部 (${data?.alerts.length || 0})`}
            >
              {data?.alerts && data.alerts.length > 0 ? (
                <List
                  dataSource={data.alerts}
                  renderItem={(alert) => <AlertItem alert={alert} />}
                />
              ) : (
                <Empty description="暂无告警" />
              )}
            </TabPane>
          </Tabs>
        </Drawer>
      </div>
    </ErrorBoundary>
  );
};

export default UnifiedAdminMonitoringPage;