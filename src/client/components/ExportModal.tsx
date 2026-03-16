/**
 * Export Modal Component
 * 
 * Provides a modal dialog for exporting trading history in various formats.
 * Supports CSV, JSON, and PDF formats with filtering options.
 */

import React, { useState, useMemo } from 'react';
import {
  Modal,
  Form,
  Select,
  DatePicker,
  Switch,
  Button,
  Progress,
  Space,
  Message,
  Typography,
  Divider,
  Grid,
} from '@arco-design/web-react';
import {
  IconDownload,
} from '@arco-design/web-react/icon';
import type { Trade } from '../utils/api';
import {
  exportTrades,
  downloadExport,
  type ExportFormat,
  type ExportFilters,
  type ExportProgress,
} from '../utils/exportUtils';

const { Row, Col } = Grid;
const { Text } = Typography;
const FormItem = Form.Item;

interface ExportModalProps {
  visible: boolean;
  onCancel: () => void;
  trades: Trade[];
  availableSymbols: string[];
  availableStrategies: { id: string; name: string }[];
}

const formatOptions: { label: string; value: ExportFormat; description: string }[] = [
  {
    label: 'CSV',
    value: 'csv',
    description: 'Excel compatible spreadsheet format',
  },
  {
    label: 'JSON',
    value: 'json',
    description: 'Structured data format for developers',
  },
  {
    label: 'PDF',
    value: 'pdf',
    description: 'Printable report format (HTML)',
  },
];

