/**
 * Signal History Comparison Component
 * Compare signal predictions with actual market outcomes
 * Issue #670: 策略信号通知增强
 */

import React, { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Typography,
  Tag,
  Space,
  Button,
  DatePicker,
  Select,
  Statistic,
  Row,
  Col,
  Progress,
  Empty,
  Spin,
  Tooltip,
} from '@arco-design/web-react';
import {
  IconTrendingUp,
  IconTrendingDown,
  IconCheckCircle,
  IconCloseCircle,
  IconMinusCircle,
  IconFilter,
  IconRefresh,
  IconExport,
} from '@arco-design/web-react/icon';
import type { ColumnProps } from '@arco-design/web-react/es/Table';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface SignalComparison {
  signalId: string;
  signalTitle?: string;
  signalType: string;
  side: 'buy' | 'sell';
  symbol: string;
  entryPrice?: number;
  targetPrice?: number;
  stopLossPrice?: number;
  signalConfidence?: number;
  signalCreatedAt: Date;
  currentPrice?: number;
  pnlPercent?: number;
  outcome: 'hit_target' | 'hit_stop_loss' | 'expired' | 'active' | 'unknown';
}

interface SignalStats {
  totalSignals: number;
  hitTarget: number;
  hitStopLoss: number;
  expired: number;
  active: number;
  winRate: number;
  avgPnl: number;
  bestSignal?: SignalComparison;
  worstSignal?: SignalComparison;
}

