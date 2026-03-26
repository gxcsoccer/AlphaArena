/**
 * MultiStrategyComparison Component
 * VIP-only feature for comparing multiple backtest strategies
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
  Button,
  Select,
  Space,
  Table,
  Typography,
  Tag,
  Message,
  Divider,
  Grid,
  Statistic,
  Empty,
  Spin,
} from '@arco-design/web-react';
import {
  IconPlus,
  IconDelete,
  IconPlayArrow,
  IconDownload,
  IconCode,
} from '@arco-design/web-react/icon';
import { useSubscription } from '../hooks/useSubscription';
import FeatureGate from './FeatureGate';
import { StrategyComparisonChart, StrategyMetrics } from './StrategyComparisonChart';
import { createLogger } from '../../utils/logger';

const log = createLogger('MultiStrategyComparison');
const { Title, Text } = Typography;
const { Row, Col } = Grid;

// Available strategies
const AVAILABLE_STRATEGIES = [
  { value: 'sma', label: 'SMA 均线交叉' },
  { value: 'rsi', label: 'RSI 相对强弱指标' },
  { value: 'macd', label: 'MACD 指标' },
  { value: 'bollinger', label: '布林带策略' },
];

// Available symbols
const AVAILABLE_SYMBOLS = [
  { value: 'BTC/USDT', label: 'BTC/USDT' },
  { value: 'ETH/USDT', label: 'ETH/USDT' },
  { value: 'AAPL', label: 'AAPL' },
];

interface StrategyComparisonConfig {
  id: string;
  strategy: string;
  symbol: string;
  params: Record<string, number>;
  color: string;
}

interface StrategyResult extends StrategyMetrics {
  configId: string;
}

interface MultiStrategyComparisonProps {
  dateRange: [number, number];
  initialCapital: number;
  maxStrategies?: number;
  onCompareComplete?: (results: StrategyResult[]) => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

/**
 * MultiStrategyComparison Component
 * Provides VIP users with multi-strategy comparison
 */
