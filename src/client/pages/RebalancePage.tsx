/**
 * Portfolio Rebalancing Page
 * UI for managing target allocations and executing rebalancing
 */

import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Tag,
  Grid,
  Progress,
  Spin,
  Empty,
  Message,
  Divider,
  Switch,
  Tabs,
  Descriptions,
  Alert,
  Popconfirm,
} from '@arco-design/web-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ErrorBoundary } from '../components/ErrorBoundary';

const { Row, Col } = Grid;
const { Title, Text } = Typography;
const { Option } = Select;
const TabPane = Tabs.TabPane;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6B6B'];

// Types
interface AssetAllocation {
  symbol: string;
  targetWeight: number;
  tolerance?: number;
}

interface TargetAllocation {
  id: string;
  name: string;
  description?: string;
  allocations: AssetAllocation[];
  totalWeight: number;
  createdAt: string;
  updatedAt: string;
}

interface RebalancePlan {
  id: string;
  name: string;
  description?: string;
  targetAllocationId: string;
  targetAllocation: TargetAllocation;
  trigger: 'scheduled' | 'threshold' | 'manual';
  threshold?: number;
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PositionState {
  symbol: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  currentWeight: number;
  targetWeight: number;
  deviation: number;
  deviationPercent: number;
}

interface RebalanceAdjustment {
  symbol: string;
  action: 'buy' | 'sell' | 'none';
  quantity: number;
  currentQuantity: number;
  targetQuantity: number;
  estimatedPrice: number;
  estimatedValue: number;
  estimatedFee: number;
  priority: number;
}

interface RebalancePreview {
  planId: string;
  portfolioValue: number;
  positions: PositionState[];
  adjustments: RebalanceAdjustment[];
  totalEstimatedCost: number;
  totalEstimatedFees: number;
  estimatedSlippage: number;
  executionStrategy: string;
  warnings: string[];
  timestamp: string;
}

interface RebalanceExecution {
  id: string;
  planId: string;
  status: string;
  trigger: string;
  startedAt: string;
  completedAt?: string;
  totalActualCost: number;
  totalFees: number;
  metrics: {
    totalOrders: number;
    successfulOrders: number;
    failedOrders: number;
  };
}

// API helper
const api = {
  async getAllocations(): Promise<TargetAllocation[]> {
    const response = await fetch('/api/rebalance/allocations', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  },

  async createAllocation(allocation: Omit<TargetAllocation, 'id' | 'createdAt' | 'updatedAt'>): Promise<TargetAllocation> {
    const response = await fetch('/api/rebalance/allocations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(allocation),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  },

  async updateAllocation(id: string, updates: Partial<TargetAllocation>): Promise<TargetAllocation> {
    const response = await fetch(`/api/rebalance/allocations/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(updates),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  },

  async deleteAllocation(id: string): Promise<void> {
    const response = await fetch(`/api/rebalance/allocations/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
  },

  async getPlans(activeOnly?: boolean): Promise<RebalancePlan[]> {
    const url = activeOnly ? '/api/rebalance/plans?activeOnly=true' : '/api/rebalance/plans';
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  },

  async createPlan(plan: Omit<RebalancePlan, 'id' | 'createdAt' | 'updatedAt' | 'targetAllocation'>): Promise<RebalancePlan> {
    const response = await fetch('/api/rebalance/plans', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(plan),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  },

  async updatePlan(id: string, updates: Partial<RebalancePlan>): Promise<RebalancePlan> {
    const response = await fetch(`/api/rebalance/plans/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(updates),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  },

  async deletePlan(id: string): Promise<void> {
    const response = await fetch(`/api/rebalance/plans/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
  },

  async previewRebalance(planId: string, positions: any[], portfolioValue: number): Promise<RebalancePreview> {
    const response = await fetch('/api/rebalance/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ planId, positions, portfolioValue }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  },

  async executeRebalance(planId: string): Promise<{ executionId: string }> {
    const response = await fetch('/api/rebalance/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ planId }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  },

  async getHistory(planId: string): Promise<RebalanceExecution[]> {
    const response = await fetch(`/api/rebalance/history?planId=${planId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  },
};

// Allocation Editor Component
const AllocationEditor: React.FC<{
  allocations: AssetAllocation[];
  onChange: (allocations: AssetAllocation[]) => void;
}> = ({ allocations, onChange }) => {
  const [newSymbol, setNewSymbol] = useState('');
  const [newWeight, setNewWeight] = useState(0);

  const totalWeight = allocations.reduce((sum, a) => sum + a.targetWeight, 0);

  const addAllocation = () => {
    if (!newSymbol || newWeight <= 0) {
      Message.warning('请输入有效的代币和权重');
      return;
    }
    if (allocations.find(a => a.symbol.toUpperCase() === newSymbol.toUpperCase())) {
      Message.warning('该代币已存在');
      return;
    }
    onChange([...allocations, { symbol: newSymbol.toUpperCase(), targetWeight: newWeight }]);
    setNewSymbol('');
    setNewWeight(0);
  };

  const updateWeight = (symbol: string, weight: number) => {
    onChange(allocations.map(a => 
      a.symbol === symbol ? { ...a, targetWeight: weight } : a
    ));
  };

  const removeAllocation = (symbol: string) => {
    onChange(allocations.filter(a => a.symbol !== symbol));
  };

  const pieData = allocations.map((a, i) => ({
    name: a.symbol,
    value: a.targetWeight,
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card title="配置比例" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              {allocations.map((a, i) => (
                <Row key={a.symbol} gutter={8} align="center">
                  <Col span={6}>
                    <Tag color={COLORS[i % COLORS.length]}>{a.symbol}</Tag>
                  </Col>
                  <Col span={14}>
                    <InputNumber
                      value={a.targetWeight}
                      onChange={(v) => updateWeight(a.symbol, v as number)}
                      min={0}
                      max={100}
                      suffix="%"
                      style={{ width: '100%' }}
                    />
                  </Col>
                  <Col span={4}>
                    <Button size="small" status="danger" onClick={() => removeAllocation(a.symbol)}>
                      删除
                    </Button>
                  </Col>
                </Row>
              ))}
              
              <Divider />
              
              <Row gutter={8} align="center">
                <Col span={8}>
                  <Input
                    placeholder="代币"
                    value={newSymbol}
                    onChange={setNewSymbol}
                    style={{ width: '100%' }}
                  />
                </Col>
                <Col span={10}>
                  <InputNumber
                    placeholder="权重 %"
                    value={newWeight}
                    onChange={(v) => setNewWeight(v as number)}
                    min={0}
                    max={100}
                    suffix="%"
                    style={{ width: '100%' }}
                  />
                </Col>
                <Col span={6}>
                  <Button size="small" type="primary" onClick={addAllocation}>
                    添加
                  </Button>
                </Col>
              </Row>

              <div style={{ marginTop: 16 }}>
                <Progress
                  percent={totalWeight}
                  status={totalWeight === 100 ? 'success' : totalWeight < 100 ? 'warning' : 'danger'}
                  style={{ width: '100%' }}
                />
                <Text type="secondary">
                  总权重: {totalWeight.toFixed(1)}% {totalWeight !== 100 && '(需等于100%)'}
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
        
        <Col span={12}>
          <Card title="配置图表" size="small">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// Main Page Component
const RebalancePage: React.FC = () => {
  const [allocations, setAllocations] = useState<TargetAllocation[]>([]);
  const [plans, setPlans] = useState<RebalancePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('plans');
  
  // Modal states
  const [allocationModalVisible, setAllocationModalVisible] = useState(false);
  const [planModalVisible, setPlanModalVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  
  // Form states
  const [editingAllocation, setEditingAllocation] = useState<TargetAllocation | null>(null);
  const [editingPlan, setEditingPlan] = useState<RebalancePlan | null>(null);
  const [formAllocations, setFormAllocations] = useState<AssetAllocation[]>([]);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTrigger, setFormTrigger] = useState<'manual' | 'threshold' | 'scheduled'>('manual');
  const [formThreshold, setFormThreshold] = useState(5);
  const [formTargetAllocationId, setFormTargetAllocationId] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  
  // Preview state
  const [previewData, setPreviewData] = useState<RebalancePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allocationsData, plansData] = await Promise.all([
        api.getAllocations(),
        api.getPlans(),
      ]);
      setAllocations(allocationsData);
      setPlans(plansData);
    } catch (error: any) {
      Message.error(`加载数据失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Allocation CRUD handlers
  const handleCreateAllocation = async () => {
    try {
      const totalWeight = formAllocations.reduce((sum, a) => sum + a.targetWeight, 0);
      if (Math.abs(totalWeight - 100) > 1) {
        Message.error('总权重必须等于100%');
        return;
      }

      await api.createAllocation({
        name: formName,
        description: formDescription,
        allocations: formAllocations,
        totalWeight,
      });
      
      Message.success('创建成功');
      setAllocationModalVisible(false);
      resetAllocationForm();
      loadData();
    } catch (error: any) {
      Message.error(`创建失败: ${error.message}`);
    }
  };

  const handleUpdateAllocation = async () => {
    if (!editingAllocation) return;
    
    try {
      const totalWeight = formAllocations.reduce((sum, a) => sum + a.targetWeight, 0);
      await api.updateAllocation(editingAllocation.id, {
        name: formName,
        description: formDescription,
        allocations: formAllocations,
        totalWeight,
      });
      
      Message.success('更新成功');
      setAllocationModalVisible(false);
      resetAllocationForm();
      loadData();
    } catch (error: any) {
      Message.error(`更新失败: ${error.message}`);
    }
  };

  const handleDeleteAllocation = async (id: string) => {
    try {
      await api.deleteAllocation(id);
      Message.success('删除成功');
      loadData();
    } catch (error: any) {
      Message.error(`删除失败: ${error.message}`);
    }
  };

  // Plan CRUD handlers
  const handleCreatePlan = async () => {
    try {
      if (!formTargetAllocationId) {
        Message.error('请选择目标配置');
        return;
      }

      await api.createPlan({
        name: formName,
        description: formDescription,
        targetAllocationId: formTargetAllocationId,
        trigger: formTrigger,
        threshold: formTrigger === 'threshold' ? formThreshold : undefined,
        isActive: formIsActive,
      } as any);
      
      Message.success('创建成功');
      setPlanModalVisible(false);
      resetPlanForm();
      loadData();
    } catch (error: any) {
      Message.error(`创建失败: ${error.message}`);
    }
  };

  const handleUpdatePlan = async () => {
    if (!editingPlan) return;
    
    try {
      await api.updatePlan(editingPlan.id, {
        name: formName,
        description: formDescription,
        trigger: formTrigger,
        threshold: formTrigger === 'threshold' ? formThreshold : undefined,
        isActive: formIsActive,
      });
      
      Message.success('更新成功');
      setPlanModalVisible(false);
      resetPlanForm();
      loadData();
    } catch (error: any) {
      Message.error(`更新失败: ${error.message}`);
    }
  };

  const handleDeletePlan = async (id: string) => {
    try {
      await api.deletePlan(id);
      Message.success('删除成功');
      loadData();
    } catch (error: any) {
      Message.error(`删除失败: ${error.message}`);
    }
  };

  // Preview and Execute handlers
  const handlePreview = async (planId: string) => {
    try {
      setPreviewLoading(true);
      setSelectedPlanId(planId);
      setPreviewModalVisible(true);
      
      // Mock positions - in real app, fetch from portfolio
      const mockPositions = [];
      const mockPortfolioValue = 100000;
      
      const preview = await api.previewRebalance(planId, mockPositions, mockPortfolioValue);
      setPreviewData(preview);
    } catch (error: any) {
      Message.error(`预览失败: ${error.message}`);
      setPreviewModalVisible(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!selectedPlanId) return;
    
    try {
      const result = await api.executeRebalance(selectedPlanId);
      Message.success(`执行已开始，执行ID: ${result.executionId}`);
      setPreviewModalVisible(false);
      loadData();
    } catch (error: any) {
      Message.error(`执行失败: ${error.message}`);
    }
  };

  // Form reset helpers
  const resetAllocationForm = () => {
    setEditingAllocation(null);
    setFormName('');
    setFormDescription('');
    setFormAllocations([]);
  };

  const resetPlanForm = () => {
    setEditingPlan(null);
    setFormName('');
    setFormDescription('');
    setFormTrigger('manual');
    setFormThreshold(5);
    setFormTargetAllocationId('');
    setFormIsActive(true);
  };

  // Open edit modals
  const openEditAllocation = (allocation: TargetAllocation) => {
    setEditingAllocation(allocation);
    setFormName(allocation.name);
    setFormDescription(allocation.description || '');
    setFormAllocations(allocation.allocations);
    setAllocationModalVisible(true);
  };

  const openEditPlan = (plan: RebalancePlan) => {
    setEditingPlan(plan);
    setFormName(plan.name);
    setFormDescription(plan.description || '');
    setFormTrigger(plan.trigger);
    setFormThreshold(plan.threshold || 5);
    setFormTargetAllocationId(plan.targetAllocationId);
    setFormIsActive(plan.isActive);
    setPlanModalVisible(true);
  };

  // Table columns
  const allocationColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '配置',
      dataIndex: 'allocations',
      key: 'allocations',
      render: (allocations: AssetAllocation[]) => (
        <Space wrap>
          {allocations.map((a, i) => (
            <Tag key={a.symbol} color={COLORS[i % COLORS.length]}>
              {a.symbol}: {a.targetWeight}%
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: TargetAllocation) => (
        <Space>
          <Button size="small" onClick={() => openEditAllocation(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除此配置？"
            onConfirm={() => handleDeleteAllocation(record.id)}
          >
            <Button size="small" status="danger">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const planColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '目标配置',
      dataIndex: 'targetAllocation',
      key: 'targetAllocation',
      render: (ta: TargetAllocation) => ta?.name || '-',
    },
    {
      title: '触发方式',
      dataIndex: 'trigger',
      key: 'trigger',
      render: (trigger: string, record: RebalancePlan) => {
        const triggerMap: Record<string, string> = {
          'manual': '手动',
          'threshold': `阈值 (${record.threshold}%)`,
          'scheduled': '定时',
        };
        return <Tag>{triggerMap[trigger] || trigger}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'gray'}>
          {isActive ? '已启用' : '已禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: RebalancePlan) => (
        <Space>
          <Button size="small" type="primary" onClick={() => handlePreview(record.id)}>
            预览
          </Button>
          <Button size="small" onClick={() => openEditPlan(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除此计划？"
            onConfirm={() => handleDeletePlan(record.id)}
          >
            <Button size="small" status="danger">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Spin size={40} />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div style={{ padding: 20 }}>
        <Title heading={4}>投资组合再平衡</Title>
        <Text type="secondary">管理目标资产配置，自动或手动执行再平衡操作</Text>

        <Divider />

        <Tabs activeTab={activeTab} onChange={setActiveTab}>
          <TabPane key="plans" title="再平衡计划">
            <Card>
              <div style={{ marginBottom: 16 }}>
                <Button
                  type="primary"
                  onClick={() => {
                    resetPlanForm();
                    setPlanModalVisible(true);
                  }}
                >
                  创建计划
                </Button>
              </div>

              <Table
                columns={planColumns}
                data={plans}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                empty={<Empty description="暂无再平衡计划" />}
              />
            </Card>
          </TabPane>

          <TabPane key="allocations" title="目标配置">
            <Card>
              <div style={{ marginBottom: 16 }}>
                <Button
                  type="primary"
                  onClick={() => {
                    resetAllocationForm();
                    setAllocationModalVisible(true);
                  }}
                >
                  创建配置
                </Button>
              </div>

              <Table
                columns={allocationColumns}
                data={allocations}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                empty={<Empty description="暂无目标配置" />}
              />
            </Card>
          </TabPane>
        </Tabs>

        {/* Allocation Modal */}
        <Modal
          title={editingAllocation ? '编辑配置' : '创建配置'}
          visible={allocationModalVisible}
          onCancel={() => setAllocationModalVisible(false)}
          onOk={editingAllocation ? handleUpdateAllocation : handleCreateAllocation}
          style={{ width: 800 }}
        >
          <Form layout="vertical">
            <Form.Item label="配置名称" required>
              <Input
                value={formName}
                onChange={setFormName}
                placeholder="如：保守型、平衡型、激进型"
              />
            </Form.Item>
            <Form.Item label="描述">
              <Input.TextArea
                value={formDescription}
                onChange={setFormDescription}
                placeholder="配置描述"
              />
            </Form.Item>
            <Form.Item label="资产配置">
              <AllocationEditor
                allocations={formAllocations}
                onChange={setFormAllocations}
              />
            </Form.Item>
          </Form>
        </Modal>

        {/* Plan Modal */}
        <Modal
          title={editingPlan ? '编辑计划' : '创建计划'}
          visible={planModalVisible}
          onCancel={() => setPlanModalVisible(false)}
          onOk={editingPlan ? handleUpdatePlan : handleCreatePlan}
          style={{ width: 600 }}
        >
          <Form layout="vertical">
            <Form.Item label="计划名称" required>
              <Input
                value={formName}
                onChange={setFormName}
                placeholder="如：每周再平衡"
              />
            </Form.Item>
            <Form.Item label="描述">
              <Input.TextArea
                value={formDescription}
                onChange={setFormDescription}
                placeholder="计划描述"
              />
            </Form.Item>
            <Form.Item label="目标配置" required>
              <Select
                value={formTargetAllocationId}
                onChange={setFormTargetAllocationId}
                placeholder="选择目标配置"
                disabled={!!editingPlan}
              >
                {allocations.map(a => (
                  <Option key={a.id} value={a.id}>
                    {a.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item label="触发方式" required>
              <Select value={formTrigger} onChange={setFormTrigger}>
                <Option value="manual">手动触发</Option>
                <Option value="threshold">偏离阈值触发</Option>
                <Option value="scheduled">定时触发</Option>
              </Select>
            </Form.Item>
            {formTrigger === 'threshold' && (
              <Form.Item label="偏离阈值 (%)" required>
                <InputNumber
                  value={formThreshold}
                  onChange={(v) => setFormThreshold(v as number)}
                  min={1}
                  max={50}
                  suffix="%"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            )}
            <Form.Item label="启用状态">
              <Switch checked={formIsActive} onChange={setFormIsActive} />
            </Form.Item>
          </Form>
        </Modal>

        {/* Preview Modal */}
        <Modal
          title="再平衡预览"
          visible={previewModalVisible}
          onCancel={() => setPreviewModalVisible(false)}
          footer={[
            <Button key="cancel" onClick={() => setPreviewModalVisible(false)}>
              取消
            </Button>,
            <Button key="execute" type="primary" onClick={handleExecute}>
              执行再平衡
            </Button>,
          ]}
          style={{ width: 800 }}
        >
          {previewLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Spin size={40} />
            </div>
          ) : previewData ? (
            <div>
              <Alert
                type="info"
                message="这是预览模式，不会执行实际交易"
                style={{ marginBottom: 16 }}
              />

              <Descriptions column={2} bordered>
                <Descriptions.Item label="组合价值">
                  ${previewData.portfolioValue.toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label="预估成本">
                  ${previewData.totalEstimatedCost.toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label="预估手续费">
                  ${previewData.totalEstimatedFees.toFixed(2)}
                </Descriptions.Item>
                <Descriptions.Item label="预估滑点">
                  {(previewData.estimatedSlippage * 100).toFixed(2)}%
                </Descriptions.Item>
              </Descriptions>

              <Divider>调整明细</Divider>

              <Table
                data={previewData.adjustments.filter(a => a.action !== 'none')}
                columns={[
                  { title: '代币', dataIndex: 'symbol' },
                  {
                    title: '操作',
                    dataIndex: 'action',
                    render: (action: string) => (
                      <Tag color={action === 'buy' ? 'green' : 'red'}>
                        {action === 'buy' ? '买入' : '卖出'}
                      </Tag>
                    ),
                  },
                  { title: '数量', dataIndex: 'quantity', render: (v: number) => v.toFixed(4) },
                  { title: '当前数量', dataIndex: 'currentQuantity', render: (v: number) => v.toFixed(4) },
                  { title: '目标数量', dataIndex: 'targetQuantity', render: (v: number) => v.toFixed(4) },
                  { title: '预估价格', dataIndex: 'estimatedPrice', render: (v: number) => `$${v.toFixed(2)}` },
                  { title: '预估金额', dataIndex: 'estimatedValue', render: (v: number) => `$${v.toFixed(2)}` },
                ]}
                rowKey="symbol"
                empty={<Empty description="无需调整" />}
              />

              {previewData.warnings.length > 0 && (
                <>
                  <Divider>警告</Divider>
                  {previewData.warnings.map((w, i) => (
                    <Alert key={i} type="warning" message={w} style={{ marginBottom: 8 }} />
                  ))}
                </>
              )}
            </div>
          ) : null}
        </Modal>
      </div>
    </ErrorBoundary>
  );
};

export default RebalancePage;
