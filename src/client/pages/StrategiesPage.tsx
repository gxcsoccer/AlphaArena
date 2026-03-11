import React, { useState } from 'react';
import { Layout, Typography, Card, Table, Tag, Space, Button, Modal, Form, Input, Select, Switch, Drawer } from '@arco-design/web-react';
import { useStrategies } from '../hooks/useData';
import type { TableProps } from '@arco-design/web-react';
import type { Strategy } from '../utils/api';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

interface StrategyFormValues {
  name: string;
  description?: string;
  symbol: string;
  status: 'active' | 'paused' | 'stopped';
  config: Record<string, any>;
}

const StrategiesPage: React.FC = () => {
  const { strategies, loading, refresh } = useStrategies();
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

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
      config: strategy.config,
    });
    setModalVisible(true);
  };

  const handleSave = async (values: StrategyFormValues) => {
    try {
      // TODO: Call API to update strategy
      console.log('Update strategy:', selectedStrategy?.id, values);
      setModalVisible(false);
      refresh();
    } catch (error) {
      console.error('Failed to update strategy:', error);
    }
  };

  const handleToggleStatus = async (strategy: Strategy) => {
    try {
      const newStatus = strategy.status === 'active' ? 'stopped' : 'active';
      // TODO: Call API to update strategy status
      console.log('Toggle strategy status:', strategy.id, newStatus);
      refresh();
    } catch (error) {
      console.error('Failed to toggle strategy:', error);
    }
  };

  const strategyColumns: TableProps<Strategy>['columns'] = [
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
        return <Tag color={colorMap[status] || 'gray'}>{status}</Tag>;
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
    <Layout style={{ minHeight: '100vh' }}>
      <Header>
        <Title heading={2} style={{ color: 'white', margin: 0 }}>
          AlphaArena - Strategies
        </Title>
      </Header>
      <Content style={{ padding: '24px' }}>
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
      </Content>

      {/* Strategy Details Drawer */}
      <Drawer
        title="Strategy Details"
        placement="end"
        width={600}
        visible={drawerVisible}
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
                {selectedStrategy.status}
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
              <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
                {JSON.stringify(selectedStrategy.config, null, 2)}
              </pre>
            </div>
          </Space>
        )}
      </Drawer>

      {/* Edit Strategy Modal */}
      <Modal
        title="Edit Strategy"
        visible={modalVisible}
        onOk={() => form.submit()}
        onCancel={() => setModalVisible(false)}
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
            <Input.Textarea rows={3} />
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
          <Form.Item name="config" label="Configuration (JSON)">
            <Input.Textarea rows={6} />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default StrategiesPage;
