/**
 * Rebalance Preview Component
 * 
 * Displays a preview of the proposed rebalancing adjustments with
 * current vs target comparison and estimated costs.
 */

import React, { useMemo } from 'react';
import {
  Card,
  Table,
  Tag,
  Typography,
  Space,
  Statistic,
  Row,
  Col,
  Divider,
  Alert,
  Progress,
  Tooltip,
} from '@arco-design/web-react';
import {
  IconArrowUp,
  IconArrowDown,
  IconInfoCircle,
  IconWarning,
} from '@arco-design/web-react/icon';
import { RebalancePreview as RebalancePreviewType, RebalanceAdjustment, PositionState } from '../../../portfolio/rebalance/types';

const { Title, Text } = Typography;

interface RebalancePreviewProps {
  preview: RebalancePreviewType;
  onExecute?: () => void;
  executing?: boolean;
}

export const RebalancePreviewComponent: React.FC<RebalancePreviewProps> = ({
  preview,
  onExecute: _onExecute,
  executing: _executing = false,
}) => {
  // Calculate summary statistics
  const stats = useMemo(() => {
    const buys = preview.adjustments.filter(a => a.action === 'buy');
    const sells = preview.adjustments.filter(a => a.action === 'sell');
    const totalBuyValue = buys.reduce((sum, a) => sum + a.estimatedValue, 0);
    const totalSellValue = sells.reduce((sum, a) => sum + a.estimatedValue, 0);

    return {
      buyCount: buys.length,
      sellCount: sells.length,
      totalBuyValue,
      totalSellValue,
      netCashFlow: totalSellValue - totalBuyValue,
    };
  }, [preview.adjustments]);

  // Position comparison columns
  const positionColumns = [
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
    },
    {
      title: 'Current Weight',
      dataIndex: 'currentWeight',
      key: 'currentWeight',
      render: (weight: number) => (
        <Text>{weight.toFixed(2)}%</Text>
      ),
    },
    {
      title: 'Target Weight',
      dataIndex: 'targetWeight',
      key: 'targetWeight',
      render: (weight: number) => (
        <Text>{weight.toFixed(2)}%</Text>
      ),
    },
    {
      title: 'Deviation',
      dataIndex: 'deviationPercent',
      key: 'deviationPercent',
      render: (deviation: number, record: PositionState) => {
        const color = deviation > 10 ? 'red' : deviation > 5 ? 'orange' : 'green';
        return (
          <Tag color={color}>
            {deviation.toFixed(2)}%
          </Tag>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: PositionState) => {
        if (record.currentWeight > record.targetWeight) {
          return <Tag color="red">Overweight</Tag>;
        } else if (record.currentWeight < record.targetWeight) {
          return <Tag color="green">Underweight</Tag>;
        }
        return <Tag color="gray">On Target</Tag>;
      },
    },
  ];

  // Adjustment columns
  const adjustmentColumns = [
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (action: string) => {
        if (action === 'buy') {
          return (
            <Tag color="green" icon={<IconArrowUp />}>
              BUY
            </Tag>
          );
        } else if (action === 'sell') {
          return (
            <Tag color="red" icon={<IconArrowDown />}>
              SELL
            </Tag>
          );
        }
        return <Tag color="gray">NONE</Tag>;
      },
    },
    {
      title: 'Current Qty',
      dataIndex: 'currentQuantity',
      key: 'currentQuantity',
      render: (qty: number) => qty.toFixed(6),
    },
    {
      title: 'Target Qty',
      dataIndex: 'targetQuantity',
      key: 'targetQuantity',
      render: (qty: number) => qty.toFixed(6),
    },
    {
      title: 'Trade Qty',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (qty: number, record: RebalanceAdjustment) => (
        <Text bold>
          {record.action === 'buy' ? '+' : '-'}{qty.toFixed(6)}
        </Text>
      ),
    },
    {
      title: 'Est. Price',
      dataIndex: 'estimatedPrice',
      key: 'estimatedPrice',
      render: (price: number) => `$${price.toFixed(2)}`,
    },
    {
      title: 'Est. Value',
      dataIndex: 'estimatedValue',
      key: 'estimatedValue',
      render: (value: number) => `$${value.toFixed(2)}`,
    },
    {
      title: 'Est. Fee',
      dataIndex: 'estimatedFee',
      key: 'estimatedFee',
      render: (fee: number) => `$${fee.toFixed(4)}`,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: number) => (
        <Progress
          percent={Math.min(100, priority / 50)}
          size="small"
          style={{ width: 60 }}
          showText={false}
        />
      ),
    },
  ];

  return (
    <Card>
      <Title heading={5}>Rebalancing Preview</Title>
      <Text type="secondary">
        Generated at {new Date(preview.timestamp).toLocaleString()}
      </Text>

      <Divider />

      {/* Summary Statistics */}
      <Row gutter={16}>
        <Col span={6}>
          <Statistic
            title="Portfolio Value"
            value={preview.portfolioValue}
            prefix="$"
            precision={2}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="Buy Orders"
            value={stats.buyCount}
            suffix={`($${stats.totalBuyValue.toFixed(2)})`}
            valueStyle={{ color: 'var(--color-success-6)' }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="Sell Orders"
            value={stats.sellCount}
            suffix={`($${stats.totalSellValue.toFixed(2)})`}
            valueStyle={{ color: 'var(--color-danger-6)' }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="Net Cash Flow"
            value={stats.netCashFlow}
            prefix="$"
            precision={2}
            valueStyle={{
              color: stats.netCashFlow >= 0 ? 'var(--color-success-6)' : 'var(--color-danger-6)',
            }}
          />
        </Col>
      </Row>

      <Divider />

      {/* Warnings */}
      {preview.warnings.length > 0 && (
        <>
          {preview.warnings.map((warning, index) => (
            <Alert
              key={index}
              type="warning"
              icon={<IconWarning />}
              content={warning}
              style={{ marginBottom: 8 }}
            />
          ))}
          <Divider />
        </>
      )}

      {/* Position Comparison */}
      <Title heading={6}>Current vs Target Allocation</Title>
      <Table
        data={preview.positions}
        columns={positionColumns}
        pagination={false}
        rowKey="symbol"
        style={{ marginBottom: 24 }}
      />

      {/* Adjustments */}
      <Title heading={6}>Proposed Adjustments</Title>
      {preview.adjustments.length > 0 ? (
        <Table
          data={preview.adjustments.filter(a => a.action !== 'none')}
          columns={adjustmentColumns}
          pagination={false}
          rowKey="symbol"
          style={{ marginBottom: 24 }}
        />
      ) : (
        <Alert
          type="success"
          content="Portfolio is already balanced. No adjustments needed."
        />
      )}

      <Divider />

      {/* Cost Summary */}
      <Row gutter={16}>
        <Col span={8}>
          <Statistic
            title="Total Estimated Cost"
            value={preview.totalEstimatedCost}
            prefix="$"
            precision={2}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="Estimated Fees"
            value={preview.totalEstimatedFees}
            prefix="$"
            precision={4}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title={
              <Space>
                Estimated Slippage
                <Tooltip content="Potential price impact from executing large orders">
                  <IconInfoCircle style={{ color: 'var(--color-text-3)' }} />
                </Tooltip>
              </Space>
            }
            value={preview.estimatedSlippage}
            prefix="$"
            precision={4}
          />
        </Col>
      </Row>

      {/* Execution Strategy */}
      <div style={{ marginTop: 16 }}>
        <Text type="secondary">
          Execution Strategy: <Text bold>{preview.executionStrategy.toUpperCase()}</Text>
        </Text>
      </div>
    </Card>
  );
};

export default RebalancePreviewComponent;