const ExportModal: React.FC<ExportModalProps> = ({
  visible,
  onCancel,
  trades,
  availableSymbols,
  availableStrategies,
}) => {
  const [form] = Form.useForm();
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');

  // Get timezone
  const timezone = useMemo(() => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, []);

  // Calculate filtered count
  const filteredCount = useMemo(() => {
    const values = form.getFieldsValue();
    const filters: ExportFilters = {
      symbol: values.symbol,
      side: values.side,
      strategyId: values.strategyId,
      startDate: values.dateRange?.[0]?.toDate?.() || values.dateRange?.[0],
      endDate: values.dateRange?.[1]?.toDate?.() || values.dateRange?.[1],
    };
    
    return trades.filter(trade => {
      if (filters.symbol && trade.symbol !== filters.symbol) return false;
      if (filters.side && trade.side !== filters.side) return false;
      if (filters.strategyId && trade.strategyId !== filters.strategyId) return false;
      if (filters.startDate) {
        const tradeDate = new Date(trade.executedAt);
        if (tradeDate < filters.startDate) return false;
      }
      if (filters.endDate) {
        const tradeDate = new Date(trade.executedAt);
        if (tradeDate > filters.endDate) return false;
      }
      return true;
    }).length;
  }, [trades, form]);

  const handleExport = async () => {
    try {
      await form.validate();
      const values = form.getFieldsValue();
      
      setExporting(true);
      setProgress({ status: 'preparing', progress: 0, message: 'Preparing export...' });
      
      const filters: ExportFilters = {
        symbol: values.symbol,
        side: values.side,
        strategyId: values.strategyId,
        startDate: values.dateRange?.[0]?.toDate?.() || values.dateRange?.[0],
        endDate: values.dateRange?.[1]?.toDate?.() || values.dateRange?.[1],
      };
      
      const options = {
        format: selectedFormat,
        filters,
        includeSummary: values.includeSummary ?? true,
        timezone,
      };
      
      // Use setTimeout to allow UI to update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const content = exportTrades(trades, options, setProgress);
      
      setProgress({ status: 'downloading', progress: 90, message: 'Downloading file...' });
      
      downloadExport(content, selectedFormat);
      
      setProgress({ status: 'complete', progress: 100, message: 'Export complete!' });
      
      Message.success(`Successfully exported ${filteredCount} trades as ${selectedFormat.toUpperCase()}`);
      
      // Close modal after a short delay
      setTimeout(() => {
        setExporting(false);
        setProgress(null);
        onCancel();
      }, 500);
      
    } catch (error: any) {
      setProgress({ status: 'error', progress: 0, message: error.message });
      Message.error(`Export failed: ${error.message}`);
      setExporting(false);
    }
  };

  const handleCancel = () => {
    if (exporting) {
      Modal.confirm({
        title: 'Cancel Export?',
        content: 'The export is in progress. Are you sure you want to cancel?',
        onOk: () => {
          setExporting(false);
          setProgress(null);
          onCancel();
        },
      });
    } else {
      onCancel();
    }
  };

  return (
    <Modal
      title={
        <Space>
          <IconDownload />
          <span>Export Trading History</span>
        </Space>
      }
      visible={visible}
      onCancel={handleCancel}
      footer={null}
      style={{ width: 520 }}
      unmountOnExit
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          format: 'csv',
          includeSummary: true,
        }}
      >
        {/* Format Selection */}
        <FormItem label="Export Format" field="format" required>
          <Select
            value={selectedFormat}
            onChange={(value) => setSelectedFormat(value as ExportFormat)}
            style={{ width: '100%' }}
          >
            {formatOptions.map((opt) => (
              <Select.Option key={opt.value} value={opt.value}>
                <Space direction="vertical" size={0}>
                  <Text strong>{opt.label}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {opt.description}
                  </Text>
                </Space>
              </Select.Option>
            ))}
          </Select>
        </FormItem>

        <Divider orientation="left">Filters</Divider>

        <Row gutter={16}>
          <Col span={12}>
            <FormItem label="Symbol" field="symbol">
              <Select
                placeholder="All Symbols"
                allowClear
                showSearch
              >
                {availableSymbols.map((symbol) => (
                  <Select.Option key={symbol} value={symbol}>
                    {symbol}
                  </Select.Option>
                ))}
              </Select>
            </FormItem>
          </Col>
          <Col span={12}>
            <FormItem label="Side" field="side">
              <Select placeholder="All Sides" allowClear>
                <Select.Option value="buy">Buy</Select.Option>
                <Select.Option value="sell">Sell</Select.Option>
              </Select>
            </FormItem>
          </Col>
        </Row>

        <FormItem label="Strategy" field="strategyId">
          <Select
            placeholder="All Strategies"
            allowClear
            showSearch
          >
            {availableStrategies.map((strategy) => (
              <Select.Option key={strategy.id} value={strategy.id}>
                {strategy.name}
              </Select.Option>
            ))}
          </Select>
        </FormItem>

        <FormItem label="Date Range" field="dateRange">
          <DatePicker.RangePicker
            style={{ width: '100%' }}
            placeholder={['Start Date', 'End Date']}
          />
        </FormItem>

        <FormItem
          label="Include Summary"
          field="includeSummary"
          triggerPropName="checked"
        >
          <Switch
            checkedText="Yes"
            uncheckedText="No"
          />
        </FormItem>

        {/* Export Info */}
        <div
          style={{
            background: 'var(--color-fill-1)',
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <Space direction="vertical" size={4}>
            <Text>
              <Text strong>{filteredCount}</Text> trades will be exported
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Timezone: {timezone}
            </Text>
          </Space>
        </div>

        {/* Progress Indicator */}
        {progress && exporting && (
          <div style={{ marginBottom: 16 }}>
            <Progress
              percent={progress.progress}
              status={progress.status === 'error' ? 'danger' : 'normal'}
              style={{ marginBottom: 8 }}
            />
            <Text type="secondary">{progress.message}</Text>
          </div>
        )}

        {/* Action Buttons */}
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={handleCancel} disabled={exporting}>
            Cancel
          </Button>
          <Button
            type="primary"
            onClick={handleExport}
            loading={exporting}
            icon={<IconDownload />}
          >
            Export {selectedFormat.toUpperCase()}
          </Button>
        </Space>
      </Form>
    </Modal>
  );
};

export default ExportModal;
