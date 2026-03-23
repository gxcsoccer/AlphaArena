/**
 * EnhancedButton Component
 * 
 * Issue #571: 交互体验优化 - 按钮点击反馈
 * 
 * 增强版按钮组件，支持涟漪效果、加载状态等
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Button, Spin } from '@arco-design/web-react';
import type { ButtonProps } from '@arco-design/web-react';

type ButtonVariant = 'solid' | 'outline' | 'text' | 'gradient';
type ButtonEffect = 'ripple' | 'scale' | 'glow' | 'none';
type ButtonSize = 'small' | 'medium' | 'large';

interface EnhancedButtonProps extends Omit<ButtonProps, 'size'> {
  /** 按钮变体 */
  variant?: ButtonVariant;
  /** 按钮效果 */
  effect?: ButtonEffect;
  /** 按钮大小 */
  size?: ButtonSize;
  /** 是否加载中 */
  loading?: boolean;
  /** 加载文字 */
  loadingText?: string;
  /** 成功状态 */
  success?: boolean;
  /** 成功文字 */
  successText?: string;
  /** 成功状态持续时间 */
  successDuration?: number;
  /** 成功回调 */
  onSuccessComplete?: () => void;
  /** 涟漪颜色 */
  rippleColor?: string;
  /** 渐变色（用于 gradient 变体） */
  gradientColors?: string[];
  /** 图标位置 */
  iconPosition?: 'left' | 'right';
  /** 点击波纹是否居中 */
  centeredRipple?: boolean;
  /** 自定义类名 */
  className?: string;
}

interface RippleType {
  id: number;
  x: number;
  y: number;
  size: number;
}

/**
 * EnhancedButton 组件
 * 
 * 支持涟漪效果、加载状态、成功状态的增强按钮
 */
const EnhancedButton: React.FC<EnhancedButtonProps> = ({
  variant = 'solid',
  effect = 'ripple',
  size = 'medium',
  loading = false,
  loadingText,
  success = false,
  successText,
  successDuration = 2000,
  onSuccessComplete,
  rippleColor = 'rgba(255, 255, 255, 0.35)',
  gradientColors = ['var(--color-primary)', 'var(--color-secondary)'],
  iconPosition = 'left',
  centeredRipple = false,
  className = '',
  children,
  disabled,
  onClick,
  style,
  ...rest
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [ripples, setRipples] = useState<RippleType[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const rippleIdRef = useRef(0);

  // 成功状态处理
  useEffect(() => {
    if (success) {
      setShowSuccess(true);
      const timer = setTimeout(() => {
        setShowSuccess(false);
        onSuccessComplete?.();
      }, successDuration);
      return () => clearTimeout(timer);
    }
  }, [success, successDuration, onSuccessComplete]);

  // 点击涟漪效果
  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (loading || showSuccess || disabled) return;

    if (effect === 'ripple' && buttonRef.current) {
      const button = buttonRef.current;
      const rect = button.getBoundingClientRect();
      
      let x: number, y: number;
      if (centeredRipple) {
        x = rect.width / 2;
        y = rect.height / 2;
      } else {
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
      }
      
      const size = Math.max(rect.width, rect.height) * 2;
      
      const newRipple: RippleType = {
        id: rippleIdRef.current++,
        x,
        y,
        size,
      };
      
      setRipples(prev => [...prev, newRipple]);
      
      // 移除涟漪
      setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== newRipple.id));
      }, 600);
    }

    onClick?.(e);
  }, [loading, showSuccess, disabled, effect, centeredRipple, onClick]);

  // 获取尺寸样式
  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'small':
        return { height: 28, padding: '0 12px', fontSize: 12 };
      case 'large':
        return { height: 44, padding: '0 24px', fontSize: 16 };
      default:
        return { height: 36, padding: '0 16px', fontSize: 14 };
    }
  };

  // 获取变体样式
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'outline':
        return {
          background: 'transparent',
          border: '1px solid var(--color-primary)',
          color: 'var(--color-primary)',
        };
      case 'text':
        return {
          background: 'transparent',
          border: 'none',
          color: 'var(--color-primary)',
        };
      case 'gradient':
        return {
          background: `linear-gradient(135deg, ${gradientColors[0]}, ${gradientColors[1]})`,
          border: 'none',
          color: 'white',
        };
      default:
        return {
          background: 'var(--color-primary)',
          border: 'none',
          color: 'white',
        };
    }
  };

  // 获取效果样式
  const getEffectStyles = (): React.CSSProperties => {
    if (effect === 'scale') {
      return {
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      };
    }
    if (effect === 'glow') {
      return {
        transition: 'box-shadow 0.2s ease',
      };
    }
    return {};
  };

  // 悬停效果处理
  const handleMouseEnter = () => {
    if (effect === 'scale' && buttonRef.current) {
      buttonRef.current.style.transform = 'translateY(-2px)';
    }
    if (effect === 'glow' && buttonRef.current) {
      buttonRef.current.style.boxShadow = '0 0 20px var(--color-primary)';
    }
  };

  const handleMouseLeave = () => {
    if (effect === 'scale' && buttonRef.current) {
      buttonRef.current.style.transform = 'translateY(0)';
    }
    if (effect === 'glow' && buttonRef.current) {
      buttonRef.current.style.boxShadow = 'none';
    }
  };

  const handleMouseDown = () => {
    if (effect === 'scale' && buttonRef.current) {
      buttonRef.current.style.transform = 'scale(0.97)';
    }
  };

  const handleMouseUp = () => {
    if (effect === 'scale' && buttonRef.current) {
      buttonRef.current.style.transform = 'translateY(-2px)';
    }
  };

  const isDisabled = disabled || loading || showSuccess;

  return (
    <button
      ref={buttonRef}
      className={`enhanced-button ${className}`.trim()}
      disabled={isDisabled}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 'var(--radius-md)',
        fontWeight: 500,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        overflow: effect === 'ripple' ? 'hidden' : 'visible',
        opacity: isDisabled && !loading && !showSuccess ? 0.5 : 1,
        outline: 'none',
        ...getSizeStyles(),
        ...getVariantStyles(),
        ...getEffectStyles(),
        ...style,
      }}
      {...rest}
    >
      {/* 涟漪效果 */}
      {effect === 'ripple' && ripples.map(ripple => (
        <span
          key={ripple.id}
          style={{
            position: 'absolute',
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
            borderRadius: '50%',
            background: rippleColor,
            transform: 'translate(-50%, -50%) scale(0)',
            animation: 'ripple-animation 0.6s ease-out forwards',
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* 加载状态 */}
      {loading && (
        <Spin size={size === 'small' ? 14 : size === 'large' ? 20 : 16} />
      )}

      {/* 成功状态 */}
      {showSuccess && (
        <svg
          width={size === 'small' ? 14 : size === 'large' ? 20 : 16}
          height={size === 'small' ? 14 : size === 'large' ? 20 : 16}
          viewBox="0 0 24 24"
          fill="none"
          style={{ animation: 'check-bounce 0.5s ease-out' }}
        >
          <path
            d="M5 12l5 5L19 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 30,
              strokeDashoffset: 0,
              animation: 'check-draw 0.3s ease-out forwards',
            }}
          />
        </svg>
      )}

      {/* 文字内容 */}
      <span>
        {loading && loadingText
          ? loadingText
          : showSuccess && successText
            ? successText
            : children}
      </span>

      <style>{`
        @keyframes ripple-animation {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0.5;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0;
          }
        }
        
        @keyframes check-bounce {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        
        @keyframes check-draw {
          from { stroke-dashoffset: 30; }
          to { stroke-dashoffset: 0; }
        }
        
        .enhanced-button:focus-visible {
          outline: 2px solid var(--color-primary);
          outline-offset: 2px;
        }
      `}</style>
    </button>
  );
};

