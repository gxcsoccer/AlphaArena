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
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    console.error('[ErrorBoundary] Full error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    
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

      // Default error UI
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
                <details style={{ marginTop: 16, fontSize: 12, color: '#86909c' }}>
                  <summary>错误详情（点击展开）</summary>
                  <div style={{ 
                    marginTop: 8, 
                    padding: 12, 
                    background: '#f5f5f5', 
                    borderRadius: 4,
                    overflow: 'auto',
                    maxWidth: '100%',
                    fontFamily: 'monospace',
                    fontSize: 11,
                  }}>
                    <div style={{ marginBottom: 8 }}>
                      <Text strong>错误类型：</Text> {this.state.error.name || 'Error'}
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <Text strong>错误信息：</Text> {this.state.error.message}
                    </div>
                    {this.state.error.stack && (
                      <div>
                        <Text strong>堆栈跟踪：</Text>
                        <pre style={{ 
                          marginTop: 4,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}>
                          {this.state.error.stack}
                        </pre>
                      </div>
                    )}
                    {this.state.errorInfo?.componentStack && (
                      <div style={{ marginTop: 12 }}>
                        <Text strong>组件堆栈：</Text>
                        <pre style={{ 
                          marginTop: 4,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}>
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
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
