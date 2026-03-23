/**
 * BacktestVisualizationPage - Advanced Backtest Visualization Page
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
import { useTranslation } from 'react-i18next';
import { createLogger } from '../../utils/logger';

const _log = createLogger('BacktestVisualizationPage');

// Helper to get locale from i18n language
const getLocaleFromLanguage = (language: string): string => {
  return language === 'zh-CN' ? 'zh-CN' : 'en-US';
};

const { Title, Text } = Typography;
const { Row, Col } = Grid;
const { RangePicker } = DatePicker;

// Performance metrics dashboard component
const PerformanceDashboard: React.FC<{ stats: BacktestResult['stats']; t: (key: string) => string }> = ({ stats, t }) => {
  if (!stats) return null;
  
  const metrics = [
    { label: t('result.totalReturn'), value: `${stats.totalReturn.toFixed(2)}%`, color: stats.totalReturn >= 0 ? 'green' : 'red' },
    { label: t('result.annualReturn'), value: `${stats.annualizedReturn.toFixed(2)}%`, color: stats.annualizedReturn >= 0 ? 'green' : 'red' },
    { label: t('result.sharpeRatio'), value: stats.sharpeRatio.toFixed(2), color: stats.sharpeRatio >= 1 ? 'green' : 'orange' },
    { label: t('result.maxDrawdown'), value: `${stats.maxDrawdown.toFixed(2)}%`, color: 'red' },
    { label: t('result.winRate'), value: `${stats.winRate.toFixed(1)}%`, color: stats.winRate >= 50 ? 'green' : 'orange' },
    { label: t('result.profitFactor'), value: stats.profitFactor.toFixed(2), color: stats.profitFactor >= 1 ? 'green' : 'red' },
    { label: t('result.totalTrades'), value: stats.totalTrades.toString(), color: 'arcoblue' },
    { label: t('result.avgProfit'), value: `$${stats.avgWin.toFixed(2)}`, color: 'green' },
    { label: t('result.avgLoss'), value: `$${stats.avgLoss.toFixed(2)}`, color: 'red' },
    { label: t('form.initialCapital'), value: `$${stats.initialCapital.toLocaleString()}`, color: 'gray' },
    { label: t('result.finalCapital'), value: `$${stats.finalCapital.toLocaleString()}`, color: stats.finalCapital >= stats.initialCapital ? 'green' : 'red' },
    { label: t('result.totalPnL'), value: `$${stats.totalPnL.toFixed(2)}`, color: stats.totalPnL >= 0 ? 'green' : 'red' },
  ];
  
  return (
    <Card title={t('result.title')} extra={<IconExperiment />}>
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
  t: (key: string) => string;
}

const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ visible, onClose, config, onSave, t }) => {
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
      title={t('form.title')}
      visible={visible}
      onOk={handleSave}
      onCancel={onClose}
      width={480}
    >
      <Form form={form} layout="vertical">
        <Form.Item label={t('form.initialCapital')} field="capital" rules={[{ required: true }]}>
          <InputNumber min={1000} max={10000000} step={1000} style={{ width: '100%' }} />
        </Form.Item>
        
        <Form.Item label={t('form.symbol')} field="symbol" rules={[{ required: true }]}>
          <Select>
            {SYMBOLS.map((s) => (
              <Select.Option key={s.value} value={s.value}>{s.label}</Select.Option>
            ))}
          </Select>
        </Form.Item>
        
        <Form.Item label={t('form.strategy')} field="strategy" rules={[{ required: true }]}>
          <Select>
            {STRATEGIES.map((s) => (
              <Select.Option key={s.value} value={s.value}>{s.label}</Select.Option>
            ))}
          </Select>
        </Form.Item>
        
        <Form.Item label={t('form.dateRange')} field="dateRange">
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
  // Initialize config with lazy initial state to avoid impure function calls during render
  const [config, setConfig] = useState(() => ({
    capital: 10000,
    symbol: 'BTC/USDT',
    strategy: 'sma',
    dateRange: [
      Date.now() - 90 * 24 * 60 * 60 * 1000, // 90 days ago
      Date.now(),
    ] as [number, number],
    strategyParams: {},
  }));
  
  const { t, i18n } = useTranslation('backtest');
  const locale = getLocaleFromLanguage(i18n.language);
  
  // Transform backtest result data for charts
  const equityData = useMemo((): EquityDataPoint[] => {
    if (!result) return [];
    
    return result.snapshots.map((snapshot) => ({
      timestamp: snapshot.timestamp,
      date: new Date(snapshot.timestamp).toLocaleDateString(locale),
      equity: snapshot.totalValue,
      drawdown: 0, // Calculated in chart
      highWaterMark: 0,
    }));
  }, [result, locale]);
  
  const drawdownData = useMemo((): DrawdownDataPoint[] => {
    if (!result) return [];
    
    let peak = result.config.capital;
    return result.snapshots.map((snapshot) => {
      peak = Math.max(peak, snapshot.totalValue);
      const drawdown = -((peak - snapshot.totalValue) / peak) * 100;
      return {
        timestamp: snapshot.timestamp,
        date: new Date(snapshot.timestamp).toLocaleDateString(locale),
        drawdown,
        peak,
        trough: snapshot.totalValue,
      };
    });
  }, [result, locale]);
  
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
      date: new Date(trade.timestamp).toLocaleString(locale),
      price: trade.price,
      side: trade.side,
      quantity: trade.quantity,
      pnl: trade.realizedPnL,
      type: trade.side === 'buy' ? 'entry' : 'exit',
    }));
  }, [result]);
  
  const holdingTimeData = useMemo((): HoldingPeriod[] => {
    if (!result || !result.trades.length) return [];
    
    // Group trades by holding period - using deterministic mock data
    const categories = [
      { label: t('holdingTime.less1h'), min: 0, max: 1 },
      { label: t('holdingTime.oneTo4h'), min: 1, max: 4 },
      { label: t('holdingTime.fourTo24h'), min: 4, max: 24 },
      { label: t('holdingTime.oneTo3d'), min: 24, max: 72 },
      { label: t('holdingTime.threeTo7d'), min: 72, max: 168 },
      { label: t('holdingTime.more7d'), min: 168, max: Infinity },
    ];
    
    // Use result-based deterministic values instead of random
    const baseCount = result.trades.length;
    return categories.map((cat, index) => ({
      duration: (cat.min + cat.max) / 2,
      category: cat.label,
      count: Math.floor(baseCount * (0.3 - index * 0.03)) + 10, // Deterministic mock data
      avgPnL: ((baseCount % 100) / 100 - 0.3) * 200 * (index + 1) / 6,
      winRate: 40 + ((baseCount * (index + 1)) % 30),
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
    
    // Generate mock monthly returns using deterministic values
    const data: MonthlyReturn[] = [];
    const startDate = new Date(result.snapshots[0]?.timestamp || 0);
    const endDate = new Date(result.snapshots[result.snapshots.length - 1]?.timestamp || 0);
    const baseValue = result.trades.length;
    
    for (let y = startDate.getFullYear(); y <= endDate.getFullYear(); y++) {
      for (let m = 1; m <= 12; m++) {
        if (y === startDate.getFullYear() && m < startDate.getMonth() + 1) continue;
        if (y === endDate.getFullYear() && m > endDate.getMonth() + 1) continue;
        
        // Deterministic mock data based on year and month
        const monthIndex = (y - startDate.getFullYear()) * 12 + m;
        data.push({
          year: y,
          month: m,
          return: (((baseValue + monthIndex) % 20) - 10) * 0.5, // Deterministic mock return
          trades: Math.floor((baseValue * (m + 1)) % 30) + 5, // Deterministic mock trades
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
    Message.success(t('status.completed'));
  }, [config, runBacktest, t]);
  
  const handleExport = useCallback((format: 'csv' | 'json') => {
    const data = format === 'csv' ? exportToCSV() : exportToJSON();
    if (!data) {
      Message.warning(t('common:message.noData'));
      return;
    }
    
    const blob = new Blob([data], { type: format === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backtest-result.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    
    Message.success(`${t('actions.export')} ${format.toUpperCase()}`);
  }, [exportToCSV, exportToJSON, t]);
  
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
              {t('title')}
            </Title>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<IconSettings />}
                onClick={() => setSettingsVisible(true)}
              >
                {t('form.title')}
              </Button>
              <Button
                type="primary"
                icon={<IconPlayArrow />}
                loading={loading}
                onClick={handleRunBacktest}
              >
                {t('actions.run')}
              </Button>
              {result && (
                <>
                  <Button
                    icon={<IconDownload />}
                    onClick={() => handleExport('csv')}
                  >
                    {t('actions.export')} CSV
                  </Button>
                  <Button
                    icon={<IconDownload />}
                    onClick={() => handleExport('json')}
                  >
                    {t('actions.export')} JSON
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
          <Text>{t('form.symbol')}: <Tag color="blue">{config.symbol}</Tag></Text>
          <Text>{t('form.strategy')}: <Tag color="green">{STRATEGIES.find((s) => s.value === config.strategy)?.label}</Tag></Text>
          <Text>{t('form.initialCapital')}: <Tag color="orange">${config.capital.toLocaleString()}</Tag></Text>
          <Text>{t('form.dateRange')}: <Tag color="purple">
            {new Date(config.dateRange[0]).toLocaleDateString(locale)} - {new Date(config.dateRange[1]).toLocaleDateString(locale)}
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
            <Text type="secondary">{t('status.running')}</Text>
          </div>
        </Card>
      )}
      
      {/* Results */}
      {!loading && result && (
        <>
          {/* Performance Dashboard */}
          <div style={{ marginBottom: 16 }}>
            <PerformanceDashboard stats={result.stats} t={t} />
          </div>
          
          {/* Main charts */}
          <Tabs defaultActiveTab="overview">
            <Tabs.TabPane key="overview" title={t('chart.equityCurve')}>
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
            
            <Tabs.TabPane key="trades" title={t('chart.tradeDistribution')}>
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <TradeAnalysisChart trades={tradeAnalysisData} height={400} />
                </Col>
                <Col span={12}>
                  <HoldingTimeChart data={holdingTimeData} height={300} />
                </Col>
                <Col span={12}>
                  <Card title={t('chart.tradeDistribution')}>
                    <Descriptions column={2} bordered>
                      <Descriptions.Item label={t('result.totalTrades')}>{result.stats.totalTrades}</Descriptions.Item>
                      <Descriptions.Item label={t('result.winningTrades')}>{result.stats.winningTrades}</Descriptions.Item>
                      <Descriptions.Item label={t('result.losingTrades')}>{result.stats.losingTrades}</Descriptions.Item>
                      <Descriptions.Item label={t('result.winRate')}>{result.stats.winRate.toFixed(1)}%</Descriptions.Item>
                      <Descriptions.Item label={t('result.avgProfit')}>${result.stats.avgWin.toFixed(2)}</Descriptions.Item>
                      <Descriptions.Item label={t('result.avgLoss')}>${result.stats.avgLoss.toFixed(2)}</Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
              </Row>
            </Tabs.TabPane>
            
            <Tabs.TabPane key="heatmap" title={t('chart.monthlyReturns')}>
              <ReturnsHeatmapChart data={monthlyReturnsData} />
            </Tabs.TabPane>
            
            <Tabs.TabPane key="comparison" title={t('actions.compare')}>
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
            <Title heading={5}>{t('actions.run')}</Title>
            <Text type="secondary">
              {t('subtitle')}
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
        t={t}
      />
    </div>
  );
};

export default BacktestVisualizationPage;
