/**
 * StrategyPortfolioPage - 策略组合管理页面
 * 
 * 主页面，展示用户的所有策略组合，支持创建、编辑、删除等操作
 */

import React, { useState, useCallback } from 'react';
import {
  Card,
  Grid,
  Typography,
  Space,
  Button,
  Table,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Message,
  Spin,
  Empty,
  Statistic,
  Progress,
  Drawer,
  Divider,
  Popconfirm,
  Tooltip,
  Badge,
} from '@arco-design/web-react';
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconPlayArrow,
  IconPause,
  IconStop,
  IconRefresh,
  IconTrendingUp,
  IconTrendingDown,
  IconSettings,
  IconEye,
  IconExperiment,
  IconInfoCircle,
} from '@arco-design/web-react/icon';
import { useNavigate } from 'react-router-dom';
import {
  usePortfolios,
  usePortfolioOperations,
  StrategyPortfolio,
  CreatePortfolioInput,
  AllocationMethod,
} from '../hooks/useStrategyPortfolio';
import { useStrategies } from '../hooks/useData';
import { createLogger } from '../../utils/logger';
import PortfolioCreateForm from '../components/PortfolioCreateForm';

const log = createLogger('StrategyPortfolioPage');

const { Title, Text, Paragraph } = Typography;
const { Row, Col } = Grid;
const FormItem = Form.Item;

/**
 * Portfolio status badge
 */
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
    active: { color: 'green', text: '运行中', icon: <IconPlayArrow /> },
    paused: { color: 'orange', text: '已暂停', icon: <IconPause /> },
    stopped: { color: 'red', text: '已停止', icon: <IconStop /> },
  };

  const { color, text } = config[status] || { color: 'gray', text: status };

  return <Tag color={color}>{text}</Tag>;
};

/**
 * Allocation method display
 */
const AllocationMethodTag: React.FC<{ method: AllocationMethod }> = ({ method }) => {
  const config: Record<AllocationMethod, { color: string; text: string }> = {
    equal: { color: 'blue', text: '等权重' },
    custom: { color: 'purple', text: '自定义' },
    risk_parity: { color: 'cyan', text: '风险平价' },
  };

  const { color, text } = config[method];

  return <Tag color={color}>{text}</Tag>;
};

/**
 * StrategyPortfolioPage Component
 */