const MultiStrategyComparison: React.FC<MultiStrategyComparisonProps> = ({
  dateRange,
  initialCapital,
  maxStrategies = 4,
  onCompareComplete,
}) => {
  const { isPro } = useSubscription();
  const [configs, setConfigs] = useState<StrategyComparisonConfig[]>([
    { id: '1', strategy: 'sma', symbol: 'BTC/USDT', params: {}, color: COLORS[0] },
    { id: '2', strategy: 'rsi', symbol: 'BTC/USDT', params: {}, color: COLORS[1] },
  ]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<StrategyResult[]>([]);

  // Add new strategy config
  const addConfig = useCallback(() => {
    if (configs.length >= maxStrategies) {
      Message.warning(`最多只能比较 ${maxStrategies} 个策略`);
      return;
    }

    const newConfig: StrategyComparisonConfig = {
      id: `config-${Date.now()}`,
      strategy: AVAILABLE_STRATEGIES[configs.length % AVAILABLE_STRATEGIES.length].value,
      symbol: 'BTC/USDT',
      params: {},
      color: COLORS[configs.length % COLORS.length],
    };

    setConfigs([...configs, newConfig]);
  }, [configs, maxStrategies]);

  // Remove strategy config
  const removeConfig = useCallback((id: string) => {
    if (configs.length <= 2) {
      Message.warning('至少需要保留 2 个策略进行比较');
      return;
    }
    setConfigs(configs.filter((c) => c.id !== id));
  }, [configs]);

  // Update strategy config
  const updateConfig = useCallback((id: string, field: keyof StrategyComparisonConfig, value: any) => {
    setConfigs(
      configs.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  }, [configs]);

  // Run comparison
  const runComparison = useCallback(async () => {
    if (configs.length < 2) {
      Message.warning('至少需要 2 个策略进行比较');
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      log.info('Running strategy comparison', { configs });

      // Simulate comparison - in production would call API
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const mockResults: StrategyResult[] = configs.map((config, index) => ({
        configId: config.id,
        id: config.id,
        name: `${config.strategy.toUpperCase()}-${config.symbol}`,
        totalReturn: -20 + Math.random() * 60,
        annualizedReturn: -30 + Math.random() * 80,
        sharpeRatio: Math.random() * 2.5,
        maxDrawdown: Math.random() * 30,
        winRate: 30 + Math.random() * 40,
        profitFactor: 0.5 + Math.random() * 2,
        totalTrades: Math.floor(50 + Math.random() * 150),
        avgReturn: Math.random() * 2 - 0.5,
      }));

      setResults(mockResults);

      if (onCompareComplete) {
        onCompareComplete(mockResults);
      }

      Message.success('对比完成');
    } catch (err: any) {
      log.error('Comparison failed', err);
      Message.error('对比失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [configs, onCompareComplete]);

  // Export comparison results
  const exportResults = useCallback(() => {
    if (results.length === 0) {
      Message.warning('没有可导出的结果');
      return;
    }

    const csv = [
      'Strategy,Symbol,Return,AnnualReturn,Sharpe,Drawdown,WinRate,ProfitFactor,Trades',
      ...results.map(
        (r) =>
          `${r.name},${configs.find((c) => c.id === r.configId)?.symbol},${r.totalReturn.toFixed(2)},${r.annualizedReturn.toFixed(2)},${r.sharpeRatio.toFixed(2)},${r.maxDrawdown.toFixed(2)},${r.winRate.toFixed(1)},${r.profitFactor.toFixed(2)},${r.totalTrades}`
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `strategy-comparison-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    Message.success('结果已导出');
  }, [results, configs]);

  // Summary statistics
  const summary = useMemo(() => {
    if (results.length === 0) return null;

    const best = results.reduce((a, b) => (a.totalReturn > b.totalReturn ? a : b));
    const worst = results.reduce((a, b) => (a.totalReturn < b.totalReturn ? a : b));
    const avgReturn = results.reduce((sum, r) => sum + r.totalReturn, 0) / results.length;
    const avgSharpe = results.reduce((sum, r) => sum + r.sharpeRatio, 0) / results.length;

    return { best, worst, avgReturn, avgSharpe };
  }, [results]);

  // Comparison table columns
  const columns = [
    {
      title: '策略',
      dataIndex: 'name',
      render: (name: string, record: StrategyResult) => {
        const config = configs.find((c) => c.id === record.configId);
        return (
          <Space>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: config?.color || '#888',
              }}
            />
            <Text bold>{name}</Text>
          </Space>
        );
      },
    },
    {
      title: '收益率',
      dataIndex: 'totalReturn',
      sorter: (a: StrategyResult, b: StrategyResult) => a.totalReturn - b.totalReturn,
      render: (value: number) => (
        <Text style={{ color: value >= 0 ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))' }}>
          {value >= 0 ? '+' : ''}{value.toFixed(2)}%
        </Text>
      ),
    },
    {
      title: '年化收益',
      dataIndex: 'annualizedReturn',
      sorter: (a: StrategyResult, b: StrategyResult) => a.annualizedReturn - b.annualizedReturn,
      render: (value: number) => (
        <Text style={{ color: value >= 0 ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))' }}>
          {value >= 0 ? '+' : ''}{value.toFixed(2)}%
        </Text>
      ),
    },
    {
      title: 'Sharpe',
      dataIndex: 'sharpeRatio',
      sorter: (a: StrategyResult, b: StrategyResult) => a.sharpeRatio - b.sharpeRatio,
      render: (value: number) => value.toFixed(2),
    },
    {
      title: '最大回撤',
      dataIndex: 'maxDrawdown',
      sorter: (a: StrategyResult, b: StrategyResult) => a.maxDrawdown - b.maxDrawdown,
      render: (value: number) => (
        <Text type="danger">-{value.toFixed(2)}%</Text>
      ),
    },
    {
      title: '胜率',
      dataIndex: 'winRate',
      sorter: (a: StrategyResult, b: StrategyResult) => a.winRate - b.winRate,
      render: (value: number) => `${value.toFixed(1)}%`,
    },
    {
      title: '交易次数',
      dataIndex: 'totalTrades',
      render: (value: number) => value,
    },
  ];

  return (
    <FeatureGate featureKey="multi_strategy_comparison" featureName="多策略对比">
      <Card
        title={
          <Space>
            <IconCode />
            <span>多策略对比</span>
          </Space>
        }
        extra={
          <Space>
            {results.length > 0 && (
              <Button icon={<IconDownload />} onClick={exportResults}>
                导出结果
              </Button>
            )}
            <Button
              type="primary"
              icon={<IconPlayArrow />}
              loading={loading}
              onClick={runComparison}
            >
              开始对比
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size="medium">
          {/* Strategy configs */}
          <div>
            <Space style={{ marginBottom: 8 }}>
              <Text bold>选择策略对比</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                (已选 {configs.length}/{maxStrategies})
              </Text>
            </Space>
            <Row gutter={[16, 16]}>
              {configs.map((config) => (
                <Col span={12} key={config.id}>
                  <Card
                    size="small"
                    style={{ borderLeft: `4px solid ${config.color}` }}
                    extra={
                      <Button
                        size="small"
                        icon={<IconDelete />}
                        status="danger"
                        onClick={() => removeConfig(config.id)}
                      />
                    }
                  >
                    <Space direction="vertical" style={{ width: '100%' }} size="small">
                      <div>
                        <Text type="secondary" style={{ marginRight: 8 }}>策略:</Text>
                        <Select
                          size="small"
                          style={{ width: 150 }}
                          value={config.strategy}
                          onChange={(v) => updateConfig(config.id, 'strategy', v)}
                        >
                          {AVAILABLE_STRATEGIES.map((s) => (
                            <Select.Option key={s.value} value={s.value}>
                              {s.label}
                            </Select.Option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <Text type="secondary" style={{ marginRight: 8 }}>交易对:</Text>
                        <Select
                          size="small"
                          style={{ width: 150 }}
                          value={config.symbol}
                          onChange={(v) => updateConfig(config.id, 'symbol', v)}
                        >
                          {AVAILABLE_SYMBOLS.map((s) => (
                            <Select.Option key={s.value} value={s.value}>
                              {s.label}
                            </Select.Option>
                          ))}
                        </Select>
                      </div>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
            {configs.length < maxStrategies && (
              <Button
                type="dashed"
                icon={<IconPlus />}
                onClick={addConfig}
                style={{ marginTop: 8, width: '100%' }}
              >
                添加策略
              </Button>
            )}
          </div>

          <Divider />

          {/* Loading state */}
          {loading && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin size={32} />
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">正在对比策略...</Text>
              </div>
            </div>
          )}

          {/* Results */}
          {!loading && results.length > 0 && (
            <>
              {/* Summary */}
              {summary && (
                <Row gutter={16}>
                  <Col span={6}>
                    <Statistic
                      title="最佳策略"
                      value={summary.best.name}
                      suffix={`(${summary.best.totalReturn >= 0 ? '+' : ''}${summary.best.totalReturn.toFixed(2)}%)`}
                      valueStyle={{ fontSize: 14 }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="平均收益率"
                      value={summary.avgReturn.toFixed(2)}
                      suffix="%"
                      valueStyle={{ color: summary.avgReturn >= 0 ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="平均 Sharpe"
                      value={summary.avgSharpe.toFixed(2)}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="对比数量"
                      value={results.length}
                      suffix="个策略"
                    />
                  </Col>
                </Row>
              )}

              {/* Chart */}
              <StrategyComparisonChart
                strategies={results}
                height={400}
                title="策略性能对比图"
              />

              {/* Table */}
              <Table
                columns={columns}
                data={results}
                pagination={false}
                rowKey="id"
                scroll={{ x: 800 }}
              />
            </>
          )}

          {/* Empty state */}
          {!loading && results.length === 0 && (
            <Empty description="选择策略后点击「开始对比」按钮" />
          )}

          {/* Info */}
          <div style={{ background: 'var(--color-fill-1)', padding: 12, borderRadius: 4 }}>
            <Text bold>VIP 多策略对比功能</Text>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-2)' }}>
              <div>✓ 同时比较最多 {maxStrategies} 个策略</div>
              <div>✓ 可视化性能对比图表</div>
              <div>✓ 详细的统计指标对比</div>
              <div>✓ 导出对比结果</div>
            </div>
          </div>
        </Space>
      </Card>
    </FeatureGate>
  );
};

export default MultiStrategyComparison;