/**
 * Theme Toggle Component
 * 
 * Updated for Issue #197: Sprint 10: 用户偏好设置功能
 * Now uses the centralized settings store for theme state.
 */

import React from 'react';
import { Button, Tooltip } from '@arco-design/web-react';
import { IconSun, IconMoonFill } from '@arco-design/web-react/icon';
import { useSettings } from '../store/settingsStore';

interface ThemeToggleProps {
  compact?: boolean;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ compact = false }) => {
  const { settings, toggleTheme } = useSettings();

  const isDark = settings.theme === 'dark';

  return (
    <Tooltip content={isDark ? '切换到浅色模式' : '切换到深色模式'} position="br">
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
          transition: 'all 0.3s ease',
        }}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      />
    </Tooltip>
  );
};

export default ThemeToggle;
