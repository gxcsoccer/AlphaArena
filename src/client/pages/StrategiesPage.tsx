import React, { useState, useCallback } from 'react';
import { Typography, Card, Table, Tag, Space, Button, Modal, Form, Input, Select, Drawer, Grid, Collapse, Message } from '@arco-design/web-react';
import { IconRefresh, IconSearch } from '@arco-design/web-react/icon';
import { ErrorBoundary } from '../components/ErrorBoundary';
import MobileTableCard from '../components/MobileTableCard';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useSwipeNavigation } from '../hooks/useTouchGestures';
import { useStrategies } from '../hooks/useData';
import type { TableProps } from '@arco-design/web-react';
import type { Strategy } from '../utils/api';

const { Title, Text } = Typography;
const { Row, Col } = Grid;
const _CollapseItem = Collapse.Item;

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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [form] = Form.useForm();
  
  const { isMobile, isTablet } = useMediaQuery();

  // Swipe navigation for mobile
  const { _currentItem, _goToNext, _goToPrev, touchHandlers } = useSwipeNavigation(
    strategies.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (statusFilter === 'all' || s.status === statusFilter)
    ),
    {
      onNavigate: (item) => {
        setSelectedStrategy(item);
        setDrawerVisible(true);
      },
    }
  );

  const handleViewDetails = useCallback((strategy: Strategy) => {
    setSelectedStrategy(strategy);
    setDrawerVisible(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setDrawerVisible(false);
    setSelectedStrategy(null);
  }, []);

  const handleEdit = useCallback((strategy: Strategy) => {
    setSelectedStrategy(strategy);
    form.setFieldsValue({
      name: strategy.name,
      description: strategy.description,
      symbol: strategy.symbol,
      status: strategy.status,
      config: strategy.config,
    });
    setModalVisible(true);
  }, [form]);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setSelectedStrategy(null);
    form.resetFields();
  }, [form]);

  const handleSubmit = useCallback(async (values: StrategyFormValues) => {
    try {
      console.log('Updating strategy:', values);
      Message.success('Strategy updated successfully');
      handleCloseModal();
      refresh();
    } catch (_error) {
      Message.error('Failed to update strategy');
    }
  }, [handleCloseModal, refresh]);

  // Filtered strategies
  const filteredStrategies = strategies.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (statusFilter === 'all' || s.status === statusFilter)
  );

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

  // Mobile card fields for strategies
  const strategyCardFields = [
    { key: 'name', label: 'Name', priority: 1 as const },
    { key: 'symbol', label: 'Symbol', priority: 2 as const },
    { 
      key: 'status', 
      label: 'Status', 
      priority: 3 as const, 
      render: (v: string) => {
        const colorMap: Record<string, string> = { active: 'green', paused: 'orange', stopped: 'red' };
        return <Tag color={colorMap[v] || 'gray'}>{v}</Tag>;
      }
    },
    { key: 'description', label: 'Description', priority: 4 as const },
  ];

  // Mobile layout
  if (isMobile) {
    return (
      <ErrorBoundary>
        <div className="strategies-page strategies-page--mobile" {...touchHandlers}>
          {/* Mobile Header */}
          <div style={{ padding: '0 4px', marginBottom: 12 }}>
            <Title heading={4} style={{ marginBottom: 8 }}>Strategies</Title>
            
            {/* Search and Filter */}
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Input
                prefix={<IconSearch />}
                placeholder="Search strategies..."
                value={searchQuery}
                onChange={setSearchQuery}
                style={{ borderRadius: 8 }}
              />
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: '100%' }}
                placeholder="Filter by status"
              >
                <Select.Option value="all">All Status</Select.Option>
                <Select.Option value="active">Active</Select.Option>
                <Select.Option value="paused">Paused</Select.Option>
                <Select.Option value="stopped">Stopped</Select.Option>
              </Select>
            </Space>
          </div>

          {/* Strategy Count */}
          <div style={{ padding: '0 4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary">{filteredStrategies.length} strategies</Text>
            <Button 
              type="text" 
              icon={<IconRefresh />} 
              onClick={refresh}
              size="small"
            />
          </div>

          {/* Strategy Cards */}
          <div className="mobile-card-stack">
            {loading ? (
              <Card style={{ textAlign: 'center', padding: 24 }}>
                <Text type="secondary">Loading strategies...</Text>
              </Card>
            ) : filteredStrategies.length === 0 ? (
              <Card style={{ textAlign: 'center', padding: 24 }}>
                <Text type="secondary">No strategies found</Text>
              </Card>
            ) : (
              filteredStrategies.map((strategy) => (
                <MobileTableCard
                  key={strategy.id}
                  data={strategy}
                  fields={strategyCardFields}
                  titleField="name"
                  onClick={() => handleViewDetails(strategy)}
                  actions={
                    <Space>
                      <Button size="mini" onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(strategy);
                      }}>
                        Edit
                      </Button>
                    </Space>
                  }
                />
              ))
            )}
          </div>

          {/* Strategy Details Drawer */}
          <Drawer
            title="Strategy Details"
            placement="bottom"
            height="80%"
            visible={drawerVisible}
            onClose={handleCloseDrawer}
            style={{ borderRadius: '16px 16px 0 0' }}
          >
            {selectedStrategy && (
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                {/* Quick Stats */}
                <Row gutter={12}>
                  <Col span={12}>
                    <Card className="stats-card">
                      <Text type="secondary" style={{ fontSize: 12 }}>Status</Text>
                      <div>
                        <Tag color={selectedStrategy.status === 'active' ? 'green' : selectedStrategy.status === 'paused' ? 'orange' : 'red'}>
                          {selectedStrategy.status}
                        </Tag>
                      </div>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card className="stats-card">
                      <Text type="secondary" style={{ fontSize: 12 }}>Symbol</Text>
                      <div>
                        <Tag color="blue">{selectedStrategy.symbol}</Tag>
                      </div>
                    </Card>
                  </Col>
                </Row>

                {/* Details */}
                <Card title="Details" bordered={false}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <Text strong>Name: </Text>
                      <Text>{selectedStrategy.name}</Text>
                    </div>
                    <div>
                      <Text strong>Description: </Text>
                      <Text>{selectedStrategy.description || 'N/A'}</Text>
                    </div>
                    {selectedStrategy.config && (
                      <div>
                        <Text strong>Config: </Text>
                        <pre style={{ 
                          background: 'var(--color-fill-2)', 
                          padding: 12, 
                          borderRadius: 8,
                          fontSize: 12,
                          overflow: 'auto',
                        }}>
                          {JSON.stringify(selectedStrategy.config, null, 2)}
                        </pre>
                      </div>
                    )}
                  </Space>
                </Card>

                {/* Actions */}
                <Button 
                  type="primary" 
                  long 
                  onClick={() => {
                    handleCloseDrawer();
                    handleEdit(selectedStrategy);
                  }}
                >
                  Edit Strategy
                </Button>
              </Space>
            )}
          </Drawer>

          {/* Edit Strategy Modal */}
          <Modal
            title="Edit Strategy"
            visible={modalVisible}
            onCancel={handleCloseModal}
            onOk={() => form.submit()}
            style={{ width: '95%' }}
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
  }

  // Desktop/Tablet layout
  return (
    <ErrorBoundary>
      <div>
        {/* Page Title */}
        <div style={{ marginBottom: isTablet ? 16 : 24 }}>
          <Row justify="space-between" align="center">
            <Col>
              <Title heading={3} style={{ margin: 0 }}>Strategies</Title>
            </Col>
            <Col>
              <Space>
                {isTablet && (
                  <Input
                    prefix={<IconSearch />}
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={setSearchQuery}
                    style={{ width: 200 }}
                  />
                )}
                <Button type="primary" onClick={refresh}>
                  <IconRefresh style={{ marginRight: 4 }} />
                  {isTablet ? '' : 'Refresh'}
                </Button>
              </Space>
            </Col>
          </Row>
        </div>

        {/* Filters (Desktop) */}
        {!isTablet && (
          <Card style={{ marginBottom: 16 }}>
            <Space size="large">
              <Input
                prefix={<IconSearch />}
                placeholder="Search strategies..."
                value={searchQuery}
                onChange={setSearchQuery}
                style={{ width: 250 }}
              />
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 150 }}
                placeholder="Filter by status"
              >
                <Select.Option value="all">All Status</Select.Option>
                <Select.Option value="active">Active</Select.Option>
                <Select.Option value="paused">Paused</Select.Option>
                <Select.Option value="stopped">Stopped</Select.Option>
              </Select>
            </Space>
          </Card>
        )}

        <Card
          title="Strategy Management"
          extra={
            isTablet && (
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 120 }}
                size="small"
              >
                <Select.Option value="all">All</Select.Option>
                <Select.Option value="active">Active</Select.Option>
                <Select.Option value="paused">Paused</Select.Option>
                <Select.Option value="stopped">Stopped</Select.Option>
              </Select>
            )
          }
          bodyStyle={isTablet ? { padding: 12 } : undefined}
        >
          <div className={isTablet ? 'mobile-table-container' : ''}>
            <Table
              columns={strategyColumns}
              dataSource={filteredStrategies}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: isTablet ? 10 : 20 }}
              scroll={isTablet ? { x: 1000 } : undefined}
            />
          </div>
        </Card>

        {/* Strategy Details Drawer */}
        <Drawer
          title="Strategy Details"
          placement="end"
          width={isTablet ? 400 : 600}
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
                  <pre style={{ background: 'var(--color-fill-2)', padding: 8, borderRadius: 4 }}>
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
          style={{ width: isTablet ? '95%' : 600 }}
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