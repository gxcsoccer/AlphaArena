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
  Progress,
  Tooltip,
} from '@arco-design/web-react';
import type { TableProps } from '@arco-design/web-react';
import { IconExperiment, IconEye, IconEyeInvisible } from '@arco-design/web-react/icon';
import { api } from '../utils/api';

const { Text } = Typography;

interface IcebergOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  totalQuantity: number;
  displayQuantity: number;
  hiddenQuantity: number;
  filledQuantity: number;
  variance?: number;
  status: 'active' | 'partially_filled' | 'filled' | 'cancelled' | 'expired';
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

interface IcebergOrdersPanelProps {
  symbol?: string;
  limit?: number;
}

const IcebergOrdersPanel: React.FC<IcebergOrdersPanelProps> = ({
  symbol,
  limit = 50,
}) => {
  const [orders, setOrders] = useState<IcebergOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = React.useState(false);
  const [showHidden, setShowHidden] = useState<Record<string, boolean>>({});

  // Detect mobile on mount and resize
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load iceberg orders
  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getIcebergOrders({
        symbol,
        limit,
      });
      setOrders(data);
    } catch (error: any) {
      Message.error('加载冰山订单失败：' + (error.message || '未知错误'));
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
      title: '确认取消冰山订单',
      content: '确定要取消这个冰山订单吗？此操作不可撤销。',
      okText: '确认取消',
      cancelText: '取消',
      okButtonProps: {
        status: 'danger',
        loading: cancelingOrderId === orderId,
      },
      onOk: async () => {
        try {
          setCancelingOrderId(orderId);
          const result = await api.cancelIcebergOrder(orderId);
          
          if (result) {
            Message.success('冰山订单已取消');
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

  // Toggle hidden quantity visibility
  const toggleShowHidden = (orderId: string) => {
    setShowHidden(prev => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  // Calculate fill percentage
  const getFillPercentage = (order: IcebergOrder): number => {
    return order.totalQuantity > 0 
      ? (order.filledQuantity / order.totalQuantity) * 100 
      : 0;
  };

  // Table columns
  const columns: TableProps<IcebergOrder>['columns'] = [
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
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      width: isMobile ? 70 : 90,
      render: (price: number) => (
        <Text>${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
      ),
    },
    {
      title: '数量',
      key: 'quantity',
      width: isMobile ? 100 : 140,
      render: (_: any, record: IcebergOrder) => {
        const showHiddenQty = showHidden[record.id];
        const fillPct = getFillPercentage(record);
        
        return (
          <Space direction="vertical" size={2}>
            <Space size={4}>
              <Text type="secondary">总:</Text>
              <Text bold>{record.totalQuantity.toFixed(4)}</Text>
            </Space>
            <Space size={4}>
              <Tag color="arcoblue" size="small">
                显示: {record.displayQuantity.toFixed(4)}
              </Tag>
              {showHiddenQty && (
                <Tag color="orange" size="small">
                  隐藏: {record.hiddenQuantity.toFixed(4)}
                </Tag>
              )}
              <Button
                type="text"
                size="mini"
                icon={showHiddenQty ? <IconEyeInvisible /> : <IconEye />}
                onClick={() => toggleShowHidden(record.id)}
              />
            </Space>
            {record.filledQuantity > 0 && (
              <Progress
                percent={fillPct}
                size="small"
                style={{ width: 80 }}
                status={fillPct >= 100 ? 'success' : 'normal'}
              />
            )}
          </Space>
        );
      },
    },
    {
      title: '已成交',
      dataIndex: 'filledQuantity',
      key: 'filledQuantity',
      width: isMobile ? 70 : 90,
      render: (filled: number, record: IcebergOrder) => (
        <Tooltip content={`已成交 ${filled.toFixed(4)} / ${record.totalQuantity.toFixed(4)}`}>
          <Text>{filled.toFixed(4)}</Text>
        </Tooltip>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: isMobile ? 70 : 90,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          active: 'blue',
          partially_filled: 'orange',
          filled: 'green',
          cancelled: 'gray',
          expired: 'red',
        };
        const textMap: Record<string, string> = {
          active: '生效中',
          partially_filled: '部分成交',
          filled: '已完成',
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
      render: (_: any, record: IcebergOrder) => (
        <Button
          size={isMobile ? 'mini' : 'small'}
          status="danger"
          disabled={record.status !== 'active' && record.status !== 'partially_filled'}
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
      title={
        <Space>
          <IconExperiment style={{ color: '#165dff' }} />
          <span>冰山订单</span>
          <Tooltip content="冰山订单只在订单簿中显示部分数量，隐藏剩余数量">
            <Text type="secondary" style={{ fontSize: 12 }}>
              (隐藏大额交易意图)
            </Text>
          </Tooltip>
        </Space>
      }
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
          <div style={{ marginTop: 16, color: '#86909c' }}>加载冰山订单中...</div>
        </div>
      ) : orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#86909c' }}>
          <Empty description="暂无冰山订单" />
        </div>
      ) : (
        <Table
          columns={columns}
          data={orders}
          rowKey="id"
          pagination={false}
          size="small"
          scroll={isMobile ? { x: 700 } : undefined}
          style={isMobile ? { fontSize: 11 } : undefined}
        />
      )}
    </Card>
  );
};

export default IcebergOrdersPanel;
