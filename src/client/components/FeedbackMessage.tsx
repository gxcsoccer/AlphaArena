/**
 * FeedbackMessage Component
 * 
 * Issue #571: 交互体验优化 - 反馈系统
 * 
 * 提供操作成功/失败的视觉反馈组件
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  IconCheckCircle,
  IconCloseCircle,
  IconInfoCircle,
  IconExclamationCircle,
  IconLoading,
} from '@arco-design/web-react/icon';

type FeedbackType = 'success' | 'error' | 'warning' | 'info' | 'loading';
type FeedbackSize = 'small' | 'medium' | 'large';

interface FeedbackMessageProps {
  /** 反馈类型 */
  type: FeedbackType;
  /** 消息内容 */
  message: string;
  /** 描述文字 */
  description?: string;
  /** 大小 */
  size?: FeedbackSize;
  /** 是否显示图标 */
  showIcon?: boolean;
  /** 是否可关闭 */
  closable?: boolean;
  /** 自动关闭时间（毫秒），0 表示不自动关闭 */
  duration?: number;
  /** 关闭回调 */
  onClose?: () => void;
  /** 操作按钮 */
  action?: {
    text: string;
    onClick: () => void;
  };
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/**
 * 获取图标
 */
const getIcon = (type: FeedbackType, size: FeedbackSize) => {
  const iconSize = size === 'small' ? 16 : size === 'large' ? 24 : 20;
  
  const iconStyle = { fontSize: iconSize };
  
  switch (type) {
    case 'success':
      return <IconCheckCircle style={{ ...iconStyle, color: 'var(--color-success)' }} />;
    case 'error':
      return <IconCloseCircle style={{ ...iconStyle, color: 'var(--color-danger)' }} />;
    case 'warning':
      return <IconExclamationCircle style={{ ...iconStyle, color: 'var(--color-warning)' }} />;
    case 'loading':
      return <IconLoading style={{ ...iconStyle, color: 'var(--color-primary)' }} spin />;
    case 'info':
    default:
      return <IconInfoCircle style={{ ...iconStyle, color: 'var(--color-info)' }} />;
  }
};

/**
 * 获取背景色
 */
const getBackgroundColor = (type: FeedbackType): string => {
  switch (type) {
    case 'success':
      return 'var(--color-success-bg)';
    case 'error':
      return 'var(--color-danger-bg)';
    case 'warning':
      return 'var(--color-warning-bg)';
    case 'loading':
      return 'var(--color-primary-bg)';
    case 'info':
    default:
      return 'var(--color-info-bg)';
  }
};

/**
 * 获取边框色
 */
const getBorderColor = (type: FeedbackType): string => {
  switch (type) {
    case 'success':
      return 'var(--color-success)';
    case 'error':
      return 'var(--color-danger)';
    case 'warning':
      return 'var(--color-warning)';
    case 'loading':
      return 'var(--color-primary)';
    case 'info':
    default:
      return 'var(--color-info)';
  }
};

/**
 * FeedbackMessage 组件
 * 
 * 显示操作反馈消息
 */
const FeedbackMessage: React.FC<FeedbackMessageProps> = ({
  type,
  message,
  description,
  size = 'medium',
  showIcon = true,
  closable = false,
  duration = 0,
  onClose,
  action,
  className = '',
  style,
}) => {
  const [visible, setVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  // 自动关闭
  useEffect(() => {
    if (duration > 0 && type !== 'loading') {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, type]);

  // 关闭处理
  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, 200);
  }, [onClose]);

  if (!visible) return null;

  const padding = size === 'small' ? '8px 12px' : size === 'large' ? '16px 20px' : '12px 16px';
  const fontSize = size === 'small' ? 'var(--font-size-xs)' : size === 'large' ? 'var(--font-size-base)' : 'var(--font-size-sm)';

  return (
    <div
      className={`feedback-message ${isExiting ? 'feedback-message-exit' : 'feedback-message-enter'} ${className}`.trim()}
      style={{
        display: 'flex',
        alignItems: description ? 'flex-start' : 'center',
        gap: 12,
        padding,
        background: getBackgroundColor(type),
        border: `1px solid ${getBorderColor(type)}`,
        borderRadius: 'var(--radius-lg)',
        ...style,
      }}
      role="alert"
      aria-live="polite"
    >
      {/* 图标 */}
      {showIcon && (
        <div style={{ flexShrink: 0, marginTop: description ? 2 : 0 }}>
          {getIcon(type, size)}
        </div>
      )}

      {/* 内容 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize, color: 'var(--color-text-1)', fontWeight: 500 }}>
          {message}
        </div>
        {description && (
          <div style={{ 
            fontSize: 'var(--font-size-xs)', 
            color: 'var(--color-text-2)',
            marginTop: 4,
          }}>
            {description}
          </div>
        )}
        
        {/* 操作按钮 */}
        {action && (
          <button
            onClick={action.onClick}
            style={{
              marginTop: 8,
              padding: '4px 12px',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 500,
              color: 'var(--color-primary)',
              background: 'transparent',
              border: '1px solid var(--color-primary)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {action.text}
          </button>
        )}
      </div>

      {/* 关闭按钮 */}
      {closable && (
        <button
          onClick={handleClose}
          style={{
            flexShrink: 0,
            padding: 4,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-3)',
            transition: 'color 0.15s ease',
          }}
          aria-label="关闭"
        >
          <IconCloseCircle style={{ fontSize: 16 }} />
        </button>
      )}

      <style>{`
        .feedback-message-enter {
          animation: feedback-slide-in 0.3s ease-out;
        }
        
        .feedback-message-exit {
          animation: feedback-slide-out 0.2s ease-in forwards;
        }
        
        @keyframes feedback-slide-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes feedback-slide-out {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-10px);
          }
        }
      `}</style>
    </div>
  );
};

