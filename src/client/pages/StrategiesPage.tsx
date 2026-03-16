import React, { useState } from 'react';
import { Typography, Card, Table, Tag, Space, Button, Modal, Form, Input, Select, Switch, Drawer } from '@arco-design/web-react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useStrategies } from '../hooks/useData';
import type { TableProps } from '@arco-design/web-react';
import type { Strategy } from '../utils/api';

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
  const [isMobile, setIsMobile] = useState(false);
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

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedStrategy(null);
    form.resetFields();
  };

  const handleSubmit = async (values: StrategyFormValues) => {
    try {
      // TODO: Implement API call to update strategy
      console.log('Updating strategy:', values);
      Message.success('Strategy updated successfully');
      handleCloseModal();
      refresh();
    } catch (error) {
      Message.error('Failed to update strategy');
    }
  };

  // Strategy table columns
  const strategyColumns: TableProps<Strategy>['columns'] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
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
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_: any, record: Strategy) => (
        <Space>
          <Button size="small" onClick={() => handleViewDetails(record)}>
            View
          </Button>
          <Button size="small" type="primary" onClick={() => handleEdit(record)}>
            Edit
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <ErrorBoundary>
      <div>
        {/* Page Title */}
        <Title heading={3} style={{ marginBottom: isMobile ? 12 : 24 }}>
          Strategies
        </Title>

        <Card
          title="Strategy Management"
          extra={
            <Button type="primary" onClick={refresh} size={isMobile ? 'default' : 'default'}>
              {isMobile ? '刷新' : 'Refresh'}
            </Button>
          }
          bodyStyle={isMobile ? { padding: 0, overflowX: 'auto' } : undefined}
        >
          <div className={isMobile ? 'mobile-table-container' : ''}>
            <Table
              columns={strategyColumns}
              dataSource={strategies}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 20 }}
              scroll={isMobile ? { x: 1000 } : undefined}
            />
          </div>
        </Card>

        {/* Strategy Details Drawer */}
        <Drawer
          title="Strategy Details"
          placement="end"
          width={isMobile ? '100%' : 600}
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
              {selectedStrategy.config && (
                <div>
                  <Text strong>Config: </Text>
                  <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                    {JSON.stringify(selectedStrategy.config, null, 2)}
                  </pre>
                </div>
              )}
            </Space>
          )}
        </Drawer>

        {/* Edit Strategy Modal */}
        <Modal
          title="Edit Strategy"
          visible={modalVisible}
          onCancel={handleCloseModal}
          onOk={() => form.submit()}
          style={{ width: isMobile ? '95%' : 600 }}
        >
          <Form form={form} onSubmit={handleSubmit} layout="vertical">
            <Form.Item label="Name" field="name" rules={[{ required: true }]}>
              <Input placeholder="Strategy name" />
            </Form.Item>
            <Form.Item label="Description" field="description">
              <Input.TextArea placeholder="Strategy description" />
            </Form.Item>
            <Form.Item label="Symbol" field="symbol" rules={[{ required: true }]}>
              <Select placeholder="Select symbol">
                <Select.Option value="BTC/USD">BTC/USD</Select.Option>
                <Select.Option value="ETH/USD">ETH/USD</Select.Option>
                <Select.Option value="SOL/USD">SOL/USD</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="Status" field="status" rules={[{ required: true }]}>
              <Select placeholder="Select status">
                <Select.Option value="active">Active</Select.Option>
                <Select.Option value="paused">Paused</Select.Option>
                <Select.Option value="stopped">Stopped</Select.Option>
              </Select>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </ErrorBoundary>
  );
};

export default StrategiesPage;
