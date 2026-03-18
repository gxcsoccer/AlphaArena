/**
 * SchedulerStatusIndicator Component
 * Displays real-time scheduler status with animations
 */

import React from 'react';
import { Badge, Space, Typography, Tooltip, Spin } from '@arco-design/web-react';
import {
  IconCheckCircle,
  IconCloseCircle,
  IconPauseCircle,
  IconSync,
} from '@arco-design/web-react/icon';
import { useSchedulerStatus } from '../hooks/useSchedulerRealtime';

const { Text } = Typography;

interface SchedulerStatusIndicatorProps {
  userId: string | undefined;
  showDetails?: boolean;
  compact?: boolean;
}

const SchedulerStatusIndicator: React.FC<SchedulerStatusIndicatorProps> = ({
  userId,
  showDetails = true,
  compact = false,
}) => {
  const { isConnected, isReconnecting, schedulerStatus, activeJobs, statusColor, statusText } = 
    useSchedulerStatus(userId);

  // Connection status indicator
  const connectionIndicator = !isConnected ? (
    <Tooltip content={isReconnecting ? '正在重连...' : '未连接到实时服务'}>
      <Badge status="offline" />
    </Tooltip>
  ) : (
    <Badge status="online" />
  );

  // Status icon based on scheduler state
  const StatusIcon = schedulerStatus === 'running' ? IconCheckCircle :
                     schedulerStatus === 'paused' ? IconPauseCircle :
                     schedulerStatus === 'stopped' ? IconCloseCircle :
                     IconSync;

  // Animation for running state
  const iconStyle: React.CSSProperties = {
    fontSize: compact ? 16 : 20,
    color: statusColor === 'green' ? 'rgb(var(--success-6))' :
           statusColor === 'orange' ? 'rgb(var(--warning-6))' :
           'rgb(var(--gray-6))',
    animation: schedulerStatus === 'running' ? 'pulse 2s ease-in-out infinite' : 'none',
  };

  // Compact mode: just show the badge
  if (compact) {
    return (
      <Tooltip
        content={
          <Space direction="vertical" size="small">
            <Text>状态: {statusText}</Text>
            {showDetails && isConnected && (
              <Text type="secondary">活跃任务: {activeJobs}</Text>
            )}
            {!isConnected && (
              <Text type="warning">{isReconnecting ? '正在重连...' : '未连接'}</Text>
            )}
          </Space>
        }
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {isReconnecting && <Spin size={12} />}
          <StatusIcon style={iconStyle} />
        </div>
      </Tooltip>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 8,
      padding: '8px 12px',
      backgroundColor: 'var(--color-fill-1)',
      borderRadius: 4,
    }}>
      {connectionIndicator}
      
      <Space size={4}>
        {isReconnecting && <Spin size={14} />}
        <StatusIcon style={iconStyle} />
        <Text>{statusText}</Text>
      </Space>

      {showDetails && isConnected && (
        <>
          <Text type="secondary">|</Text>
          <Text type="secondary">活跃任务: {activeJobs}</Text>
        </>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default SchedulerStatusIndicator;