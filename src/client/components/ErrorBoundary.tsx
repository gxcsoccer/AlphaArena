import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button, Alert, Typography, Spin } from '@arco-design/web-react';
import { validateConfig, getConfigErrorMessage } from '../utils/config';

const { Text } = Typography;

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  remountKey: number; // Key to force remount on retry
}

/**
 * Check if this is a DOM operation error from third-party libraries
 * These errors are often transient and should be handled gracefully
 */
function isThirdPartyDOMError(error: Error | null): boolean {
  if (!error) return false;
  
  // Common DOM operation errors from browser/third-party libraries
  const domErrorPatterns = [
    'NotFoundError',
    'removeChild',
    'appendChild',
    'insertBefore',
    'replaceChild',
    'parentNode',
    'Failed to execute',
  ];
  
  const errorString = `${error.name}: ${error.message}`;
  return domErrorPatterns.some(pattern => errorString.includes(pattern));
}

/**
 * Check if this is a chunk/module loading error
 * These errors occur when the browser fails to load a JavaScript chunk
 * Common causes: deployment updates, cache issues, network problems
 * 
 * Note: lazyWithRetry handles chunk errors by forcing an immediate hard reload,
 * so if we reach here with a chunk error, something unusual happened.
 */
function isChunkLoadError(error: Error | null): boolean {
  if (!error) return false;
  
  const chunkErrorPatterns = [
    "Failed to fetch dynamically imported module",
    "Loading chunk",
    "Loading CSS chunk",
    "ChunkLoadError",
    "Unable to resolve module",
  ];
  
  const errorString = `${error.name}: ${error.message}`;
  return chunkErrorPatterns.some(pattern => errorString.includes(pattern));
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the component tree
 * and displays a fallback UI instead of crashing the whole app
 * 
 * Special handling for third-party DOM errors (e.g., Arco Design):
 * - Shows a graceful loading spinner instead of error details
 * - Auto-retries after a short delay since these errors are often transient
 */
export class ErrorBoundary extends Component<Props, State> {
  private retryTimeout: NodeJS.Timeout | null = null;
  private isInRetryCycle = false;
  
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0,
      remountKey: 0,
    };
    
    // Validate configuration on mount
    const config = validateConfig();
    if (!config.isConfigured) {
      console.error('[ErrorBoundary] Configuration validation failed:', config.missingVars);
    }
  }

  componentWillUnmount() {
    // Clean up any pending retry timeouts
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    this.isInRetryCycle = false;
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, retryCount: 0, remountKey: 0 };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // CRITICAL: Log errors prominently to help debugging production issues
    console.error('========================================');
    console.error('🚨 ERRORBOUNDARY CAUGHT ERROR 🚨');
    console.error('========================================');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
    console.error('Full error object:', error);
    console.error('========================================');
    
    // Store error globally for easy access from console
    (window as any).__LAST_ERROR__ = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      componentStack: errorInfo.componentStack,
      timestamp: Date.now(),
      url: window.location.href,
    };
    
    // Log to error reporting service if configured
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Special handling for chunk loading errors
    // These should be rare now since lazyWithRetry handles them earlier
    // But if they reach here, force an immediate hard reload
    if (isChunkLoadError(error)) {
      console.warn("[ErrorBoundary] Chunk error reached ErrorBoundary, forcing immediate reload...");
      
      // Force immediate hard reload with cache-busting
      const cacheBuster = `__t=${Date.now()}`;
      const currentUrl = window.location.href;
      const separator = currentUrl.includes('?') ? '&' : '?';
      window.location.href = currentUrl + separator + cacheBuster;
      return;
    }
    
    // Special handling for third-party DOM errors (e.g., Arco Design removeChild errors)
    // These are often transient timing issues during component cleanup
    if (isThirdPartyDOMError(error)) {
      console.warn("[ErrorBoundary] Detected third-party DOM error, will auto-retry...");
      
      // Auto-retry after a short delay (up to 3 attempts)
      if (!this.isInRetryCycle && this.state.retryCount < 3) {
        this.isInRetryCycle = true;
        if (this.retryTimeout) clearTimeout(this.retryTimeout);
        this.retryTimeout = setTimeout(() => {
          this.isInRetryCycle = false;
          this.setState((prevState) => ({
            hasError: false,
            retryCount: prevState.retryCount + 1,
            remountKey: prevState.remountKey + 1,
          }));
        }, 1000);
        return; // Do not show error UI yet, wait for retry
      }
    }
    
    // Store error info for display if not auto-retrying
    this.setState({ errorInfo });
  }

  handleReset = () => {
    // CRITICAL: Increment remountKey to force React to fully unmount and remount children
    // Simply clearing error state with setState doesn't trigger remount - children stay in error state
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null, 
      retryCount: 0,
      remountKey: this.state.remountKey + 1,
    });
  };

  handleReload = () => {
    // Force hard reload with cache-busting
    const cacheBuster = `__t=${Date.now()}`;
    const currentUrl = window.location.href;
    const separator = currentUrl.includes('?') ? '&' : '?';
    window.location.href = currentUrl + separator + cacheBuster;
  };

  render() {
    if (this.state.hasError) {
      // Render custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Check for chunk loading error (should be rare now)
      const isChunkError = isChunkLoadError(this.state.error);

      // For chunk loading errors, show a reload prompt
      if (isChunkError) {
        return (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: 300,
            padding: 24,
          }}>
            <Spin size="large" style={{ marginBottom: 16 }} />
            <Text style={{ marginBottom: 8 }}>页面资源加载中，请稍候...</Text>
            <Text type="secondary" style={{ fontSize: 12, marginBottom: 16 }}>
              （系统更新后正在加载最新版本）
            </Text>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button type="primary" onClick={this.handleReload}>
                刷新页面
              </Button>
            </div>
          </div>
        );
      }

      const isDOMError = isThirdPartyDOMError(this.state.error);

      // For third-party DOM errors, show a graceful loading spinner with retry option
      if (isDOMError) {
        return (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: 300,
            padding: 24,
          }}>
            <Spin size="large" style={{ marginBottom: 16 }} />
            <Text style={{ marginBottom: 8 }}>界面加载中，请稍候...</Text>
            <Text type="secondary" style={{ fontSize: 12, marginBottom: 16 }}>
              （第三方组件库的临时渲染问题，正在自动恢复）
            </Text>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={this.handleReset}>重试</Button>
              <Button status="danger" onClick={this.handleReload}>
                刷新页面
              </Button>
            </div>
            {this.state.retryCount > 0 && (
              <Text type="secondary" style={{ fontSize: 11, marginTop: 8 }}>
                已尝试恢复 {this.state.retryCount} 次
              </Text>
            )}
          </div>
        );
      }

      // Check if this might be a configuration error
      const config = validateConfig();
      const isConfigError = !config.isConfigured || 
        (this.state.error?.message?.includes('environment') || 
         this.state.error?.message?.includes('configuration'));

      // Default error UI for application errors - show full details
      return (
        <Result
          status="error"
          title="组件加载失败"
          subTitle={
            <div style={{ maxWidth: 600, textAlign: 'left' }}>
              <p>很抱歉，该组件出现了错误。</p>
              
              {isConfigError && (
                <Alert
                  type="warning"
                  style={{ marginTop: 16 }}
                  content={
                    <div>
                      <Text strong>可能的原因：</Text>
                      <p style={{ marginTop: 8, marginBottom: 8 }}>
                        环境变量配置不完整。{getConfigErrorMessage(config)}
                      </p>
                      <Text secondary>
                        请联系管理员检查 Vercel 项目设置中的环境变量配置。
                      </Text>
                    </div>
                  }
                />
              )}
              
              {this.state.error && (
                <details open style={{ marginTop: 16, fontSize: 12, color: '#86909c' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>错误详情（已自动展开）</summary>
                  <div style={{ 
                    padding: 12, 
                    background: '#fff1f0', 
                    borderRadius: 4,
                    overflow: 'auto',
                    maxWidth: '100%',
                    maxHeight: 400,
                    fontFamily: 'monospace',
                    fontSize: 11,
                    border: '1px solid #ffa39e',
                  }}>
                    <div style={{ marginBottom: 8 }}>
                      <Text strong style={{ color: '#f5222d' }}>错误类型：</Text> {this.state.error.name || 'Error'}
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <Text strong style={{ color: '#f5222d' }}>错误信息：</Text> {this.state.error.message}
                    </div>
                    {this.state.error.stack && (
                      <div>
                        <Text strong style={{ color: '#f5222d' }}>堆栈跟踪：</Text>
                        <pre style={{ 
                          marginTop: 4,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          background: '#f5f5f5',
                          padding: 8,
                        }}>
                          {this.state.error.stack}
                        </pre>
                      </div>
                    )}
                    {this.state.errorInfo?.componentStack && (
                      <div style={{ marginTop: 12 }}>
                        <Text strong style={{ color: '#f5222d' }}>组件堆栈：</Text>
                        <pre style={{ 
                          marginTop: 4,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          background: '#f5f5f5',
                          padding: 8,
                        }}>
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                    <div style={{ marginTop: 12, padding: 8, background: '#e6f7ff', borderRadius: 4 }}>
                      <Text strong>💡 调试提示：</Text>
                      <p style={{ margin: '4px 0 0 0', fontSize: 10 }}>
                        打开浏览器控制台（F12），输入 <code style={{ background: '#f0f0f0', padding: '2px 4px' }}>window.__LAST_ERROR__</code> 查看完整错误对象
                      </p>
                    </div>
                  </div>
                </details>
              )}
            </div>
          }
          extra={
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Button onClick={this.handleReset}>重试</Button>
              <Button status="danger" onClick={this.handleReload}>
                刷新页面
              </Button>
            </div>
          }
        />
      );
    }

    // CRITICAL: Use remountKey to force full remount when retry is triggered
    // This ensures children components are properly unmounted and remounted fresh
    return <React.Fragment key={this.state.remountKey}>{this.props.children}</React.Fragment>;
  }
}

export default ErrorBoundary;
