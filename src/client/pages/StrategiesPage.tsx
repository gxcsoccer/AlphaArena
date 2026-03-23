import React, { useState, useCallback } from 'react';
import { Typography, Card, Table, Tag, Space, Button, Modal, Form, Input, Select, Drawer, Grid, Collapse, Message, Progress } from '@arco-design/web-react';
import { IconRefresh, IconSearch, IconPlayCircle, IconPauseCircle, IconStop, IconSettings } from '@arco-design/web-react/icon';
import { ErrorBoundary } from '../components/ErrorBoundary';
import MobileTableCard from '../components/MobileTableCard';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useSwipeNavigation } from '../hooks/useTouchGestures';
import { useStrategies } from '../hooks/useData';
import type { TableProps } from '@arco-design/web-react';
import type { Strategy } from '../utils/api';
import '../styles/visual-optimization.css';

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
      title: '策略名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string) => (
        <span style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-1)' }}>
          {name}
        </span>
      ),
    },
    {
      title: '交易对',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 100,
      render: (symbol: string) => (
        <Tag color="blue" style={{ borderRadius: 'var(--radius-sm)' }}>{symbol}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        return (
          <span className={`strategy-status strategy-status--${status}`}>
            <span className="strategy-status__dot" />
            {status === 'active' ? '运行中' : status === 'paused' ? '已暂停' : '已停止'}
          </span>
        );
      },
    },
    {
      title: '收益率',
      key: 'returnRate',
      width: 100,
      render: () => {
        // 模拟收益率数据
        const rate = Math.random() * 40 - 20;
        return (
          <span style={{ 
            color: rate >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
            fontWeight: 'var(--font-weight-semibold)'
          }}>
            {rate >= 0 ? '+' : ''}{rate.toFixed(2)}%
          </span>
        );
      },
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc: string) => (
        <span style={{ color: 'var(--color-text-2)' }}>{desc || '暂无描述'}</span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: any, record: Strategy) => (
        <Space>
          <Button 
            size="small" 
            type="primary"
            icon={<IconPlayCircle />}
            disabled={record.status === 'active'}
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            启动
          </Button>
          <Button 
            size="small"
            icon={<IconPauseCircle />}
            disabled={record.status !== 'active'}
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            暂停
          </Button>
          <Button 
            size="small" 
            icon={<IconSettings />}
            onClick={() => handleEdit(record)}
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            编辑
          </Button>
        </Space>
      ),
    },
  ];

  // Mobile card fields for strategies
  const strategyCardFields = [
    { key: 'name', label: '策略名称', priority: 1 as const },
    { key: 'symbol', label: '交易对', priority: 2 as const },
    { 
      key: 'status', 
      label: '状态', 
      priority: 3 as const, 
      render: (v: string) => (
        <span className={`strategy-status strategy-status--${v}`}>
          <span className="strategy-status__dot" />
          {v === 'active' ? '运行中' : v === 'paused' ? '已暂停' : '已停止'}
        </span>
      )
    },
    { key: 'description', label: '描述', priority: 4 as const },
  ];

  // Mobile layout
  if (isMobile) {
    return (
      <ErrorBoundary>
        <div className="strategies-page strategies-page--mobile" {...touchHandlers}>
          {/* Mobile Header */}
          <div style={{ padding: '0 4px', marginBottom: 12 }}>
            <Title heading={4} style={{ marginBottom: 8 }}>策略管理</Title>
            
            {/* Search and Filter */}
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Input
                prefix={<IconSearch />}
                placeholder="搜索策略..."
                value={searchQuery}
                onChange={setSearchQuery}
                style={{ borderRadius: 8 }}
              />
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: '100%' }}
                placeholder="筛选状态"
              >
                <Select.Option value="all">全部状态</Select.Option>
                <Select.Option value="active">运行中</Select.Option>
                <Select.Option value="paused">已暂停</Select.Option>
                <Select.Option value="stopped">已停止</Select.Option>
              </Select>
            </Space>
          </div>

          {/* Strategy Count */}
          <div style={{ padding: '0 4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary">{filteredStrategies.length} 个策略</Text>
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
              <Card style={{ textAlign: 'center', padding: 24 }} className="chart-card">
                <Text type="secondary">加载中...</Text>
              </Card>
            ) : filteredStrategies.length === 0 ? (
              <Card style={{ textAlign: 'center', padding: 24 }} className="chart-card">
                <Text type="secondary">暂无策略</Text>
              </Card>
            ) : (
              filteredStrategies.map((strategy) => (
                <Card key={strategy.id} className="strategy-card" style={{ marginBottom: 12 }}>
                  <div className="strategy-card__header">
                    <div>
                      <div className="strategy-card__name">{strategy.name}</div>
                      <div className="strategy-card__symbol">
                        <Tag color="blue" style={{ borderRadius: 'var(--radius-sm)' }}>{strategy.symbol}</Tag>
                      </div>
                    </div>
                    <span className={`strategy-status strategy-status--${strategy.status}`}>
                      <span className="strategy-status__dot" />
                      {strategy.status === 'active' ? '运行中' : strategy.status === 'paused' ? '已暂停' : '已停止'}
                    </span>
                  </div>
                  
                  <div className="strategy-metrics">
                    <div className="strategy-metric">
                      <div className="strategy-metric__value strategy-metric__value--positive">+12.5%</div>
                      <div className="strategy-metric__label">收益率</div>
                    </div>
                    <div className="strategy-metric">
                      <div className="strategy-metric__value">156</div>
                      <div className="strategy-metric__label">交易次数</div>
                    </div>
                    <div className="strategy-metric">
                      <div className="strategy-metric__value">85%</div>
                      <div className="strategy-metric__label">胜率</div>
                    </div>
                  </div>
                  
                  <div className="strategy-card__actions">
                    <Button size="small" type="primary" icon={<IconPlayCircle />} disabled={strategy.status === 'active'}>
                      启动
                    </Button>
                    <Button size="small" icon={<IconPauseCircle />} disabled={strategy.status !== 'active'}>
                      暂停
                    </Button>
                    <Button size="small" icon={<IconSettings />} onClick={() => handleEdit(strategy)}>
                      编辑
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Strategy Details Drawer */}
          <Drawer
            title="策略详情"
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
                      <Text type="secondary" style={{ fontSize: 12 }}>状态</Text>
                      <div>
                        <span className={`strategy-status strategy-status--${selectedStrategy.status}`}>
                          <span className="strategy-status__dot" />
                          {selectedStrategy.status === 'active' ? '运行中' : selectedStrategy.status === 'paused' ? '已暂停' : '已停止'}
                        </span>
                      </div>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card className="stats-card">
                      <Text type="secondary" style={{ fontSize: 12 }}>交易对</Text>
                      <div>
                        <Tag color="blue" style={{ borderRadius: 'var(--radius-sm)' }}>{selectedStrategy.symbol}</Tag>
                      </div>
                    </Card>
                  </Col>
                </Row>

                {/* Details */}
                <Card title="详细信息" bordered={false} className="chart-card">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <Text strong>名称: </Text>
                      <Text>{selectedStrategy.name}</Text>
                    </div>
                    <div>
                      <Text strong>描述: </Text>
                      <Text>{selectedStrategy.description || '暂无描述'}</Text>
                    </div>
                    {selectedStrategy.config && (
                      <div>
                        <Text strong>配置: </Text>
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
                  编辑策略
                </Button>
              </Space>
            )}
          </Drawer>

          {/* Edit Strategy Modal */}
          <Modal
            title="编辑策略"
            visible={modalVisible}
            onCancel={handleCloseModal}
            onOk={() => form.submit()}
            style={{ width: '95%' }}
          >
            <Form form={form} onSubmit={handleSubmit} layout="vertical">
              <Form.Item label="名称" field="name" rules={[{ required: true }]}>
                <Input placeholder="策略名称" />
              </Form.Item>
              <Form.Item label="描述" field="description">
                <Input.TextArea placeholder="策略描述" />
              </Form.Item>
              <Form.Item label="交易对" field="symbol" rules={[{ required: true }]}>
                <Select placeholder="选择交易对">
                  <Select.Option value="BTC/USD">BTC/USD</Select.Option>
                  <Select.Option value="ETH/USD">ETH/USD</Select.Option>
                  <Select.Option value="SOL/USD">SOL/USD</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item label="状态" field="status" rules={[{ required: true }]}>
                <Select placeholder="选择状态">
                  <Select.Option value="active">运行中</Select.Option>
                  <Select.Option value="paused">已暂停</Select.Option>
                  <Select.Option value="stopped">已停止</Select.Option>
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
              <Title heading={3} style={{ margin: 0 }}>策略管理</Title>
            </Col>
            <Col>
              <Space>
                {isTablet && (
                  <Input
                    prefix={<IconSearch />}
                    placeholder="搜索..."
                    value={searchQuery}
                    onChange={setSearchQuery}
                    style={{ width: 200 }}
                  />
                )}
                <Button type="primary" onClick={refresh} icon={<IconRefresh />}>
                  {isTablet ? '' : '刷新'}
                </Button>
              </Space>
            </Col>
          </Row>
        </div>

        {/* Filters (Desktop) */}
        {!isTablet && (
          <Card style={{ marginBottom: 16 }} className="chart-card">
            <Space size="large">
              <Input
                prefix={<IconSearch />}
                placeholder="搜索策略..."
                value={searchQuery}
                onChange={setSearchQuery}
                style={{ width: 250 }}
              />
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 150 }}
                placeholder="筛选状态"
              >
                <Select.Option value="all">全部状态</Select.Option>
                <Select.Option value="active">运行中</Select.Option>
                <Select.Option value="paused">已暂停</Select.Option>
                <Select.Option value="stopped">已停止</Select.Option>
              </Select>
            </Space>
          </Card>
        )}

        <Card
          title="策略列表"
          extra={
            isTablet && (
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 120 }}
                size="small"
              >
                <Select.Option value="all">全部</Select.Option>
                <Select.Option value="active">运行中</Select.Option>
                <Select.Option value="paused">已暂停</Select.Option>
                <Select.Option value="stopped">已停止</Select.Option>
              </Select>
            )
          }
          bodyStyle={isTablet ? { padding: 12 } : undefined}
          className="chart-card"
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
          title="策略详情"
          placement="end"
          width={isTablet ? 400 : 600}
          visible={drawerVisible}
          onClose={handleCloseDrawer}
        >
          {selectedStrategy && (
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text strong>名称: </Text>
                <Text>{selectedStrategy.name}</Text>
              </div>
              <div>
                <Text strong>交易对: </Text>
                <Text>{selectedStrategy.symbol}</Text>
              </div>
              <div>
                <Text strong>状态: </Text>
                <span className={`strategy-status strategy-status--${selectedStrategy.status}`}>
                  <span className="strategy-status__dot" />
                  {selectedStrategy.status === 'active' ? '运行中' : selectedStrategy.status === 'paused' ? '已暂停' : '已停止'}
                </span>
              </div>
              <div>
                <Text strong>描述: </Text>
                <Text>{selectedStrategy.description || '暂无描述'}</Text>
              </div>
              {selectedStrategy.config && (
                <div>
                  <Text strong>配置: </Text>
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
          title="编辑策略"
          visible={modalVisible}
          onCancel={handleCloseModal}
          onOk={() => form.submit()}
          style={{ width: isTablet ? '95%' : 600 }}
        >
          <Form form={form} onSubmit={handleSubmit} layout="vertical">
            <Form.Item label="名称" field="name" rules={[{ required: true }]}>
              <Input placeholder="策略名称" />
            </Form.Item>
            <Form.Item label="描述" field="description">
              <Input.TextArea placeholder="策略描述" />
            </Form.Item>
            <Form.Item label="交易对" field="symbol" rules={[{ required: true }]}>
              <Select placeholder="选择交易对">
                <Select.Option value="BTC/USD">BTC/USD</Select.Option>
                <Select.Option value="ETH/USD">ETH/USD</Select.Option>
                <Select.Option value="SOL/USD">SOL/USD</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="状态" field="status" rules={[{ required: true }]}>
              <Select placeholder="选择状态">
                <Select.Option value="active">运行中</Select.Option>
                <Select.Option value="paused">已暂停</Select.Option>
                <Select.Option value="stopped">已停止</Select.Option>
              </Select>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </ErrorBoundary>
  );
};

export default StrategiesPage;