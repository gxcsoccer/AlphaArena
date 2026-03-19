/**
 * SignalNotificationCenter Component
 * Displays recent trading signals and alerts in a notification panel
 */

import React, { useState } from 'react';
import { useSignalPush, TradingSignal, SignalAlert } from '../hooks/useSignalPush';

interface SignalNotificationCenterProps {
  onSignalClick?: (signal: TradingSignal) => void;
  onViewAll?: () => void;
}

export function SignalNotificationCenter({
  onSignalClick,
  onViewAll,
}: SignalNotificationCenterProps) {
  const {
    isConnected,
    recentSignals,
    unreadCount,
    alerts,
    markAsRead,
    markAllAsRead,
    clearAlerts,
  } = useSignalPush();
  
  const [activeTab, setActiveTab] = useState<'signals' | 'alerts'>('signals');
  const [isExpanded, setIsExpanded] = useState(false);

  // Format time ago
  const timeAgo = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    return `${days} 天前`;
  };

  // Get signal type icon and color
  const getSignalTypeStyle = (signal: TradingSignal) => {
    const isBuy = signal.side === 'buy';
    const baseColor = isBuy ? 'text-green-600' : 'text-red-600';
    const bgColor = isBuy ? 'bg-green-50' : 'bg-red-50';
    const icon = isBuy ? '📈' : '📉';
    const label = isBuy ? '买入' : '卖出';
    return { icon, label, baseColor, bgColor };
  };

  // Get risk level badge
  const getRiskBadge = (riskLevel: string) => {
    const styles: Record<string, string> = {
      low: 'bg-green-100 text-green-700',
      medium: 'bg-yellow-100 text-yellow-700',
      high: 'bg-orange-100 text-orange-700',
      very_high: 'bg-red-100 text-red-700',
    };
    const labels: Record<string, string> = {
      low: '低风险',
      medium: '中等',
      high: '高风险',
      very_high: '极高风险',
    };
    return (
      <span className={`text-xs px-1.5 py-0.5 rounded ${styles[riskLevel] || styles.medium}`}>
        {labels[riskLevel] || riskLevel}
      </span>
    );
  };

  // Get alert type style
  const getAlertStyle = (alert: SignalAlert) => {
    const styles: Record<string, { icon: string; bg: string; label: string }> = {
      target_hit: { icon: '🎯', bg: 'bg-green-50 border-green-200', label: '目标达成' },
      stop_loss_hit: { icon: '🛑', bg: 'bg-red-50 border-red-200', label: '止损触发' },
      expiring_soon: { icon: '⏰', bg: 'bg-yellow-50 border-yellow-200', label: '即将过期' },
      price_alert: { icon: '💰', bg: 'bg-blue-50 border-blue-200', label: '价格提醒' },
    };
    return styles[alert.type] || { icon: '📢', bg: 'bg-gray-50 border-gray-200', label: '提醒' };
  };

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        <span
          className={`absolute bottom-1 right-1 w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-gray-300'
          }`}
        />
      </button>

      {/* Dropdown Panel */}
      {isExpanded && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsExpanded(false)}
          />
          
          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-xl z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b bg-gray-50">
              <div className="flex items-center gap-2">
                <span className="font-medium">信号通知</span>
                {unreadCount > 0 && (
                  <span className="text-xs text-gray-500">
                    ({unreadCount} 条未读)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-500 hover:text-blue-600"
                  >
                    全部已读
                  </button>
                )}
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b">
              <button
                onClick={() => setActiveTab('signals')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'signals'
                    ? 'text-blue-600 border-b-2 border-blue-500'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                信号 ({recentSignals.length})
              </button>
              <button
                onClick={() => setActiveTab('alerts')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'alerts'
                    ? 'text-blue-600 border-b-2 border-blue-500'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                提醒 ({alerts.length})
              </button>
            </div>

            {/* Content */}
            <div className="max-h-96 overflow-y-auto">
              {activeTab === 'signals' && (
                <>
                  {recentSignals.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <div className="text-4xl mb-2">📭</div>
                      <div>暂无信号通知</div>
                      <div className="text-xs mt-1">订阅策略后可接收实时信号</div>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {recentSignals.map(signal => {
                        const style = getSignalTypeStyle(signal);
                        return (
                          <div
                            key={signal.id}
                            onClick={() => {
                              markAsRead(signal.id);
                              onSignalClick?.(signal);
                            }}
                            className="p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-10 h-10 rounded-lg ${style.bgColor} flex items-center justify-center`}>
                                <span className="text-lg">{style.icon}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`font-medium ${style.baseColor}`}>
                                    {signal.symbol}
                                  </span>
                                  <span className={`text-xs ${style.baseColor}`}>
                                    {style.label}
                                  </span>
                                  {signal.confidenceScore && (
                                    <span className="text-xs text-gray-500">
                                      置信度: {signal.confidenceScore}%
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-600 truncate">
                                  {signal.title || `${style.label}信号`}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  {signal.entryPrice && (
                                    <span className="text-xs text-gray-500">
                                      入场: ${signal.entryPrice.toLocaleString()}
                                    </span>
                                  )}
                                  {signal.targetPrice && (
                                    <span className="text-xs text-gray-500">
                                      目标: ${signal.targetPrice.toLocaleString()}
                                    </span>
                                  )}
                                  {getRiskBadge(signal.riskLevel)}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                  {timeAgo(signal.createdAt)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'alerts' && (
                <>
                  {alerts.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <div className="text-4xl mb-2">✅</div>
                      <div>暂无提醒</div>
                    </div>
                  ) : (
                    <>
                      <div className="p-2 border-b bg-gray-50">
                        <button
                          onClick={clearAlerts}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          清除所有提醒
                        </button>
                      </div>
                      <div className="divide-y">
                        {alerts.map(alert => {
                          const style = getAlertStyle(alert);
                          return (
                            <div
                              key={alert.id}
                              className={`p-3 border-l-4 ${style.bg}`}
                            >
                              <div className="flex items-start gap-2">
                                <span className="text-lg">{style.icon}</span>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{alert.symbol}</span>
                                    <span className="text-xs text-gray-500">
                                      {style.label}
                                    </span>
                                  </div>
                                  <div className="text-sm text-gray-600 mt-1">
                                    {alert.message}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                    {alert.currentPrice && (
                                      <span>当前: ${alert.currentPrice.toLocaleString()}</span>
                                    )}
                                    {alert.targetPrice && (
                                      <span>目标: ${alert.targetPrice.toLocaleString()}</span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-400 mt-1">
                                    {timeAgo(alert.timestamp)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t bg-gray-50">
              <button
                onClick={() => {
                  setIsExpanded(false);
                  onViewAll?.();
                }}
                className="w-full text-center text-sm text-blue-500 hover:text-blue-600"
              >
                查看全部信号
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default SignalNotificationCenter;