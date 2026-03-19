/**
 * UsageProgress Component
 * Displays usage progress bar with limit information
 */

import React from 'react';
import { Progress, Space, Typography, Tooltip, Tag } from '@arco-design/web-react';
import { IconQuestionCircle } from '@arco-design/web-react/icon';

const { Text } = Typography;

interface UsageProgressProps {
  featureKey: string;
  label: string;
  current: number;
  limit: number;
  unit?: string;
  showWarning?: boolean;
  warningThreshold?: number;
  size?: 'small' | 'default' | 'large';
  style?: React.CSSProperties;
}

const UsageProgress: React.FC<UsageProgressProps> = ({
  featureKey,
  label,
  current,
  limit,
  unit = '',
  showWarning = true,
  warningThreshold = 80,
  size = 'default',
  style,
}) => {
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : Math.min(100, (current / limit) * 100);
  const remaining = isUnlimited ? -1 : Math.max(0, limit - current);
  const isNearLimit = percentage >= warningThreshold;
  const isAtLimit = percentage >= 100;

  const _getStatus = (): 'warning' | 'danger' | 'success' | 'normal' => {
    if (isAtLimit) return 'danger';
    if (isNearLimit && showWarning) return 'warning';
    return 'success';
  };

  const getColor = (): string => {
    if (isAtLimit) return '#f53f3f';
    if (isNearLimit && showWarning) return '#ff7d00';
    return '#00b42a';
  };

  const formatText = (): string => {
    if (isUnlimited) return '无限制';
    return `${current}${unit} / ${limit}${unit}`;
  };

  const getTooltipContent = (): string => {
    if (isUnlimited) return '您的计划支持无限使用';
    if (isAtLimit) return '您已达到今日使用限制，升级以获取更多';
    if (isNearLimit) return `还剩 ${remaining}${unit}，即将达到限制`;
    return `已使用 ${current}${unit}，剩余 ${remaining}${unit}`;
  };

  const sizeConfig = {
    small: { height: 6, fontSize: 12 },
    default: { height: 8, fontSize: 14 },
    large: { height: 12, fontSize: 16 },
  };

  return (
    <div style={{ ...style }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 4,
      }}>
        <Space size={4}>
          <Text style={{ fontSize: sizeConfig[size].fontSize }}>{label}</Text>
          {isNearLimit && showWarning && !isUnlimited && (
            <Tag color="orange" size="small">
              即将达到限制
            </Tag>
          )}
          {isAtLimit && (
            <Tag color="red" size="small">
              已达限制
            </Tag>
          )}
        </Space>
        <Tooltip content={getTooltipContent()}>
          <Space size={4} style={{ cursor: 'help' }}>
            <Text style={{ fontSize: sizeConfig[size].fontSize }}>
              {formatText()}
            </Text>
            <IconQuestionCircle style={{ color: '#86909c', fontSize: 14 }} />
          </Space>
        </Tooltip>
      </div>
      
      {!isUnlimited && (
        <Progress
          percent={percentage}
          style={{ marginTop: 4 }}
          strokeWidth={sizeConfig[size].height}
          color={getColor()}
          showText={false}
        />
      )}
      
      {isUnlimited && (
        <div style={{ 
          height: sizeConfig[size].height, 
          background: 'linear-gradient(90deg, #00b42a 0%, #165dff 100%)',
          borderRadius: 4,
          opacity: 0.6,
        }} />
      )}
    </div>
  );
};

export default UsageProgress;
