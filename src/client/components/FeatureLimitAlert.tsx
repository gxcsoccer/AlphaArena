/**
 * FeatureLimitAlert Component
 * Alert banner that shows when a feature is limited or locked
 */

import React from 'react';
import { Alert, Button, Space, Typography } from '@arco-design/web-react';
import { IconLock, IconInfoCircle } from '@arco-design/web-react/icon';

const { Text } = Typography;

interface FeatureLimitAlertProps {
  type: 'limit-reached' | 'near-limit' | 'locked';
  featureName: string;
  currentUsage?: number;
  limit?: number;
  unit?: string;
  onUpgrade?: () => void;
  upgradeText?: string;
  style?: React.CSSProperties;
}

const FeatureLimitAlert: React.FC<FeatureLimitAlertProps> = ({
  type,
  featureName,
  currentUsage,
  limit,
  unit = '',
  onUpgrade,
  upgradeText = '升级',
  style,
}) => {
  const getAlertConfig = () => {
    switch (type) {
      case 'limit-reached':
        return {
          type: 'warning' as const,
          icon: <IconInfoCircle />,
          title: `${featureName}已达限制`,
          description: limit 
            ? `您今日已使用 ${currentUsage}${unit}，已达到 ${limit}${unit} 的限制。升级以获取更多使用额度。`
            : `您已达到 ${featureName} 的使用限制。升级以获取更多使用额度。`,
        };
      case 'near-limit':
        return {
          type: 'info' as const,
          icon: <IconInfoCircle />,
          title: `${featureName}即将达到限制`,
          description: limit && currentUsage !== undefined
            ? `您今日已使用 ${currentUsage}${unit}，剩余 ${limit - currentUsage}${unit}。建议升级以避免限制。`
            : `您的 ${featureName} 使用量即将达到限制。建议升级以避免限制。`,
        };
      case 'locked':
        return {
          type: 'info' as const,
          icon: <IconLock />,
          title: `${featureName}需要升级`,
          description: `${featureName}是专业版功能。升级以解锁此功能。`,
        };
    }
  };

  const config = getAlertConfig();

  return (
    <Alert
      type={config.type}
      icon={config.icon}
      style={{ ...style }}
      content={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <Text strong>{config.title}</Text>
            <Text type="secondary" style={{ marginLeft: 8 }}>
              {config.description}
            </Text>
          </div>
          {onUpgrade && (
            <Button 
              type="primary" 
              size="small"
              onClick={onUpgrade}
            >
              {upgradeText}
            </Button>
          )}
        </div>
      }
    />
  );
};

export default FeatureLimitAlert;
