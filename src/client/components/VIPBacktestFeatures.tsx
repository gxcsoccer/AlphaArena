/**
 * VIP Features Integration Example
 * Demonstrates how to integrate VIP-only features into existing pages
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
  Grid,
  Space,
  Tag,
  Typography,
  Button,
  Message,
  Divider,
  Alert,
} from '@arco-design/web-react';
import {
  IconCrown,
  IconLock,
  IconUnlock,
} from '@arco-design/web-react/icon';
import { useSubscription } from '../hooks/useSubscription';
import FeatureGate from '../components/FeatureGate';
import AdvancedChartIndicators from '../components/AdvancedChartIndicators';
import MultiTimeframeCharts from '../components/MultiTimeframeCharts';
import BacktestEnhancement from '../components/BacktestEnhancement';
import { useHistoricalDataPermission } from '../hooks/useHistoricalDataPermission';

const { Row, Col } = Grid;
const { Title, Text } = Typography;

/**
 * VIP Feature Status Badge
 */
export const VIPFeatureBadge: React.FC<{
  featureName: string;
  requiredPlan: 'pro' | 'enterprise';
}> = ({ featureName, requiredPlan }) => {
  const { isPro } = useSubscription();

  if (isPro && requiredPlan === 'pro') {
    return (
      <Tag icon={<IconUnlock />} color="green">
        {featureName} - 已解锁
      </Tag>
    );
  }

  return (
    <Tag icon={<IconLock />} color="orange">
      {featureName} - 需要 {requiredPlan === 'pro' ? 'Pro' : 'Enterprise'}
    </Tag>
  );
};

/**
 * VIP Features Dashboard
 * Shows all VIP features and their access status
 */
