/**
 * PortfolioCreateForm - 策略组合创建表单
 * 
 * 支持创建新的策略组合，包括策略选择、权重配置、再平衡设置等
 */

import React, { useState, useMemo } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Space,
  Button,
  Card,
  Table,
  Tag,
  Message,
  Slider,
  Typography,
  Alert,
  Popconfirm,
  Grid,
} from '@arco-design/web-react';
import {
  IconDelete,
  IconInfoCircle,
  IconExperiment,
} from '@arco-design/web-react/icon';
import {
  CreatePortfolioInput,
  AllocationMethod,
  usePortfolioOperations,
} from '../hooks/useStrategyPortfolio';
import { Strategy } from '../utils/api';
import { createLogger } from '../../utils/logger';

const log = createLogger('PortfolioCreateForm');

const { _Title, Text, _Paragraph } = Typography;
const FormItem = Form.Item;
const { Row, Col } = Grid;

interface PortfolioCreateFormProps {
  strategies: Strategy[];
  onSuccess: () => void;
  onCancel: () => void;
  initialValues?: Partial<CreatePortfolioInput>;
}

interface StrategyWithWeight {
  strategyId: string;
  weight: number;
}

/**
 * Allocation method descriptions
 */
const ALLOCATION_METHODS: Array<{
  value: AllocationMethod;
  label: string;
  description: string;
}> = [
  {
    value: 'equal',
    label: '等权重分配',
    description: '所有策略平均分配资金，每个策略权重相同',
  },
  {
    value: 'custom',
    label: '自定义权重',
    description: '手动设置每个策略的权重，权重会自动归一化',
  },
  {
    value: 'risk_parity',
    label: '风险平价',
    description: '根据策略波动率分配权重，使每个策略的风险贡献相等',
  },
];

/**
 * PortfolioCreateForm Component
 */
