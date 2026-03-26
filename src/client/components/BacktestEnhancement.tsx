/**
 * Backtest Enhancement Component
 * VIP-only features: parameter optimization, strategy comparison, export
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Card,
  Button,
  Form,
  InputNumber,
  Select,
  Table,
  Space,
  Tag,
  Message,
  Progress,
  Typography,
  Divider,
  Modal,
  Descriptions,
  Spin,
  Tabs,
} from '@arco-design/web-react';
import {
  IconPlayArrow,
  IconDownload,
  IconCompare,
  IconExperiment,
  IconHistory,
  IconRefresh,
} from '@arco-design/web-react/icon';
import { useSubscription } from '../hooks/useSubscription';
import FeatureGate from './FeatureGate';
import { api } from '../utils/api';
import { createLogger } from '../../utils/logger';

const log = createLogger('BacktestEnhancement');
const { Title, Text } = Typography;
const { TabPane } = Tabs;

// Types
interface OptimizationParameter {
  name: string;
  min: number;
  max: number;
  step: number;
  value: number;
}

interface OptimizationResult {
  params: Record<string, number>;
  metrics: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
  };
}

interface BacktestHistoryRecord {
  id: string;
  strategyName: string;
  symbol: string;
  params: Record<string, any>;
  result: OptimizationResult['metrics'];
  createdAt: string;
}

interface BacktestEnhancementProps {
  strategyId: string;
  symbol: string;
  onOptimizationComplete?: (result: OptimizationResult) => void;
}

/**
 * Parameter Optimization Component
 * Automatically finds optimal strategy parameters
 */
