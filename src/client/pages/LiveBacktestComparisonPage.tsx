/**
 * LiveBacktestComparisonPage - Live vs Backtest Comparison Analysis Page
 *
 * Comprehensive comparison dashboard for analyzing divergence between
 * live trading results and backtest predictions
 *
 * Features:
 * - Performance metrics comparison
 * - Equity curve overlay visualization
 * - Divergence timeline
 * - Improvement insights
 * - Impact analysis (slippage, fees, execution delay)
 * - Report export
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Grid,
  Typography,
  Space,
  Button,
  Select,
  DatePicker,
  Tag,
  Table,
  Statistic,
  Progress,
  Alert,
  Spin,
  Empty,
  Message,
  Tabs,
  Descriptions,
  List,
  Divider,
  Tooltip,
  Badge,
} from '@arco-design/web-react';
import {
  IconArrowRise,
  IconArrowFall,
  IconDownload,
  IconRefresh,
  IconInfoCircle,
  IconExclamationCircle,
  IconCheckCircle,
  IconCloseCircle,
  IconDashboard,
  IconFilter,
} from '@arco-design/web-react/icon';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  ComposedChart,
  Area,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { createLogger } from '../../utils/logger';

const log = createLogger('LiveBacktestComparisonPage');
const { Title, Text } = Typography;
const { Row, Col } = Grid;
const { RangePicker } = DatePicker;

// Types
interface MetricComparison {
  name: string;
  key: string;
  backtestValue: number;
  liveValue: number;
  unit: string;
  deviation: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  higherIsBetter: boolean;
  description: string;
}

interface ImprovementInsight {
  id: string;
  category: 'timing' | 'execution' | 'risk' | 'parameters' | 'market_conditions';
  priority: number;
  title: string;
  description: string;
  currentSituation: string;
  recommendedAction: string;
  expectedImprovement: string;
  confidence: number;
}

interface ComparisonReport {
  id: string;
  generatedAt: number;
  backtestMetrics: Record<string, number>;
  liveMetrics: Record<string, number>;
  deviation: {
    overallScore: number;
    returnDeviation: number;
    sharpeDeviation: number;
    drawdownDeviation: number;
    winRateDeviation: number;
  };
  metricComparisons: MetricComparison[];
  insights: ImprovementInsight[];
  summary: {
    overallAssessment: 'outperforming' | 'on_track' | 'underperforming' | 'critical';
    keyFindings: string[];
    topRecommendations: string[];
    nextSteps?: string[];
  };
  visualizationData: {
    equityCurveComparison: {
      backtest: { timestamp: number; value: number }[];
      live: { timestamp: number; value: number }[];
    };
    metricsRadar: { metric: string; backtest: number; live: number }[];
    divergenceTimeline: { timestamp: number; divergence: number }[];
    performanceHeatmap: { period: string; backtestReturn: number; liveReturn: number; divergence: number }[];
  };
}

interface Integration {
  id: string;
  strategy: { name: string; type: string };
  status: string;
  environment: string;
}

// Severity colors
const SEVERITY_COLORS = {
  low: 'green',
  medium: 'orange',
  high: 'red',
  critical: 'magenta',
};

// Category icons
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  timing: <IconInfoCircle />,
  execution: <IconDashboard />,
  risk: <IconExclamationCircle />,
  parameters: <IconFilter />,
  market_conditions: <IconCheckCircle />,
};

/**
 * LiveBacktestComparisonPage Component
 */
