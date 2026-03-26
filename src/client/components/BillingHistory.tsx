/**
 * BillingHistory Component
 * Displays user's billing and subscription history
 * Issue #638: VIP 订阅管理 UI
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Table,
  Tag,
  Button,
  Space,
  Spin,
  Empty,
  Message,
  Divider,
} from '@arco-design/web-react';
import {
  IconDownload,
  IconRefresh,
  IconCheck,
  IconClose,
  IconSync,
  IconArrowUp,
  IconArrowDown,
} from '@arco-design/web-react/icon';
import { useSubscription } from '../hooks/useSubscription';
import { SubscriptionAction, SubscriptionPlan, PLAN_DISPLAY_NAMES } from '../../types/subscription.types';

const { Title, Text } = Typography;

interface HistoryEntry {
  id: string;
  action: SubscriptionAction;
  from_plan?: SubscriptionPlan;
  to_plan: SubscriptionPlan;
  reason?: string;
  amount?: number;
  currency?: string;
  created_at: string;
  invoice_url?: string;
}

interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: 'paid' | 'open' | 'void' | 'uncollectible';
  created_at: string;
  invoice_url?: string;
  invoice_pdf?: string;
}

const ACTION_LABELS: Record<SubscriptionAction, string> = {
  created: '订阅创建',
  upgraded: '升级',
  downgraded: '降级',
  canceled: '取消订阅',
  renewed: '续费',
  reactivated: '重新激活',
  expired: '过期',
};

const ACTION_ICONS: Record<SubscriptionAction, React.ReactNode> = {
  created: <IconCheck style={{ color: '#00b42a' }} />,
  upgraded: <IconArrowUp style={{ color: '#165dff' }} />,
  downgraded: <IconArrowDown style={{ color: '#ff7d00' }} />,
  canceled: <IconClose style={{ color: '#f53f3f' }} />,
  renewed: <IconSync style={{ color: '#00b42a' }} />,
  reactivated: <IconCheck style={{ color: '#00b42a' }} />,
  expired: <IconClose style={{ color: '#86909c' }} />,
};

const ACTION_COLORS: Record<SubscriptionAction, string> = {
  created: 'green',
  upgraded: 'arcoblue',
  downgraded: 'orange',
  canceled: 'red',
  renewed: 'green',
  reactivated: 'green',
  expired: 'gray',
};

const BillingHistory: React.FC = () => {
  const { subscription } = useSubscription();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      // Fetch subscription history
      const historyRes = await fetch('/api/subscription/history', {
        credentials: 'include',
      });
      
      if (historyRes.ok) {
        const data = await historyRes.json();
        setHistory(data.history || []);
      }

      // Fetch invoices (if available)
      // Note: This endpoint may need to be implemented
      const invoicesRes = await fetch('/api/subscription/invoices', {
        credentials: 'include',
      });
      
      if (invoicesRes.ok) {
        const data = await invoicesRes.json();
        setInvoices(data.invoices || []);
      }
    } catch (err) {
      console.error('Failed to fetch billing history:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatAmount = (amount: number, currency: string = 'CNY') => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency,
    }).format(amount / 100); // Stripe amounts are in cents
  };

  if (loading) {
    return (
      <Card style={{ textAlign: 'center', padding: 24 }}>
        <Spin />
      </Card>
    );
  }

  const hasData = history.length > 0 || invoices.length > 0;

  if (!hasData) {
    return (
      <Card>
        <Empty description="暂无账单记录" />
      </Card>
    );
  }

  // Mobile view - card layout
  if (isMobile) {
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Title heading={5} style={{ margin: 0 }}>
            账单历史
          </Title>
          <Button
            type="text"
            icon={<IconRefresh />}
            onClick={fetchHistory}
            loading={loading}
          >
            刷新
          </Button>
        </div>

        <Divider style={{ margin: '12px 0' }} />

        <Space direction="vertical" style={{ width: '100%' }} size="medium">
          {history.map((entry) => (
            <div
              key={entry.id}
              style={{
                padding: 12,
                background: 'var(--color-fill-1)',
                borderRadius: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {ACTION_ICONS[entry.action]}
                  <Text>{ACTION_LABELS[entry.action]}</Text>
                </div>
                <Tag color={ACTION_COLORS[entry.action]} size="small">
                  {PLAN_DISPLAY_NAMES[entry.to_plan]}
                </Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                {formatDate(entry.created_at)}
              </Text>
            </div>
          ))}
        </Space>
      </Card>
    );
  }

  // Desktop view - table layout
  const columns = [
    {
      title: '类型',
      dataIndex: 'action',
      key: 'action',
      render: (action: SubscriptionAction) => (
        <Space>
          {ACTION_ICONS[action]}
          <Text>{ACTION_LABELS[action]}</Text>
        </Space>
      ),
    },
    {
      title: '计划变更',
      dataIndex: 'plan_change',
      key: 'plan_change',
      render: (_: any, record: HistoryEntry) => (
        <Space>
          {record.from_plan && (
            <>
              <Tag>{PLAN_DISPLAY_NAMES[record.from_plan]}</Tag>
              <Text type="secondary">→</Text>
            </>
          )}
          <Tag color={ACTION_COLORS[record.action]}>
            {PLAN_DISPLAY_NAMES[record.to_plan]}
          </Tag>
        </Space>
      ),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number | undefined, record: HistoryEntry) =>
        amount ? formatAmount(amount, record.currency) : '-',
    },
    {
      title: '日期',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => formatDate(date),
    },
    {
      title: '备注',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason: string | undefined) => reason || '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: HistoryEntry) =>
        record.invoice_url ? (
          <Button
            type="text"
            size="small"
            icon={<IconDownload />}
            onClick={() => window.open(record.invoice_url, '_blank')}
          >
            发票
          </Button>
        ) : null,
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title heading={5} style={{ margin: 0 }}>
          账单历史
        </Title>
        <Button
          type="text"
          icon={<IconRefresh />}
          onClick={fetchHistory}
          loading={loading}
        >
          刷新
        </Button>
      </div>

      <Table
        columns={columns}
        data={history}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        size="small"
        scroll={{ x: 600 }}
        noDataElement={<Empty description="暂无账单记录" />}
      />

      {/* Payment Method Section */}
      {subscription && !['free'].includes(subscription.plan) && (
        <>
          <Divider style={{ margin: '24px 0 16px' }} />
          <Title heading={6} style={{ marginBottom: 12 }}>
            支付方式
          </Title>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 16,
              background: 'var(--color-fill-1)',
              borderRadius: 8,
            }}
          >
            <div>
              <Text>通过 Stripe 安全支付</Text>
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                管理您的支付方式和账单信息
              </Text>
            </div>
            <Button
              type="outline"
              onClick={() => {
                // Open Stripe billing portal
                fetch('/api/subscription/portal', {
                  method: 'POST',
                  credentials: 'include',
                })
                  .then((res) => res.json())
                  .then((data) => {
                    if (data.portalUrl) {
                      window.open(data.portalUrl, '_blank');
                    }
                  })
                  .catch(() => Message.error('打开支付管理失败'));
              }}
            >
              管理支付方式
            </Button>
          </div>
        </>
      )}
    </Card>
  );
};

export default BillingHistory;