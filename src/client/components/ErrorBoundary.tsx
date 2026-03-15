import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button, Alert, Typography } from '@arco-design/web-react';
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
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the component tree
 * and displays a fallback UI instead of crashing the whole app
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
    
    // Validate configuration on mount
    const config = validateConfig();
    if (!config.isConfigured) {
      console.error('[ErrorBoundary] Configuration validation failed:', config.missingVars);
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
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
    
    // Auto-expand error details in UI for better visibility
    this.setState({ errorInfo });
    
    // Log to error reporting service if configured
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Render custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Check if this might be a configuration error
      const config = validateConfig();
      const isConfigError = !config.isConfigured || 
        (this.state.error?.message?.includes('environment') || 
         this.state.error?.message?.includes('configuration'));

      // Default error UI - auto-expand error details for visibility
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

    return this.props.children;
  }
}

export default ErrorBoundary;
