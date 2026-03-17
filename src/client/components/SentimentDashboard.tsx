/**
 * Sentiment Dashboard Component
 * 
 * Comprehensive market sentiment visualization with:
 * - Fear & Greed gauge
 * - Multi-dimensional sentiment breakdown
 * - Historical trend charts
 * - Real-time alerts
 * - Signal recommendations
 */

import React, { useState } from 'react';
import {
  Card,
  Typography,
  Grid,
  Tag,
  Space,
  Button,
  Spin,
  Empty,
  Progress,
  Statistic,
  Tabs,
  Alert,
} from '@arco-design/web-react';
import {
  IconExclamationCircle,
  IconRefresh,
  IconArrowRise,
  IconArrowFall,
  IconMinus,
} from '@arco-design/web-react/icon';
const { Row, Col } = Grid;
const { Title, Text } = Typography;
const TabPane = Tabs.TabPane;

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart,
} from 'recharts';

import { useSentiment } from '../hooks/useSentiment';
import { ErrorBoundary } from './ErrorBoundary';
import {
  type SentimentData,
  type SentimentHistoryPoint,
  getSentimentColor,
  getSentimentDisplayText,
  getSignalDisplayText,
} from '../../utils/sentiment';

/**
 * Props for the SentimentDashboard component
 */
export interface SentimentDashboardProps {
  /** Refresh interval in milliseconds */
  refreshInterval?: number;
  /** Number of history days to show */
  historyDays?: number;
  /** Show compact version */
  compact?: boolean;
  /** Initial tab to display */
  defaultTab?: string;
}

/**
 * Gauge chart component for Fear & Greed index
 */
const SentimentGauge: React.FC<{ value: number; size?: number }> = ({ value, size = 200 }) => {
  const color = getSentimentColor(value);
  
  const startAngle = 180;
  const endAngle = 0;
  const angleRange = startAngle - endAngle;
  const valueAngle = startAngle - (value / 100) * angleRange;
  
  const radians = (angle: number) => (angle * Math.PI) / 180;
  const radius = size / 2 - 20;
  const centerX = size / 2;
  const centerY = size / 2;
  
  const bgStartX = centerX + radius * Math.cos(radians(startAngle));
  const bgStartY = centerY - radius * Math.sin(radians(startAngle));
  const bgEndX = centerX + radius * Math.cos(radians(endAngle));
  const bgEndY = centerY - radius * Math.sin(radians(endAngle));
  
  const valueEndX = centerX + radius * Math.cos(radians(valueAngle));
  const valueEndY = centerY - radius * Math.sin(radians(valueAngle));
  
  return (
    <svg width={size} height={size / 2 + 40} viewBox={`0 0 ${size} ${size / 2 + 40}`}>
      <path
        d={`M ${bgStartX} ${bgStartY} A ${radius} ${radius} 0 1 1 ${bgEndX} ${bgEndY}`}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={20}
        strokeLinecap="round"
      />
      <path
        d={`M ${bgStartX} ${bgStartY} A ${radius} ${radius} 0 ${value > 50 ? 1 : 0} 1 ${valueEndX} ${valueEndY}`}
        fill="none"
        stroke={color}
        strokeWidth={20}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
      <text
        x={centerX}
        y={centerY - 10}
        textAnchor="middle"
        fill={color}
        fontSize={32}
        fontWeight="bold"
      >
        {value}
      </text>
      <text
        x={centerX}
        y={centerY + 20}
        textAnchor="middle"
        fill="currentColor"
        fontSize={14}
        opacity={0.7}
      >
        恐惧贪婪指数
      </text>
      <text x={20} y={size / 2 + 30} fill="currentColor" fontSize={10} opacity={0.5}>0</text>
      <text x={size - 30} y={size / 2 + 30} fill="currentColor" fontSize={10} opacity={0.5}>100</text>
    </svg>
  );
};

/**
 * Dimension breakdown radar chart
 */
const DimensionRadar: React.FC<{ dimensions: SentimentData['dimensions'] }> = ({ dimensions }) => {
  const data = [
    { dimension: '技术面', value: dimensions.technical, fullMark: 100 },
    { dimension: '资金流', value: dimensions.capitalFlow, fullMark: 100 },
    { dimension: '波动率', value: dimensions.volatility, fullMark: 100 },
    { dimension: '动量', value: dimensions.momentum, fullMark: 100 },
  ];
  
  const avgValue = (dimensions.technical + dimensions.capitalFlow + dimensions.volatility + dimensions.momentum) / 4;
  const color = getSentimentColor(avgValue);
  
  return (
    <ResponsiveContainer width="100%" height={250}>
      <RadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12 }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
        <Radar
          name="情绪得分"
          dataKey="value"
          stroke={color}
          fill={color}
          fillOpacity={0.5}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
};