const ParameterOptimization: React.FC<{
  strategyId: string;
  symbol: string;
  onOptimizationComplete?: (result: OptimizationResult) => void;
}> = ({ strategyId, symbol, onOptimizationComplete }) => {
  const [parameters, setParameters] = useState<OptimizationParameter[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<OptimizationResult[]>([]);
  const [bestResult, setBestResult] = useState<OptimizationResult | null>(null);

  // Add a new parameter to optimize
  const addParameter = useCallback(() => {
    setParameters((prev) => [
      ...prev,
      { name: `param_${prev.length}`, min: 1, max: 100, step: 1, value: 10 },
    ]);
  }, []);

  // Remove a parameter
  const removeParameter = useCallback((index: number) => {
    setParameters((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Update parameter value
  const updateParameter = useCallback((index: number, field: keyof OptimizationParameter, value: number) => {
    setParameters((prev) =>
      prev.map((param, i) => (i === index ? { ...param, [field]: value } : param))
    );
  }, []);

  // Run optimization
  const runOptimization = useCallback(async () => {
    if (parameters.length === 0) {
      Message.warning('请至少添加一个参数进行优化');
      return;
    }

    setOptimizing(true);
    setProgress(0);
    setResults([]);
    setBestResult(null);

    try {
      // Simulated optimization process (in real implementation, call backend API)
      const totalIterations = parameters.reduce((acc, p) => acc + Math.ceil((p.max - p.min) / p.step), 1);
      let currentIteration = 0;
      const tempResults: OptimizationResult[] = [];

      // This is a simulation - in production, this would call a backend API
      for (const param of parameters) {
        for (let value = param.min; value <= param.max; value += param.step) {
          // Simulate API call to run backtest with this parameter value
          const result: OptimizationResult = {
            params: { [param.name]: value },
            metrics: {
              totalReturn: Math.random() * 100 - 20, // -20% to 80%
              sharpeRatio: Math.random() * 3,
              maxDrawdown: Math.random() * 50,
              winRate: 40 + Math.random() * 30,
              profitFactor: 0.5 + Math.random() * 2,
            },
          };

          tempResults.push(result);
          currentIteration++;
          setProgress(Math.round((currentIteration / totalIterations) * 100));

          // Simulate delay
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      setResults(tempResults);

      // Find best result by Sharpe Ratio
      const best = tempResults.reduce((a, b) =>
        a.metrics.sharpeRatio > b.metrics.sharpeRatio ? a : b
      );
      setBestResult(best);

      Message.success('参数优化完成');
      if (onOptimizationComplete) {
        onOptimizationComplete(best);
      }
    } catch (error: any) {
      log.error('Optimization failed:', error);
      Message.error('优化失败: ' + error.message);
    } finally {
      setOptimizing(false);
    }
  }, [parameters, onOptimizationComplete]);

  // Export optimization results
  const exportResults = useCallback(() => {
    if (results.length === 0) {
      Message.warning('暂无结果可导出');
      return;
    }

    const csv = [
      '参数,总收益率,夏普比率,最大回撤,胜率,盈亏比',
      ...results.map(
        (r) =>
          `${JSON.stringify(r.params)},${r.metrics.totalReturn.toFixed(2)}%,${r.metrics.sharpeRatio.toFixed(2)},${r.metrics.maxDrawdown.toFixed(2)}%,${r.metrics.winRate.toFixed(1)}%,${r.metrics.profitFactor.toFixed(2)}`
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `optimization_${strategyId}_${symbol}_${Date.now()}.csv`;
    link.click();

    Message.success('结果已导出');
  }, [results, strategyId, symbol]);

  return (
    <Card title="参数优化" extra={<Button icon={<IconPlayArrow />} onClick={runOptimization} loading={optimizing} type="primary" disabled={parameters.length === 0}>开始优化</Button>}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Parameter configuration */}
        <div>
          <Text bold>优化参数配置</Text>
          <Text type="secondary" style={{ marginLeft: 8 }}>
            添加并配置要优化的参数范围
          </Text>
          <Button
            size="small"
            icon={<IconExperiment />}
            onClick={addParameter}
            style={{ marginLeft: 16 }}
          >
            添加参数
          </Button>
        </div>

        {parameters.length > 0 ? (
          <Table
            data={parameters}
            columns={[
              {
                title: '参数名称',
                dataIndex: 'name',
                render: (name, _, index) => (
                  <Select
                    value={name}
                    onChange={(v) => updateParameter(index, 'name', v as any)}
                    style={{ width: 150 }}
                  >
                    <Select.Option value="period">周期</Select.Option>
                    <Select.Option value="fastPeriod">快线周期</Select.Option>
                    <Select.Option value="slowPeriod">慢线周期</Select.Option>
                    <Select.Option value="stdDev">标准差</Select.Option>
                    <Select.Option value="stopLoss">止损比例</Select.Option>
                    <Select.Option value="takeProfit">止盈比例</Select.Option>
                  </Select>
                ),
              },
              {
                title: '最小值',
                dataIndex: 'min',
                render: (v, _, index) => (
                  <InputNumber
                    value={v}
                    onChange={(v) => updateParameter(index, 'min', v as number)}
                    min={0}
                    max={1000}
                  />
                ),
              },
              {
                title: '最大值',
                dataIndex: 'max',
                render: (v, _, index) => (
                  <InputNumber
                    value={v}
                    onChange={(v) => updateParameter(index, 'max', v as number)}
                    min={0}
                    max={1000}
                  />
                ),
              },
              {
                title: '步长',
                dataIndex: 'step',
                render: (v, _, index) => (
                  <InputNumber
                    value={v}
                    onChange={(v) => updateParameter(index, 'step', v as number)}
                    min={0.1}
                    max={100}
                  />
                ),
              },
              {
                title: '操作',
                render: (_, __, index) => (
                  <Button
                    size="small"
                    icon={<IconDelete />}
                    status="danger"
                    onClick={() => removeParameter(index)}
                  />
                ),
              },
            ]}
            pagination={false}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-3)' }}>
            暂无优化参数，点击上方"添加参数"按钮开始配置
          </div>
        )}

        {/* Optimization progress */}
        {optimizing && (
          <div>
            <Text>优化进度</Text>
            <Progress percent={progress} style={{ marginTop: 8 }} />
          </div>
        )}

        {/* Best result */}
        {bestResult && (
          <div>
            <Text bold>最佳参数组合</Text>
            <Descriptions
              column={2}
              data={[
                { label: '参数值', value: JSON.stringify(bestResult.params) },
                { label: '总收益率', value: `${bestResult.metrics.totalReturn.toFixed(2)}%` },
                { label: '夏普比率', value: bestResult.metrics.sharpeRatio.toFixed(2) },
                { label: '最大回撤', value: `${bestResult.metrics.maxDrawdown.toFixed(2)}%` },
                { label: '胜率', value: `${bestResult.metrics.winRate.toFixed(1)}%` },
                { label: '盈亏比', value: bestResult.metrics.profitFactor.toFixed(2) },
              ]}
              style={{ marginTop: 16 }}
            />
          </div>
        )}

        {/* Results table */}
        {results.length > 0 && (
          <div>
            <Space>
              <Text bold>所有优化结果</Text>
              <Button size="small" icon={<IconDownload />} onClick={exportResults}>
                导出 CSV
              </Button>
            </Space>
            <Table
              data={results.slice(0, 10)}
              columns={[
                { title: '参数', dataIndex: 'params', render: (p) => JSON.stringify(p) },
                { title: '总收益率', dataIndex: ['metrics', 'totalReturn'], render: (v) => `${v.toFixed(2)}%` },
                { title: '夏普比率', dataIndex: ['metrics', 'sharpeRatio'], render: (v) => v.toFixed(2) },
                { title: '最大回撤', dataIndex: ['metrics', 'maxDrawdown'], render: (v) => `${v.toFixed(2)}%` },
                { title: '胜率', dataIndex: ['metrics', 'winRate'], render: (v) => `${v.toFixed(1)}%` },
              ]}
              pagination={{ pageSize: 10 }}
              style={{ marginTop: 16 }}
            />
          </div>
        )}
      </Space>
    </Card>
  );
};

/**
 * Backtest History Component
 * Saves and loads historical backtest records
 */
const BacktestHistory: React.FC<{ strategyId: string }> = ({ strategyId }) => {
  const [history, setHistory] = useState<BacktestHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Load history from localStorage (in production, use backend API)
  useEffect(() => {
    setLoading(true);
    try {
      const savedHistory = localStorage.getItem(`backtest_history_${strategyId}`);
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      log.error('Failed to load backtest history:', error);
    } finally {
      setLoading(false);
    }
  }, [strategyId]);

  // Clear history
  const clearHistory = useCallback(() => {
    Modal.confirm({
      title: '确认清空',
      content: '确定要清空所有历史记录吗？此操作不可恢复。',
      onOk: () => {
        localStorage.removeItem(`backtest_history_${strategyId}`);
        setHistory([]);
        Message.success('历史记录已清空');
      },
    });
  }, [strategyId]);

  // Export history
  const exportHistory = useCallback(() => {
    if (history.length === 0) {
      Message.warning('暂无历史记录可导出');
      return;
    }

    const data = JSON.stringify(history, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `backtest_history_${strategyId}_${Date.now()}.json`;
    link.click();

    Message.success('历史记录已导出');
  }, [history, strategyId]);

  return (
    <Card
      title="回测历史记录"
      extra={
        <Space>
          <Button size="small" icon={<IconRefresh />} onClick={() => {
            const savedHistory = localStorage.getItem(`backtest_history_${strategyId}`);
            if (savedHistory) setHistory(JSON.parse(savedHistory));
          }}>
            刷新
          </Button>
          <Button size="small" icon={<IconDownload />} onClick={exportHistory} disabled={history.length === 0}>
            导出
          </Button>
          <Button size="small" icon={<IconDelete />} status="danger" onClick={clearHistory} disabled={history.length === 0}>
            清空
          </Button>
        </Space>
      }
    >
      {loading ? (
        <Spin />
      ) : history.length > 0 ? (
        <Table
          data={history}
          columns={[
            { title: '策略', dataIndex: 'strategyName' },
            { title: '交易对', dataIndex: 'symbol' },
            {
              title: '参数',
              dataIndex: 'params',
              render: (p) => (
                <Text style={{ maxWidth: 150 }} ellipsis={{ cssEllipsis: true }}>
                  {JSON.stringify(p)}
                </Text>
              ),
            },
            { title: '收益率', dataIndex: ['result', 'totalReturn'], render: (v) => <Tag color={v > 0 ? 'green' : 'red'}>{v.toFixed(2)}%</Tag> },
            { title: '夏普比率', dataIndex: ['result', 'sharpeRatio'], render: (v) => v.toFixed(2) },
            { title: '回撤', dataIndex: ['result', 'maxDrawdown'], render: (v) => `${v.toFixed(2)}%` },
            { title: '时间', dataIndex: 'createdAt', render: (v) => new Date(v).toLocaleString() },
          ]}
          pagination={{ pageSize: 10 }}
        />
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-3)' }}>
          暂无历史记录
        </div>
      )}
    </Card>
  );
};

/**
 * Main Backtest Enhancement Component
 */
const BacktestEnhancement: React.FC<BacktestEnhancementProps> = ({
  strategyId,
  symbol,
  onOptimizationComplete,
}) => {
  const { isPro } = useSubscription();

  return (
    <FeatureGate featureKey="advanced_backtest" featureName="高级回测功能">
      <div>
        <div style={{ background: 'var(--color-fill-1)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <Title heading={5}>VIP 高级回测功能</Title>
          <Text type="secondary">解锁参数优化、历史记录保存、报告导出等高级功能</Text>
        </div>

        <Tabs defaultActiveTab="optimization">
          <TabPane key="optimization" title="参数优化">
            <ParameterOptimization
              strategyId={strategyId}
              symbol={symbol}
              onOptimizationComplete={onOptimizationComplete}
            />
          </TabPane>
          <TabPane key="history" title="历史记录">
            <BacktestHistory strategyId={strategyId} />
          </TabPane>
        </Tabs>
      </div>
    </FeatureGate>
  );
};

export default BacktestEnhancement;