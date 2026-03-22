import React, { useState, useEffect, useRef } from 'react';
import { Card, Steps, Typography, Space, Progress, Button, Tag } from '@arco-design/web-react';
import {
  IconCheckCircle,
  IconCloseCircle,
  IconLoading,
  IconClockCircle,
} from '@arco-design/web-react/icon';

/**
 * Order Status Tracker Component
 * 
 * Issue #514: UX 改进 - 订单状态实时更新动画
 * - 显示订单从提交到完成的实时状态
 * - 提供视觉动画反馈
 * - 支持查看订单详情
 */

const { Text, Title } = Typography;

export type OrderStatus = 
  | 'pending'      // 等待提交
  | 'submitted'    // 已提交到交易所
  | 'processing'   // 交易所处理中
  | 'filled'       // 已成交
  | 'partial'      // 部分成交
  | 'cancelled'    // 已取消
  | 'failed';      // 失败

export interface OrderStatusInfo {
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'limit' | 'market' | 'stop_loss' | 'take_profit';
  status: OrderStatus;
  filledQuantity?: number;
  totalQuantity: number;
  price?: number;
  averagePrice?: number;
  timestamp: Date;
  message?: string;
}

interface OrderStatusTrackerProps {
  order: OrderStatusInfo;
  onClose?: () => void;
  autoClose?: boolean; // 成功后自动关闭
  autoCloseDelay?: number;
}

// 状态映射到步骤
const statusToStep: Record<OrderStatus, number> = {
  pending: 0,
  submitted: 1,
  processing: 2,
  filled: 3,
  partial: 2,
  cancelled: 2,
  failed: 2,
};

// 状态标签颜色
const statusColors: Record<OrderStatus, string> = {
  pending: 'gray',
  submitted: 'blue',
  processing: 'orange',
  filled: 'green',
  partial: 'orange',
  cancelled: 'red',
  failed: 'red',
};

// 状态标签文本
const statusLabels: Record<OrderStatus, string> = {
  pending: '等待提交',
  submitted: '已提交',
  processing: '处理中',
  filled: '已成交',
  partial: '部分成交',
  cancelled: '已取消',
  failed: '失败',
};