const LiveBacktestComparisonPage: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<string>('');
  const [dateRange, setDateRange] = useState<[number, number]>([
    Date.now() - 30 * 24 * 60 * 60 * 1000,
    Date.now(),
  ]);
  const [report, setReport] = useState<ComparisonReport | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch integrations
  useEffect(() => {
    const fetchIntegrations = async () => {
      try {
        const response = await fetch('/api/backtest-live/strategies?userId=current');
        const data = await response.json();
        if (data.success) {
          setIntegrations(data.integrations);
          if (data.integrations.length > 0) {
            setSelectedIntegration(data.integrations[0].id);
          }
        }
      } catch (error) {
        log.error('Failed to fetch integrations', error);
      }
    };

    fetchIntegrations();
  }, []);

  // Fetch comparison report
  const fetchReport = useCallback(async () => {
    if (!selectedIntegration) {
      Message.warning('请先选择一个策略');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/comparison/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integrationId: selectedIntegration,
          userId: 'current',
          periodStart: dateRange[0],
          periodEnd: dateRange[1],
          options: {
            includeTradeAnalysis: true,
            includeMarketEnvironment: true,
            includeSlippageAnalysis: true,
            includeFeeAnalysis: true,
            includeExecutionDelayAnalysis: true,
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        setReport(data.report);
        Message.success('对比分析报告已生成');
      } else {
        Message.error(data.error || '生成报告失败');
      }
    } catch (error: any) {
      log.error('Failed to fetch report', error);
      Message.error('生成报告失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [selectedIntegration, dateRange]);

  // Export report
  const exportReport = useCallback(async (format: 'pdf' | 'html' | 'json') => {
    if (!report) {
      Message.warning('没有可导出的报告');
      return;
    }

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comparison-report-${report.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      Message.success('报告已导出');
    } else {
      Message.info(`${format.toUpperCase()} 导出功能即将上线`);
    }
  }, [report]);

  // Overall assessment badge
  const assessmentConfig = useMemo(() => {
    if (!report) return null;

    const assessment = report.summary.overallAssessment;
    switch (assessment) {
      case 'outperforming':
        return { color: 'green', text: '超越回测', icon: <IconArrowRise /> };
      case 'on_track':
        return { color: 'blue', text: '符合预期', icon: <IconCheckCircle /> };
      case 'underperforming':
        return { color: 'orange', text: '表现不佳', icon: <IconArrowFall /> };
      case 'critical':
        return { color: 'red', text: '严重偏离', icon: <IconCloseCircle /> };
      default:
        return null;
    }
  }, [report]);

  // Prepare equity curve data for recharts
  const equityCurveData = useMemo(() => {
    if (!report) return [];

    const backtestData = report.visualizationData.equityCurveComparison.backtest;
    const liveData = report.visualizationData.equityCurveComparison.live;

    // Merge the two series by timestamp
    const dataMap = new Map<number, { timestamp: number; backtest?: number; live?: number }>();

    backtestData.forEach((d) => {
      dataMap.set(d.timestamp, { timestamp: d.timestamp, backtest: d.value });
    });

    liveData.forEach((d) => {
      const existing = dataMap.get(d.timestamp);
      if (existing) {
        existing.live = d.value;
      } else {
        dataMap.set(d.timestamp, { timestamp: d.timestamp, live: d.value });
      }
    });

    return Array.from(dataMap.values())
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((d) => ({
        ...d,
        time: new Date(d.timestamp).toLocaleDateString(),
      }));
  }, [report]);

  // Prepare radar data for recharts
  const radarData = useMemo(() => {
    if (!report) return [];

    return report.visualizationData.metricsRadar.map((m) => ({
      metric: m.metric,
      backtest: m.backtest,
      live: m.live,
      fullMark: 100,
    }));
  }, [report]);

  // Prepare divergence timeline data for recharts
  const divergenceTimelineData = useMemo(() => {
    if (!report) return [];

    return report.visualizationData.divergenceTimeline.map((d) => ({
      ...d,
      time: new Date(d.timestamp).toLocaleDateString(),
    }));
  }, [report]);

  // Prepare heatmap data for recharts
  const heatmapData = useMemo(() => {
    if (!report) return [];

    return report.visualizationData.performanceHeatmap.map((d) => ({
      period: d.period,
      回测收益: d.backtestReturn,
      实盘收益: d.liveReturn,
    }));
  }, [report]);

  // Metrics table columns
  const metricsColumns = [
    {
      title: '指标',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: MetricComparison) => (
        <Space>
          <Tooltip content={record.description}>
            <IconInfoCircle style={{ color: 'var(--color-text-3)' }} />
          </Tooltip>
          <Text bold>{name}</Text>
        </Space>
      ),
    },
    {
      title: '回测值',
      dataIndex: 'backtestValue',
      key: 'backtestValue',
      render: (value: number, record: MetricComparison) => (
        <Text>
          {value.toFixed(2)}{record.unit}
        </Text>
      ),
    },
    {
      title: '实盘值',
      dataIndex: 'liveValue',
      key: 'liveValue',
      render: (value: number, record: MetricComparison) => (
        <Text style={{
          color: record.higherIsBetter
            ? (value >= record.backtestValue ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))')
            : (value <= record.backtestValue ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))')
        }}>
          {value.toFixed(2)}{record.unit}
        </Text>
      ),
    },
    {
      title: '偏离度',
      dataIndex: 'deviation',
      key: 'deviation',
      sorter: (a: MetricComparison, b: MetricComparison) => Math.abs(a.deviation) - Math.abs(b.deviation),
      render: (value: number, record: MetricComparison) => (
        <Space>
          {value >= 0 ? <IconArrowRise style={{ color: 'rgb(var(--success-6))' }} /> : <IconArrowFall style={{ color: 'rgb(var(--danger-6))' }} />}
          <Tag color={SEVERITY_COLORS[record.severity]}>
            {value >= 0 ? '+' : ''}{value.toFixed(1)}%
          </Tag>
        </Space>
      ),
    },
  ];

  // Insights list item renderer
  const renderInsight = (insight: ImprovementInsight) => (
    <List.Item
      key={insight.id}
      actions={[
        <Text key="confidence" type="secondary">
          置信度: {(insight.confidence * 100).toFixed(0)}%
        </Text>,
      ]}
    >
      <List.Item.Meta
        avatar={
          <Badge count={insight.priority} style={{ backgroundColor: insight.priority <= 2 ? '#F53F3F' : '#FF7D00' }}>
            <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-fill-2)', borderRadius: 4 }}>
              {CATEGORY_ICONS[insight.category]}
            </div>
          </Badge>
        }
        title={
          <Space>
            <Text bold>{insight.title}</Text>
            <Tag size="small">{insight.category}</Tag>
          </Space>
        }
        description={
          <div>
            <Text type="secondary">{insight.description}</Text>
            <div style={{ marginTop: 8 }}>
              <Text bold>当前情况: </Text>
              <Text>{insight.currentSituation}</Text>
            </div>
            <div style={{ marginTop: 4 }}>
              <Text bold style={{ color: 'rgb(var(--success-6))' }}>建议操作: </Text>
              <Text>{insight.recommendedAction}</Text>
            </div>
            <div style={{ marginTop: 4 }}>
              <Text bold style={{ color: 'rgb(var(--primary-6))' }}>预期改善: </Text>
              <Text>{insight.expectedImprovement}</Text>
            </div>
          </div>
        }
      />
    </List.Item>
  );

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Header */}
        <Card>
          <Row justify="space-between" align="center">
            <Col>
              <Title heading={4} style={{ margin: 0 }}>
                实盘与回测对比分析
              </Title>
              <Text type="secondary">
                分析实盘交易与回测结果的差异，发现改进机会
              </Text>
            </Col>
            <Col>
              <Space>
                <Select
                  style={{ width: 200 }}
                  placeholder="选择策略"
                  value={selectedIntegration}
                  onChange={setSelectedIntegration}
                >
                  {integrations.map((i) => (
                    <Select.Option key={i.id} value={i.id}>
                      {i.strategy.name} ({i.environment})
                    </Select.Option>
                  ))}
                </Select>
                <RangePicker
                  showTime
                  value={dateRange.map((d) => new Date(d)) as [Date, Date]}
                  onChange={(dates) => dates && setDateRange([dates[0].getTime(), dates[1].getTime()])}
                />
                <Button
                  type="primary"
                  icon={<IconRefresh />}
                  loading={loading}
                  onClick={fetchReport}
                >
                  生成分析
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Loading State */}
        {loading && (
          <Card>
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin size={32} />
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">正在生成对比分析报告...</Text>
              </div>
            </div>
          </Card>
        )}

        {/* Empty State */}
        {!loading && !report && (
          <Card>
            <Empty
              description="选择策略和时间范围后点击「生成分析」按钮"
              icon={<IconDashboard style={{ fontSize: 64 }} />}
            />
          </Card>
        )}

        {/* Report Content */}
        {!loading && report && (
          <>
            {/* Summary Card */}
            <Card>
              <Row gutter={24}>
                <Col span={6}>
                  <div style={{ textAlign: 'center' }}>
                    {assessmentConfig && (
                      <Tag
                        color={assessmentConfig.color}
                        style={{ fontSize: 18, padding: '8px 16px', marginBottom: 8 }}
                      >
                        {assessmentConfig.icon} {assessmentConfig.text}
                      </Tag>
                    )}
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">整体评估</Text>
                    </div>
                  </div>
                </Col>
                <Col span={6}>
                  <Statistic
                    title="偏离度得分"
                    value={report.deviation.overallScore.toFixed(1)}
                    suffix="/ 100"
                    valueStyle={{
                      color: report.deviation.overallScore < 20 ? 'rgb(var(--success-6))' :
                             report.deviation.overallScore < 40 ? 'rgb(var(--warning-6))' : 'rgb(var(--danger-6))'
                    }}
                  />
                  <Progress
                    percent={100 - report.deviation.overallScore}
                    showText={false}
                    status={report.deviation.overallScore < 20 ? 'success' :
                           report.deviation.overallScore < 40 ? 'warning' : 'danger'}
                    style={{ marginTop: 8 }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="收益偏离"
                    value={report.deviation.returnDeviation}
                    suffix="%"
                    prefix={report.deviation.returnDeviation >= 0 ? <IconArrowRise /> : <IconArrowFall />}
                    valueStyle={{
                      color: report.deviation.returnDeviation >= 0 ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))'
                    }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="改善建议"
                    value={report.insights.length}
                    suffix="项"
                  />
                </Col>
              </Row>

              {report.summary.keyFindings.length > 0 && (
                <Alert
                  type={report.summary.overallAssessment === 'on_track' || report.summary.overallAssessment === 'outperforming' ? 'success' : 'warning'}
                  title="关键发现"
                  content={
                    <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                      {report.summary.keyFindings.map((finding, idx) => (
                        <li key={idx}>{finding}</li>
                      ))}
                    </ul>
                  }
                  style={{ marginTop: 16 }}
                />
              )}
            </Card>

            {/* Tabs */}
            <Card>
              <Tabs activeTab={activeTab} onChange={setActiveTab}>
                <Tabs.TabPane key="overview" title="概览">
                  <Space direction="vertical" style={{ width: '100%' }} size="large">
                    {/* Equity Curve Comparison */}
                    <Card title="资金曲线对比" bordered={false}>
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={equityCurveData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" />
                          <YAxis
                            tickFormatter={(value) => `$${(value / 1000).toFixed(1)}K`}
                          />
                          <RechartsTooltip
                            formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="backtest"
                            name="回测"
                            stroke="#165DFF"
                            strokeWidth={2}
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="live"
                            name="实盘"
                            stroke="#14C9C9"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </Card>

                    {/* Metrics Radar and Divergence Timeline */}
                    <Row gutter={16}>
                      <Col span={12}>
                        <Card title="指标雷达图" bordered={false}>
                          <ResponsiveContainer width="100%" height={350}>
                            <RadarChart data={radarData}>
                              <PolarGrid />
                              <PolarAngleAxis dataKey="metric" />
                              <PolarRadiusAxis angle={30} domain={[0, 100]} />
                              <Radar
                                name="回测"
                                dataKey="backtest"
                                stroke="#165DFF"
                                fill="#165DFF"
                                fillOpacity={0.3}
                              />
                              <Radar
                                name="实盘"
                                dataKey="live"
                                stroke="#14C9C9"
                                fill="#14C9C9"
                                fillOpacity={0.3}
                              />
                              <Legend />
                              <RechartsTooltip />
                            </RadarChart>
                          </ResponsiveContainer>
                        </Card>
                      </Col>
                      <Col span={12}>
                        <Card title="偏离度时间线" bordered={false}>
                          <ResponsiveContainer width="100%" height={350}>
                            <ComposedChart data={divergenceTimelineData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="time" />
                              <YAxis />
                              <RechartsTooltip />
                              <Area
                                type="monotone"
                                dataKey="divergence"
                                name="偏离度"
                                stroke="#165DFF"
                                fill="#165DFF"
                                fillOpacity={0.3}
                              />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </Card>
                      </Col>
                    </Row>

                    {/* Monthly Returns */}
                    <Card title="月度收益对比" bordered={false}>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={heatmapData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" />
                          <YAxis tickFormatter={(value) => `${value.toFixed(1)}%`} />
                          <RechartsTooltip formatter={(value: number) => [`${value.toFixed(2)}%`, '']} />
                          <Legend />
                          <Bar dataKey="回测收益" fill="#165DFF" />
                          <Bar dataKey="实盘收益" fill="#14C9C9" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>
                  </Space>
                </Tabs.TabPane>

                <Tabs.TabPane key="metrics" title="指标对比">
                  <Table
                    columns={metricsColumns}
                    data={report.metricComparisons}
                    rowKey="key"
                    pagination={false}
                  />
                </Tabs.TabPane>

                <Tabs.TabPane key="insights" title="改进建议">
                  <List
                    dataSource={report.insights}
                    renderItem={renderInsight}
                    bordered
                    style={{ maxHeight: 600, overflow: 'auto' }}
                  />
                </Tabs.TabPane>

                <Tabs.TabPane key="recommendations" title="操作建议">
                  <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <Card title="优先处理" bordered={false}>
                      {report.summary.topRecommendations.map((rec, idx) => (
                        <Alert
                          key={idx}
                          type="info"
                          content={rec}
                          style={{ marginBottom: idx < report.summary.topRecommendations.length - 1 ? 8 : 0 }}
                        />
                      ))}
                    </Card>

                    {report.summary.nextSteps && (
                      <Card title="下一步行动" bordered={false}>
                        <List
                          dataSource={report.summary.nextSteps}
                          renderItem={(step, idx) => (
                            <List.Item key={idx}>
                              <Text>{idx + 1}. {step}</Text>
                            </List.Item>
                          )}
                        />
                      </Card>
                    )}
                  </Space>
                </Tabs.TabPane>
              </Tabs>
            </Card>

            {/* Export Actions */}
            <Card>
              <Row justify="end">
                <Space>
                  <Text type="secondary">
                    报告生成时间: {new Date(report.generatedAt).toLocaleString()}
                  </Text>
                  <Divider type="vertical" />
                  <Button
                    icon={<IconDownload />}
                    onClick={() => exportReport('json')}
                  >
                    导出 JSON
                  </Button>
                  <Button
                    icon={<IconDownload />}
                    onClick={() => exportReport('pdf')}
                  >
                    导出 PDF
                  </Button>
                  <Button
                    icon={<IconDownload />}
                    onClick={() => exportReport('html')}
                  >
                    导出 HTML
                  </Button>
                </Space>
              </Row>
            </Card>
          </>
        )}
      </Space>
    </div>
  );
};

export default LiveBacktestComparisonPage;