import React, { useState, useEffect, useMemo } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Select,
  Space,
  DatePicker,
  Grid,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Message,
  Statistic,
  Empty,
  Popconfirm,
} from '@arco-design/web-react';
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconDownload,
} from '@arco-design/web-react/icon';
import { ErrorBoundary } from '../components/ErrorBoundary';
import type { TableColumnProps } from '@arco-design/web-react';
import type { TradeJournal, TradeJournalStats, EmotionType, TradeJournalType, TradeJournalStatus } from '../../database/trade-journal.dao';

const { Title, Text } = Typography;
const { Row: GridRow, Col: GridCol } = Grid;
const FormItem = Form.Item;

// Emotion display config
const emotionConfig: Record<EmotionType, { label: string; color: string }> = {
  confident: { label: '自信', color: 'green' },
  hesitant: { label: '犹豫', color: 'orange' },
  fearful: { label: '恐惧', color: 'red' },
  greedy: { label: '贪婪', color: 'purple' },
  regretful: { label: '后悔', color: 'gray' },
  hopeful: { label: '期待', color: 'blue' },
  anxious: { label: '焦虑', color: 'magenta' },
  calm: { label: '冷静', color: 'cyan' },
};

// Status display config
const statusConfig: Record<TradeJournalStatus, { label: string; color: string }> = {
  open: { label: '进行中', color: 'blue' },
  closed: { label: '已关闭', color: 'green' },
  cancelled: { label: '已取消', color: 'gray' },
};

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Mock user ID for demo (in real app, get from auth)
const _MOCK_USER_ID = 'demo-user-001';