const OrderStatusTracker: React.FC<OrderStatusTrackerProps> = ({
  order,
  onClose,
  autoClose = true,
  autoCloseDelay = 5000,
}) => {
  const [currentStatus, setCurrentStatus] = useState<OrderStatus>(order.status);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(Date.now());

  // 模拟订单状态更新（实际应用中应该通过 WebSocket 获取）
  useEffect(() => {
    if (currentStatus === 'pending') {
      // 模拟提交流程
      const timer = setTimeout(() => {
        setCurrentStatus('submitted');
      }, 500);
      return () => clearTimeout(timer);
    }
    
    if (currentStatus === 'submitted') {
      const timer = setTimeout(() => {
        setCurrentStatus('processing');
      }, 1000);
      return () => clearTimeout(timer);
    }
    
    if (currentStatus === 'processing') {
      // 模拟处理过程
      const timer = setTimeout(() => {
        // 随机成功或失败（模拟）
        const success = Math.random() > 0.1; // 90% 成功率
        setCurrentStatus(success ? 'filled' : 'failed');
      }, 2000);
      return () => clearTimeout(timer);
    }
    
    // 成功后自动关闭
    if (currentStatus === 'filled' && autoClose) {
      const timer = setTimeout(() => {
        onClose?.();
      }, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [currentStatus, autoClose, autoCloseDelay, onClose]);

  // 更新进度条和已用时间
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - startTimeRef.current) / 1000);
      setElapsed(elapsedSeconds);
      
      // 根据状态计算进度
      if (currentStatus === 'filled') {
        setProgress(100);
      } else if (currentStatus === 'partial') {
        const percentage = (order.filledQuantity || 0) / order.totalQuantity * 100;
        setProgress(percentage);
      } else if (currentStatus === 'cancelled' || currentStatus === 'failed') {
        setProgress(0);
      } else {
        const stepProgress = statusToStep[currentStatus] * 33.33;
        setProgress(stepProgress);
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [currentStatus, order.filledQuantity, order.totalQuantity]);

  // 获取步骤状态
  const getStepStatus = (stepIndex: number): 'wait' | 'process' | 'finish' | 'error' => {
    const currentStep = statusToStep[currentStatus];
    
    if (currentStatus === 'failed' && stepIndex === 2) {
      return 'error';
    }
    
    if (currentStatus === 'cancelled' && stepIndex === 2) {
      return 'error';
    }
    
    if (stepIndex < currentStep) {
      return 'finish';
    } else if (stepIndex === currentStep) {
      return currentStatus === 'failed' || currentStatus === 'cancelled' ? 'error' : 'process';
    } else {
      return 'wait';
    }
  };

  // 渲染状态图标
  const renderStatusIcon = () => {
    if (currentStatus === 'filled') {
      return <IconCheckCircle style={{ fontSize: 48, color: '#00b42a' }} />;
    }
    if (currentStatus === 'failed' || currentStatus === 'cancelled') {
      return <IconCloseCircle style={{ fontSize: 48, color: '#f53f3f' }} />;
    }
    return <IconLoading style={{ fontSize: 48, color: '#165dff' }} spin />;
  };

  return (
    <Card
      style={{
        maxWidth: 480,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        borderRadius: 12,
      }}
      bodyStyle={{ padding: 24 }}
    >
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        {renderStatusIcon()}
        <Title heading={5} style={{ marginTop: 16, marginBottom: 8 }}>
          订单{currentStatus === 'filled' ? '成交' : 
               currentStatus === 'failed' ? '失败' :
               currentStatus === 'cancelled' ? '已取消' : '处理中'}
        </Title>
        <Tag color={statusColors[currentStatus]}>
          {statusLabels[currentStatus]}
        </Tag>
      </div>

      {/* 订单信息 */}
      <Space direction="vertical" size="small" style={{ width: '100%', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">订单号</Text>
          <Text copyable>{order.orderId}</Text>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">交易对</Text>
          <Text>{order.symbol}</Text>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">方向</Text>
          <Text style={{ color: order.side === 'buy' ? '#00b42a' : '#f53f3f' }}>
            {order.side === 'buy' ? '买入' : '卖出'}
          </Text>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">数量</Text>
          <Text>
            {order.filledQuantity !== undefined ? (
              <>
                {order.filledQuantity.toFixed(4)} / {order.totalQuantity.toFixed(4)}
                {currentStatus === 'partial' && (
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    ({((order.filledQuantity / order.totalQuantity) * 100).toFixed(1)}%)
                  </Text>
                )}
              </>
            ) : (
              order.totalQuantity.toFixed(4)
            )}
          </Text>
        </div>
        {order.price && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">价格</Text>
            <Text>${order.price.toFixed(2)}</Text>
          </div>
        )}
        {order.averagePrice && currentStatus === 'filled' && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">成交均价</Text>
            <Text bold>${order.averagePrice.toFixed(2)}</Text>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">已用时间</Text>
          <Text>
            <IconClockCircle style={{ marginRight: 4 }} />
            {elapsed}秒
          </Text>
        </div>
      </Space>

      {/* 进度条 */}
      {currentStatus !== 'failed' && currentStatus !== 'cancelled' && (
        <div style={{ marginBottom: 24 }}>
          <Progress
            percent={progress}
            strokeWidth={8}
            color={currentStatus === 'filled' ? '#00b42a' : '#165dff'}
          />
        </div>
      )}

      {/* 处理步骤 */}
      <Steps
        current={statusToStep[currentStatus]}
        style={{ marginBottom: 24 }}
        size="small"
        lineless={false}
      >
        <Steps.Step
          title="提交"
          status={getStepStatus(0)}
          icon={getStepStatus(0) === 'finish' ? <IconCheckCircle /> : undefined}
        />
        <Steps.Step
          title="处理"
          status={getStepStatus(1)}
          icon={getStepStatus(1) === 'process' ? <IconLoading spin /> :
               getStepStatus(1) === 'finish' ? <IconCheckCircle /> : undefined}
        />
        <Steps.Step
          title="成交"
          status={getStepStatus(2)}
          icon={getStepStatus(2) === 'error' ? <IconCloseCircle /> :
               getStepStatus(2) === 'finish' ? <IconCheckCircle /> : undefined}
        />
      </Steps>

      {/* 错误信息 */}
      {(currentStatus === 'failed' || currentStatus === 'cancelled') && order.message && (
        <div
          style={{
            padding: 12,
            background: '#fff7e6',
            borderRadius: 4,
            border: '1px solid #faad14',
            marginBottom: 16,
          }}
        >
          <Text type="warning">{order.message}</Text>
        </div>
      )}

      {/* 操作按钮 */}
      <Space style={{ width: '100%' }} direction="vertical">
        {currentStatus === 'filled' && (
          <Button type="primary" long onClick={onClose}>
            完成
          </Button>
        )}
        {(currentStatus === 'failed' || currentStatus === 'cancelled') && (
          <>
            <Button type="primary" long onClick={onClose}>
              关闭
            </Button>
            {currentStatus === 'failed' && (
              <Button type="outline" long>
                重试
              </Button>
            )}
          </>
        )}
        {(currentStatus === 'pending' || currentStatus === 'submitted') && (
          <Button type="outline" long status="warning">
            取消订单
          </Button>
        )}
      </Space>

      {/* 动画样式 */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </Card>
  );
};

export default OrderStatusTracker;