const SignalHistoryComparison: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [signals, setSignals] = useState<SignalComparison[]>([]);
  const [stats, setStats] = useState<SignalStats | null>(null);
  const [filters, setFilters] = useState({
    symbol: undefined as string | undefined,
    strategy: undefined as string | undefined,
    dateRange: undefined as [Date, Date] | undefined,
    outcome: undefined as string | undefined,
  });

  useEffect(() => {
    loadSignalData();
  }, [filters]);

  const loadSignalData = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // Simulating API response
      await new Promise(resolve => setTimeout(resolve, 500));

      const mockSignals: SignalComparison[] = [
        {
          signalId: 'sig-1',
          signalTitle: 'BTC 突破策略',
          signalType: 'entry',
          side: 'buy',
          symbol: 'BTC',
          entryPrice: 50000,
          targetPrice: 55000,
          stopLossPrice: 48000,
          signalConfidence: 0.85,
          signalCreatedAt: new Date('2024-03-25'),
          currentPrice: 54000,
          pnlPercent: 8,
          outcome: 'hit_target',
        },
        {
          signalId: 'sig-2',
          signalTitle: 'ETH 均线策略',
          signalType: 'entry',
          side: 'sell',
          symbol: 'ETH',
          entryPrice: 3200,
          targetPrice: 2800,
          stopLossPrice: 3500,
          signalConfidence: 0.72,
          signalCreatedAt: new Date('2024-03-24'),
          currentPrice: 3500,
          pnlPercent: -9.4,
          outcome: 'hit_stop_loss',
        },
        {
          signalId: 'sig-3',
          signalTitle: 'SOL 动量策略',
          signalType: 'entry',
          side: 'buy',
          symbol: 'SOL',
          entryPrice: 120,
          targetPrice: 140,
          stopLossPrice: 110,
          signalConfidence: 0.68,
          signalCreatedAt: new Date('2024-03-26'),
          currentPrice: 135,
          pnlPercent: 12.5,
          outcome: 'active',
        },
        {
          signalId: 'sig-4',
          signalTitle: 'BNB 趋势跟踪',
          signalType: 'entry',
          side: 'buy',
          symbol: 'BNB',
          entryPrice: 450,
          targetPrice: 500,
          stopLossPrice: 420,
          signalConfidence: 0.78,
          signalCreatedAt: new Date('2024-03-23'),
          currentPrice: 430,
          pnlPercent: -4.4,
          outcome: 'expired',
        },
        {
          signalId: 'sig-5',
          signalTitle: 'XRP 突破策略',
          signalType: 'entry',
          side: 'buy',
          symbol: 'XRP',
          entryPrice: 0.55,
          targetPrice: 0.65,
          stopLossPrice: 0.50,
          signalConfidence: 0.82,
          signalCreatedAt: new Date('2024-03-22'),
          currentPrice: 0.62,
          pnlPercent: 12.7,
          outcome: 'hit_target',
        },
      ];

      setSignals(mockSignals);

      // Calculate stats
      const totalSignals = mockSignals.length;
      const hitTarget = mockSignals.filter(s => s.outcome === 'hit_target').length;
      const hitStopLoss = mockSignals.filter(s => s.outcome === 'hit_stop_loss').length;
      const expired = mockSignals.filter(s => s.outcome === 'expired').length;
      const active = mockSignals.filter(s => s.outcome === 'active').length;
      const winRate = totalSignals > 0 ? (hitTarget / totalSignals) * 100 : 0;
      const pnlSignals = mockSignals.filter(s => s.pnlPercent !== undefined);
      const avgPnl = pnlSignals.length > 0
        ? pnlSignals.reduce((sum, s) => sum + (s.pnlPercent || 0), 0) / pnlSignals.length
        : 0;

      const sortedByPnl = [...mockSignals].sort((a, b) => (b.pnlPercent || 0) - (a.pnlPercent || 0));
      const bestSignal = sortedByPnl[0];
      const worstSignal = sortedByPnl[sortedByPnl.length - 1];

      setStats({
        totalSignals,
        hitTarget,
        hitStopLoss,
        expired,
        active,
        winRate,
        avgPnl,
        bestSignal,
        worstSignal,
      });
    } catch (error) {
      console.error('Failed to load signal data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Export signal history');
  };

  const outcomeConfig = {
    hit_target: { color: 'green', icon: <IconCheckCircle />, text: '达标' },
    hit_stop_loss: { color: 'red', icon: <IconCloseCircle />, text: '止损' },
    expired: { color: 'gray', icon: <IconMinusCircle />, text: '过期' },
    active: { color: 'blue', icon: <IconTrendingUp />, text: '进行中' },
    unknown: { color: 'gray', icon: <IconMinusCircle />, text: '未知' },
  };

  const columns: ColumnProps<SignalComparison>[] = [
    {
      title: '信号',
      dataIndex: 'signalTitle',
      key: 'signalTitle',
      render: (title: string, record) => (
        <Space direction="vertical" size={2}>
          <Text bold>{title || `${record.symbol} ${record.side === 'buy' ? '买入' : '卖出'}`}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {new Date(record.signalCreatedAt).toLocaleDateString('zh-CN')}
          </Text>
        </Space>
      ),
    },
    {
      title: '币种',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 80,
      render: (symbol: string) => <Tag color="arcoblue">{symbol}</Tag>,
    },
    {
      title: '方向',
      dataIndex: 'side',
      key: 'side',
      width: 80,
      render: (side: string) => (
        <Tag color={side === 'buy' ? 'green' : 'red'}>
          {side === 'buy' ? <IconTrendingUp /> : <IconTrendingDown />} {side === 'buy' ? '买入' : '卖出'}
        </Tag>
      ),
    },
    {
      title: '入场价',
      dataIndex: 'entryPrice',
      key: 'entryPrice',
      width: 100,
      align: 'right',
      render: (price: number) => price?.toLocaleString() || '-',
    },
    {
      title: '目标价',
      dataIndex: 'targetPrice',
      key: 'targetPrice',
      width: 100,
      align: 'right',
      render: (price: number) => price?.toLocaleString() || '-',
    },
    {
      title: '止损价',
      dataIndex: 'stopLossPrice',
      key: 'stopLossPrice',
      width: 100,
      align: 'right',
      render: (price: number) => price?.toLocaleString() || '-',
    },
    {
      title: '置信度',
      dataIndex: 'signalConfidence',
      key: 'signalConfidence',
      width: 120,
      render: (confidence: number) => (
        <Progress
          percent={confidence * 100}
          size="small"
          style={{ width: 80 }}
          color={confidence >= 0.8 ? 'green' : confidence >= 0.6 ? 'orange' : 'red'}
        />
      ),
    },
    {
      title: '盈亏',
      dataIndex: 'pnlPercent',
      key: 'pnlPercent',
      width: 100,
      align: 'right',
      render: (pnl: number) => {
        if (pnl === undefined) return '-';
        const color = pnl >= 0 ? 'var(--color-success-6)' : 'var(--color-danger-6)';
        const icon = pnl >= 0 ? <IconTrendingUp /> : <IconTrendingDown />;
        return (
          <Text style={{ color, fontWeight: 'bold' }}>
            {icon} {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
          </Text>
        );
      },
    },
    {
      title: '结果',
      dataIndex: 'outcome',
      key: 'outcome',
      width: 100,
      render: (outcome: keyof typeof outcomeConfig) => {
        const config = outcomeConfig[outcome] || outcomeConfig.unknown;
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        );
      },
    },
  ];

  if (loading) {
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Spin size={40} />
        </div>
      </Card>
    );
  }

  return (
    <div className="signal-history-comparison">
      {/* Statistics Overview */}
      {stats && (
        <Card style={{ marginBottom: 16 }}>
          <Title heading={5}>信号表现统计</Title>
          <Row gutter={24} style={{ marginTop: 16 }}>
            <Col span={4}>
              <Statistic
                title="总信号数"
                value={stats.totalSignals}
                suffix="个"
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="达标率"
                value={stats.winRate.toFixed(1)}
                suffix="%"
                valueStyle={{ color: stats.winRate >= 50 ? 'var(--color-success-6)' : 'var(--color-danger-6)' }}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="平均盈亏"
                value={stats.avgPnl.toFixed(2)}
                suffix="%"
                valueStyle={{ color: stats.avgPnl >= 0 ? 'var(--color-success-6)' : 'var(--color-danger-6)' }}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="达标"
                value={stats.hitTarget}
                prefix={<IconCheckCircle style={{ color: 'var(--color-success-6)' }} />}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="止损"
                value={stats.hitStopLoss}
                prefix={<IconCloseCircle style={{ color: 'var(--color-danger-6)' }} />}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="进行中"
                value={stats.active}
                prefix={<IconTrendingUp style={{ color: 'var(--color-primary-6)' }} />}
              />
            </Col>
          </Row>

          {stats.bestSignal && stats.worstSignal && (
            <Row gutter={24} style={{ marginTop: 24 }}>
              <Col span={12}>
                <Card bordered={false} style={{ background: 'var(--color-success-light-1)' }}>
                  <Text type="secondary">最佳信号</Text>
                  <div style={{ marginTop: 8 }}>
                    <Text bold>{stats.bestSignal.signalTitle}</Text>
                    <Tag color="green" style={{ marginLeft: 8 }}>
                      +{stats.bestSignal.pnlPercent?.toFixed(2)}%
                    </Tag>
                  </div>
                </Card>
              </Col>
              <Col span={12}>
                <Card bordered={false} style={{ background: 'var(--color-danger-light-1)' }}>
                  <Text type="secondary">最差信号</Text>
                  <div style={{ marginTop: 8 }}>
                    <Text bold>{stats.worstSignal.signalTitle}</Text>
                    <Tag color="red" style={{ marginLeft: 8 }}>
                      {stats.worstSignal.pnlPercent?.toFixed(2)}%
                    </Tag>
                  </div>
                </Card>
              </Col>
            </Row>
          )}
        </Card>
      )}

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="选择币种"
            style={{ width: 150 }}
            allowClear
            onChange={(value) => setFilters(prev => ({ ...prev, symbol: value }))}
          >
            <Select.Option value="BTC">BTC</Select.Option>
            <Select.Option value="ETH">ETH</Select.Option>
            <Select.Option value="SOL">SOL</Select.Option>
            <Select.Option value="BNB">BNB</Select.Option>
            <Select.Option value="XRP">XRP</Select.Option>
          </Select>

          <Select
            placeholder="选择结果"
            style={{ width: 150 }}
            allowClear
            onChange={(value) => setFilters(prev => ({ ...prev, outcome: value }))}
          >
            <Select.Option value="hit_target">达标</Select.Option>
            <Select.Option value="hit_stop_loss">止损</Select.Option>
            <Select.Option value="active">进行中</Select.Option>
            <Select.Option value="expired">过期</Select.Option>
          </Select>

          <RangePicker
            style={{ width: 260 }}
            onChange={(value) => {
              if (value && value.length === 2) {
                setFilters(prev => ({
                  ...prev,
                  dateRange: [new Date(value[0]), new Date(value[1])],
                }));
              } else {
                setFilters(prev => ({ ...prev, dateRange: undefined }));
              }
            }}
          />

          <Button icon={<IconRefresh />} onClick={loadSignalData}>
            刷新
          </Button>

          <Button icon={<IconExport />} onClick={handleExport}>
            导出
          </Button>
        </Space>
      </Card>

      {/* Signal Table */}
      <Card>
        <Title heading={5}>信号历史记录</Title>
        <Text type="secondary">查看信号预测与实际市场走势的对比</Text>

        {signals.length === 0 ? (
          <Empty
            description="暂无信号记录"
            style={{ padding: '40px 0' }}
          />
        ) : (
          <Table
            columns={columns}
            data={signals}
            rowKey="signalId"
            style={{ marginTop: 16 }}
            pagination={{
              pageSize: 10,
              showTotal: true,
              showJumper: true,
            }}
            border={{
              wrapper: true,
              cell: true,
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default SignalHistoryComparison;