/**
 * Error Display Components
 * 
 * Provides user-friendly error display components for different scenarios.
 */

import React from 'react';
import { Result, Button, Typography, Alert, Space } from '@arco-design/web-react';
import { IconRefresh, IconHome, IconBug } from '@arco-design/web-react/icon';
import { APIError, getUserFriendlyMessage, ErrorCode } from '../utils/apiClient';

const { Text, Title } = Typography;

/**
 * Props for ErrorDisplay component
 */
interface ErrorDisplayProps {
  error?: APIError | Error | null;
  message?: string;
  onRetry?: () => void;
  onHome?: () => void;
  showDetails?: boolean;
  compact?: boolean;
}

/**
 * Full-page error display for major errors
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  message,
  onRetry,
  onHome,
  showDetails = false,
  compact = false,
}) => {
  const apiError = error && 'code' in error ? error as APIError : null;
  const errorMessage = message || (apiError ? getUserFriendlyMessage(apiError) : '发生了错误');
  
  // Determine error type for visual
  const getErrorStatus = (): 'error' | 'warning' | 'info' => {
    if (!apiError) return 'error';
    
    switch (apiError.code) {
      case ErrorCode.SERVICE_UNAVAILABLE:
      case ErrorCode.EXTERNAL_SERVICE_ERROR:
        return 'warning';
      case ErrorCode.RATE_LIMIT_EXCEEDED:
        return 'info';
      default:
        return 'error';
    }
  };

  if (compact) {
    return (
      <Alert
        type={getErrorStatus()}
        content={
          <div>
            <Text>{errorMessage}</Text>
            {showDetails && apiError?.details && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-3)' }}>
                {JSON.stringify(apiError.details, null, 2)}
              </div>
            )}
          </div>
        }
        action={
          onRetry && (
            <Button size="small" onClick={onRetry}>
              重试
            </Button>
          )
        }
      />
    );
  }

  return (
    <Result
      status={getErrorStatus()}
      title="操作失败"
      subTitle={
        <div style={{ maxWidth: 500 }}>
          <Text>{errorMessage}</Text>
          {showDetails && apiError?.details && Object.keys(apiError.details).length > 0 && (
            <div style={{ marginTop: 16, textAlign: 'left' }}>
              <details>
                <summary style={{ cursor: 'pointer', fontSize: 12 }}>
                  技术详情
                </summary>
                <pre style={{ 
                  marginTop: 8, 
                  padding: 8, 
                  background: 'var(--color-fill-2)', 
                  borderRadius: 4,
                  fontSize: 11,
                  overflow: 'auto',
                }}>
                  {JSON.stringify(apiError.details, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      }
      extra={
        <Space>
          {onRetry && (
            <Button type="primary" icon={<IconRefresh />} onClick={onRetry}>
              重试
            </Button>
          )}
          {onHome && (
            <Button icon={<IconHome />} onClick={onHome}>
              返回首页
            </Button>
          )}
        </Space>
      }
    />
  );
};

/**
 * Inline error message for form fields
 */
interface FieldErrorProps {
  error?: string | string[];
}

export const FieldError: React.FC<FieldErrorProps> = ({ error }) => {
  if (!error) return null;
  
  const errors = Array.isArray(error) ? error : [error];
  
  return (
    <div style={{ color: 'var(--color-danger-6)', fontSize: 12, marginTop: 4 }}>
      {errors.map((err, index) => (
        <div key={index}>{err}</div>
      ))}
    </div>
  );
};

/**
 * Network error banner
 */
interface NetworkErrorBannerProps {
  isOnline: boolean;
  onRetry?: () => void;
}

export const NetworkErrorBanner: React.FC<NetworkErrorBannerProps> = ({
  isOnline,
  onRetry,
}) => {
  if (isOnline) return null;

  return (
    <Alert
      type="warning"
      banner
      content={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text>网络连接已断开</Text>
          {onRetry && (
            <Button size="small" onClick={onRetry}>
              重试
            </Button>
          )}
        </div>
      }
    />
  );
};

/**
 * Development-only error debugger
 */
interface ErrorDebuggerProps {
  error: any;
}

export const ErrorDebugger: React.FC<ErrorDebuggerProps> = ({ error }) => {
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <Alert
      type="warning"
      style={{ marginTop: 16 }}
      content={
        <div>
          <Text strong>
            <IconBug /> 开发调试信息
          </Text>
          <pre style={{ 
            marginTop: 8, 
            maxHeight: 200, 
            overflow: 'auto',
            fontSize: 11,
          }}>
            {JSON.stringify(error, null, 2)}
          </pre>
        </div>
      }
    />
  );
};

/**
 * Empty state with optional error
 */
interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  error?: APIError | null;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = '暂无数据',
  description,
  icon,
  action,
  error,
}) => {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: 48,
      textAlign: 'center',
    }}>
      {icon && <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>{icon}</div>}
      <Title heading={5}>{title}</Title>
      {description && <Text type="secondary">{description}</Text>}
      {error && (
        <div style={{ marginTop: 16, width: '100%', maxWidth: 400 }}>
          <ErrorDisplay error={error} compact />
        </div>
      )}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
};

export default ErrorDisplay;