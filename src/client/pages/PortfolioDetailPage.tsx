/**
 * PortfolioDetailPage - 策略组合详情页面
 * 
 * 展示组合的详细信息、资金分配、再平衡、风险分析等
 */

import React, { useState, useMemo } from 'react';
import {
  Card,
  Grid,
  Typography,
  Space,
  Button,
  Statistic,
  Progress,
  Table,
  Tag,
  Spin,
  Empty,
  Modal,
  Alert,
} from '@arco-design/web-react';
import {
  IconPlayArrow,
  IconPause,
  IconRefresh,
  IconExperiment,
  IconSettings,
} from '@arco-design/web-react/icon';
import { useParams, useNavigate } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  Legend,
} from 'recharts';
import {
  usePortfolio,
  usePortfolioOperations,
  usePortfolioPerformance,
  usePortfolioRisk,
  usePortfolioRebalance,
} from '../hooks/useStrategyPortfolio';
import { createLogger } from '../../utils/logger';

const log = createLogger('PortfolioDetailPage');

const { Title, Text, Paragraph } = Typography;
const { Row, Col } = Grid;

// Color palette for charts
const COLORS = ['#165DFF', '#14C9C9', '#F7BA1E', '#722ED1', '#F53F3F', '#00B42A', '#EB0AA4', '#86909C'];

/**
 * PortfolioDetailPage Component
 */
