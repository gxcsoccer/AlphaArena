/**
 * BacktestHistory Component
 * VIP-only feature for saving and loading backtest records
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Message,
  Popconfirm,
  Drawer,
  Descriptions,
  Empty,
  Spin,
  Modal,
  Input,
} from '@arco-design/web-react';
import {
  IconDelete,
  IconEye,
  IconDownload,
  IconRefresh,
  IconStar,
  IconStarFill,
  IconExport,
} from '@arco-design/web-react/icon';
import { useSubscription } from '../hooks/useSubscription';
import FeatureGate from './FeatureGate';
import { createLogger } from '../../utils/logger';

const log = createLogger('BacktestHistory');
const { Title, Text } = Typography;

// Saved backtest record
export interface BacktestRecord {
  id: string;
  name: string;
  symbol: string;
  strategy: string;
  strategyParams: Record<string, number>;
  dateRange: [number, number];
  initialCapital: number;
  stats: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
    profitFactor: number;
  };
  createdAt: number;
  starred: boolean;
  tags: string[];
}

interface BacktestHistoryProps {
  onLoadRecord?: (record: BacktestRecord) => void;
  currentResult?: any;
}

/**
 * BacktestHistory Component
 * Provides VIP users with the ability to save and load backtest records
 */
const BacktestHistory: React.FC<BacktestHistoryProps> = ({
  onLoadRecord,
  currentResult,
}) => {
  const { isPro } = useSubscription();
  const [records, setRecords] = useState<BacktestRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<BacktestRecord | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [recordName, setRecordName] = useState('');

  // Load records from localStorage
  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = useCallback(() => {
    setLoading(true);
    try {
      const savedRecords = localStorage.getItem('backtest_history');
      if (savedRecords) {
        setRecords(JSON.parse(savedRecords));
      }
    } catch (err) {
      log.error('Failed to load records', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveRecords = useCallback((newRecords: BacktestRecord[]) => {
    setRecords(newRecords);
    localStorage.setItem('backtest_history', JSON.stringify(newRecords));
  }, []);

  // Save current result as a record
  const handleSaveCurrentResult = useCallback(() => {
    if (!currentResult) {
      Message.warning('没有可保存的回测结果');
      return;
    }
    setSaveModalVisible(true);
    setRecordName(`回测-${currentResult.config?.strategy}-${new Date().toLocaleDateString()}`);
  }, [currentResult]);

  const confirmSave = useCallback(() => {
    if (!currentResult || !recordName.trim()) {
      Message.warning('请输入记录名称');
      return;
    }

    const newRecord: BacktestRecord = {
      id: `record-${Date.now()}`,
      name: recordName.trim(),
      symbol: currentResult.config?.symbol || '',
      strategy: currentResult.config?.strategy || '',
      strategyParams: currentResult.config?.strategyParams || {},
      dateRange: currentResult.config?.dateRange || [Date.now() - 90 * 24 * 60 * 60 * 1000, Date.now()],
      initialCapital: currentResult.config?.capital || 10000,
      stats: {
        totalReturn: currentResult.stats?.totalReturn || 0,
        sharpeRatio: currentResult.stats?.sharpeRatio || 0,
        maxDrawdown: currentResult.stats?.maxDrawdown || 0,
        winRate: currentResult.stats?.winRate || 0,
        totalTrades: currentResult.stats?.totalTrades || 0,
        profitFactor: currentResult.stats?.profitFactor || 0,
      },
      createdAt: Date.now(),
      starred: false,
      tags: [],
    };

    saveRecords([newRecord, ...records]);
    setSaveModalVisible(false);
    setRecordName('');
    Message.success('回测记录已保存');
  }, [currentResult, recordName, records, saveRecords]);

  // Delete a record
  const deleteRecord = useCallback((id: string) => {
    saveRecords(records.filter((r) => r.id !== id));
    Message.success('记录已删除');
  }, [records, saveRecords]);

  // Toggle star
  const toggleStar = useCallback((id: string) => {
    saveRecords(
      records.map((r) => (r.id === id ? { ...r, starred: !r.starred } : r))
    );
  }, [records, saveRecords]);

  // Load a record
  const loadRecord = useCallback((record: BacktestRecord) => {
    setSelectedRecord(record);
    setDetailVisible(true);
    if (onLoadRecord) {
      onLoadRecord(record);
    }
    Message.success(`已加载: ${record.name}`);
  }, [onLoadRecord]);

  // View details
  const viewDetails = useCallback((record: BacktestRecord) => {
    setSelectedRecord(record);
    setDetailVisible(true);
  }, []);

  // Export all records
  const exportAllRecords = useCallback(() => {
    if (records.length === 0) {
      Message.warning('没有可导出的记录');
      return;
    }

    const data = {
      exportedAt: new Date().toISOString(),
      records: records,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backtest-history-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    Message.success('记录已导出');
  }, [records]);

  // Export single record
  const exportRecord = useCallback((record: BacktestRecord) => {
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${record.name.replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);

    Message.success('记录已导出');
  }, []);

  // Table columns
  const columns = [
    {
      title: '',
      dataIndex: 'starred',
      width: 40,
      render: (starred: boolean, record: BacktestRecord) => (
        <Button
          type="text"
          size="small"
          onClick={() => toggleStar(record.id)}
          icon={starred ? <IconStarFill style={{ color: '#faad14' }} /> : <IconStar />}
        />
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      width: 200,
      render: (name: string, record: BacktestRecord) => (
        <Space>
          <Text bold>{name}</Text>
          {record.starred && <Tag color="gold" size="small">收藏</Tag>}
        </Space>
      ),
    },
    {
      title: '交易对',
      dataIndex: 'symbol',
      width: 100,
      render: (symbol: string) => <Tag color="blue">{symbol}</Tag>,
    },
    {
      title: '策略',
      dataIndex: 'strategy',
      width: 100,
      render: (strategy: string) => <Tag color="green">{strategy.toUpperCase()}</Tag>,
    },
    {
      title: '收益率',
      dataIndex: ['stats', 'totalReturn'],
      width: 100,
      render: (value: number) => (
        <Text style={{ color: value >= 0 ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))' }}>
          {value >= 0 ? '+' : ''}{value.toFixed(2)}%
        </Text>
      ),
    },
    {
      title: 'Sharpe',
      dataIndex: ['stats', 'sharpeRatio'],
      width: 80,
      render: (value: number) => value.toFixed(2),
    },
    {
      title: '最大回撤',
      dataIndex: ['stats', 'maxDrawdown'],
      width: 100,
      render: (value: number) => (
        <Text type="danger">-{value.toFixed(2)}%</Text>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 150,
      render: (timestamp: number) => new Date(timestamp).toLocaleString(),
    },
    {
      title: '操作',
      width: 200,
      render: (_: any, record: BacktestRecord) => (
        <Space>
          <Button size="small" icon={<IconEye />} onClick={() => viewDetails(record)}>
            详情
          </Button>
          <Button size="small" type="primary" onClick={() => loadRecord(record)}>
            加载
          </Button>
          <Popconfirm
            title="确定删除该记录？"
            onOk={() => deleteRecord(record.id)}
          >
            <Button size="small" status="danger" icon={<IconDelete />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <FeatureGate featureKey="backtest_history" featureName="回测历史记录">
      <Card
        title={
          <Space>
            <span>回测历史记录</span>
            <Text type="secondary" style={{ fontSize: 12 }}>
              共 {records.length} 条记录
            </Text>
          </Space>
        }
        extra={
          <Space>
            {currentResult && (
              <Button type="primary" onClick={handleSaveCurrentResult}>
                保存当前结果
              </Button>
            )}
            <Button icon={<IconRefresh />} onClick={loadRecords}>
              刷新
            </Button>
            <Button icon={<IconExport />} onClick={exportAllRecords} disabled={records.length === 0}>
              导出全部
            </Button>
          </Space>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : records.length === 0 ? (
          <Empty description="暂无保存的回测记录" />
        ) : (
          <Table
            columns={columns}
            data={records}
            pagination={{ pageSize: 10 }}
            rowKey="id"
            scroll={{ x: 1000 }}
          />
        )}

        {/* Detail Drawer */}
        <Drawer
          title="回测详情"
          visible={detailVisible}
          onClose={() => setDetailVisible(false)}
          width={600}
        >
          {selectedRecord && (
            <Space direction="vertical" style={{ width: '100%' }} size="medium">
              <Descriptions column={2} bordered>
                <Descriptions.Item label="名称" span={2}>{selectedRecord.name}</Descriptions.Item>
                <Descriptions.Item label="交易对">{selectedRecord.symbol}</Descriptions.Item>
                <Descriptions.Item label="策略">{selectedRecord.strategy.toUpperCase()}</Descriptions.Item>
                <Descriptions.Item label="初始资金">${selectedRecord.initialCapital.toLocaleString()}</Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {new Date(selectedRecord.createdAt).toLocaleString()}
                </Descriptions.Item>
              </Descriptions>

              <Title heading={5}>收益指标</Title>
              <Descriptions column={2} bordered>
                <Descriptions.Item label="总收益率">
                  <Text style={{ color: selectedRecord.stats.totalReturn >= 0 ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))' }}>
                    {selectedRecord.stats.totalReturn >= 0 ? '+' : ''}{selectedRecord.stats.totalReturn.toFixed(2)}%
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Sharpe 比率">{selectedRecord.stats.sharpeRatio.toFixed(2)}</Descriptions.Item>
                <Descriptions.Item label="最大回撤">
                  <Text type="danger">-{selectedRecord.stats.maxDrawdown.toFixed(2)}%</Text>
                </Descriptions.Item>
                <Descriptions.Item label="胜率">{selectedRecord.stats.winRate.toFixed(1)}%</Descriptions.Item>
                <Descriptions.Item label="盈利因子">{selectedRecord.stats.profitFactor.toFixed(2)}</Descriptions.Item>
                <Descriptions.Item label="总交易次数">{selectedRecord.stats.totalTrades}</Descriptions.Item>
              </Descriptions>

              <Title heading={5}>策略参数</Title>
              <Descriptions column={2} bordered>
                {Object.entries(selectedRecord.strategyParams).map(([key, value]) => (
                  <Descriptions.Item key={key} label={key}>{value}</Descriptions.Item>
                ))}
              </Descriptions>

              <Space>
                <Button type="primary" onClick={() => {
                  loadRecord(selectedRecord);
                  setDetailVisible(false);
                }}>
                  加载此配置
                </Button>
                <Button onClick={() => exportRecord(selectedRecord)}>
                  导出
                </Button>
              </Space>
            </Space>
          )}
        </Drawer>

        {/* Save Modal */}
        <Modal
          title="保存回测记录"
          visible={saveModalVisible}
          onOk={confirmSave}
          onCancel={() => setSaveModalVisible(false)}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text>记录名称</Text>
            <Input
              value={recordName}
              onChange={setRecordName}
              placeholder="请输入记录名称"
            />
          </Space>
        </Modal>

        {/* Info */}
        <div style={{ background: 'var(--color-fill-1)', padding: 12, borderRadius: 4, marginTop: 16 }}>
          <Text bold>VIP 回测历史功能</Text>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-2)' }}>
            <div>✓ 保存回测配置和结果</div>
            <div>✓ 快速加载历史配置</div>
            <div>✓ 收藏常用配置</div>
            <div>✓ 导出和分享回测记录</div>
          </div>
        </div>
      </Card>
    </FeatureGate>
  );
};

export default BacktestHistory;