import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Statistic,
  Grid,
  Space,
  Button,
  Modal,
  Form,
  InputNumber,
  Input,
  Message,
  Spin,
  Empty,
  Popconfirm,
  Divider,
  Progress,
  Tabs,
  Badge,
} from '@arco-design/web-react';
import {
  IconPlus,
  IconMinus,
  IconRefresh,
  IconDelete,
  IconSafe,
  IconBook,
} from '@arco-design/web-react/icon';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart } from 'recharts';
import { useAuth } from '../hooks/useAuth';
import { ErrorBoundary } from '../components/ErrorBoundary';

const { Row, Col } = Grid;
const { Title, Text } = Typography;
const { TabPane } = Tabs;
const FormItem = Form.Item;

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Types
interface VirtualAccount {
  id: string;
  user_id: string;
  balance: number;
  initial_capital: number;
  frozen_balance: number;
  total_realized_pnl: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  account_currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface VirtualPosition {
  id: string;
  account_id: string;
  symbol: string;
  quantity: number;
  available_quantity: number;
  average_cost: number;
  total_cost: number;
  current_price: number | null;
  market_value: number | null;
  unrealized_pnl: number | null;
  unrealized_pnl_pct: number | null;
  updated_at: string;
}

interface AccountTransaction {
  id: string;
  account_id: string;
  type: string;
  amount: number;
  balance_after: number;
  symbol: string | null;
  quantity: number | null;
  price: number | null;
  description: string | null;
  created_at: string;
}

interface VirtualOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  order_type: string;
  quantity: number;
  filled_quantity: number;
  price: number | null;
  status: string;
  created_at: string;
  executed_at: string | null;
  error_message: string | null;
}

interface AccountSummary {
  account: VirtualAccount;
  positions: VirtualPosition[];
  total_value: number;
  available_balance: number;
  positions_value: number;
  total_unrealized_pnl: number;
  total_pnl: number;
  roi_pct: number;
  today_pnl: number | null;
  today_pnl_pct: number | null;
}

// API functions
async function fetchWithAuth(url: string, token: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  
  return response.json();
}

