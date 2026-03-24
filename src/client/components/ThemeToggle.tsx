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
import { Button, Tooltip } from '@arco-design/web-react';
import { IconSun, IconMoonFill } from '@arco-design/web-react/icon';
import { useSettings } from '../store/settingsStore';
import { useTranslation } from 'react-i18next';

interface ThemeToggleProps {
  compact?: boolean;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ compact = false }) => {
  const { settings, toggleTheme } = useSettings();
  const { t } = useTranslation('common');

  const isDark = settings.theme === 'dark';
  const themeLabel = isDark ? t('theme.dark') : t('theme.light');

  const oppositeTheme = isDark ? t('theme.light') : t('theme.dark');

  return (
    <Tooltip content={`${t('theme.current', { defaultValue: '当前' })}: ${themeLabel}`} position="br">
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
        aria-label={`${t('theme.toggle', { defaultValue: '主题切换' })}: ${t('theme.current', { defaultValue: '当前' })}${themeLabel}，点击切换`}
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
