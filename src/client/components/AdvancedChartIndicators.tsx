/**
 * Advanced Chart Indicators Component
 * VIP-only feature for displaying technical indicators on charts
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Card,
  Button,
  Select,
  InputNumber,
  Space,
  Tag,
  Message,
  Popover,
  Switch,
  Divider,
  Typography,
  Tooltip,
} from '@arco-design/web-react';
import {
  IconPlus,
  IconDelete,
  IconSave,
  IconDownload,
  IconSettings,
} from '@arco-design/web-react/icon';
import { createChart, IChartApi, ISeriesApi, LineSeries, LineData, Time } from 'lightweight-charts';
import { useSubscription } from '../hooks/useSubscription';
import FeatureGate from './FeatureGate';
import { api } from '../utils/api';
import { createLogger } from '../../utils/logger';

const log = createLogger('AdvancedChartIndicators');
const { Text, Title } = Typography;

// Indicator types
export type IndicatorType = 'macd' | 'rsi' | 'bollinger' | 'sma' | 'ema';

export interface IndicatorConfig {
  type: IndicatorType;
  enabled: boolean;
  params: Record<string, number>;
  color?: string;
  lineWidth?: number;
}

export interface SavedTemplate {
  id: string;
  name: string;
  indicators: IndicatorConfig[];
  createdAt: Date;
}

interface AdvancedChartIndicatorsProps {
  symbol: string;
  timeframe: string;
  onIndicatorsChange?: (indicators: IndicatorConfig[]) => void;
  chartApi?: IChartApi | null;
}

// Default indicator configurations
const DEFAULT_INDICATORS: Record<IndicatorType, IndicatorConfig> = {
  macd: {
    type: 'macd',
    enabled: false,
    params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    color: '#1890ff',
    lineWidth: 2,
  },
  rsi: {
    type: 'rsi',
    enabled: false,
    params: { period: 14 },
    color: '#52c41a',
    lineWidth: 2,
  },
  bollinger: {
    type: 'bollinger',
    enabled: false,
    params: { period: 20, stdDev: 2 },
    color: '#722ed1',
    lineWidth: 1,
  },
  sma: {
    type: 'sma',
    enabled: false,
    params: { period: 20 },
    color: '#fa8c16',
    lineWidth: 2,
  },
  ema: {
    type: 'ema',
    enabled: false,
    params: { period: 20 },
    color: '#eb2f96',
    lineWidth: 2,
  },
};

// Indicator metadata for UI
const INDICATOR_METADATA: Record<IndicatorType, { name: string; description: string; category: string }> = {
  macd: {
    name: 'MACD',
    description: '移动平均收敛散度指标，用于判断趋势强度和方向',
    category: '趋势指标',
  },
  rsi: {
    name: 'RSI',
    description: '相对强弱指标，用于判断超买超卖状态',
    category: '震荡指标',
  },
  bollinger: {
    name: '布林带',
    description: '波动率通道指标，显示价格相对高低位',
    category: '波动率指标',
  },
  sma: {
    name: 'SMA',
    description: '简单移动平均线，平滑价格数据',
    category: '趋势指标',
  },
  ema: {
    name: 'EMA',
    description: '指数移动平均线，对近期价格更敏感',
    category: '趋势指标',
  },
};

/**
 * Advanced Chart Indicators Component
 * Provides VIP users with advanced technical indicators overlay on charts
 */
