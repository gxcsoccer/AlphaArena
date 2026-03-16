/**
 * Theme Toggle Component
 * 
 * Updated for Issue #197: Sprint 10: 用户偏好设置功能
 * Now uses the centralized settings store for theme state.
 * 
 * Issue #214: Sprint 11: UI 可访问性增强
 * - Added visible text label for better discoverability
 * - Enhanced aria-label with current theme state
 * - Added focus-visible styles for keyboard navigation
 */

import React from 'react';
import { Button, Tooltip, Space } from '@arco-design/web-react';
import { IconSun, IconMoonFill } from '@arco-design/web-react/icon';
import { useSettings } from '../store/settingsStore';

interface ThemeToggleProps {
  compact?: boolean;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ compact = false }) => {
  const { settings, toggleTheme } = useSettings();

  const isDark = settings.theme === 'dark';
  const themeLabel = isDark ? '深色模式' : '浅色模式';

  return (
    <Tooltip content={`当前: ${themeLabel} - 点击切换`} position="br">
      <Button
        icon={isDark ? <IconSun style={{ fontSize: compact ? 18 : 20 }} /> : <IconMoonFill style={{ fontSize: compact ? 18 : 20 }} />}
        onClick={toggleTheme}
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
        className="theme-toggle-button"
        aria-label={`主题切换: 当前${themeLabel}，点击切换到${isDark ? '浅色' : '深色'}模式`}
        aria-pressed={isDark}
        role="switch"
      >
        {!compact && (
          <span style={{ fontSize: 12, color: 'var(--color-text-2)' }}>
            {themeLabel}
          </span>
        )}
      </Button>
    </Tooltip>
  );
};

export default ThemeToggle;