/**
 * Historical trend chart
 */
const SentimentTrendChart: React.FC<{ history: SentimentHistoryPoint[] }> = ({ history }) => {
  const data = history.map(point => ({
    date: point.timestamp.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
    fearGreedIndex: point.fearGreedIndex,
    volume: point.volume / 1000000,
    price: point.price,
  }));
  
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 11 }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
        <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none' }} />
        <Legend />
        <Area yAxisId="left" type="monotone" dataKey="fearGreedIndex" name="恐惧贪婪指数" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
        <Line yAxisId="right" type="monotone" dataKey="price" name="价格" stroke="#82ca9d" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

/**
 * Alert zone indicators
 */
const AlertZones: React.FC<{ sentiment: SentimentData }> = ({ sentiment }) => {
  const zones = [
    { label: '极度恐惧', range: '0-20', value: 20, color: getSentimentColor(10) },
    { label: '恐惧', range: '20-40', value: 40, color: getSentimentColor(30) },
    { label: '中性', range: '40-60', value: 60, color: getSentimentColor(50) },
    { label: '贪婪', range: '60-80', value: 80, color: getSentimentColor(70) },
    { label: '极度贪婪', range: '80-100', value: 100, color: getSentimentColor(90) },
  ];
  
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {zones.map((zone, index) => (
        <div
          key={index}
          style={{
            flex: 1,
            minWidth: 80,
            padding: '8px 12px',
            borderRadius: 4,
            backgroundColor: sentiment.fearGreedIndex <= zone.value && 
              (index === 0 || sentiment.fearGreedIndex > zones[index - 1].value)
              ? zone.color + '40'
              : 'rgba(255,255,255,0.05)',
            border: `1px solid ${sentiment.fearGreedIndex <= zone.value && 
              (index === 0 || sentiment.fearGreedIndex > zones[index - 1].value)
              ? zone.color
              : 'rgba(255,255,255,0.1)'}`,
            textAlign: 'center',
          }}
        >
          <Text style={{ fontSize: 12, opacity: 0.7 }}>{zone.label}</Text>
          <br />
          <Text style={{ fontSize: 10, opacity: 0.5 }}>{zone.range}</Text>
        </div>
      ))}
    </div>
  );
};

/**
 * Main SentimentDashboard component
 */
