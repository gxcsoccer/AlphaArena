import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  Card,
  Typography,
  Table,
  Tag,
  Button,
  Space,
  Message,
  Modal,
  Spin,
  Empty,
  Tooltip,
  Badge,
} from '@arco-design/web-react';
import type { TableProps } from '@arco-design/web-react';
import { 
  IconRefresh, 
  IconClose, 
  IconCheckCircle,
  IconExclamationCircle,
} from '@arco-design/web-react/icon';
import { api } from '../utils/api';

const { Text } = Typography;

interface Order {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'limit' | 'market';
  price: number;
  quantity: number;
  status: 'pending' | 'filled' | 'cancelled';
  createdAt: string;
  cancelledAt?: string;
}

interface OrdersPanelProps {
  symbol?: string;
  limit?: number;
}

// Status config for visual display
const STATUS_CONFIG = {
  pending: {
    color: 'orange',
    text: '待成交',
    icon: <IconExclamationCircle />,
    badgeStatus: 'processing' as const,
  },
  filled: {
    color: 'green',
    text: '已成交',
    icon: <IconCheckCircle />,
    badgeStatus: 'success' as const,
  },
  cancelled: {
    color: 'gray',
    text: '已取消',
    icon: <IconClose />,
    badgeStatus: 'default' as const,
  },
};

// Order type config
const TYPE_CONFIG = {
  limit: { color: 'blue', text: '限价' },
  market: { color: 'orange', text: '市价' },
};

// Side config
const SIDE_CONFIG = {
  buy: { color: 'green', text: '买入' },
  sell: { color: 'red', text: '卖出' },
};

// Memoized mobile detection hook
const useMobileDetection = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile, { passive: true });
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};

