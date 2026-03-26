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
  IconAlertTriangle,
  IconCheckCircle,
  IconCloseCircle,
  IconTrendingUp,
  IconTrendingDown,
  IconFilter,
} from '@arco-design/web-react/icon';
import ReactECharts from 'echarts-for-react';
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
  execution: <IconTrendingUp />,
  risk: <IconAlertTriangle />,
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
        return { color: 'orange', text: '表现不佳', icon: <IconTrendingDown /> };
      case 'critical':
        return { color: 'red', text: '严重偏离', icon: <IconCloseCircle /> };
      default:
        return null;
    }
  }, [report]);

  // Equity curve chart option
  const equityCurveOption = useMemo(() => {
    if (!report) return {};

    const backtestData = report.visualizationData.equityCurveComparison.backtest.map(
      (d) => [d.timestamp, d.value]
    );
    const liveData = report.visualizationData.equityCurveComparison.live.map(
      (d) => [d.timestamp, d.value]
    );

    return {
      title: {
        text: '资金曲线对比',
        left: 'center',
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
      },
      legend: {
        data: ['回测', '实盘'],
        bottom: 0,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'time',
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: '资金 ($)',
        axisLabel: {
          formatter: (value: number) => `$${(value / 1000).toFixed(1)}K`,
        },
      },
      series: [
        {
          name: '回测',
          type: 'line',
          data: backtestData,
          smooth: true,
          lineStyle: { width: 2 },
          itemStyle: { color: '#165DFF' },
        },
        {
          name: '实盘',
          type: 'line',
          data: liveData,
          smooth: true,
          lineStyle: { width: 2 },
          itemStyle: { color: '#14C9C9' },
        },
      ],
    };
  }, [report]);

  // Metrics radar chart option
  const radarOption = useMemo(() => {
    if (!report) return {};

    const indicator = report.visualizationData.metricsRadar.map((m) => ({
      name: m.metric,
      max: 100,
    }));

    return {
      title: {
        text: '指标雷达图',
        left: 'center',
      },
      tooltip: {},
      legend: {
        data: ['回测', '实盘'],
        bottom: 0,
      },
      radar: {
        indicator,
        center: ['50%', '50%'],
        radius: '60%',
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: report.visualizationData.metricsRadar.map((m) => m.backtest),
              name: '回测',
              itemStyle: { color: '#165DFF' },
              areaStyle: { opacity: 0.2 },
            },
            {
              value: report.visualizationData.metricsRadar.map((m) => m.live),
              name: '实盘',
              itemStyle: { color: '#14C9C9' },
              areaStyle: { opacity: 0.2 },
            },
          ],
        },
      ],
    };
  }, [report]);

  // Divergence timeline chart option
  const divergenceTimelineOption = useMemo(() => {
    if (!report) return {};

    return {
      title: {
        text: '偏离度时间线',
        left: 'center',
      },
      tooltip: {
        trigger: 'axis',
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'time',
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: '偏离度',
        axisLabel: {
          formatter: '{value}',
        },
      },
      visualMap: {
        show: false,
        pieces: [
          { lte: 10, color: '#00B42A' },
          { gt: 10, lte: 20, color: '#165DFF' },
          { gt: 20, lte: 40, color: '#FF7D00' },
          { gt: 40, color: '#F53F3F' },
        ],
      },
      series: [
        {
          type: 'line',
          data: report.visualizationData.divergenceTimeline.map((d) => [d.timestamp, d.divergence]),
          smooth: true,
          areaStyle: { opacity: 0.3 },
        },
      ],
    };
  }, [report]);

  // Performance heatmap option
  const heatmapOption = useMemo(() => {
    if (!report) return {};

    const periods = report.visualizationData.performanceHeatmap.map((d) => d.period);
    const backtestReturns = report.visualizationData.performanceHeatmap.map((d) => d.backtestReturn);
    const liveReturns = report.visualizationData.performanceHeatmap.map((d) => d.liveReturn);

    return {
      title: {
        text: '月度收益对比',
        left: 'center',
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      legend: {
        data: ['回测收益', '实盘收益'],
        bottom: 0,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: periods,
      },
      yAxis: {
        type: 'value',
        name: '收益率 (%)',
        axisLabel: {
          formatter: '{value}%',
        },
      },
      series: [
        {
          name: '回测收益',
          type: 'bar',
          data: backtestReturns,
          itemStyle: { color: '#165DFF' },
        },
        {
          name: '实盘收益',
          type: 'bar',
          data: liveReturns,
          itemStyle: { color: '#14C9C9' },
        },
      ],
    };
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
              icon={<IconTrendingUp style={{ fontSize: 64 }} />}
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
                    <ReactECharts option={equityCurveOption} style={{ height: 400 }} />

                    {/* Metrics Radar */}
                    <Row gutter={16}>
                      <Col span={12}>
                        <ReactECharts option={radarOption} style={{ height: 350 }} />
                      </Col>
                      <Col span={12}>
                        <ReactECharts option={divergenceTimelineOption} style={{ height: 350 }} />
                      </Col>
                    </Row>

                    {/* Monthly Returns */}
                    <ReactECharts option={heatmapOption} style={{ height: 300 }} />
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