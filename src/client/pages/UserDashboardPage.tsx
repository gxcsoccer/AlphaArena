/**
 * User Dashboard Page
 * Personal dashboard for users to manage strategies, view trades, and analyze performance
 */

import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Statistic,
  Table,
  Tag,
  Space,
  Button,
  Grid,
  Tabs,
  Input,
  Select,
  DatePicker,
  Spin,
  Empty,
  Message,
} from '@arco-design/web-react';
import {
  IconDashboard,
  IconApps,
  IconSwap,
  IconDashboard,
  IconDownload,
  IconSearch,
  IconRefresh,
} from '@arco-design/web-react/icon';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../hooks/useAuth';
import { ErrorBoundary } from '../components/ErrorBoundary';
import ExportModal from '../components/ExportModal';

const { Row, Col } = Grid;
const { Title, Text } = Typography;
const TabPane = Tabs.TabPane;
const { _RangePicker } = DatePicker;

// Types
interface UserOverview {
  userId: string;
  totalAssets: number;
  monthlyPnL: number;
  monthlyPnLPercent: number;
  activeStrategies: number;
  totalTrades: number;
  winRate: number;
  equityCurve: Array<{ date: string; value: number }>;
}

interface UserStrategy {
  id: string;
  userId: string;
  name: string;
  type: string;
  status: 'active' | 'paused' | 'stopped';
  returnRate: number;
  tradeCount: number;
  createdAt: string;
  lastActiveAt: string;
}

interface UserTrade {
  id: string;
  userId: string;
  strategyId?: string;
  strategyName?: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  total: number;
  pnl: number;
  fee: number;
  executedAt: string;
}

interface UserPerformance {
  userId: string;
  totalReturn: number;
  totalReturnPercent: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  profitLossRatio: number;
  monthlyReturns: Array<{ month: string; return: number }>;
  assetDistribution: Array<{ asset: string; value: number; percentage: number }>;
}

// Colors for charts
const COLORS = ['#165DFF', '#14C9C9', '#F7BA1E', '#722ED1', '#F53F3F'];
const STATUS_COLORS: Record<string, string> = {
  active: 'green',
  paused: 'orange',
  stopped: 'red',
};

// API helper
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

async function fetchUserDashboard<T>(endpoint: string): Promise<{ data?: T; error?: string }> {
  const token = localStorage.getItem('auth_access_token');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/user/dashboard${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const result = await response.json();
    
    if (!response.ok || !result.success) {
      return { error: result.error || 'Request failed' };
    }

    return { data: result.data };
  } catch (error: any) {
    return { error: error.message };
  }
}

// Sub-components
const OverviewCards: React.FC<{ overview: UserOverview | null; loading: boolean }> = ({ overview, loading }) => {
  if (loading) {
    return (
      <Row gutter={[16, 16]}>
        {[1, 2, 3, 4].map(i => (
          <Col xs={12} sm={6} key={i}>
            <Card loading={true} style={{ height: 120 }} />
          </Col>
        ))}
      </Row>
    );
  }

  if (!overview) {
    return <Empty description="暂无数据" />;
  }

  return (
    <Row gutter={[16, 16]}>
      <Col xs={12} sm={6}>
        <Card>
          <Statistic
            title="总资产"
            value={overview.totalAssets}
            prefixText="$"
            precision={2}
            valueStyle={{ color: '#165DFF' }}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card>
          <Statistic
            title="本月收益"
            value={overview.monthlyPnL}
            prefixText="$"
            precision={2}
            valueStyle={{ color: overview.monthlyPnL >= 0 ? '#00B42A' : '#F53F3F' }}
            suffixText={`(${overview.monthlyPnLPercent.toFixed(1)}%)`}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card>
          <Statistic
            title="活跃策略"
            value={overview.activeStrategies}
            suffixText="个"
            valueStyle={{ color: '#14C9C9' }}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card>
          <Statistic
            title="总交易次数"
            value={overview.totalTrades}
            suffixText="次"
            valueStyle={{ color: '#722ED1' }}
          />
        </Card>
      </Col>
    </Row>
  );
};

const EquityCurveChart: React.FC<{ data: Array<{ date: string; value: number }> }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={300}>
    <LineChart data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
      <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
      <Tooltip
        formatter={(value: number) => [`$${value.toLocaleString()}`, '资产价值']}
        labelFormatter={(label) => `日期: ${label}`}
      />
      <Line
        type="monotone"
        dataKey="value"
        stroke="#165DFF"
        strokeWidth={2}
        dot={false}
      />
    </LineChart>
  </ResponsiveContainer>
);

