/**
 * UsageDashboard Component
 * Widget showing subscription usage and limits
 */

import React, { useState } from 'react';
import {
  Card,
  Typography,
  Space,
  Button,
  Grid,
  Tag,
  Skeleton,
  Divider,
} from '@arco-design/web-react';
import {
  IconThunderbolt,
  IconTrophy,
  IconStar,
  IconRight,
  IconQuestionCircle,
} from '@arco-design/web-react/icon';
import UsageProgress from './UsageProgress';
import UpgradeModal from './UpgradeModal';
import HelpButton, { HelpButtons } from './HelpButton';
import { useSubscription } from '../hooks/useSubscription';

const { Title, Text } = Typography;
const { Row, Col } = Grid;

interface UsageDashboardProps {
  compact?: boolean;
  showUpgradeButton?: boolean;
  style?: React.CSSProperties;
}

const UsageDashboard: React.FC<UsageDashboardProps> = ({
  compact = false,
  showUpgradeButton = true,
  style,
}) => {
  const { subscription, usage, isLoading, isPro, isEnterprise } = useSubscription();
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);

  const handleUpgrade = async (planId: string) => {
    // Navigate to subscription page
    window.location.href = '/subscription';
  };

  const getPlanIcon = () => {
    if (isEnterprise) return <IconTrophy style={{ fontSize: 24, color: '#f7ba1e' }} />;
    if (isPro) return <IconThunderbolt style={{ fontSize: 24, color: '#165dff' }} />;
    return <IconStar style={{ fontSize: 24, color: '#86909c' }} />;
  };

  const getPlanTag = () => {
    if (isEnterprise) return <Tag color="gold">企业版</Tag>;
    if (isPro) return <Tag color="arcoblue">专业版</Tag>;
    return <Tag color="gray">免费版</Tag>;
  };

  if (isLoading) {
    return (
      <Card style={style}>
        <Skeleton text={{ rows: 3 }} animation />
      </Card>
    );
  }

  if (compact) {
    return (
      <Card style={style}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space>
            {getPlanIcon()}
            <div>
              <Text strong>{subscription?.planName || '免费版'}</Text>
              {getPlanTag()}
            </div>
          </Space>
          {!isPro && showUpgradeButton && (
            <Button 
              type="primary" 
              size="small"
              onClick={() => setUpgradeModalVisible(true)}
            >
              升级
            </Button>
          )}
        </div>
        
        {!isPro && (
          <div style={{ marginTop: 12 }}>
            <UsageProgress
              featureKey="dailyBacktests"
              label="今日回测"
              current={usage.dailyBacktests?.currentUsage || 0}
              limit={usage.dailyBacktests?.limit || 10}
              unit="次"
              size="small"
            />
          </div>
        )}

        <UpgradeModal
          visible={upgradeModalVisible}
          onClose={() => setUpgradeModalVisible(false)}
          onUpgrade={handleUpgrade}
          currentPlan={subscription?.planId}
        />
      </Card>
    );
  }

  return (
    <Card style={style}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Title heading={5} style={{ margin: 0 }}>
            订阅与用量
          </Title>
          <HelpButton
            compact
            type="text"
            size="mini"
            {...HelpButtons.limits}
          />
        </div>
        {!isPro && showUpgradeButton && (
          <Button 
            type="primary" 
            size="small"
            onClick={() => setUpgradeModalVisible(true)}
          >
            升级到专业版
          </Button>
        )}
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* Plan Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        {getPlanIcon()}
        <div>
          <Text strong style={{ fontSize: 16 }}>{subscription?.planName || '免费版'}</Text>
          {getPlanTag()}
          {subscription?.status === 'active' && (
            <Tag color="green" style={{ marginLeft: 8 }}>活跃</Tag>
          )}
          {subscription?.cancelAtPeriodEnd && (
            <Tag color="orange" style={{ marginLeft: 8 }}>已取消</Tag>
          )}
        </div>
      </div>

      {/* Usage Progress */}
      {subscription && (
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <UsageProgress
            featureKey="concurrentStrategies"
            label="并发策略"
            current={usage.concurrentStrategies?.currentUsage || 0}
            limit={subscription.limits.concurrentStrategies}
            unit="个"
          />
          
          <UsageProgress
            featureKey="dailyBacktests"
            label="今日回测"
            current={usage.dailyBacktests?.currentUsage || 0}
            limit={subscription.limits.dailyBacktests}
            unit="次"
          />

          <UsageProgress
            featureKey="apiCalls"
            label="API 调用"
            current={usage.apiCalls?.currentUsage || 0}
            limit={subscription.limits.apiCalls}
            unit="次"
          />
        </Space>
      )}

      {/* Pro Benefits */}
      {isPro && (
        <div style={{ 
          marginTop: 16, 
          padding: 12, 
          background: 'linear-gradient(135deg, #e8f3ff 0%, #f2f3f5 100%)',
          borderRadius: 8,
        }}>
          <Text type="secondary">
            ✨ 您已解锁所有专业版功能
          </Text>
        </div>
      )}

      {/* Upgrade Prompt */}
      {!isPro && (
        <div style={{ 
          marginTop: 16, 
          padding: 12, 
          background: '#fffbe8',
          borderRadius: 8,
          cursor: 'pointer',
        }}
        onClick={() => setUpgradeModalVisible(true)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Text strong>升级到专业版</Text>
              <Text type="secondary" style={{ marginLeft: 8 }}>
                解锁无限回测、AI 助手等高级功能
              </Text>
            </div>
            <IconRight style={{ color: '#86909c' }} />
          </div>
        </div>
      )}

      <UpgradeModal
        visible={upgradeModalVisible}
        onClose={() => setUpgradeModalVisible(false)}
        onUpgrade={handleUpgrade}
        currentPlan={subscription?.planId}
      />
    </Card>
  );
};

export default UsageDashboard;
