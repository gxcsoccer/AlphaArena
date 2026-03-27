/**
 * Payment Funnel Dashboard Component
 * Issue #662: 支付转化漏斗优化
 * 
 * Admin dashboard for viewing payment funnel analytics
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Table,
  Tag,
  Button,
  Space,
  Spin,
  Empty,
  Grid,
  Progress,
  Statistic,
  Message,
  DatePicker,
  Divider,
  List,
  Alert,
  Tooltip,
} from '@arco-design/web-react';
import {
  IconArrowDown,
  IconArrowUp,
  IconCheckCircle,
  IconCloseCircle,
  IconArrowRise as IconTrendingUp,
  IconArrowFall as IconTrendingDown,
  IconInfoCircle,
} from '@arco-design/web-react/icon';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Row, Col } = Grid;
const { RangePicker } = DatePicker;

// ==================== Types ====================

interface FunnelStep {
  stage: string;
  stageName: string;
  count: number;
  uniqueUsers: number;
  conversionRate: number;
  dropOffRate: number;
}

interface FunnelAnalysis {
  period: { start: string; end: string };
  steps: FunnelStep[];
  totalVisitors: number;
  totalConversions: number;
  overallConversionRate: number;
  dropOffDistribution: Array<{
    stage: string;
    reason: string;
    count: number;
    percentage: number;
  }>;
}

interface DropOffItem {
  stage: string;
  reason: string;
  count: number;
  percentage: number;
  avgTimeBeforeDropOff?: number;
  avgSelectedPrice?: number;
  suggestions: string[];
}

interface ConversionItem {
  planId: string;
  planName: string;
  visitors: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
}

interface Suggestion {
  category: string;
  priority: string;
  description: string;
  impact: string;
  effort: string;
  actionable: boolean;
}

// ==================== Stage Display Names ====================

const STAGE_NAMES: Record<string, string> = {
  subscription_page_view: '访问订阅页',
  plan_selected: '选择计划',
  checkout_initiated: '发起支付',
  checkout_loaded: '加载支付页',
  payment_submitted: '提交支付',
  payment_succeeded: '支付成功',
  payment_failed: '支付失败',
  checkout_canceled: '取消支付',
};

const DROPOFF_REASON_NAMES: Record<string, string> = {
  price_concern: '价格顾虑',
  comparison: '比较选择',
  complexity: '流程复杂',
  technical_issue: '技术问题',
  payment_declined: '支付被拒',
  timeout: '会话超时',
  distracted: '用户分心',
  not_ready: '尚未准备',
  trust_issue: '信任问题',
  missing_features: '功能缺失',
  unknown: '未知原因',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'gold',
  low: 'gray',
};

// ==================== Component ====================

const PaymentFunnelDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<[Date, Date]>([
    dayjs().subtract(7, 'day').toDate(),
    dayjs().toDate(),
  ]);
  const [analysis, setAnalysis] = useState<FunnelAnalysis | null>(null);
  const [dropOffData, setDropOffData] = useState<DropOffItem[]>([]);
  const [conversionByPlan, setConversionByPlan] = useState<ConversionItem[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [start, end] = dateRange;
      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });

      const response = await fetch(`/api/payment-funnel/dashboard?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const result = await response.json();
      
      if (result.success) {
        setAnalysis(result.data.analysis);
        setDropOffData(result.data.dropOffAnalysis);
        setConversionByPlan(result.data.conversionByPlan);
        setSuggestions(result.data.suggestions);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      Message.error('加载漏斗数据失败');
    } finally {
      setLoading(false);
    }
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(value);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds}秒`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}分${secs}秒`;
  };

  // ==================== Render ====================

  if (loading) {
    return (
      <Card style={{ textAlign: 'center', padding: 48 }}>
        <Spin size={40} />
        <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
          加载漏斗数据...
        </Text>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card>
        <Empty description="暂无漏斗数据" />
      </Card>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title heading={4} style={{ margin: 0 }}>
          支付转化漏斗分析
        </Title>
        <Space>
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [Date, Date])}
            style={{ width: 280 }}
          />
          <Button type="primary" onClick={fetchData}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Key Metrics */}
      <Row gutter={16}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="总访客"
              value={analysis.totalVisitors}
              prefix={<IconTrendingUp />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="转化用户"
              value={analysis.totalConversions}
              prefix={<IconCheckCircle style={{ color: '#00b42a' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="整体转化率"
              value={analysis.overallConversionRate}
              suffix="%"
              precision={2}
              valueStyle={{
                color: analysis.overallConversionRate >= 5 ? '#00b42a' : '#f53f3f',
              }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="流失用户"
              value={analysis.totalVisitors - analysis.totalConversions}
              prefix={<IconCloseCircle style={{ color: '#f53f3f' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Funnel Visualization */}
      <Card style={{ marginTop: 16 }}>
        <Title heading={5}>转化漏斗</Title>
        <Divider style={{ margin: '16px 0' }} />
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {analysis.steps.map((step, index) => {
            const prevStep = index > 0 ? analysis.steps[index - 1] : null;
            const width = prevStep
              ? (step.uniqueUsers / prevStep.uniqueUsers) * 100
              : 100;

            return (
              <div key={step.stage}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text strong>{step.stageName}</Text>
                  <Space>
                    <Text type="secondary">{step.uniqueUsers} 用户</Text>
                    {index > 0 && (
                      <Tag color={step.conversionRate >= 50 ? 'green' : 'orange'}>
                        转化: {formatPercent(step.conversionRate)}
                      </Tag>
                    )}
                    {step.dropOffRate > 0 && (
                      <Tag color="red">
                        流失: {formatPercent(step.dropOffRate)}
                      </Tag>
                    )}
                  </Space>
                </div>
                <Progress
                  percent={width}
                  strokeColor={step.stage === 'payment_succeeded' ? '#00b42a' : '#165dff'}
                  showText={false}
                />
              </div>
            );
          })}
        </div>
      </Card>

      {/* Drop-off Analysis */}
      {dropOffData.length > 0 && (
        <Card style={{ marginTop: 16 }}>
          <Title heading={5}>流失分析</Title>
          <Divider style={{ margin: '16px 0' }} />
          
          <List
            dataSource={dropOffData}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      <Text>{STAGE_NAMES[item.stage] || item.stage}</Text>
                      <Tag color="red">
                        {DROPOFF_REASON_NAMES[item.reason] || item.reason}
                      </Tag>
                      <Text type="secondary">{item.count} 人</Text>
                    </Space>
                  }
                  description={
                    <div>
                      <Text type="secondary">
                        占比: {formatPercent(item.percentage)} | 
                        平均停留: {formatDuration(item.avgTimeBeforeDropOff)}
                      </Text>
                      {item.suggestions.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <Text type="secondary">建议:</Text>
                          <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                            {item.suggestions.map((s, i) => (
                              <li key={i}>
                                <Text type="secondary">{s}</Text>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* Conversion by Plan */}
      {conversionByPlan.length > 0 && (
        <Card style={{ marginTop: 16 }}>
          <Title heading={5}>各计划转化率</Title>
          <Divider style={{ margin: '16px 0' }} />
          
          <Table
            data={conversionByPlan}
            pagination={false}
            columns={[
              {
                title: '计划',
                dataIndex: 'planName',
                key: 'planName',
              },
              {
                title: '访客',
                dataIndex: 'visitors',
                key: 'visitors',
                render: (v) => v.toLocaleString(),
              },
              {
                title: '转化',
                dataIndex: 'conversions',
                key: 'conversions',
                render: (v) => v.toLocaleString(),
              },
              {
                title: '转化率',
                dataIndex: 'conversionRate',
                key: 'conversionRate',
                render: (v) => (
                  <Tag color={v >= 10 ? 'green' : v >= 5 ? 'orange' : 'red'}>
                    {formatPercent(v)}
                  </Tag>
                ),
              },
              {
                title: '收入',
                dataIndex: 'revenue',
                key: 'revenue',
                render: (v) => formatCurrency(v),
              },
            ]}
          />
        </Card>
      )}

      {/* Optimization Suggestions */}
      {suggestions.length > 0 && (
        <Card style={{ marginTop: 16 }}>
          <Title heading={5}>优化建议</Title>
          <Divider style={{ margin: '16px 0' }} />
          
          <List
            dataSource={suggestions}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  avatar={
                    <Tag color={PRIORITY_COLORS[item.priority]}>
                      {item.priority.toUpperCase()}
                    </Tag>
                  }
                  title={
                    <Text>{item.description}</Text>
                  }
                  description={
                    <Space split={<Divider type="vertical" />}>
                      <Text type="secondary">预期影响: {item.impact}</Text>
                      <Text type="secondary">实施难度: {item.effort}</Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* No Data Message */}
      {analysis.totalVisitors === 0 && (
        <Alert
          type="info"
          style={{ marginTop: 16 }}
          message="暂无数据"
          description="当前时间段内没有支付漏斗数据。请确保前端已集成 usePaymentFunnel hook 进行事件追踪。"
        />
      )}
    </div>
  );
};

export default PaymentFunnelDashboard;