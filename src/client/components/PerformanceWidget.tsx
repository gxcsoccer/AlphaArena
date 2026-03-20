/**
 * Performance Monitoring Component
 * Development tool for monitoring dashboard performance
 * Only rendered in development mode
 */

import React, { memo } from 'react';
import { Card, Typography, Space, Tag, Grid, Progress } from '@arco-design/web-react';
import { IconDashboard } from '@arco-design/web-react/icon';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';

const { Text, _Title } = Typography;
const { Row, Col } = Grid;

interface PerformanceWidgetProps {
  componentName: string;
  dataCount?: number;
  showMemory?: boolean;
}

const PerformanceWidget: React.FC<PerformanceWidgetProps> = memo(({
  componentName,
  dataCount = 0,
  showMemory = true,
}) => {
  const { metrics } = usePerformanceMonitor({
    componentName,
    enableLogging: false,
  });

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return 'green';
    if (value <= thresholds.warning) return 'orange';
    return 'red';
  };

  const _renderStatus = metrics.avgRenderTime < 16 ? 'good' : 
                       metrics.avgRenderTime < 50 ? 'warning' : 'poor';

  return (
    <Card
      size="small"
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        width: 280,
        zIndex: 9999,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        background: 'var(--color-bg-2)',
      }}
      title={
        <Space>
          <IconDashboard />
          <Text strong>Performance Monitor</Text>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <Text type="secondary">Component:</Text>
          <Text strong style={{ marginLeft: 8 }}>{componentName}</Text>
        </div>

        {dataCount > 0 && (
          <div>
            <Text type="secondary">Data Count:</Text>
            <Tag color="blue" style={{ marginLeft: 8 }}>{dataCount.toLocaleString()}</Tag>
          </div>
        )}

        <Row gutter={8}>
          <Col span={12}>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>FPS</Text>
              <div>
                <Tag 
                  color={getStatusColor(60 - metrics.fps, { good: 10, warning: 30 })}
                  style={{ fontSize: 16, fontWeight: 'bold' }}
                >
                  {metrics.fps}
                </Tag>
              </div>
            </div>
          </Col>
          <Col span={12}>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>Render</Text>
              <div>
                <Tag 
                  color={getStatusColor(metrics.avgRenderTime, { good: 16, warning: 50 })}
                  style={{ fontSize: 16, fontWeight: 'bold' }}
                >
                  {metrics.avgRenderTime.toFixed(1)}ms
                </Tag>
              </div>
            </div>
          </Col>
        </Row>

        {showMemory && metrics.memoryUsage !== null && (
          <div>
            <Text type="secondary">Memory:</Text>
            <Progress
              percent={Math.min((metrics.memoryUsage / 100) * 100, 100)}
              style={{ marginTop: 4 }}
              size="small"
              color={metrics.memoryUsage < 50 ? '#00b42a' : metrics.memoryUsage < 80 ? '#ff7d00' : '#f53f3f'}
              formatText={() => `${metrics.memoryUsage.toFixed(0)}MB`}
            />
          </div>
        )}

        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 10 }}>
            Renders: {metrics.renderCount} | Last: {metrics.renderTime.toFixed(1)}ms
          </Text>
        </div>
      </Space>
    </Card>
  );
});

/**
 * FPS Counter - Minimal performance indicator
 */
export const FPSCounter: React.FC = memo(() => {
  const { metrics } = usePerformanceMonitor({
    componentName: 'App',
    enableLogging: false,
  });

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 10,
        right: 10,
        background: 'rgba(0,0,0,0.7)',
        color: metrics.fps >= 30 ? '#00b42a' : '#f53f3f',
        padding: '4px 8px',
        borderRadius: 4,
        fontSize: 12,
        fontFamily: 'monospace',
        zIndex: 9999,
      }}
    >
      {metrics.fps} FPS
    </div>
  );
});

FPSCounter.displayName = 'FPSCounter';

/**
 * Performance comparison chart data
 */
export const PerformanceChart: React.FC<{
  metrics: Array<{ name: string; value: number; threshold: number }>;
}> = memo(({ metrics }) => {
  return (
    <Card title="Performance Metrics" size="small">
      <Space direction="vertical" style={{ width: '100%' }}>
        {metrics.map(({ name, value, threshold }) => {
          const percent = Math.min((value / threshold) * 100, 100);
          const color = percent <= 50 ? 'green' : percent <= 80 ? 'orange' : 'red';

          return (
            <div key={name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text>{name}</Text>
                <Text type="secondary">{value.toFixed(1)} / {threshold}</Text>
              </div>
              <Progress
                percent={percent}
                size="small"
                color={color}
              />
            </div>
          );
        })}
      </Space>
    </Card>
  );
});

PerformanceChart.displayName = 'PerformanceChart';

PerformanceWidget.displayName = 'PerformanceWidget';

export default PerformanceWidget;