/**
 * AlphaArena Logo Component
 * 
 * Professional logo design for AlphaArena brand.
 * Features:
 * - Stylized "A" with chart/arena theme
 * - Gradient primary colors (Tech Blue + Innovation Purple)
 * - Supports multiple sizes and themes
 * - Animated variant for loading states
 */

import React from 'react';

export interface LogoProps {
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Color theme - uses CSS variables or explicit colors */
  color?: 'primary' | 'light' | 'dark' | 'auto';
  /** Include wordmark */
  showWordmark?: boolean;
  /** Animate the logo (for loading states) */
  animated?: boolean;
  /** Custom class name */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
  /** Click handler */
  onClick?: () => void;
}

const sizeMap = {
  xs: { icon: 24, wordmark: 14, gap: 6 },
  sm: { icon: 32, wordmark: 18, gap: 8 },
  md: { icon: 40, wordmark: 22, gap: 10 },
  lg: { icon: 48, wordmark: 28, gap: 12 },
  xl: { icon: 64, wordmark: 36, gap: 16 },
};

const colorSchemes = {
  primary: {
    gradientStart: 'var(--color-primary-500)',
    gradientEnd: 'var(--color-secondary-500)',
    text: 'var(--color-text-1)',
  },
  light: {
    gradientStart: '#3B82F6',
    gradientEnd: '#A855F7',
    text: '#ffffff',
  },
  dark: {
    gradientStart: '#60A5FA',
    gradientEnd: '#C084FC',
    text: '#1E293B',
  },
  auto: {
    gradientStart: 'var(--color-primary)',
    gradientEnd: 'var(--color-secondary-500)',
    text: 'var(--color-text-1)',
  },
};

/**
 * AlphaArena Logo Component
 * 
 * The logo features a stylized "A" that represents:
 * - The "A" in AlphaArena
 * - A rising chart/graph (alpha returns)
 * - An arena/stadium shape (competitive trading)
 * - Upward momentum and growth
 */
export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  color = 'auto',
  showWordmark = true,
  animated = false,
  className = '',
  style,
  onClick,
}) => {
  const sizes = sizeMap[size];
  const colors = colorSchemes[color];

  const gradientId = `logo-gradient-${Math.random().toString(36).substr(2, 9)}`;
  const pulseId = `logo-pulse-${Math.random().toString(36).substr(2, 9)}`;

  const iconElement = (
    <svg
      width={sizes.icon}
      height={sizes.icon}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`alphaarena-logo ${animated ? 'animated' : ''} ${className}`}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      onClick={onClick}
      role="img"
      aria-label="AlphaArena Logo"
    >
      <defs>
        {/* Main gradient */}
        <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={colors.gradientStart} />
          <stop offset="100%" stopColor={colors.gradientEnd} />
        </linearGradient>
        
        {/* Pulse animation filter */}
        {animated && (
          <filter id={pulseId}>
            <feGaussianBlur stdDeviation="1" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>
      
      {/* Main Logo Shape - Stylized "A" with arena/chart theme */}
      <g filter={animated ? `url(#${pulseId})` : undefined}>
        {/* Outer arena shape */}
        <path
          d="M24 4L4 40h8l4-8h16l4 8h8L24 4zm0 16l6 12H18l6-12z"
          fill={`url(#${gradientId})`}
          className={animated ? 'logo-animate-path' : ''}
          style={{
            transformOrigin: 'center',
          }}
        />
        
        {/* Inner accent - rising chart line */}
        <path
          d="M16 28l4-8 4 4 8-12"
          stroke={colors.gradientStart}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.8"
          className={animated ? 'logo-animate-line' : ''}
        />
        
        {/* Dot accent - peak performance indicator */}
        <circle
          cx="32"
          cy="12"
          r="2"
          fill={colors.gradientEnd}
          className={animated ? 'logo-animate-dot' : ''}
        />
      </g>
    </svg>
  );

  if (!showWordmark) {
    return (
      <>
        {iconElement}
        {animated && <LogoAnimationStyles />}
      </>
    );
  }

  return (
    <>
      <div
        className={`alphaarena-logo-wrapper ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: sizes.gap,
          cursor: onClick ? 'pointer' : 'default',
          ...style,
        }}
        onClick={onClick}
        role="banner"
        aria-label="AlphaArena"
      >
        {iconElement}
        <span
          style={{
            fontFamily: 'var(--font-family-display, Inter, -apple-system, sans-serif)',
            fontSize: sizes.wordmark,
            fontWeight: 700,
            color: colors.text,
            letterSpacing: '-0.02em',
            background: `linear-gradient(135deg, ${colors.gradientStart}, ${colors.gradientEnd})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          AlphaArena
        </span>
      </div>
      {animated && <LogoAnimationStyles />}
    </>
  );
};

/**
 * Logo animation styles
 */
const LogoAnimationStyles: React.FC = () => (
  <style>{`
    .alphaarena-logo.animated .logo-animate-path {
      animation: logo-path-pulse 2s ease-in-out infinite;
    }
    
    .alphaarena-logo.animated .logo-animate-line {
      animation: logo-line-draw 2s ease-in-out infinite;
      stroke-dasharray: 40;
      stroke-dashoffset: 40;
    }
    
    .alphaarena-logo.animated .logo-animate-dot {
      animation: logo-dot-pulse 2s ease-in-out infinite;
    }
    
    @keyframes logo-path-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(0.98); }
    }
    
    @keyframes logo-line-draw {
      0% { stroke-dashoffset: 40; }
      50% { stroke-dashoffset: 0; }
      100% { stroke-dashoffset: -40; }
    }
    
    @keyframes logo-dot-pulse {
      0%, 100% { opacity: 0.8; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.2); }
    }
  `}</style>
);

/**
 * Compact Logo Icon Only
 */
export const LogoIcon: React.FC<Omit<LogoProps, 'showWordmark'>> = (props) => (
  <Logo {...props} showWordmark={false} />
);

/**
 * Logo for Header - Fixed sizing and styling
 */
export const HeaderLogo: React.FC<{
  collapsed?: boolean;
  onClick?: () => void;
}> = ({ collapsed, onClick }) => (
  <Logo
    size={collapsed ? 'sm' : 'md'}
    showWordmark={!collapsed}
    animated={false}
    onClick={onClick}
    style={{
      userSelect: 'none',
    }}
  />
);

export default Logo;