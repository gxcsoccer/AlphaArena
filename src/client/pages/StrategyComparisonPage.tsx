/**
 * StrategyComparisonPage - 策略性能比较页面
 *
 * Comprehensive strategy comparison dashboard featuring:
 * - Multi-strategy selection
 * - Side-by-side metrics comparison
 * - Equity curve visualization
 * - Drawdown comparison
 * - Ranking and scoring
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Card,
  Grid,
  Typography,
  Space,
  Button,
  Select,
  DatePicker,
  InputNumber,
  Message,
  Spin,
  Divider,
  Tag,
  Table,
  Statistic,
  Progress,
  Modal,
  Tabs,
  Tooltip,
  Alert,
  Empty,
} from '@arco-design/web-react';
import {
  IconPlayArrow,
  IconDownload,
  IconRefresh,
  IconPlus,
  IconDelete,
  IconTrophy,
  IconArrowRise,
  IconArrowFall,
  IconInfoCircle,
} from '@arco-design/web-react/icon';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area,
} from 'recharts';
import {
  useStrategyComparison,
  AVAILABLE_STRATEGIES,
  AVAILABLE_SYMBOLS,
  StrategyComparisonResult,
  StrategyResult,
  StrategyRanking,
} from '../hooks/useStrategyComparison';
import { createLogger } from '../../utils/logger';

const log = createLogger('StrategyComparisonPage');

const { Title, Text, Paragraph } = Typography;
const { Row, Col } = Grid;
const { RangePicker } = DatePicker;

// Color palette for strategies
const COLORS = ['#165DFF', '#14C9C9', '#F7BA1E', '#722ED1', '#F53F3F'];

/**
 * Strategy selector component
 */
interface StrategySelectorProps {
  selectedStrategies: string[];
  onChange: (strategies: string[]) => void;
  maxStrategies?: number;
}

const StrategySelector: React.FC<StrategySelectorProps> = ({
  selectedStrategies,
  onChange,
  maxStrategies = 5,
}) => {
  const handleSelect = (strategyId: string) => {
    if (selectedStrategies.includes(strategyId)) {
      onChange(selectedStrategies.filter((id) => id !== strategyId));
    } else if (selectedStrategies.length < maxStrategies) {
      onChange([...selectedStrategies, strategyId]);
    } else {
      Message.warning(`最多只能选择 ${maxStrategies} 个策略进行比较`);
    }
  };

  return (
    <Card title="选择策略" extra={<Text type="secondary">已选择 {selectedStrategies.length}/{maxStrategies}</Text>}>
      <Space wrap>
        {AVAILABLE_STRATEGIES.map((strategy) => {
          const isSelected = selectedStrategies.includes(strategy.id);
          return (
            <Tag
              key={strategy.id}
              color={isSelected ? 'arcoblue' : 'gray'}
              style={{
                cursor: 'pointer',
                padding: '8px 16px',
                fontSize: 14,
                opacity: !isSelected && selectedStrategies.length >= maxStrategies ? 0.5 : 1,
              }}
              onClick={() => handleSelect(strategy.id)}
            >
              {strategy.name}
            </Tag>
          );
        })}
      </Space>
      <Divider />
      <Space direction="vertical" style={{ width: '100%' }}>
        {selectedStrategies.map((id, index) => {
          const strategy = AVAILABLE_STRATEGIES.find((s) => s.id === id);
          return (
            <div
              key={id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                background: 'var(--color-fill-1)',
                borderRadius: 4,
              }}
            >
              <Tag color={COLORS[index % COLORS.length]}>#{index + 1}</Tag>
              <Text bold>{strategy?.name}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {strategy?.description}
              </Text>
              <Button
                type="text"
                size="small"
                icon={<IconDelete />}
                onClick={() => onChange(selectedStrategies.filter((s) => s !== id))}
              />
            </div>
          );
        })}
      </Space>
    </Card>
  );
};

/**
 * Metrics table component
 */
interface MetricsTableProps {
  results: StrategyResult[];
  rankings: StrategyRanking[];
}

