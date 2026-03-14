import React from 'react';
import { IconButton, Tooltip } from '@arco-design/web-react';
import { IconSun, IconMoonFill } from '@arco-design/web-react/icon';
import { useTheme } from '../hooks/useTheme';

interface ThemeToggleProps {
  compact?: boolean;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ compact = false }) => {
  const { theme, toggleTheme } = useTheme();

  const isDark = theme === 'dark';

  return (
    <Tooltip content={isDark ? '切换到浅色模式' : '切换到深色模式'} position="br">
      <IconButton
        icon={isDark ? <IconSun style={{ fontSize: compact ? 18 : 20 }} /> : <IconMoonFill style={{ fontSize: compact ? 18 : 20 }} />}
        onClick={toggleTheme}
        size="small"
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