export default FeedbackMessage;

/**
 * SuccessMessage 组件
 * 成功反馈消息
 */
export const SuccessMessage: React.FC<{
  message: string;
  description?: string;
  duration?: number;
  onClose?: () => void;
}> = ({ message, description, duration = 3000, onClose }) => {
  return (
    <FeedbackMessage
      type="success"
      message={message}
      description={description}
      duration={duration}
      closable
      onClose={onClose}
    />
  );
};

/**
 * ErrorMessage 组件
 * 错误反馈消息
 */
export const ErrorMessage: React.FC<{
  message: string;
  description?: string;
  closable?: boolean;
  onClose?: () => void;
}> = ({ message, description, closable = true, onClose }) => {
  return (
    <FeedbackMessage
      type="error"
      message={message}
      description={description}
      closable={closable}
      onClose={onClose}
    />
  );
};

/**
 * WarningMessage 组件
 * 警告反馈消息
 */
export const WarningMessage: React.FC<{
  message: string;
  description?: string;
  closable?: boolean;
  onClose?: () => void;
}> = ({ message, description, closable = true, onClose }) => {
  return (
    <FeedbackMessage
      type="warning"
      message={message}
      description={description}
      closable={closable}
      onClose={onClose}
    />
  );
};

/**
 * InfoMessage 组件
 * 信息反馈消息
 */
export const InfoMessage: React.FC<{
  message: string;
  description?: string;
  closable?: boolean;
  onClose?: () => void;
}> = ({ message, description, closable = false, onClose }) => {
  return (
    <FeedbackMessage
      type="info"
      message={message}
      description={description}
      closable={closable}
      onClose={onClose}
    />
  );
};

/**
 * FormValidationError 组件
 * 表单验证错误提示
 */
export const FormValidationError: React.FC<{
  message: string;
  field?: string;
}> = ({ message, field }) => {
  return (
    <div
      className="form-validation-error"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
        color: 'var(--color-danger)',
        fontSize: 'var(--font-size-xs)',
        animation: 'slide-in-down 0.2s ease-out',
      }}
      role="alert"
    >
      <IconCloseCircle style={{ fontSize: 14 }} />
      {field ? `${field}: ` : ''}{message}
    </div>
  );
};

/**
 * SuccessCheckmark 组件
 * 成功打勾动画
 */
export const SuccessCheckmark: React.FC<{
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}> = ({ size = 48, className, style }) => {
  return (
    <div 
      className={className}
      style={{
        width: size,
        height: size,
        ...style,
      }}
    >
      <svg
        viewBox="0 0 52 52"
        style={{ width: '100%', height: '100%' }}
      >
        {/* 圆圈 */}
        <circle
          className="success-circle"
          cx="26"
          cy="26"
          r="24"
          fill="none"
          stroke="var(--color-success)"
          strokeWidth="2"
          style={{
            strokeDasharray: 200,
            strokeDashoffset: 200,
            animation: 'circle-draw 0.3s ease-out forwards',
          }}
        />
        {/* 对勾 */}
        <path
          className="success-check"
          fill="none"
          stroke="var(--color-success)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14 27l8 8 16-16"
          style={{
            strokeDasharray: 100,
            strokeDashoffset: 100,
            animation: 'check-draw 0.5s ease-out forwards',
            animationDelay: '0.2s',
          }}
        />
      </svg>
      
      <style>{`
        @keyframes circle-draw {
          to { stroke-dashoffset: 0; }
        }
        
        @keyframes check-draw {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
};

/**
 * ErrorCross 组件
 * 错误叉号动画
 */
export const ErrorCross: React.FC<{
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}> = ({ size = 48, className, style }) => {
  return (
    <div 
      className={className}
      style={{
        width: size,
        height: size,
        ...style,
      }}
    >
      <svg
        viewBox="0 0 52 52"
        style={{ width: '100%', height: '100%' }}
      >
        {/* 圆圈 */}
        <circle
          cx="26"
          cy="26"
          r="24"
          fill="none"
          stroke="var(--color-danger)"
          strokeWidth="2"
          style={{
            strokeDasharray: 200,
            strokeDashoffset: 200,
            animation: 'circle-draw 0.3s ease-out forwards',
          }}
        />
        {/* 叉号 */}
        <g
          style={{
            strokeDasharray: 60,
            strokeDashoffset: 60,
            animation: 'check-draw 0.4s ease-out forwards',
            animationDelay: '0.2s',
          }}
        >
          <path
            fill="none"
            stroke="var(--color-danger)"
            strokeWidth="3"
            strokeLinecap="round"
            d="M18 18l16 16"
          />
          <path
            fill="none"
            stroke="var(--color-danger)"
            strokeWidth="3"
            strokeLinecap="round"
            d="M34 18l-16 16"
          />
        </g>
      </svg>
      
      <style>{`
        @keyframes circle-draw {
          to { stroke-dashoffset: 0; }
        }
        
        @keyframes check-draw {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
};