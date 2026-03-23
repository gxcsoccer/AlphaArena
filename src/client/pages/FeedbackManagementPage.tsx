/**
 * FeedbackManagementPage - User Feedback Management Dashboard
 *
 * Admin-only page for managing user feedback including:
 * - Feedback list with filtering and search
 * - Status and priority management
 * - Statistics panel
 * - Detailed feedback view
 *
 * @module pages/FeedbackManagementPage
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Card,
  Grid,
  Table,
  Tag,
  Button,
  Space,
  Input,
  Select,
  DatePicker,
  Modal,
  Message,
  Spin,
  Empty,
  Statistic,
  Badge,
  Descriptions,
  Divider,
  Popconfirm,
  Tooltip,
  Avatar,
} from '@arco-design/web-react';
import {
  IconBug,
  IconBulb,
  IconMessage,
  IconSearch,
  IconRefresh,
  IconEye,
  IconDelete,
  IconCheck,
  IconClose,
  IconClockCircle,
  IconExclamationCircle,
  IconFilter,
  IconDownload,
  IconUser,
  IconCalendar,
} from '@arco-design/web-react/icon';
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useAuth } from '../hooks/useAuth';
import { ErrorBoundary } from '../components/ErrorBoundary';

const { Title, Text, Paragraph } = Typography;
const { Row, Col } = Grid;
const { RangePicker } = DatePicker;

// Types - Extended from feedback DAO
export enum FeedbackType {
  BUG = 'bug',
  SUGGESTION = 'suggestion',
  OTHER = 'other',
}

export enum FeedbackStatus {
  NEW = 'new',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum FeedbackPriority {
  P0 = 'p0', // Critical/Urgent
  P1 = 'p1', // High
  P2 = 'p2', // Medium
  P3 = 'p3', // Low
}

export interface Feedback {
  id: string;
  userId?: string;
  type: FeedbackType;
  description: string;
  screenshot?: string;
  screenshotName?: string;
  contactInfo?: string;
  environment: {
    url: string;
    userAgent: string;
    screenSize: string;
    timestamp: string;
    locale: string;
    referrer: string;
  };
  status: FeedbackStatus;
  priority: FeedbackPriority;
  tags?: string[];
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface FeedbackStats {
  total: number;
  byType: Record<FeedbackType, number>;
  byStatus: Record<FeedbackStatus, number>;
  byPriority: Record<FeedbackPriority, number>;
  recentTrend: { date: string; count: number }[];
}

// Status colors
const STATUS_COLORS: Record<FeedbackStatus, string> = {
  [FeedbackStatus.NEW]: 'arcoblue',
  [FeedbackStatus.CONFIRMED]: 'gold',
  [FeedbackStatus.IN_PROGRESS]: 'orange',
  [FeedbackStatus.RESOLVED]: 'green',
  [FeedbackStatus.CLOSED]: 'gray',
};

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  [FeedbackStatus.NEW]: '新建',
  [FeedbackStatus.CONFIRMED]: '已确认',
  [FeedbackStatus.IN_PROGRESS]: '进行中',
  [FeedbackStatus.RESOLVED]: '已解决',
  [FeedbackStatus.CLOSED]: '已关闭',
};

// Type colors
const TYPE_COLORS: Record<FeedbackType, string> = {
  [FeedbackType.BUG]: 'red',
  [FeedbackType.SUGGESTION]: 'green',
  [FeedbackType.OTHER]: 'gray',
};

const TYPE_LABELS: Record<FeedbackType, string> = {
  [FeedbackType.BUG]: 'Bug 报告',
  [FeedbackType.SUGGESTION]: '功能建议',
  [FeedbackType.OTHER]: '其他',
};

const TYPE_ICONS: Record<FeedbackType, React.ReactNode> = {
  [FeedbackType.BUG]: <IconBug />,
  [FeedbackType.SUGGESTION]: <IconBulb />,
  [FeedbackType.OTHER]: <IconMessage />,
};

// Priority colors
const PRIORITY_COLORS: Record<FeedbackPriority, string> = {
  [FeedbackPriority.P0]: 'red',
  [FeedbackPriority.P1]: 'orange',
  [FeedbackPriority.P2]: 'gold',
  [FeedbackPriority.P3]: 'gray',
};

const PRIORITY_LABELS: Record<FeedbackPriority, string> = {
  [FeedbackPriority.P0]: 'P0 紧急',
  [FeedbackPriority.P1]: 'P1 高',
  [FeedbackPriority.P2]: 'P2 中',
  [FeedbackPriority.P3]: 'P3 低',
};

// Chart colors
const CHART_COLORS = ['#165DFF', '#14C9C9', '#F7BA1E', '#F53F3F', '#722ED1'];

const FeedbackManagementPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Filters
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | undefined>();
  const [typeFilter, setTypeFilter] = useState<FeedbackType | undefined>();
  const [priorityFilter, setPriorityFilter] = useState<FeedbackPriority | undefined>();
  const [dateRange, setDateRange] = useState<[Date, Date] | undefined>();
  
  // Pagination
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    fetchFeedbacks();
    fetchStats();
  }, [statusFilter, typeFilter, priorityFilter, dateRange, pagination.current, pagination.pageSize]);

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('supabase_token');
      const params = new URLSearchParams();
      
      if (statusFilter) params.append('status', statusFilter);
      if (typeFilter) params.append('type', typeFilter);
      if (priorityFilter) params.append('priority', priorityFilter);
      if (dateRange) {
        params.append('startDate', dateRange[0].toISOString());
        params.append('endDate', dateRange[1].toISOString());
      }
      if (searchKeyword) params.append('search', searchKeyword);
      params.append('limit', String(pagination.pageSize));
      params.append('offset', String((pagination.current - 1) * pagination.pageSize));

      const response = await fetch(`/api/feedback?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          Message.error('您没有访问此页面的权限');
          return;
        }
        throw new Error('Failed to fetch feedbacks');
      }

      const data = await response.json();
      setFeedbacks(data.data || []);
      setPagination(prev => ({ ...prev, total: data.total || data.data?.length || 0 }));
    } catch (error) {
      console.error('Failed to fetch feedbacks:', error);
      Message.error('加载反馈列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('supabase_token');
      const response = await fetch('/api/feedback/stats/summary', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch stats');

      const data = await response.json();
      
      // Transform stats to include priority and trend
      const statsData = data.data || {};
      setStats({
        total: statsData.total || 0,
        byType: {
          [FeedbackType.BUG]: statsData.byType?.bug || 0,
          [FeedbackType.SUGGESTION]: statsData.byType?.suggestion || 0,
          [FeedbackType.OTHER]: statsData.byType?.other || 0,
        },
        byStatus: {
          [FeedbackStatus.NEW]: statsData.byStatus?.new || 0,
          [FeedbackStatus.CONFIRMED]: 0,
          [FeedbackStatus.IN_PROGRESS]: statsData.byStatus?.in_progress || 0,
          [FeedbackStatus.RESOLVED]: statsData.byStatus?.resolved || 0,
          [FeedbackStatus.CLOSED]: statsData.byStatus?.closed || 0,
        },
        byPriority: {
          [FeedbackPriority.P0]: 0,
          [FeedbackPriority.P1]: 0,
          [FeedbackPriority.P2]: 0,
          [FeedbackPriority.P3]: 0,
        },
        recentTrend: [],
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const updateFeedbackStatus = async (id: string, status: FeedbackStatus, adminNotes?: string) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('supabase_token');
      const response = await fetch(`/api/feedback/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, adminNotes }),
      });

      if (!response.ok) throw new Error('Failed to update status');

      Message.success('状态更新成功');
      fetchFeedbacks();
      fetchStats();
      
      if (selectedFeedback?.id === id) {
        setSelectedFeedback(prev => prev ? { ...prev, status, updatedAt: new Date() } : null);
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      Message.error('更新状态失败');
    }
  };

  const updateFeedbackPriority = async (id: string, priority: FeedbackPriority) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('supabase_token');
      const response = await fetch(`/api/feedback/${id}/priority`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priority }),
      });

      if (!response.ok) throw new Error('Failed to update priority');

      Message.success('优先级更新成功');
      fetchFeedbacks();
      
      if (selectedFeedback?.id === id) {
        setSelectedFeedback(prev => prev ? { ...prev, priority, updatedAt: new Date() } : null);
      }
    } catch (error) {
      console.error('Failed to update priority:', error);
      Message.error('更新优先级失败');
    }
  };

  const deleteFeedback = async (id: string) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('supabase_token');
      const response = await fetch(`/api/feedback/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete feedback');

      Message.success('反馈已删除');
      fetchFeedbacks();
      fetchStats();
      setDetailModalVisible(false);
      setSelectedFeedback(null);
    } catch (error) {
      console.error('Failed to delete feedback:', error);
      Message.error('删除失败');
    }
  };

  const handleSearch = useCallback(() => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchFeedbacks();
  }, [searchKeyword]);

  const openDetailModal = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setDetailModalVisible(true);
  };

  const exportFeedbacks = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('supabase_token');
      const params = new URLSearchParams();
      
      if (statusFilter) params.append('status', statusFilter);
      if (typeFilter) params.append('type', typeFilter);
      if (dateRange) {
        params.append('startDate', dateRange[0].toISOString());
        params.append('endDate', dateRange[1].toISOString());
      }

      const response = await fetch(`/api/feedback/export?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to export');

      const csv = await response.text();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `feedback-report-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      Message.success('导出成功');
    } catch (error) {
      console.error('Failed to export:', error);
      Message.error('导出失败');
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncateText = (text: string, maxLength: number) => {
    if (!text) return '';
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  };

  // Statistics cards
  const StatCard = ({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: string }) => (
    <Card style={{ height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            background: `${color}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: color,
          }}
        >
          {icon}
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 13 }}>{title}</Text>
          <div style={{ fontSize: 24, fontWeight: 'bold' }}>{value}</div>
        </div>
      </div>
    </Card>
  );

  // Render pie chart for type distribution
  const renderTypeChart = () => {
    if (!stats) return <Empty />;

    const data = [
      { name: TYPE_LABELS[FeedbackType.BUG], value: stats.byType[FeedbackType.BUG], color: '#F53F3F' },
      { name: TYPE_LABELS[FeedbackType.SUGGESTION], value: stats.byType[FeedbackType.SUGGESTION], color: '#00B42A' },
      { name: TYPE_LABELS[FeedbackType.OTHER], value: stats.byType[FeedbackType.OTHER], color: '#86909C' },
    ].filter(d => d.value > 0);

    if (data.length === 0) return <Empty />;

    return (
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <RechartsTooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  // Render status distribution bar
  const renderStatusDistribution = () => {
    if (!stats) return null;

    const statuses: FeedbackStatus[] = [
      FeedbackStatus.NEW,
      FeedbackStatus.CONFIRMED,
      FeedbackStatus.IN_PROGRESS,
      FeedbackStatus.RESOLVED,
      FeedbackStatus.CLOSED,
    ];

    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {statuses.map(status => (
          <Tag key={status} color={STATUS_COLORS[status]}>
            {STATUS_LABELS[status]}: {stats.byStatus[status]}
          </Tag>
        ))}
      </div>
    );
  };

  // Table columns
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => (
        <Text copyable style={{ fontSize: 12 }}>
          {truncateText(id, 10)}
        </Text>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: FeedbackType) => (
        <Tag color={TYPE_COLORS[type]} icon={TYPE_ICONS[type]}>
          {TYPE_LABELS[type]}
        </Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc: string) => truncateText(desc, 50),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: FeedbackStatus) => (
        <Tag color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Tag>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 90,
      render: (priority?: FeedbackPriority) => (
        priority ? (
          <Tag color={PRIORITY_COLORS[priority]}>{PRIORITY_LABELS[priority]}</Tag>
        ) : (
          <Text type="secondary">-</Text>
        )
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (date: Date) => (
        <Text style={{ fontSize: 12 }}>{formatDate(date)}</Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, record: Feedback) => (
        <Button
          type="text"
          icon={<IconEye />}
          onClick={() => openDetailModal(record)}
        />
      ),
    },
  ];

  return (
    <ErrorBoundary>
      <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconMessage style={{ fontSize: 28, color: '#165DFF' }} />
            <Title heading={3} style={{ margin: 0 }}>用户反馈管理</Title>
          </div>
          <Space>
            <Button icon={<IconRefresh />} onClick={() => { fetchFeedbacks(); fetchStats(); }}>
              刷新
            </Button>
            <Button icon={<IconDownload />} onClick={exportFeedbacks}>
              导出
            </Button>
          </Space>
        </div>

        {/* Statistics */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="总反馈数"
              value={stats?.total || 0}
              icon={<IconMessage style={{ fontSize: 24 }} />}
              color="#165DFF"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="新建"
              value={stats?.byStatus[FeedbackStatus.NEW] || 0}
              icon={<IconExclamationCircle style={{ fontSize: 24 }} />}
              color="#F53F3F"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="处理中"
              value={stats?.byStatus[FeedbackStatus.IN_PROGRESS] || 0}
              icon={<IconClockCircle style={{ fontSize: 24 }} />}
              color="#FF7D00"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="已解决"
              value={stats?.byStatus[FeedbackStatus.RESOLVED] || 0}
              icon={<IconCheck style={{ fontSize: 24 }} />}
              color="#00B42A"
            />
          </Col>
        </Row>

        {/* Charts */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={12}>
            <Card title="反馈类型分布">
              {renderTypeChart()}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="状态分布">
              {renderStatusDistribution()}
              <Divider />
              <div style={{ marginTop: 16 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  点击下方筛选器查看不同状态的反馈
                </Text>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <Input
              placeholder="搜索关键词..."
              prefix={<IconSearch />}
              value={searchKeyword}
              onChange={setSearchKeyword}
              onPressEnter={handleSearch}
              style={{ width: 200 }}
            />
            <Select
              placeholder="类型"
              allowClear
              value={typeFilter}
              onChange={setTypeFilter}
              style={{ width: 120 }}
            >
              <Select.Option value={FeedbackType.BUG}>Bug</Select.Option>
              <Select.Option value={FeedbackType.SUGGESTION}>建议</Select.Option>
              <Select.Option value={FeedbackType.OTHER}>其他</Select.Option>
            </Select>
            <Select
              placeholder="状态"
              allowClear
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 120 }}
            >
              <Select.Option value={FeedbackStatus.NEW}>新建</Select.Option>
              <Select.Option value={FeedbackStatus.CONFIRMED}>已确认</Select.Option>
              <Select.Option value={FeedbackStatus.IN_PROGRESS}>进行中</Select.Option>
              <Select.Option value={FeedbackStatus.RESOLVED}>已解决</Select.Option>
              <Select.Option value={FeedbackStatus.CLOSED}>已关闭</Select.Option>
            </Select>
            <Select
              placeholder="优先级"
              allowClear
              value={priorityFilter}
              onChange={setPriorityFilter}
              style={{ width: 120 }}
            >
              <Select.Option value={FeedbackPriority.P0}>P0 紧急</Select.Option>
              <Select.Option value={FeedbackPriority.P1}>P1 高</Select.Option>
              <Select.Option value={FeedbackPriority.P2}>P2 中</Select.Option>
              <Select.Option value={FeedbackPriority.P3}>P3 低</Select.Option>
            </Select>
            <RangePicker
              placeholder={['开始日期', '结束日期']}
              value={dateRange}
              onChange={(dates) => setDateRange(dates as [Date, Date] | undefined)}
              style={{ width: 260 }}
            />
            <Button type="primary" icon={<IconFilter />} onClick={handleSearch}>
              筛选
            </Button>
          </div>
        </Card>

        {/* Feedback List */}
        <Card>
          <Spin loading={loading} style={{ display: 'block' }}>
            <Table
              columns={columns}
              data={feedbacks}
              rowKey="id"
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                onChange: (current, pageSize) => {
                  setPagination(prev => ({ ...prev, current, pageSize }));
                },
              }}
              scroll={{ x: 900 }}
              emptyText={<Empty description="暂无反馈" />}
            />
          </Spin>
        </Card>

        {/* Detail Modal */}
        <Modal
          title="反馈详情"
          visible={detailModalVisible}
          onCancel={() => {
            setDetailModalVisible(false);
            setSelectedFeedback(null);
          }}
          footer={null}
          style={{ width: 700, maxWidth: '90vw' }}
        >
          {selectedFeedback && (
            <div>
              {/* Basic Info */}
              <Descriptions
                column={2}
                data={[
                  { label: '反馈 ID', value: selectedFeedback.id },
                  { label: '类型', value: TYPE_LABELS[selectedFeedback.type] },
                  { label: '状态', value: STATUS_LABELS[selectedFeedback.status] },
                  { label: '优先级', value: selectedFeedback.priority ? PRIORITY_LABELS[selectedFeedback.priority] : '未设置' },
                  { label: '创建时间', value: formatDate(selectedFeedback.createdAt) },
                  { label: '更新时间', value: formatDate(selectedFeedback.updatedAt) },
                ]}
                labelStyle={{ fontWeight: 'bold' }}
              />
              
              <Divider />
              
              {/* Description */}
              <div style={{ marginBottom: 16 }}>
                <Text bold style={{ display: 'block', marginBottom: 8 }}>描述</Text>
                <Paragraph style={{ background: 'var(--color-fill-1)', padding: 12, borderRadius: 4 }}>
                  {selectedFeedback.description}
                </Paragraph>
              </div>

              {/* User Info */}
              {selectedFeedback.userId && (
                <div style={{ marginBottom: 16 }}>
                  <Text bold style={{ display: 'block', marginBottom: 8 }}>用户</Text>
                  <Text>{selectedFeedback.userId}</Text>
                </div>
              )}

              {/* Contact Info */}
              {selectedFeedback.contactInfo && (
                <div style={{ marginBottom: 16 }}>
                  <Text bold style={{ display: 'block', marginBottom: 8 }}>联系方式</Text>
                  <Text>{selectedFeedback.contactInfo}</Text>
                </div>
              )}

              {/* Screenshot */}
              {selectedFeedback.screenshot && (
                <div style={{ marginBottom: 16 }}>
                  <Text bold style={{ display: 'block', marginBottom: 8 }}>截图</Text>
                  <img
                    src={selectedFeedback.screenshot}
                    alt="反馈截图"
                    style={{ maxWidth: '100%', borderRadius: 4, border: '1px solid var(--color-border)' }}
                  />
                </div>
              )}

              {/* Environment */}
              <div style={{ marginBottom: 16 }}>
                <Text bold style={{ display: 'block', marginBottom: 8 }}>环境信息</Text>
                <Descriptions
                  column={1}
                  data={[
                    { label: '页面 URL', value: selectedFeedback.environment?.url || '-' },
                    { label: 'User Agent', value: selectedFeedback.environment?.userAgent || '-' },
                    { label: '屏幕尺寸', value: selectedFeedback.environment?.screenSize || '-' },
                    { label: '语言', value: selectedFeedback.environment?.locale || '-' },
                  ]}
                  labelStyle={{ fontWeight: 'normal' }}
                />
              </div>

              {/* Admin Notes */}
              {selectedFeedback.adminNotes && (
                <div style={{ marginBottom: 16 }}>
                  <Text bold style={{ display: 'block', marginBottom: 8 }}>管理员备注</Text>
                  <Paragraph style={{ background: 'var(--color-fill-1)', padding: 12, borderRadius: 4 }}>
                    {selectedFeedback.adminNotes}
                  </Paragraph>
                </div>
              )}

              <Divider />

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <Space>
                  <Text bold>状态:</Text>
                  <Select
                    value={selectedFeedback.status}
                    onChange={(status) => updateFeedbackStatus(selectedFeedback.id, status)}
                    style={{ width: 120 }}
                  >
                    <Select.Option value={FeedbackStatus.NEW}>新建</Select.Option>
                    <Select.Option value={FeedbackStatus.CONFIRMED}>已确认</Select.Option>
                    <Select.Option value={FeedbackStatus.IN_PROGRESS}>进行中</Select.Option>
                    <Select.Option value={FeedbackStatus.RESOLVED}>已解决</Select.Option>
                    <Select.Option value={FeedbackStatus.CLOSED}>已关闭</Select.Option>
                  </Select>
                  <Text bold>优先级:</Text>
                  <Select
                    value={selectedFeedback.priority}
                    onChange={(priority) => updateFeedbackPriority(selectedFeedback.id, priority)}
                    style={{ width: 120 }}
                    placeholder="未设置"
                  >
                    <Select.Option value={FeedbackPriority.P0}>P0 紧急</Select.Option>
                    <Select.Option value={FeedbackPriority.P1}>P1 高</Select.Option>
                    <Select.Option value={FeedbackPriority.P2}>P2 中</Select.Option>
                    <Select.Option value={FeedbackPriority.P3}>P3 低</Select.Option>
                  </Select>
                </Space>
                <Popconfirm
                  title="确定要删除这条反馈吗？"
                  onOk={() => deleteFeedback(selectedFeedback.id)}
                >
                  <Button status="danger" icon={<IconDelete />}>
                    删除
                  </Button>
                </Popconfirm>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </ErrorBoundary>
  );
};

export default FeedbackManagementPage;