// Virtual Account Page Component
const VirtualAccountPage: React.FC = () => {
  const { accessToken, isAuthenticated, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [orders, setOrders] = useState<VirtualOrder[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Modal states
  const [buyModalVisible, setBuyModalVisible] = useState(false);
  const [sellModalVisible, setSellModalVisible] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  
  // Form states
  const [buyForm] = Form.useForm();
  const [sellForm] = Form.useForm();
  const [resetForm] = Form.useForm();

  // Fetch account data
  const fetchAccountData = useCallback(async () => {
    if (!accessToken) return;
    
    setLoading(true);
    try {
      const [summaryRes, txRes, ordersRes] = await Promise.all([
        fetchWithAuth(`${API_BASE}/api/account`, accessToken),
        fetchWithAuth(`${API_BASE}/api/account/transactions?limit=20`, accessToken),
        fetchWithAuth(`${API_BASE}/api/account/orders?status=pending,open,partial&limit=10`, accessToken),
      ]);
      
      if (summaryRes.success) {
        setSummary(summaryRes.data);
      }
      if (txRes.success) {
        setTransactions(txRes.data);
      }
      if (ordersRes.success) {
        setOrders(ordersRes.data);
      }
    } catch (error: any) {
      Message.error(error.message || 'Failed to fetch account data');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchAccountData();
  }, [fetchAccountData]);

  // Handle buy order
  const handleBuy = async (values: any) => {
    if (!accessToken) return;
    
    try {
      const result = await fetchWithAuth(`${API_BASE}/api/account/orders/buy`, accessToken, {
        method: 'POST',
        body: JSON.stringify(values),
      });
      
      if (result.success) {
        Message.success(result.message || 'Order placed successfully');
        setBuyModalVisible(false);
        buyForm.resetFields();
        fetchAccountData();
      }
    } catch (error: any) {
      Message.error(error.message || 'Failed to place order');
    }
  };

  // Handle sell order
  const handleSell = async (values: any) => {
    if (!accessToken) return;
    
    try {
      const result = await fetchWithAuth(`${API_BASE}/api/account/orders/sell`, accessToken, {
        method: 'POST',
        body: JSON.stringify(values),
      });
      
      if (result.success) {
        Message.success(result.message || 'Order placed successfully');
        setSellModalVisible(false);
        sellForm.resetFields();
        fetchAccountData();
      }
    } catch (error: any) {
      Message.error(error.message || 'Failed to place order');
    }
  };

  // Handle account reset
  const handleReset = async (values: any) => {
    if (!accessToken) return;
    
    try {
      const result = await fetchWithAuth(`${API_BASE}/api/account/reset`, accessToken, {
        method: 'POST',
        body: JSON.stringify(values),
      });
      
      if (result.success) {
        Message.success('Account reset successfully');
        setResetModalVisible(false);
        resetForm.resetFields();
        fetchAccountData();
      }
    } catch (error: any) {
      Message.error(error.message || 'Failed to reset account');
    }
  };

  // Handle cancel order
  const handleCancelOrder = async (orderId: string) => {
    if (!accessToken) return;
    
    try {
      const result = await fetchWithAuth(`${API_BASE}/api/account/orders/${orderId}/cancel`, accessToken, {
        method: 'POST',
      });
      
      if (result.success) {
        Message.success('Order cancelled successfully');
        fetchAccountData();
      }
    } catch (error: any) {
      Message.error(error.message || 'Failed to cancel order');
    }
  };

  // Handle refresh prices
  const handleRefreshPrices = async () => {
    if (!accessToken) return;
    
    try {
      await fetchWithAuth(`${API_BASE}/api/account/refresh-prices`, accessToken, {
        method: 'POST',
      });
      Message.success('Prices refreshed');
      fetchAccountData();
    } catch (error: any) {
      Message.error(error.message || 'Failed to refresh prices');
    }
  };

  // Format helpers
  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const formatQuantity = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString(undefined, { maximumFractionDigits: 8 });
  };

  if (authLoading || loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size={40} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description="Please log in to access your virtual trading account." />
      </div>
    );
  }

  if (!summary) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description="No account found. Please log in to create your virtual account." />
      </div>
    );
  }

  const { account, positions, total_value, available_balance, positions_value, _total_unrealized_pnl, total_pnl, roi_pct, today_pnl, today_pnl_pct } = summary;

  return (
    <ErrorBoundary>
      <div style={{ padding: 24 }}>
        {/* Header */}
        <Row justify="space-between" align="center" style={{ marginBottom: 24 }}>
          <Col>
            <Title heading={4} style={{ margin: 0 }}>
              <IconSafe style={{ marginRight: 8 }} />
              Virtual Trading Account
            </Title>
          </Col>
          <Col>
            <Space>
              <Button icon={<IconRefresh />} onClick={handleRefreshPrices}>
                Refresh Prices
              </Button>
              <Button type="primary" icon={<IconPlus />} onClick={() => setBuyModalVisible(true)}>
                Buy
              </Button>
              <Button icon={<IconMinus />} onClick={() => setSellModalVisible(true)}>
                Sell
              </Button>
              <Popconfirm
                title="Reset Account"
                content="This will clear all positions and reset your balance. Are you sure?"
                onConfirm={() => setResetModalVisible(true)}
              >
                <Button status="danger" icon={<IconDelete />}>
                  Reset Account
                </Button>
              </Popconfirm>
            </Space>
          </Col>
        </Row>

        {/* Account Overview Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Total Value"
                value={total_value}
                prefix="$"
                precision={2}
                valueStyle={{ color: roi_pct >= 0 ? '#00b42a' : '#f53f3f' }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                ROI: {formatPercent(roi_pct)}
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Available Cash"
                value={available_balance}
                prefix="$"
                precision={2}
              />
              <Progress
                percent={(available_balance / total_value) * 100}
                size="small"
                style={{ marginTop: 8 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Positions Value"
                value={positions_value}
                prefix="$"
                precision={2}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {positions.length} position(s)
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Total P&L"
                value={total_pnl}
                prefix="$"
                precision={2}
                valueStyle={{ color: total_pnl >= 0 ? '#00b42a' : '#f53f3f' }}
              />
              {today_pnl !== null && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Today: {formatCurrency(today_pnl)} ({formatPercent(today_pnl_pct)})
                </Text>
              )}
            </Card>
          </Col>
        </Row>

        {/* Account Stats */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Win Rate"
                value={account.total_trades > 0 ? (account.winning_trades / account.total_trades) * 100 : 0}
                suffix="%"
                precision={1}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {account.winning_trades}W / {account.losing_trades}L
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Total Trades"
                value={account.total_trades}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Realized P&L"
                value={account.total_realized_pnl}
                prefix="$"
                precision={2}
                valueStyle={{ color: account.total_realized_pnl >= 0 ? '#00b42a' : '#f53f3f' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Tabs for Positions, Orders, Transactions */}
        <Card>
          <Tabs activeTab={activeTab} onChange={setActiveTab}>
            <TabPane key="positions" tab={`Positions (${positions.length})`}>
              {positions.length === 0 ? (
                <Empty description="No positions yet. Start trading!" />
              ) : (
                <Table
                  data={positions}
                  pagination={{ pageSize: 10 }}
                  columns={[
                    {
                      title: 'Symbol',
                      dataIndex: 'symbol',
                      render: (symbol: string) => <Tag color="blue">{symbol}</Tag>,
                    },
                    {
                      title: 'Quantity',
                      dataIndex: 'quantity',
                      render: formatQuantity,
                    },
                    {
                      title: 'Avg Cost',
                      dataIndex: 'average_cost',
                      render: formatCurrency,
                    },
                    {
                      title: 'Current Price',
                      dataIndex: 'current_price',
                      render: formatCurrency,
                    },
                    {
                      title: 'Market Value',
                      dataIndex: 'market_value',
                      render: formatCurrency,
                    },
                    {
                      title: 'Unrealized P&L',
                      dataIndex: 'unrealized_pnl',
                      render: (value: number | null) => (
                        <Text style={{ color: value && value >= 0 ? '#00b42a' : '#f53f3f' }}>
                          {formatCurrency(value)}
                          {value !== null && <Text type="secondary"> ({formatPercent(summary.positions.find(p => p.unrealized_pnl === value)?.unrealized_pnl_pct)})</Text>}
                        </Text>
                      ),
                    },
                  ]}
                />
              )}
            </TabPane>
            
            <TabPane key="orders" tab={`Open Orders (${orders.length})`}>
              {orders.length === 0 ? (
                <Empty description="No open orders" />
              ) : (
                <Table
                  data={orders}
                  pagination={{ pageSize: 10 }}
                  columns={[
                    {
                      title: 'Symbol',
                      dataIndex: 'symbol',
                      render: (symbol: string) => <Tag color="blue">{symbol}</Tag>,
                    },
                    {
                      title: 'Side',
                      dataIndex: 'side',
                      render: (side: string) => (
                        <Tag color={side === 'buy' ? 'green' : 'red'}>{side.toUpperCase()}</Tag>
                      ),
                    },
                    {
                      title: 'Type',
                      dataIndex: 'order_type',
                      render: (type: string) => type.toUpperCase(),
                    },
                    {
                      title: 'Quantity',
                      dataIndex: 'quantity',
                      render: formatQuantity,
                    },
                    {
                      title: 'Filled',
                      dataIndex: 'filled_quantity',
                      render: (filled: number, record: VirtualOrder) => `${filled}/${record.quantity}`,
                    },
                    {
                      title: 'Price',
                      dataIndex: 'price',
                      render: formatCurrency,
                    },
                    {
                      title: 'Status',
                      dataIndex: 'status',
                      render: (status: string) => (
                        <Tag color={status === 'open' ? 'blue' : status === 'partial' ? 'orange' : 'gray'}>
                          {status.toUpperCase()}
                        </Tag>
                      ),
                    },
                    {
                      title: 'Action',
                      render: (_, record: VirtualOrder) => (
                        <Button
                          size="small"
                          status="danger"
                          onClick={() => handleCancelOrder(record.id)}
                        >
                          Cancel
                        </Button>
                      ),
                    },
                  ]}
                />
              )}
            </TabPane>
            
            <TabPane key="history" tab={`Transaction History`}>
              <Table
                data={transactions}
                pagination={{ pageSize: 20 }}
                columns={[
                  {
                    title: 'Date',
                    dataIndex: 'created_at',
                    render: (date: string) => new Date(date).toLocaleString(),
                  },
                  {
                    title: 'Type',
                    dataIndex: 'type',
                    render: (type: string) => {
                      const colorMap: Record<string, string> = {
                        buy: 'green',
                        sell: 'red',
                        deposit: 'blue',
                        withdraw: 'orange',
                        fee: 'gray',
                        reset: 'purple',
                      };
                      return <Tag color={colorMap[type] || 'gray'}>{type.toUpperCase()}</Tag>;
                    },
                  },
                  {
                    title: 'Symbol',
                    dataIndex: 'symbol',
                    render: (symbol: string | null) => symbol ? <Tag color="blue">{symbol}</Tag> : '-',
                  },
                  {
                    title: 'Quantity',
                    dataIndex: 'quantity',
                    render: formatQuantity,
                  },
                  {
                    title: 'Price',
                    dataIndex: 'price',
                    render: formatCurrency,
                  },
                  {
                    title: 'Amount',
                    dataIndex: 'amount',
                    render: (amount: number) => (
                      <Text style={{ color: amount >= 0 ? '#00b42a' : '#f53f3f' }}>
                        {formatCurrency(amount)}
                      </Text>
                    ),
                  },
                  {
                    title: 'Balance After',
                    dataIndex: 'balance_after',
                    render: formatCurrency,
                  },
                  {
                    title: 'Description',
                    dataIndex: 'description',
                    render: (desc: string | null) => desc || '-',
                  },
                ]}
              />
            </TabPane>
          </Tabs>
        </Card>

        {/* Buy Modal */}
        <Modal
          title="Buy Order"
          visible={buyModalVisible}
          onCancel={() => setBuyModalVisible(false)}
          footer={null}
        >
          <Form form={buyForm} layout="vertical" onFinish={handleBuy}>
            <FormItem label="Symbol" field="symbol" required>
              <Input placeholder="e.g., AAPL, BTC/USD" />
            </FormItem>
            <FormItem label="Order Type" field="orderType" required initialValue="market">
              <Input disabled value="Market Order" />
            </FormItem>
            <FormItem label="Quantity" field="quantity" required>
              <InputNumber min={0} style={{ width: '100%' }} placeholder="Number of shares/units" />
            </FormItem>
            <FormItem>
              <Text type="secondary">
                Available: {formatCurrency(available_balance)}
              </Text>
            </FormItem>
            <FormItem>
              <Button type="primary" htmlType="submit" long>
                Place Buy Order
              </Button>
            </FormItem>
          </Form>
        </Modal>

        {/* Sell Modal */}
        <Modal
          title="Sell Order"
          visible={sellModalVisible}
          onCancel={() => setSellModalVisible(false)}
          footer={null}
        >
          <Form form={sellForm} layout="vertical" onFinish={handleSell}>
            <FormItem label="Symbol" field="symbol" required>
              <Input placeholder="e.g., AAPL, BTC/USD" />
            </FormItem>
            <FormItem label="Order Type" field="orderType" required initialValue="market">
              <Input disabled value="Market Order" />
            </FormItem>
            <FormItem label="Quantity" field="quantity" required>
              <InputNumber min={0} style={{ width: '100%' }} placeholder="Number of shares/units" />
            </FormItem>
            <FormItem>
              <Text type="secondary">
                Your positions: {positions.map(p => `${p.symbol}: ${formatQuantity(p.available_quantity)}`).join(', ') || 'None'}
              </Text>
            </FormItem>
            <FormItem>
              <Button type="primary" htmlType="submit" long>
                Place Sell Order
              </Button>
            </FormItem>
          </Form>
        </Modal>

        {/* Reset Modal */}
        <Modal
          title="Reset Account"
          visible={resetModalVisible}
          onCancel={() => setResetModalVisible(false)}
          footer={null}
        >
          <Text type="warning">
            This will close all positions, cancel all orders, and reset your balance.
          </Text>
          <Divider />
          <Form form={resetForm} layout="vertical" onFinish={handleReset}>
            <FormItem label="New Initial Capital (optional)" field="newCapital">
              <InputNumber min={1000} style={{ width: '100%' }} placeholder={`Default: ${account.initial_capital}`} />
            </FormItem>
            <FormItem>
              <Button type="primary" status="danger" htmlType="submit" long>
                Confirm Reset
              </Button>
            </FormItem>
          </Form>
        </Modal>
      </div>
    </ErrorBoundary>
  );
};

export default VirtualAccountPage;