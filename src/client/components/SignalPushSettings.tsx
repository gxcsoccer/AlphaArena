/**
 * SignalPushSettings Component
 * UI for managing real-time trading signal push notifications
 */

import React, { useState, useEffect } from 'react';
import { useSignalPush, SignalPushConfig } from '../hooks/useSignalPush';

interface SignalPushSettingsProps {
  onClose?: () => void;
}

const SIGNAL_TYPE_OPTIONS = [
  { value: 'all', label: '全部信号' },
  { value: 'buy', label: '买入信号' },
  { value: 'sell', label: '卖出信号' },
  { value: 'stop_loss', label: '止损信号' },
  { value: 'take_profit', label: '止盈信号' },
  { value: 'risk_alert', label: '风险警告' },
];

const RISK_LEVEL_OPTIONS = [
  { value: 'low', label: '低风险', color: '#22c55e' },
  { value: 'medium', label: '中等风险', color: '#eab308' },
  { value: 'high', label: '高风险', color: '#f97316' },
  { value: 'very_high', label: '极高风险', color: '#ef4444' },
];

const FREQUENCY_OPTIONS = [
  { value: 'realtime', label: '实时推送' },
  { value: 'batch_1m', label: '每分钟汇总' },
  { value: 'batch_5m', label: '每5分钟汇总' },
  { value: 'batch_15m', label: '每15分钟汇总' },
];

export function SignalPushSettings({ onClose }: SignalPushSettingsProps) {
  const { config, updateConfig, isConnected } = useSignalPush();
  const [localConfig, setLocalConfig] = useState<Partial<SignalPushConfig>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  // Sync local config with remote config
  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config]);

  // Handle toggle change
  const handleToggle = (key: keyof SignalPushConfig) => {
    setLocalConfig(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Handle array toggle (signal types, risk levels)
  const handleArrayToggle = (
    key: 'signalTypes' | 'riskLevels',
    value: string
  ) => {
    setLocalConfig(prev => {
      const current = prev[key] || [];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [key]: updated };
    });
  };

  // Handle select change
  const handleSelect = (key: keyof SignalPushConfig, value: string) => {
    setLocalConfig(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // Handle number change
  const handleNumber = (key: keyof SignalPushConfig, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      setLocalConfig(prev => ({
        ...prev,
        [key]: num,
      }));
    }
  };

  // Handle symbols input
  const handleSymbols = (value: string) => {
    const symbols = value
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(s => s.length > 0);
    setLocalConfig(prev => ({
      ...prev,
      symbols,
    }));
  };

  // Save changes
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateConfig(localConfig);
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save config:', error);
      alert('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  if (!config) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-lg font-semibold">信号推送设置</h2>
          <p className="text-sm text-gray-500">
            管理实时交易信号的通知方式
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded ${
            isConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {isConnected ? '已连接' : '未连接'}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Master Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">启用推送</div>
            <div className="text-sm text-gray-500">接收实时交易信号通知</div>
          </div>
          <button
            onClick={() => handleToggle('pushEnabled')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              localConfig.pushEnabled ? 'bg-blue-500' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                localConfig.pushEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {localConfig.pushEnabled && (
          <>
            {/* Notification Channels */}
            <div className="space-y-3">
              <div className="font-medium">通知渠道</div>
              <div className="grid grid-cols-3 gap-3">
                <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={localConfig.browserNotify}
                    onChange={() => handleToggle('browserNotify')}
                    className="rounded text-blue-500"
                  />
                  <div>
                    <div className="text-sm font-medium">浏览器通知</div>
                    <div className="text-xs text-gray-500">桌面推送</div>
                  </div>
                </label>
                <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={localConfig.inAppNotify}
                    onChange={() => handleToggle('inAppNotify')}
                    className="rounded text-blue-500"
                  />
                  <div>
                    <div className="text-sm font-medium">站内消息</div>
                    <div className="text-xs text-gray-500">应用内通知</div>
                  </div>
                </label>
                <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={localConfig.soundEnabled}
                    onChange={() => handleToggle('soundEnabled')}
                    className="rounded text-blue-500"
                  />
                  <div>
                    <div className="text-sm font-medium">声音提醒</div>
                    <div className="text-xs text-gray-500">提示音</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Push Frequency */}
            <div className="space-y-3">
              <div className="font-medium">推送频率</div>
              <select
                value={localConfig.frequency}
                onChange={(e) => handleSelect('frequency', e.target.value)}
                className="w-full p-2 border rounded-lg"
              >
                {FREQUENCY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Signal Types */}
            <div className="space-y-3">
              <div className="font-medium">信号类型</div>
              <div className="flex flex-wrap gap-2">
                {SIGNAL_TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleArrayToggle('signalTypes', opt.value)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      (localConfig.signalTypes || []).includes(opt.value)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk Levels */}
            <div className="space-y-3">
              <div className="font-medium">风险等级</div>
              <div className="flex flex-wrap gap-2">
                {RISK_LEVEL_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleArrayToggle('riskLevels', opt.value)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      (localConfig.riskLevels || []).includes(opt.value)
                        ? 'text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    style={
                      (localConfig.riskLevels || []).includes(opt.value)
                        ? { backgroundColor: opt.color }
                        : {}
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Min Confidence Score */}
            <div className="space-y-3">
              <div className="font-medium">最低置信度</div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={localConfig.minConfidenceScore || 0}
                  onChange={(e) => handleNumber('minConfidenceScore', e.target.value)}
                  className="flex-1"
                />
                <span className="w-12 text-right text-sm font-medium">
                  {localConfig.minConfidenceScore || 0}%
                </span>
              </div>
              <p className="text-xs text-gray-500">
                只接收置信度高于此值的信号
              </p>
            </div>

            {/* Symbols Filter */}
            <div className="space-y-3">
              <div className="font-medium">交易对筛选</div>
              <input
                type="text"
                placeholder="BTC/USDT, ETH/USDT, ... (留空接收全部)"
                value={(localConfig.symbols || []).join(', ')}
                onChange={(e) => handleSymbols(e.target.value)}
                className="w-full p-2 border rounded-lg"
              />
              <p className="text-xs text-gray-500">
                输入交易对，用逗号分隔。留空则接收所有交易对的信号。
              </p>
            </div>

            {/* Quiet Hours */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">免打扰时段</div>
                <button
                  onClick={() => handleToggle('quietHoursEnabled')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    localConfig.quietHoursEnabled ? 'bg-blue-500' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      localConfig.quietHoursEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {localConfig.quietHoursEnabled && (
                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    value={localConfig.quietHoursStart || '22:00'}
                    onChange={(e) => setLocalConfig(prev => ({
                      ...prev,
                      quietHoursStart: e.target.value,
                    }))}
                    className="p-2 border rounded-lg"
                  />
                  <span className="text-gray-500">至</span>
                  <input
                    type="time"
                    value={localConfig.quietHoursEnd || '08:00'}
                    onChange={(e) => setLocalConfig(prev => ({
                      ...prev,
                      quietHoursEnd: e.target.value,
                    }))}
                    className="p-2 border rounded-lg"
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
        {showSaved && (
          <span className="text-green-600 text-sm">✓ 已保存</span>
        )}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {isSaving ? '保存中...' : '保存设置'}
        </button>
      </div>
    </div>
  );
}

export default SignalPushSettings;