const SentimentDashboard: React.FC<SentimentDashboardProps> = ({
  refreshInterval = 10000,
  historyDays = 30,
  compact = false,
  defaultTab = 'overview',
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [isMobile, setIsMobile] = useState(false);

  const { sentiment, history, loading, error, refresh, calculating } = useSentiment({
    refreshInterval,
    historyDays,
    enableHistory: true,
  });

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const getChangeIndicator = () => {
    if (!sentiment?.change) return null;
    
    const change = sentiment.change;
    const icon = change > 0 ? <IconArrowRise /> : change < 0 ? <IconArrowFall /> : <IconMinus />;
    const color = change > 0 ? 'rgb(0, 180, 42)' : change < 0 ? 'rgb(245, 63, 63)' : 'gray';
    
    return (
      <Tag color={color} icon={icon}>
        {change > 0 ? '+' : ''}{change}
      </Tag>
    );
  };

  if (loading && !sentiment) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size={32} />
          <div style={{ marginTop: 16, color: '#86909c' }}>加载情绪数据中...</div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Alert type="error" message="情绪数据加载失败" description={error} />
      </Card>
    );
  }

  if (!sentiment) {
    return (
      <Card>
        <Empty description="暂无情绪数据" />
      </Card>
    );
  }

  return (
    <ErrorBoundary>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title heading={4} style={{ margin: 0 }}>
            市场情绪仪表板
            {calculating && <Spin size={16} style={{ marginLeft: 8 }} />}
          </Title>
          <Space>
            {getChangeIndicator()}
            <Button type="text" size="small" icon={<IconRefresh />} onClick={refresh} loading={loading}>
              刷新
            </Button>
          </Space>
        </div>

        {compact ? (
          <Row gutter={16}>
            <Col span={8}>
              <Card>
                <SentimentGauge value={sentiment.fearGreedIndex} size={150} />
              </Card>
            </Col>
            <Col span={16}>
              <Card title="维度分析">
                <DimensionRadar dimensions={sentiment.dimensions} />
              </Card>
            </Col>
          </Row>
        ) : (
          <Tabs activeTab={activeTab} onChange={setActiveTab}>
            <TabPane key="overview" title="概览">
              <Row gutter={isMobile ? 8 : 16} style={{ marginBottom: 16 }}>
                <Col xs={24} md={8}>
                  <Card>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <SentimentGauge value={sentiment.fearGreedIndex} size={isMobile ? 180 : 220} />
                      <div style={{ marginTop: 16 }}>
                        <Tag color={getSentimentColor(sentiment.fearGreedIndex)} size="large">
                          {getSentimentDisplayText(sentiment.level)}
                        </Tag>
                      </div>
                    </div>
                  </Card>
                </Col>
                
                <Col xs={24} md={16}>
                  <Card title="情绪指标">
                    <Row gutter={16}>
                      <Col span={6}>
                        <Statistic title="波动率" value={sentiment.volatility.toFixed(1)} suffix="%" />
                      </Col>
                      <Col span={6}>
                        <Statistic title="动量" value={sentiment.priceMomentum > 0 ? '+' : ''} suffix={sentiment.priceMomentum.toFixed(1)} />
                      </Col>
                      <Col span={6}>
                        <Statistic title="成交量异常" value={sentiment.volumeAnomaly.toFixed(1)} suffix="/100" />
                      </Col>
                      <Col span={6}>
                        <Statistic title="信号" value={sentiment.signal.split('_')[0].toUpperCase()} valueStyle={{ fontSize: 14 }} />
                      </Col>
                    </Row>
                    <div style={{ marginTop: 24 }}>
                      <Alert type={sentiment.level === 'extreme_fear' || sentiment.level === 'extreme_greed' ? 'warning' : 'info'} message={getSignalDisplayText(sentiment.signal)} icon={<IconExclamationCircle />} />
                    </div>
                  </Card>
                </Col>
              </Row>

              <Card title="情绪区间" style={{ marginBottom: 16 }}>
                <AlertZones sentiment={sentiment} />
              </Card>

              <Row gutter={isMobile ? 8 : 16}>
                <Col xs={24} md={12}>
                  <Card title="维度分析">
                    <DimensionRadar dimensions={sentiment.dimensions} />
                  </Card>
                </Col>
                
                <Col xs={24} md={12}>
                  <Card title="维度详情">
                    <Space direction="vertical" style={{ width: '100%' }} size="large">
                      {[
                        { key: 'technical', label: '技术面情绪', value: sentiment.dimensions.technical },
                        { key: 'capitalFlow', label: '资金流情绪', value: sentiment.dimensions.capitalFlow },
                        { key: 'volatility', label: '波动率情绪', value: sentiment.dimensions.volatility },
                        { key: 'momentum', label: '动量情绪', value: sentiment.dimensions.momentum },
                      ].map(item => (
                        <div key={item.key}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text>{item.label}</Text>
                            <Text bold>{item.value}</Text>
                          </div>
                          <Progress percent={item.value} strokeColor={getSentimentColor(item.value)} showText={false} />
                        </div>
                      ))}
                    </Space>
                  </Card>
                </Col>
              </Row>
            </TabPane>

            <TabPane key="history" title="历史趋势">
              <Card>
                <SentimentTrendChart history={history} />
              </Card>
              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={6}>
                  <Card><Statistic title="最高值" value={Math.max(...history.map(h => h.fearGreedIndex))} /></Card>
                </Col>
                <Col span={6}>
                  <Card><Statistic title="最低值" value={Math.min(...history.map(h => h.fearGreedIndex))} /></Card>
                </Col>
                <Col span={6}>
                  <Card><Statistic title="平均值" value={(history.reduce((sum, h) => sum + h.fearGreedIndex, 0) / history.length).toFixed(1)} /></Card>
                </Col>
                <Col span={6}>
                  <Card><Statistic title="数据点" value={history.length} /></Card>
                </Col>
              </Row>
            </TabPane>

            <TabPane key="signals" title="交易信号">
              <Card title="当前信号">
                <Alert
                  type={sentiment.signal === 'extreme_fear_buy' ? 'success' : sentiment.signal === 'extreme_greed_sell' ? 'warning' : 'info'}
                  message={getSignalDisplayText(sentiment.signal)}
                  description={
                    sentiment.signal === 'extreme_fear_buy'
                      ? '市场处于极度恐慌状态，可能是逆向买入的好时机。但请务必做好风险管理。'
                      : sentiment.signal === 'extreme_greed_sell'
                      ? '市场处于极度贪婪状态，可能面临回调风险。考虑逐步减仓或设置止损。'
                      : '市场情绪相对稳定，建议维持当前策略，关注市场变化。'
                  }
                />
              </Card>
              <Card title="信号历史" style={{ marginTop: 16 }}>
                <Empty description="暂无历史信号记录" />
              </Card>
            </TabPane>
          </Tabs>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default SentimentDashboard;
