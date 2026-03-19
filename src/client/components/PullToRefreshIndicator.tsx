import React from 'react';
import { Spin, Typography } from '@arco-design/web-react';
import { IconRefresh } from '@arco-design/web-react/icon';
import './PullToRefreshIndicator.css';

const { Text } = Typography;

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  threshold: number;
  isRefreshing: boolean;
}

/**
 * PullToRefreshIndicator - Visual indicator for pull-to-refresh gesture
 * 
 * Shows:
 * - Pull down arrow when pulling
 * - Spinner when refreshing
 * - Animated progress based on pull distance
 */
const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  pullDistance,
  threshold,
  isRefreshing,
}) => {
  const progress = Math.min(pullDistance / threshold, 1);
  const willRefresh = pullDistance >= threshold;
  
  return (
    <div 
      className="pull-to-refresh-indicator"
      style={{
        transform: `translateY(${Math.max(pullDistance - 40, -40)}px)`,
        opacity: Math.min(pullDistance / 20, 1),
      }}
    >
      {isRefreshing ? (
        <div className="pull-to-refresh-indicator__spinner">
          <Spin size={24} />
          <Text type="secondary" className="pull-to-refresh-indicator__text">
            刷新中...
          </Text>
        </div>
      ) : (
        <div className="pull-to-refresh-indicator__pull">
          <div 
            className="pull-to-refresh-indicator__icon"
            style={{
              transform: `rotate(${progress * 180}deg)`,
            }}
          >
            <IconRefresh style={{ fontSize: 24 }} />
          </div>
          <Text type="secondary" className="pull-to-refresh-indicator__text">
            {willRefresh ? '释放刷新' : '下拉刷新'}
          </Text>
          {pullDistance > 0 && (
            <div className="pull-to-refresh-indicator__progress">
              <div 
                className="pull-to-refresh-indicator__progress-bar"
                style={{
                  width: `${progress * 100}%`,
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PullToRefreshIndicator;