export const VIPFeaturesDashboard: React.FC = () => {
  const { isPro, subscription } = useSubscription();
  const { limit: historicalDataLimit } = useHistoricalDataPermission();

  const features = useMemo(
    () => [
      {
        category: '高级图表',
        items: [
          {
            name: '技术指标叠加',
            description: 'MACD、RSI、布林带等多种指标',
            requiredPlan: 'pro' as const,
            key: 'advanced_charts',
          },
          {
            name: '多时间框架',
            description: '同时查看多个时间框架',
            requiredPlan: 'pro' as const,
            key: 'multi_timeframe',
          },
          {
            name: '图表模板保存',
            description: '保存个人图表配置',
            requiredPlan: 'pro' as const,
            key: 'chart_templates',
          },
          {
            name: '图表导出',
            description: '导出图表截图',
            requiredPlan: 'pro' as const,
            key: 'chart_export',
          },
        ],
      },
      {
        category: '策略回测',
        items: [
          {
            name: '参数优化',
            description: '自动寻找最优参数',
            requiredPlan: 'pro' as const,
            key: 'backtest_optimization',
          },
          {
            name: '多策略对比',
            description: '同时对比多个策略表现',
            requiredPlan: 'pro' as const,
            key: 'strategy_comparison',
          },
          {
            name: '回测报告导出',
            description: '导出 PDF/Excel 报告',
            requiredPlan: 'pro' as const,
            key: 'backtest_export',
          },
          {
            name: '历史记录保存',
            description: '保存回测历史记录',
            requiredPlan: 'pro' as const,
            key: 'backtest_history',
          },
        ],
      },
      {
        category: '历史数据',
        items: [
          {
            name: `${historicalDataLimit.description}`,
            description: historicalDataLimit.isUnlimited
              ? '无限制访问历史数据'
              : `访问最近 ${historicalDataLimit.maxDays} 天数据`,
            requiredPlan: historicalDataLimit.isUnlimited ? ('enterprise' as const) : ('pro' as const),
            key: 'historical_data',
            status: 'active' as const,
          },
        ],
      },
    ],
    [historicalDataLimit]
  );

  return (
    <Card title={<Space><IconCrown style={{ color: '#fa8c16' }} /><Title heading={5}>VIP 功能一览</Title></Space>}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {features.map((category) => (
          <div key={category.category}>
            <Text bold style={{ fontSize: 16 }}>{category.category}</Text>
            <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
              {category.items.map((item) => (
                <Col span={6} key={item.key}>
                  <Card
                    size="small"
                    style={{
                      height: '100%',
                      background: isPro ? 'var(--color-fill-1)' : 'var(--color-fill-2)',
                    }}
                  >
                    <Space direction="vertical" size="small">
                      <VIPFeatureBadge
                        featureName={item.name}
                        requiredPlan={item.requiredPlan}
                      />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.description}
                      </Text>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        ))}
      </Space>
    </Card>
  );
};

/**
 * Historical Data Limit Alert
 * Shows user's current data limit and usage
 */
export const HistoricalDataLimitAlert: React.FC = () => {
  const { limit, loading } = useHistoricalDataPermission();

  if (loading) return null;

  if (limit.isUnlimited) {
    return (
      <Alert
        type="success"
        content="您拥有无限历史数据访问权限"
        showIcon
      />
    );
  }

  return (
    <Alert
      type="info"
      content={
        <Space>
          <span>您的订阅计划允许访问最近 {limit.maxDays} 天的历史数据。</span>
          <Button size="small" type="text" onClick={() => (window.location.href = '/pricing')}>
            升级以获取更多数据
          </Button>
        </Space>
      }
      showIcon
    />
  );
};

/**
 * Feature Comparison Table
 * Shows feature comparison between Free, Pro, and Enterprise
 */
export const FeatureComparisonTable: React.FC = () => {
  const features = [
    { feature: '技术指标叠加', free: false, pro: true, enterprise: true },
    { feature: '多时间框架图表', free: false, pro: true, enterprise: true },
    { feature: '参数优化', free: false, pro: true, enterprise: true },
    { feature: '多策略对比', free: false, pro: true, enterprise: true },
    { feature: '回测报告导出', free: false, pro: true, enterprise: true },
    { feature: '历史数据', free: '7 天', pro: '30 天', enterprise: '无限' },
    { feature: '图表模板保存', free: false, pro: true, enterprise: true },
    { feature: '优先客服支持', free: false, pro: true, enterprise: true },
  ];

  return (
    <Card title="功能对比">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={headerStyle}>功能</th>
            <th style={headerStyle}>Free</th>
            <th style={{ ...headerStyle, background: '#e6f7ff' }}>Pro</th>
            <th style={{ ...headerStyle, background: '#fff7e6' }}>Enterprise</th>
          </tr>
        </thead>
        <tbody>
          {features.map((row, index) => (
            <tr key={index} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={cellStyle}>{row.feature}</td>
              <td style={cellStyle}>
                {typeof row.free === 'boolean' ? (
                  row.free ? '✓' : '✗'
                ) : (
                  row.free
                )}
              </td>
              <td style={{ ...cellStyle, background: '#f0f9ff' }}>
                {typeof row.pro === 'boolean' ? (
                  row.pro ? <Tag color="green">✓</Tag> : '✗'
                ) : (
                  <Tag color="blue">{row.pro}</Tag>
                )}
              </td>
              <td style={{ ...cellStyle, background: '#fffbe6' }}>
                {typeof row.enterprise === 'boolean' ? (
                  row.enterprise ? <Tag color="green">✓</Tag> : '✗'
                ) : (
                  <Tag color="orange">{row.enterprise}</Tag>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
};

const headerStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  borderBottom: '2px solid var(--color-border)',
  fontWeight: 'bold',
};

const cellStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'center',
};

/**
 * Example: Integration in BacktestVisualizationPage
 */
export const BacktestPageWithVIP: React.FC = () => {
  const [symbol] = useState('BTC/USD');
  const [strategyId] = useState('sma');

  return (
    <div>
      {/* Show data limit */}
      <HistoricalDataLimitAlert />

      <Divider />

      {/* VIP Features Dashboard */}
      <VIPFeaturesDashboard />

      <Divider />

      {/* Multi-timeframe charts - VIP only */}
      <FeatureGate featureKey="multi_timeframe_charts" featureName="多时间框架图表">
        <MultiTimeframeCharts symbol={symbol} />
      </FeatureGate>

      <Divider />

      {/* Backtest Enhancement - VIP only */}
      <FeatureGate featureKey="advanced_backtest" featureName="高级回测功能">
        <BacktestEnhancement strategyId={strategyId} symbol={symbol} />
      </FeatureGate>

      <Divider />

      {/* Feature Comparison */}
      <FeatureComparisonTable />
    </div>
  );
};

export default VIPFeaturesDashboard;