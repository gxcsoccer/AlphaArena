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
  Empty,
} from '@arco-design/web-react';
import type { TableProps } from '@arco-design/web-react';
import { api } from '../utils/api';

const { Text } = Typography;

interface OCOOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  
  takeProfit: {
    triggerPrice: number;
    quantity: number;
    orderType: 'limit' | 'market';
    limitPrice?: number | null;
  };
  
  stopLoss: {
    triggerPrice: number;
    quantity: number;
    orderType: 'limit' | 'market';
    limitPrice?: number | null;
  };
  
  status: 'pending' | 'partial' | 'completed' | 'cancelled' | 'expired';
  triggeredBy?: 'take_profit' | 'stop_loss';
  triggeredAt?: string;
  createdAt: string;
}

interface OCOOrdersPanelProps {
  symbol?: string;
  limit?: number;
}

const OCOOrdersPanel: React.FC<OCOOrdersPanelProps> = ({
  symbol,
  limit = 50,
}) => {
  const [orders, setOrders] = useState<OCOOrder[]>([]);
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

  // Load OCO orders
  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getOCOOrders({
        symbol,
        limit,
      });
      setOrders(data);
    } catch (error: any) {
      Message.error('加载OCO订单失败：' + (error.message || '未知错误'));
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
      title: '确认取消OCO订单',
      content: '确定要取消这个OCO订单吗？止盈和止损都将被取消。此操作不可撤销。',
      okText: '确认取消',
      cancelText: '取消',
      okButtonProps: {
        status: 'danger',
        loading: cancelingOrderId === orderId,
      },
      onOk: async () => {
        try {
          setCancelingOrderId(orderId);
          const result = await api.cancelOCOOrder(orderId);
          
          if (result) {
            Message.success('OCO订单已取消');
            // Update local state
            setOrders(prev =>
              prev.map(order =>
                order.id === orderId
                  ? { ...order, status: 'cancelled' as const }
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
  const columns: TableProps<OCOOrder>['columns'] = [
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
      title: '止盈',
      key: 'takeProfit',
      width: isMobile ? 100 : 150,
      render: (_: any, record: OCOOrder) => {
        const tp = record.takeProfit;
        return (
          <div>
            <Tag color="green">止盈</Tag>
            <div style={{ fontSize: isMobile ? 10 : 12, marginTop: 4 }}>
              触发价: ${tp.triggerPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: isMobile ? 10 : 12 }}>
              数量: {tp.quantity.toFixed(4)}
            </div>
            {tp.orderType === 'limit' && tp.limitPrice && (
              <div style={{ fontSize: isMobile ? 10 : 12, color: '#86909c' }}>
                限价: ${tp.limitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: '止损',
      key: 'stopLoss',
      width: isMobile ? 100 : 150,
      render: (_: any, record: OCOOrder) => {
        const sl = record.stopLoss;
        return (
          <div>
            <Tag color="red">止损</Tag>
            <div style={{ fontSize: isMobile ? 10 : 12, marginTop: 4 }}>
              触发价: ${sl.triggerPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: isMobile ? 10 : 12 }}>
              数量: {sl.quantity.toFixed(4)}
            </div>
            {sl.orderType === 'limit' && sl.limitPrice && (
              <div style={{ fontSize: isMobile ? 10 : 12, color: '#86909c' }}>
                限价: ${sl.limitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: isMobile ? 80 : 100,
      render: (status: string, record: OCOOrder) => {
        const colorMap: Record<string, string> = {
          pending: 'blue',
          partial: 'orange',
          completed: 'green',
          cancelled: 'gray',
          expired: 'orange',
        };
        const textMap: Record<string, string> = {
          pending: '生效中',
          partial: '部分成交',
          completed: '已完成',
          cancelled: '已取消',
          expired: '已过期',
        };
        return (
          <div>
            <Tag color={colorMap[status] || 'gray'}>
              {textMap[status] || status}
            </Tag>
            {record.triggeredBy && (
              <div style={{ fontSize: isMobile ? 10 : 12, marginTop: 4, color: '#86909c' }}>
                由{record.triggeredBy === 'take_profit' ? '止盈' : '止损'}触发
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: isMobile ? 70 : 90,
      render: (_: any, record: OCOOrder) => (
        <Button
          size={isMobile ? 'mini' : 'small'}
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
      title="OCO订单 (止盈止损单)"
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
          <div style={{ marginTop: 16, color: '#86909c' }}>加载OCO订单中...</div>
        </div>
      ) : orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#86909c' }}>
          <Empty description="暂无OCO订单" />
        </div>
      ) : (
        <Table
          columns={columns}
          data={orders}
          rowKey="id"
          pagination={false}
          size="small"
          scroll={isMobile ? { x: 800 } : undefined}
          style={isMobile ? { fontSize: 11 } : undefined}
        />
      )}
    </Card>
  );
};

export default OCOOrdersPanel;
