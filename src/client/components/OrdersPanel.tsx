import React, { useState, useEffect, useCallback } from 'react';
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
} from '@arco-design/web-react';
import type { TableProps } from '@arco-design/web-react';
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

const OrdersPanel: React.FC<OrdersPanelProps> = ({
  symbol,
  limit = 50,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = React.useState(false);

  // Detect mobile on mount and resize
  React.useEffect(() => {
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
      const data = await api.getOrders({
        symbol,
        limit,
      });
      setOrders(data);
    } catch (error: any) {
      Message.error('加载订单失败：' + (error.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  }, [symbol, limit]);

  // Initial load
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Handle cancel order
  const handleCancelOrder = async (orderId: string) => {
    Modal.confirm({
      title: '确认取消订单',
      content: '确定要取消这个订单吗？此操作不可撤销。',
      okText: '确认取消',
      cancelText: '取消',
      okButtonProps: {
        status: 'danger',
        loading: cancelingOrderId === orderId,
      },
      onOk: async () => {
        try {
          setCancelingOrderId(orderId);
          const result = await api.cancelOrder(orderId);
          
          if (result) {
            Message.success('订单已取消');
            // Update local state
            setOrders(prev =>
              prev.map(order =>
                order.id === orderId
                  ? { ...order, status: 'cancelled', cancelledAt: new Date().toISOString() }
                  : order
              )
            );
          } else {
            Message.error('取消失败');
          }
        } catch (error: any) {
          Message.error(error.message || '取消失败');
        } finally {
          setCancelingOrderId(null);
        }
      },
    });
  };

  // Table columns
  const columns: TableProps<Order>['columns'] = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: isMobile ? 100 : 150,
      render: (text: string) => {
        const date = new Date(text);
        return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
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
      render: (side: 'buy' | 'sell') => (
        <Tag color={side === 'buy' ? 'green' : 'red'}>
          {side === 'buy' ? '买入' : '卖出'}
        </Tag>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: isMobile ? 60 : 80,
      render: (type: 'limit' | 'market') => (
        <Tag color={type === 'limit' ? 'blue' : 'orange'}>
          {type === 'limit' ? '限价' : '市价'}
        </Tag>
      ),
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
      width: isMobile ? 70 : 90,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          pending: 'orange',
          filled: 'green',
          cancelled: 'gray',
        };
        const textMap: Record<string, string> = {
          pending: '待成交',
          filled: '已成交',
          cancelled: '已取消',
        };
        return (
          <Tag color={colorMap[status] || 'gray'}>
            {textMap[status] || status}
          </Tag>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: isMobile ? 80 : 100,
      render: (_: any, record: Order) => (
        <Button
          size="small"
          status="danger"
          disabled={record.status !== 'pending'}
          loading={cancelingOrderId === record.id}
          onClick={() => handleCancelOrder(record.id)}
        >
          取消
        </Button>
      ),
    },
  ];

  return (
    <Card
      title="我的订单"
      size="small"
      extra={
        <Button
          type="text"
          size="small"
          onClick={loadOrders}
          loading={loading}
        >
          刷新
        </Button>
      }
    >
      {loading && orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: '#86909c' }}>加载订单中...</div>
        </div>
      ) : orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#86909c' }}>
          暂无订单
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={orders}
          rowKey="id"
          pagination={false}
          size="small"
          scroll={isMobile ? { x: 600 } : undefined}
          style={isMobile ? { fontSize: 11 } : undefined}
        />
      )}
    </Card>
  );
};

export default OrdersPanel;
