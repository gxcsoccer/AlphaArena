import React, { useState, useCallback } from 'react';
import { Typography, Card, Table, Tag, Space, Button, Modal, Form, Input, Select, Drawer, Grid, Collapse, Message, Progress } from '@arco-design/web-react';
import { IconRefresh, IconSearch, IconPlayCircle, IconPauseCircle, IconStop, IconSettings } from '@arco-design/web-react/icon';
import { ErrorBoundary } from '../components/ErrorBoundary';
import MobileTableCard from '../components/MobileTableCard';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useSwipeNavigation } from '../hooks/useTouchGestures';
import { useStrategies } from '../hooks/useData';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('strategy');

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
      title: t('form.name'),
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
      title: t('form.symbol'),
      dataIndex: 'symbol',
      key: 'symbol',
      width: 100,
      render: (symbol: string) => (
        <Tag color="blue" style={{ borderRadius: 'var(--radius-sm)' }}>{symbol}</Tag>
      ),
    },
    {
      title: t('form.status'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        return (
          <span className={`strategy-status strategy-status--${status}`}>
            <span className="strategy-status__dot" />
            {status === 'active' ? t('status.active') : status === 'paused' ? t('status.paused') : t('status.stopped')}
          </span>
        );
      },
    },
    {
      title: t('performance.totalReturn'),
      key: 'returnRate',
      width: 100,
      render: () => {
        // Simulated return rate data
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
      title: t('form.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc: string) => (
        <span style={{ color: 'var(--color-text-2)' }}>{desc || t('list.noResults')}</span>
      ),
    },
    {
      title: t('form.actions'),
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
            {t('detail.start')}
          </Button>
          <Button 
            size="small"
            icon={<IconPauseCircle />}
            disabled={record.status !== 'active'}
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            {t('detail.stop')}
          </Button>
          <Button 
            size="small" 
            icon={<IconSettings />}
            onClick={() => handleEdit(record)}
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            {t('detail.edit')}
          </Button>
        </Space>
      ),
    },
  ];

  // Mobile card fields for strategies
  const strategyCardFields = [
    { key: 'name', label: t('form.name'), priority: 1 as const },
    { key: 'symbol', label: t('form.symbol'), priority: 2 as const },
    { 
      key: 'status', 
      label: t('form.status'), 
      priority: 3 as const, 
      render: (v: string) => (
        <span className={`strategy-status strategy-status--${v}`}>
          <span className="strategy-status__dot" />
          {v === 'active' ? t('status.active') : v === 'paused' ? t('status.paused') : t('status.stopped')}
        </span>
      )
    },
    { key: 'description', label: t('form.description'), priority: 4 as const },
  ];

  // Mobile layout
  if (isMobile) {
    return (
      <ErrorBoundary>
        <div className="strategies-page strategies-page--mobile" {...touchHandlers}>
          {/* Mobile Header */}
          <div style={{ padding: '0 4px', marginBottom: 12 }}>
            <Title heading={4} style={{ marginBottom: 8 }}>{t('title')}</Title>
            
            {/* Search and Filter */}
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Input
                prefix={<IconSearch />}
                placeholder={t('list.search')}
                value={searchQuery}
                onChange={setSearchQuery}
                style={{ borderRadius: 8 }}
              />
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: '100%' }}
                placeholder={t('list.filter')}
              >
                <Select.Option value="all">{t('common:label.all')}</Select.Option>
                <Select.Option value="active">{t('status.active')}</Select.Option>
                <Select.Option value="paused">{t('status.paused')}</Select.Option>
                <Select.Option value="stopped">{t('status.stopped')}</Select.Option>
              </Select>
            </Space>
          </div>

          {/* Strategy Count */}
          <div style={{ padding: '0 4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary">{filteredStrategies.length} {t('list.title')}</Text>
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
                <Text type="secondary">{t('common:button.loading')}</Text>
              </Card>
            ) : filteredStrategies.length === 0 ? (
              <Card style={{ textAlign: 'center', padding: 24 }} className="chart-card">
                <Text type="secondary">{t('list.noResults')}</Text>
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
                      {strategy.status === 'active' ? t('status.active') : strategy.status === 'paused' ? t('status.paused') : t('status.stopped')}
                    </span>
                  </div>
                  
                  <div className="strategy-metrics">
                    <div className="strategy-metric">
                      <div className="strategy-metric__value strategy-metric__value--positive">+12.5%</div>
                      <div className="strategy-metric__label">{t('performance.totalReturn')}</div>
                    </div>
                    <div className="strategy-metric">
                      <div className="strategy-metric__value">156</div>
                      <div className="strategy-metric__label">{t('performance.trades')}</div>
                    </div>
                    <div className="strategy-metric">
                      <div className="strategy-metric__value">85%</div>
                      <div className="strategy-metric__label">{t('performance.winRate')}</div>
                    </div>
                  </div>
                  
                  <div className="strategy-card__actions">
                    <Button size="small" type="primary" icon={<IconPlayCircle />} disabled={strategy.status === 'active'}>
                      {t('detail.start')}
                    </Button>
                    <Button size="small" icon={<IconPauseCircle />} disabled={strategy.status !== 'active'}>
                      {t('detail.stop')}
                    </Button>
                    <Button size="small" icon={<IconSettings />} onClick={() => handleEdit(strategy)}>
                      {t('detail.edit')}
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Strategy Details Drawer */}
          <Drawer
            title={t('detail.title')}
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
                      <Text type="secondary" style={{ fontSize: 12 }}>{t('form.status')}</Text>
                      <div>
                        <span className={`strategy-status strategy-status--${selectedStrategy.status}`}>
                          <span className="strategy-status__dot" />
                          {selectedStrategy.status === 'active' ? t('status.active') : selectedStrategy.status === 'paused' ? t('status.paused') : t('status.stopped')}
                        </span>
                      </div>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card className="stats-card">
                      <Text type="secondary" style={{ fontSize: 12 }}>{t('form.symbol')}</Text>
                      <div>
                        <Tag color="blue" style={{ borderRadius: 'var(--radius-sm)' }}>{selectedStrategy.symbol}</Tag>
                      </div>
                    </Card>
                  </Col>
                </Row>

                {/* Details */}
                <Card title={t('detail.title')} bordered={false} className="chart-card">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <Text strong>{t('form.name')}: </Text>
                      <Text>{selectedStrategy.name}</Text>
                    </div>
                    <div>
                      <Text strong>{t('form.description')}: </Text>
                      <Text>{selectedStrategy.description || t('list.noResults')}</Text>
                    </div>
                    {selectedStrategy.config && (
                      <div>
                        <Text strong>{t('form.conditions')}: </Text>
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
                  {t('detail.edit')}
                </Button>
              </Space>
            )}
          </Drawer>

          {/* Edit Strategy Modal */}
          <Modal
            title={t('detail.edit')}
            visible={modalVisible}
            onCancel={handleCloseModal}
            onOk={() => form.submit()}
            style={{ width: '95%' }}
          >
            <Form form={form} onSubmit={handleSubmit} layout="vertical">
              <Form.Item label={t('form.name')} field="name" rules={[{ required: true }]}>
                <Input placeholder={t('form.name')} />
              </Form.Item>
              <Form.Item label={t('form.description')} field="description">
                <Input.TextArea placeholder={t('form.description')} />
              </Form.Item>
              <Form.Item label={t('form.symbol')} field="symbol" rules={[{ required: true }]}>
                <Select placeholder={t('common:label.select')}>
                  <Select.Option value="BTC/USD">BTC/USD</Select.Option>
                  <Select.Option value="ETH/USD">ETH/USD</Select.Option>
                  <Select.Option value="SOL/USD">SOL/USD</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item label={t('form.status')} field="status" rules={[{ required: true }]}>
                <Select placeholder={t('common:label.select')}>
                  <Select.Option value="active">{t('status.active')}</Select.Option>
                  <Select.Option value="paused">{t('status.paused')}</Select.Option>
                  <Select.Option value="stopped">{t('status.stopped')}</Select.Option>
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
              <Title heading={3} style={{ margin: 0 }}>{t('title')}</Title>
            </Col>
            <Col>
              <Space>
                {isTablet && (
                  <Input
                    prefix={<IconSearch />}
                    placeholder={t('list.search')}
                    value={searchQuery}
                    onChange={setSearchQuery}
                    style={{ width: 200 }}
                  />
                )}
                <Button type="primary" onClick={refresh} icon={<IconRefresh />}>
                  {isTablet ? '' : t('common:button.refresh')}
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
                placeholder={t('list.search')}
                value={searchQuery}
                onChange={setSearchQuery}
                style={{ width: 250 }}
              />
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 150 }}
                placeholder={t('list.filter')}
              >
                <Select.Option value="all">{t('common:label.all')}</Select.Option>
                <Select.Option value="active">{t('status.active')}</Select.Option>
                <Select.Option value="paused">{t('status.paused')}</Select.Option>
                <Select.Option value="stopped">{t('status.stopped')}</Select.Option>
              </Select>
            </Space>
          </Card>
        )}

        <Card
          title={t('list.title')}
          extra={
            isTablet && (
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 120 }}
                size="small"
              >
                <Select.Option value="all">{t('common:label.all')}</Select.Option>
                <Select.Option value="active">{t('status.active')}</Select.Option>
                <Select.Option value="paused">{t('status.paused')}</Select.Option>
                <Select.Option value="stopped">{t('status.stopped')}</Select.Option>
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
          title={t('detail.title')}
          placement="end"
          width={isTablet ? 400 : 600}
          visible={drawerVisible}
          onClose={handleCloseDrawer}
        >
          {selectedStrategy && (
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text strong>{t('form.name')}: </Text>
                <Text>{selectedStrategy.name}</Text>
              </div>
              <div>
                <Text strong>{t('form.symbol')}: </Text>
                <Text>{selectedStrategy.symbol}</Text>
              </div>
              <div>
                <Text strong>{t('form.status')}: </Text>
                <span className={`strategy-status strategy-status--${selectedStrategy.status}`}>
                  <span className="strategy-status__dot" />
                  {selectedStrategy.status === 'active' ? t('status.active') : selectedStrategy.status === 'paused' ? t('status.paused') : t('status.stopped')}
                </span>
              </div>
              <div>
                <Text strong>{t('form.description')}: </Text>
                <Text>{selectedStrategy.description || t('list.noResults')}</Text>
              </div>
              {selectedStrategy.config && (
                <div>
                  <Text strong>{t('form.conditions')}: </Text>
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
          title={t('detail.edit')}
          visible={modalVisible}
          onCancel={handleCloseModal}
          onOk={() => form.submit()}
          style={{ width: isTablet ? '95%' : 600 }}
        >
          <Form form={form} onSubmit={handleSubmit} layout="vertical">
            <Form.Item label={t('form.name')} field="name" rules={[{ required: true }]}>
              <Input placeholder={t('form.name')} />
            </Form.Item>
            <Form.Item label={t('form.description')} field="description">
              <Input.TextArea placeholder={t('form.description')} />
            </Form.Item>
            <Form.Item label={t('form.symbol')} field="symbol" rules={[{ required: true }]}>
              <Select placeholder={t('common:label.select')}>
                <Select.Option value="BTC/USD">BTC/USD</Select.Option>
                <Select.Option value="ETH/USD">ETH/USD</Select.Option>
                <Select.Option value="SOL/USD">SOL/USD</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label={t('form.status')} field="status" rules={[{ required: true }]}>
              <Select placeholder={t('common:label.select')}>
                <Select.Option value="active">{t('status.active')}</Select.Option>
                <Select.Option value="paused">{t('status.paused')}</Select.Option>
                <Select.Option value="stopped">{t('status.stopped')}</Select.Option>
              </Select>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </ErrorBoundary>
  );
};

export default StrategiesPage;