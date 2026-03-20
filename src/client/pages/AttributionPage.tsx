import React, { useState, useEffect, useMemo } from 'react';
import { Typography, Card, Table, Space, Grid, Select, Button, Empty, Spin, Message } from '@arco-design/web-react';
import { IconDownload, IconRefresh } from '@arco-design/web-react/icon';
const { Row, Col } = Grid;
const { Title, Text } = Typography;

import { Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';

import { ErrorBoundary } from '../components/ErrorBoundary';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const TIME_PERIODS = [
  { label: '按日', value: 'daily' },
  { label: '按周', value: 'weekly' },
  { label: '按月', value: 'monthly' },
  { label: '全部', value: 'all' },
];

const BENCHMARK_OPTIONS = [
  { label: 'BTC 持有', value: 'btc_hodl' },
  { label: 'ETH 持有', value: 'eth_hodl' },
  { label: '等权重组合', value: 'equal_weight' },
];

interface StrategyAttribution {
  strategyId: string;
  strategyName: string;
  contribution: number;
  contributionPercent: number;
  trades: number;
  winRate: number;
  avgReturn: number;
  riskContribution: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
}

interface SymbolAttribution {
  symbol: string;
  contribution: number;
  contributionPercent: number;
  trades: number;
  winRate: number;
  avgReturn: number;
  riskContribution: number;
  maxDrawdown: number;
  volatility: number;
  holdingTime: number;
}

interface TimeAttribution {
  period: string;
  contribution: number;
  contributionPercent: number;
  trades: number;
  winRate: number;
  volatility: number;
  benchmarkReturn: number;
}

interface RiskAttribution {
  totalRisk: number;
  maxDrawdown: number;
  maxDrawdownPeriod: { startDate: Date; endDate: Date; peakValue: number; troughValue: number };
  drawdownContributions: Array<{ strategyId: string; strategyName: string; contribution: number }>;
  volatilityContributions: Array<{ strategyId: string; strategyName: string; contribution: number }>;
}

interface BenchmarkComparison {
  benchmarkType: string;
  benchmarkReturn: number;
  strategyReturn: number;
  excessReturn: number;
  beta: number;
  trackingError: number;
  informationRatio: number;
  upCapture: number;
  downCapture: number;
}

interface StrategyEfficiency {
  strategyId: string;
  strategyName: string;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  treynorRatio: number;
  informationRatio: number;
  omegaRatio: number;
  maxDrawdown: number;
  recoveryFactor: number;
  profitFactor: number;
  payoffRatio: number;
}

interface AttributionReport {
  userId: string;
  generatedAt: Date;
  period: string;
  totalReturn: number;
  totalRisk: number;
  strategyAttribution: StrategyAttribution[];
  symbolAttribution: SymbolAttribution[];
  timeAttribution: TimeAttribution[];
  riskAttribution: RiskAttribution;
  benchmarkComparison: BenchmarkComparison[];
  efficiencyMetrics: StrategyEfficiency[];
}

const _formatPercent = (value: number, decimals = 2) => `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

const MetricsCard: React.FC<{ title: string; value: string; loading?: boolean }> = ({ title, value, loading }) => (
  <Card loading={loading} hoverable>
    <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{title}</div>
    <div style={{ fontSize: 20, fontWeight: 'bold', marginTop: 8 }}>{value}</div>
  </Card>
);

const AttributionPage: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>('all');
  const [benchmarkType, setBenchmarkType] = useState<string>('btc_hodl');
  const [report, setReport] = useState<AttributionReport | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchAttribution = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period, benchmarkType });
      const response = await fetch(`/api/attribution?${params.toString()}`);
      const result = await response.json();
      if (result.success) setReport(result.data);
      else Message.error('获取归因分析数据失败');
    } catch (_error) {
      Message.error('获取归因分析数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAttribution(); }, [period, benchmarkType]);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ period, benchmarkType });
      const response = await fetch(`/api/attribution/export?${params.toString()}`, { method: 'POST' });
      const result = await response.json();
      if (result.success) Message.success('报告生成成功');
    } catch {
      Message.error('导出报告失败');
    }
  };

  const strategyColumns = [
    { title: '策略名称', dataIndex: 'strategyName', key: 'strategyName', width: 150 },
    { title: '收益贡献', dataIndex: 'contribution', key: 'contribution', width: 120, render: (v: number) => <Text style={{ color: v >= 0 ? 'rgb(0, 180, 42)' : 'rgb(245, 63, 63)' }}>{formatCurrency(v)}</Text> },
    { title: '贡献占比', dataIndex: 'contributionPercent', key: 'contributionPercent', width: 100, render: (v: number) => `${v.toFixed(1)}%` },
    { title: '交易次数', dataIndex: 'trades', key: 'trades', width: 80 },
    { title: '胜率', dataIndex: 'winRate', key: 'winRate', width: 80, render: (v: number) => `${v.toFixed(1)}%` },
    { title: '夏普比率', dataIndex: 'sharpeRatio', key: 'sharpeRatio', width: 100, render: (v: number) => v.toFixed(2) },
    { title: '最大回撤', dataIndex: 'maxDrawdown', key: 'maxDrawdown', width: 100, render: (v: number) => <Text style={{ color: 'rgb(245, 63, 63)' }}>{formatCurrency(-Math.abs(v))}</Text> },
  ];

  const symbolColumns = [
    { title: '交易对', dataIndex: 'symbol', key: 'symbol', width: 120 },
    { title: '收益贡献', dataIndex: 'contribution', key: 'contribution', width: 120, render: (v: number) => <Text style={{ color: v >= 0 ? 'rgb(0, 180, 42)' : 'rgb(245, 63, 63)' }}>{formatCurrency(v)}</Text> },
    { title: '贡献占比', dataIndex: 'contributionPercent', key: 'contributionPercent', width: 100, render: (v: number) => `${v.toFixed(1)}%` },
    { title: '交易次数', dataIndex: 'trades', key: 'trades', width: 80 },
    { title: '胜率', dataIndex: 'winRate', key: 'winRate', width: 80, render: (v: number) => `${v.toFixed(1)}%` },
    { title: '波动率', dataIndex: 'volatility', key: 'volatility', width: 100, render: (v: number) => `${(v * 100).toFixed(1)}%` },
  ];

  const waterfallData = useMemo(() => report?.strategyAttribution?.map(s => ({ name: s.strategyName, value: s.contribution })) || [], [report]);
  const pieData = useMemo(() => report?.symbolAttribution?.map(s => ({ name: s.symbol, value: Math.abs(s.contribution) })) || [], [report]);

  if (!loading && !report) {
    return (
      <ErrorBoundary>
        <div style={{ padding: isMobile ? 12 : 24 }}>
          <Title heading={3}>绩效归因分析</Title>
          <Empty description="暂无归因分析数据" />
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div style={{ padding: isMobile ? 12 : 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? 12 : 24, flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 0 }}>
          <Title heading={3} style={{ margin: 0 }}>绩效归因分析</Title>
          <Space>
            <Select value={period} onChange={setPeriod} style={{ width: 120 }}>
              {TIME_PERIODS.map(p => <Select.Option key={p.value} value={p.value}>{p.label}</Select.Option>)}
            </Select>
            <Select value={benchmarkType} onChange={setBenchmarkType} style={{ width: 140 }}>
              {BENCHMARK_OPTIONS.map(b => <Select.Option key={b.value} value={b.value}>{b.label}</Select.Option>)}
            </Select>
            <Button icon={<IconRefresh />} onClick={fetchAttribution} loading={loading}>刷新</Button>
            <Button type="primary" icon={<IconDownload />} onClick={handleExport}>导出</Button>
          </Space>
        </div>

        <Spin loading={loading} style={{ display: 'block' }}>
          {report && (
            <>
              <Row gutter={isMobile ? 8 : 16} style={{ marginBottom: isMobile ? 16 : 24 }}>
                <Col xs={12} sm={8} md={6}><MetricsCard title="总收益" value={formatCurrency(report.totalReturn)} loading={loading} /></Col>
                <Col xs={12} sm={8} md={6}><MetricsCard title="总风险" value={`${(report.totalRisk * 100).toFixed(1)}%`} loading={loading} /></Col>
                <Col xs={12} sm={8} md={6}><MetricsCard title="最大回撤" value={formatCurrency(-Math.abs(report.riskAttribution?.maxDrawdown || 0))} loading={loading} /></Col>
                <Col xs={12} sm={8} md={6}><MetricsCard title="策略数量" value={String(report.strategyAttribution?.length || 0)} loading={loading} /></Col>
              </Row>

              <Row gutter={isMobile ? 8 : 16} style={{ marginBottom: isMobile ? 16 : 24 }}>
                <Col xs={24} md={12}>
                  <Card title="策略收益贡献" loading={loading}>
                    {waterfallData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <ComposedChart data={waterfallData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={100} />
                          <RechartsTooltip />
                          <Legend />
                          <Bar dataKey="value" name="收益贡献" fill="#8884d8" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : <Empty description="暂无策略数据" />}
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card title="交易对分布" loading={loading}>
                    {pieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" labelLine={!isMobile} label={({ name, percent }) => isMobile ? '' : `${name}: ${((percent || 0) * 100).toFixed(0)}%`} outerRadius={isMobile ? 60 : 100} fill="#8884d8" dataKey="value">
                            {pieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                          </Pie>
                          <RechartsTooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <Empty description="暂无交易对数据" />}
                  </Card>
                </Col>
              </Row>

              <Row gutter={isMobile ? 8 : 16} style={{ marginBottom: isMobile ? 16 : 24 }}>
                <Col span={24}>
                  <Card title="策略归因明细" loading={loading} bodyStyle={isMobile ? { padding: 0, overflowX: 'auto' } : undefined}>
                    {report.strategyAttribution?.length > 0 ? (
                      <Table columns={strategyColumns} dataSource={report.strategyAttribution} rowKey="strategyId" pagination={false} size="small" scroll={isMobile ? { x: 900 } : undefined} />
                    ) : <Empty description="暂无策略归因数据" />}
                  </Card>
                </Col>
              </Row>

              <Row gutter={isMobile ? 8 : 16}>
                <Col span={24}>
                  <Card title="交易对归因明细" loading={loading} bodyStyle={isMobile ? { padding: 0, overflowX: 'auto' } : undefined}>
                    {report.symbolAttribution?.length > 0 ? (
                      <Table columns={symbolColumns} dataSource={report.symbolAttribution} rowKey="symbol" pagination={false} size="small" scroll={isMobile ? { x: 800 } : undefined} />
                    ) : <Empty description="暂无交易对归因数据" />}
                  </Card>
                </Col>
              </Row>
            </>
          )}
        </Spin>
      </div>
    </ErrorBoundary>
  );
};

export default AttributionPage;
