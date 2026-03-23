/**
 * LoadingIndicator Component
 * 
 * Issue #571: 交互体验优化 - 加载状态指示器优化
 * 
 * 提供多种样式的加载指示器组件
 */

import React from 'react';
import { Spin } from '@arco-design/web-react';

type LoadingType = 'spinner' | 'dots' | 'pulse' | 'bar' | 'skeleton';
type LoadingSize = 'small' | 'medium' | 'large';

interface LoadingIndicatorProps {
  /** 加载类型 */
  type?: LoadingType;
  /** 大小 */
  size?: LoadingSize;
  /** 加载文字 */
  text?: string;
  /** 是否全屏 */
  fullscreen?: boolean;
  /** 是否覆盖层 */
  overlay?: boolean;
  /** 自定义颜色 */
  color?: string;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/**
 * 获取尺寸对应的数值
 */
const getSizeValue = (size: LoadingSize): number => {
  switch (size) {
    case 'small':
      return 20;
    case 'medium':
      return 40;
    case 'large':
      return 60;
    default:
      return 40;
  }
};

/**
 * Spinner 加载器
 */
const SpinnerLoader: React.FC<{
  size: LoadingSize;
  color: string;
}> = ({ size, color }) => {
  const sizeValue = getSizeValue(size);
  
  return (
    <Spin 
      size={sizeValue} 
      style={{ color }}
    />
  );
};

/**
 * Dots 加载器（三个跳动的点）
 */
const DotsLoader: React.FC<{
  size: LoadingSize;
  color: string;
}> = ({ size, color }) => {
  const dotSize = size === 'small' ? 6 : size === 'large' ? 12 : 8;
  
  return (
    <div 
      className="dots-loading"
      style={{ gap: 4 }}
    >
      {[1, 2, 3].map(i => (
        <span
          key={i}
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            backgroundColor: color,
            animation: `dots-bounce 1.4s ease-in-out infinite both`,
            animationDelay: `${-0.32 + (i - 1) * 0.16}s`,
          }}
        />
      ))}
    </div>
  );
};

/**
 * Pulse 加载器（脉冲效果）
 */
const PulseLoader: React.FC<{
  size: LoadingSize;
  color: string;
}> = ({ size, color }) => {
  const sizeValue = getSizeValue(size);
  
  return (
    <div
      style={{
        width: sizeValue,
        height: sizeValue,
        borderRadius: '50%',
        backgroundColor: color,
        animation: 'pulse-loading-animation 1.2s ease-in-out infinite',
      }}
    />
  );
};

/**
 * Bar 加载器（波形条）
 */