const AdvancedChartIndicators: React.FC<AdvancedChartIndicatorsProps> = ({
  symbol,
  timeframe,
  onIndicatorsChange,
  chartApi,
}) => {
  const { isPro } = useSubscription();
  const [indicators, setIndicators] = useState<IndicatorConfig[]>([]);
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [indicatorData, setIndicatorData] = useState<Record<string, any[]>>({});

  // Load saved templates from localStorage
  useEffect(() => {
    const savedTemplates = localStorage.getItem(`chart_templates_${symbol}`);
    if (savedTemplates) {
      try {
        setTemplates(JSON.parse(savedTemplates));
      } catch (error) {
        log.error('Failed to load templates:', error);
      }
    }
  }, [symbol]);

  // Fetch indicator data when indicators change
  useEffect(() => {
    if (!isPro || indicators.length === 0) return;

    const fetchIndicatorData = async () => {
      setLoading(true);
      try {
        const promises = indicators
          .filter(ind => ind.enabled)
          .map(async (ind) => {
            const response = await api.get(`/api/indicators/${ind.type}`, {
              params: {
                symbol,
                timeframe,
                ...ind.params,
              },
            });
            return { type: ind.type, data: response.data };
          });

        const results = await Promise.all(promises);
        const dataMap: Record<string, any[]> = {};
        results.forEach((result) => {
          dataMap[result.type] = result.data;
        });
        setIndicatorData(dataMap);
      } catch (error) {
        log.error('Failed to fetch indicator data:', error);
        Message.error('获取指标数据失败');
      } finally {
        setLoading(false);
      }
    };

    fetchIndicatorData();
  }, [indicators, symbol, timeframe, isPro]);

  // Notify parent when indicators change
  useEffect(() => {
    if (onIndicatorsChange) {
      onIndicatorsChange(indicators);
    }
  }, [indicators, onIndicatorsChange]);

  // Add a new indicator
  const addIndicator = useCallback((type: IndicatorType) => {
    const newIndicator = { ...DEFAULT_INDICATORS[type], enabled: true };
    setIndicators(prev => [...prev, newIndicator]);
  }, []);

  // Remove an indicator
  const removeIndicator = useCallback((index: number) => {
    setIndicators(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Toggle indicator enabled state
  const toggleIndicator = useCallback((index: number) => {
    setIndicators(prev =>
      prev.map((ind, i) =>
        i === index ? { ...ind, enabled: !ind.enabled } : ind
      )
    );
  }, []);

  // Update indicator parameters
  const updateIndicatorParams = useCallback((index: number, params: Record<string, number>) => {
    setIndicators(prev =>
      prev.map((ind, i) =>
        i === index ? { ...ind, params: { ...ind.params, ...params } } : ind
      )
    );
  }, []);

  // Save current indicators as a template
  const saveAsTemplate = useCallback(() => {
    const templateName = prompt('请输入模板名称');
    if (!templateName) return;

    const newTemplate: SavedTemplate = {
      id: Date.now().toString(),
      name: templateName,
      indicators: [...indicators],
      createdAt: new Date(),
    };

    const updatedTemplates = [...templates, newTemplate];
    setTemplates(updatedTemplates);
    localStorage.setItem(`chart_templates_${symbol}`, JSON.stringify(updatedTemplates));
    Message.success('模板保存成功');
  }, [indicators, templates, symbol]);

  // Load a saved template
  const loadTemplate = useCallback((templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setIndicators([...template.indicators]);
      Message.success(`已加载模板: ${template.name}`);
    }
  }, [templates]);

  // Delete a template
  const deleteTemplate = useCallback((templateId: string) => {
    const updatedTemplates = templates.filter(t => t.id !== templateId);
    setTemplates(updatedTemplates);
    localStorage.setItem(`chart_templates_${symbol}`, JSON.stringify(updatedTemplates));
    Message.success('模板已删除');
  }, [templates, symbol]);

  // Export chart as image
  const exportChart = useCallback(() => {
    if (!chartApi) {
      Message.error('图表未初始化');
      return;
    }

    // Use lightweight-charts takeScreenshot API
    chartApi.takeScreenshot().then((dataUrl) => {
      const link = document.createElement('a');
      link.download = `${symbol}_${timeframe}_${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      Message.success('图表已导出');
    }).catch((error) => {
      log.error('Failed to export chart:', error);
      Message.error('导出失败');
    });
  }, [chartApi, symbol, timeframe]);

  // Render indicator settings panel
  const renderIndicatorSettings = (indicator: IndicatorConfig, index: number) => {
    const metadata = INDICATOR_METADATA[indicator.type];

    return (
      <Card
        key={`${indicator.type}-${index}`}
        size="small"
        style={{ marginBottom: 8 }}
        extra={
          <Space>
            <Switch
              checked={indicator.enabled}
              onChange={() => toggleIndicator(index)}
            />
            <Button
              size="small"
              icon={<IconDelete />}
              status="danger"
              onClick={() => removeIndicator(index)}
            />
          </Space>
        }
      >
        <div>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div>
              <Text bold>{metadata.name}</Text>
              <Tag size="small" style={{ marginLeft: 8 }}>
                {metadata.category}
              </Tag>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {metadata.description}
            </Text>

            {/* Indicator-specific parameters */}
            <Divider style={{ margin: '8px 0' }} />
            <Space wrap>
              {indicator.type === 'macd' && (
                <>
                  <div>
                    <Text style={{ marginRight: 8 }}>快线周期:</Text>
                    <InputNumber
                      size="small"
                      value={indicator.params.fastPeriod}
                      onChange={(v) => updateIndicatorParams(index, { fastPeriod: v as number })}
                      min={1}
                      max={100}
                      style={{ width: 60 }}
                    />
                  </div>
                  <div>
                    <Text style={{ marginRight: 8 }}>慢线周期:</Text>
                    <InputNumber
                      size="small"
                      value={indicator.params.slowPeriod}
                      onChange={(v) => updateIndicatorParams(index, { slowPeriod: v as number })}
                      min={1}
                      max={200}
                      style={{ width: 60 }}
                    />
                  </div>
                  <div>
                    <Text style={{ marginRight: 8 }}>信号线:</Text>
                    <InputNumber
                      size="small"
                      value={indicator.params.signalPeriod}
                      onChange={(v) => updateIndicatorParams(index, { signalPeriod: v as number })}
                      min={1}
                      max={50}
                      style={{ width: 60 }}
                    />
                  </div>
                </>
              )}
              {indicator.type === 'rsi' && (
                <div>
                  <Text style={{ marginRight: 8 }}>周期:</Text>
                  <InputNumber
                    size="small"
                    value={indicator.params.period}
                    onChange={(v) => updateIndicatorParams(index, { period: v as number })}
                    min={1}
                    max={100}
                    style={{ width: 60 }}
                  />
                </div>
              )}
              {indicator.type === 'bollinger' && (
                <>
                  <div>
                    <Text style={{ marginRight: 8 }}>周期:</Text>
                    <InputNumber
                      size="small"
                      value={indicator.params.period}
                      onChange={(v) => updateIndicatorParams(index, { period: v as number })}
                      min={1}
                      max={100}
                      style={{ width: 60 }}
                    />
                  </div>
                  <div>
                    <Text style={{ marginRight: 8 }}>标准差:</Text>
                    <InputNumber
                      size="small"
                      value={indicator.params.stdDev}
                      onChange={(v) => updateIndicatorParams(index, { stdDev: v as number })}
                      min={0.5}
                      max={3}
                      step={0.5}
                      style={{ width: 60 }}
                    />
                  </div>
                </>
              )}
              {(indicator.type === 'sma' || indicator.type === 'ema') && (
                <div>
                  <Text style={{ marginRight: 8 }}>周期:</Text>
                  <InputNumber
                    size="small"
                    value={indicator.params.period}
                    onChange={(v) => updateIndicatorParams(index, { period: v as number })}
                    min={1}
                    max={200}
                    style={{ width: 60 }}
                  />
                </div>
              )}
            </Space>
          </Space>
        </div>
      </Card>
    );
  };

  // Main render - wrapped in FeatureGate
  return (
    <FeatureGate featureKey="advanced_charts" featureName="高级图表指标">
      <Card
        title="高级图表指标"
        extra={
          <Space>
            <Button
              size="small"
              icon={<IconDownload />}
              onClick={exportChart}
              disabled={!chartApi}
            >
              导出图表
            </Button>
            <Button
              size="small"
              icon={<IconSave />}
              onClick={saveAsTemplate}
              disabled={indicators.length === 0}
            >
              保存模板
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size="medium">
          {/* Add indicator dropdown */}
          <div>
            <Text style={{ marginRight: 8 }}>添加指标:</Text>
            <Select
              style={{ width: 200 }}
              placeholder="选择技术指标"
              onChange={(value) => addIndicator(value as IndicatorType)}
              value={undefined}
            >
              {Object.entries(INDICATOR_METADATA).map(([type, meta]) => (
                <Select.Option key={type} value={type}>
                  <Space>
                    <span>{meta.name}</span>
                    <Tag size="small">{meta.category}</Tag>
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </div>

          {/* Saved templates */}
          {templates.length > 0 && (
            <div>
              <Text style={{ marginRight: 8 }}>加载模板:</Text>
              <Space wrap>
                {templates.map((template) => (
                  <Popover
                    key={template.id}
                    content={
                      <Space direction="vertical">
                        <Text>包含 {template.indicators.length} 个指标</Text>
                        <Button
                          size="small"
                          status="danger"
                          onClick={() => deleteTemplate(template.id)}
                        >
                          删除模板
                        </Button>
                      </Space>
                    }
                  >
                    <Tag
                      style={{ cursor: 'pointer' }}
                      onClick={() => loadTemplate(template.id)}
                    >
                      {template.name}
                    </Tag>
                  </Popover>
                ))}
              </Space>
            </div>
          )}

          {/* Active indicators */}
          <div>
            <Text bold>已添加指标:</Text>
            {indicators.length === 0 ? (
              <Text type="secondary" style={{ marginLeft: 8 }}>
                暂无指标，请从上方选择添加
              </Text>
            ) : (
              <div style={{ marginTop: 8 }}>
                {indicators.map((indicator, index) =>
                  renderIndicatorSettings(indicator, index)
                )}
              </div>
            )}
          </div>

          {/* VIP feature comparison */}
          <Divider />
          <div style={{ background: 'var(--color-fill-1)', padding: 12, borderRadius: 4 }}>
            <Text bold>VIP 高级图表功能</Text>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-2)' }}>
              <div>✓ 5种技术指标叠加显示（MACD、RSI、布林带、SMA、EMA）</div>
              <div>✓ 自定义指标参数配置</div>
              <div>✓ 保存个人指标模板</div>
              <div>✓ 图表截图导出</div>
            </div>
          </div>
        </Space>
      </Card>
    </FeatureGate>
  );
};

export default AdvancedChartIndicators;