const StrategyPortfolioPage: React.FC = () => {
  const navigate = useNavigate();
  const { portfolios, loading, error, refresh } = usePortfolios();
  const { strategies } = useStrategies();
  const {
    loading: operationLoading,
    deletePortfolio,
    startPortfolio,
    stopPortfolio,
    pausePortfolio,
  } = usePortfolioOperations();

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedPortfolio, setSelectedPortfolio] = useState<StrategyPortfolio | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);

  // Handle create portfolio
  const handleCreateSuccess = useCallback(() => {
    setCreateModalVisible(false);
    refresh();
  }, [refresh]);

  // Handle view details
  const handleViewDetails = useCallback((portfolio: StrategyPortfolio) => {
    setSelectedPortfolio(portfolio);
    setDetailDrawerVisible(true);
  }, []);

  // Handle edit
  const handleEdit = useCallback((portfolio: StrategyPortfolio) => {
    navigate(`/strategy-portfolio/${portfolio.id}`);
  }, [navigate]);

  // Handle delete
  const handleDelete = useCallback(async (portfolioId: string) => {
    try {
      await deletePortfolio(portfolioId);
      refresh();
    } catch (err) {
      log.error('Failed to delete portfolio:', err);
    }
  }, [deletePortfolio, refresh]);

  // Handle start
  const handleStart = useCallback(async (portfolioId: string) => {
    try {
      await startPortfolio(portfolioId);
      refresh();
    } catch (err) {
      log.error('Failed to start portfolio:', err);
    }
  }, [startPortfolio, refresh]);

  // Handle stop
  const handleStop = useCallback(async (portfolioId: string) => {
    try {
      await stopPortfolio(portfolioId);
      refresh();
    } catch (err) {
      log.error('Failed to stop portfolio:', err);
    }
  }, [stopPortfolio, refresh]);

  // Handle pause
  const handlePause = useCallback(async (portfolioId: string) => {
    try {
      await pausePortfolio(portfolioId);
      refresh();
    } catch (err) {
      log.error('Failed to pause portfolio:', err);
    }
  }, [pausePortfolio, refresh]);

  // Table columns
  const columns = [
    {
      title: '组合名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string, record: StrategyPortfolio) => (
        <Space>
          <Text strong>{name}</Text>
          {record.description && (
            <Tooltip content={record.description}>
              <IconInfoCircle style={{ color: 'var(--color-text-3)' }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <StatusBadge status={status} />,
    },
    {
      title: '总资金',
      dataIndex: 'totalCapital',
      key: 'totalCapital',
      width: 150,
      render: (value: number) => (
        <Text>${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
      ),
    },
    {
      title: '当前价值',
      dataIndex: 'totalValue',
      key: 'totalValue',
      width: 150,
      render: (value: number | undefined, record: StrategyPortfolio) => {
        if (value === undefined) return <Text type="secondary">-</Text>;
        const totalCapital = record.totalCapital;
        const returnPct = record.totalReturnPct || 0;
        const isPositive = returnPct >= 0;
        
        return (
          <Space direction="vertical" size={0}>
            <Text>${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            <Text style={{ color: isPositive ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))', fontSize: 12 }}>
              {isPositive ? '+' : ''}{returnPct.toFixed(2)}%
            </Text>
          </Space>
        );
      },
    },
    {
      title: '策略数量',
      dataIndex: 'strategies',
      key: 'strategyCount',
      width: 100,
      render: (strategies: any[] | undefined) => (
        <Badge count={strategies?.length || 0} style={{ backgroundColor: 'rgb(var(--primary-6))' }} />
      ),
    },
    {
      title: '分配方式',
      dataIndex: 'allocationMethod',
      key: 'allocationMethod',
      width: 120,
      render: (method: AllocationMethod) => <AllocationMethodTag method={method} />,
    },
    {
      title: '再平衡',
      dataIndex: 'rebalanceConfig',
      key: 'rebalance',
      width: 150,
      render: (config: any) => {
        if (!config?.enabled) {
          return <Tag color="gray">未启用</Tag>;
        }
        const frequencyMap: Record<string, string> = {
          daily: '每日',
          weekly: '每周',
          monthly: '每月',
          threshold: `阈值 ${config.threshold}%`,
        };
        return (
          <Space direction="vertical" size={0}>
            <Tag color="blue">{frequencyMap[config.frequency] || config.frequency}</Tag>
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      fixed: 'right' as const,
      render: (_: any, record: StrategyPortfolio) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<IconEye />}
            onClick={() => handleViewDetails(record)}
          >
            查看
          </Button>
          <Button
            type="text"
            size="small"
            icon={<IconSettings />}
            onClick={() => handleEdit(record)}
          >
            管理
          </Button>
          {record.status === 'active' && (
            <Button
              type="text"
              size="small"
              icon={<IconPause />}
              onClick={() => handlePause(record.id)}
              loading={operationLoading}
            >
              暂停
            </Button>
          )}
          {record.status === 'paused' && (
            <Button
              type="text"
              size="small"
              icon={<IconPlayArrow />}
              onClick={() => handleStart(record.id)}
              loading={operationLoading}
            >
              启动
            </Button>
          )}
          {record.status === 'stopped' && (
            <Button
              type="text"
              size="small"
              icon={<IconPlayArrow />}
              onClick={() => handleStart(record.id)}
              loading={operationLoading}
            >
              启动
            </Button>
          )}
          <Popconfirm
            title="确认删除"
            content="删除后无法恢复，确定要删除这个策略组合吗？"
            onOk={() => handleDelete(record.id)}
          >
            <Button
              type="text"
              size="small"
              icon={<IconDelete />}
              status="danger"
              loading={operationLoading}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <Row justify="space-between" align="center" style={{ marginBottom: 16 }}>
        <Col>
          <Title heading={4} style={{ margin: 0 }}>
            策略组合管理
          </Title>
          <Text type="secondary">
            管理多个策略的组合，优化资金分配和风险控制
          </Text>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<IconRefresh />}
              onClick={refresh}
              loading={loading}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<IconPlus />}
              onClick={() => setCreateModalVisible(true)}
            >
              创建组合
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="组合总数"
              value={portfolios.length}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="运行中"
              value={portfolios.filter(p => p.status === 'active').length}
              suffix="个"
              style={{ value: { color: 'rgb(var(--success-6))' } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总资金"
              value={portfolios.reduce((sum, p) => sum + p.totalCapital, 0)}
              prefix="$"
              precision={2}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总收益"
              value={portfolios.reduce((sum, p) => sum + (p.totalReturn || 0), 0)}
              prefix="$"
              precision={2}
              style={{
                value: {
                  color: portfolios.reduce((sum, p) => sum + (p.totalReturn || 0), 0) >= 0
                    ? 'rgb(var(--success-6))'
                    : 'rgb(var(--danger-6))',
                },
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* Portfolio List */}
      <Card>
        <Spin loading={loading} style={{ display: 'block' }}>
          {portfolios.length === 0 && !loading ? (
            <Empty
              description="暂无策略组合"
              action={
                <Button
                  type="primary"
                  icon={<IconPlus />}
                  onClick={() => setCreateModalVisible(true)}
                >
                  创建第一个组合
                </Button>
              }
            />
          ) : (
            <Table
              columns={columns}
              data={portfolios}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showTotal: true,
                showJumper: true,
              }}
              scroll={{ x: 1300 }}
            />
          )}
        </Spin>
      </Card>

      {/* Create Modal */}
      <Modal
        title="创建策略组合"
        visible={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        <PortfolioCreateForm
          strategies={strategies || []}
          onSuccess={handleCreateSuccess}
          onCancel={() => setCreateModalVisible(false)}
        />
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title="组合详情"
        visible={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setSelectedPortfolio(null);
        }}
        width={600}
      >
        {selectedPortfolio && (
          <PortfolioDetailDrawer portfolio={selectedPortfolio} />
        )}
      </Drawer>
    </div>
  );
};

/**
 * Portfolio Detail Drawer Component
 */
const PortfolioDetailDrawer: React.FC<{ portfolio: StrategyPortfolio }> = ({ portfolio }) => {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Basic Info */}
      <Card title="基本信息" size="small">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Row>
            <Col span={12}>
              <Text type="secondary">名称：</Text>
              <Text strong>{portfolio.name}</Text>
            </Col>
            <Col span={12}>
              <Text type="secondary">状态：</Text>
              <StatusBadge status={portfolio.status} />
            </Col>
          </Row>
          {portfolio.description && (
            <div>
              <Text type="secondary">描述：</Text>
              <Text>{portfolio.description}</Text>
            </div>
          )}
          <Row>
            <Col span={12}>
              <Text type="secondary">分配方式：</Text>
              <AllocationMethodTag method={portfolio.allocationMethod} />
            </Col>
            <Col span={12}>
              <Text type="secondary">创建时间：</Text>
              <Text>{new Date(portfolio.createdAt).toLocaleString()}</Text>
            </Col>
          </Row>
        </Space>
      </Card>

      {/* Performance */}
      <Card title="绩效" size="small">
        <Row gutter={16}>
          <Col span={8}>
            <Statistic
              title="总资金"
              value={portfolio.totalCapital}
              prefix="$"
              precision={2}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="当前价值"
              value={portfolio.totalValue || portfolio.totalCapital}
              prefix="$"
              precision={2}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="总收益"
              value={portfolio.totalReturn || 0}
              prefix="$"
              precision={2}
              style={{
                value: {
                  color: (portfolio.totalReturn || 0) >= 0
                    ? 'rgb(var(--success-6))'
                    : 'rgb(var(--danger-6))',
                },
              }}
            />
          </Col>
        </Row>
        <Divider style={{ margin: '16px 0' }} />
        <Progress
          percent={Math.abs(portfolio.totalReturnPct || 0)}
          text={`收益率: ${(portfolio.totalReturnPct || 0).toFixed(2)}%`}
          status={(portfolio.totalReturnPct || 0) >= 0 ? 'success' : 'danger'}
        />
      </Card>

      {/* Strategies */}
      <Card title="策略列表" size="small">
        {portfolio.strategies && portfolio.strategies.length > 0 ? (
          <Table
            data={portfolio.strategies}
            rowKey="id"
            pagination={false}
            size="small"
            columns={[
              {
                title: '策略',
                dataIndex: 'strategyName',
                key: 'name',
                render: (name: string) => <Text strong>{name}</Text>,
              },
              {
                title: '权重',
                dataIndex: 'weight',
                key: 'weight',
                render: (weight: number) => `${(weight * 100).toFixed(2)}%`,
              },
              {
                title: '分配资金',
                dataIndex: 'allocation',
                key: 'allocation',
                render: (value: number) => `$${value.toFixed(2)}`,
              },
              {
                title: '当前价值',
                dataIndex: 'currentValue',
                key: 'currentValue',
                render: (value: number | undefined) => value ? `$${value.toFixed(2)}` : '-',
              },
            ]}
          />
        ) : (
          <Empty description="暂无策略" />
        )}
      </Card>

      {/* Rebalance Config */}
      <Card title="再平衡配置" size="small">
        {portfolio.rebalanceConfig.enabled ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Row>
              <Col span={12}>
                <Text type="secondary">触发条件：</Text>
                <Text>
                  {portfolio.rebalanceConfig.frequency === 'threshold'
                    ? `偏离阈值 ${portfolio.rebalanceConfig.threshold}%`
                    : portfolio.rebalanceConfig.frequency === 'daily'
                    ? '每日'
                    : portfolio.rebalanceConfig.frequency === 'weekly'
                    ? '每周'
                    : '每月'}
                </Text>
              </Col>
              {portfolio.rebalanceConfig.lastRebalanced && (
                <Col span={12}>
                  <Text type="secondary">上次再平衡：</Text>
                  <Text>{new Date(portfolio.rebalanceConfig.lastRebalanced).toLocaleString()}</Text>
                </Col>
              )}
            </Row>
          </Space>
        ) : (
          <Text type="secondary">未启用自动再平衡</Text>
        )}
      </Card>
    </Space>
  );
};

export default StrategyPortfolioPage;