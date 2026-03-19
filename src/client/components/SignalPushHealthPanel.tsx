/**
 * SignalPushHealthPanel Component
 * Detailed health status panel with metrics and statistics
 */

import React, { useState } from 'react';
import {
  useSignalPushHealth,
  HealthStatus,
} from '../hooks/useSignalPushHealth';

interface SignalPushHealthPanelProps {
  userId?: string;
  onClose?: () => void;
}

export function SignalPushHealthPanel({ userId, onClose }: SignalPushHealthPanelProps) {
  const health = useSignalPushHealth({ userId });
  const [activeTab, setActiveTab] = useState<'status' | 'stats' | 'history'>('status');

  // Format time ago
  const timeAgo = (date: Date | null): string => {
    if (!date) return '-';
    
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    return `${days} 天前`;
  };

  // Format latency
  const formatLatency = (latency: number | null): string => {
    if (latency === null || latency === 0) return '-';
    if (latency < 1000) return `${latency}ms`;
    return `${(latency / 1000).toFixed(2)}s`;
  };

  // Get status color class
  const getStatusColorClass = (status: HealthStatus): string => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'degraded': return 'text-yellow-600 bg-yellow-100';
      case 'unhealthy': return 'text-orange-600 bg-orange-100';
      case 'disconnected': return 'text-gray-600 bg-gray-100';
    }
  };

  // Get latency color
  const getLatencyColor = (latency: number): string => {
    if (latency === 0) return 'text-gray-500';
    if (latency < 200) return 'text-green-600';
    if (latency < 500) return 'text-yellow-600';
    if (latency < 1000) return 'text-orange-600';
    return 'text-red-600';
  };

  // Get uptime color
  const getUptimeColor = (uptime: number): string => {
    if (uptime >= 99) return 'text-green-600';
    if (uptime >= 95) return 'text-yellow-600';
    if (uptime >= 90) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-lg shadow-xl border max-w-md w-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <span className="text-xl">📡</span>
          <h3 className="font-semibold text-gray-800">信号推送健康状态</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        )}
      </div>

      {/* Status Overview */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`text-3xl ${health.connectionStatus === 'connecting' || health.connectionStatus === 'reconnecting' ? 'animate-pulse' : ''}`}>
              {health.getStatusIcon()}
            </span>
            <div>
              <div className={`text-lg font-semibold ${health.getStatusColor()}`}>
                {health.getStatusText()}
              </div>
              {health.reconnectingIn !== null && (
                <div className="text-sm text-gray-500">
                  {health.formatReconnectingIn()}
                </div>
              )}
            </div>
          </div>
          
          <div className="text-right">
            <div className={`text-2xl font-mono ${getLatencyColor(health.latency)}`}>
              {formatLatency(health.latency)}
            </div>
            <div className="text-xs text-gray-500">延迟</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('status')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            activeTab === 'status'
              ? 'text-blue-600 border-b-2 border-blue-500'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          状态
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            activeTab === 'stats'
              ? 'text-blue-600 border-b-2 border-blue-500'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          统计
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'text-blue-600 border-b-2 border-blue-500'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          历史
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-4 max-h-80 overflow-y-auto">
        {/* Status Tab */}
        {activeTab === 'status' && (
          <div className="space-y-4">
            {/* Connection Details */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">连接详情</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between p-2 bg-gray-50 rounded">
                  <span className="text-gray-500">状态</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${getStatusColorClass(health.status)}`}>
                    {health.connectionStatus === 'connected' ? '已连接' :
                     health.connectionStatus === 'connecting' ? '连接中' :
                     health.connectionStatus === 'reconnecting' ? '重连中' : '已断开'}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-gray-50 rounded">
                  <span className="text-gray-500">延迟</span>
                  <span className={getLatencyColor(health.latency)}>
                    {formatLatency(health.latency)}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-gray-50 rounded">
                  <span className="text-gray-500">平均延迟</span>
                  <span className={getLatencyColor(health.averageLatency)}>
                    {formatLatency(health.averageLatency)}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-gray-50 rounded">
                  <span className="text-gray-500">可用性</span>
                  <span className={getUptimeColor(health.uptime)}>
                    {health.uptime}%
                  </span>
                </div>
              </div>
            </div>

            {/* Reconnection Info */}
            {(health.reconnectAttempts > 0 || health.reconnectingIn !== null) && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">重连信息</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between p-2 bg-orange-50 rounded border border-orange-200">
                    <span className="text-gray-500">重试次数</span>
                    <span className="text-orange-600 font-medium">
                      {health.reconnectAttempts}
                    </span>
                  </div>
                  <div className="flex justify-between p-2 bg-orange-50 rounded border border-orange-200">
                    <span className="text-gray-500">上次重连</span>
                    <span className="text-orange-600">
                      {timeAgo(health.lastReconnectAt)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Connection Time */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">连接时间</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between p-2 bg-gray-50 rounded">
                  <span className="text-gray-500">已连接</span>
                  <span className="text-gray-700">
                    {timeAgo(health.connectedAt)}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-gray-50 rounded">
                  <span className="text-gray-500">上次断开</span>
                  <span className="text-gray-700">
                    {timeAgo(health.disconnectedAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === 'stats' && (
          <div className="space-y-4">
            {/* Push Statistics */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">推送统计</h4>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-2xl font-bold text-blue-600">
                    {health.totalPushes}
                  </div>
                  <div className="text-xs text-gray-500">总推送</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-2xl font-bold text-green-600">
                    {health.successfulPushes}
                  </div>
                  <div className="text-xs text-gray-500">成功</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="text-2xl font-bold text-red-600">
                    {health.failedPushes}
                  </div>
                  <div className="text-xs text-gray-500">失败</div>
                </div>
              </div>
            </div>

            {/* Success Rate */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">成功率</h4>
              <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
                {health.totalPushes > 0 && (
                  <div
                    className={`h-full transition-all duration-300 ${
                      (health.successfulPushes / health.totalPushes) >= 0.95 ? 'bg-green-500' :
                      (health.successfulPushes / health.totalPushes) >= 0.8 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${(health.successfulPushes / health.totalPushes) * 100}%` }}
                  />
                )}
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>成功率</span>
                <span className="font-medium">
                  {health.totalPushes > 0 
                    ? Math.round((health.successfulPushes / health.totalPushes) * 100) 
                    : 100}%
                </span>
              </div>
            </div>

            {/* Last Push */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">最近推送</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between p-2 bg-gray-50 rounded">
                  <span className="text-gray-500">时间</span>
                  <span className="text-gray-700">
                    {timeAgo(health.lastPushAt)}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-gray-50 rounded">
                  <span className="text-gray-500">延迟</span>
                  <span className={getLatencyColor(health.lastPushLatency || 0)}>
                    {formatLatency(health.lastPushLatency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Reset Button */}
            <button
              onClick={health.resetStats}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              重置统计数据
            </button>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {/* Latency Chart */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">延迟历史 (最近 {health.latencyHistory.length} 次)</h4>
              <div className="h-24 flex items-end gap-1">
                {health.latencyHistory.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                    暂无数据
                  </div>
                ) : (
                  health.latencyHistory.map((latency, index) => {
                    const height = Math.min(100, (latency / 2000) * 100);
                    return (
                      <div
                        key={index}
                        className={`flex-1 rounded-t transition-all duration-300 ${
                          latency < 200 ? 'bg-green-400' :
                          latency < 500 ? 'bg-yellow-400' :
                          latency < 1000 ? 'bg-orange-400' : 'bg-red-400'
                        }`}
                        style={{ height: `${Math.max(5, height)}%` }}
                        title={formatLatency(latency)}
                      />
                    );
                  })
                )}
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>0ms</span>
                <span>500ms</span>
                <span>1000ms</span>
                <span>2000ms+</span>
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">连接时间线</h4>
              <div className="relative pl-4 border-l-2 border-gray-200 space-y-3">
                {health.connectedAt && (
                  <div className="relative">
                    <div className="absolute -left-5 w-2 h-2 bg-green-500 rounded-full" />
                    <div className="text-sm">
                      <span className="text-gray-700">已连接</span>
                      <span className="text-gray-400 text-xs ml-2">
                        {new Date(health.connectedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                )}
                {health.disconnectedAt && (
                  <div className="relative">
                    <div className="absolute -left-5 w-2 h-2 bg-red-500 rounded-full" />
                    <div className="text-sm">
                      <span className="text-gray-700">已断开</span>
                      <span className="text-gray-400 text-xs ml-2">
                        {new Date(health.disconnectedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                )}
                {health.lastReconnectAt && (
                  <div className="relative">
                    <div className="absolute -left-5 w-2 h-2 bg-orange-500 rounded-full" />
                    <div className="text-sm">
                      <span className="text-gray-700">重连尝试</span>
                      <span className="text-gray-400 text-xs ml-2">
                        {new Date(health.lastReconnectAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                )}
                {health.lastPushAt && (
                  <div className="relative">
                    <div className="absolute -left-5 w-2 h-2 bg-blue-500 rounded-full" />
                    <div className="text-sm">
                      <span className="text-gray-700">最近推送</span>
                      <span className="text-gray-400 text-xs ml-2">
                        {new Date(health.lastPushAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t bg-gray-50 flex justify-between items-center">
        <button
          onClick={health.refresh}
          className="text-sm text-blue-500 hover:text-blue-600"
        >
          刷新
        </button>
        <span className="text-xs text-gray-400">
          自动刷新: 每30秒
        </span>
      </div>
    </div>
  );
}

export default SignalPushHealthPanel;