// Memoized columns factory
const useOrdersColumns = (isMobile: boolean, cancelingOrderId: string | null, cancelSuccess: string | null, handleCancelOrder: (id: string) => void): TableProps<Order>['columns'] => {
  return useMemo(() => [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: isMobile ? 100 : 150,
      render: (text: string) => {
        const date = new Date(text);
        return (
          <Tooltip content={date.toLocaleString('zh-CN')}>
            <span>{date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
          </Tooltip>
        );
      },
    },
    {
      title: '交易对',
      dataIndex: 'symbol',
      key: 'symbol',
      width: isMobile ? 80 : 100,
      render: (symbol: string) => <Text bold>{symbol}</Text>,
    },
    {
      title: '方向',
      dataIndex: 'side',
      key: 'side',
      width: isMobile ? 60 : 80,
      render: (side: 'buy' | 'sell') => {
        const config = SIDE_CONFIG[side];
        return (
          <Tag color={config.color} icon={side === 'buy' ? '↑' : '↓'}>
            {config.text}
          </Tag>
        );
      },
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: isMobile ? 60 : 80,
      render: (type: 'limit' | 'market') => {
        const config = TYPE_CONFIG[type];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      width: isMobile ? 70 : 90,
      render: (price: number) => price > 0 ? `$${price.toLocaleString()}` : '-',
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: isMobile ? 70 : 90,
      render: (quantity: number) => quantity.toFixed(4),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: isMobile ? 80 : 100,
      render: (status: string) => {
        const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: isMobile ? 80 : 100,
      render: (_: any, record: Order) => {
        if (cancelSuccess === record.id) {
          return (
            <Tag color="green" icon={<IconCheckCircle />}>已取消</Tag>
          );
        }
        return (
          <Button
            size="small"
            status="danger"
            disabled={record.status !== 'pending'}
            loading={cancelingOrderId === record.id}
            onClick={() => handleCancelOrder(record.id)}
          >
            取消
          </Button>
        );
      },
    },
  ], [isMobile, cancelingOrderId, cancelSuccess, handleCancelOrder]);
};

const OrdersPanel: React.FC<OrdersPanelProps> = memo(({
  symbol,
  limit = 50,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null);
  const isMobile = useMobileDetection();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);

  // Load orders
  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getOrders({
        symbol,
        limit,
      });
      setOrders(data);
      setLastUpdated(new Date());
    } catch (error: any) {
      // Better error categorization
      if (error.message?.includes('network') || error.message?.includes('timeout')) {
        Message.error('网络连接失败，无法加载订单');
      } else {
        Message.error('加载订单失败：' + (error.message || '未知错误'));
      }
    } finally {
      setLoading(false);
    }
  }, [symbol, limit]);

  // Initial load
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Count pending orders
  const pendingCount = useMemo(() => 
    orders.filter(o => o.status === 'pending').length, 
    [orders]
  );

  // Handle cancel order with stable callback
  const handleCancelOrder = useCallback(async (orderId: string) => {
    Modal.confirm({
      title: '确认取消订单',
      content: (
        <div>
          <p>确定要取消这个订单吗？此操作不可撤销。</p>
          <p style={{ color: '#86909c', fontSize: 12, marginTop: 8 }}>
            订单ID: {orderId.slice(0, 8)}...
          </p>
        </div>
      ),
      okText: '确认取消',
      cancelText: '再想想',
      okButtonProps: {
        status: 'danger',
        loading: cancelingOrderId === orderId,
      },
      onOk: async () => {
        try {
          setCancelingOrderId(orderId);
          const result = await api.cancelOrder(orderId);
          
          if (result) {
            setCancelSuccess(orderId);
            Message.success({
              content: '订单已取消',
              icon: <IconCheckCircle />,
            });
            // Update local state
            setOrders(prev =>
              prev.map(order =>
                order.id === orderId
                  ? { ...order, status: 'cancelled', cancelledAt: new Date().toISOString() }
                  : order
              )
            );
            
            // Clear success state after animation
            setTimeout(() => {
              setCancelSuccess(null);
            }, 2000);
          } else {
            Message.error('取消失败，请稍后重试');
          }
        } catch (error: any) {
          // Better error handling
          if (error.message?.includes('network') || error.message?.includes('timeout')) {
            Message.error('网络连接失败，无法取消订单');
          } else if (error.message?.includes('not found')) {
            Message.error('订单不存在或已被处理');
          } else {
            Message.error(error.message || '取消失败');
          }
        } finally {
          setCancelingOrderId(null);
        }
      },
    });
  }, [cancelingOrderId]);

  // Memoized columns
  const columns = useOrdersColumns(isMobile, cancelingOrderId, cancelSuccess, handleCancelOrder);

  return (
    <Card
      title={
        <Space>
          <span>我的订单</span>
          {pendingCount > 0 && (
            <Badge count={pendingCount} style={{ backgroundColor: '#ff7d00' }} />
          )}
        </Space>
      }
      size="small"
      extra={
        <Space>
          {lastUpdated && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              更新于 {lastUpdated.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
          <Tooltip content="刷新订单列表">
            <Button
              type="text"
              size="small"
              icon={<IconRefresh />}
              onClick={loadOrders}
              loading={loading}
            />
          </Tooltip>
        </Space>
      }
    >
      {loading && orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size={32} />
          <div style={{ marginTop: 16, color: '#86909c' }}>加载订单中...</div>
        </div>
      ) : orders.length === 0 ? (
        <Empty 
          description="暂无订单" 
          style={{ padding: '20px 0' }}
        />
      ) : (
        <Table
          columns={columns}
          data={orders}
          rowKey="id"
          pagination={false}
          size="small"
          scroll={isMobile ? { x: 600 } : undefined}
          style={isMobile ? { fontSize: 11 } : undefined}
          rowClassName={(record) => 
            record.status === 'pending' ? 'row-pending' : 
            record.status === 'filled' ? 'row-filled' : ''
          }
        />
      )}
      
      {/* Mobile-optimized order count */}
      {isMobile && orders.length > 0 && (
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            共 {orders.length} 个订单，{pendingCount} 个待成交
          </Text>
        </div>
      )}
    </Card>
  );
});

OrdersPanel.displayName = 'OrdersPanel';

export default OrdersPanel;
