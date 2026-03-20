import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Typography,
  Table,
  Tag,
  Button,
  Message,
  Modal,
  Spin,
  Empty,
} from '@arco-design/web-react';
import type { TableProps } from '@arco-design/web-react';
import { api } from '../utils/api';

const { Text } = Typography;

interface ConditionalOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  orderType: 'stop_loss' | 'take_profit';
  triggerPrice: number;
  quantity: number;
  status: 'active' | 'triggered' | 'cancelled' | 'expired';
  triggeredAt?: string;
  createdAt: string;
}

interface ConditionalOrdersPanelProps {
  symbol?: string;
  limit?: number;
}

const ConditionalOrdersPanel: React.FC<ConditionalOrdersPanelProps> = ({
  symbol,
  limit = 50,
}) => {
  const [orders, setOrders] = useState<ConditionalOrder[]>([]);
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

  // Load conditional orders
  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getConditionalOrders({
        symbol,
        limit,
      });
      setOrders(data);
    } catch (error: any) {
      Message.error('加载条件单失败：' + (error.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  }, [symbol, limit]);

  // Initial load
  useEffect(() => {
    loadOrders();

    // Auto-refresh every 10 seconds
    const interval = setInterval(loadOrders, 10000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  // Handle cancel order
  const handleCancelOrder = async (orderId: string) => {
    Modal.confirm({
      title: '确认取消条件单',
      content: '确定要取消这个条件单吗？此操作不可撤销。',
      okText: '确认取消',
      cancelText: '取消',
      okButtonProps: {
        status: 'danger',
        loading: cancelingOrderId === orderId,
      },
      onOk: async () => {
        try {
          setCancelingOrderId(orderId);
          const result = await api.cancelConditionalOrder(orderId);
          
          if (result) {
            Message.success('条件单已取消');
            // Update local state
            setOrders(prev =>
              prev.map(order =>
                order.id === orderId
                  ? { ...order, status: 'cancelled' }
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
  const columns: TableProps<ConditionalOrder>['columns'] = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: isMobile ? 80 : 120,
      render: (text: string) => {
        const date = new Date(text);
        return date.toLocaleString('zh-CN', { 
          hour: '2-digit', 
          minute: '2-digit',
          month: 'numeric',
          day: 'numeric',
        });
      },
    },
    {
      title: '交易对',
      dataIndex: 'symbol',
      key: 'symbol',
      width: isMobile ? 70 : 90,
      render: (symbol: string) => <Text bold>{symbol}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'orderType',
      key: 'orderType',
      width: isMobile ? 70 : 100,
      render: (orderType: 'stop_loss' | 'take_profit') => {
        const colorMap = {
          stop_loss: 'red',
          take_profit: 'green',
        };
        const textMap = {
          stop_loss: '止损',
          take_profit: '止盈',
        };
        return (
          <Tag color={colorMap[orderType] || 'gray'}>
            {textMap[orderType] || orderType}
          </Tag>
        );
      },
    },
    {
      title: '方向',
      dataIndex: 'side',
      key: 'side',
      width: isMobile ? 50 : 70,
      render: (side: 'buy' | 'sell') => (
        <Tag color={side === 'buy' ? 'green' : 'red'}>
          {side === 'buy' ? '买入' : '卖出'}
        </Tag>
      ),
    },
    {
      title: '触发价',
      dataIndex: 'triggerPrice',
      key: 'triggerPrice',
      width: isMobile ? 70 : 90,
      render: (triggerPrice: number) => (
        <Text bold>${triggerPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
      ),
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
      width: isMobile ? 60 : 80,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          active: 'blue',
          triggered: 'green',
          cancelled: 'gray',
          expired: 'orange',
        };
        const textMap: Record<string, string> = {
          active: '生效中',
          triggered: '已触发',
          cancelled: '已取消',
          expired: '已过期',
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
      width: isMobile ? 70 : 90,
      render: (_: any, record: ConditionalOrder) => (
        <Button
          size={isMobile ? 'mini' : 'small'}
          status="danger"
          disabled={record.status !== 'active'}
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
      title="条件单 (止损/止盈)"
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
          <Spin size={32} />
          <div style={{ marginTop: 16, color: '#86909c' }}>加载条件单中...</div>
        </div>
      ) : orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#86909c' }}>
          <Empty description="暂无条件单" />
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
        />
      )}
    </Card>
  );
};

export default ConditionalOrdersPanel;
