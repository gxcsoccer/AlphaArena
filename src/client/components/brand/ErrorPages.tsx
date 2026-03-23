/**
 * Error Page Components
 * 
 * Issue #572: Brand Visual Elements
 * 
 * Professional error pages with illustrations for:
 * - 404 Not Found
 * - 500 Server Error
 * - Network Error
 * - Permission Denied
 */

import React from 'react';
import { Button, Result, Typography } from '@arco-design/web-react';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

/**
 * Error Page Wrapper
 */
const ErrorPageWrapper: React.FC<{
  children: React.ReactNode;
  title: string;
  description: string;
  actions?: React.ReactNode;
}> = ({ children, title, description, actions }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      textAlign: 'center',
      background: 'var(--color-bg-1)',
    }}
  >
    <div
      style={{
        maxWidth: 480,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.5rem',
      }}
    >
      {children}
      <Title heading={2} style={{ margin: 0 }}>
        {title}
      </Title>
      <Text
        style={{
          color: 'var(--color-text-2)',
          maxWidth: 360,
          lineHeight: 1.6,
        }}
      >
        {description}
      </Text>
      {actions && <div style={{ display: 'flex', gap: '0.75rem' }}>{actions}</div>}
    </div>
  </div>
);

/**
 * 404 Not Found Illustration
 */
const NotFoundIllustration: React.FC = () => (
  <svg
    width="280"
    height="200"
    viewBox="0 0 280 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Background grid */}
    <defs>
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--color-border-1)" strokeWidth="0.5" opacity="0.5" />
      </pattern>
    </defs>
    <rect width="280" height="200" fill="url(#grid)" />
    
    {/* 404 text */}
    <text
      x="140"
      y="120"
      textAnchor="middle"
      fill="var(--color-text-1)"
      fontSize="72"
      fontFamily="var(--font-family-display)"
      fontWeight="800"
      letterSpacing="-0.02em"
      opacity="0.15"
    >
      404
    </text>
    
    {/* Broken path/road */}
    <path
      d="M40 160 L100 160 L100 140 L140 140 L140 160 L180 160 L180 140 L240 140"
      stroke="var(--color-text-3)"
      strokeWidth="4"
      strokeLinecap="round"
      strokeDasharray="8 4"
      fill="none"
    />
    
    {/* Question mark floating */}
    <g transform="translate(140, 50)">
      <circle cx="0" cy="0" r="30" fill="var(--color-primary-50)" stroke="var(--color-primary-300)" strokeWidth="2" />
      <text
        x="0"
        y="12"
        textAnchor="middle"
        fill="var(--color-primary-500)"
        fontSize="36"
        fontFamily="var(--font-family-display)"
        fontWeight="600"
      >
        ?
      </text>
    </g>
    
    {/* Decorative elements */}
    <circle cx="50" cy="50" r="4" fill="var(--color-secondary-300)" />
    <circle cx="230" cy="70" r="4" fill="var(--color-primary-300)" />
    <path d="M60 80l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="var(--color-warning-300)" />
    
    {/* Arrow pointing wrong way */}
    <g transform="translate(200, 90)">
      <path d="M0 0L-15 10L-10 0L-15 -10Z" fill="var(--color-error-400)" />
    </g>
  </svg>
);

/**
 * 500 Server Error Illustration
 */
