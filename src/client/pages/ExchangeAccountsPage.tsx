/**
 * Exchange Accounts Page
 * 
 * UI for multi-exchange account management:
 * - Add/remove exchange accounts (Alpaca, Binance, OKX, Bybit)
 * - Switch between accounts
 * - View unified account summary
 * - Manage account groups for strategy execution
 * 
 * Issue #389: 多账户管理
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Statistic,
  Grid,
  Space,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Message,
  Spin,
  Empty,
  Popconfirm,
  Divider,
  Progress,
  Tabs,
  Badge,
  Typography,
  Tooltip,
  Descriptions,
  Alert,
} from '@arco-design/web-react';
import {
  IconPlus,
  IconRefresh,
  IconDelete,
  IconSwap,
  IconCheck,
  IconClose,
  IconExclamationCircle,
  IconStar,
  IconStarFill,
  IconFolder,
  IconSettings,
} from '@arco-design/web-react/icon';
import { useAuth } from '../hooks/useAuth';
import { ErrorBoundary } from '../components/ErrorBoundary';

const { Row, Col } = Grid;
const { Title, Text } = Typography;
const { TabPane } = Tabs;
const FormItem = Form.Item;

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Types
type ExchangeType = 'alpaca' | 'binance' | 'okx' | 'bybit' | 'mock';
type AccountEnvironment = 'live' | 'paper' | 'testnet';
type AccountStatus = 'active' | 'inactive' | 'error' | 'connecting';

interface ExchangeAccount {
  id: string;
  user_id: string;
  name: string;
  exchange: ExchangeType;
  environment: AccountEnvironment;
  api_key: string;
  api_secret: string;
  api_passphrase?: string;
  is_primary: boolean;
  status: AccountStatus;
  last_sync_at?: string;
  last_error?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface AccountBalance {
  id: string;
  account_id: string;
  currency: string;
  total_balance: number;
  available_balance: number;
  frozen_balance: number;
  usd_value: number;
  last_updated: string;
}

interface AccountPosition {
  id: string;
  account_id: string;
  symbol: string;
  quantity: number;
  available_quantity: number;
  average_cost: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  last_updated: string;
}

interface AccountGroup {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  account_ids: string[];
  strategy_allocation: Record<string, number>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AccountSummaryItem {
  account_id: string;
  account_name: string;
  exchange: ExchangeType;
  environment: AccountEnvironment;
  status: AccountStatus;
  balance_usd: number;
  positions_value: number;
  unrealized_pnl: number;
  roi_pct: number;
  is_primary: boolean;
}

interface UnifiedAccountSummary {
  total_balance_usd: number;
  total_positions_value: number;
  total_unrealized_pnl: number;
  total_realized_pnl: number;
  total_roi_pct: number;
  accounts: AccountSummaryItem[];
  positions_by_symbol: Record<string, UnifiedPositionSummary>;
}

interface UnifiedPositionSummary {
  symbol: string;
  total_quantity: number;
  weighted_avg_cost: number;
  current_price: number;
  total_market_value: number;
  total_unrealized_pnl: number;
  accounts: {
    account_id: string;
    account_name: string;
    quantity: number;
    unrealized_pnl: number;
  }[];
}

// Exchange options for form
const EXCHANGE_OPTIONS = [
  { label: 'Alpaca', value: 'alpaca' },
  { label: 'Binance', value: 'binance' },
  { label: 'OKX', value: 'okx' },
  { label: 'Bybit', value: 'bybit' },
  { label: 'Mock (Testing)', value: 'mock' },
];

const ENVIRONMENT_OPTIONS = [
  { label: 'Live Trading', value: 'live' },
  { label: 'Paper Trading', value: 'paper' },
  { label: 'Testnet', value: 'testnet' },
];

// Status colors
const STATUS_COLORS: Record<AccountStatus, string> = {
  active: 'green',
  inactive: 'gray',
  error: 'red',
  connecting: 'orange',
};

const EXCHANGE_COLORS: Record<ExchangeType, string> = {
  alpaca: 'arcoblue',
  binance: 'gold',
  okx: 'purple',
  bybit: 'cyan',
  mock: 'gray',
};

const ExchangeAccountsPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<ExchangeAccount[]>([]);
  const [unifiedSummary, setUnifiedSummary] = useState<UnifiedAccountSummary | null>(null);
  const [accountGroups, setAccountGroups] = useState<AccountGroup[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<ExchangeAccount | null>(null);
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [positions, setPositions] = useState<AccountPosition[]>([]);
  
  // Modal states
  const [addAccountVisible, setAddAccountVisible] = useState(false);
  const [editAccountVisible, setEditAccountVisible] = useState(false);
  const [addGroupVisible, setAddGroupVisible] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [groupForm] = Form.useForm();

  // Fetch accounts
  const fetchAccounts = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const [accountsRes, summaryRes, groupsRes] = await Promise.all([
        fetch(`${API_BASE}/api/exchange-accounts`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/api/exchange-accounts/unified`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/api/account-groups`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      if (accountsRes.ok) {
        const data = await accountsRes.json();
        setAccounts(data.data || []);
      }

      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setUnifiedSummary(data.data);
      }

      if (groupsRes.ok) {
        const data = await groupsRes.json();
        setAccountGroups(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
      Message.error('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch account details
  const fetchAccountDetails = async (accountId: string) => {
    try {
      const token = localStorage.getItem('token');
      
      const [balancesRes, positionsRes] = await Promise.all([
        fetch(`${API_BASE}/api/exchange-accounts/${accountId}/balances`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/api/exchange-accounts/${accountId}/positions`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      if (balancesRes.ok) {
        const data = await balancesRes.json();
        setBalances(data.data || []);
      }

      if (positionsRes.ok) {
        const data = await positionsRes.json();
        setPositions(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch account details:', error);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Add account
  const handleAddAccount = async () => {
    try {
      const values = await addForm.validate();
      const token = localStorage.getItem('token');
      
      const res = await fetch(`${API_BASE}/api/exchange-accounts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: values.name,
          exchange: values.exchange,
          environment: values.environment,
          apiKey: values.apiKey,
          apiSecret: values.apiSecret,
          apiPassphrase: values.apiPassphrase,
          isPrimary: values.isPrimary,
        }),
      });

      const data = await res.json();
      
      if (data.success) {
        Message.success('Account added successfully');
        setAddAccountVisible(false);
        addForm.resetFields();
        fetchAccounts();
      } else {
        Message.error(data.error || 'Failed to add account');
      }
    } catch (error) {
      console.error('Failed to add account:', error);
      Message.error('Failed to add account');
    }
  };

  // Update account
  const handleUpdateAccount = async () => {
    if (!selectedAccount) return;
    
    try {
      const values = await editForm.validate();
      const token = localStorage.getItem('token');
      
      const res = await fetch(`${API_BASE}/api/exchange-accounts/${selectedAccount.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: values.name,
          apiKey: values.apiKey,
          apiSecret: values.apiSecret,
          isPrimary: values.isPrimary,
        }),
      });

      const data = await res.json();
      
      if (data.success) {
        Message.success('Account updated successfully');
        setEditAccountVisible(false);
        setSelectedAccount(null);
        fetchAccounts();
      } else {
        Message.error(data.error || 'Failed to update account');
      }
    } catch (error) {
      console.error('Failed to update account:', error);
      Message.error('Failed to update account');
    }
  };

  // Delete account
  const handleDeleteAccount = async (accountId: string) => {
    try {
      const token = localStorage.getItem('token');
      
      const res = await fetch(`${API_BASE}/api/exchange-accounts/${accountId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await res.json();
      
      if (data.success) {
        Message.success('Account deleted successfully');
        fetchAccounts();
      } else {
        Message.error(data.error || 'Failed to delete account');
      }
    } catch (error) {
      console.error('Failed to delete account:', error);
      Message.error('Failed to delete account');
    }
  };

  // Set primary account
  const handleSetPrimary = async (accountId: string) => {
    try {
      const token = localStorage.getItem('token');
      
      const res = await fetch(`${API_BASE}/api/exchange-accounts/${accountId}/set-primary`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await res.json();
      
      if (data.success) {
        Message.success('Primary account updated');
        fetchAccounts();
      } else {
        Message.error(data.error || 'Failed to set primary account');
      }
    } catch (error) {
      console.error('Failed to set primary account:', error);
      Message.error('Failed to set primary account');
    }
  };

  // Switch account
  const handleSwitchAccount = async (accountId: string) => {
    try {
      const token = localStorage.getItem('token');
      
      const res = await fetch(`${API_BASE}/api/exchange-accounts/${accountId}/switch`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await res.json();
      
      if (data.success) {
        Message.success(`Switched to ${data.data.name}`);
        fetchAccounts();
      } else {
        Message.error(data.error || 'Failed to switch account');
      }
    } catch (error) {
      console.error('Failed to switch account:', error);
      Message.error('Failed to switch account');
    }
  };

  // Sync account
  const handleSyncAccount = async (accountId: string) => {
    try {
      setSyncing(accountId);
      const token = localStorage.getItem('token');
      
      const res = await fetch(`${API_BASE}/api/exchange-accounts/${accountId}/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await res.json();
      
      if (data.success) {
        Message.success('Account synced successfully');
        fetchAccounts();
      } else {
        Message.error(data.error || 'Failed to sync account');
      }
    } catch (error) {
      console.error('Failed to sync account:', error);
      Message.error('Failed to sync account');
    } finally {
      setSyncing(null);
    }
  };

  // Create account group
  const handleCreateGroup = async () => {
    try {
      const values = await groupForm.validate();
      const token = localStorage.getItem('token');
      
      const res = await fetch(`${API_BASE}/api/account-groups`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: values.name,
          description: values.description,
          accountIds: values.accountIds,
        }),
      });

      const data = await res.json();
      
      if (data.success) {
        Message.success('Account group created successfully');
        setAddGroupVisible(false);
        groupForm.resetFields();
        fetchAccounts();
      } else {
        Message.error(data.error || 'Failed to create account group');
      }
    } catch (error) {
      console.error('Failed to create account group:', error);
      Message.error('Failed to create account group');
    }
  };

  // Open edit modal
  const openEditModal = (account: ExchangeAccount) => {
    setSelectedAccount(account);
    editForm.setFieldsValue({
      name: account.name,
      isPrimary: account.is_primary,
    });
    setEditAccountVisible(true);
  };

  // Account columns
  const accountColumns = [
    {
      title: 'Account Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: ExchangeAccount) => (
        <Space>
          {record.is_primary && (
            <Tooltip content="Primary Account">
              <IconStarFill style={{ color: 'rgb(var(--gold-6))' }} />
            </Tooltip>
          )}
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: 'Exchange',
      dataIndex: 'exchange',
      key: 'exchange',
      render: (exchange: ExchangeType) => (
        <Tag color={EXCHANGE_COLORS[exchange]}>
          {exchange.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Environment',
      dataIndex: 'environment',
      key: 'environment',
      render: (env: AccountEnvironment) => (
        <Tag color={env === 'live' ? 'red' : env === 'paper' ? 'green' : 'blue'}>
          {env.charAt(0).toUpperCase() + env.slice(1)}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: AccountStatus) => (
        <Tag color={STATUS_COLORS[status]}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Tag>
      ),
    },
    {
      title: 'Last Sync',
      dataIndex: 'last_sync_at',
      key: 'last_sync_at',
      render: (date: string) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: ExchangeAccount) => (
        <Space>
          <Button
            size="small"
            icon={<IconRefresh />}
            loading={syncing === record.id}
            onClick={() => handleSyncAccount(record.id)}
          />
          <Button
            size="small"
            icon={<IconSwap />}
            onClick={() => handleSwitchAccount(record.id)}
          />
          {!record.is_primary && (
            <Button
              size="small"
              icon={<IconStar />}
              onClick={() => handleSetPrimary(record.id)}
            />
          )}
          <Button
            size="small"
            icon={<IconSettings />}
            onClick={() => openEditModal(record)}
          />
          <Popconfirm
            title="Delete this account?"
            onOk={() => handleDeleteAccount(record.id)}
          >
            <Button size="small" icon={<IconDelete />} status="danger" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Group columns
  const groupColumns = [
    {
      title: 'Group Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Accounts',
      dataIndex: 'account_ids',
      key: 'account_ids',
      render: (ids: string[]) => (
        <Text>{ids.length} account(s)</Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'gray'}>
          {active ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
        <Spin size={40} />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div style={{ padding: '20px' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Header */}
          <Row justify="space-between" align="center">
            <Col>
              <Title heading={4}>Exchange Accounts</Title>
              <Text type="secondary">
                Manage multiple exchange accounts and unified portfolio
              </Text>
            </Col>
            <Col>
              <Space>
                <Button
                  type="primary"
                  icon={<IconPlus />}
                  onClick={() => setAddAccountVisible(true)}
                >
                  Add Account
                </Button>
                <Button
                  icon={<IconFolder />}
                  onClick={() => setAddGroupVisible(true)}
                >
                  Create Group
                </Button>
              </Space>
            </Col>
          </Row>

          {/* Unified Summary */}
          {unifiedSummary && (
            <Card>
              <Row gutter={24}>
                <Col span={4}>
                  <Statistic
                    title="Total Balance (USD)"
                    value={unifiedSummary.total_balance_usd}
                    prefix="$"
                    precision={2}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="Positions Value"
                    value={unifiedSummary.total_positions_value}
                    prefix="$"
                    precision={2}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="Unrealized P&L"
                    value={unifiedSummary.total_unrealized_pnl}
                    prefix="$"
                    precision={2}
                    valueStyle={{
                      color: unifiedSummary.total_unrealized_pnl >= 0 ? 'rgb(var(--green-6))' : 'rgb(var(--red-6))',
                    }}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="Total ROI"
                    value={unifiedSummary.total_roi_pct}
                    suffix="%"
                    precision={2}
                    valueStyle={{
                      color: unifiedSummary.total_roi_pct >= 0 ? 'rgb(var(--green-6))' : 'rgb(var(--red-6))',
                    }}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="Total Accounts"
                    value={accounts.length}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="Active Groups"
                    value={accountGroups.filter(g => g.is_active).length}
                  />
                </Col>
              </Row>
            </Card>
          )}

          {/* Main Content */}
          <Tabs defaultActiveTab="accounts">
            <TabPane key="accounts" tab="Accounts">
              <Card>
                {accounts.length === 0 ? (
                  <Empty
                    description="No exchange accounts configured"
                    icon={<IconExclamationCircle style={{ fontSize: 60 }} />}
                  />
                ) : (
                  <Table
                    columns={accountColumns}
                    data={accounts}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                  />
                )}
              </Card>
            </TabPane>

            <TabPane key="positions" tab="Unified Positions">
              <Card>
                {unifiedSummary && Object.keys(unifiedSummary.positions_by_symbol).length > 0 ? (
                  <Table
                    data={Object.values(unifiedSummary.positions_by_symbol)}
                    rowKey="symbol"
                    pagination={{ pageSize: 10 }}
                    columns={[
                      { title: 'Symbol', dataIndex: 'symbol', key: 'symbol' },
                      { 
                        title: 'Total Quantity', 
                        dataIndex: 'total_quantity', 
                        key: 'total_quantity',
                        render: (v: number) => v.toFixed(4),
                      },
                      { 
                        title: 'Avg Cost', 
                        dataIndex: 'weighted_avg_cost', 
                        key: 'weighted_avg_cost',
                        render: (v: number) => `$${v.toFixed(2)}`,
                      },
                      { 
                        title: 'Current Price', 
                        dataIndex: 'current_price', 
                        key: 'current_price',
                        render: (v: number) => `$${v.toFixed(2)}`,
                      },
                      { 
                        title: 'Market Value', 
                        dataIndex: 'total_market_value', 
                        key: 'total_market_value',
                        render: (v: number) => `$${v.toFixed(2)}`,
                      },
                      { 
                        title: 'Unrealized P&L', 
                        dataIndex: 'total_unrealized_pnl', 
                        key: 'total_unrealized_pnl',
                        render: (v: number) => (
                          <Text style={{ color: v >= 0 ? 'rgb(var(--green-6))' : 'rgb(var(--red-6))' }}>
                            ${v.toFixed(2)}
                          </Text>
                        ),
                      },
                      {
                        title: 'Accounts',
                        dataIndex: 'accounts',
                        key: 'accounts',
                        render: (accounts: any[]) => (
                          <Text>{accounts.length} account(s)</Text>
                        ),
                      },
                    ]}
                  />
                ) : (
                  <Empty description="No positions found across accounts" />
                )}
              </Card>
            </TabPane>

            <TabPane key="groups" tab="Account Groups">
              <Card>
                {accountGroups.length === 0 ? (
                  <Empty
                    description="No account groups created"
                    icon={<IconFolder style={{ fontSize: 60 }} />}
                  />
                ) : (
                  <Table
                    columns={groupColumns}
                    data={accountGroups}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                  />
                )}
              </Card>
            </TabPane>
          </Tabs>
        </Space>

        {/* Add Account Modal */}
        <Modal
          title="Add Exchange Account"
          visible={addAccountVisible}
          onOk={handleAddAccount}
          onCancel={() => {
            setAddAccountVisible(false);
            addForm.resetFields();
          }}
          okText="Add Account"
          unmountOnExit
        >
          <Alert
            type="warning"
            content="Your API keys will be encrypted before storage. Never share your API keys with anyone."
            style={{ marginBottom: 16 }}
          />
          <Form form={addForm} layout="vertical">
            <FormItem
              label="Account Name"
              field="name"
              rules={[{ required: true, message: 'Please enter account name' }]}
            >
              <Input placeholder="My Alpaca Paper Account" />
            </FormItem>
            <FormItem
              label="Exchange"
              field="exchange"
              rules={[{ required: true, message: 'Please select exchange' }]}
            >
              <Select options={EXCHANGE_OPTIONS} placeholder="Select exchange" />
            </FormItem>
            <FormItem
              label="Environment"
              field="environment"
              rules={[{ required: true, message: 'Please select environment' }]}
              initialValue="paper"
            >
              <Select options={ENVIRONMENT_OPTIONS} placeholder="Select environment" />
            </FormItem>
            <FormItem
              label="API Key"
              field="apiKey"
              rules={[{ required: true, message: 'Please enter API key' }]}
            >
              <Input placeholder="Enter your API key" />
            </FormItem>
            <FormItem
              label="API Secret"
              field="apiSecret"
              rules={[{ required: true, message: 'Please enter API secret' }]}
            >
              <Input.Password placeholder="Enter your API secret" />
            </FormItem>
            <FormItem
              label="API Passphrase (optional)"
              field="apiPassphrase"
              tooltip="Required for some exchanges like OKX"
            >
              <Input.Password placeholder="Enter API passphrase if required" />
            </FormItem>
            <FormItem
              label="Set as Primary"
              field="isPrimary"
              triggerPropName="checked"
              initialValue={accounts.length === 0}
            >
              <Select options={[
                { label: 'Yes', value: true },
                { label: 'No', value: false },
              ]} />
            </FormItem>
          </Form>
        </Modal>

        {/* Edit Account Modal */}
        <Modal
          title="Edit Account"
          visible={editAccountVisible}
          onOk={handleUpdateAccount}
          onCancel={() => {
            setEditAccountVisible(false);
            setSelectedAccount(null);
          }}
          okText="Save Changes"
          unmountOnExit
        >
          <Form form={editForm} layout="vertical">
            <FormItem
              label="Account Name"
              field="name"
              rules={[{ required: true, message: 'Please enter account name' }]}
            >
              <Input placeholder="Account name" />
            </FormItem>
            <FormItem
              label="API Key (leave empty to keep current)"
              field="apiKey"
            >
              <Input placeholder="Enter new API key to update" />
            </FormItem>
            <FormItem
              label="API Secret (leave empty to keep current)"
              field="apiSecret"
            >
              <Input.Password placeholder="Enter new API secret to update" />
            </FormItem>
            <FormItem
              label="Set as Primary"
              field="isPrimary"
              triggerPropName="checked"
            >
              <Select options={[
                { label: 'Yes', value: true },
                { label: 'No', value: false },
              ]} />
            </FormItem>
          </Form>
        </Modal>

        {/* Create Group Modal */}
        <Modal
          title="Create Account Group"
          visible={addGroupVisible}
          onOk={handleCreateGroup}
          onCancel={() => {
            setAddGroupVisible(false);
            groupForm.resetFields();
          }}
          okText="Create Group"
          unmountOnExit
        >
          <Alert
            type="info"
            content="Account groups allow you to execute strategies across multiple accounts simultaneously."
            style={{ marginBottom: 16 }}
          />
          <Form form={groupForm} layout="vertical">
            <FormItem
              label="Group Name"
              field="name"
              rules={[{ required: true, message: 'Please enter group name' }]}
            >
              <Input placeholder="My Trading Accounts" />
            </FormItem>
            <FormItem label="Description" field="description">
              <Input placeholder="Optional description" />
            </FormItem>
            <FormItem
              label="Accounts"
              field="accountIds"
              rules={[{ required: true, message: 'Please select at least one account' }]}
            >
              <Select
                mode="multiple"
                placeholder="Select accounts"
                options={accounts.map(a => ({
                  label: `${a.name} (${a.exchange})`,
                  value: a.id,
                }))}
              />
            </FormItem>
          </Form>
        </Modal>
      </div>
    </ErrorBoundary>
  );
};

export default ExchangeAccountsPage;