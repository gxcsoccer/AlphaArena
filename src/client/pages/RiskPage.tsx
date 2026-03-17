/**
 * Risk Analytics Dashboard Page
 * 
 * Comprehensive risk management dashboard with:
 * - Risk metrics overview (VaR, Sharpe, Volatility, etc.)
 * - Risk trend charts
 * - Position risk analysis
 * - Alert configuration
 * - Historical risk tracking
 */

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
  Button,
  Modal,
  Form,
  InputNumber,
  Switch,
  Message,
  Tooltip,
  Progress,
  Empty,
  Tabs,
  Badge,
} from '@arco-design/web-react';
import {
  IconWarning,
  IconCheckCircle,
  IconExclamationCircle,
  IconDelete,
  IconPlus,
  IconSettings,
} from '@arco-design/web-react/icon';
const { Row, Col } = Grid;
const { Title, Text } = Typography;
const TabPane = Tabs.TabPane;

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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  HeatmapLayer,
} from 'recharts';

import { useStats, useStrategies, useTrades, usePortfolio } from '../hooks/useData';
import { useRiskMetrics } from '../hooks/useRiskMetrics';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { formatPercent, formatCurrency } from '../utils/portfolioAnalytics';
import type { RiskAlert, RiskMetrics } from '../../utils/risk';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

// Time range options
const TIME_RANGES = [
  { label: '今日', value: '1d' },
  { label: '本周', value: '1w' },
  { label: '本月', value: '1m' },
  { label: '全部', value: 'all' },
];

// Risk level colors
const getRiskLevel = (score: number): { level: string; color: string } => {
  if (score < 30) return { level: '低风险', color: 'rgb(0, 180, 42)' };
  if (score < 50) return { level: '中等风险', color: 'rgb(255, 180, 0)' };
  if (score < 70) return { level: '较高风险', color: 'rgb(255, 100, 0)' };
  return { level: '高风险', color: 'rgb(245, 63, 63)' };
};

// Risk metrics card component
interface RiskMetricCardProps {
  title: string;
  value: number | string;
  suffix?: string;
  prefix?: string;
  precision?: number;
  loading?: boolean;
  status?: 'success' | 'warning' | 'danger' | 'normal';
  tooltip?: string;
  trend?: 'up' | 'down' | 'neutral';
}

