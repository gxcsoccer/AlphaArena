/**
 * Optimized OrdersPanel Component
 * - Virtual scrolling for large datasets
 * - Memoized components and callbacks
 * - Performance monitoring
 * - Efficient re-render management
 */

import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
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
import { FixedSizeList as List } from 'react-window';
import type { TableProps } from '@arco-design/web-react';
import { 
  IconRefresh, 
  IconClose, 
  IconCheckCircle,
  IconExclamationCircle,
} from '@arco-design/web-react/icon';
import { api } from '../utils/api';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';

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
  virtualizedThreshold?: number;
}

const ROW_HEIGHT = 48;
const VIRTUALIZED_OVERSCAN = 5;

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

// Memoized virtualized row component
const OrderRow = memo(({
  data,
  index,
  style,
  onCancel,
  cancelingOrderId,
  cancelSuccessId,
  isMobile,
}: {
  data: Order[];
  index: number;
  style: React.CSSProperties;
  onCancel: (id: string) => void;
  cancelingOrderId: string | null;
  cancelSuccessId: string | null;
  isMobile: boolean;
}) => {
  const order = data[index];
  if (!order) return null;

  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const typeConfig = TYPE_CONFIG[order.type];
  const sideConfig = SIDE_CONFIG[order.side];

  return (
    <div
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid var(--color-border)',
        backgroundColor: index % 2 === 0 ? 'var(--color-bg-1)' : 'var(--color-bg-2)',
        fontSize: isMobile ? 11 : 12,
      }}
    >
      <div style={{ width: isMobile ? 80 : 100, padding: '0 12px' }}>
        <Text type="secondary" size="small">
          {new Date(order.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </div>
      <div style={{ width: isMobile ? 70 : 90, padding: '0 12px' }}>
        <Text bold>{order.symbol}</Text>
      </div>
      <div style={{ width: isMobile ? 50 : 70, padding: '0 8px' }}>
        <Tag color={sideConfig.color} size="small">
          {sideConfig.text}
        </Tag>
      </div>
      <div style={{ width: isMobile ? 50 : 70, padding: '0 8px' }}>
        <Tag color={typeConfig.color} size="small">
          {typeConfig.text}
        </Tag>
      </div>
      <div style={{ width: isMobile ? 60 : 80, padding: '0 12px' }}>
        {order.price > 0 ? `$${order.price.toLocaleString()}` : '-'}
      </div>
      <div style={{ width: isMobile ? 60 : 80, padding: '0 12px' }}>
        {order.quantity.toFixed(4)}
      </div>
      <div style={{ width: isMobile ? 70 : 90, padding: '0 8px' }}>
        <Tag color={statusConfig.color} size="small">
          {statusConfig.text}
        </Tag>
      </div>
      <div style={{ width: isMobile ? 70 : 90, padding: '0 12px' }}>
        {cancelSuccessId === order.id ? (
          <Tag color="green" icon={<IconCheckCircle />} size="small">已取消</Tag>
        ) : (
          <Button
            size="mini"
            status="danger"
            disabled={order.status !== 'pending'}
            loading={cancelingOrderId === order.id}
            onClick={() => onCancel(order.id)}
          >
            取消
          </Button>
        )}
      </div>
    </div>
  );
});

OrderRow.displayName = 'OrderRow';

const OrdersPanel: React.FC<OrdersPanelProps> = memo(({
  symbol,
  limit = 50,
  virtualizedThreshold = 30,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const listRef = useRef<List>(null);

  // Performance monitoring
  const { _metrics, trackRenderStart, trackRenderEnd } = usePerformanceMonitor({
    componentName: 'OrdersPanel',
    enableLogging: false,
  });

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load orders
  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      trackRenderStart();
      const data = await api.getOrders({
        symbol,
        limit,
      });
      setOrders(data);
      setLastUpdated(new Date());
      trackRenderEnd();
    } catch (error: any) {
      if (error.message?.includes('network') || error.message?.includes('timeout')) {
        Message.error('网络连接失败，无法加载订单');
      } else {
        Message.error('加载订单失败：' + (error.message || '未知错误'));
      }
    } finally {
      setLoading(false);
    }
  }, [symbol, limit, trackRenderStart, trackRenderEnd]);

  // Initial load
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Handle cancel order with better feedback
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
            
            setTimeout(() => {
              setCancelSuccess(null);
            }, 2000);
          } else {
            Message.error('取消失败，请稍后重试');
          }
        } catch (error: any) {
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

  // Count pending orders
  const pendingCount = useMemo(() => orders.filter(o => o.status === 'pending').length, [orders]);

  // Determine if we should use virtualization
  const useVirtualization = orders.length > virtualizedThreshold && !isMobile;

  // Memoized table columns for non-virtualized mode
  const columns = useMemo<TableProps<Order>['columns']>(() => [
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
        return <Tag color={config.color}>{config.text}</Tag>;
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
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: isMobile ? 80 : 100,
      render: (_: any, record: Order) => {
        if (cancelSuccess === record.id) {
          return <Tag color="green" icon={<IconCheckCircle />}>已取消</Tag>;
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
  ], [isMobile, cancelSuccess, cancelingOrderId, handleCancelOrder]);

  // Virtualized header
  const virtualizedHeader = useMemo(() => (
    <div
      style={{
        display: 'flex',
        backgroundColor: 'var(--color-bg-3)',
        borderBottom: '1px solid var(--color-border)',
        fontWeight: 500,
        fontSize: 12,
      }}
    >
      <div style={{ width: isMobile ? 80 : 100, padding: '12px' }}>时间</div>
      <div style={{ width: isMobile ? 70 : 90, padding: '12px' }}>交易对</div>
      <div style={{ width: isMobile ? 50 : 70, padding: '12px' }}>方向</div>
      <div style={{ width: isMobile ? 50 : 70, padding: '12px' }}>类型</div>
      <div style={{ width: isMobile ? 60 : 80, padding: '12px' }}>价格</div>
      <div style={{ width: isMobile ? 60 : 80, padding: '12px' }}>数量</div>
      <div style={{ width: isMobile ? 70 : 90, padding: '12px' }}>状态</div>
      <div style={{ width: isMobile ? 70 : 90, padding: '12px' }}>操作</div>
    </div>
  ), [isMobile]);

  return (
    <Card
      title={
        <Space>
          <span>我的订单</span>
          {pendingCount > 0 && (
            <Badge count={pendingCount} style={{ backgroundColor: '#ff7d00' }} />
          )}
          {useVirtualization && <Tag color="green" size="small">虚拟滚动</Tag>}
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
        <Empty description="暂无订单" style={{ padding: '20px 0' }} />
      ) : useVirtualization ? (
        <div style={{ height: 400 }}>
          {virtualizedHeader}
          <List
            ref={listRef}
            height={352}
            itemCount={orders.length}
            itemSize={ROW_HEIGHT}
            width="100%"
            overscanCount={VIRTUALIZED_OVERSCAN}
            itemData={orders}
          >
            {({ data, index, style }) => (
              <OrderRow
                data={data}
                index={index}
                style={style}
                onCancel={handleCancelOrder}
                cancelingOrderId={cancelingOrderId}
                cancelSuccessId={cancelSuccess}
                isMobile={isMobile}
              />
            )}
          </List>
        </div>
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