const MetricsTable: React.FC<MetricsTableProps> = ({ results, rankings }) => {
  const columns = [
    {
      title: '排名',
      dataIndex: 'strategyId',
      key: 'rank',
      width: 80,
      render: (_: any, __: any, index: number) => (
        <Tag color={index === 0 ? 'gold' : index === 1 ? 'silver' : 'gray'}>
          #{index + 1}
        </Tag>
      ),
    },
    {
      title: '策略',
      dataIndex: 'strategyName',
      key: 'strategyName',
      width: 150,
      render: (name: string, _: any, index: number) => (
        <Text bold style={{ color: COLORS[index % COLORS.length] }}>
          {name}
        </Text>
      ),
    },
    {
      title: '总收益率',
      dataIndex: 'stats',
      key: 'totalReturn',
      width: 120,
      render: (stats: any) => (
        <Text style={{ color: stats.totalReturn >= 0 ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))' }}>
          {stats.totalReturn >= 0 ? '+' : ''}{stats.totalReturn.toFixed(2)}%
        </Text>
      ),
      sorter: (a: any, b: any) => a.stats.totalReturn - b.stats.totalReturn,
    },
    {
      title: '年化收益',
      dataIndex: 'stats',
      key: 'annualizedReturn',
      width: 120,
      render: (stats: any) => (
        <Text style={{ color: stats.annualizedReturn >= 0 ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))' }}>
          {stats.annualizedReturn >= 0 ? '+' : ''}{stats.annualizedReturn.toFixed(2)}%
        </Text>
      ),
    },
    {
      title: '夏普比率',
      dataIndex: 'stats',
      key: 'sharpeRatio',
      width: 100,
      render: (stats: any) => (
        <Text style={{ color: stats.sharpeRatio >= 1 ? 'rgb(var(--success-6))' : 'rgb(var(--warning-6))' }}>
          {stats.sharpeRatio.toFixed(2)}
        </Text>
      ),
      sorter: (a: any, b: any) => a.stats.sharpeRatio - b.stats.sharpeRatio,
    },
    {
      title: '最大回撤',
      dataIndex: 'stats',
      key: 'maxDrawdown',
      width: 100,
      render: (stats: any) => (
        <Text style={{ color: 'rgb(var(--danger-6))' }}>
          -{stats.maxDrawdown.toFixed(2)}%
        </Text>
      ),
      sorter: (a: any, b: any) => a.stats.maxDrawdown - b.stats.maxDrawdown,
    },
    {
      title: '胜率',
      dataIndex: 'stats',
      key: 'winRate',
      width: 80,
      render: (stats: any) => (
        <Text style={{ color: stats.winRate >= 50 ? 'rgb(var(--success-6))' : 'rgb(var(--warning-6))' }}>
          {stats.winRate.toFixed(1)}%
        </Text>
      ),
    },
    {
      title: '盈亏比',
      dataIndex: 'stats',
      key: 'profitFactor',
      width: 80,
      render: (stats: any) => (
        <Text style={{ color: stats.profitFactor >= 1 ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))' }}>
          {stats.profitFactor.toFixed(2)}
        </Text>
      ),
    },
    {
      title: '交易次数',
      dataIndex: 'stats',
      key: 'totalTrades',
      width: 80,
      render: (stats: any) => <Text>{stats.totalTrades}</Text>,
    },
  ];

  return (
    <Card title="绩效指标对比">
      <Table
        columns={columns}
        data={results}
        rowKey="strategyId"
        pagination={false}
        scroll={{ x: 900 }}
      />
    </Card>
  );
};

/**
 * Equity curve comparison chart
 */
interface EquityCurveChartProps {
  results: StrategyResult[];
}

