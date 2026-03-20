/**
 * SchedulerExecutionLog Component
 * Real-time execution log stream with auto-scroll
 */

import React, { useEffect, useRef, useState } from 'react';
import { Card, Typography, Space, Tag, Empty, Button, Badge, Timeline } from '@arco-design/web-react';
import {
  IconCheckCircle,
  IconCloseCircle,
  IconMinusCircle,
  IconPlayArrow,
  IconDelete,
  IconRefresh,
} from '@arco-design/web-react/icon';
import { useSchedulerRealtime, ExecutionEvent } from '../hooks/useSchedulerRealtime';

const { Text, Title } = Typography;

interface SchedulerExecutionLogProps {
  userId: string | undefined;
  maxEvents?: number;
  autoScroll?: boolean;
  showClearButton?: boolean;
}

const SchedulerExecutionLog: React.FC<SchedulerExecutionLogProps> = ({
  userId,
  maxEvents = 20,
  autoScroll = true,
  showClearButton = true,
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [visibleEvents, setVisibleEvents] = useState<ExecutionEvent[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const { executionEvents, isConnected } = useSchedulerRealtime({
    userId,
    maxExecutionEvents: maxEvents * 2,
  });

  // Update visible events when new events arrive
  useEffect(() => {
    if (!isPaused) {
      setVisibleEvents(executionEvents.slice(0, maxEvents));
    }
  }, [executionEvents, isPaused, maxEvents]);

  // Auto-scroll to top when new events arrive
  useEffect(() => {
    if (autoScroll && containerRef.current && !isPaused) {
      containerRef.current.scrollTop = 0;
    }
  }, [visibleEvents, autoScroll, isPaused]);

  const getStatusIcon = (type: string) => {
    switch (type) {
      case 'execution_start':
        return <IconPlayArrow style={{ color: 'rgb(var(--primary-6))' }} />;
      case 'execution_complete':
        return <IconCheckCircle style={{ color: 'rgb(var(--success-6))' }} />;
      case 'execution_failed':
        return <IconCloseCircle style={{ color: 'rgb(var(--danger-6))' }} />;
      case 'execution_skipped':
        return <IconMinusCircle style={{ color: 'rgb(var(--warning-6))' }} />;
      default:
        return null;
    }
  };

  const getStatusColor = (type: string) => {
    switch (type) {
      case 'execution_start':
        return 'blue';
      case 'execution_complete':
        return 'green';
      case 'execution_failed':
        return 'red';
      case 'execution_skipped':
        return 'orange';
      default:
        return 'gray';
    }
  };

  const getStatusText = (type: string) => {
    switch (type) {
      case 'execution_start':
        return '开始执行';
      case 'execution_complete':
        return '执行成功';
      case 'execution_failed':
        return '执行失败';
      case 'execution_skipped':
        return '跳过执行';
      default:
        return type;
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleClear = () => {
    setVisibleEvents([]);
  };

  const handleTogglePause = () => {
    setIsPaused(!isPaused);
  };

  return (
    <Card
      title={
        <Space>
          <Title heading={5} style={{ margin: 0 }}>执行日志</Title>
          {!isConnected && (
            <Badge status="offline" text={<Text type="secondary">未连接</Text>} />
          )}
        </Space>
      }
      extra={
        <Space>
          <Button
            size="small"
            icon={isPaused ? <IconPlayArrow /> : <IconRefresh />}
            onClick={handleTogglePause}
          >
            {isPaused ? '继续' : '暂停'}
          </Button>
          {showClearButton && (
            <Button
              size="small"
              icon={<IconDelete />}
              onClick={handleClear}
            >
              清空
            </Button>
          )}
        </Space>
      }
    >
      <div
        ref={containerRef}
        style={{
          maxHeight: 400,
          overflowY: 'auto',
          padding: '8px 0',
        }}
      >
        {visibleEvents.length === 0 ? (
          <Empty description="暂无执行记录" />
        ) : (
          <Timeline>
            {visibleEvents.map((event) => (
              <Timeline.Item
                key={`${event.executionId}-${event.timestamp}`}
                dot={getStatusIcon(event.type)}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Space>
                    <Tag color={getStatusColor(event.type)}>
                      {getStatusText(event.type)}
                    </Tag>
                    <Text strong>{event.scheduleName}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {formatTime(event.timestamp)}
                    </Text>
                  </Space>
                  
                  <Space size="small">
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      触发: {event.triggerType === 'scheduled' ? '定时' : 
                             event.triggerType === 'manual' ? '手动' : '条件'}
                    </Text>
                    
                    {event.result && event.type !== 'execution_start' && (
                      <>
                        <Text type="secondary" style={{ fontSize: 12 }}>|</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          交易数: {event.result.tradesExecuted}
                        </Text>
                        {event.result.totalValue !== undefined && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            金额: ${event.result.totalValue.toFixed(2)}
                          </Text>
                        )}
                      </>
                    )}
                  </Space>

                  {event.result?.errorMessage && (
                    <Text type="error" style={{ fontSize: 12 }}>
                      {event.result.errorMessage}
                    </Text>
                  )}
                </div>
              </Timeline.Item>
            ))}
          </Timeline>
        )}

        {isPaused && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(var(--gray-1), 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text type="secondary">日志已暂停，点击&ldquo;继续&rdquo;恢复</Text>
          </div>
        )}
      </div>
    </Card>
  );
};

export default SchedulerExecutionLog;