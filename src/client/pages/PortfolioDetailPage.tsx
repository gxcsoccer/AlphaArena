/**
 * PortfolioDetailPage - 策略组合详情页面
 * 
 * 展示组合的详细信息、资金分配、再平衡、风险分析等
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Grid,
  Typography,
  Space,
  Button,
  Tabs,
  Statistic,
  Progress,
  Table,
  Tag,
  Message,
  Spin,
  Empty,
  Divider,
  Modal,
  Alert,
  Row,
  Col,
} from '@arco-design/web-react';
import {
  IconPlayArrow,
  IconPause,
  IconStop,
  IconRefresh,
  IconExperiment,
  IconSettings,
  IconTrendingUp,
  IconTrendingDown,
  IconInfoCircle,
  IconExclamationCircle,
} from '@arco-design/web-react/icon';
import { useParams, useNavigate } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import {
  usePortfolio,
  usePortfolioOperations,
  usePortfolioPerformance,
  usePortfolioRisk,
  usePortfolioRebalance,
  usePortfolioStrategies,
  StrategyPortfolio,
  RebalancePreview,
} from '../hooks/useStrategyPortfolio';
import { createLogger } from '../../utils/logger';

const log = createLogger('PortfolioDetailPage');

const { Title, Text, Paragraph } = Typography;
const { Row: GridRow, Col: GridCol } = Grid;

// Color palette for charts
const COLORS = ['#165DFF', '#14C9C9', '#F7BA1E', '#722ED1', '#F53F3F', '#00B42A', '#EB0AA4', '#86909C'];

/**
 * PortfolioDetailPage Component
 */
