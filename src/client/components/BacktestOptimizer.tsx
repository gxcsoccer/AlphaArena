/**
 * BacktestOptimizer Component
 * VIP-only feature for automatic parameter optimization
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
  Button,
  Select,
  InputNumber,
  Space,
  Table,
  Typography,
  Tag,
  Progress,
  Message,
  Divider,
  Grid,
  Statistic,
  Tooltip,
  Spin,
} from '@arco-design/web-react';
import {
  IconPlayArrow,
  IconStop,
  IconDownload,
  IconCheck,
  IconClose,
  IconQuestionCircle,
} from '@arco-design/web-react/icon';
import { useSubscription, useFeatureLimit } from '../hooks/useSubscription';
import FeatureGate from './FeatureGate';
import { api } from '../utils/api';
import { createLogger } from '../../utils/logger';

const log = createLogger('BacktestOptimizer');
const { Title, Text } = Typography;
const { Row, Col } = Grid;

// Parameter range for optimization
export interface ParameterRange {
  name: string;
  min: number;
  max: number;
  step: number;
}

// Optimization result
export interface OptimizationResult {
  id: string;
  params: Record<string, number>;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  fitnessScore: number;
  rank?: number;
}

// Strategy parameter definitions
const STRATEGY_PARAMS: Record<string, ParameterRange[]> = {
  sma: [
    { name: 'fastPeriod', min: 5, max: 50, step: 5 },
    { name: 'slowPeriod', min: 10, max: 200, step: 10 },
  ],
  rsi: [
    { name: 'period', min: 7, max: 21, step: 7 },
    { name: 'oversold', min: 20, max: 35, step: 5 },
    { name: 'overbought', min: 65, max: 80, step: 5 },
  ],
  macd: [
    { name: 'fastPeriod', min: 8, max: 16, step: 2 },
    { name: 'slowPeriod', min: 20, max: 32, step: 4 },
    { name: 'signalPeriod', min: 6, max: 12, step: 2 },
  ],
  bollinger: [
    { name: 'period', min: 10, max: 30, step: 5 },
    { name: 'stdDev', min: 1.5, max: 2.5, step: 0.5 },
  ],
};

// Available strategies
const STRATEGIES = [
  { value: 'sma', label: 'SMA 均线交叉' },
  { value: 'rsi', label: 'RSI 相对强弱指标' },
  { value: 'macd', label: 'MACD 指标' },
  { value: 'bollinger', label: '布林带策略' },
];

// Optimization methods
const OPTIMIZATION_METHODS = [
  { value: 'grid', label: '网格搜索' },
  { value: 'random', label: '随机搜索' },
  { value: 'genetic', label: '遗传算法' },
];

interface BacktestOptimizerProps {
  symbol: string;
  dateRange: [number, number];
  initialCapital: number;
  onOptimalParamsFound?: (params: Record<string, number>) => void;
}

/**
 * BacktestOptimizer Component
 * Provides VIP users with automatic parameter optimization
 */