const StrategiesTab: React.FC<{ userId: string }> = ({ userId: _userId }) => {
  const [strategies, setStrategies] = useState<UserStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [searchText, setSearchText] = useState('');

  const fetchStrategies = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.append('status', statusFilter);
    
    const result = await fetchUserDashboard<UserStrategy[]>(`/strategies?${params}`);
    
    if (result.data) {
      setStrategies(result.data);
    } else {
      Message.error(result.error || '获取策略列表失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStrategies();
  }, [statusFilter]);

  const filteredStrategies = strategies.filter(s =>
    !searchText || s.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    {
      title: '策略名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag>{type}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={STATUS_COLORS[status] || 'gray'}>{status}</Tag>
      ),
    },
    {
      title: '收益率',
      dataIndex: 'returnRate',
      key: 'returnRate',
      render: (rate: number) => (
        <Text style={{ color: rate >= 0 ? '#00B42A' : '#F53F3F' }}>
          {rate >= 0 ? '+' : ''}{rate.toFixed(2)}%
        </Text>
      ),
    },
    {
      title: '交易次数',
      dataIndex: 'tradeCount',
      key: 'tradeCount',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: UserStrategy) => (
        <Space>
          <Button type="text" size="small">详情</Button>
          <Button type="text" size="small" status={record.status === 'active' ? 'warning' : 'success'}>
            {record.status === 'active' ? '暂停' : '启动'}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜索策略"
          prefix={<IconSearch />}
          value={searchText}
          onChange={setSearchText}
          style={{ width: 200 }}
        />
        <Select
          placeholder="状态筛选"
          value={statusFilter}
          onChange={setStatusFilter}
          allowClear
          style={{ width: 120 }}
        >
          <Select.Option value="active">运行中</Select.Option>
          <Select.Option value="paused">已暂停</Select.Option>
          <Select.Option value="stopped">已停止</Select.Option>
        </Select>
        <Button icon={<IconRefresh />} onClick={fetchStrategies}>刷新</Button>
      </Space>

      <Table
        columns={columns}
        data={filteredStrategies}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};

const TradesTab: React.FC<{ userId: string }> = ({ userId: _userId }) => {
  const [trades, setTrades] = useState<UserTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [symbolFilter, setSymbolFilter] = useState<string | undefined>();
  const [exportVisible, setExportVisible] = useState(false);

  const fetchTrades = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.append('limit', String(pageSize));
    params.append('offset', String((page - 1) * pageSize));
    if (symbolFilter) params.append('symbol', symbolFilter);
    
    const result = await fetchUserDashboard<{ trades: UserTrade[]; total: number }>(`/trades?${params}`);
    
    if (result.data) {
      setTrades(result.data.trades || []);
      setTotal(result.data.total || 0);
    } else {
      Message.error(result.error || '获取交易记录失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTrades();
  }, [page, pageSize, symbolFilter]);

  const columns = [
    {
      title: '时间',
      dataIndex: 'executedAt',
      key: 'executedAt',
      render: (date: string) => new Date(date).toLocaleString(),
      width: 150,
    },
    {
      title: '策略',
      dataIndex: 'strategyName',
      key: 'strategyName',
      width: 150,
    },
    {
      title: '交易对',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 100,
    },
    {
      title: '方向',
      dataIndex: 'side',
      key: 'side',
      render: (side: string) => (
        <Tag color={side === 'buy' ? 'green' : 'red'}>
          {side === 'buy' ? '买入' : '卖出'}
        </Tag>
      ),
      width: 80,
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      render: (price: number) => `$${price.toLocaleString()}`,
      width: 100,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
    },
    {
      title: '总额',
      dataIndex: 'total',
      key: 'total',
      render: (total: number) => `$${total.toLocaleString()}`,
      width: 100,
    },
    {
      title: '盈亏',
      dataIndex: 'pnl',
      key: 'pnl',
      render: (pnl: number) => (
        <Text style={{ color: pnl >= 0 ? '#00B42A' : '#F53F3F' }}>
          {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
        </Text>
      ),
      width: 100,
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="交易对筛选"
          value={symbolFilter}
          onChange={setSymbolFilter}
          style={{ width: 150 }}
        />
        <Button
          icon={<IconDownload />}
          onClick={() => setExportVisible(true)}
        >
          导出
        </Button>
        <Button icon={<IconRefresh />} onClick={fetchTrades}>刷新</Button>
      </Space>

      <Table
        columns={columns}
        data={trades}
        loading={loading}
        rowKey="id"
        scroll={{ x: 900 }}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <ExportModal
        visible={exportVisible}
        onCancel={() => setExportVisible(false)}
        data={trades}
        filename="user-trades"
      />
    </div>
  );
};

const PerformanceTab: React.FC<{ userId: string }> = ({ userId: _userId }) => {
  const [performance, setPerformance] = useState<UserPerformance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPerformance = async () => {
      setLoading(true);
      const result = await fetchUserDashboard<UserPerformance>('/performance');
      
      if (result.data) {
        setPerformance(result.data);
      } else {
        Message.error(result.error || '获取绩效数据失败');
      }
      setLoading(false);
    };

    fetchPerformance();
  }, []);

  if (loading) {
    return <Spin style={{ display: 'block', margin: '100px auto' }} />;
  }

  if (!performance) {
    return <Empty description="暂无绩效数据" />;
  }

  return (
    <div>
      {/* Performance Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="总收益率"
              value={performance.totalReturnPercent}
              suffixText="%"
              precision={2}
              valueStyle={{ color: performance.totalReturnPercent >= 0 ? '#00B42A' : '#F53F3F' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="年化收益"
              value={performance.annualizedReturn}
              suffixText="%"
              precision={2}
              valueStyle={{ color: performance.annualizedReturn >= 0 ? '#00B42A' : '#F53F3F' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="最大回撤"
              value={performance.maxDrawdown}
              suffixText="%"
              precision={2}
              valueStyle={{ color: '#F53F3F' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="夏普比率"
              value={performance.sharpeRatio}
              precision={2}
              valueStyle={{ color: performance.sharpeRatio >= 1 ? '#00B42A' : '#F7BA1E' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="胜率"
              value={performance.winRate * 100}
              suffixText="%"
              precision={1}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="盈亏比"
              value={performance.profitLossRatio}
              precision={2}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="月度收益">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={performance.monthlyReturns}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, '收益率']} />
                <Bar dataKey="return">
                  {performance.monthlyReturns.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.return >= 0 ? '#00B42A' : '#F53F3F'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="资产分布">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={performance.assetDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ asset, percentage }) => `${asset}: ${percentage}%`}
                  outerRadius={100}
                  dataKey="value"
                >
                  {performance.assetDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, '价值']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// Main component
const UserDashboardPage: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [overview, setOverview] = useState<UserOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [_isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch overview
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const fetchOverview = async () => {
      setOverviewLoading(true);
      const result = await fetchUserDashboard<UserOverview>('/overview');
      if (result.data) {
        setOverview(result.data);
      }
      setOverviewLoading(false);
    };

    fetchOverview();
  }, [isAuthenticated, user]);

  // Redirect if not authenticated
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size={40} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Empty
        description="请先登录以查看您的仪表板"
        style={{ marginTop: 100 }}
      />
    );
  }

  return (
    <ErrorBoundary>
      <div>
        <Title heading={4} style={{ marginBottom: 24 }}>
          <IconDashboard style={{ marginRight: 8 }} />
          我的仪表板
        </Title>

        {/* Overview Cards */}
        <div style={{ marginBottom: 24 }}>
          <OverviewCards overview={overview} loading={overviewLoading} />
        </div>

        {/* Equity Curve */}
        {overview?.equityCurve && (
          <Card title="收益曲线" style={{ marginBottom: 24 }}>
            <EquityCurveChart data={overview.equityCurve} />
          </Card>
        )}

        {/* Tabs */}
        <Tabs activeTab={activeTab} onChange={setActiveTab}>
          <TabPane
            key="strategies"
            title={
              <span>
                <IconApps style={{ marginRight: 4 }} />
                我的策略
              </span>
            }
          >
            <StrategiesTab userId={user?.id || ''} />
          </TabPane>
          <TabPane
            key="trades"
            title={
              <span>
                <IconSwap style={{ marginRight: 4 }} />
                交易历史
              </span>
            }
          >
            <TradesTab userId={user?.id || ''} />
          </TabPane>
          <TabPane
            key="performance"
            title={
              <span>
                <IconDashboard style={{ marginRight: 4 }} />
                绩效分析
              </span>
            }
          >
            <PerformanceTab userId={user?.id || ''} />
          </TabPane>
        </Tabs>
      </div>
    </ErrorBoundary>
  );
};

export default UserDashboardPage;