const EquityCurveComparisonChart: React.FC<EquityCurveChartProps> = ({ results }) => {
  const chartData = useMemo(() => {
    if (!results || results.length === 0) return [];

    // Get all timestamps from the first strategy's equity curve
    const timestamps = results[0]?.equityCurve.map((p) => p.timestamp) || [];

    return timestamps.map((timestamp, index) => {
      const point: any = {
        timestamp,
        date: new Date(timestamp).toLocaleDateString(),
      };

      results.forEach((result) => {
        const equityPoint = result.equityCurve.find((p) => p.timestamp === timestamp);
        if (equityPoint) {
          point[result.strategyName] = equityPoint.equity;
          point[`${result.strategyName}_return`] = equityPoint.return;
        }
      });

      return point;
    });
  }, [results]);

  if (!results || results.length === 0) {
    return <Empty description="暂无数据" />;
  }

  return (
    <Card title="权益曲线对比">
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            stroke="var(--color-text-3)"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis stroke="var(--color-text-3)" />
          <ChartTooltip
            contentStyle={{
              background: 'var(--color-bg-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
            }}
            formatter={(value: any) => [`$${value.toFixed(2)}`, '']}
          />
          <Legend />
          {results.map((result, index) => (
            <Area
              key={result.strategyId}
              type="monotone"
              dataKey={result.strategyName}
              stroke={COLORS[index % COLORS.length]}
              fill={COLORS[index % COLORS.length]}
              fillOpacity={0.1}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
};

/**
 * Drawdown comparison chart
 */
interface DrawdownChartProps {
  results: StrategyResult[];
}

const DrawdownComparisonChart: React.FC<DrawdownChartProps> = ({ results }) => {
  const chartData = useMemo(() => {
    if (!results || results.length === 0) return [];

    const timestamps = results[0]?.drawdownCurve.map((p) => p.timestamp) || [];

    return timestamps.map((timestamp) => {
      const point: any = {
        timestamp,
        date: new Date(timestamp).toLocaleDateString(),
      };

      results.forEach((result) => {
        const ddPoint = result.drawdownCurve.find((p) => p.timestamp === timestamp);
        if (ddPoint) {
          point[result.strategyName] = ddPoint.drawdown;
        }
      });

      return point;
    });
  }, [results]);

  if (!results || results.length === 0) {
    return <Empty description="暂无数据" />;
  }

  return (
    <Card title="回撤对比">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="date" stroke="var(--color-text-3)" tick={{ fontSize: 11 }} />
          <YAxis stroke="var(--color-text-3)" />
          <ChartTooltip
            contentStyle={{
              background: 'var(--color-bg-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
            }}
            formatter={(value: any) => [`${value.toFixed(2)}%`, '']}
          />
          <Legend />
          {results.map((result, index) => (
            <Line
              key={result.strategyId}
              type="monotone"
              dataKey={result.strategyName}
              stroke={COLORS[index % COLORS.length]}
              dot={false}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
};

/**
 * Radar comparison chart
 */
interface RadarComparisonProps {
  results: StrategyResult[];
}

const RadarComparison: React.FC<RadarComparisonProps> = ({ results }) => {
  const radarData = useMemo(() => {
    if (!results || results.length === 0) return [];

    // Normalize metrics to 0-100 scale
    const maxValues = {
      totalReturn: Math.max(...results.map((s) => Math.abs(s.stats.totalReturn))) || 1,
      sharpeRatio: Math.max(...results.map((s) => Math.abs(s.stats.sharpeRatio))) || 1,
      winRate: 100,
      maxDrawdown: Math.max(...results.map((s) => s.stats.maxDrawdown)) || 1,
      profitFactor: Math.max(...results.map((s) => s.stats.profitFactor)) || 1,
    };

    return [
      {
        metric: '收益率',
        ...Object.fromEntries(
          results.map((s) => [s.strategyName, (Math.abs(s.stats.totalReturn) / maxValues.totalReturn) * 100])
        ),
      },
      {
        metric: '夏普比',
        ...Object.fromEntries(
          results.map((s) => [s.strategyName, (Math.abs(s.stats.sharpeRatio) / maxValues.sharpeRatio) * 100])
        ),
      },
      {
        metric: '胜率',
        ...Object.fromEntries(results.map((s) => [s.strategyName, s.stats.winRate])),
      },
      {
        metric: '回撤控制',
        ...Object.fromEntries(
          results.map((s) => [
            s.strategyName,
            100 - (s.stats.maxDrawdown / maxValues.maxDrawdown) * 100,
          ])
        ),
      },
      {
        metric: '盈亏比',
        ...Object.fromEntries(
          results.map((s) => [s.strategyName, (s.stats.profitFactor / maxValues.profitFactor) * 100])
        ),
      },
    ];
  }, [results]);

  if (!results || results.length === 0) {
    return <Empty description="暂无数据" />;
  }

  return (
    <Card title="多维度对比（雷达图）">
      <ResponsiveContainer width="100%" height={350}>
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
          <PolarGrid stroke="var(--color-border)" />
          <PolarAngleAxis dataKey="metric" stroke="var(--color-text-3)" />
          <PolarRadiusAxis stroke="var(--color-text-3)" />
          {results.map((result, index) => (
            <Radar
              key={result.strategyId}
              name={result.strategyName}
              dataKey={result.strategyName}
              stroke={COLORS[index % COLORS.length]}
              fill={COLORS[index % COLORS.length]}
              fillOpacity={0.3}
            />
          ))}
          <Legend />
          <ChartTooltip />
        </RadarChart>
      </ResponsiveContainer>
    </Card>
  );
};

/**
 * Ranking card component
 */
interface RankingCardProps {
  rankings: StrategyRanking[];
}

const RankingCard: React.FC<RankingCardProps> = ({ rankings }) => {
  if (!rankings || rankings.length === 0) {
    return <Empty description="暂无排名数据" />;
  }

  return (
    <Card title={<><IconTrophy /> 策略排名</>} extra={<Text type="secondary">综合评分</Text>}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {rankings.map((ranking, index) => (
          <div
            key={ranking.strategyId}
            style={{
              padding: 16,
              background: index === 0 ? 'rgb(var(--warning-1))' : 'var(--color-fill-1)',
              borderRadius: 8,
              border: index === 0 ? '2px solid rgb(var(--warning-6))' : '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <Tag color={COLORS[index % COLORS.length]} style={{ fontSize: 16, padding: '4px 12px' }}>
                  #{ranking.overallRank}
                </Tag>
                <Text bold style={{ fontSize: 16 }}>{ranking.strategyName}</Text>
              </Space>
              <Progress
                percent={ranking.compositeScore}
                style={{ width: 200 }}
                status={ranking.compositeScore >= 70 ? 'success' : 'normal'}
              />
            </div>
            <Divider style={{ margin: '12px 0' }} />
            <Row gutter={16}>
              <Col span={4}>
                <Statistic title="收益排名" value={ranking.metricRanks.totalReturn} suffix={`/ ${rankings.length}`} />
              </Col>
              <Col span={4}>
                <Statistic title="夏普排名" value={ranking.metricRanks.sharpeRatio} suffix={`/ ${rankings.length}`} />
              </Col>
              <Col span={4}>
                <Statistic title="回撤排名" value={ranking.metricRanks.maxDrawdown} suffix={`/ ${rankings.length}`} />
              </Col>
              <Col span={4}>
                <Statistic title="胜率排名" value={ranking.metricRanks.winRate} suffix={`/ ${rankings.length}`} />
              </Col>
              <Col span={4}>
                <Statistic title="盈亏比排名" value={ranking.metricRanks.profitFactor} suffix={`/ ${rankings.length}`} />
              </Col>
              <Col span={4}>
                <Statistic title="综合得分" value={ranking.compositeScore.toFixed(1)} suffix="分" />
              </Col>
            </Row>
          </div>
        ))}
      </Space>
    </Card>
  );
};

/**
 * Main Strategy Comparison Page
 */
const StrategyComparisonPage: React.FC = () => {
  // State
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const [capital, setCapital] = useState<number>(10000);
  const [symbol, setSymbol] = useState<string>('BTC/USDT');
  const [dateRange, setDateRange] = useState<[number, number]>([
    Date.now() - 90 * 24 * 60 * 60 * 1000, // 90 days ago
    Date.now(),
  ]);

  // Hook
  const {
    loading,
    error,
    result,
    compareStrategies,
    clearResult,
    exportToCSV,
  } = useStrategyComparison();

  // Handlers
  const handleCompare = useCallback(async () => {
    if (selectedStrategies.length < 2) {
      Message.warning('请至少选择 2 个策略进行比较');
      return;
    }

    const strategies = selectedStrategies.map((id) => {
      const strategy = AVAILABLE_STRATEGIES.find((s) => s.id === id);
      return {
        id,
        name: strategy?.name || id,
      };
    });

    await compareStrategies({
      capital,
      symbol,
      startTime: dateRange[0],
      endTime: dateRange[1],
      strategies,
    });
  }, [selectedStrategies, capital, symbol, dateRange, compareStrategies]);

  const handleExport = useCallback(() => {
    const csv = exportToCSV();
    if (csv) {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `strategy-comparison-${Date.now()}.csv`;
      link.click();
      Message.success('导出成功');
    }
  }, [exportToCSV]);

  return (
    <div style={{ padding: 24 }}>
      <Title heading={4}>策略性能比较工具</Title>
      <Paragraph type="secondary">
        选择多个策略进行对比分析，查看不同策略在同一时间段的表现差异，帮助您选择最适合的交易策略。
      </Paragraph>

      <Divider />

      {/* Configuration Section */}
      <Row gutter={[24, 24]}>
        <Col span={16}>
          <StrategySelector
            selectedStrategies={selectedStrategies}
            onChange={setSelectedStrategies}
            maxStrategies={5}
          />
        </Col>
        <Col span={8}>
          <Card title="比较配置">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text type="secondary">初始资金</Text>
                <InputNumber
                  value={capital}
                  onChange={setCapital}
                  min={100}
                  max={10000000}
                  step={1000}
                  style={{ width: '100%', marginTop: 8 }}
                  prefix="$"
                />
              </div>

              <div>
                <Text type="secondary">交易对</Text>
                <Select
                  value={symbol}
                  onChange={setSymbol}
                  style={{ width: '100%', marginTop: 8 }}
                >
                  {AVAILABLE_SYMBOLS.map((s) => (
                    <Select.Option key={s.id} value={s.id}>
                      {s.id} - {s.name}
                    </Select.Option>
                  ))}
                </Select>
              </div>

              <div>
                <Text type="secondary">回测时间段</Text>
                <RangePicker
                  style={{ width: '100%', marginTop: 8 }}
                  value={dateRange as any}
                  onChange={(val) => val && setDateRange(val as [number, number])}
                />
              </div>

              <Divider style={{ margin: '12px 0' }} />

              <Space style={{ width: '100%' }}>
                <Button
                  type="primary"
                  icon={<IconPlayArrow />}
                  loading={loading}
                  onClick={handleCompare}
                  disabled={selectedStrategies.length < 2}
                >
                  开始比较
                </Button>
                <Button
                  icon={<IconRefresh />}
                  onClick={clearResult}
                  disabled={!result}
                >
                  重置
                </Button>
                {result && (
                  <Button
                    icon={<IconDownload />}
                    onClick={handleExport}
                  >
                    导出 CSV
                  </Button>
                )}
              </Space>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Error Alert */}
      {error && (
        <Alert
          type="error"
          message="比较执行失败"
          description={error}
          style={{ marginTop: 24 }}
          closable
          onClose={() => clearResult()}
        />
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400, marginTop: 24 }}>
          <Spin size={40} tip="正在执行策略比较..." />
        </div>
      )}

      {/* Results Section */}
      {result && !loading && (
        <div style={{ marginTop: 24 }}>
          <Divider>
            <Text type="secondary">
              比较完成 · 耗时 {(result.executionTime / 1000).toFixed(2)}s
            </Text>
          </Divider>

          <Row gutter={[24, 24]}>
            <Col span={24}>
              <RankingCard rankings={result.rankings} />
            </Col>

            <Col span={24}>
              <MetricsTable results={result.results} rankings={result.rankings} />
            </Col>

            <Col span={24}>
              <EquityCurveComparisonChart results={result.results} />
            </Col>

            <Col span={12}>
              <DrawdownComparisonChart results={result.results} />
            </Col>

            <Col span={12}>
              <RadarComparison results={result.results} />
            </Col>
          </Row>
        </div>
      )}
    </div>
  );
};

export default StrategyComparisonPage;