const PortfolioCreateForm: React.FC<PortfolioCreateFormProps> = ({
  strategies,
  onSuccess,
  onCancel,
  initialValues,
}) => {
  const { loading, createPortfolio } = usePortfolioOperations();

  const [form] = Form.useForm();
  const [selectedStrategies, setSelectedStrategies] = useState<StrategyWithWeight[]>(
    initialValues?.strategies?.map(s => ({
      strategyId: s.strategyId,
      weight: s.weight || 1,
    })) || []
  );
  const [allocationMethod, setAllocationMethod] = useState<AllocationMethod>(
    initialValues?.allocationMethod || 'equal'
  );
  const [rebalanceEnabled, setRebalanceEnabled] = useState(
    initialValues?.rebalanceConfig?.enabled ?? true
  );
  const [totalCapital, setTotalCapital] = useState(
    initialValues?.totalCapital || 10000
  );

  // Calculate total weight
  const totalWeight = useMemo(() => {
    return selectedStrategies.reduce((sum, s) => sum + s.weight, 0);
  }, [selectedStrategies]);

  // Calculate normalized weights
  const normalizedStrategies = useMemo(() => {
    if (totalWeight === 0) return selectedStrategies;

    return selectedStrategies.map(s => ({
      ...s,
      normalizedWeight: s.weight / totalWeight,
      allocation: totalCapital * (s.weight / totalWeight),
    }));
  }, [selectedStrategies, totalWeight, totalCapital]);

  // Add strategy
  const handleAddStrategy = (strategyId: string) => {
    if (selectedStrategies.some(s => s.strategyId === strategyId)) {
      Message.warning('该策略已添加');
      return;
    }

    const newWeight = allocationMethod === 'equal' ? 1 : 0;
    setSelectedStrategies([
      ...selectedStrategies,
      { strategyId, weight: newWeight },
    ]);
  };

  // Remove strategy
  const handleRemoveStrategy = (strategyId: string) => {
    setSelectedStrategies(selectedStrategies.filter(s => s.strategyId !== strategyId));
  };

  // Update weight
  const handleUpdateWeight = (strategyId: string, weight: number) => {
    setSelectedStrategies(
      selectedStrategies.map(s =>
        s.strategyId === strategyId ? { ...s, weight } : s
      )
    );
  };

  // Handle allocation method change
  const handleAllocationMethodChange = (method: AllocationMethod) => {
    setAllocationMethod(method);

    // Auto-adjust weights
    if (method === 'equal') {
      const weight = selectedStrategies.length > 0 ? 1 : 0;
      setSelectedStrategies(
        selectedStrategies.map(s => ({ ...s, weight }))
      );
    }
  };

  // Handle submit
  const handleSubmit = async () => {
    try {
      const values = await form.validate();

      if (selectedStrategies.length === 0) {
        Message.error('请至少添加一个策略');
        return;
      }

      const input: CreatePortfolioInput = {
        name: values.name,
        description: values.description,
        totalCapital: values.totalCapital,
        allocationMethod,
        rebalanceConfig: {
          enabled: rebalanceEnabled,
          frequency: values.rebalanceFrequency || 'threshold',
          threshold: values.rebalanceThreshold || 5,
        },
        strategies: selectedStrategies.map(s => ({
          strategyId: s.strategyId,
          weight: allocationMethod === 'equal' ? undefined : s.weight,
        })),
      };

      await createPortfolio(input);
      onSuccess();
    } catch (err) {
      log.error('Failed to create portfolio:', err);
    }
  };

  // Available strategies (not yet selected)
  const availableStrategies = strategies.filter(
    s => !selectedStrategies.some(ss => ss.strategyId === s.id)
  );

  // Get strategy by ID
  const getStrategyById = (id: string) => strategies.find(s => s.id === id);

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        totalCapital: 10000,
        rebalanceFrequency: 'threshold',
        rebalanceThreshold: 5,
        ...initialValues,
      }}
      onSubmit={handleSubmit}
    >
      {/* Basic Info */}
      <Card title="基本信息" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <FormItem
              label="组合名称"
              field="name"
              rules={[{ required: true, message: '请输入组合名称' }]}
            >
              <Input placeholder="例如：均衡组合、进取组合" />
            </FormItem>
          </Col>
          <Col span={12}>
            <FormItem label="描述" field="description">
              <Input placeholder="可选，描述组合的投资策略" />
            </FormItem>
          </Col>
        </Row>
        <Row>
          <Col span={24}>
            <FormItem
              label="总资金"
              field="totalCapital"
              rules={[
                { required: true, message: '请输入总资金' },
                { type: 'number', min: 100, message: '最小资金为 $100' },
              ]}
            >
              <InputNumber
                style={{ width: '100%' }}
                prefix="$"
                min={100}
                step={1000}
                placeholder="输入总资金金额"
                onChange={(value) => setTotalCapital(Number(value))}
              />
            </FormItem>
          </Col>
        </Row>
      </Card>

      {/* Strategy Selection */}
      <Card title="策略选择" style={{ marginBottom: 16 }}>
        {/* Add Strategy */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={18}>
            <Select
              placeholder="选择要添加的策略"
              style={{ width: '100%' }}
              onChange={handleAddStrategy}
              value={undefined}
              showSearch
              filterOption={(inputValue, option) =>
                option.props.children.toLowerCase().includes(inputValue.toLowerCase())
              }
            >
              {availableStrategies.map(s => (
                <Select.Option key={s.id} value={s.id}>
                  {s.name} ({s.symbol})
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <Alert
              type="info"
              content={`已选择 ${selectedStrategies.length} 个策略`}
            />
          </Col>
        </Row>

        {/* Strategy List */}
        {selectedStrategies.length > 0 && (
          <Table
            data={normalizedStrategies}
            rowKey="strategyId"
            pagination={false}
            size="small"
          >
            <Table.Column
              title="策略"
              dataIndex="strategyId"
              key="name"
              render={(id: string) => {
                const strategy = getStrategyById(id);
                return strategy ? (
                  <Space>
                    <Text strong>{strategy.name}</Text>
                    <Tag>{strategy.symbol}</Tag>
                  </Space>
                ) : id;
              }}
            />
            <Table.Column
              title="权重"
              dataIndex="weight"
              key="weight"
              width={200}
              render={(weight: number, record: any) => {
                if (allocationMethod === 'equal') {
                  return (
                    <Tag color="blue">
                      {((1 / selectedStrategies.length) * 100).toFixed(2)}%
                    </Tag>
                  );
                }

                return (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Slider
                      value={weight}
                      min={0}
                      max={Math.max(totalWeight, 1)}
                      step={0.01}
                      onChange={(value) => handleUpdateWeight(record.strategyId, value)}
                      style={{ width: 150 }}
                    />
                    <Text>{(weight / totalWeight * 100).toFixed(2)}%</Text>
                  </Space>
                );
              }}
            />
            <Table.Column
              title="分配资金"
              key="allocation"
              width={150}
              render={(_, record: any) => (
                <Text>${record.allocation?.toFixed(2) || '0.00'}</Text>
              )}
            />
            <Table.Column
              title="操作"
              key="actions"
              width={80}
              render={(_, record: any) => (
                <Popconfirm
                  title="确认移除"
                  content="确定要移除这个策略吗？"
                  onConfirm={() => handleRemoveStrategy(record.strategyId)}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<IconDelete />}
                    status="danger"
                  />
                </Popconfirm>
              )}
            />
          </Table>
        )}

        {selectedStrategies.length === 0 && (
          <Alert
            type="warning"
            content="请至少添加一个策略"
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      {/* Allocation Method */}
      <Card title="资金分配方式" style={{ marginBottom: 16 }}>
        <FormItem field="allocationMethod" initialValue={allocationMethod}>
          <Select
            onChange={handleAllocationMethodChange}
            style={{ marginBottom: 16 }}
          >
            {ALLOCATION_METHODS.map(method => (
              <Select.Option key={method.value} value={method.value}>
                <Space direction="vertical" size={0}>
                  <Text strong>{method.label}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {method.description}
                  </Text>
                </Space>
              </Select.Option>
            ))}
          </Select>
        </FormItem>

        {allocationMethod === 'custom' && selectedStrategies.length > 1 && (
          <Alert
            type="info"
            content="自定义权重会自动归一化，确保所有权重之和为 100%"
          />
        )}
      </Card>

      {/* Rebalance Config */}
      <Card title="再平衡设置" style={{ marginBottom: 16 }}>
        <FormItem label="启用自动再平衡">
          <Switch
            checked={rebalanceEnabled}
            onChange={setRebalanceEnabled}
          />
        </FormItem>

        {rebalanceEnabled && (
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="触发条件"
                field="rebalanceFrequency"
                initialValue="threshold"
              >
                <Select>
                  <Select.Option value="threshold">偏离阈值</Select.Option>
                  <Select.Option value="daily">每日</Select.Option>
                  <Select.Option value="weekly">每周</Select.Option>
                  <Select.Option value="monthly">每月</Select.Option>
                </Select>
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                label="偏离阈值 (%)"
                field="rebalanceThreshold"
                initialValue={5}
                rules={[
                  { type: 'number', min: 1, max: 50, message: '阈值范围：1-50%' },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  max={50}
                  suffix="%"
                />
              </FormItem>
            </Col>
          </Row>
        )}
      </Card>

      {/* Actions */}
      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button onClick={onCancel}>取消</Button>
        <Button
          type="primary"
          htmlType="submit"
          loading={loading}
          disabled={selectedStrategies.length === 0}
        >
          创建组合
        </Button>
      </Space>
    </Form>
  );
};

export default PortfolioCreateForm;