const ServerErrorIllustration: React.FC = () => (
  <svg
    width="280"
    height="200"
    viewBox="0 0 280 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Server box */}
    <rect x="90" y="50" width="100" height="120" rx="8" fill="var(--color-fill-1)" stroke="var(--color-border-1)" strokeWidth="2" />
    
    {/* Server details */}
    <rect x="100" y="70" width="80" height="15" rx="4" fill="var(--color-bg-1)" />
    <circle cx="165" cy="77" r="4" fill="var(--color-success-400)" />
    <rect x="100" y="95" width="80" height="15" rx="4" fill="var(--color-bg-1)" />
    <circle cx="165" cy="102" r="4" fill="var(--color-error-400)" />
    <rect x="100" y="120" width="80" height="15" rx="4" fill="var(--color-bg-1)" />
    <circle cx="165" cy="127" r="4" fill="var(--color-warning-400)" />
    
    {/* Warning triangle */}
    <g transform="translate(140, 170)">
      <path d="M0 -25L22 12H-22Z" fill="var(--color-warning-100)" stroke="var(--color-warning-500)" strokeWidth="2" />
      <text x="0" y="4" textAnchor="middle" fill="var(--color-warning-600)" fontSize="16" fontWeight="bold">!</text>
    </g>
    
    {/* Lightning bolt (error) */}
    <g transform="translate(50, 80)">
      <path d="M15 0L5 15H12L7 30L22 12H15L20 0Z" fill="var(--color-error-400)" />
    </g>
    
    {/* Sparkles */}
    <path d="M230 60l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" fill="var(--color-secondary-300)" />
    <path d="M30 130l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="var(--color-primary-300)" />
    
    {/* Error code */}
    <text
      x="140"
      y="40"
      textAnchor="middle"
      fill="var(--color-error-500)"
      fontSize="14"
      fontFamily="var(--font-family-mono)"
      fontWeight="600"
    >
      Error 500
    </text>
  </svg>
);

/**
 * Network Error Illustration
 */
const NetworkErrorIllustration: React.FC = () => (
  <svg
    width="280"
    height="200"
    viewBox="0 0 280 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* WiFi signal - broken */}
    <g transform="translate(140, 80)">
      {/* Signal arcs */}
      <path d="M-40 30Q0 -10 40 30" stroke="var(--color-text-3)" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.3" />
      <path d="M-30 20Q0 -5 30 20" stroke="var(--color-text-3)" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.5" />
      <path d="M-20 10Q0 0 20 10" stroke="var(--color-text-3)" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.7" />
      
      {/* Center dot */}
      <circle cx="0" cy="35" r="6" fill="var(--color-text-3)" />
      
      {/* X mark - broken */}
      <path d="M-35 -20L-15 0M-15 -20L-35 0" stroke="var(--color-error-500)" strokeWidth="3" strokeLinecap="round" />
    </g>
    
    {/* Cloud - disconnected */}
    <g transform="translate(140, 140)">
      <path
        d="M-30 10C-45 10-50 -5-35 -15C-35 -35-10 -40 5 -25C25 -40 45 -30 45 -10C55 -5 50 10 40 10H-30Z"
        fill="var(--color-fill-1)"
        stroke="var(--color-border-1)"
        strokeWidth="2"
      />
      
      {/* Sad face */}
      <circle cx="-10" cy="-5" r="3" fill="var(--color-text-3)" />
      <circle cx="10" cy="-5" r="3" fill="var(--color-text-3)" />
      <path d="M-10 8Q0 3 10 8" stroke="var(--color-text-3)" strokeWidth="2" strokeLinecap="round" fill="none" />
    </g>
    
    {/* Decorative elements */}
    <circle cx="50" cy="50" r="4" fill="var(--color-primary-200)" />
    <circle cx="230" cy="60" r="4" fill="var(--color-secondary-200)" />
    <path d="M60 100l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="var(--color-warning-300)" />
    
    {/* Retry arrows */}
    <g transform="translate(210, 130)">
      <circle cx="0" cy="0" r="18" fill="var(--color-primary-100)" stroke="var(--color-primary-300)" strokeWidth="2" />
      <path d="M-8 -3A10 10 0 1 1 8 -3" stroke="var(--color-primary-500)" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M8 -8L8 -3L13 -3" stroke="var(--color-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </g>
  </svg>
);

/**
 * Permission Denied Illustration
 */
const PermissionDeniedIllustration: React.FC = () => (
  <svg
    width="280"
    height="200"
    viewBox="0 0 280 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Shield */}
    <path
      d="M140 20L200 50V100C200 140 170 170 140 180C110 170 80 140 80 100V50L140 20Z"
      fill="var(--color-fill-1)"
      stroke="var(--color-border-1)"
      strokeWidth="2"
    />
    
    {/* Lock */}
    <rect x="120" y="90" width="40" height="35" rx="4" fill="var(--color-primary-100)" stroke="var(--color-primary-400)" strokeWidth="2" />
    <path
      d="M128 90V80C128 72 133 65 140 65C147 65 152 72 152 80V90"
      stroke="var(--color-primary-400)"
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
    />
    <circle cx="140" cy="107" r="4" fill="var(--color-primary-500)" />
    
    {/* X mark - denied */}
    <g transform="translate(185, 70)">
      <circle cx="0" cy="0" r="15" fill="var(--color-error-100)" stroke="var(--color-error-400)" strokeWidth="2" />
      <path d="M-5 -5L5 5M5 -5L-5 5" stroke="var(--color-error-500)" strokeWidth="2" strokeLinecap="round" />
    </g>
    
    {/* Warning signs */}
    <path d="M60 60l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" fill="var(--color-warning-300)" />
    <path d="M220 100l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="var(--color-secondary-300)" />
    
    {/* 403 text */}
    <text
      x="140"
      y="165"
      textAnchor="middle"
      fill="var(--color-text-3)"
      fontSize="14"
      fontFamily="var(--font-family-mono)"
      fontWeight="600"
    >
      403 Forbidden
    </text>
  </svg>
);

/**
 * 404 Not Found Page
 */
export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <ErrorPageWrapper
      title="页面未找到"
      description="抱歉，您访问的页面不存在或已被移除。请检查网址是否正确，或返回首页继续浏览。"
      actions={
        <>
          <Button type="primary" onClick={() => navigate('/')}>
            返回首页
          </Button>
          <Button onClick={() => navigate(-1)}>
            返回上一页
          </Button>
        </>
      }
    >
      <NotFoundIllustration />
    </ErrorPageWrapper>
  );
};

