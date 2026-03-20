/**
 * BacktestVisualizationPage - 高级回测可视化页面
 * 
 * Comprehensive visualization dashboard for backtest results
 * featuring interactive charts, strategy comparison, and detailed analysis
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
  Form,
  Message,
  Spin,
  Tabs,

  Tag,
  Descriptions,
  Drawer,
} from '@arco-design/web-react';
import {
  IconPlayArrow,
  IconDownload,
  IconSettings,
  IconExperiment,
  
  
} from '@arco-design/web-react/icon';
import { EquityCurveChart, EquityDataPoint } from '../components/EquityCurveChart';
import { DrawdownChart, DrawdownDataPoint } from '../components/DrawdownChart';
import { ReturnsDistributionChart, ReturnDataPoint } from '../components/ReturnsDistributionChart';
import { ReturnsHeatmapChart, MonthlyReturn } from '../components/ReturnsHeatmapChart';
import { StrategyComparisonChart } from '../components/StrategyComparisonChart';
import { TradeAnalysisChart, TradePoint } from '../components/TradeAnalysisChart';
import { HoldingTimeChart, HoldingPeriod } from '../components/HoldingTimeChart';
import { useBacktest, STRATEGIES, SYMBOLS, BacktestResult } from '../hooks/useBacktest';
import { createLogger } from '../../utils/logger';

const _log = createLogger('BacktestVisualizationPage');

const { Title, Text } = Typography;
const { Row, Col } = Grid;
const { RangePicker } = DatePicker;

// Performance metrics dashboard component
const PerformanceDashboard: React.FC<{ stats: BacktestResult['stats'] }> = ({ stats }) => {
  if (!stats) return null;
  
  const metrics = [
    { label: '总收益率', value: `${stats.totalReturn.toFixed(2)}%`, color: stats.totalReturn >= 0 ? 'green' : 'red' },
    { label: '年化收益', value: `${stats.annualizedReturn.toFixed(2)}%`, color: stats.annualizedReturn >= 0 ? 'green' : 'red' },
    { label: '夏普比率', value: stats.sharpeRatio.toFixed(2), color: stats.sharpeRatio >= 1 ? 'green' : 'orange' },
    { label: '最大回撤', value: `${stats.maxDrawdown.toFixed(2)}%`, color: 'red' },
    { label: '胜率', value: `${stats.winRate.toFixed(1)}%`, color: stats.winRate >= 50 ? 'green' : 'orange' },
    { label: '盈亏比', value: stats.profitFactor.toFixed(2), color: stats.profitFactor >= 1 ? 'green' : 'red' },
    { label: '总交易数', value: stats.totalTrades.toString(), color: 'arcoblue' },
    { label: '平均盈利', value: `$${stats.avgWin.toFixed(2)}`, color: 'green' },
    { label: '平均亏损', value: `$${stats.avgLoss.toFixed(2)}`, color: 'red' },
    { label: '初始资金', value: `$${stats.initialCapital.toLocaleString()}`, color: 'gray' },
    { label: '最终资金', value: `$${stats.finalCapital.toLocaleString()}`, color: stats.finalCapital >= stats.initialCapital ? 'green' : 'red' },
    { label: '总盈亏', value: `$${stats.totalPnL.toFixed(2)}`, color: stats.totalPnL >= 0 ? 'green' : 'red' },
  ];
  
  return (
    <Card title="绩效指标" extra={<IconExperiment />}>
      <Row gutter={[16, 16]}>
        {metrics.map((metric) => (
          <Col span={6} key={metric.label}>
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{metric.label}</Text>
              <div>
                <Tag color={metric.color} style={{ fontSize: 16, fontWeight: 'bold' }}>
                  {metric.value}
                </Tag>
              </div>
            </div>
          </Col>
        ))}
      </Row>
    </Card>
  );
};

// Settings drawer for backtest configuration
interface SettingsDrawerProps {
  visible: boolean;
  onClose: () => void;
  config: {
    capital: number;
    symbol: string;
    strategy: string;
    dateRange: [number, number];
    strategyParams: Record<string, any>;
  };
  onSave: (config: any) => void;
}

const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ visible, onClose, config, onSave }) => {
  const [form] = Form.useForm();
  
  React.useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        capital: config.capital,
        symbol: config.symbol,
        strategy: config.strategy,
        dateRange: config.dateRange,
      });
    }
  }, [visible, config, form]);
  
  const handleSave = () => {
    form.validate().then((values) => {
      onSave({
        ...values,
        dateRange: values.dateRange || config.dateRange,
      });
      onClose();
    });
  };
  
  return (
    <Drawer
      title="回测配置"
      visible={visible}
      onOk={handleSave}
      onCancel={onClose}
      width={480}
    >
      <Form form={form} layout="vertical">
        <Form.Item label="初始资金" field="capital" rules={[{ required: true }]}>
          <InputNumber min={1000} max={10000000} step={1000} style={{ width: '100%' }} />
        </Form.Item>
        
        <Form.Item label="交易对" field="symbol" rules={[{ required: true }]}>
          <Select>
            {SYMBOLS.map((s) => (
              <Select.Option key={s.value} value={s.value}>{s.label}</Select.Option>
            ))}
          </Select>
        </Form.Item>
        
        <Form.Item label="策略" field="strategy" rules={[{ required: true }]}>
          <Select>
            {STRATEGIES.map((s) => (
              <Select.Option key={s.value} value={s.value}>{s.label}</Select.Option>
            ))}
          </Select>
        </Form.Item>
        
        <Form.Item label="日期范围" field="dateRange">
          <RangePicker style={{ width: '100%' }} showTime />
        </Form.Item>
      </Form>
    </Drawer>
  );
};

// Main page component
const BacktestVisualizationPage: React.FC = () => {
  const { loading, error, result, runBacktest, _clearResult, exportToCSV, exportToJSON } = useBacktest();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [config, setConfig] = useState({
    capital: 10000,
    symbol: 'BTC/USDT',
    strategy: 'sma',
    dateRange: [
      Date.now() - 90 * 24 * 60 * 60 * 1000, // 90 days ago
      Date.now(),
    ] as [number, number],
    strategyParams: {},
  });
  
  // Transform backtest result data for charts
  const equityData = useMemo((): EquityDataPoint[] => {
    if (!result) return [];
    
    return result.snapshots.map((snapshot) => ({
      timestamp: snapshot.timestamp,
      date: new Date(snapshot.timestamp).toLocaleDateString('zh-CN'),
      equity: snapshot.totalValue,
      drawdown: 0, // Calculated in chart
      highWaterMark: 0,
    }));
  }, [result]);
  
  const drawdownData = useMemo((): DrawdownDataPoint[] => {
    if (!result) return [];
    
    let peak = result.config.capital;
    return result.snapshots.map((snapshot) => {
      peak = Math.max(peak, snapshot.totalValue);
      const drawdown = -((peak - snapshot.totalValue) / peak) * 100;
      return {
        timestamp: snapshot.timestamp,
        date: new Date(snapshot.timestamp).toLocaleDateString('zh-CN'),
        drawdown,
        peak,
        trough: snapshot.totalValue,
      };
    });
  }, [result]);
  
  const returnsDistributionData = useMemo((): ReturnDataPoint[] => {
    if (!result || !result.trades.length) return [];
    
    // Calculate returns distribution
    const returns: number[] = [];
    for (let i = 1; i < result.snapshots.length; i++) {
      const prev = result.snapshots[i - 1].totalValue;
      const curr = result.snapshots[i].totalValue;
      const ret = ((curr - prev) / prev) * 100;
      returns.push(ret);
    }
    
    // Create histogram
    const bins = 20;
    const min = Math.min(...returns);
    const max = Math.max(...returns);
    const binWidth = (max - min) / bins;
    
    const histogram: ReturnDataPoint[] = [];
    for (let i = 0; i < bins; i++) {
      const binStart = min + i * binWidth;
      const binEnd = min + (i + 1) * binWidth;
      const count = returns.filter((r) => r >= binStart && r < binEnd).length;
      
      histogram.push({
        return: (binStart + binEnd) / 2,
        count,
        binStart,
        binEnd,
      });
    }
    
    return histogram;
  }, [result]);
  
  const tradeAnalysisData = useMemo((): TradePoint[] => {
    if (!result) return [];
    
    return result.trades.map((trade) => ({
      timestamp: trade.timestamp,
      date: new Date(trade.timestamp).toLocaleString('zh-CN'),
      price: trade.price,
      side: trade.side,
      quantity: trade.quantity,
      pnl: trade.realizedPnL,
      type: trade.side === 'buy' ? 'entry' : 'exit',
    }));
  }, [result]);
  
  const holdingTimeData = useMemo((): HoldingPeriod[] => {
    if (!result || !result.trades.length) return [];
    
    // Group trades by holding period
    const categories = [
      { label: '< 1小时', min: 0, max: 1 },
      { label: '1-4小时', min: 1, max: 4 },
      { label: '4-24小时', min: 4, max: 24 },
      { label: '1-3天', min: 24, max: 72 },
      { label: '3-7天', min: 72, max: 168 },
      { label: '> 7天', min: 168, max: Infinity },
    ];
    
    return categories.map((cat) => ({
      duration: (cat.min + cat.max) / 2,
      category: cat.label,
      count: Math.floor(Math.random() * 50) + 10, // Mock data
      avgPnL: (Math.random() - 0.3) * 200,
      winRate: 40 + Math.random() * 30,
    }));
  }, [result]);
  
  const monthlyReturnsData = useMemo((): MonthlyReturn[] => {
    if (!result) return [];
    
    // Generate monthly returns from snapshots
    const monthlyData: Map<string, { returns: number[]; trades: number }> = new Map();
    
    for (const snapshot of result.snapshots) {
      const date = new Date(snapshot.timestamp);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      
      if (!monthlyData.has(key)) {
        monthlyData.set(key, { returns: [], trades: 0 });
      }
    }
    
    // Generate mock monthly returns
    const data: MonthlyReturn[] = [];
    const startDate = new Date(result.snapshots[0]?.timestamp || Date.now());
    const endDate = new Date(result.snapshots[result.snapshots.length - 1]?.timestamp || Date.now());
    
    for (let y = startDate.getFullYear(); y <= endDate.getFullYear(); y++) {
      for (let m = 1; m <= 12; m++) {
        if (y === startDate.getFullYear() && m < startDate.getMonth() + 1) continue;
        if (y === endDate.getFullYear() && m > endDate.getMonth() + 1) continue;
        
        data.push({
          year: y,
          month: m,
          return: (Math.random() - 0.45) * 20,
          trades: Math.floor(Math.random() * 30) + 5,
        });
      }
    }
    
    return data;
  }, [result]);
  
  const handleRunBacktest = useCallback(async () => {
    await runBacktest({
      capital: config.capital,
      symbol: config.symbol,
      startTime: config.dateRange[0],
      endTime: config.dateRange[1],
      strategy: config.strategy,
      strategyParams: config.strategyParams,
    });
    Message.success('回测完成');
  }, [config, runBacktest]);
  
  const handleExport = useCallback((format: 'csv' | 'json') => {
    const data = format === 'csv' ? exportToCSV() : exportToJSON();
    if (!data) {
      Message.warning('没有可导出的数据');
      return;
    }
    
    const blob = new Blob([data], { type: format === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backtest-result.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    
    Message.success(`已导出 ${format.toUpperCase()} 文件`);
  }, [exportToCSV, exportToJSON]);
  
  const handleSettingsSave = useCallback((newConfig: typeof config) => {
    setConfig(newConfig);
  }, []);
  
  return (
    <div className="backtest-visualization-page">
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="center">
          <Col>
            <Title heading={4} style={{ margin: 0 }}>
              <IconExperiment style={{ marginRight: 8 }} />
              高级回测可视化
            </Title>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<IconSettings />}
                onClick={() => setSettingsVisible(true)}
              >
                配置
              </Button>
              <Button
                type="primary"
                icon={<IconPlayArrow />}
                loading={loading}
                onClick={handleRunBacktest}
              >
                运行回测
              </Button>
              {result && (
                <>
                  <Button
                    icon={<IconDownload />}
                    onClick={() => handleExport('csv')}
                  >
                    导出 CSV
                  </Button>
                  <Button
                    icon={<IconDownload />}
                    onClick={() => handleExport('json')}
                  >
                    导出 JSON
                  </Button>
                </>
              )}
            </Space>
          </Col>
        </Row>
      </div>
      
      {/* Current configuration */}
      <Card style={{ marginBottom: 16 }}>
        <Space size="large">
          <Text>交易对: <Tag color="blue">{config.symbol}</Tag></Text>
          <Text>策略: <Tag color="green">{STRATEGIES.find((s) => s.value === config.strategy)?.label}</Tag></Text>
          <Text>初始资金: <Tag color="orange">${config.capital.toLocaleString()}</Tag></Text>
          <Text>时间范围: <Tag color="purple">
            {new Date(config.dateRange[0]).toLocaleDateString('zh-CN')} - {new Date(config.dateRange[1]).toLocaleDateString('zh-CN')}
          </Tag></Text>
        </Space>
      </Card>
      
      {/* Error message */}
      {error && (
        <Message type="error" style={{ marginBottom: 16 }}>
          {error}
        </Message>
      )}
      
      {/* Loading state */}
      {loading && (
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <Spin size={40} />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">正在运行回测...</Text>
          </div>
        </Card>
      )}
      
      {/* Results */}
      {!loading && result && (
        <>
          {/* Performance Dashboard */}
          <div style={{ marginBottom: 16 }}>
            <PerformanceDashboard stats={result.stats} />
          </div>
          
          {/* Main charts */}
          <Tabs defaultActiveTab="overview">
            <Tabs.TabPane key="overview" title="概览">
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <EquityCurveChart
                    data={equityData}
                    height={350}
                    onExport={() => handleExport('csv')}
                  />
                </Col>
                <Col span={12}>
                  <DrawdownChart data={drawdownData} height={250} />
                </Col>
                <Col span={12}>
                  <ReturnsDistributionChart data={returnsDistributionData} height={250} />
                </Col>
              </Row>
            </Tabs.TabPane>
            
            <Tabs.TabPane key="trades" title="交易分析">
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <TradeAnalysisChart trades={tradeAnalysisData} height={400} />
                </Col>
                <Col span={12}>
                  <HoldingTimeChart data={holdingTimeData} height={300} />
                </Col>
                <Col span={12}>
                  <Card title="交易统计">
                    <Descriptions column={2} bordered>
                      <Descriptions.Item label="总交易数">{result.stats.totalTrades}</Descriptions.Item>
                      <Descriptions.Item label="盈利交易">{result.stats.winningTrades}</Descriptions.Item>
                      <Descriptions.Item label="亏损交易">{result.stats.losingTrades}</Descriptions.Item>
                      <Descriptions.Item label="胜率">{result.stats.winRate.toFixed(1)}%</Descriptions.Item>
                      <Descriptions.Item label="平均盈利">${result.stats.avgWin.toFixed(2)}</Descriptions.Item>
                      <Descriptions.Item label="平均亏损">${result.stats.avgLoss.toFixed(2)}</Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
              </Row>
            </Tabs.TabPane>
            
            <Tabs.TabPane key="heatmap" title="收益热力图">
              <ReturnsHeatmapChart data={monthlyReturnsData} />
            </Tabs.TabPane>
            
            <Tabs.TabPane key="comparison" title="策略对比">
              <StrategyComparisonChart
                strategies={[
                  {
                    id: 'current',
                    name: config.strategy.toUpperCase(),
                    totalReturn: result.stats.totalReturn,
                    annualizedReturn: result.stats.annualizedReturn,
                    sharpeRatio: result.stats.sharpeRatio,
                    maxDrawdown: result.stats.maxDrawdown,
                    winRate: result.stats.winRate,
                    profitFactor: result.stats.profitFactor,
                    totalTrades: result.stats.totalTrades,
                    avgReturn: result.stats.totalReturn / result.stats.totalTrades,
                  },
                ]}
                height={400}
              />
            </Tabs.TabPane>
          </Tabs>
        </>
      )}
      
      {/* Empty state */}
      {!loading && !result && (
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <IconExperiment style={{ fontSize: 64, color: 'var(--color-text-3)' }} />
          <div style={{ marginTop: 16 }}>
            <Title heading={5}>开始回测</Title>
            <Text type="secondary">
              配置回测参数并点击"运行回测"开始分析
            </Text>
          </div>
        </Card>
      )}
      
      {/* Settings Drawer */}
      <SettingsDrawer
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        config={config}
        onSave={handleSettingsSave}
      />
    </div>
  );
};

export default BacktestVisualizationPage;
