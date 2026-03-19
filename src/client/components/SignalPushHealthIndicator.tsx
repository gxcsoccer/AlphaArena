/**
 * SignalPushHealthIndicator Component
 * Displays real-time connection status with visual indicator
 */

import React, { useState } from 'react';
import { useSignalPushHealth, HealthStatus } from '../hooks/useSignalPushHealth';

interface SignalPushHealthIndicatorProps {
  userId?: string;
  showLabel?: boolean;
  showLatency?: boolean;
  showReconnectCountdown?: boolean;
  compact?: boolean;
  onPanelToggle?: () => void;
}

export function SignalPushHealthIndicator({
  userId,
  showLabel = true,
  showLatency = true,
  showReconnectCountdown = true,
  compact = false,
  onPanelToggle,
}: SignalPushHealthIndicatorProps) {
  const health = useSignalPushHealth({ userId });
  const [isHovered, setIsHovered] = useState(false);

  // Get background color based on status
  const getBgColor = (status: HealthStatus): string => {
    switch (status) {
      case 'healthy': return 'bg-green-100 hover:bg-green-200';
      case 'degraded': return 'bg-yellow-100 hover:bg-yellow-200';
      case 'unhealthy': return 'bg-orange-100 hover:bg-orange-200';
      case 'disconnected': return 'bg-gray-100 hover:bg-gray-200';
    }
  };

  // Get border color
  const getBorderColor = (status: HealthStatus): string => {
    switch (status) {
      case 'healthy': return 'border-green-300';
      case 'degraded': return 'border-yellow-300';
      case 'unhealthy': return 'border-orange-300';
      case 'disconnected': return 'border-gray-300';
    }
  };

  // Format latency display
  const formatLatency = (latency: number): string => {
    if (latency === 0) return '-';
    if (latency < 1000) return `${latency}ms`;
    return `${(latency / 1000).toFixed(1)}s`;
  };

  // Get latency color
  const getLatencyColor = (latency: number): string => {
    if (latency === 0) return 'text-gray-400';
    if (latency < 200) return 'text-green-600';
    if (latency < 500) return 'text-yellow-600';
    if (latency < 1000) return 'text-orange-600';
    return 'text-red-600';
  };

  // Animated pulse for connecting/reconnecting
  const isAnimating = health.connectionStatus === 'connecting' || 
                      health.connectionStatus === 'reconnecting';

  // Compact mode - just a small indicator
  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs cursor-pointer
          ${getBgColor(health.status)} border ${getBorderColor(health.status)} 
          transition-colors duration-200`}
        onClick={onPanelToggle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span className={`w-2 h-2 rounded-full ${
          health.status === 'healthy' ? 'bg-green-500' :
          health.status === 'degraded' ? 'bg-yellow-500' :
          health.status === 'unhealthy' ? 'bg-orange-500' :
          'bg-gray-400'
        } ${isAnimating ? 'animate-pulse' : ''}`} />
        
        {showLabel && (
          <span className={health.getStatusColor()}>
            {health.getStatusText()}
          </span>
        )}
        
        {showLatency && health.isConnected && health.latency > 0 && (
          <span className={`ml-1 ${getLatencyColor(health.latency)}`}>
            {formatLatency(health.latency)}
          </span>
        )}
      </div>
    );
  }

  // Full mode with status, latency, and reconnect countdown
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer
        ${getBgColor(health.status)} border ${getBorderColor(health.status)}
        transition-colors duration-200`}
      onClick={onPanelToggle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Status Icon */}
      <span className={`text-lg ${isAnimating ? 'animate-pulse' : ''}`}>
        {health.getStatusIcon()}
      </span>
      
      {/* Status Text */}
      {showLabel && (
        <span className={`font-medium text-sm ${health.getStatusColor()}`}>
          {health.getStatusText()}
        </span>
      )}
      
      {/* Latency */}
      {showLatency && health.isConnected && health.latency > 0 && (
        <span className={`text-sm ${getLatencyColor(health.latency)}`}>
          {formatLatency(health.latency)}
        </span>
      )}
      
      {/* Reconnect Countdown */}
      {showReconnectCountdown && health.reconnectingIn !== null && (
        <span className="text-xs text-gray-500">
          ({health.formatReconnectingIn()})
        </span>
      )}
      
      {/* Expand Arrow */}
      {isHovered && (
        <span className="text-gray-400 text-xs">▼</span>
      )}
    </div>
  );
}

export default SignalPushHealthIndicator;