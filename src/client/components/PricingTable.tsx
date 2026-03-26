/**
 * PlanCard Component
 * Individual plan card for subscription display
 * Issue #638: VIP 订阅管理 UI
 */

import React from 'react';
import {
  Card,
  Typography,
  Button,
  Tag,
  List,
  Space,
  Divider,
} from '@arco-design/web-react';
import {
  IconCheck,
  IconStar,
  IconTrophy,
  IconThunderbolt,
} from '@arco-design/web-react/icon';
import { SubscriptionPlan } from '../../types/subscription.types';

const { Title, Text } = Typography;

interface PlanCardProps {
  plan: SubscriptionPlan;
  name: string;
  price: number;
  originalPrice?: number;
  currency?: string;
  period?: 'monthly' | 'yearly';
  features: string[];
  isPopular?: boolean;
  isCurrentPlan?: boolean;
  loading?: boolean;
  onSelect?: () => void;
  onSelectLabel?: string;
  badges?: string[];
}

const PLAN_ICONS: Record<SubscriptionPlan, React.ReactNode> = {
  free: <IconStar style={{ fontSize: 40, color: '#86909c' }} />,
  pro: <IconThunderbolt style={{ fontSize: 40, color: '#165dff' }} />,
  enterprise: <IconTrophy style={{ fontSize: 40, color: '#f7ba1e' }} />,
};

const PLAN_COLORS: Record<SubscriptionPlan, string> = {
  free: '#86909c',
  pro: '#165dff',
  enterprise: '#f7ba1e',
};

const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  name,
  price,
  originalPrice,
  currency = 'CNY',
  period = 'monthly',
  features,
  isPopular = false,
  isCurrentPlan = false,
  loading = false,
  onSelect,
  onSelectLabel = '立即选择',
  badges = [],
}) => {
  const color = PLAN_COLORS[plan];

  const formatPrice = () => {
    if (price === 0) return '免费';
    const symbol = currency === 'CNY' ? '¥' : '$';
    return `${symbol}${price.toLocaleString()}/${period === 'yearly' ? '年' : '月'}`;
  };

  const getButtonLabel = () => {
    if (isCurrentPlan) return '当前计划';
    if (plan === 'enterprise') return '联系销售';
    return onSelectLabel;
  };

  return (
    <Card
      style={{
        height: '100%',
        borderColor: isPopular ? color : undefined,
        borderWidth: isPopular ? 2 : 1,
        position: 'relative',
      }}
      hoverable
    >
      {/* Popular Badge */}
      {isPopular && (
        <div
          style={{
            position: 'absolute',
            top: -1,
            right: 16,
            background: color,
            color: 'white',
            padding: '4px 12px',
            borderRadius: '0 0 8px 8px',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          最受欢迎
        </div>
      )}

      {/* Current Plan Badge */}
      {isCurrentPlan && (
        <Tag
          color="green"
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
          }}
        >
          当前计划
        </Tag>
      )}

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24, paddingTop: isCurrentPlan ? 24 : 0 }}>
        {PLAN_ICONS[plan]}
        <Title heading={4} style={{ marginTop: 16, marginBottom: 8 }}>
          {name}
        </Title>

        {/* Price */}
        <div style={{ marginBottom: 8 }}>
          <Text
            style={{
              fontSize: 36,
              fontWeight: 'bold',
              color,
            }}
          >
            {formatPrice()}
          </Text>
          {originalPrice && originalPrice > price && (
            <Text
              delete
              type="secondary"
              style={{ marginLeft: 8, fontSize: 16 }}
            >
              {currency === 'CNY' ? '¥' : '$'}
              {originalPrice.toLocaleString()}
            </Text>
          )}
        </div>

        {/* Badges */}
        {badges.length > 0 && (
          <Space size={4}>
            {badges.map((badge, index) => (
              <Tag key={index} color="arcoblue" size="small">
                {badge}
              </Tag>
            ))}
          </Space>
        )}
      </div>

      <Divider style={{ margin: '16px 0' }} />

      {/* Features */}
      <List
        size="small"
        dataSource={features}
        renderItem={(feature) => (
          <List.Item style={{ border: 'none', padding: '8px 0' }}>
            <Space>
              <IconCheck style={{ color: '#00b42a' }} />
              <Text>{feature}</Text>
            </Space>
          </List.Item>
        )}
      />

      {/* Action Button */}
      <div style={{ marginTop: 24 }}>
        <Button
          long
          type={isPopular ? 'primary' : 'outline'}
          size="large"
          loading={loading}
          disabled={isCurrentPlan}
          onClick={onSelect}
          style={
            plan === 'enterprise' && !isCurrentPlan
              ? { background: color, borderColor: color, color: 'white' }
              : undefined
          }
        >
          {getButtonLabel()}
        </Button>
      </div>
    </Card>
  );
};

/**
 * PricingTable Component
 * Comparison table for subscription plans
 */

interface PricingTableProps {
  onSelectPlan?: (plan: SubscriptionPlan) => void;
  currentPlan?: SubscriptionPlan;
  billingPeriod?: 'monthly' | 'yearly';
}

