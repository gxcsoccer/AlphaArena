import React, { useState } from 'react';
import { Typography, Card, Table, Tag, Space, Button, Modal, Form, Input, Select, Drawer, message } from 'antd';
import { useStrategies } from '../hooks/useData';
import { api, Strategy } from '../utils/api';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface StrategyFormValues {
  name: string;
  description?: string;
  symbol: string;
  status: 'active' | 'paused' | 'stopped';
  config: string; // Store as string for textarea, parse to object when submitting
}

const StrategiesPage: React.FC = () => {
  const { strategies, loading, refresh } = useStrategies();
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const handleViewDetails = (strategy: Strategy) => {
    setSelectedStrategy(strategy);
    setDrawerVisible(true);
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setSelectedStrategy(null);
  };

  const handleEdit = (strategy: Strategy) => {
    setSelectedStrategy(strategy);
    form.setFieldsValue({
      name: strategy.name,
      description: strategy.description,
      symbol: strategy.symbol,
      status: strategy.status,
      config: JSON.stringify(strategy.config, null, 2),
    });
    setModalVisible(true);
  };

  const handleSave = async (values: StrategyFormValues) => {
    if (!selectedStrategy) return;

    setSaving(true);
    try {
      let configObj;
      try {
        configObj = JSON.parse(values.config);
      } catch (err) {
        message.error('配置必须是有效的 JSON 格式');
        setSaving(false);
        return;
      }

      const updates: Partial<Strategy> = {
        name: values.name,
        description: values.description,
        symbol: values.symbol,
        status: values.status,
        config: configObj,
      };

      const updated = await api.updateStrategy(selectedStrategy.id, updates);
      if (updated) {
        message.success('策略更新成功');
        setModalVisible(false);
        refresh();
      } else {
        message.error('更新失败');
      }
    } catch (error: any) {
      console.error('Failed to update strategy:', error);
      message.error(`更新失败：${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (strategy: Strategy) => {
    try {
      const newStatus = strategy.status === 'active' ? 'stopped' : 'active';
      const updated = await api.updateStrategy(strategy.id, { status: newStatus });
      if (updated) {
        message.success(`策略已${newStatus === 'active' ? '启动' : '停止'}`);
        refresh();
      } else {
        message.error('操作失败');
      }
    } catch (error: any) {
      console.error('Failed to toggle strategy:', error);
      message.error(`操作失败：${error.message}`);
    }
  };

  const strategyColumns: ColumnsType<Strategy> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text: string, record: Strategy) => (
        <a onClick={() => handleViewDetails(record)}>{text}</a>
      ),
    },
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 100,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          active: 'green',
          paused: 'orange',
          stopped: 'red',
        };
        return <Tag color={colorMap[status] || 'default'}>{status.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (text: string) => new Date(text).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_: any, record: Strategy) => (
        <Space>
          <Button
            size="small"
            type={record.status === 'active' ? 'default' : 'primary'}
            onClick={() => handleToggleStatus(record)}
          >
            {record.status === 'active' ? 'Stop' : 'Start'}
          </Button>
          <Button size="small" onClick={() => handleEdit(record)}>
            Edit
          </Button>
          <Button size="small" onClick={() => handleViewDetails(record)}>
            Details
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2}>Strategies</Title>

      <Card
        title="Strategy Management"
        extra={
          <Button type="primary" onClick={refresh}>
            Refresh
          </Button>
        }
      >
        <Table
          columns={strategyColumns}
          dataSource={strategies}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      {/* Strategy Details Drawer */}
      <Drawer
        title="Strategy Details"
        placement="right"
        width={600}
        open={drawerVisible}
        onClose={handleCloseDrawer}
      >
        {selectedStrategy && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <Text strong>Name: </Text>
              <Text>{selectedStrategy.name}</Text>
            </div>
            <div>
              <Text strong>Symbol: </Text>
              <Text>{selectedStrategy.symbol}</Text>
            </div>
            <div>
              <Text strong>Status: </Text>
              <Tag color={selectedStrategy.status === 'active' ? 'green' : 'red'}>
                {selectedStrategy.status.toUpperCase()}
              </Tag>
            </div>
            <div>
              <Text strong>Description: </Text>
              <Text>{selectedStrategy.description || 'N/A'}</Text>
            </div>
            <div>
              <Text strong>Created: </Text>
              <Text>{new Date(selectedStrategy.createdAt).toLocaleString()}</Text>
            </div>
            <div>
              <Text strong>Updated: </Text>
              <Text>{new Date(selectedStrategy.updatedAt).toLocaleString()}</Text>
            </div>
            <div>
              <Text strong>Configuration: </Text>
              <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, overflow: 'auto' }}>
                {JSON.stringify(selectedStrategy.config, null, 2)}
              </pre>
            </div>
          </Space>
        )}
      </Drawer>

      {/* Edit Strategy Modal */}
      <Modal
        title="Edit Strategy"
        open={modalVisible}
        onOk={() => form.submit()}
        onCancel={() => setModalVisible(false)}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter strategy name' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item
            name="symbol"
            label="Symbol"
            rules={[{ required: true, message: 'Please enter trading symbol' }]}
          >
            <Input placeholder="e.g., BTC/USDT" />
          </Form.Item>
          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="active">Active</Select.Option>
              <Select.Option value="paused">Paused</Select.Option>
              <Select.Option value="stopped">Stopped</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item 
            name="config" 
            label="Configuration (JSON)"
            rules={[
              { 
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  try {
                    JSON.parse(value);
                    return Promise.resolve();
                  } catch {
                    return Promise.reject(new Error('Invalid JSON format'));
                  }
                }
              }
            ]}
          >
            <TextArea rows={6} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StrategiesPage;