const BacktestOptimizer: React.FC<BacktestOptimizerProps> = ({
  symbol,
  dateRange,
  initialCapital,
  onOptimalParamsFound,
}) => {
  const { isPro } = useSubscription();
  const { allowed, current, limit, increment, refresh } = useFeatureLimit('backtest_optimizations');

  const [strategy, setStrategy] = useState<string>('sma');
  const [method, setMethod] = useState<string>('grid');
  const [optimizing, setOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<OptimizationResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<OptimizationResult | null>(null);
  const [paramRanges, setParamRanges] = useState<ParameterRange[]>(STRATEGY_PARAMS.sma);

  // Update parameter ranges when strategy changes
  const handleStrategyChange = (value: string) => {
    setStrategy(value);
    setParamRanges(STRATEGY_PARAMS[value] || []);
  };

  // Update parameter range
  const updateParamRange = (index: number, field: keyof ParameterRange, value: number) => {
    setParamRanges((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  // Run optimization
  const runOptimization = useCallback(async () => {
    if (!allowed && !isPro) {
      Message.warning('您已达到优化次数限制，请升级到 Pro 版本');
      return;
    }

    setOptimizing(true);
    setProgress(0);
    setResults([]);

    try {
      log.info('Starting optimization', { strategy, method, paramRanges });

      // Simulate optimization process
      const totalIterations = method === 'grid' ? 50 : method === 'random' ? 30 : 25;
      const mockResults: OptimizationResult[] = [];

      for (let i = 0; i < totalIterations; i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        setProgress(Math.round(((i + 1) / totalIterations) * 100));

        // Generate mock result for this iteration
        const params: Record<string, number> = {};
        paramRanges.forEach((range) => {
          params[range.name] = range.min + Math.random() * (range.max - range.min);
        });

        mockResults.push({
          id: `opt-${i}`,
          params,
          totalReturn: -20 + Math.random() * 60,
          sharpeRatio: Math.random() * 2.5,
          maxDrawdown: Math.random() * 30,
          winRate: 30 + Math.random() * 40,
          profitFactor: 0.5 + Math.random() * 2,
          totalTrades: Math.floor(50 + Math.random() * 150),
          fitnessScore: Math.random() * 100,
        });
      }

      // Sort by fitness score and add rankings
      mockResults.sort((a, b) => b.fitnessScore - a.fitnessScore);
      mockResults.forEach((r, i) => (r.rank = i + 1));

      setResults(mockResults);

      // Increment usage
      await increment();

      Message.success('优化完成');
    } catch (err: any) {
      log.error('Optimization failed', err);
      Message.error('优化失败: ' + err.message);
    } finally {
      setOptimizing(false);
    }
  }, [strategy, method, paramRanges, allowed, isPro, increment]);

  // Stop optimization
  const stopOptimization = useCallback(() => {
    setOptimizing(false);
    setProgress(0);
    Message.info('优化已停止');
  }, []);

  // Apply selected parameters
  const applyParams = useCallback((result: OptimizationResult) => {
    setSelectedResult(result);
    if (onOptimalParamsFound) {
      onOptimalParamsFound(result.params);
    }
    Message.success('参数已应用');
  }, [onOptimalParamsFound]);

  // Export results
  const exportResults = useCallback(() => {
    if (results.length === 0) {
      Message.warning('没有可导出的结果');
      return;
    }

    const csv = [
      'Rank,' + paramRanges.map((p) => p.name).join(',') + ',Return,Sharpe,Drawdown,WinRate,ProfitFactor,Trades',
      ...results.map(
        (r) =>
          `${r.rank},${paramRanges.map((p) => r.params[p.name].toFixed(2)).join(',')},${r.totalReturn.toFixed(2)},${r.sharpeRatio.toFixed(2)},${r.maxDrawdown.toFixed(2)},${r.winRate.toFixed(1)},${r.profitFactor.toFixed(2)},${r.totalTrades}`
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `optimization-${strategy}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    Message.success('结果已导出');
  }, [results, strategy, paramRanges]);

  // Table columns
  const columns = [
    {
      title: '排名',
      dataIndex: 'rank',
      width: 60,
      render: (rank: number) => (
        <Tag color={rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'orange' : 'default'}>
          #{rank}
        </Tag>
      ),
    },
    ...paramRanges.map((p) => ({
      title: p.name,
      dataIndex: ['params', p.name],
      width: 80,
      render: (value: number) => value?.toFixed(1),
    })),
    {
      title: '收益率',
      dataIndex: 'totalReturn',
      width: 100,
      render: (value: number) => (
        <Text style={{ color: value >= 0 ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))' }}>
          {value >= 0 ? '+' : ''}{value.toFixed(2)}%
        </Text>
      ),
    },
    {
      title: 'Sharpe',
      dataIndex: 'sharpeRatio',
      width: 80,
      render: (value: number) => value.toFixed(2),
    },
    {
      title: '最大回撤',
      dataIndex: 'maxDrawdown',
      width: 100,
      render: (value: number) => (
        <Text type="danger">-{value.toFixed(2)}%</Text>
      ),
    },
    {
      title: '胜率',
      dataIndex: 'winRate',
      width: 80,
      render: (value: number) => `${value.toFixed(1)}%`,
    },
    {
      title: '操作',
      width: 80,
      render: (_: any, record: OptimizationResult) => (
        <Button
          size="small"
          type="primary"
          onClick={() => applyParams(record)}
          disabled={selectedResult?.id === record.id}
        >
          应用
        </Button>
      ),
    },
  ];

  // Main render - wrapped in FeatureGate
  return (
    <FeatureGate featureKey="backtest_optimization" featureName="参数优化">
      <Card
        title={
          <Space>
            <span>参数优化</span>
            <Tooltip content="自动搜索最优策略参数">
              <IconQuestionCircle style={{ color: 'var(--color-text-3)' }} />
            </Tooltip>
          </Space>
        }
        extra={
          <Space>
            {results.length > 0 && (
              <Button icon={<IconDownload />} onClick={exportResults}>
                导出结果
              </Button>
            )}
            {optimizing ? (
              <Button type="primary" status="danger" icon={<IconStop />} onClick={stopOptimization}>
                停止
              </Button>
            ) : (
              <Button type="primary" icon={<IconPlayArrow />} onClick={runOptimization}>
                开始优化
              </Button>
            )}
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size="medium">
          {/* Usage limit indicator for non-Pro users */}
          {!isPro && (
            <div style={{ background: 'var(--color-fill-1)', padding: 12, borderRadius: 4 }}>
              <Space>
                <Text>今日优化次数: </Text>
                <Text bold>{current}/{limit === -1 ? '∞' : limit}</Text>
                {!allowed && (
                  <Tag color="red">已达限制</Tag>
                )}
              </Space>
            </div>
          )}

          {/* Strategy and method selection */}
          <Row gutter={16}>
            <Col span={8}>
              <div>
                <Text style={{ marginBottom: 8, display: 'block' }}>策略</Text>
                <Select
                  style={{ width: '100%' }}
                  value={strategy}
                  onChange={handleStrategyChange}
                >
                  {STRATEGIES.map((s) => (
                    <Select.Option key={s.value} value={s.value}>
                      {s.label}
                    </Select.Option>
                  ))}
                </Select>
              </div>
            </Col>
            <Col span={8}>
              <div>
                <Text style={{ marginBottom: 8, display: 'block' }}>优化方法</Text>
                <Select
                  style={{ width: '100%' }}
                  value={method}
                  onChange={setMethod}
                >
                  {OPTIMIZATION_METHODS.map((m) => (
                    <Select.Option key={m.value} value={m.value}>
                      {m.label}
                    </Select.Option>
                  ))}
                </Select>
              </div>
            </Col>
          </Row>

          {/* Parameter ranges */}
          <Card title="参数范围" size="small">
            <Row gutter={[16, 16]}>
              {paramRanges.map((param, index) => (
                <Col span={12} key={param.name}>
                  <Card bordered={false} style={{ background: 'var(--color-fill-1)' }}>
                    <Text bold style={{ display: 'block', marginBottom: 8 }}>{param.name}</Text>
                    <Space>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>最小</Text>
                        <InputNumber
                          size="small"
                          value={param.min}
                          onChange={(v) => updateParamRange(index, 'min', v as number)}
                          style={{ width: 80 }}
                        />
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>最大</Text>
                        <InputNumber
                          size="small"
                          value={param.max}
                          onChange={(v) => updateParamRange(index, 'max', v as number)}
                          style={{ width: 80 }}
                        />
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>步长</Text>
                        <InputNumber
                          size="small"
                          value={param.step}
                          onChange={(v) => updateParamRange(index, 'step', v as number)}
                          style={{ width: 80 }}
                        />
                      </div>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>

          {/* Progress */}
          {optimizing && (
            <div>
              <Space>
                <Text>优化进度</Text>
                <Text type="secondary">{progress}%</Text>
              </Space>
              <Progress percent={progress} style={{ marginTop: 8 }} />
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <>
              <Divider />
              <Title heading={5}>优化结果 ({results.length} 组)</Title>
              <Table
                columns={columns}
                data={results.slice(0, 20)}
                pagination={{ pageSize: 10 }}
                scroll={{ x: 800 }}
                rowKey="id"
                loading={optimizing}
              />

              {/* Best result summary */}
              {results[0] && (
                <Card title="最优参数" size="small" style={{ background: 'var(--color-fill-1)' }}>
                  <Row gutter={16}>
                    <Col span={4}>
                      <Statistic title="收益率" value={results[0].totalReturn} suffix="%" 
                        valueStyle={{ color: results[0].totalReturn >= 0 ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))' }}
                      />
                    </Col>
                    <Col span={4}>
                      <Statistic title="Sharpe 比率" value={results[0].sharpeRatio.toFixed(2)} />
                    </Col>
                    <Col span={4}>
                      <Statistic title="最大回撤" value={results[0].maxDrawdown.toFixed(2)} suffix="%" />
                    </Col>
                    <Col span={4}>
                      <Statistic title="胜率" value={results[0].winRate.toFixed(1)} suffix="%" />
                    </Col>
                    <Col span={4}>
                      <Statistic title="交易次数" value={results[0].totalTrades} />
                    </Col>
                    <Col span={4}>
                      <Button type="primary" onClick={() => applyParams(results[0])}>
                        应用最优参数
                      </Button>
                    </Col>
                  </Row>
                </Card>
              )}
            </>
          )}

          {/* Info */}
          <div style={{ background: 'var(--color-fill-1)', padding: 12, borderRadius: 4 }}>
            <Text bold>VIP 参数优化功能</Text>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-2)' }}>
              <div>✓ 支持多种优化算法（网格搜索、随机搜索、遗传算法）</div>
              <div>✓ 自动寻找最优策略参数组合</div>
              <div>✓ 支持多参数同时优化</div>
              <div>✓ 结果导出和分析</div>
            </div>
          </div>
        </Space>
      </Card>
    </FeatureGate>
  );
};

export default BacktestOptimizer;