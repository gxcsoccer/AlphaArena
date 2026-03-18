/**
 * Enhanced Price Alerts Panel
 * 
 * Provides a comprehensive UI for managing price alerts with:
 * - Create/Edit/Delete alerts
 * - Real-time updates
 * - Browser notifications
 * - Sound alerts
 * - Alert history view
 */

import React, { useState, useEffect } from 'react';
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
  Tabs,
  Badge,
  Popconfirm,
  Tooltip,
} from '@arco-design/web-react';
import type { TableProps } from '@arco-design/web-react';
import {
  IconPlus,
  IconRefresh,
  IconEdit,
  IconDelete,
  IconBell,
  IconBellOff,
  IconHistory,
  IconQuestionCircle,
} from '@arco-design/web-react/icon';
import { usePriceAlerts, CreateAlertParams, UpdateAlertParams } from '../hooks/usePriceAlerts';
import { PriceAlert } from '../utils/api';
import HelpButton, { HelpButtons } from './HelpButton';

const { Text } = Typography;
const { TextArea } = Input;

interface PriceAlertsPanelEnhancedProps {
  symbol?: string;
  limit?: number;
  showHistory?: boolean;
}

const PriceAlertsPanelEnhanced: React.FC<PriceAlertsPanelEnhancedProps> = ({
  symbol,
  limit = 50,
  showHistory = true,
}) => {
  const {
    alerts,
    loading,
    actionLoading,
    activeCount,
    triggeredCount,
    createAlert,
    updateAlert,
    deleteAlert,
    toggleAlertStatus,
    refresh,
  } = usePriceAlerts({ symbol });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAlert, setEditingAlert] = useState<PriceAlert | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [isMobile, setIsMobile] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();


  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Filter alerts by tab
  const displayedAlerts = activeTab === 'active'
    ? alerts.filter(a => a.status === 'active' || a.status === 'disabled')
    : alerts.filter(a => a.status === 'triggered' || a.status === 'expired');

  // Handle create alert
  const handleCreateAlert = async () => {
    try {
      const values = await form.validate();
      
      const alertData: CreateAlertParams = {
        symbol: values.symbol.toUpperCase(),
        conditionType: values.conditionType,
        targetPrice: values.targetPrice,
        notificationMethod: values.notificationMethod || 'in_app',
        isRecurring: values.isRecurring || false,
        notes: values.notes,
        expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : undefined,
      };

      const result = await createAlert(alertData);

      if (result) {
        Message.success('价格提醒创建成功');
        setShowCreateModal(false);
        form.resetFields();
      }
    } catch (err: any) {
      if (err.fields) {
        return;
      }
      Message.error(err.message || '创建失败');
    }
  };

  // Handle edit alert
  const handleEditAlert = async () => {
    if (!editingAlert) return;
    
    try {
      const values = await editForm.validate();
      
      const updateData: UpdateAlertParams = {
        targetPrice: values.targetPrice,
        conditionType: values.conditionType,
        notificationMethod: values.notificationMethod,
        isRecurring: values.isRecurring,
        notes: values.notes,
      };

      const result = await updateAlert(editingAlert.id, updateData);

      if (result) {
        Message.success('价格提醒更新成功');
        setShowEditModal(false);
        setEditingAlert(null);
        editForm.resetFields();
      }
    } catch (err: any) {
      if (err.fields) {
        return;
      }
      Message.error(err.message || '更新失败');
    }
  };

  // Open edit modal
  const openEditModal = (alert: PriceAlert) => {
    setEditingAlert(alert);
    editForm.setFieldsValue({
      targetPrice: alert.targetPrice,
      conditionType: alert.conditionType,
      notificationMethod: alert.notificationMethod,
      isRecurring: alert.isRecurring,
      notes: alert.notes,
    });
    setShowEditModal(true);
  };

  // Handle delete alert
  const handleDeleteAlert = async (alertId: string) => {
    const success = await deleteAlert(alertId);
    if (success) {
      Message.success('价格提醒已删除');
    }
  };

  // Handle toggle alert
  const handleToggleAlert = async (alert: PriceAlert) => {
    const result = await toggleAlertStatus(alert.id);
    if (result) {
      Message.success(result.status === 'active' ? '提醒已启用' : '提醒已禁用');
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
      width: isMobile ? 100 : 140,
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
      width: isMobile ? 120 : 180,
      render: (_: any, record: PriceAlert) => (
        <Space size={isMobile ? 4 : 8}>
          {record.status === 'active' || record.status === 'disabled' ? (
            <>
              <Tooltip content={record.status === 'active' ? '禁用' : '启用'}>
                <Button
                  size={isMobile ? 'mini' : 'small'}
                  type={record.status === 'active' ? 'secondary' : 'primary'}
                  loading={actionLoading === `toggle-${record.id}`}
                  onClick={() => handleToggleAlert(record)}
                  icon={record.status === 'active' ? <IconBellOff /> : <IconBell />}
                />
              </Tooltip>
              <Tooltip content="编辑">
                <Button
                  size={isMobile ? 'mini' : 'small'}
                  type="secondary"
                  loading={actionLoading === `update-${record.id}`}
                  onClick={() => openEditModal(record)}
                  icon={<IconEdit />}
                />
              </Tooltip>
            </>
          ) : null}
          <Popconfirm
            title="确定删除此提醒？"
            onOk={() => handleDeleteAlert(record.id)}
          >
            <Tooltip content="删除">
              <Button
                size={isMobile ? 'mini' : 'small'}
                status="danger"
                loading={actionLoading === `delete-${record.id}`}
                icon={<IconDelete />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Form for create/edit
  const renderForm = (formInstance: typeof form, isEdit = false) => (
    <Form
      form={formInstance}
      layout="vertical"
      autoComplete="off"
      style={{ marginTop: 16 }}
    >
      {!isEdit && (
        <Form.Item
          label="交易对"
          field="symbol"
          rules={[{ required: true, message: '请输入交易对' }]}
          initialValue={symbol || 'BTC/USDT'}
        >
          <Input placeholder="例如：BTC/USDT" />
        </Form.Item>
      )}

      <Form.Item
        label="条件类型"
        field="conditionType"
        rules={[{ required: true, message: '请选择条件类型' }]}
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
          <Select.Option value="push">浏览器推送</Select.Option>
          <Select.Option value="feishu">飞书通知</Select.Option>
          <Select.Option value="email">邮件通知</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item
        label="提醒类型"
        field="isRecurring"
        triggerPropName="checked"
      >
        <Switch checkedText="循环提醒" uncheckedText="单次提醒" />
      </Form.Item>

      {!isEdit && (
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
      )}

      <Form.Item label="备注" field="notes">
        <TextArea placeholder="可选备注信息" maxLength={200} showWordLimit />
      </Form.Item>
    </Form>
  );

  return (
    <>
      <Card
        title={
          <Space>
            <span>价格提醒</span>
            <Badge count={activeCount} style={{ marginLeft: 8 }} />
            <HelpButton
              compact
              type="text"
              size="mini"
              {...HelpButtons.alerts}
            />
          </Space>
        }
        size="small"
        extra={
          <Space>
            <Button
              type="text"
              size="small"
              icon={<IconRefresh />}
              onClick={refresh}
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
        {showHistory && (
          <Tabs
            activeTab={activeTab}
            onChange={(key) => setActiveTab(key as any)}
            type="rounded"
            style={{ marginBottom: 16 }}
          >
            <Tabs.TabPane
              key="active"
              title={
                <Space size={4}>
                  <IconBell />
                  <span>生效中</span>
                  <Badge count={activeCount} style={{ marginLeft: 4 }} />
                </Space>
              }
            />
            <Tabs.TabPane
              key="history"
              title={
                <Space size={4}>
                  <IconHistory />
                  <span>已触发</span>
                  <Badge count={triggeredCount} style={{ marginLeft: 4 }} />
                </Space>
              }
            />
          </Tabs>
        )}

        {loading && displayedAlerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size={32} />
            <div style={{ marginTop: 16, color: '#86909c' }}>加载价格提醒中...</div>
          </div>
        ) : displayedAlerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#86909c' }}>
            <Empty description={activeTab === 'active' ? '暂无生效中的提醒' : '暂无触发的提醒'} />
          </div>
        ) : (
          <Table
            columns={columns}
            data={displayedAlerts.slice(0, limit)}
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
        {renderForm(form)}
      </Modal>

      {/* Edit Alert Modal */}
      <Modal
        title="编辑价格提醒"
        visible={showEditModal}
        onOk={handleEditAlert}
        onCancel={() => {
          setShowEditModal(false);
          setEditingAlert(null);
          editForm.resetFields();
        }}
        okText="保存"
        cancelText="取消"
        okButtonProps={{ loading: actionLoading === `update-${editingAlert?.id}` }}
        width={isMobile ? '90%' : 600}
      >
        {editingAlert && (
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">
              交易对：<Text bold>{editingAlert.symbol}</Text>
            </Text>
          </div>
        )}
        {renderForm(editForm, true)}
      </Modal>
    </>
  );
};

export default PriceAlertsPanelEnhanced;