const PortfolioDetailPage: React.FC = () => {
  const { portfolioId } = useParams<{ portfolioId: string }>();
  const navigate = useNavigate();

  const { portfolio, loading, error, refresh } = usePortfolio(portfolioId || null);
  const { performance, loading: perfLoading, refresh: refreshPerformance } = usePortfolioPerformance(portfolioId || null);
  const { risk, loading: riskLoading, refresh: refreshRisk } = usePortfolioRisk(portfolioId || null);
  const { loading: opLoading, startPortfolio, stopPortfolio, pausePortfolio } = usePortfolioOperations();
  const { previewRebalance, executeRebalance, loading: rebalanceLoading } = usePortfolioRebalance(portfolioId || null);

  const [rebalancePreview, setRebalancePreview] = useState<RebalancePreview | null>(null);
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

  const handleStop = async () => {
    try {
      await stopPortfolio(portfolioId!);
      refresh();
    } catch (err) {
      log.error('Failed to stop portfolio:', err);
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
      const preview = await previewRebalance();
      setRebalancePreview(preview);
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

  return (
    <div>
      {/* Header */}
      <GridRow justify="space-between" align="center" style={{ marginBottom: 16 }}>
        <GridCol>
          <Space>
            <Title heading={4} style={{ margin: 0 }}>
              {portfolio.name}
            </Title>
            <PortfolioStatusBadge status={portfolio.status} />
          </Space>
          {portfolio.description && (
            <Paragraph type="secondary" style={{ margin: 0 }}>
              {portfolio.description}
            </Paragraph>
          )}
        </GridCol>
        <GridCol>
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
            {portfolio.status === 'stopped' && (
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
        </GridCol>
      </GridRow>

      {/* Overview Stats */}
      <GridRow gutter={16} style={{ marginBottom: 16 }}>
        <GridCol span={6}>
          <Card>
            <Statistic
              title="总资金"
              value={portfolio.totalCapital}
              prefix="$"
              precision={2}
            />
          </Card>
        </GridCol>
        <GridCol span={6}>
          <Card>
            <Statistic
              title="当前价值"
              value={performance?.totalValue || portfolio.totalCapital}
              prefix="$"
              precision={2}
            />
          </Card>
        </GridCol>
        <GridCol span={6}>
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
        </GridCol>
        <GridCol span={6}>
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
        </GridCol>
      </GridRow>

      {/* Main Content */}
      <Tabs defaultActiveTab="overview">
        <Tabs.TabPane key="overview" title="概览">
          <OverviewTab
            portfolio={portfolio}
            performance={performance}
            perfLoading={perfLoading}
          />
        </Tabs.TabPane>

        <Tabs.TabPane key="allocation" title="资金分配">
          <AllocationTab
            portfolio={portfolio}
            performance={performance}
          />
        </Tabs.TabPane>

        <Tabs.TabPane key="performance" title="绩效分析">
          <PerformanceTab
            portfolioId={portfolioId!}
            performance={performance}
            loading={perfLoading}
          />
        </Tabs.TabPane>

        <Tabs.TabPane key="risk" title="风险分析">
          <RiskTab
            risk={risk}
            loading={riskLoading}
          />
        </Tabs.TabPane>

        <Tabs.TabPane key="strategies" title="策略管理">
          <StrategiesTab
            portfolio={portfolio}
            portfolioId={portfolioId!}
            onRefresh={refresh}
          />
        </Tabs.TabPane>
      </Tabs>

      {/* Rebalance Modal */}
      <Modal
        title="组合再平衡"
        visible={rebalanceModalVisible}
        onCancel={() => setRebalanceModalVisible(false)}
        onOk={handleExecuteRebalance}
        okText="执行再平衡"
        cancelText="取消"
        confirmLoading={rebalanceLoading}
        width={800}
      >
        {rebalancePreview && (
          <RebalancePreviewContent preview={rebalancePreview} />
        )}
      </Modal>
    </div>
  );
};

/**
 * Portfolio Status Badge
 */
const PortfolioStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config: Record<string, { color: string; text: string }> = {
    active: { color: 'green', text: '运行中' },
    paused: { color: 'orange', text: '已暂停' },
    stopped: { color: 'red', text: '已停止' },
  };

  const { color, text } = config[status] || { color: 'gray', text: status };

  return <Tag color={color}>{text}</Tag>;
};

/**
 * Overview Tab
 */
const OverviewTab: React.FC<{
  portfolio: StrategyPortfolio;
  performance: any;
  perfLoading: boolean;
}> = ({ portfolio, performance, perfLoading }) => {
  return (
    <GridRow gutter={16}>
      <GridCol span={16}>
        <Card title="绩效概览">
          <Spin loading={perfLoading}>
            {performance ? (
              <GridRow gutter={16}>
                <GridCol span={24}>
                  <Progress
                    percent={Math.abs(performance.totalReturnPct || 0)}
                    text={`收益率: ${(performance.totalReturnPct || 0).toFixed(2)}%`}
                    status={(performance.totalReturnPct || 0) >= 0 ? 'success' : 'danger'}
                    style={{ marginBottom: 16 }}
                  />
                </GridCol>
                {performance.strategies && performance.strategies.length > 0 && (
                  <GridCol span={24}>
                    <Table
                      data={performance.strategies}
                      rowKey="strategyId"
                      pagination={false}
                      size="small"
                    >
                      <Table.Column title="策略" dataIndex="name" key="name" />
                      <Table.Column
                        title="收益率"
                        dataIndex="returnPct"
                        key="returnPct"
                        render={(value: number) => (
                          <Text style={{ color: value >= 0 ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))' }}>
                            {value >= 0 ? '+' : ''}{value.toFixed(2)}%
                          </Text>
                        )}
                      />
                      <Table.Column
                        title="贡献"
                        dataIndex="contribution"
                        key="contribution"
                        render={(value: number) => (
                          <Text>${value.toFixed(2)}</Text>
                        )}
                      />
                    </Table>
                  </GridCol>
                )}
              </GridRow>
            ) : (
              <Empty description="暂无绩效数据" />
            )}
          </Spin>
        </Card>
      </GridCol>

      <GridCol span={8}>
        <Card title="组合信息">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text type="secondary">分配方式：</Text>
              <Tag color="blue">
                {portfolio.allocationMethod === 'equal' ? '等权重' : 
                 portfolio.allocationMethod === 'custom' ? '自定义' : '风险平价'}
              </Tag>
            </div>
            <div>
              <Text type="secondary">策略数量：</Text>
              <Text strong>{portfolio.strategies?.length || 0}</Text>
            </div>
            <Divider style={{ margin: '8px 0' }} />
            <div>
              <Text type="secondary">再平衡：</Text>
              {portfolio.rebalanceConfig.enabled ? (
                <Tag color="green">
                  {portfolio.rebalanceConfig.frequency === 'threshold'
                    ? `阈值 ${portfolio.rebalanceConfig.threshold}%`
                    : portfolio.rebalanceConfig.frequency}
                </Tag>
              ) : (
                <Tag color="gray">未启用</Tag>
              )}
            </div>
            {portfolio.rebalanceConfig.lastRebalanced && (
              <div>
                <Text type="secondary">上次再平衡：</Text>
                <Text>{new Date(portfolio.rebalanceConfig.lastRebalanced).toLocaleString()}</Text>
              </div>
            )}
            <Divider style={{ margin: '8px 0' }} />
            <div>
              <Text type="secondary">创建时间：</Text>
              <Text>{new Date(portfolio.createdAt).toLocaleString()}</Text>
            </div>
          </Space>
        </Card>
      </GridCol>
    </GridRow>
  );
};

/**
 * Allocation Tab
 */
const AllocationTab: React.FC<{
  portfolio: StrategyPortfolio;
  performance: any;
}> = ({ portfolio, performance }) => {
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
    <GridRow gutter={16}>
      <GridCol span={12}>
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
      </GridCol>

      <GridCol span={12}>
        <Card title="分配详情">
          {portfolio.strategies && portfolio.strategies.length > 0 ? (
            <Table
              data={portfolio.strategies}
              rowKey="id"
              pagination={false}
            >
              <Table.Column title="策略" dataIndex="strategyName" key="name" />
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
            </Table>
          ) : (
            <Empty description="暂无策略" />
          )}
        </Card>
      </GridCol>
    </GridRow>
  );
};

/**
 * Performance Tab
 */
const PerformanceTab: React.FC<{
  portfolioId: string;
  performance: any;
  loading: boolean;
}> = ({ portfolioId, performance, loading }) => {
  return (
    <Card title="绩效分析">
      <Spin loading={loading}>
        {performance ? (
          <GridRow gutter={16}>
            <GridCol span={24}>
              <Alert
                type="info"
                content="绩效数据基于当前持仓计算，历史绩效数据即将上线"
                style={{ marginBottom: 16 }}
              />
            </GridCol>

            {/* Strategy Performance */}
            {performance.strategies && performance.strategies.length > 0 && (
              <GridCol span={24}>
                <Card title="策略绩效对比" style={{ marginBottom: 16 }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={performance.strategies}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <ChartTooltip />
                      <Bar dataKey="returnPct" fill="#165DFF" name="收益率 (%)" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </GridCol>
            )}

            {/* Diversification */}
            {performance.diversificationRatio && (
              <GridCol span={12}>
                <Card title="分散化指标">
                  <Statistic
                    title="分散化比率"
                    value={performance.diversificationRatio}
                    suffix="%"
                    precision={2}
                  />
                </Card>
              </GridCol>
            )}
          </GridRow>
        ) : (
          <Empty description="暂无绩效数据" />
        )}
      </Spin>
    </Card>
  );
};

/**
 * Risk Tab
 */
const RiskTab: React.FC<{
  risk: any;
  loading: boolean;
}> = ({ risk, loading }) => {
  return (
    <Card title="风险分析">
      <Spin loading={loading}>
        {risk ? (
          <GridRow gutter={16}>
            <GridCol span={8}>
              <Card>
                <Statistic
                  title="集中度风险"
                  value={risk.concentrationRisk}
                  suffix="%"
                  precision={2}
                />
                <Progress
                  percent={risk.concentrationRisk}
                  status={risk.concentrationRisk > 50 ? 'danger' : 'success'}
                  style={{ marginTop: 8 }}
                />
              </Card>
            </GridCol>

            <GridCol span={8}>
              <Card>
                <Statistic
                  title="最大策略权重"
                  value={risk.maxStrategyWeight}
                  suffix="%"
                  precision={2}
                />
                <Progress
                  percent={risk.maxStrategyWeight}
                  status={risk.maxStrategyWeight > 50 ? 'danger' : 'normal'}
                  style={{ marginTop: 8 }}
                />
              </Card>
            </GridCol>

            <GridCol span={8}>
              <Card>
                <Statistic
                  title="分散化得分"
                  value={risk.diversificationScore}
                  suffix="/ 100"
                  precision={2}
                />
                <Progress
                  percent={risk.diversificationScore}
                  status={risk.diversificationScore > 50 ? 'success' : 'warning'}
                  style={{ marginTop: 8 }}
                />
              </Card>
            </GridCol>

            <GridCol span={24}>
              <Alert
                type="info"
                content={
                  <div>
                    <Text strong>风险指标说明：</Text>
                    <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                      <li>集中度风险：衡量组合资金集中程度，越低越好（0% = 完全分散）</li>
                      <li>最大策略权重：单一策略占比，建议不超过 50%</li>
                      <li>分散化得分：综合分散度评分，越高越好（100% = 完美分散）</li>
                    </ul>
                  </div>
                }
              />
            </GridCol>
          </GridRow>
        ) : (
          <Empty description="暂无风险数据" />
        )}
      </Spin>
    </Card>
  );
};

/**
 * Strategies Tab
 */
const StrategiesTab: React.FC<{
  portfolio: StrategyPortfolio;
  portfolioId: string;
  onRefresh: () => void;
}> = ({ portfolio, portfolioId, onRefresh }) => {
  const { addStrategy, removeStrategy, updateWeight, loading } = usePortfolioStrategies(portfolioId);
  const [addModalVisible, setAddModalVisible] = useState(false);

  const handleRemoveStrategy = async (strategyId: string) => {
    try {
      await removeStrategy(strategyId);
      onRefresh();
    } catch (err) {
      log.error('Failed to remove strategy:', err);
    }
  };

  return (
    <Card title="策略管理">
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
          <Table.Column
            title="状态"
            dataIndex="status"
            key="status"
            render={(status: string) => {
              const colorMap: Record<string, string> = {
                running: 'green',
                paused: 'orange',
                stopped: 'red',
              };
              const textMap: Record<string, string> = {
                running: '运行中',
                paused: '已暂停',
                stopped: '已停止',
              };
              return <Tag color={colorMap[status]}>{textMap[status]}</Tag>;
            }}
          />
          <Table.Column
            title="操作"
            key="actions"
            render={(_, record: any) => (
              <Button
                type="text"
                size="small"
                icon={<IconExclamationCircle />}
                onClick={() => handleRemoveStrategy(record.strategyId)}
                loading={loading}
                status="danger"
              >
                移除
              </Button>
            )}
          />
        </Table>
      ) : (
        <Empty description="暂无策略" />
      )}
    </Card>
  );
};

/**
 * Rebalance Preview Content
 */
const RebalancePreviewContent: React.FC<{ preview: RebalancePreview }> = ({ preview }) => {
  return (
    <div>
      {preview.needsRebalance ? (
        <>
          <Alert
            type="warning"
            content={preview.reason}
            style={{ marginBottom: 16 }}
          />

          <Card title="调整建议" size="small">
            <Table
              data={preview.adjustments}
              rowKey="strategyId"
              pagination={false}
              size="small"
            >
              <Table.Column title="策略" dataIndex="strategyId" key="id" />
              <Table.Column
                title="当前分配"
                dataIndex="currentAllocation"
                key="current"
                render={(value: number) => `$${value.toFixed(2)}`}
              />
              <Table.Column
                title="目标分配"
                dataIndex="targetAllocation"
                key="target"
                render={(value: number) => `$${value.toFixed(2)}`}
              />
              <Table.Column
                title="调整"
                dataIndex="action"
                key="action"
                render={(action: string, record: any) => {
                  const colorMap: Record<string, string> = {
                    increase: 'green',
                    decrease: 'red',
                    none: 'gray',
                  };
                  const textMap: Record<string, string> = {
                    increase: `+ $${record.amount.toFixed(2)}`,
                    decrease: `- $${record.amount.toFixed(2)}`,
                    none: '无变化',
                  };
                  return (
                    <Tag color={colorMap[action]}>
                      {textMap[action]}
                    </Tag>
                  );
                }}
              />
            </Table>
          </Card>

          <Card title="预估影响" size="small" style={{ marginTop: 16 }}>
            <GridRow gutter={16}>
              <GridCol span={8}>
                <Statistic
                  title="交易次数"
                  value={preview.estimatedImpact.totalTrades}
                />
              </GridCol>
              <GridCol span={8}>
                <Statistic
                  title="交易总量"
                  value={preview.estimatedImpact.totalVolume}
                  prefix="$"
                  precision={2}
                />
              </GridCol>
              <GridCol span={8}>
                <Statistic
                  title="预估手续费"
                  value={preview.estimatedImpact.estimatedFees}
                  prefix="$"
                  precision={2}
                />
              </GridCol>
            </GridRow>
          </Card>
        </>
      ) : (
        <Alert
          type="success"
          content={preview.reason}
        />
      )}
    </div>
  );
};

export default PortfolioDetailPage;