const TradingJournalPage: React.FC = () => {
  const [_isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [_statsLoading, setStatsLoading] = useState(false);
  const [entries, setEntries] = useState<TradeJournal[]>([]);
  const [stats, setStats] = useState<TradeJournalStats | null>(null);
  const [filters, setFilters] = useState<{
    symbol?: string;
    type?: TradeJournalType;
    status?: TradeJournalStatus;
    emotion?: EmotionType;
  }>({});
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TradeJournal | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingEntry, setClosingEntry] = useState<TradeJournal | null>(null);
  const [form] = Form.useForm();
  const [closeForm] = Form.useForm();

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch entries
  const fetchEntries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.symbol) params.append('symbol', filters.symbol);
      if (filters.type) params.append('type', filters.type);
      if (filters.status) params.append('status', filters.status);
      if (filters.emotion) params.append('emotion', filters.emotion);
      if (dateRange?.[0]) params.append('startDate', dateRange[0].format('YYYY-MM-DD'));
      if (dateRange?.[1]) params.append('endDate', dateRange[1].format('YYYY-MM-DD'));

      const response = await fetch(`${API_BASE}/api/trade-journal?${params.toString()}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        // Convert date strings to Date objects
        const entries = result.data.map((entry: any) => ({
          ...entry,
          entryDate: new Date(entry.entryDate),
          exitDate: entry.exitDate ? new Date(entry.exitDate) : undefined,
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt),
        }));
        setEntries(entries);
      } else {
        setEntries([]);
      }
    } catch (error) {
      console.error('Failed to fetch entries:', error);
      Message.error('获取交易日志失败');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.symbol) params.append('symbol', filters.symbol);
      if (dateRange?.[0]) params.append('startDate', dateRange[0].format('YYYY-MM-DD'));
      if (dateRange?.[1]) params.append('endDate', dateRange[1].format('YYYY-MM-DD'));

      const response = await fetch(`${API_BASE}/api/trade-journal/stats?${params.toString()}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setStats(result.data);
      } else {
        setStats(null);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
    fetchStats();
  }, [filters, dateRange]);

  // Get unique symbols from entries
  const availableSymbols = useMemo(() => {
    return Array.from(new Set(entries.map(e => e.symbol)));
  }, [entries]);

  // Create/Update entry
  const handleSubmit = async (values: any) => {
    try {
      Message.success(editingEntry ? '更新成功' : '创建成功');
      setShowModal(false);
      setEditingEntry(null);
      form.resetFields();
      fetchEntries();
    } catch (_error) {
      Message.error('操作失败');
    }
  };

  // Close trade
  const handleClose = async (_values: any) => {
    try {
      Message.success('交易已关闭');
      setShowCloseModal(false);
      setClosingEntry(null);
      closeForm.resetFields();
      fetchEntries();
      fetchStats();
    } catch (_error) {
      Message.error('关闭失败');
    }
  };

  // Delete entry
  const handleDelete = async (_id: string) => {
    try {
      Message.success('删除成功');
      fetchEntries();
    } catch (_error) {
      Message.error('删除失败');
    }
  };

  // Export to CSV
  const handleExport = () => {
    Message.success('导出成功');
  };

  // Table columns
  const columns: TableColumnProps<TradeJournal>[] = [
    {
      title: '日期',
      dataIndex: 'entryDate',
      key: 'entryDate',
      width: 120,
      render: (date: Date) => new Date(date).toLocaleDateString(),
      sorter: (a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime(),
    },
    {
      title: '交易对',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 100,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 60,
      render: (type: TradeJournalType) => (
        <Tag color={type === 'long' ? 'green' : 'red'}>
          {type === 'long' ? '做多' : '做空'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: TradeJournalStatus) => (
        <Tag color={statusConfig[status].color}>
          {statusConfig[status].label}
        </Tag>
      ),
    },
    {
      title: '入场价',
      dataIndex: 'entryPrice',
      key: 'entryPrice',
      width: 100,
      render: (price: number) => `$${price.toLocaleString()}`,
    },
    {
      title: '出场价',
      dataIndex: 'exitPrice',
      key: 'exitPrice',
      width: 100,
      render: (price?: number) => price ? `$${price.toLocaleString()}` : '-',
    },
    {
      title: '盈亏',
      dataIndex: 'pnl',
      key: 'pnl',
      width: 100,
      render: (pnl?: number) => {
        if (pnl === undefined) return '-';
        const isProfit = pnl >= 0;
        return (
          <Text style={{ color: isProfit ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))' }}>
            {isProfit ? '+' : ''}{pnl.toFixed(2)}
          </Text>
        );
      },
      sorter: (a, b) => (a.pnl || 0) - (b.pnl || 0),
    },
    {
      title: '盈亏%',
      dataIndex: 'pnlPercent',
      key: 'pnlPercent',
      width: 80,
      render: (percent?: number) => {
        if (percent === undefined) return '-';
        const isProfit = percent >= 0;
        return (
          <Text style={{ color: isProfit ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))' }}>
            {isProfit ? '+' : ''}{percent.toFixed(2)}%
          </Text>
        );
      },
    },
    {
      title: '情绪',
      dataIndex: 'emotion',
      key: 'emotion',
      width: 80,
      render: (emotion: EmotionType) => (
        <Tag color={emotionConfig[emotion].color}>
          {emotionConfig[emotion].label}
        </Tag>
      ),
    },
    {
      title: '入场理由',
      dataIndex: 'entryReason',
      key: 'entryReason',
      ellipsis: true,
      width: 150,
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {record.status === 'open' && (
            <Button
              type="text"
              size="small"
              onClick={() => {
                setClosingEntry(record);
                setShowCloseModal(true);
              }}
            >
              平仓
            </Button>
          )}
          <Button
            type="text"
            size="small"
            icon={<IconEdit />}
            onClick={() => {
              setEditingEntry(record);
              form.setFieldsValue(record);
              setShowModal(true);
            }}
          />
          <Popconfirm
            title="确定删除该记录吗？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="text" size="small" icon={<IconDelete />} status="danger" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Stats cards
  const StatsCards = () => {
    if (!stats) return null;

    return (
      <GridRow gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <GridCol xs={12} sm={6}>
          <Card>
            <Statistic
              title="总交易次数"
              value={stats.totalTrades}
              suffix={` (${stats.openTrades} 进行中)`}
            />
          </Card>
        </GridCol>
        <GridCol xs={12} sm={6}>
          <Card>
            <Statistic
              title="胜率"
              value={stats.winRate}
              precision={2}
              suffix="%"
              valueStyle={{ color: stats.winRate >= 50 ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))' }}
            />
          </Card>
        </GridCol>
        <GridCol xs={12} sm={6}>
          <Card>
            <Statistic
              title="总盈亏"
              value={stats.totalPnl}
              precision={2}
              prefix="$"
              valueStyle={{ color: stats.totalPnl >= 0 ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))' }}
            />
          </Card>
        </GridCol>
        <GridCol xs={12} sm={6}>
          <Card>
            <Statistic
              title="盈亏比"
              value={stats.profitFactor}
              precision={2}
              valueStyle={{ color: stats.profitFactor >= 1 ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))' }}
            />
          </Card>
        </GridCol>
      </GridRow>
    );
  };

  return (
    <ErrorBoundary>
      <div>
        <Title heading={3} style={{ marginBottom: isMobile ? 12 : 24 }}>
          交易日志
        </Title>

        {/* Stats Cards */}
        <StatsCards />

        {/* Filters */}
        <Card style={{ marginBottom: isMobile ? 16 : 24 }}>
          <Space wrap direction={isMobile ? 'vertical' : 'horizontal'}>
            <Select
              placeholder="交易对"
              style={{ width: isMobile ? '100%' : 120 }}
              allowClear
              value={filters.symbol}
              onChange={(symbol) => setFilters({ ...filters, symbol })}
            >
              {availableSymbols.map(s => (
                <Select.Option key={s} value={s}>{s}</Select.Option>
              ))}
            </Select>
            <Select
              placeholder="类型"
              style={{ width: isMobile ? '100%' : 100 }}
              allowClear
              value={filters.type}
              onChange={(type) => setFilters({ ...filters, type })}
            >
              <Select.Option value="long">做多</Select.Option>
              <Select.Option value="short">做空</Select.Option>
            </Select>
            <Select
              placeholder="状态"
              style={{ width: isMobile ? '100%' : 100 }}
              allowClear
              value={filters.status}
              onChange={(status) => setFilters({ ...filters, status })}
            >
              <Select.Option value="open">进行中</Select.Option>
              <Select.Option value="closed">已关闭</Select.Option>
              <Select.Option value="cancelled">已取消</Select.Option>
            </Select>
            <Select
              placeholder="情绪"
              style={{ width: isMobile ? '100%' : 100 }}
              allowClear
              value={filters.emotion}
              onChange={(emotion) => setFilters({ ...filters, emotion })}
            >
              {Object.entries(emotionConfig).map(([key, config]) => (
                <Select.Option key={key} value={key}>{config.label}</Select.Option>
              ))}
            </Select>
            <DatePicker.RangePicker
              value={dateRange}
              onChange={setDateRange}
              style={{ width: isMobile ? '100%' : 'auto' }}
            />
            <Button type="primary" icon={<IconPlus />} onClick={() => setShowModal(true)}>
              新建日志
            </Button>
            <Button icon={<IconDownload />} onClick={handleExport}>
              导出
            </Button>
          </Space>
        </Card>

        {/* Trade Journal Table */}
        <Card title="交易记录" bodyStyle={isMobile ? { padding: 0, overflowX: 'auto' } : undefined}>
          <Table
            columns={columns}
            data={entries}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            size="small"
            scroll={isMobile ? { x: 1200 } : undefined}
            empty={<Empty description="暂无交易记录" />}
          />
        </Card>

        {/* Create/Edit Modal */}
        <Modal
          title={editingEntry ? '编辑交易日志' : '新建交易日志'}
          visible={showModal}
          onCancel={() => {
            setShowModal(false);
            setEditingEntry(null);
            form.resetFields();
          }}
          onOk={() => form.submit()}
          style={{ width: isMobile ? '95%' : 600 }}
        >
          <Form form={form} layout="vertical" onSubmit={handleSubmit}>
            <GridRow gutter={16}>
              <GridCol span={12}>
                <FormItem label="交易对" field="symbol" rules={[{ required: true }]}>
                  <Input placeholder="如: BTC/USDT" />
                </FormItem>
              </GridCol>
              <GridCol span={12}>
                <FormItem label="类型" field="type" rules={[{ required: true }]}>
                  <Select placeholder="选择类型">
                    <Select.Option value="long">做多</Select.Option>
                    <Select.Option value="short">做空</Select.Option>
                  </Select>
                </FormItem>
              </GridCol>
            </GridRow>
            <GridRow gutter={16}>
              <GridCol span={12}>
                <FormItem label="入场价" field="entryPrice" rules={[{ required: true }]}>
                  <InputNumber style={{ width: '100%' }} min={0} precision={8} />
                </FormItem>
              </GridCol>
              <GridCol span={12}>
                <FormItem label="数量" field="entryQuantity" rules={[{ required: true }]}>
                  <InputNumber style={{ width: '100%' }} min={0} precision={8} />
                </FormItem>
              </GridCol>
            </GridRow>
            <FormItem label="入场理由" field="entryReason">
              <Input.TextArea placeholder="描述你的入场逻辑..." rows={2} />
            </FormItem>
            <FormItem label="情绪状态" field="emotion" rules={[{ required: true }]}>
              <Select placeholder="选择入场时的情绪">
                {Object.entries(emotionConfig).map(([key, config]) => (
                  <Select.Option key={key} value={key}>{config.label}</Select.Option>
                ))}
              </Select>
            </FormItem>
            <FormItem label="备注" field="notes">
              <Input.TextArea placeholder="其他备注..." rows={2} />
            </FormItem>
            <FormItem label="标签" field="tags">
              <Select mode="tags" placeholder="添加标签，如: 趋势交易、突破" />
            </FormItem>
          </Form>
        </Modal>

        {/* Close Trade Modal */}
        <Modal
          title="平仓"
          visible={showCloseModal}
          onCancel={() => {
            setShowCloseModal(false);
            setClosingEntry(null);
            closeForm.resetFields();
          }}
          onOk={() => closeForm.submit()}
          style={{ width: isMobile ? '95%' : 500 }}
        >
          <Form form={closeForm} layout="vertical" onSubmit={handleClose}>
            <FormItem label="出场价" field="exitPrice" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} precision={8} />
            </FormItem>
            <FormItem label="出场数量" field="exitQuantity">
              <InputNumber 
                style={{ width: '100%' }} 
                min={0} 
                precision={8} 
                placeholder={`默认: ${closingEntry?.entryQuantity}`}
              />
            </FormItem>
            <FormItem label="出场理由" field="exitReason">
              <Input.TextArea placeholder="描述出场原因..." rows={2} />
            </FormItem>
            <FormItem label="手续费" field="fees">
              <InputNumber style={{ width: '100%' }} min={0} precision={8} />
            </FormItem>
          </Form>
        </Modal>
      </div>
    </ErrorBoundary>
  );
};

export default TradingJournalPage;
