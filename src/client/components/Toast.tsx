import React, { useState, useEffect, useCallback } from 'react';
import { Message, Button, Space } from '@arco-design/web-react';
import {
  IconCheckCircle,
  IconCloseCircle,
  IconInfoCircle,
  IconExclamationCircle,
  IconLoading,
} from '@arco-design/web-react/icon';

/**
 * Enhanced Toast Notification System
 * 
 * Issue #514: UX 改进 - 用户反馈机制
 * - 添加操作成功/失败的可定制 toast 提示
 * - 支持自动关闭和手动关闭
 * - 支持带操作的 toast（如撤销操作）
 * - 支持进度条显示
 */

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading';
export type ToastPosition = 'top' | 'bottom';

export interface ToastOptions {
  duration?: number; // 自动关闭时间（毫秒），0 表示不自动关闭
  showProgress?: boolean; // 显示倒计时进度条
  closable?: boolean; // 显示关闭按钮
  action?: {
    text: string;
    onClick: () => void;
  }; // 操作按钮
  icon?: React.ReactNode; // 自定义图标
  position?: ToastPosition;
  onClose?: () => void;
}

interface ToastInstance {
  id: string;
  type: ToastType;
  content: string;
  options: ToastOptions;
  progress: number;
}

// Toast 容器组件
const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastInstance[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // 暴露给全局使用的方法
  useEffect(() => {
    (window as any).__toastManager = {
      add: (type: ToastType, content: string, options: ToastOptions = {}) => {
        const id = `toast-${Date.now()}-${Math.random()}`;
        const toast: ToastInstance = {
          id,
          type,
          content,
          options: { duration: 3000, ...options },
          progress: 100,
        };
        
        setToasts(prev => [...prev, toast]);
        
        // 自动关闭逻辑
        if (options.duration !== 0) {
          const duration = options.duration || 3000;
          const startTime = Date.now();
          
          // 更新进度条
          const progressInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
            
            setToasts(prev => prev.map(t => 
              t.id === id ? { ...t, progress: remaining } : t
            ));
          }, 50);
          
          // 自动关闭
          setTimeout(() => {
            clearInterval(progressInterval);
            removeToast(id);
            options.onClose?.();
          }, duration);
        }
        
        return id;
      },
      remove: removeToast,
      clear: () => setToasts([]),
    };
    
    return () => {
      delete (window as any).__toastManager;
    };
  }, [removeToast]);

  // 获取图标
  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <IconCheckCircle style={{ color: '#00b42a' }} />;
      case 'error':
        return <IconCloseCircle style={{ color: '#f53f3f' }} />;
      case 'warning':
        return <IconExclamationCircle style={{ color: '#faad14' }} />;
      case 'loading':
        return <IconLoading style={{ color: '#165dff' }} spin />;
      case 'info':
      default:
        return <IconInfoCircle style={{ color: '#165dff' }} />;
    }
  };

  // 获取背景色
  const getBackgroundColor = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'rgba(0, 180, 42, 0.1)';
      case 'error':
        return 'rgba(245, 63, 63, 0.1)';
      case 'warning':
        return 'rgba(250, 173, 20, 0.1)';
      case 'loading':
        return 'rgba(22, 93, 255, 0.1)';
      case 'info':
      default:
        return 'rgba(22, 93, 255, 0.1)';
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: '90vw',
        width: 400,
      }}
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          style={{
            background: getBackgroundColor(toast.type),
            border: '1px solid rgba(0, 0, 0, 0.08)',
            borderRadius: 8,
            padding: '12px 16px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            animation: 'slideIn 0.3s ease-out',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* 进度条 */}
          {toast.options.showProgress && toast.options.duration !== 0 && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: 2,
                background: '#165dff',
                transition: 'width 0.05s linear',
                width: `${toast.progress}%`,
              }}
            />
          )}
          
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            {toast.options.icon || getIcon(toast.type)}
            
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: '#1d2129', wordBreak: 'break-word' }}>
                {toast.content}
              </div>
              
              {toast.options.action && (
                <div style={{ marginTop: 8 }}>
                  <Button
                    size="small"
                    type="primary"
                    onClick={toast.options.action.onClick}
                  >
                    {toast.options.action.text}
                  </Button>
                </div>
              )}
            </div>
            
            {toast.options.closable && (
              <Button
                type="text"
                size="mini"
                icon={<IconCloseCircle />}
                onClick={() => removeToast(toast.id)}
                style={{ color: '#86909c' }}
              />
            )}
          </div>
        </div>
      ))}
      
      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </div>
  );
};

// 便捷方法
export const Toast = {
  success: (content: string, options?: ToastOptions) => {
    return (window as any).__toastManager?.add('success', content, options);
  },
  
  error: (content: string, options?: ToastOptions) => {
    return (window as any).__toastManager?.add('error', content, options);
  },
  
  info: (content: string, options?: ToastOptions) => {
    return (window as any).__toastManager?.add('info', content, options);
  },
  
  warning: (content: string, options?: ToastOptions) => {
    return (window as any).__toastManager?.add('warning', content, options);
  },
  
  loading: (content: string, options?: ToastOptions) => {
    return (window as any).__toastManager?.add('loading', content, { ...options, duration: 0 });
  },
  
  remove: (id: string) => {
    (window as any).__toastManager?.remove(id);
  },
  
  clear: () => {
    (window as any).__toastManager?.clear();
  },
  
  // 特定场景的 toast
  orderSuccess: (orderId: string, side: 'buy' | 'sell', symbol: string) => {
    return Toast.success(
      `${side === 'buy' ? '买入' : '卖出'}订单已提交`,
      {
        duration: 5000,
        showProgress: true,
        closable: true,
        action: {
          text: '查看订单',
          onClick: () => {
            // 跳转到订单详情页
            window.location.href = `/orders?id=${orderId}`;
          },
        },
      }
    );
  },
  
  orderError: (error: string) => {
    return Toast.error(
      `订单提交失败: ${error}`,
      {
        duration: 6000,
        closable: true,
      }
    );
  },
  
  networkError: () => {
    return Toast.error(
      '网络连接失败，请检查网络后重试',
      {
        duration: 5000,
        closable: true,
      }
    );
  },
};

export default ToastContainer;