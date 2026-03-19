/**
 * useSignalPushHealth Hook
 * Monitors real-time signal push connection health and provides statistics
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { getRealtimeClient, ConnectionStatus, ConnectionQuality } from '../utils/realtime';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'disconnected';

export interface SignalPushHealth {
  // Connection status
  status: HealthStatus;
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  
  // Latency
  latency: number;
  latencyHistory: number[];
  
  // Reconnection
  reconnectAttempts: number;
  reconnectingIn: number | null;
  lastReconnectAt: Date | null;
  
  // Push statistics
  totalPushes: number;
  successfulPushes: number;
  failedPushes: number;
  lastPushAt: Date | null;
  lastPushLatency: number | null;
  
  // Health metrics
  uptime: number; // Percentage 0-100
  averageLatency: number;
  lastHealthCheckAt: Date | null;
  
  // Timestamps
  connectedAt: Date | null;
  disconnectedAt: Date | null;
}

export interface SignalPushHealthOptions {
  userId?: string;
  healthCheckInterval?: number; // ms, default 30000
  latencySampleSize?: number; // default 10
  onHealthChange?: (health: SignalPushHealth) => void;
  onDisconnect?: () => void;
  onReconnect?: () => void;
}

export interface SignalPushHealthReturn extends SignalPushHealth {
  // Actions
  refresh: () => Promise<void>;
  resetStats: () => void;
  
  // Helpers
  getStatusColor: () => string;
  getStatusText: () => string;
  getStatusIcon: () => string;
  formatReconnectingIn: () => string | null;
}

// Default health state
const DEFAULT_HEALTH: SignalPushHealth = {
  status: 'disconnected',
  isConnected: false,
  connectionStatus: 'disconnected',
  latency: 0,
  latencyHistory: [],
  reconnectAttempts: 0,
  reconnectingIn: null,
  lastReconnectAt: null,
  totalPushes: 0,
  successfulPushes: 0,
  failedPushes: 0,
  lastPushAt: null,
  lastPushLatency: null,
  uptime: 100,
  averageLatency: 0,
  lastHealthCheckAt: null,
  connectedAt: null,
  disconnectedAt: null,
};

export function useSignalPushHealth(
  options: SignalPushHealthOptions = {}
): SignalPushHealthReturn {
  const {
    userId,
    healthCheckInterval = 30000,
    latencySampleSize = 10,
    onHealthChange,
    onDisconnect,
    onReconnect,
  } = options;

  const [health, setHealth] = useState<SignalPushHealth>(DEFAULT_HEALTH);
  
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const healthCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousStatusRef = useRef<ConnectionStatus>('disconnected');
  const statsRef = useRef({
    totalPushes: 0,
    successfulPushes: 0,
    failedPushes: 0,
    lastPushAt: null as Date | null,
    lastPushLatency: null as number | null,
    connectedAt: null as Date | null,
    totalConnectedTime: 0,
    totalDisconnectedTime: 0,
    lastStatusChangeAt: Date.now(),
  });

  // Calculate health status based on metrics
  const calculateHealthStatus = useCallback((
    connectionStatus: ConnectionStatus,
    quality: ConnectionQuality
  ): HealthStatus => {
    if (connectionStatus === 'disconnected') return 'disconnected';
    if (connectionStatus === 'reconnecting') return 'unhealthy';
    
    // Check latency
    const latency = quality.latency || 0;
    const isStale = quality.isStale;
    
    if (isStale) return 'unhealthy';
    if (latency > 2000) return 'unhealthy';
    if (latency > 1000 || quality.reconnectAttempts > 2) return 'degraded';
    
    return 'healthy';
  }, []);

  // Calculate uptime percentage
  const calculateUptime = useCallback((): number => {
    const stats = statsRef.current;
    const totalTime = stats.totalConnectedTime + stats.totalDisconnectedTime;
    if (totalTime === 0) return 100;
    return Math.round((stats.totalConnectedTime / totalTime) * 100);
  }, []);

  // Calculate average latency
  const calculateAverageLatency = useCallback((history: number[]): number => {
    if (history.length === 0) return 0;
    const sum = history.reduce((a, b) => a + b, 0);
    return Math.round(sum / history.length);
  }, []);

  // Update stats based on connection status change
  const updateConnectionStats = useCallback((newStatus: ConnectionStatus) => {
    const now = Date.now();
    const elapsed = now - statsRef.current.lastStatusChangeAt;
    
    if (previousStatusRef.current === 'connected') {
      statsRef.current.totalConnectedTime += elapsed;
    } else {
      statsRef.current.totalDisconnectedTime += elapsed;
    }
    
    statsRef.current.lastStatusChangeAt = now;
    previousStatusRef.current = newStatus;
  }, []);

  // Record a push event
  const recordPush = useCallback((success: boolean, latency?: number) => {
    statsRef.current.totalPushes++;
    if (success) {
      statsRef.current.successfulPushes++;
    } else {
      statsRef.current.failedPushes++;
    }
    if (latency !== undefined) {
      statsRef.current.lastPushLatency = latency;
    }
    statsRef.current.lastPushAt = new Date();
  }, []);

  // Perform health check
  const performHealthCheck = useCallback(async () => {
    const realtimeClient = getRealtimeClient();
    const connectionStatus = realtimeClient.getConnectionStatus();
    const quality = realtimeClient.getConnectionQuality();
    
    updateConnectionStats(connectionStatus);
    
    const status = calculateHealthStatus(connectionStatus, quality);
    
    setHealth(prev => {
      const latencyHistory = [...prev.latencyHistory, quality.latency]
        .slice(-latencySampleSize);
      
      const newHealth: SignalPushHealth = {
        ...prev,
        status,
        isConnected: connectionStatus === 'connected',
        connectionStatus,
        latency: quality.latency,
        latencyHistory,
        reconnectAttempts: quality.reconnectAttempts,
        lastReconnectAt: quality.lastReconnectAt ? new Date(quality.lastReconnectAt) : null,
        totalPushes: statsRef.current.totalPushes,
        successfulPushes: statsRef.current.successfulPushes,
        failedPushes: statsRef.current.failedPushes,
        lastPushAt: statsRef.current.lastPushAt,
        lastPushLatency: statsRef.current.lastPushLatency,
        uptime: calculateUptime(),
        averageLatency: calculateAverageLatency(latencyHistory),
        lastHealthCheckAt: new Date(),
        connectedAt: statsRef.current.connectedAt,
        disconnectedAt: connectionStatus === 'disconnected' ? new Date() : prev.disconnectedAt,
      };
      
      return newHealth;
    });
  }, [latencySampleSize, updateConnectionStats, calculateHealthStatus, calculateUptime, calculateAverageLatency]);

  // Handle reconnection countdown
  const startReconnectCountdown = useCallback((delay: number) => {
    if (reconnectTimerRef.current) {
      clearInterval(reconnectTimerRef.current);
    }
    
    let remaining = Math.ceil(delay / 1000);
    
    setHealth(prev => ({
      ...prev,
      reconnectingIn: remaining,
    }));
    
    reconnectTimerRef.current = setInterval(() => {
      remaining--;
      
      if (remaining <= 0) {
        if (reconnectTimerRef.current) {
          clearInterval(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        setHealth(prev => ({
          ...prev,
          reconnectingIn: null,
        }));
      } else {
        setHealth(prev => ({
          ...prev,
          reconnectingIn: remaining,
        }));
      }
    }, 1000);
  }, []);

  // Subscribe to connection changes
  useEffect(() => {
    const realtimeClient = getRealtimeClient();
    
    const unsubscribeConnection = realtimeClient.onConnectionChange((status) => {
      const previousStatus = previousStatusRef.current;
      
      // Handle status transitions
      if (status === 'connected' && previousStatus !== 'connected') {
        statsRef.current.connectedAt = new Date();
        onReconnect?.();
      } else if (status === 'disconnected' && previousStatus === 'connected') {
        onDisconnect?.();
      }
      
      // Start reconnect countdown if reconnecting
      if (status === 'reconnecting') {
        const quality = realtimeClient.getConnectionQuality();
        const delay = Math.min(
          1000 * Math.pow(2, quality.reconnectAttempts),
          30000
        );
        startReconnectCountdown(delay);
      }
      
      performHealthCheck();
    });
    
    const unsubscribeQuality = realtimeClient.onQualityChange((quality) => {
      setHealth(prev => {
        const latencyHistory = [...prev.latencyHistory, quality.latency]
          .slice(-latencySampleSize);
        
        return {
          ...prev,
          latency: quality.latency,
          latencyHistory,
          averageLatency: calculateAverageLatency(latencyHistory),
          reconnectAttempts: quality.reconnectAttempts,
          lastReconnectAt: quality.lastReconnectAt ? new Date(quality.lastReconnectAt) : null,
        };
      });
    });
    
    // Initial health check
    performHealthCheck();
    
    // Periodic health checks
    healthCheckTimerRef.current = setInterval(performHealthCheck, healthCheckInterval);
    
    return () => {
      unsubscribeConnection();
      unsubscribeQuality();
      if (reconnectTimerRef.current) {
        clearInterval(reconnectTimerRef.current);
      }
      if (healthCheckTimerRef.current) {
        clearInterval(healthCheckTimerRef.current);
      }
    };
  }, [healthCheckInterval, latencySampleSize, onDisconnect, onReconnect, performHealthCheck, startReconnectCountdown, calculateAverageLatency]);

  // Notify on health changes
  useEffect(() => {
    onHealthChange?.(health);
  }, [health, onHealthChange]);

  // Fetch server-side stats
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/signals/health', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.data?.stats) {
          statsRef.current = {
            ...statsRef.current,
            totalPushes: data.data.stats.totalPushes || statsRef.current.totalPushes,
            successfulPushes: data.data.stats.successfulPushes || statsRef.current.successfulPushes,
            failedPushes: data.data.stats.failedPushes || statsRef.current.failedPushes,
            lastPushAt: data.data.stats.lastPushAt ? new Date(data.data.stats.lastPushAt) : statsRef.current.lastPushAt,
          };
        }
        
        await performHealthCheck();
      }
    } catch (error) {
      console.error('[SignalPushHealth] Failed to fetch health:', error);
    }
  }, [performHealthCheck]);

  // Reset statistics
  const resetStats = useCallback(() => {
    statsRef.current = {
      totalPushes: 0,
      successfulPushes: 0,
      failedPushes: 0,
      lastPushAt: null,
      lastPushLatency: null,
      connectedAt: null,
      totalConnectedTime: 0,
      totalDisconnectedTime: 0,
      lastStatusChangeAt: Date.now(),
    };
    
    setHealth(prev => ({
      ...prev,
      totalPushes: 0,
      successfulPushes: 0,
      failedPushes: 0,
      lastPushAt: null,
      lastPushLatency: null,
      uptime: 100,
      latencyHistory: [],
      averageLatency: 0,
    }));
  }, []);

  // Get status color
  const getStatusColor = useCallback((): string => {
    switch (health.status) {
      case 'healthy': return 'text-green-500';
      case 'degraded': return 'text-yellow-500';
      case 'unhealthy': return 'text-orange-500';
      case 'disconnected': return 'text-gray-400';
    }
  }, [health.status]);

  // Get status text
  const getStatusText = useCallback((): string => {
    switch (health.status) {
      case 'healthy': return '已连接';
      case 'degraded': return '连接不稳定';
      case 'unhealthy': return '连接异常';
      case 'disconnected': return '未连接';
    }
  }, [health.status]);

  // Get status icon
  const getStatusIcon = useCallback((): string => {
    switch (health.status) {
      case 'healthy': return '🟢';
      case 'degraded': return '🟡';
      case 'unhealthy': return '🟠';
      case 'disconnected': return '⚪';
    }
  }, [health.status]);

  // Format reconnecting countdown
  const formatReconnectingIn = useCallback((): string | null => {
    if (health.reconnectingIn === null) return null;
    
    const seconds = health.reconnectingIn;
    if (seconds < 60) {
      return `${seconds}秒后重连`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒后重连`;
  }, [health.reconnectingIn]);

  return {
    ...health,
    refresh,
    resetStats,
    getStatusColor,
    getStatusText,
    getStatusIcon,
    formatReconnectingIn,
  };
}

export default useSignalPushHealth;