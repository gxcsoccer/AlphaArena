import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button } from '@arco-design/web-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the component tree
 * and displays a fallback UI instead of crashing the whole app
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    
    // Log to error reporting service if configured
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    // Optionally reload the page
    // window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Render custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <Result
          status="error"
          title="组件加载失败"
          subTitle={
            <div style={{ maxWidth: 600, textAlign: 'left' }}>
              <p>很抱歉，该组件出现了错误。</p>
              {this.state.error && (
                <details style={{ marginTop: 16, fontSize: 12, color: '#86909c' }}>
                  <summary>错误详情</summary>
                  <pre style={{ 
                    marginTop: 8, 
                    padding: 12, 
                    background: '#f5f5f5', 
                    borderRadius: 4,
                    overflow: 'auto',
                    maxWidth: '100%',
                  }}>
                    {this.state.error.toString()}
                  </pre>
                </details>
              )}
            </div>
          }
          extra={
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Button onClick={this.handleReset}>重试</Button>
              <Button status="danger" onClick={() => window.location.reload()}>
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
