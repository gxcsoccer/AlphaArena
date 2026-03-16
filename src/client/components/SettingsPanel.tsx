/**
 * Settings Panel Component
 * 
 * Provides UI for user preferences including theme and language settings.
 * 
 * Issue #197: Sprint 10: 用户偏好设置功能
 * Issue #209: Settings panel button not easily discoverable - added tooltip and hover effects
 * Issue #214: Sprint 11: UI 可访问性增强
 * - Added visible text label for better discoverability
 * - Enhanced aria-labels for screen readers
 * - Added role attributes and keyboard navigation support
 */

import React, { useState } from 'react';
import { Modal, Button, Radio, Space, Divider, Typography, Tooltip } from '@arco-design/web-react';
import { IconSettings, IconSun, IconMoonFill, IconLanguage } from '@arco-design/web-react/icon';
import { useSettings } from '../store/settingsStore';

const { Text } = Typography;

interface SettingsPanelProps {
  compact?: boolean;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ compact = false }) => {
  const [visible, setVisible] = useState(false);
  const { settings, setTheme, setLanguage, resetSettings } = useSettings();

  const handleThemeChange = (value: string | number | boolean) => {
    setTheme(value as 'light' | 'dark');
  };

  const handleLanguageChange = (value: string | number | boolean) => {
    setLanguage(value as 'zh' | 'en');
  };

  const handleReset = () => {
    resetSettings();
  };

  return (
    <>
      <Tooltip content="设置 (主题、语言)" position="br">
        <Button
          icon={<IconSettings style={{ fontSize: compact ? 18 : 20 }} />}
          onClick={() => setVisible(true)}
          size="small"
          type="text"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text-1)',
            padding: compact ? 4 : 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            transition: 'all 0.3s ease',
          }}
          className="settings-button"
          aria-label="打开设置面板"
          aria-haspopup="dialog"
          aria-expanded={visible}
        >
          {!compact && (
            <span style={{ fontSize: 12, color: 'var(--color-text-2)' }}>
              设置
            </span>
          )}
        </Button>
      </Tooltip>
      
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconSettings aria-hidden="true" />
            <span>设置</span>
          </div>
        }
        visible={visible}
        onCancel={() => setVisible(false)}
        footer={
          <Space>
            <Button onClick={handleReset} aria-label="恢复默认设置">
              恢复默认
            </Button>
            <Button type="primary" onClick={() => setVisible(false)} aria-label="关闭设置面板">
              完成
            </Button>
          </Space>
        }
        style={{ width: 400 }}
        unmountOnExit
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        <div style={{ padding: '8px 0' }}>
          {/* Theme Setting */}
          <div style={{ marginBottom: 24 }} role="group" aria-labelledby="theme-setting-label">
            <div id="theme-setting-label" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              {settings.theme === 'dark' ? <IconMoonFill aria-hidden="true" /> : <IconSun aria-hidden="true" />}
              <Text bold>主题模式</Text>
            </div>
            <Radio.Group
              value={settings.theme}
              onChange={handleThemeChange}
              type="button"
              style={{ width: '100%' }}
              aria-label="选择主题模式"
            >
              <Radio value="light" style={{ width: '50%', textAlign: 'center' }} aria-label="浅色模式">
                <Space>
                  <IconSun aria-hidden="true" />
                  浅色
                </Space>
              </Radio>
              <Radio value="dark" style={{ width: '50%', textAlign: 'center' }} aria-label="深色模式">
                <Space>
                  <IconMoonFill aria-hidden="true" />
                  深色
                </Space>
              </Radio>
            </Radio.Group>
          </div>

          <Divider style={{ margin: '16px 0' }} role="separator" />

          {/* Language Setting */}
          <div style={{ marginBottom: 24 }} role="group" aria-labelledby="language-setting-label">
            <div id="language-setting-label" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <IconLanguage aria-hidden="true" />
              <Text bold>语言</Text>
            </div>
            <Radio.Group
              value={settings.language}
              onChange={handleLanguageChange}
              type="button"
              style={{ width: '100%' }}
              aria-label="选择语言"
            >
              <Radio value="zh" style={{ width: '50%', textAlign: 'center' }} aria-label="中文">
                中文
              </Radio>
              <Radio value="en" style={{ width: '50%', textAlign: 'center' }} aria-label="English">
                English
              </Radio>
            </Radio.Group>
          </div>

          <Divider style={{ margin: '16px 0' }} role="separator" />

          {/* Current Settings Summary */}
          <div 
            style={{ 
              padding: 12, 
              background: 'var(--color-fill-1)', 
              borderRadius: 4,
              fontSize: 12,
              color: 'var(--color-text-3)'
            }}
            role="status"
            aria-live="polite"
            aria-label="当前设置摘要"
          >
            <div>当前设置：</div>
            <div style={{ marginTop: 4 }}>
              主题: {settings.theme === 'dark' ? '深色模式' : '浅色模式'}
            </div>
            <div>语言: {settings.language === 'zh' ? '中文' : 'English'}</div>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default SettingsPanel;