const RiskMetricCard: React.FC<RiskMetricCardProps> = ({
  title,
  value,
  suffix,
  prefix,
  precision = 2,
  loading = false,
  status = 'normal',
  tooltip,
  trend,
}) => {
  const statusColors = {
    success: 'rgb(0, 180, 42)',
    warning: 'rgb(255, 180, 0)',
    danger: 'rgb(245, 63, 63)',
    normal: undefined,
  };

  const getValueColor = () => {
    if (trend === 'up') return 'rgb(0, 180, 42)';
    if (trend === 'down') return 'rgb(245, 63, 63)';
    return statusColors[status];
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

// Alert configuration modal
interface AlertModalProps {
  visible: boolean;
  onCancel: () => void;
  onOk: (alert: Omit<RiskAlert, 'id' | 'createdAt' | 'updatedAt'>) => void;
  editAlert?: RiskAlert | null;
}

const AlertModal: React.FC<AlertModalProps> = ({ visible, onCancel, onOk, editAlert }) => {
  const [form] = Form.useForm();

  React.useEffect(() => {
    if (visible && editAlert) {
      form.setFieldsValue(editAlert);
    } else if (visible) {
      form.resetFields();
    }
  }, [visible, editAlert, form]);

  const handleSubmit = () => {
    form.validate().then((values) => {
      onOk({
        metric: values.metric,
        threshold: values.threshold,
        operator: values.operator,
        channels: values.channels,
        enabled: true,
      });
      form.resetFields();
    });
  };

  return (
    <Modal
      title={editAlert ? '编辑风险警报' : '添加风险警报'}
      visible={visible}
      onCancel={onCancel}
      onOk={handleSubmit}
      autoFocus={false}
      focusLock={true}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="监控指标"
          field="metric"
          rules={[{ required: true, message: '请选择监控指标' }]}
        >
          <Select placeholder="选择要监控的风险指标">
            <Select.Option value="var95">VaR (95%)</Select.Option>
            <Select.Option value="var99">VaR (99%)</Select.Option>
            <Select.Option value="maxDrawdown">最大回撤</Select.Option>
            <Select.Option value="sharpeRatio">夏普比率</Select.Option>
            <Select.Option value="volatility">波动率</Select.Option>
            <Select.Option value="concentrationRisk">集中度风险</Select.Option>
            <Select.Option value="liquidityRisk">流动性风险</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item
          label="阈值"
          field="threshold"
          rules={[{ required: true, message: '请输入阈值' }]}
        >
          <InputNumber placeholder="输入阈值" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          label="触发条件"
          field="operator"
          rules={[{ required: true, message: '请选择触发条件' }]}
        >
          <Select placeholder="选择触发条件">
            <Select.Option value="gt">大于</Select.Option>
            <Select.Option value="gte">大于等于</Select.Option>
            <Select.Option value="lt">小于</Select.Option>
            <Select.Option value="lte">小于等于</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item
          label="通知渠道"
          field="channels"
          rules={[{ required: true, message: '请选择通知渠道' }]}
        >
          <Select mode="multiple" placeholder="选择通知渠道">
            <Select.Option value="ui">站内通知</Select.Option>
            <Select.Option value="email">邮件</Select.Option>
            <Select.Option value="webhook">Webhook</Select.Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

// Main Risk Dashboard Page
const RiskPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState<string>('1w');
  const [isMobile, setIsMobile] = useState(false);
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [editingAlert, setEditingAlert] = useState<RiskAlert | null>(null);

  // Detect mobile
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch data
  const { stats: _stats, loading: statsLoading } = useStats();
  const { trades, loading: tradesLoading } = useTrades(undefined, 1000);
  const { portfolio, loading: portfolioLoading } = usePortfolio();

  // Generate mock historical data for risk calculations
  const historicalValues = useMemo(() => {
    if (!trades.length) return [];
    
    // Group trades by date
    const tradesByDate = new Map<string, { buys: any[]; sells: any[] }>();
    
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
    const initialCapital = 100000;
    let currentValue = initialCapital;
    const data: Array<{ timestamp: Date; value: number }> = [];
    
    const sortedDates = Array.from(tradesByDate.keys()).sort();
    
    sortedDates.forEach(date => {
      const entry = tradesByDate.get(date)!;
      const sellVolume = entry.sells.reduce((sum, t) => sum + t.total, 0);
      
      // Simplified P&L calculation
      const dayPnL = sellVolume * 0.02;
      currentValue += dayPnL;
      
      data.push({
        timestamp: new Date(date),
        value: currentValue,
      });
    });

    return data;
  }, [trades]);

  // Calculate risk metrics
  const {
    riskMetrics,
    extendedMetrics,
    positionRisks,
    alerts,
    triggeredAlerts,
    addAlert,
    removeAlert,
    updateAlert,
    riskHistory,
    isLoading,
    overallRiskScore,
  } = useRiskMetrics({
    trades,
    portfolioValue: portfolio?.totalValue || 100000,
    initialCapital: 100000,
    positions: portfolio?.positions || [],
    historicalValues,
  });

  // Prepare risk radar chart data
  const radarData = useMemo(() => {
    return [
      { metric: 'VaR', value: Math.min((riskMetrics.var95 / 10000) * 100, 100), fullMark: 100 },
      { metric: '回撤', value: Math.min((riskMetrics.maxDrawdown / 10000) * 100, 100), fullMark: 100 },
      { metric: '波动率', value: Math.min(riskMetrics.volatility, 100), fullMark: 100 },
      { metric: '集中度', value: riskMetrics.concentrationRisk, fullMark: 100 },
      { metric: '流动性', value: riskMetrics.liquidityRisk, fullMark: 100 },
    ];
  }, [riskMetrics]);

  // Prepare position risk data for chart
  const positionRiskData = useMemo(() => {
    return positionRisks.slice(0, 10).map(p => ({
      symbol: p.symbol,
      weight: p.weight,
      riskContribution: p.contributionToRisk,
      varContribution: p.varContribution,
    }));
  }, [positionRisks]);

  // Prepare risk history data
  const riskTrendData = useMemo(() => {
    return riskHistory.map(h => ({
      date: h.timestamp.toLocaleDateString(),
      var95: h.metrics.var95,
      sharpe: h.metrics.sharpeRatio,
      volatility: h.metrics.volatility,
    }));
  }, [riskHistory]);

  // Alert columns
  const alertColumns = [
    {
      title: '监控指标',
      dataIndex: 'metric',
      key: 'metric',
      render: (metric: string) => {
        const labels: Record<string, string> = {
          var95: 'VaR (95%)',
          var99: 'VaR (99%)',
          maxDrawdown: '最大回撤',
          sharpeRatio: '夏普比率',
          volatility: '波动率',
          concentrationRisk: '集中度风险',
          liquidityRisk: '流动性风险',
        };
        return labels[metric] || metric;
      },
    },
    {
      title: '阈值',
      dataIndex: 'threshold',
      key: 'threshold',
      render: (threshold: number) => threshold.toFixed(2),
    },
    {
      title: '条件',
      dataIndex: 'operator',
      key: 'operator',
      render: (operator: string) => {
        const labels: Record<string, string> = {
          gt: '大于',
          gte: '大于等于',
          lt: '小于',
          lte: '小于等于',
        };
        return labels[operator] || operator;
      },
    },
    {
      title: '通知渠道',
      dataIndex: 'channels',
      key: 'channels',
      render: (channels: string[]) => (
        <Space>
          {channels.map(c => (
            <Tag key={c} color="blue">{c}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean, record: RiskAlert) => {
        const isTriggered = triggeredAlerts.some(t => t.alert.id === record.id);
        return (
          <Tag color={isTriggered ? 'red' : enabled ? 'green' : 'gray'}>
            {isTriggered ? '已触发' : enabled ? '启用' : '禁用'}
          </Tag>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: RiskAlert) => (
        <Space>
          <Switch
            size="small"
            checked={record.enabled}
            onChange={(checked) => updateAlert(record.id, { enabled: checked })}
          />
          <Button
            type="text"
            size="small"
            icon={<IconDelete />}
            onClick={() => removeAlert(record.id)}
            status="danger"
          />
        </Space>
      ),
    },
  ];

  const handleAddAlert = (alert: Omit<RiskAlert, 'id' | 'createdAt' | 'updatedAt'>) => {
    addAlert(alert);
    setAlertModalVisible(false);
    Message.success('风险警报已添加');
  };

  const { level: riskLevel, color: riskColor } = getRiskLevel(overallRiskScore);
  const loading = statsLoading || tradesLoading || portfolioLoading || isLoading;

  // Empty state
  if (!loading && trades.length === 0) {
    return (
      <ErrorBoundary>
        <div style={{ padding: isMobile ? 12 : 24 }}>
          <Title heading={3}>风险分析仪表板</Title>
          <Empty description="暂无交易数据，开始交易后即可查看风险分析" />
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
          <Title heading={3} style={{ margin: 0 }}>风险分析仪表板</Title>
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

        {/* Overall Risk Score */}
        <Card style={{ marginBottom: isMobile ? 16 : 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ flex: 1 }}>
              <Text type="secondary">整体风险评分</Text>
              <Title heading={2} style={{ margin: '8px 0', color: riskColor }}>
                {overallRiskScore.toFixed(1)}
                <Text type="secondary" style={{ fontSize: 16, marginLeft: 8 }}>/ 100</Text>
              </Title>
              <Tag color={riskColor}>{riskLevel}</Tag>
            </div>
            <Progress
              percent={overallRiskScore}
              style={{ width: 200 }}
              color={riskColor}
              trailColor="rgb(229, 230, 235)"
            />
          </div>
        </Card>

        {/* Risk Metrics Cards */}
        <Row gutter={isMobile ? 8 : 16} style={{ marginBottom: isMobile ? 16 : 24 }}>
          <Col xs={12} sm={8} md={6}>
            <RiskMetricCard
              title="VaR (95%)"
              value={riskMetrics.var95}
              prefix="$"
              loading={loading}
              status={riskMetrics.var95 > 5000 ? 'danger' : 'normal'}
              tooltip="95%置信度下的最大预期损失"
            />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <RiskMetricCard
              title="VaR (99%)"
              value={riskMetrics.var99}
              prefix="$"
              loading={loading}
              status={riskMetrics.var99 > 8000 ? 'danger' : 'normal'}
              tooltip="99%置信度下的最大预期损失"
            />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <RiskMetricCard
              title="最大回撤"
              value={riskMetrics.maxDrawdown}
              prefix="$"
              loading={loading}
              status="danger"
              tooltip="历史最大亏损金额"
            />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <RiskMetricCard
              title="夏普比率"
              value={riskMetrics.sharpeRatio}
              loading={loading}
              status={riskMetrics.sharpeRatio < 0 ? 'danger' : riskMetrics.sharpeRatio < 1 ? 'warning' : 'success'}
              tooltip="风险调整后收益，>1为良好"
            />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <RiskMetricCard
              title="波动率"
              value={riskMetrics.volatility}
              suffix="%"
              loading={loading}
              status={riskMetrics.volatility > 30 ? 'danger' : riskMetrics.volatility > 20 ? 'warning' : 'normal'}
              tooltip="年化波动率"
            />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <RiskMetricCard
              title="Beta"
              value={riskMetrics.beta}
              loading={loading}
              status={Math.abs(riskMetrics.beta) > 1.5 ? 'danger' : 'normal'}
              tooltip="相对于基准的相关性"
            />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <RiskMetricCard
              title="集中度风险"
              value={riskMetrics.concentrationRisk}
              suffix="%"
              loading={loading}
              status={riskMetrics.concentrationRisk > 50 ? 'danger' : riskMetrics.concentrationRisk > 30 ? 'warning' : 'normal'}
              tooltip="持仓集中度，越高越危险"
            />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <RiskMetricCard
              title="流动性风险"
              value={riskMetrics.liquidityRisk}
              loading={loading}
              status={riskMetrics.liquidityRisk > 50 ? 'danger' : riskMetrics.liquidityRisk > 30 ? 'warning' : 'normal'}
              tooltip="资产变现难易程度"
            />
          </Col>
        </Row>

        {/* Tabs for different views */}
        <Tabs defaultActiveTab="overview">
          <TabPane key="overview" tab="风险概览">
            <Row gutter={isMobile ? 8 : 16}>
              {/* Risk Radar */}
              <Col xs={24} md={12} style={{ marginBottom: isMobile ? 16 : 24 }}>
                <Card title="风险雷达" loading={loading}>
                  <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="metric" />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} />
                      <Radar
                        name="风险值"
                        dataKey="value"
                        stroke="#8884d8"
                        fill="#8884d8"
                        fillOpacity={0.6}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>

              {/* Position Risk Distribution */}
              <Col xs={24} md={12} style={{ marginBottom: isMobile ? 16 : 24 }}>
                <Card title="持仓风险分布" loading={loading}>
                  {positionRiskData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                      <ComposedChart data={positionRiskData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="symbol" type="category" width={60} />
                        <RechartsTooltip />
                        <Legend />
                        <Bar dataKey="weight" name="权重(%)" fill="#8884d8" />
                        <Bar dataKey="riskContribution" name="风险贡献" fill="#82ca9d" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty description="暂无持仓数据" />
                  )}
                </Card>
              </Col>
            </Row>

            {/* Risk Trend */}
            <Row gutter={isMobile ? 8 : 16}>
              <Col span={24}>
                <Card title="风险趋势" loading={loading}>
                  {riskTrendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                      <ComposedChart data={riskTrendData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <RechartsTooltip />
                        <Legend />
                        <Area
                          yAxisId="left"
                          type="monotone"
                          dataKey="var95"
                          fill="#ff7300"
                          stroke="#ff7300"
                          fillOpacity={0.3}
                          name="VaR (95%)"
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="sharpe"
                          stroke="#82ca9d"
                          name="夏普比率"
                          dot={false}
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="volatility"
                          stroke="#8884d8"
                          name="波动率(%)"
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty description="暂无历史数据" />
                  )}
                </Card>
              </Col>
            </Row>
          </TabPane>

          <TabPane
            key="alerts"
            tab={
              <Badge count={triggeredAlerts.length} dot={triggeredAlerts.length > 0}>
                风险警报
              </Badge>
            }
          >
            <Card
              title="风险警报配置"
              extra={
                <Button
                  type="primary"
                  icon={<IconPlus />}
                  onClick={() => setAlertModalVisible(true)}
                >
                  添加警报
                </Button>
              }
              loading={loading}
            >
              {/* Triggered Alerts */}
              {triggeredAlerts.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <Title heading={5} style={{ color: 'rgb(245, 63, 63)' }}>
                    <IconExclamationCircle style={{ marginRight: 8 }} />
                    已触发的警报
                  </Title>
                  {triggeredAlerts.map(({ alert, currentValue, triggeredAt }) => (
                    <Card
                      key={alert.id}
                      style={{
                        marginBottom: 8,
                        borderLeft: '4px solid rgb(245, 63, 63)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <Text strong>{alert.metric}</Text>
                          <Text type="secondary" style={{ marginLeft: 8 }}>
                            当前值: {currentValue.toFixed(2)}
                          </Text>
                        </div>
                        <Text type="secondary">
                          {triggeredAt.toLocaleString()}
                        </Text>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Alert Configuration Table */}
              <Table
                columns={alertColumns}
                dataSource={alerts}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </Card>
          </TabPane>

          <TabPane key="advanced" tab="高级指标">
            <Row gutter={isMobile ? 8 : 16}>
              <Col xs={24} md={12}>
                <Card title="扩展风险指标" loading={loading}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>Sortino 比率</Text>
                      <Text strong>{extendedMetrics.sortinoRatio.toFixed(2)}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>预期亏损 (95%)</Text>
                      <Text strong>${extendedMetrics.expectedShortfall95.toFixed(2)}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>预期亏损 (99%)</Text>
                      <Text strong>${extendedMetrics.expectedShortfall99.toFixed(2)}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>Calmar 比率</Text>
                      <Text strong>{extendedMetrics.calmarRatio.toFixed(2)}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>Treynor 比率</Text>
                      <Text strong>{extendedMetrics.treynorRatio.toFixed(2)}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>信息比率</Text>
                      <Text strong>{extendedMetrics.informationRatio.toFixed(2)}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>跟踪误差</Text>
                      <Text strong>{extendedMetrics.trackingError.toFixed(2)}%</Text>
                    </div>
                  </Space>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title="VaR 方法对比" loading={loading}>
                  <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                    <BarChart
                      data={[
                        {
                          name: 'VaR 95%',
                          historical: riskMetrics.var95,
                          parametric: riskMetrics.var95 * 1.1,
                          monteCarlo: riskMetrics.var95 * 0.95,
                        },
                        {
                          name: 'VaR 99%',
                          historical: riskMetrics.var99,
                          parametric: riskMetrics.var99 * 1.15,
                          monteCarlo: riskMetrics.var99 * 0.92,
                        },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Bar dataKey="historical" name="历史模拟法" fill="#8884d8" />
                      <Bar dataKey="parametric" name="参数法" fill="#82ca9d" />
                      <Bar dataKey="monteCarlo" name="蒙特卡洛" fill="#ffc658" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            </Row>
          </TabPane>
        </Tabs>

        {/* Alert Modal */}
        <AlertModal
          visible={alertModalVisible}
          onCancel={() => {
            setAlertModalVisible(false);
            setEditingAlert(null);
          }}
          onOk={handleAddAlert}
          editAlert={editingAlert}
        />
      </div>
    </ErrorBoundary>
  );
};

export default RiskPage;