const PLAN_FEATURES = {
  strategies: {
    name: '策略数量',
    free: '1',
    pro: '10',
    enterprise: '无限',
  },
  backtests: {
    name: '每日回测',
    free: '1 次',
    pro: '50 次',
    enterprise: '无限',
  },
  historical_data: {
    name: '历史数据',
    free: '7 天',
    pro: '30 天',
    enterprise: '无限',
  },
  api_calls: {
    name: 'API 调用',
    free: '100/天',
    pro: '10,000/天',
    enterprise: '无限',
  },
  real_time: {
    name: '实时行情',
    free: false,
    pro: true,
    enterprise: true,
  },
  ai_assistant: {
    name: 'AI 助手',
    free: false,
    pro: true,
    enterprise: true,
  },
  support: {
    name: '客户支持',
    free: '社区',
    pro: '优先邮件',
    enterprise: '专属经理',
  },
};

const PricingTable: React.FC<PricingTableProps> = ({
  onSelectPlan,
  currentPlan,
  billingPeriod = 'monthly',
}) => {
  const renderValue = (value: string | boolean) => {
    if (typeof value === 'boolean') {
      return value ? (
        <IconCheck style={{ color: '#00b42a', fontSize: 20 }} />
      ) : (
        <span style={{ color: '#c9cdd4' }}>—</span>
      );
    }
    return <Text>{value}</Text>;
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
            <th style={{ textAlign: 'left', padding: '16px', width: '30%' }}>功能</th>
            <th
              style={{
                textAlign: 'center',
                padding: '16px',
                background: currentPlan === 'free' ? 'var(--color-primary-light-1)' : 'transparent',
              }}
            >
              <Space direction="vertical" size={4}>
                <Text style={{ fontWeight: 500 }}>免费版</Text>
                <Text type="secondary">¥0</Text>
              </Space>
            </th>
            <th
              style={{
                textAlign: 'center',
                padding: '16px',
                background: currentPlan === 'pro' ? 'var(--color-primary-light-1)' : 'var(--color-fill-1)',
              }}
            >
              <Space direction="vertical" size={4}>
                <Text style={{ fontWeight: 500, color: '#165dff' }}>专业版</Text>
                <Text type="secondary">¥{billingPeriod === 'yearly' ? '990/年' : '99/月'}</Text>
              </Space>
            </th>
            <th
              style={{
                textAlign: 'center',
                padding: '16px',
                background: currentPlan === 'enterprise' ? 'var(--color-primary-light-1)' : 'transparent',
              }}
            >
              <Space direction="vertical" size={4}>
                <Text style={{ fontWeight: 500, color: '#f7ba1e' }}>企业版</Text>
                <Text type="secondary">联系销售</Text>
              </Space>
            </th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(PLAN_FEATURES).map(([key, feature], index) => (
            <tr
              key={key}
              style={{
                borderBottom: '1px solid var(--color-border)',
                background: index % 2 === 0 ? 'var(--color-fill-1)' : 'transparent',
              }}
            >
              <td style={{ padding: '12px 16px' }}>
                <Text>{feature.name}</Text>
              </td>
              <td
                style={{
                  textAlign: 'center',
                  padding: '12px 16px',
                  background: currentPlan === 'free' ? 'var(--color-primary-light-1)' : 'transparent',
                }}
              >
                {renderValue(feature.free)}
              </td>
              <td
                style={{
                  textAlign: 'center',
                  padding: '12px 16px',
                  background: currentPlan === 'pro' ? 'var(--color-primary-light-1)' : 'var(--color-fill-1)',
                }}
              >
                {renderValue(feature.pro)}
              </td>
              <td
                style={{
                  textAlign: 'center',
                  padding: '12px 16px',
                  background: currentPlan === 'enterprise' ? 'var(--color-primary-light-1)' : 'transparent',
                }}
              >
                {renderValue(feature.enterprise)}
              </td>
            </tr>
          ))}
          <tr>
            <td style={{ padding: '16px' }} />
            <td
              style={{
                textAlign: 'center',
                padding: '16px',
                background: currentPlan === 'free' ? 'var(--color-primary-light-1)' : 'transparent',
              }}
            >
              <Button
                type={currentPlan === 'free' ? 'primary' : 'outline'}
                size="small"
                disabled={currentPlan === 'free'}
                onClick={() => onSelectPlan?.('free')}
              >
                {currentPlan === 'free' ? '当前计划' : '选择'}
              </Button>
            </td>
            <td
              style={{
                textAlign: 'center',
                padding: '16px',
                background: currentPlan === 'pro' ? 'var(--color-primary-light-1)' : 'var(--color-fill-1)',
              }}
            >
              <Button
                type={currentPlan === 'pro' ? 'primary' : 'outline'}
                size="small"
                disabled={currentPlan === 'pro'}
                onClick={() => onSelectPlan?.('pro')}
              >
                {currentPlan === 'pro' ? '当前计划' : '选择'}
              </Button>
            </td>
            <td
              style={{
                textAlign: 'center',
                padding: '16px',
                background: currentPlan === 'enterprise' ? 'var(--color-primary-light-1)' : 'transparent',
              }}
            >
              <Button
                type={currentPlan === 'enterprise' ? 'primary' : 'outline'}
                size="small"
                disabled={currentPlan === 'enterprise'}
                onClick={() => onSelectPlan?.('enterprise')}
              >
                {currentPlan === 'enterprise' ? '当前计划' : '联系销售'}
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export { PlanCard, PricingTable };
export default PlanCard;