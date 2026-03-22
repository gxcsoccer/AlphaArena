import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Modal, Spin } from '@arco-design/web-react';
import TradingOrder, { OrderType, OrderSide } from './TradingOrder';
import OrderStatusTracker, { OrderStatusInfo } from './OrderStatusTracker';
import { Toast } from './Toast';
import { api } from '../utils/api';

/**
 * Enhanced Trading Order Component with Status Tracking
 * 
 * Issue #514: UX 改进 - 交易界面交互优化
 * - 集成订单状态实时追踪
 * - 提供增强的 Toast 通知
 * - 改进用户反馈机制
 * 
 * 这个组件包装了基础的 TradingOrder，添加了：
 * 1. 订单提交后的状态追踪
 * 2. 更好的错误处理和用户反馈
 * 3. 成功/失败的可视化动画
 */

interface TradingOrderEnhancedProps {
  symbol?: string;
  baseCurrency?: string;
  quoteCurrency?: string;
  onOrderPlaced?: (orderId: string) => void;
  showStatusTracker?: boolean; // 是否显示状态追踪器
}

const TradingOrderEnhanced: React.FC<TradingOrderEnhancedProps> = ({
  symbol = 'BTC/USD',
  baseCurrency,
  quoteCurrency,
  onOrderPlaced,
  showStatusTracker = true,
}) => {
  const [showTracker, setShowTracker] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<OrderStatusInfo | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pendingOrderRef = useRef<{
    orderId: string;
    symbol: string;
    side: OrderSide;
    type: OrderType;
    quantity: number;
    price?: number;
  } | null>(null);

  // 处理订单提交
  const handleOrderPlaced = useCallback(async (orderId: string) => {
    if (!showStatusTracker) {
      onOrderPlaced?.(orderId);
      return;
    }

    // 获取订单详情并开始追踪
    try {
      // 这里应该通过 API 获取订单详情
      // 暂时使用 pendingOrderRef 中的信息
      const pendingOrder = pendingOrderRef.current;
      
      if (pendingOrder) {
        const orderInfo: OrderStatusInfo = {
          orderId,
          symbol: pendingOrder.symbol,
          side: pendingOrder.side,
          type: pendingOrder.type,
          status: 'pending',
          totalQuantity: pendingOrder.quantity,
          price: pendingOrder.price,
          timestamp: new Date(),
        };
        
        setCurrentOrder(orderInfo);
        setShowTracker(true);
        
        // 显示成功 Toast
        Toast.orderSuccess(orderId, pendingOrder.side, pendingOrder.symbol);
      }
      
      onOrderPlaced?.(orderId);
    } catch (error) {
      console.error('Failed to get order details:', error);
    }
  }, [showStatusTracker, onOrderPlaced]);

  // 关闭状态追踪器
  const handleCloseTracker = useCallback(() => {
    setShowTracker(false);
    setCurrentOrder(null);
    pendingOrderRef.current = null;
  }, []);

  // 监听订单提交事件（从 TradingOrder 内部触发）
  useEffect(() => {
    const handleOrderSubmit = (e: CustomEvent) => {
      pendingOrderRef.current = e.detail;
    };

    window.addEventListener('order-submit' as any, handleOrderSubmit as any);
    return () => {
      window.removeEventListener('order-submit' as any, handleOrderSubmit as any);
    };
  }, []);

  return (
    <>
      <TradingOrder
        symbol={symbol}
        baseCurrency={baseCurrency}
        quoteCurrency={quoteCurrency}
        onOrderPlaced={handleOrderPlaced}
      />

      {/* 订单状态追踪模态框 */}
      {showTracker && currentOrder && (
        <Modal
          visible={showTracker}
          footer={null}
          closable={false}
          maskClosable={false}
          style={{ 
            padding: 0,
            borderRadius: 12,
            overflow: 'hidden',
          }}
          autoFocus={false}
          focusLock={false}
        >
          <OrderStatusTracker
            order={currentOrder}
            onClose={handleCloseTracker}
            autoClose={true}
            autoCloseDelay={5000}
          />
        </Modal>
      )}

      {/* 加载指示器 */}
      {isSubmitting && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.3)',
            zIndex: 9999,
          }}
        >
          <Spin size={40} />
        </div>
      )}
    </>
  );
};

export default TradingOrderEnhanced;