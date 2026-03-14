/**
 * Offline Indicator Component
 * 
 * Displays a banner/toast when WebSocket connection is lost
 * Shows reconnection progress and auto-hides when reconnected
 */

import React from 'react';
import { Alert, Tag, Progress } from '@arco-design/web-react';
import { IconClose, IconSync, IconCheckCircle, IconExclamationCircle } from '@arco-design/web-react/icon';
import { useConnection } from '../store/connectionStore';

const ReconnectingIcon = IconSync;
const ConnectedIcon = IconCheckCircle;
const WarningIcon = IconExclamationCircle;

const OfflineIndicator: React.FC = () => {
  const { status, isOnline, quality, lastDisconnectedAt } = useConnection();

  // Don't show if connected and online
  if (status === 'connected' && isOnline) {
    return null;
  }

  // Determine the type of alert based on status
  const getAlertType = () => {
    if (!isOnline) return 'warning';
    if (status === 'reconnecting') return 'warning';
    if (status === 'connecting') return 'info';
    return 'error';
  };

  // Get the message based on status
  const getMessage = () => {
    if (!isOnline) {
      return '网络已断开 - 请检查您的网络连接';
    }
    
    switch (status) {
      case 'connecting':
        return '正在连接服务器...';
      case 'reconnecting':
        return `连接断开 - 正在重试 (${quality.reconnectAttempts})`;
      case 'disconnected':
        return '连接已断开';
      default:
        return '连接状态异常';
    }
  };

  // Calculate reconnect progress (visual indicator)
  const getReconnectProgress = () => {
    if (status !== 'reconnecting') return null;
    
    // Estimate progress based on attempt number
    // Each attempt takes progressively longer due to exponential backoff
    const maxAttempts = 6; // After 6 attempts, we're at ~32 seconds (near max)
    const progress = Math.min(100, (quality.reconnectAttempts / maxAttempts) * 100);
    
    return (
      <div style={{ marginTop: 8 }}>
        <Progress 
          percent={progress} 
          size="small" 
          status={progress >= 100 ? 'warning' : 'normal'}
          showText={false}
        />
        <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4 }}>
          下次重试间隔：~{Math.min(30, Math.pow(2, quality.reconnectAttempts - 1))}秒
        </div>
      </div>
    );
  };

  // Get status tag
  const getStatusTag = () => {
    const statusConfig = {
      connected: { color: 'green', text: '已连接' },
      connecting: { color: 'blue', text: '连接中' },
      reconnecting: { color: 'orange', text: '重连中' },
      disconnected: { color: 'red', text: '已断开' },
    };

    const config = statusConfig[status] || { color: 'gray', text: '未知' };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // Get connection quality indicator
  const getQualityIndicator = () => {
    if (status !== 'connected') return null;

    let qualityText = '';
    let qualityColor = 'green';

    if (quality.latency < 100) {
      qualityText = `延迟：${quality.latency}ms`;
      qualityColor = 'green';
    } else if (quality.latency < 300) {
      qualityText = `延迟：${quality.latency}ms`;
      qualityColor = 'orange';
    } else {
      qualityText = `延迟：${quality.latency}ms`;
      qualityColor = 'red';
    }

    if (quality.isStale) {
      qualityText = '连接可能已过期';
      qualityColor = 'red';
    }

    return (
      <Tag color={qualityColor} size="small">
        {qualityText}
      </Tag>
    );
  };

  return (
    <Alert
      type={getAlertType()}
      message={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1 }}>{getMessage()}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {getStatusTag()}
              {getQualityIndicator()}
            </div>
          </div>
          {getReconnectProgress()}
        </div>
      }
      closable
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        borderRadius: 0,
        margin: 0,
      }}
    />
  );
};

export default OfflineIndicator;