/**
 * 500 Server Error Page
 */
export const ServerErrorPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <ErrorPageWrapper
      title="服务器错误"
      description="服务器遇到了问题，请稍后再试。如果问题持续存在，请联系我们的支持团队。"
      actions={
        <>
          <Button type="primary" onClick={() => window.location.reload()}>
            刷新页面
          </Button>
          <Button onClick={() => navigate('/')}>
            返回首页
          </Button>
        </>
      }
    >
      <ServerErrorIllustration />
    </ErrorPageWrapper>
  );
};

/**
 * Network Error Page
 */
export const NetworkErrorPage: React.FC = () => {
  return (
    <ErrorPageWrapper
      title="网络连接失败"
      description="无法连接到服务器，请检查您的网络连接后重试。"
      actions={
        <>
          <Button type="primary" onClick={() => window.location.reload()}>
            重试
          </Button>
          <Button onClick={() => window.open('https://status.alphaarena.app', '_blank')}>
            查看服务状态
          </Button>
        </>
      }
    >
      <NetworkErrorIllustration />
    </ErrorPageWrapper>
  );
};

/**
 * Permission Denied Page
 */
export const PermissionDeniedPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <ErrorPageWrapper
      title="访问被拒绝"
      description="您没有权限访问此页面。如果您认为这是一个错误，请联系管理员。"
      actions={
        <>
          <Button type="primary" onClick={() => navigate('/')}>
            返回首页
          </Button>
          <Button onClick={() => navigate('/login')}>
            切换账号
          </Button>
        </>
      }
    >
      <PermissionDeniedIllustration />
    </ErrorPageWrapper>
  );
};

/**
 * Error Boundary Fallback Component
 */
export const ErrorFallback: React.FC<{
  error?: Error;
  resetErrorBoundary?: () => void;
}> = ({ error, resetErrorBoundary }) => {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <ErrorPageWrapper
      title="出错了"
      description={isDev && error?.message ? error.message : '应用程序遇到了意外错误，请刷新页面重试。'}
      actions={
        <>
          <Button type="primary" onClick={() => resetErrorBoundary?.() || window.location.reload()}>
            重试
          </Button>
          <Button onClick={() => window.location.href = '/'}>
            返回首页
          </Button>
        </>
      }
    >
      <ServerErrorIllustration />
      {isDev && error?.stack && (
        <pre
          style={{
            maxWidth: 480,
            padding: '1rem',
            background: 'var(--color-fill-1)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.75rem',
            overflow: 'auto',
            textAlign: 'left',
          }}
        >
          {error.stack}
        </pre>
      )}
    </ErrorPageWrapper>
  );
};

export default NotFoundPage;