export default EnhancedButton;

/**
 * IconButton 组件
 * 图标按钮（正方形）
 */
export const IconButton: React.FC<{
  icon: React.ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
  effect?: ButtonEffect;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  'aria-label': string;
}> = ({
  icon,
  size = 'medium',
  variant = 'solid',
  effect = 'ripple',
  disabled = false,
  loading = false,
  onClick,
  className = '',
  style,
  'aria-label': ariaLabel,
}) => {
  const sizeValue = size === 'small' ? 28 : size === 'large' ? 44 : 36;

  return (
    <EnhancedButton
      variant={variant}
      effect={effect}
      size={size}
      disabled={disabled}
      loading={loading}
      onClick={onClick}
      className={className}
      aria-label={ariaLabel}
      style={{
        width: sizeValue,
        padding: 0,
        ...style,
      }}
    >
      {icon}
    </EnhancedButton>
  );
};

/**
 * AsyncButton 组件
 * 异步操作按钮
 */
export const AsyncButton: React.FC<{
  children: React.ReactNode;
  onClick: () => Promise<void>;
  loadingText?: string;
  successText?: string;
  errorText?: string;
  variant?: ButtonVariant;
  effect?: ButtonEffect;
  size?: ButtonSize;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}> = ({
  children,
  onClick,
  loadingText = '处理中...',
  successText = '成功',
  errorText = '失败',
  variant = 'solid',
  effect = 'scale',
  size = 'medium',
  disabled = false,
  className = '',
  style,
}) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);

  const handleClick = async () => {
    try {
      setLoading(true);
      setError(false);
      await onClick();
      setSuccess(true);
    } catch (err) {
      setError(true);
      setTimeout(() => setError(false), 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <EnhancedButton
      variant={variant}
      effect={effect}
      size={size}
      loading={loading}
      loadingText={loadingText}
      success={success}
      successText={successText}
      disabled={disabled}
      onClick={handleClick}
      className={className}
      style={{
        ...style,
        borderColor: error ? 'var(--color-danger)' : undefined,
      }}
      onSuccessComplete={() => setSuccess(false)}
    >
      {error ? errorText : children}
    </EnhancedButton>
  );
};