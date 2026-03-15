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
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  DatePicker,
} from '@arco-design/web-react';
import type { TableProps } from '@arco-design/web-react';
import { IconPlus, IconRefresh } from '@arco-design/web-react/icon';
import { api, PriceAlert } from '../utils/api';

const { Text } = Typography;
const { TextArea } = Input;

interface PriceAlertsPanelProps {
  symbol?: string;
  limit?: number;
}

const PriceAlertsPanel: React.FC<PriceAlertsPanelProps> = ({
  symbol,
  limit = 50,
}) => {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const [form] = Form.useForm();

  // Detect mobile on mount and resize
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load price alerts
  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getPriceAlerts({
        symbol,
        limit,
      });
      setAlerts(data);
    } catch (error: any) {
      Message.error('加载价格提醒失败：' + (error.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  }, [symbol, limit]);

  // Initial load
  useEffect(() => {
    loadAlerts();

    // Auto-refresh every 10 seconds
    const interval = setInterval(loadAlerts, 10000);
    return () => clearInterval(interval);
  }, [loadAlerts]);

  // Handle create alert
  const handleCreateAlert = async () => {
    try {
      const values = await form.validate();
      setActionLoading('create');

      const alertData = {
        symbol: values.symbol.toUpperCase(),
        conditionType: values.conditionType,
        targetPrice: values.targetPrice,
        notificationMethod: values.notificationMethod || 'in_app',
        isRecurring: values.isRecurring || false,
        notes: values.notes,
        expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : undefined,
      };

      const result = await api.createPriceAlert(alertData);

      if (result) {
        Message.success('价格提醒创建成功');
        setShowCreateModal(false);
        form.resetFields();
        loadAlerts();
      } else {
        Message.error('创建失败');
      }
    } catch (error: any) {
      if (error.fields) {
        // Validation error
        return;
      }
      Message.error(error.message || '创建失败');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle delete alert
  const handleDeleteAlert = async (alertId: string) => {
    Modal.confirm({
      title: '确认删除价格提醒',
      content: '确定要删除这个价格提醒吗？此操作不可撤销。',
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: {
        status: 'danger',
        loading: actionLoading === `delete-${alertId}`,
      },
      onOk: async () => {
        try {
          setActionLoading(`delete-${alertId}`);
          const result = await api.deletePriceAlert(alertId);

          if (result) {
            Message.success('价格提醒已删除');
            setAlerts(prev => prev.filter(a => a.id !== alertId));
          } else {
            Message.error('删除失败');
          }
        } catch (error: any) {
          Message.error(error.message || '删除失败');
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  // Handle toggle alert status
  const handleToggleAlert = async (alert: PriceAlert) => {
    try {
      setActionLoading(`toggle-${alert.id}`);
      const newStatus = alert.status === 'active' ? 'disabled' : 'active';
      const result = await api.updatePriceAlert(alert.id, { status: newStatus });

      if (result) {
        Message.success(newStatus === 'active' ? '提醒已启用' : '提醒已禁用');
        setAlerts(prev =>
          prev.map(a => (a.id === alert.id ? { ...a, status: newStatus } : a))
        );
      } else {
        Message.error('操作失败');
      }
    } catch (error: any) {
      Message.error(error.message || '操作失败');
    } finally {
      setActionLoading(null);
    }
  };

  // Table columns
  const columns: TableProps<PriceAlert>['columns'] = [
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
      title: '条件',
      key: 'condition',
      width: isMobile ? 80 : 120,
      render: (_: any, record: PriceAlert) => (
        <Space size={4}>
          <Tag color={record.conditionType === 'above' ? 'green' : 'red'}>
            {record.conditionType === 'above' ? '高于' : '低于'}
          </Tag>
          <Text>${record.targetPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
        </Space>
      ),
    },
    {
      title: '当前价',
      dataIndex: 'currentPrice',
      key: 'currentPrice',
      width: isMobile ? 70 : 90,
      render: (currentPrice: number | null) =>
        currentPrice ? `$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-',
    },
    {
      title: '通知方式',
      dataIndex: 'notificationMethod',
      key: 'notificationMethod',
      width: isMobile ? 60 : 90,
      render: (method: string) => {
        const textMap: Record<string, string> = {
          in_app: '应用内',
          feishu: '飞书',
          email: '邮件',
          push: '推送',
        };
        return <Tag>{textMap[method] || method}</Tag>;
      },
    },
    {
      title: '类型',
      dataIndex: 'isRecurring',
      key: 'isRecurring',
      width: isMobile ? 50 : 70,
      render: (isRecurring: boolean) => (
        <Tag color={isRecurring ? 'blue' : 'gray'}>
          {isRecurring ? '循环' : '单次'}
        </Tag>
      ),
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
          disabled: 'gray',
          expired: 'orange',
        };
        const textMap: Record<string, string> = {
          active: '生效中',
          triggered: '已触发',
          disabled: '已禁用',
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
      width: isMobile ? 100 : 140,
      render: (_: any, record: PriceAlert) => (
        <Space size={isMobile ? 4 : 8}>
          <Button
            size={isMobile ? 'mini' : 'small'}
            type={record.status === 'active' ? 'secondary' : 'primary'}
            disabled={record.status === 'triggered' || record.status === 'expired'}
            loading={actionLoading === `toggle-${record.id}`}
            onClick={() => handleToggleAlert(record)}
          >
            {record.status === 'active' ? '禁用' : '启用'}
          </Button>
          <Button
            size={isMobile ? 'mini' : 'small'}
            status="danger"
            loading={actionLoading === `delete-${record.id}`}
            onClick={() => handleDeleteAlert(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card
        title="价格提醒"
        size="small"
        extra={
          <Space>
            <Button
              type="text"
              size="small"
              icon={<IconRefresh />}
              onClick={loadAlerts}
              loading={loading}
            >
              刷新
            </Button>
            <Button
              type="primary"
              size="small"
              icon={<IconPlus />}
              onClick={() => setShowCreateModal(true)}
            >
              创建提醒
            </Button>
          </Space>
        }
      >
        {loading && alerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size={32} />
            <div style={{ marginTop: 16, color: '#86909c' }}>加载价格提醒中...</div>
          </div>
        ) : alerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#86909c' }}>
            <Empty description="暂无价格提醒" />
          </div>
        ) : (
          <Table
            columns={columns}
            data={alerts}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={isMobile ? { x: 700 } : undefined}
            style={isMobile ? { fontSize: 11 } : undefined}
          />
        )}
      </Card>

      {/* Create Alert Modal */}
      <Modal
        title="创建价格提醒"
        visible={showCreateModal}
        onOk={handleCreateAlert}
        onCancel={() => {
          setShowCreateModal(false);
          form.resetFields();
        }}
        okText="创建"
        cancelText="取消"
        okButtonProps={{ loading: actionLoading === 'create' }}
        width={isMobile ? '90%' : 600}
      >
        <Form
          form={form}
          layout="vertical"
          autoComplete="off"
          style={{ marginTop: 16 }}
        >
          <Form.Item
            label="交易对"
            field="symbol"
            rules={[{ required: true, message: '请输入交易对' }]}
            initialValue={symbol || 'BTC/USDT'}
          >
            <Input placeholder="例如：BTC/USDT" />
          </Form.Item>

          <Form.Item
            label="条件类型"
            field="conditionType"
            rules={[{ required: true, message: '请选择条件类型' }]}
            initialValue="above"
          >
            <Select>
              <Select.Option value="above">高于目标价</Select.Option>
              <Select.Option value="below">低于目标价</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="目标价格"
            field="targetPrice"
            rules={[
              { required: true, message: '请输入目标价格' },
              { type: 'number', min: 0, message: '价格必须大于 0' },
            ]}
          >
            <InputNumber
              placeholder="请输入目标价格"
              precision={2}
              step={0.01}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            label="通知方式"
            field="notificationMethod"
            initialValue="in_app"
          >
            <Select>
              <Select.Option value="in_app">应用内通知</Select.Option>
              <Select.Option value="feishu">飞书通知</Select.Option>
              <Select.Option value="email">邮件通知</Select.Option>
              <Select.Option value="push">推送通知</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="提醒类型"
            field="isRecurring"
            initialValue={false}
            triggerPropName="checked"
          >
            <Switch checkedText="循环提醒" uncheckedText="单次提醒" />
          </Form.Item>

          <Form.Item
            label="过期时间"
            field="expiresAt"
            extra="留空表示永不过期"
          >
            <DatePicker
              showTime
              placeholder="选择过期时间"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item label="备注" field="notes">
            <TextArea placeholder="可选备注信息" maxLength={200} showWordLimit />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default PriceAlertsPanel;