const PortfolioDetailPage: React.FC = () => {
  const { portfolioId } = useParams<{ portfolioId: string }>();
  const navigate = useNavigate();

  const { portfolio, loading, error, refresh } = usePortfolio(portfolioId || null);
  const { performance, loading: _perfLoading, refresh: refreshPerformance } = usePortfolioPerformance(portfolioId || null);
  const { risk, loading: riskLoading, refresh: refreshRisk } = usePortfolioRisk(portfolioId || null);
  const { loading: opLoading, startPortfolio, _stopPortfolio, pausePortfolio } = usePortfolioOperations();
  const { previewRebalance, executeRebalance, loading: rebalanceLoading } = usePortfolioRebalance(portfolioId || null);

  const [rebalanceModalVisible, setRebalanceModalVisible] = useState(false);

  // Handle start/stop/pause
  const handleStart = async () => {
    try {
      await startPortfolio(portfolioId!);
      refresh();
    } catch (err) {
      log.error('Failed to start portfolio:', err);
    }
  };

  const handlePause = async () => {
    try {
      await pausePortfolio(portfolioId!);
      refresh();
    } catch (err) {
      log.error('Failed to pause portfolio:', err);
    }
  };

  // Preview rebalance
  const handlePreviewRebalance = async () => {
    try {
      await previewRebalance();
      setRebalanceModalVisible(true);
    } catch (err) {
      log.error('Failed to preview rebalance:', err);
    }
  };

  // Execute rebalance
  const handleExecuteRebalance = async () => {
    try {
      await executeRebalance('manual');
      setRebalanceModalVisible(false);
      refresh();
      refreshPerformance();
    } catch (err) {
      log.error('Failed to execute rebalance:', err);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size={40} />
      </div>
    );
  }

  // Error state
  if (error || !portfolio) {
    return (
      <Card>
        <Empty
          description={error || '组合不存在'}
          action={
            <Button onClick={() => navigate('/strategy-portfolio')}>
              返回列表
            </Button>
          }
        />
      </Card>
    );
  }

  // Prepare data for pie chart
  const pieData = useMemo(() => {
    if (!portfolio.strategies || portfolio.strategies.length === 0) {
      return [];
    }

    return portfolio.strategies.map((s, index) => ({
      name: s.strategyName || `策略 ${index + 1}`,
      value: s.weight * 100,
      allocation: s.allocation,
      currentValue: s.currentValue,
    }));
  }, [portfolio.strategies]);

  return (
    <div>
      {/* Header */}
      <Row justify="space-between" align="center" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <Title heading={4} style={{ margin: 0 }}>
              {portfolio.name}
            </Title>
            <Tag color={portfolio.status === 'active' ? 'green' : portfolio.status === 'paused' ? 'orange' : 'red'}>
              {portfolio.status === 'active' ? '运行中' : portfolio.status === 'paused' ? '已暂停' : '已停止'}
            </Tag>
          </Space>
          {portfolio.description && (
            <Paragraph type="secondary" style={{ margin: 0 }}>
              {portfolio.description}
            </Paragraph>
          )}
        </Col>
        <Col>
          <Space>
            <Button
              icon={<IconRefresh />}
              onClick={() => {
                refresh();
                refreshPerformance();
                refreshRisk();
              }}
              loading={loading}
            >
              刷新
            </Button>
            {portfolio.status === 'active' && (
              <Button
                icon={<IconPause />}
                onClick={handlePause}
                loading={opLoading}
              >
                暂停
              </Button>
            )}
            {portfolio.status === 'paused' && (
              <Button
                type="primary"
                icon={<IconPlayArrow />}
                onClick={handleStart}
                loading={opLoading}
              >
                启动
              </Button>
            )}
            <Button
              icon={<IconExperiment />}
              onClick={handlePreviewRebalance}
              loading={rebalanceLoading}
            >
              再平衡
            </Button>
            <Button
              icon={<IconSettings />}
              onClick={() => navigate(`/strategy-portfolio/${portfolioId}/settings`)}
            >
              设置
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Overview Stats */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总资金"
              value={portfolio.totalCapital}
              prefix="$"
              precision={2}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="当前价值"
              value={performance?.totalValue || portfolio.totalCapital}
              prefix="$"
              precision={2}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总收益"
              value={performance?.totalReturn || 0}
              prefix="$"
              precision={2}
              style={{
                value: {
                  color: (performance?.totalReturn || 0) >= 0
                    ? 'rgb(var(--success-6))'
                    : 'rgb(var(--danger-6))',
                },
              }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="收益率"
              value={performance?.totalReturnPct || 0}
              suffix="%"
              precision={2}
              style={{
                value: {
                  color: (performance?.totalReturnPct || 0) >= 0
                    ? 'rgb(var(--success-6))'
                    : 'rgb(var(--danger-6))',
                },
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* Allocation */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title="资金分配">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value.toFixed(2)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="暂无策略" />
            )}
          </Card>
        </Col>

        <Col span={12}>
          <Card title="风险分析">
            <Spin loading={riskLoading}>
              {risk ? (
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  <div>
                    <Text type="secondary">集中度风险</Text>
                    <Progress
                      percent={risk.concentrationRisk}
                      status={risk.concentrationRisk > 50 ? 'danger' : 'success'}
                    />
                  </div>
                  <div>
                    <Text type="secondary">最大策略权重</Text>
                    <Progress
                      percent={risk.maxStrategyWeight}
                      status={risk.maxStrategyWeight > 50 ? 'danger' : 'normal'}
                    />
                  </div>
                  <div>
                    <Text type="secondary">分散化得分</Text>
                    <Progress
                      percent={risk.diversificationScore}
                      status={risk.diversificationScore > 50 ? 'success' : 'warning'}
                    />
                  </div>
                </Space>
              ) : (
                <Empty description="暂无风险数据" />
              )}
            </Spin>
          </Card>
        </Col>
      </Row>

      {/* Strategies Table */}
      <Card title="策略列表">
        {portfolio.strategies && portfolio.strategies.length > 0 ? (
          <Table
            data={portfolio.strategies}
            rowKey="id"
            pagination={false}
          >
            <Table.Column title="策略名称" dataIndex="strategyName" key="name" />
            <Table.Column
              title="交易对"
              dataIndex="strategySymbol"
              key="symbol"
              render={(value: string) => <Tag>{value}</Tag>}
            />
            <Table.Column
              title="权重"
              dataIndex="weight"
              key="weight"
              render={(value: number) => `${(value * 100).toFixed(2)}%`}
            />
            <Table.Column
              title="分配资金"
              dataIndex="allocation"
              key="allocation"
              render={(value: number) => `$${value.toFixed(2)}`}
            />
            <Table.Column
              title="当前价值"
              dataIndex="currentValue"
              key="currentValue"
              render={(value: number | undefined) =>
                value ? `$${value.toFixed(2)}` : '-'
              }
            />
            <Table.Column
              title="收益率"
              dataIndex="returnPct"
              key="returnPct"
              render={(value: number | undefined) =>
                value !== undefined ? (
                  <Text style={{ color: value >= 0 ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))' }}>
                    {value >= 0 ? '+' : ''}{value.toFixed(2)}%
                  </Text>
                ) : '-'
              }
            />
          </Table>
        ) : (
          <Empty description="暂无策略" />
        )}
      </Card>

      {/* Rebalance Modal */}
      <Modal
        title="组合再平衡"
        visible={rebalanceModalVisible}
        onCancel={() => setRebalanceModalVisible(false)}
        onOk={handleExecuteRebalance}
        okText="执行再平衡"
        cancelText="取消"
        confirmLoading={rebalanceLoading}
      >
        <Alert
          type="info"
          content="再平衡将根据当前配置的权重重新分配资金到各个策略"
        />
      </Modal>
    </div>
  );
};

export default PortfolioDetailPage;