const BarLoader: React.FC<{
  size: LoadingSize;
  color: string;
}> = ({ size, color }) => {
  const barHeight = size === 'small' ? 16 : size === 'large' ? 32 : 24;
  const barWidth = 4;
  
  return (
    <div
      className="bar-loading"
      style={{ gap: 3, alignItems: 'center' }}
    >
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          style={{
            width: barWidth,
            height: barHeight,
            backgroundColor: color,
            borderRadius: 2,
            animation: `bar-wave 1.2s ease-in-out infinite`,
            animationDelay: `${-1.2 + (i - 1) * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
};

/**
 * LoadingIndicator 组件
 * 
 * 支持多种加载动画样式
 */
const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  type = 'spinner',
  size = 'medium',
  text,
  fullscreen = false,
  overlay = false,
  color = 'var(--color-primary, #3B82F6)',
  className = '',
  style,
}) => {
  const renderLoader = () => {
    switch (type) {
      case 'dots':
        return <DotsLoader size={size} color={color} />;
      case 'pulse':
        return <PulseLoader size={size} color={color} />;
      case 'bar':
        return <BarLoader size={size} color={color} />;
      case 'spinner':
      default:
        return <SpinnerLoader size={size} color={color} />;
    }
  };

  const content = (
    <div
      className={`loading-indicator ${className}`.trim()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        ...style,
      }}
      role="status"
      aria-label={text || '加载中'}
    >
      {renderLoader()}
      {text && (
        <span 
          style={{ 
            color: 'var(--color-text-2, #475569)',
            fontSize: 'var(--font-size-sm, 14px)',
          }}
        >
          {text}
        </span>
      )}
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
          background: overlay ? 'rgba(255, 255, 255, 0.9)' : 'transparent',
          zIndex: 9999,
        }}
      >
        {content}
      </div>
    );
  }

  if (overlay) {
    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255, 255, 255, 0.8)',
          zIndex: 10,
        }}
      >
        {content}
      </div>
    );
  }

  return content;
};

export default LoadingIndicator;

/**
 * PageLoading 组件
 * 页面级加载状态
 */
export const PageLoading: React.FC<{
  text?: string;
}> = ({ text = '加载中...' }) => {
  return (
    <LoadingIndicator
      type="spinner"
      size="large"
      text={text}
      fullscreen
      overlay
    />
  );
};

/**
 * SectionLoading 组件
 * 区块级加载状态
 */
export const SectionLoading: React.FC<{
  height?: number | string;
  text?: string;
}> = ({ height = 200, text }) => {
  return (
    <div 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        height,
      }}
    >
      <LoadingIndicator
        type="dots"
        size="medium"
        text={text}
      />
    </div>
  );
};

/**
 * InlineLoading 组件
 * 内联加载状态
 */
export const InlineLoading: React.FC<{
  text?: string;
}> = ({ text }) => {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        color: 'var(--color-text-2, #475569)',
        fontSize: 'var(--font-size-sm, 14px)',
      }}
    >
      <LoadingIndicator type="spinner" size="small" />
      {text}
    </span>
  );
};

/**
 * ButtonLoading 组件
 * 按钮内的加载状态
 */
export const ButtonLoading: React.FC<{
  text?: string;
}> = ({ text }) => {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <LoadingIndicator type="spinner" size="small" color="currentColor" />
      {text || '处理中...'}
    </span>
  );
};

/**
 * SkeletonLoading 组件
 * 骨架屏加载状态
 */
export const SkeletonLoading: React.FC<{
  type: 'text' | 'card' | 'list' | 'table' | 'chart';
  rows?: number;
  columns?: number;
  height?: number | string;
}> = ({ type, rows = 3, columns = 4, height }) => {
  const renderSkeleton = () => {
    switch (type) {
      case 'text':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: rows }).map((_, i) => (
              <div
                key={i}
                className="skeleton-base"
                style={{
                  height: 14,
                  width: i === rows - 1 ? '60%' : '100%',
                }}
              />
            ))}
          </div>
        );

      case 'card':
        return (
          <div
            style={{
              background: 'var(--color-bg-1)',
              border: '1px solid var(--color-border-1)',
              borderRadius: 'var(--radius-xl)',
              padding: 16,
              height,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="skeleton-base" style={{ height: 24, width: '40%' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton-base" style={{ height: 14 }} />
                ))}
              </div>
            </div>
          </div>
        );

      case 'list':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: rows }).map((_, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                }}
              >
                <div className="skeleton-base skeleton-avatar" style={{ width: 40, height: 40, borderRadius: '50%' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="skeleton-base" style={{ height: 14, width: '60%' }} />
                  <div className="skeleton-base" style={{ height: 12, width: '40%' }} />
                </div>
              </div>
            ))}
          </div>
        );

      case 'table':
        return (
          <div>
            {/* 表头 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gap: 12,
                padding: 12,
                borderBottom: '1px solid var(--color-border-1)',
              }}
            >
              {Array.from({ length: columns }).map((_, i) => (
                <div key={i} className="skeleton-base" style={{ height: 14 }} />
              ))}
            </div>
            {/* 表体 */}
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <div
                key={rowIndex}
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${columns}, 1fr)`,
                  gap: 12,
                  padding: 12,
                  borderBottom: '1px solid var(--color-border-1)',
                }}
              >
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <div key={colIndex} className="skeleton-base" style={{ height: 14 }} />
                ))}
              </div>
            ))}
          </div>
        );

      case 'chart':
        return (
          <div
            className="skeleton-base"
            style={{
              height: height || 200,
              borderRadius: 'var(--radius-lg)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '60%',
                background: 'linear-gradient(to top, var(--color-fill-2), transparent)',
              }}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {renderSkeleton()}
      <style>{`
        .skeleton-base {
          background: linear-gradient(
            90deg,
            var(--color-fill-2) 25%,
            var(--color-fill-3) 50%,
            var(--color-fill-2) 75%
          );
          background-size: 200% 100%;
          animation: skeleton-shimmer 1.5s infinite;
          border-radius: var(--radius-md);
        }
        
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        
        @keyframes dots-bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
        
        @keyframes pulse-loading-animation {
          0% { transform: scale(0); opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }
        
        @keyframes bar-wave {
          0%, 40%, 100% { transform: scaleY(0.4); }
          20% { transform: scaleY(1); }
        }
      `}</style>
    </>
  );
};