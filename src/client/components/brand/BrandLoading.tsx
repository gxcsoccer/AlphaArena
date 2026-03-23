/**
 * Brand Loading Animation Component
 * 
 * Issue #572: Brand Visual Elements
 * 
 * Professional loading animations with brand identity:
 * - Logo pulse animation
 * - Branded spinner
 * - Chart-style loading
 */

import React from 'react';

export interface BrandLoadingProps {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Loading text */
  text?: string;
  /** Full screen overlay */
  fullscreen?: boolean;
  /** Theme */
  theme?: 'light' | 'dark' | 'auto';
}

const sizeConfig = {
  sm: { logo: 32, textSize: 12 },
  md: { logo: 48, textSize: 14 },
  lg: { logo: 64, textSize: 16 },
};

/**
 * Brand Loading Animation
 * 
 * Features the AlphaArena logo with a pulse animation
 * and optional loading text.
 */
export const BrandLoading: React.FC<BrandLoadingProps> = ({
  size = 'md',
  text,
  fullscreen = false,
  theme = 'auto',
}) => {
  const sizes = sizeConfig[size];

  const content = (
    <div
      className="brand-loading"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}
      role="status"
      aria-label={text || '加载中'}
    >
      {/* Animated Logo */}
      <div className="brand-loading-logo" style={{ position: 'relative' }}>
        {/* Pulse rings */}
        <div className="pulse-ring pulse-ring-1" />
        <div className="pulse-ring pulse-ring-2" />
        <div className="pulse-ring pulse-ring-3" />
        
        {/* Logo SVG */}
        <svg
          width={sizes.logo}
          height={sizes.logo}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ position: 'relative', zIndex: 1 }}
        >
          <defs>
            <linearGradient id="brand-loading-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--color-primary-500)">
                <animate
                  attributeName="stop-color"
                  values="var(--color-primary-500);var(--color-secondary-500);var(--color-primary-500)"
                  dur="3s"
                  repeatCount="indefinite"
                />
              </stop>
              <stop offset="100%" stopColor="var(--color-secondary-500)">
                <animate
                  attributeName="stop-color"
                  values="var(--color-secondary-500);var(--color-primary-500);var(--color-secondary-500)"
                  dur="3s"
                  repeatCount="indefinite"
                />
              </stop>
            </linearGradient>
          </defs>
          
          {/* Main shape */}
          <path
            d="M24 4L4 40h8l4-8h16l4 8h8L24 4zm0 16l6 12H18l6-12z"
            fill="url(#brand-loading-gradient)"
            className="logo-main"
          />
          
          {/* Chart line animation */}
          <path
            d="M16 28l4-8 4 4 8-12"
            stroke="var(--color-primary-400)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            className="logo-line"
          />
          
          {/* Dot */}
          <circle cx="32" cy="12" r="2" fill="var(--color-secondary-400)" className="logo-dot" />
        </svg>
      </div>

      {/* Loading text */}
      {text && (
        <span
          style={{
            fontSize: sizes.textSize,
            color: 'var(--color-text-2)',
            fontWeight: 500,
          }}
        >
          {text}
        </span>
      )}

      <style>{`
        .brand-loading-logo {
          position: relative;
        }
        
        .pulse-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          border: 2px solid var(--color-primary-400);
          opacity: 0;
          animation: brand-pulse-expand 2s ease-out infinite;
        }
        
        .pulse-ring-1 {
          width: ${sizes.logo}px;
          height: ${sizes.logo}px;
          animation-delay: 0s;
        }
        
        .pulse-ring-2 {
          width: ${sizes.logo}px;
          height: ${sizes.logo}px;
          animation-delay: 0.5s;
        }
        
        .pulse-ring-3 {
          width: ${sizes.logo}px;
          height: ${sizes.logo}px;
          animation-delay: 1s;
        }
        
        .logo-main {
          animation: logo-pulse 1.5s ease-in-out infinite;
        }
        
        .logo-line {
          stroke-dasharray: 40;
          animation: logo-line-draw 1.5s ease-in-out infinite;
        }
        
        .logo-dot {
          animation: logo-dot-blink 1.5s ease-in-out infinite;
        }
        
        @keyframes brand-pulse-expand {
          0% {
            width: ${sizes.logo}px;
            height: ${sizes.logo}px;
            opacity: 0.6;
          }
          100% {
            width: ${sizes.logo * 1.8}px;
            height: ${sizes.logo * 1.8}px;
            opacity: 0;
          }
        }
        
        @keyframes logo-pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.85;
            transform: scale(0.97);
          }
        }
        
        @keyframes logo-line-draw {
          0% {
            stroke-dashoffset: 40;
            opacity: 0.5;
          }
          50% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
          100% {
            stroke-dashoffset: -40;
            opacity: 0.5;
          }
        }
        
        @keyframes logo-dot-blink {
          0%, 100% {
            opacity: 0.8;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }
      `}</style>
    </div>
  );

  if (fullscreen) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: theme === 'dark' 
            ? 'rgba(15, 23, 42, 0.95)' 
            : theme === 'light'
              ? 'rgba(255, 255, 255, 0.95)'
              : 'var(--color-bg-1)',
          zIndex: 9999,
        }}
      >
        {content}
      </div>
    );
  }

  return content;
};

/**
 * Chart Loading Animation
 * 
 * Shows an animated chart line that mimics trading data
 */
export const ChartLoading: React.FC<{
  width?: number;
  height?: number;
}> = ({ width = 200, height = 100 }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 200 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="status"
    aria-label="加载中"
  >
    {/* Grid lines */}
    {[0, 25, 50, 75, 100].map((y) => (
      <line
        key={y}
        x1="0"
        y1={y}
        x2="200"
        y2={y}
        stroke="var(--color-border-1)"
        strokeWidth="0.5"
        opacity="0.5"
      />
    ))}
    
    {/* Animated chart line */}
    <path
      d="M0 70 Q25 60 50 50 T100 40 T150 55 T200 30"
      stroke="url(#chart-loading-gradient)"
      strokeWidth="2"
      fill="none"
      className="chart-line-animate"
    />
    
    {/* Gradient for line */}
    <defs>
      <linearGradient id="chart-loading-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="var(--color-primary-500)" />
        <stop offset="100%" stopColor="var(--color-secondary-500)" />
      </linearGradient>
    </defs>
    
    {/* Moving dot */}
    <circle r="4" fill="var(--color-primary-500)" className="chart-dot-animate" />
    
    <style>{`
      .chart-line-animate {
        stroke-dasharray: 300;
        stroke-dashoffset: 300;
        animation: chart-line-draw 2s ease-in-out infinite;
      }
      
      .chart-dot-animate {
        animation: chart-dot-move 2s ease-in-out infinite;
      }
      
      @keyframes chart-line-draw {
        0% {
          stroke-dashoffset: 300;
        }
        50% {
          stroke-dashoffset: 0;
        }
        100% {
          stroke-dashoffset: -300;
        }
      }
      
      @keyframes chart-dot-move {
        0% {
          offset-distance: 0%;
        }
        100% {
          offset-distance: 100%;
        }
      }
    `}</style>
  </svg>
);

export default BrandLoading;