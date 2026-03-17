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
  Descriptions,
} from '@arco-design/web-react';
import type { TableProps } from '@arco-design/web-react';
import { IconClockCircle, IconRefresh, IconEye } from '@arco-design/web-react/icon';
import { api } from '../utils/api';

const { Text } = Typography;

interface TWAPOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  totalQuantity: number;
  filledQuantity: number;
  remainingQuantity: number;
  startTime: string;
  endTime: string;
  intervalSeconds: number;
  totalSlices: number;
  sliceQuantity: number;
  slicesCreated: number;
  slicesFilled: number;
  averageFillPrice: number | null;
  priceLimit: number | null;
  priceLimitType: string;
  status: 'pending' | 'active' | 'paused' | 'completed' | 'cancelled' | 'expired';
  createdAt: string;
  updatedAt: string;
}

interface TWAPOrdersPanelProps {
  symbol?: string;
  limit?: number;
}

const TWAPOrdersPanel: React.FC<TWAPOrdersPanelProps> = ({
  symbol,
  limit = 50,
}) => {
  const [orders, setOrders] = useState<TWAPOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null);
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<TWAPOrder | null>(null);
  const [orderProgress, setOrderProgress] = useState<any>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);
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

  // Load TWAP orders
  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getTWAPOrders({
        symbol,
        limit,
      });
      setOrders(data);
    } catch (error: any) {
      Message.error('加载 TWAP 订单失败：' + (error.message || '未知错误'));
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
      title: '确认取消 TWAP 订单',
      content: '确定要取消这个 TWAP 订单吗？此操作不可撤销。',
      okText: '确认取消',
      cancelText: '取消',
      okButtonProps: {
        status: 'danger',
        loading: cancelingOrderId === orderId,
      },
      onOk: async () => {
        try {
          setCancelingOrderId(orderId);
          const result = await api.cancelTWAPOrder(orderId);
          
          if (result) {
            Message.success('TWAP 订单已取消');
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

  // View order progress
  const handleViewProgress = async (order: TWAPOrder) => {
    setSelectedOrder(order);
    setProgressModalVisible(true);
    setLoadingProgress(true);
    
    try {
      const progress = await api.getTWAPOrderProgress(order.id);
      setOrderProgress(progress);
    } catch (error: any) {
      Message.error('获取进度失败：' + (error.message || '未知错误'));
    } finally {
      setLoadingProgress(false);
    }
  };

  // Calculate fill percentage
  const getFillPercentage = (order: TWAPOrder): number => {
    return order.totalQuantity > 0 
      ? (order.filledQuantity / order.totalQuantity) * 100 
      : 0;
  };

  // Format time
  const formatTime = (timeStr: string): string => {
    const date = new Date(timeStr);
    return date.toLocaleString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      month: 'numeric',
      day: 'numeric',
    });
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分钟`;
    return `${Math.floor(seconds / 86400)}天`;
  };

  // Table columns
  const columns: TableProps<TWAPOrder>['columns'] = [
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: isMobile ? 80 : 120,
      render: (text: string) => formatTime(text),
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
      title: '总数量',
      dataIndex: 'totalQuantity',
      key: 'totalQuantity',
      width: isMobile ? 70 : 90,
      render: (qty: number) => <Text>{qty.toFixed(4)}</Text>,
    },
    {
      title: '执行进度',
      key: 'progress',
      width: isMobile ? 120 : 180,
      render: (_: any, record: TWAPOrder) => {
        const fillPct = getFillPercentage(record);
        return (
          <Space direction="vertical" size={2}>
            <Space size={4}>
              <Text type="secondary">切片:</Text>
              <Text>{record.slicesFilled}/{record.totalSlices}</Text>
            </Space>
            <Progress
              percent={fillPct}
              size="small"
              style={{ width: 80 }}
              status={fillPct >= 100 ? 'success' : 'normal'}
            />
          </Space>
        );
      },
    },
    {
      title: '平均成交价',
      dataIndex: 'averageFillPrice',
      key: 'averageFillPrice',
      width: isMobile ? 70 : 100,
      render: (price: number | null) => (
        price ? <Text>${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text> : <Text type="secondary">-</Text>
      ),
    },
    {
      title: '时间范围',
      key: 'timeRange',
      width: isMobile ? 100 : 140,
      render: (_: any, record: TWAPOrder) => (
        <Space direction="vertical" size={2}>
          <Text type="secondary" style={{ fontSize: 11 }}>{formatTime(record.startTime)}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>至 {formatTime(record.endTime)}</Text>
          <Text style={{ fontSize: 10, color: '#86909c' }}>
            间隔: {formatDuration(record.intervalSeconds)}
          </Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: isMobile ? 70 : 90,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          pending: 'gray',
          active: 'blue',
          paused: 'orange',
          completed: 'green',
          cancelled: 'gray',
          expired: 'red',
        };
        const textMap: Record<string, string> = {
          pending: '待执行',
          active: '执行中',
          paused: '已暂停',
          completed: '已完成',
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
      width: isMobile ? 100 : 120,
      render: (_: any, record: TWAPOrder) => (
        <Space>
          <Button
            size={isMobile ? 'mini' : 'small'}
            type="text"
            icon={<IconEye />}
            onClick={() => handleViewProgress(record)}
          >
            {isMobile ? '' : '详情'}
          </Button>
          <Button
            size={isMobile ? 'mini' : 'small'}
            status="danger"
            disabled={record.status !== 'active' && record.status !== 'pending' && record.status !== 'paused'}
            loading={cancelingOrderId === record.id}
            onClick={() => handleCancelOrder(record.id)}
          >
            取消
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card
        title={
          <Space>
            <IconClockCircle style={{ color: '#165dff' }} />
            <span>TWAP 订单</span>
            <Tooltip content="TWAP 订单按时间分批执行，减少市场冲击">
              <Text type="secondary" style={{ fontSize: 12 }}>
                (时间加权平均价)
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
            <div style={{ marginTop: 16, color: '#86909c' }}>加载 TWAP 订单中...</div>
          </div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#86909c' }}>
            <Empty description="暂无 TWAP 订单" />
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

      {/* Progress Detail Modal */}
      <Modal
        title={`TWAP 订单详情 - ${selectedOrder?.symbol || ''}`}
        visible={progressModalVisible}
        onCancel={() => setProgressModalVisible(false)}
        footer={null}
        style={{ width: 600 }}
      >
        {loadingProgress ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size={32} />
          </div>
        ) : orderProgress ? (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Descriptions column={2} size="small" border>
              <Descriptions.Item label="订单ID">{orderProgress.orderId?.slice(0, 8)}...</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={orderProgress.status === 'active' ? 'blue' : orderProgress.status === 'completed' ? 'green' : 'gray'}>
                  {orderProgress.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="总数量">{orderProgress.totalQuantity?.toFixed(4)}</Descriptions.Item>
              <Descriptions.Item label="已成交">{orderProgress.filledQuantity?.toFixed(4)}</Descriptions.Item>
              <Descriptions.Item label="完成进度">
                <Progress percent={orderProgress.progressPercent || 0} size="small" style={{ width: 120 }} />
              </Descriptions.Item>
              <Descriptions.Item label="切片进度">
                {orderProgress.slicesFilled}/{orderProgress.slicesTotal}
              </Descriptions.Item>
              <Descriptions.Item label="平均成交价">
                {orderProgress.averageFillPrice ? `$${orderProgress.averageFillPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="剩余数量">{orderProgress.remainingQuantity?.toFixed(4)}</Descriptions.Item>
              <Descriptions.Item label="开始时间">{formatTime(orderProgress.startTime)}</Descriptions.Item>
              <Descriptions.Item label="结束时间">{formatTime(orderProgress.endTime)}</Descriptions.Item>
              <Descriptions.Item label="预计完成时间">
                {orderProgress.estimatedCompletion ? formatTime(orderProgress.estimatedCompletion) : '-'}
              </Descriptions.Item>
            </Descriptions>
            
            {orderProgress.recentSlices && orderProgress.recentSlices.length > 0 && (
              <div>
                <Text bold style={{ marginBottom: 8, display: 'block' }}>最近切片</Text>
                <Table
                  data={orderProgress.recentSlices}
                  pagination={false}
                  size="mini"
                  columns={[
                    { title: '切片#', dataIndex: 'sliceNumber', width: 60 },
                    { title: '状态', dataIndex: 'status', width: 80, render: (s: string) => <Tag size="small" color={s === 'filled' ? 'green' : 'gray'}>{s}</Tag> },
                    { title: '成交数量', dataIndex: 'filledQuantity', width: 100, render: (q: number) => q?.toFixed(4) },
                    { title: '成交价', dataIndex: 'fillPrice', width: 100, render: (p: number) => p ? `$${p.toFixed(2)}` : '-' },
                  ]}
                />
              </div>
            )}
          </Space>
        ) : null}
      </Modal>
    </>
  );
};

export default TWAPOrdersPanel;
