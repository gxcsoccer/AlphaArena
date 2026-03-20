/**
 * Rebalance Panel Component
 * 
 * Main component for portfolio rebalancing functionality.
 * Provides UI for managing allocations, plans, and executing rebalancing.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
  Tabs,
  Button,
  Space,
  Typography,
  Table,
  Tag,
  Modal,
  Message,
  Drawer,
  Empty,
  Spin,
  Alert,
  Tooltip,
  Popconfirm,
  Select,
  InputNumber,
  Form,
} from '@arco-design/web-react';
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconPlay,
  IconEye,
  IconRefresh,
} from '@arco-design/web-react/icon';
import { useRebalance } from '../../hooks/useRebalance';
import { usePortfolioRealtime } from '../../hooks/usePortfolioRealtime';
import TargetAllocationEditor from './TargetAllocationEditor';
import RebalancePreviewComponent from './RebalancePreview';
import {
  TargetAllocation,
  RebalancePlan,
  RebalanceTrigger,
} from '../../../portfolio/rebalance/types';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Item: FormItem } = Form;

/**
 * Rebalance Panel Props
 */
interface RebalancePanelProps {
  strategyId?: string;
  symbol?: string;
}

/**
 * Main Rebalance Panel Component
 */
export const RebalancePanel: React.FC<RebalancePanelProps> = ({
  strategyId,
  symbol,
}) => {
  // Hooks
  const {
    targetAllocations,
    targetAllocationsLoading,
    plans,
    plansLoading,
    preview,
    previewLoading,
    execution: _execution,
    executionLoading,
    createTargetAllocation,
    updateTargetAllocation,
    deleteTargetAllocation,
    createPlan,
    updatePlan,
    deletePlan,
    generatePreview,
    executeRebalance,
    refreshTargetAllocations,
    refreshPlans,
    isLoading,
    error,
  } = useRebalance({ autoRefresh: true });

  const { portfolio, loading: _portfolioLoading } = usePortfolioRealtime({
    strategyId,
    symbol,
  });

  // Local state
  const [activeTab, setActiveTab] = useState('allocations');
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<TargetAllocation | undefined>();
  const [planModalVisible, setPlanModalVisible] = useState(false);
  const [editingPlan, setEditingPlan] = useState<RebalancePlan | undefined>();
  const [previewDrawerVisible, setPreviewDrawerVisible] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | undefined>();
  const [executeModalVisible, setExecuteModalVisible] = useState(false);

  // Form for plan creation/editing
  const [planForm] = Form.useForm();

  // Get positions from portfolio
  const positions = useMemo(() => {
    return portfolio?.positions?.map(p => ({
      symbol: p.symbol,
      quantity: p.quantity,
      averageCost: p.averageCost,
    })) || [];
  }, [portfolio]);

  // Handlers for target allocations
  const handleCreateAllocation = useCallback(() => {
    setEditingAllocation(undefined);
    setEditorVisible(true);
  }, []);

  const handleEditAllocation = useCallback((allocation: TargetAllocation) => {
    setEditingAllocation(allocation);
    setEditorVisible(true);
  }, []);

  const handleDeleteAllocation = useCallback(async (id: string) => {
    const success = await deleteTargetAllocation(id);
    if (success) {
      Message.success('Allocation deleted');
    }
  }, [deleteTargetAllocation]);

  const handleSaveAllocation = useCallback(async (
    allocation: Omit<TargetAllocation, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    if (editingAllocation) {
      await updateTargetAllocation(editingAllocation.id, allocation);
    } else {
      await createTargetAllocation(allocation);
    }
    setEditorVisible(false);
    setEditingAllocation(undefined);
  }, [editingAllocation, createTargetAllocation, updateTargetAllocation]);

  // Handlers for plans
  const handleCreatePlan = useCallback(() => {
    setEditingPlan(undefined);
    planForm.resetFields();
    setPlanModalVisible(true);
  }, [planForm]);

  const handleEditPlan = useCallback((plan: RebalancePlan) => {
    setEditingPlan(plan);
    planForm.setFieldsValue({
      name: plan.name,
      description: plan.description,
      targetAllocationId: plan.targetAllocationId,
      trigger: plan.trigger,
      threshold: plan.threshold,
      schedule: plan.schedule,
    });
    setPlanModalVisible(true);
  }, [planForm]);

  const handleDeletePlan = useCallback(async (id: string) => {
    const success = await deletePlan(id);
    if (success) {
      Message.success('Plan deleted');
    }
  }, [deletePlan]);

  const handleSavePlan = useCallback(async () => {
    try {
      const values = await planForm.validate();
      
      if (editingPlan) {
        await updatePlan(editingPlan.id, values);
        Message.success('Plan updated');
      } else {
        await createPlan({
          ...values,
          isActive: true,
        });
        Message.success('Plan created');
      }
      
      setPlanModalVisible(false);
      setEditingPlan(undefined);
    } catch (_err) {
      // Form validation error
    }
  }, [editingPlan, createPlan, updatePlan, planForm]);

  // Handlers for preview and execution
  const handlePreview = useCallback(async (planId: string) => {
    setSelectedPlanId(planId);
    const plan = plans.find(p => p.id === planId);
    
    if (!plan || positions.length === 0) {
      Message.warning('No positions available for preview');
      return;
    }

    await generatePreview(planId, positions);
    setPreviewDrawerVisible(true);
  }, [plans, positions, generatePreview]);

  const handleExecute = useCallback(async (planId: string) => {
    setSelectedPlanId(planId);
    
    if (positions.length === 0) {
      Message.warning('No positions available for rebalancing');
      return;
    }

    setExecuteModalVisible(true);
  }, [positions]);

  const confirmExecute = useCallback(async () => {
    if (!selectedPlanId) return;
    
    const result = await executeRebalance(selectedPlanId, positions, RebalanceTrigger.MANUAL);
    
    if (result) {
      Message.success('Rebalancing executed successfully');
      setExecuteModalVisible(false);
    }
  }, [selectedPlanId, positions, executeRebalance]);

  const _handleTogglePlanActive = useCallback(async (plan: RebalancePlan) => {
    await updatePlan(plan.id, { isActive: !plan.isActive });
    Message.success(`Plan ${plan.isActive ? 'deactivated' : 'activated'}`);
  }, [updatePlan]);

  // Allocation table columns
  const allocationColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string) => desc || '-',
    },
    {
      title: 'Assets',
      dataIndex: 'allocations',
      key: 'assets',
      render: (allocations: any[]) => (
        <Space wrap>
          {allocations.slice(0, 3).map(a => (
            <Tag key={a.symbol}>{a.symbol}: {a.targetWeight}%</Tag>
          ))}
          {allocations.length > 3 && (
            <Tag>+{allocations.length - 3} more</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Total Weight',
      dataIndex: 'totalWeight',
      key: 'totalWeight',
      render: (weight: number) => (
        <Tag color={weight === 100 ? 'green' : 'orange'}>
          {weight.toFixed(1)}%
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: TargetAllocation) => (
        <Space>
          <Button
            type="text"
            icon={<IconEdit />}
            onClick={() => handleEditAllocation(record)}
          />
          <Popconfirm
            title="Delete this allocation?"
            onOk={() => handleDeleteAllocation(record.id)}
          >
            <Button type="text" icon={<IconDelete />} status="danger" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Plan table columns
  const planColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Target Allocation',
      dataIndex: 'targetAllocation',
      key: 'targetAllocation',
      render: (allocation: TargetAllocation) => allocation?.name || '-',
    },
    {
      title: 'Trigger',
      dataIndex: 'trigger',
      key: 'trigger',
      render: (trigger: string, record: RebalancePlan) => {
        const triggerColors: Record<string, string> = {
          scheduled: 'blue',
          threshold: 'orange',
          manual: 'purple',
        };
        
        let label = trigger.charAt(0).toUpperCase() + trigger.slice(1);
        if (trigger === 'threshold' && record.threshold) {
          label += ` (${record.threshold}%)`;
        }
        
        return <Tag color={triggerColors[trigger]}>{label}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'gray'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: RebalancePlan) => (
        <Space>
          <Tooltip content="Preview">
            <Button
              type="text"
              icon={<IconEye />}
              onClick={() => handlePreview(record.id)}
              disabled={positions.length === 0}
            />
          </Tooltip>
          <Tooltip content="Execute">
            <Button
              type="text"
              icon={<IconPlay />}
              onClick={() => handleExecute(record.id)}
              disabled={positions.length === 0 || !record.isActive}
            />
          </Tooltip>
          <Button
            type="text"
            icon={<IconEdit />}
            onClick={() => handleEditPlan(record)}
          />
          <Popconfirm
            title="Delete this plan?"
            onOk={() => handleDeletePlan(record.id)}
          >
            <Button type="text" icon={<IconDelete />} status="danger" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title heading={5}>Portfolio Rebalancing</Title>
        <Button
          icon={<IconRefresh />}
          onClick={() => {
            refreshTargetAllocations();
            refreshPlans();
          }}
          loading={isLoading}
        >
          Refresh
        </Button>
      </Space>

      {error && (
        <Alert type="error" content={error} style={{ marginBottom: 16 }} />
      )}

      <Tabs activeTab={activeTab} onChange={setActiveTab}>
        <TabPane key="allocations" tab="Target Allocations">
          <Space style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              icon={<IconPlus />}
              onClick={handleCreateAllocation}
            >
              New Allocation
            </Button>
          </Space>

          <Table
            data={targetAllocations}
            columns={allocationColumns}
            loading={targetAllocationsLoading}
            pagination={false}
            rowKey="id"
          />

          {targetAllocations.length === 0 && !targetAllocationsLoading && (
            <Empty description="No target allocations configured" />
          )}
        </TabPane>

        <TabPane key="plans" tab="Rebalance Plans">
          <Space style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              icon={<IconPlus />}
              onClick={handleCreatePlan}
              disabled={targetAllocations.length === 0}
            >
              New Plan
            </Button>
          </Space>

          {targetAllocations.length === 0 && (
            <Alert
              type="info"
              content="Create a target allocation first before creating a plan"
              style={{ marginBottom: 16 }}
            />
          )}

          <Table
            data={plans}
            columns={planColumns}
            loading={plansLoading}
            pagination={false}
            rowKey="id"
          />

          {plans.length === 0 && !plansLoading && (
            <Empty description="No rebalance plans configured" />
          )}
        </TabPane>
      </Tabs>

      {/* Allocation Editor Drawer */}
      <Drawer
        title={editingAllocation ? 'Edit Allocation' : 'New Allocation'}
        visible={editorVisible}
        onCancel={() => {
          setEditorVisible(false);
          setEditingAllocation(undefined);
        }}
        width={600}
        footer={null}
      >
        <TargetAllocationEditor
          allocation={editingAllocation}
          onSave={handleSaveAllocation}
          onCancel={() => {
            setEditorVisible(false);
            setEditingAllocation(undefined);
          }}
        />
      </Drawer>

      {/* Plan Modal */}
      <Modal
        title={editingPlan ? 'Edit Plan' : 'New Plan'}
        visible={planModalVisible}
        onOk={handleSavePlan}
        onCancel={() => {
          setPlanModalVisible(false);
          setEditingPlan(undefined);
        }}
        confirmLoading={isLoading}
      >
        <Form form={planForm} layout="vertical">
          <FormItem
            label="Plan Name"
            field="name"
            rules={[{ required: true, message: 'Name is required' }]}
          >
            <input className="arco-input" placeholder="e.g., Weekly Rebalance" />
          </FormItem>

          <FormItem label="Description" field="description">
            <textarea className="arco-textarea" placeholder="Describe this plan..." rows={2} />
          </FormItem>

          <FormItem
            label="Target Allocation"
            field="targetAllocationId"
            rules={[{ required: true, message: 'Allocation is required' }]}
          >
            <Select placeholder="Select target allocation">
              {targetAllocations.map(a => (
                <Select.Option key={a.id} value={a.id}>
                  {a.name}
                </Select.Option>
              ))}
            </Select>
          </FormItem>

          <FormItem
            label="Trigger Type"
            field="trigger"
            rules={[{ required: true, message: 'Trigger type is required' }]}
          >
            <Select placeholder="Select trigger type">
              <Select.Option value="manual">Manual</Select.Option>
              <Select.Option value="threshold">Threshold</Select.Option>
              <Select.Option value="scheduled">Scheduled</Select.Option>
            </Select>
          </FormItem>

          <FormItem
            label="Threshold (%)"
            field="threshold"
            rules={[
              {
                validator: (value, callback) => {
                  const trigger = planForm.getFieldValue('trigger');
                  if (trigger === 'threshold' && !value) {
                    callback('Threshold is required for threshold trigger');
                  } else {
                    callback();
                  }
                },
              },
            ]}
          >
            <InputNumber
              placeholder="e.g., 5"
              min={0}
              max={100}
              style={{ width: '100%' }}
            />
          </FormItem>
        </Form>
      </Modal>

      {/* Preview Drawer */}
      <Drawer
        title="Rebalancing Preview"
        visible={previewDrawerVisible}
        onCancel={() => setPreviewDrawerVisible(false)}
        width={800}
        footer={null}
      >
        {previewLoading ? (
          <Spin size={32} />
        ) : preview ? (
          <RebalancePreviewComponent
            preview={preview}
            onExecute={() => {
              setPreviewDrawerVisible(false);
              handleExecute(preview.planId);
            }}
          />
        ) : (
          <Empty description="No preview available" />
        )}
      </Drawer>

      {/* Execute Confirmation Modal */}
      <Modal
        title="Confirm Rebalancing"
        visible={executeModalVisible}
        onOk={confirmExecute}
        onCancel={() => setExecuteModalVisible(false)}
        confirmLoading={executionLoading}
      >
        <Alert
          type="warning"
          content="This will execute trades to rebalance your portfolio. Please review the preview before confirming."
          style={{ marginBottom: 16 }}
        />
        <Text>
          Executing rebalancing for plan: <Text bold>{plans.find(p => p.id === selectedPlanId)?.name}</Text>
        </Text>
      </Modal>
    </Card>
  );
};

export default RebalancePanel;
