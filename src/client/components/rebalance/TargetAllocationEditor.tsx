/**
 * Target Allocation Editor Component
 * 
 * Provides a UI for creating and editing target allocation configurations.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  Space,
  Table,
  message,
  Select,
  Typography,
  Tooltip,
  Alert,
  Divider,
} from '@arco-design/web-react';
import {
  IconPlus,
  IconDelete,
  IconInfoCircle,
} from '@arco-design/web-react/icon';
import { AssetAllocation, TargetAllocation } from '../../../portfolio/rebalance/types';

const { Title, Text } = Typography;
const { Item: FormItem } = Form;

interface TargetAllocationEditorProps {
  allocation?: TargetAllocation;
  availableSymbols?: string[];
  onSave: (allocation: Omit<TargetAllocation, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
}

// Default available symbols if none provided
const DEFAULT_SYMBOLS = [
  'BTC/USDT',
  'ETH/USDT',
  'BNB/USDT',
  'SOL/USDT',
  'XRP/USDT',
  'ADA/USDT',
  'DOGE/USDT',
  'DOT/USDT',
];

export const TargetAllocationEditor: React.FC<TargetAllocationEditorProps> = ({
  allocation,
  availableSymbols = DEFAULT_SYMBOLS,
  onSave,
  onCancel,
  loading = false,
}) => {
  const [form] = Form.useForm();
  const [allocations, setAllocations] = useState<AssetAllocation[]>(
    allocation?.allocations || []
  );
  const [_totalWeight, _setTotalWeight] = useState<number>(
    allocation?.totalWeight || 0
  );
  const [saving, setSaving] = useState(false);

  // Calculate total weight whenever allocations change
  const calculatedTotal = useMemo(() => {
    return allocations.reduce((sum, a) => sum + a.targetWeight, 0);
  }, [allocations]);

  // Check if total is valid (should be 100%)
  const isValidTotal = Math.abs(calculatedTotal - 100) < 0.01;

  // Add a new allocation
  const handleAddAllocation = useCallback(() => {
    // Find first unused symbol
    const usedSymbols = new Set(allocations.map(a => a.symbol));
    const availableSymbol = availableSymbols.find(s => !usedSymbols.has(s));

    if (!availableSymbol) {
      message.warning('All available symbols are already added');
      return;
    }

    setAllocations(prev => [
      ...prev,
      {
        symbol: availableSymbol,
        targetWeight: 0,
        tolerance: 5, // Default 5% tolerance
      },
    ]);
  }, [allocations, availableSymbols]);

  // Remove an allocation
  const handleRemoveAllocation = useCallback((index: number) => {
    setAllocations(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Update an allocation
  const handleUpdateAllocation = useCallback((
    index: number,
    field: keyof AssetAllocation,
    value: number | string
  ) => {
    setAllocations(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return updated;
    });
  }, []);

  // Handle symbol change
  const handleSymbolChange = useCallback((index: number, symbol: string) => {
    handleUpdateAllocation(index, 'symbol', symbol);
  }, [handleUpdateAllocation]);

  // Handle save
  const handleSave = useCallback(async () => {
    try {
      await form.validate();

      if (!isValidTotal) {
        message.error('Total allocation must equal 100%');
        return;
      }

      setSaving(true);

      const values = await form.getFieldsValue();
      const newAllocation: Omit<TargetAllocation, 'id' | 'createdAt' | 'updatedAt'> = {
        name: values.name,
        description: values.description,
        allocations,
        totalWeight: calculatedTotal,
      };

      await onSave(newAllocation);
      message.success('Target allocation saved successfully');
    } catch (err: any) {
      if (err.fields) {
        // Form validation error
        return;
      }
      message.error(err.message || 'Failed to save allocation');
    } finally {
      setSaving(false);
    }
  }, [form, allocations, calculatedTotal, isValidTotal, onSave]);

  // Get available symbols for a specific row (excluding symbols used in other rows)
  const getAvailableSymbolsForRow = useCallback((rowIndex: number) => {
    const usedSymbols = allocations
      .filter((_, i) => i !== rowIndex)
      .map(a => a.symbol);
    return availableSymbols.filter(s => !usedSymbols.includes(s));
  }, [allocations, availableSymbols]);

  // Table columns
  const columns = [
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 200,
      render: (symbol: string, _: any, index: number) => (
        <Select
          value={symbol}
          onChange={(value) => handleSymbolChange(index, value)}
          style={{ width: '100%' }}
          showSearch
          filterOption={(input, option) =>
            option.props.value.toLowerCase().includes(input.toLowerCase())
          }
        >
          {getAvailableSymbolsForRow(index).map(s => (
            <Select.Option key={s} value={s}>
              {s}
            </Select.Option>
          ))}
        </Select>
      ),
    },
    {
      title: (
        <Space>
          Target Weight
          <Tooltip content="Target percentage of portfolio (0-100%)">
            <IconInfoCircle style={{ color: 'var(--color-text-3)' }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'targetWeight',
      key: 'targetWeight',
      width: 150,
      render: (weight: number, _: any, index: number) => (
        <InputNumber
          value={weight}
          onChange={(value) => handleUpdateAllocation(index, 'targetWeight', value || 0)}
          min={0}
          max={100}
          step={1}
          suffix="%"
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: (
        <Space>
          Tolerance
          <Tooltip content="Allowed deviation from target before rebalancing">
            <IconInfoCircle style={{ color: 'color-text-3)' }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'tolerance',
      key: 'tolerance',
      width: 150,
      render: (tolerance: number, _: any, index: number) => (
        <InputNumber
          value={tolerance}
          onChange={(value) => handleUpdateAllocation(index, 'tolerance', value || 5)}
          min={0}
          max={50}
          step={1}
          suffix="%"
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '',
      key: 'action',
      width: 60,
      render: (_: any, __: any, index: number) => (
        <Button
          type="text"
          icon={<IconDelete />}
          status="danger"
          onClick={() => handleRemoveAllocation(index)}
        />
      ),
    },
  ];

  return (
    <Card>
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          name: allocation?.name || '',
          description: allocation?.description || '',
        }}
      >
        <FormItem
          label="Allocation Name"
          field="name"
          rules={[{ required: true, message: 'Name is required' }]}
        >
          <Input placeholder="e.g., Conservative Portfolio" />
        </FormItem>

        <FormItem label="Description" field="description">
          <Input.TextArea
            placeholder="Describe this allocation strategy..."
            autoSize={{ minRows: 2, maxRows: 4 }}
          />
        </FormItem>
      </Form>

      <Divider />

      <div style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Title heading={5}>Asset Allocations</Title>
          <Button
            type="primary"
            icon={<IconPlus />}
            onClick={handleAddAllocation}
            disabled={allocations.length >= availableSymbols.length}
          >
            Add Asset
          </Button>
        </Space>
      </div>

      {!isValidTotal && allocations.length > 0 && (
        <Alert
          type="warning"
          content={`Total allocation is ${calculatedTotal.toFixed(1)}%. Should be 100%.`}
          style={{ marginBottom: 16 }}
        />
      )}

      <Table
        data={allocations}
        columns={columns}
        pagination={false}
        rowKey={(record: AssetAllocation) => record.symbol}
        style={{ marginBottom: 16 }}
      />

      {allocations.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '24px 0',
            color: 'var(--color-text-3)',
          }}
        >
          No allocations configured. Click "Add Asset" to start.
        </div>
      )}

      <Divider />

      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Text>
          Total Weight:{' '}
          <Text bold style={{ color: isValidTotal ? 'var(--color-success-6)' : 'var(--color-warning-6)' }}>
            {calculatedTotal.toFixed(1)}%
          </Text>
        </Text>
        <Space>
          {onCancel && (
            <Button onClick={onCancel} disabled={loading || saving}>
              Cancel
            </Button>
          )}
          <Button
            type="primary"
            onClick={handleSave}
            loading={loading || saving}
            disabled={!isValidTotal || allocations.length === 0}
          >
            {allocation ? 'Update' : 'Create'}
          </Button>
        </Space>
      </Space>
    </Card>
  );
};

export default TargetAllocationEditor;
