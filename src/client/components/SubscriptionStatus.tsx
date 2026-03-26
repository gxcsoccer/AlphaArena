/**
 * SubscriptionStatus Component
 * Displays user's current subscription status with upgrade/downgrade options
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Tag,
  Button,
  Space,
  Progress,
  Modal,
  Spin,
  Message,
  Divider,
  Tooltip,
} from '@arco-design/web-react';
import {
  IconStar,
  IconThunderbolt,
  IconTrophy,
  IconCheck,
  IconClose,
  IconRefresh,
  IconRight,
} from '@arco-design/web-react/icon';
import { useSubscription, usePlan } from '../hooks/useSubscription';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;

interface SubscriptionStatusProps {
  compact?: boolean;
  showActions?: boolean;
}

const SubscriptionStatus: React.FC<SubscriptionStatusProps> = ({
  compact = false,
  showActions = true,
}) => {
  const { t } = useTranslation('subscription');
  const navigate = useNavigate();
  const { subscription, loading, refresh, daysUntilExpiry } = useSubscription();
  const { plan, isFree, isPro, isEnterprise } = usePlan();

  const getPlanIcon = () => {
    switch (plan) {
      case 'free':
        return <IconStar style={{ fontSize: compact ? 20 : 32, color: '#86909c' }} />;
      case 'pro':
        return <IconThunderbolt style={{ fontSize: compact ? 20 : 32, color: '#165dff' }} />;
      case 'enterprise':
        return <IconTrophy style={{ fontSize: compact ? 20 : 32, color: '#f7ba1e' }} />;
      default:
        return <IconStar style={{ fontSize: compact ? 20 : 32 }} />;
    }
  };

  const getPlanColor = () => {
    switch (plan) {
      case 'free':
        return '#86909c';
      case 'pro':
        return '#165dff';
      case 'enterprise':
        return '#f7ba1e';
      default:
        return '#165dff';
    }
  };

  const getPlanName = () => {
    const names: Record<string, string> = {
      free: t('plans.free.name', '免费版'),
      pro: t('plans.pro.name', '专业版'),
      enterprise: t('plans.enterprise.name', '企业版'),
    };
    return names[plan] || plan;
  };

  const getStatusTag = () => {
    if (!subscription) {
      return <Tag color="gray">{t('status.inactive', '未激活')}</Tag>;
    }

    switch (subscription.status) {
      case 'active':
        return <Tag color="green">{t('status.active', '活跃')}</Tag>;
      case 'past_due':
        return <Tag color="orange">{t('status.pastDue', '逾期')}</Tag>;
      case 'canceled':
        return <Tag color="red">{t('status.canceled', '已取消')}</Tag>;
      case 'expired':
        return <Tag color="gray">{t('status.expired', '已过期')}</Tag>;
      default:
        return <Tag color="blue">{subscription.status}</Tag>;
    }
  };

  const handleUpgrade = () => {
    navigate('/subscription');
  };

  const handleManageSubscription = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('supabase_token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch('/api/subscriptions/portal', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to open billing portal');
      }

      const data = await response.json();
      if (data.portalUrl) {
        window.location.href = data.portalUrl;
      }
    } catch (error) {
      console.error('Portal error:', error);
      Message.error(t('manage.portalError', '打开管理面板失败'));
    }
  };

  if (loading) {
    return (
      <Card style={{ textAlign: 'center', padding: 24 }}>
        <Spin />
      </Card>
    );
  }

  // Compact version for header or sidebar
  if (compact) {
    return (
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8,
          padding: '8px 12px',
          background: `linear-gradient(135deg, ${getPlanColor()}15, ${getPlanColor()}05)`,
          borderRadius: 8,
          border: `1px solid ${getPlanColor()}30`,
          cursor: 'pointer',
        }}
        onClick={() => navigate('/subscription')}
      >
        {getPlanIcon()}
        <div>
          <Text strong style={{ fontSize: 13 }}>{getPlanName()}</Text>
          {isPro && daysUntilExpiry !== null && daysUntilExpiry <= 7 && (
            <Text type="warning" style={{ fontSize: 11, display: 'block' }}>
              {t('expirySoon', `${daysUntilExpiry} 天后到期`)}
            </Text>
          )}
        </div>
        {isFree && (
          <Button size="mini" type="primary" onClick={(e) => {
            e.stopPropagation();
            handleUpgrade();
          }}>
            {t('upgrade', '升级')}
          </Button>
        )}
      </div>
    );
  }

  // Full version for profile/settings page
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: `linear-gradient(135deg, ${getPlanColor()}20, ${getPlanColor()}10)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {getPlanIcon()}
          </div>
          <div>
            <Title heading={5} style={{ margin: 0, marginBottom: 4 }}>
              {getPlanName()}
            </Title>
            <Space>
              {getStatusTag()}
              {subscription?.trial_end && new Date(subscription.trial_end) > new Date() && (
                <Tag color="purple">{t('status.trial', '试用期')}</Tag>
              )}
            </Space>
          </div>
        </div>
        
        {showActions && (
          <Space>
            {isFree ? (
              <Button type="primary" onClick={handleUpgrade}>
                {t('upgradeToPro', '升级到专业版')}
              </Button>
            ) : (
              <Button onClick={handleManageSubscription}>
                {t('manageSubscription', '管理订阅')}
              </Button>
            )}
          </Space>
        )}
      </div>

      {/* Subscription Details */}
      {!isFree && subscription && (
        <>
          <Divider style={{ margin: '16px 0' }} />
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
            {/* Billing Period */}
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('billingPeriod', '计费周期')}
              </Text>
              <div>
                <Text strong>
                  {subscription.billing_period === 'yearly' 
                    ? t('yearly', '年付') 
                    : t('monthly', '月付')}
                </Text>
              </div>
            </div>

            {/* Next Billing Date */}
            {subscription.current_period_end && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('nextBilling', '下次计费')}
                </Text>
                <div>
                  <Text strong>
                    {new Date(subscription.current_period_end).toLocaleDateString('zh-CN')}
                  </Text>
                </div>
              </div>
            )}

            {/* Days Until Expiry */}
            {daysUntilExpiry !== null && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('daysRemaining', '剩余天数')}
                </Text>
                <div>
                  <Text strong={daysUntilExpiry <= 7} type={daysUntilExpiry <= 7 ? 'warning' : undefined}>
                    {daysUntilExpiry} {t('days', '天')}
                  </Text>
                </div>
              </div>
            )}
          </div>

          {/* Cancel Notice */}
          {subscription.cancel_at_period_end && (
            <div style={{ 
              marginTop: 16, 
              padding: 12, 
              background: 'var(--color-warning-light-1)', 
              borderRadius: 8 
            }}>
              <Text type="warning">
                {t('cancelNotice', '您的订阅将在当前周期结束后取消，您可以随时重新激活。')}
              </Text>
            </div>
          )}
        </>
      )}

      {/* Free Plan Usage */}
      {isFree && (
        <>
          <Divider style={{ margin: '16px 0' }} />
          <div>
            <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>
              {t('usage.title', '本月使用情况')}
            </Text>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text>{t('usage.strategies', '策略')}</Text>
                  <Text type="secondary">3/3</Text>
                </div>
                <Progress percent={100} color="#165dff" showText={false} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text>{t('usage.backtests', '回测')}</Text>
                  <Text type="secondary">8/10</Text>
                </div>
                <Progress percent={80} color="#165dff" showText={false} />
              </div>
            </Space>
          </div>
          
          <Button 
            type="primary" 
            long 
            style={{ marginTop: 16 }}
            onClick={handleUpgrade}
          >
            {t('upgradeForUnlimited', '升级解锁无限使用')}
          </Button>
        </>
      )}
    </Card>
  );
};

export default SubscriptionStatus;