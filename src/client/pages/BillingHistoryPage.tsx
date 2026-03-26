/**
 * BillingHistoryPage - User billing history and payment methods
 * Shows billing history, invoices, and payment method management
 */

import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Table,
  Button,
  Space,
  Tag,
  Spin,
  Message,
  Modal,
  Divider,
  Empty,
  Grid,
  Descriptions,
} from '@arco-design/web-react';
import {
  IconDownload,
  IconCreditCard,
  IconPlus,
  IconDelete,
  IconCheck,
  IconClose,
  IconRefresh,
  IconCalendar,
} from '@arco-design/web-react/icon';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useSEO } from '../hooks/useSEO';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;
const { Row, Col } = Grid;

interface Invoice {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  planName: string;
  invoiceNumber: string;
  downloadUrl?: string;
}

interface PaymentMethod {
  id: string;
  type: 'card' | 'alipay' | 'wechat';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

const BillingHistoryPage: React.FC = () => {
  const { t } = useTranslation('subscription');
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useSEO({
    title: t('billing.seo.title', '账单历史 - AlphaArena'),
    description: t('billing.seo.description', '查看您的账单历史和管理支付方式'),
  });

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login?redirect=/settings/billing');
      return;
    }
    
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchBillingData();
    }
  }, [isAuthenticated]);

  const fetchBillingData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('supabase_token');
      
      // Fetch billing history
      const historyRes = await fetch('/api/subscription/history', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (historyRes.ok) {
        const data = await historyRes.json();
        // Transform history data into invoice format
        const transformedInvoices: Invoice[] = (data.history || []).map((item: any, index: number) => ({
          id: item.id || `inv-${index}`,
          date: item.created_at,
          amount: item.amount || 0,
          currency: 'CNY',
          status: item.status || 'paid',
          planName: item.plan || 'Pro',
          invoiceNumber: `INV-${new Date(item.created_at).getFullYear()}-${String(index + 1).padStart(4, '0')}`,
        }));
        setInvoices(transformedInvoices);
      }

      // Fetch payment methods (placeholder - will be implemented with Stripe)
      // For now, show empty state or mock data
      setPaymentMethods([]);
    } catch (error) {
      console.error('Failed to fetch billing data:', error);
      Message.error(t('billing.fetchError', '加载账单数据失败'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      paid: { color: 'green', text: t('billing.status.paid', '已支付') },
      pending: { color: 'orange', text: t('billing.status.pending', '待支付') },
      failed: { color: 'red', text: t('billing.status.failed', '支付失败') },
      refunded: { color: 'gray', text: t('billing.status.refunded', '已退款') },
    };
    const config = statusConfig[status] || statusConfig.paid;
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getPaymentMethodIcon = (type: string) => {
    switch (type) {
      case 'card':
        return <IconCreditCard style={{ fontSize: 24 }} />;
      case 'alipay':
        return <Text style={{ fontSize: 16, fontWeight: 'bold' }}>支</Text>;
      case 'wechat':
        return <Text style={{ fontSize: 16, fontWeight: 'bold' }}>微</Text>;
      default:
        return <IconCreditCard style={{ fontSize: 24 }} />;
    }
  };

  const handleAddPaymentMethod = () => {
    Modal.info({
      title: t('billing.addPaymentMethod', '添加支付方式'),
      content: (
        <div>
          <Paragraph>
            {t('billing.addPaymentMethodDesc', '支付方式管理功能即将上线，敬请期待。')}
          </Paragraph>
          <Text type="secondary">
            {t('billing.addPaymentMethodNote', '目前支持在订阅流程中绑定支付方式。')}
          </Text>
        </div>
      ),
    });
  };

  const handleDeletePaymentMethod = (methodId: string) => {
    Modal.confirm({
      title: t('billing.deletePaymentMethod', '删除支付方式'),
      content: t('billing.deletePaymentMethodConfirm', '确定要删除此支付方式吗？'),
      onOk: async () => {
        // Placeholder for delete logic
        Message.success(t('billing.deleteSuccess', '支付方式已删除'));
        setPaymentMethods(prev => prev.filter(m => m.id !== methodId));
      },
    });
  };

  const handleSetDefaultPaymentMethod = (methodId: string) => {
    setPaymentMethods(prev => 
      prev.map(m => ({
        ...m,
        isDefault: m.id === methodId,
      }))
    );
    Message.success(t('billing.setDefaultSuccess', '已设为默认支付方式'));
  };

  const handleDownloadInvoice = (invoice: Invoice) => {
    if (invoice.downloadUrl) {
      window.open(invoice.downloadUrl, '_blank');
    } else {
      Message.info(t('billing.downloadNotAvailable', '发票下载功能即将上线'));
    }
  };

  const invoiceColumns = [
    {
      title: t('billing.invoiceNumber', '发票号'),
      dataIndex: 'invoiceNumber',
      key: 'invoiceNumber',
      width: isMobile ? 100 : 150,
    },
    {
      title: t('billing.date', '日期'),
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => new Date(date).toLocaleDateString('zh-CN'),
    },
    {
      title: t('billing.plan', '套餐'),
      dataIndex: 'planName',
      key: 'planName',
    },
    {
      title: t('billing.amount', '金额'),
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number, record: Invoice) => (
        <Text strong>¥{amount} {record.currency}</Text>
      ),
    },
    {
      title: t('billing.status.label', '状态'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: t('billing.actions', '操作'),
      key: 'actions',
      width: 100,
      render: (_: any, record: Invoice) => (
        <Button
          type="text"
          icon={<IconDownload />}
          onClick={() => handleDownloadInvoice(record)}
          disabled={record.status !== 'paid'}
        >
          {!isMobile && t('billing.download', '下载')}
        </Button>
      ),
    },
  ];

  return (
    <ErrorBoundary>
      <div style={{ 
        padding: isMobile ? '16px' : '24px', 
        maxWidth: 1200, 
        margin: '0 auto',
      }}>
        <Title heading={3} style={{ marginBottom: 24 }}>
          {t('billing.title', '账单与支付')}
        </Title>

        <Spin loading={loading} style={{ display: 'block' }}>
          {/* Payment Methods Section */}
          <Card style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Title heading={5} style={{ margin: 0 }}>
                <IconCreditCard style={{ marginRight: 8 }} />
                {t('billing.paymentMethods', '支付方式')}
              </Title>
              <Button 
                type="primary" 
                icon={<IconPlus />}
                onClick={handleAddPaymentMethod}
              >
                {t('billing.add', '添加')}
              </Button>
            </div>

            {paymentMethods.length > 0 ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                {paymentMethods.map((method) => (
                  <Card 
                    key={method.id}
                    style={{ 
                      background: 'var(--color-fill-1)',
                      border: method.isDefault ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ 
                          width: 48, 
                          height: 32, 
                          background: 'var(--color-bg-2)',
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          {getPaymentMethodIcon(method.type)}
                        </div>
                        <div>
                          <Text strong>
                            {method.type === 'card' ? `${method.brand} ****${method.last4}` : 
                             method.type === 'alipay' ? '支付宝' : '微信支付'}
                          </Text>
                          {method.type === 'card' && method.expiryMonth && (
                            <Text type="secondary" style={{ marginLeft: 8 }}>
                              {method.expiryMonth}/{method.expiryYear}
                            </Text>
                          )}
                        </div>
                        {method.isDefault && (
                          <Tag color="blue">{t('billing.default', '默认')}</Tag>
                        )}
                      </div>
                      <Space>
                        {!method.isDefault && (
                          <Button 
                            type="text" 
                            size="small"
                            onClick={() => handleSetDefaultPaymentMethod(method.id)}
                          >
                            {t('billing.setDefault', '设为默认')}
                          </Button>
                        )}
                        <Button 
                          type="text" 
                          status="danger"
                          size="small"
                          icon={<IconDelete />}
                          onClick={() => handleDeletePaymentMethod(method.id)}
                        />
                      </Space>
                    </div>
                  </Card>
                ))}
              </Space>
            ) : (
              <Empty
                icon={<IconCreditCard style={{ fontSize: 48, color: '#c9cdd4' }} />}
                description={t('billing.noPaymentMethods', '暂无支付方式')}
                style={{ padding: '24px 0' }}
              >
                <Button type="primary" onClick={handleAddPaymentMethod}>
                  {t('billing.addFirst', '添加支付方式')}
                </Button>
              </Empty>
            )}
          </Card>

          {/* Billing History Section */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Title heading={5} style={{ margin: 0 }}>
                <IconCalendar style={{ marginRight: 8 }} />
                {t('billing.history', '账单历史')}
              </Title>
              <Button 
                type="text" 
                icon={<IconRefresh />}
                onClick={fetchBillingData}
              >
                {t('billing.refresh', '刷新')}
              </Button>
            </div>

            {invoices.length > 0 ? (
              <Table
                columns={invoiceColumns}
                data={invoices}
                pagination={{ pageSize: 10 }}
                scroll={{ x: isMobile ? 600 : 'auto' }}
                border={{ wrapper: true, cell: true }}
              />
            ) : (
              <Empty
                icon={<IconCalendar style={{ fontSize: 48, color: '#c9cdd4' }} />}
                description={t('billing.noHistory', '暂无账单记录')}
                style={{ padding: '24px 0' }}
              />
            )}
          </Card>

          {/* Help Section */}
          <Card style={{ marginTop: 24 }}>
            <Title heading={5}>{t('billing.help.title', '需要帮助？')}</Title>
            <Divider style={{ margin: '16px 0' }} />
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text>
                {t('billing.help.contact', '如有账单相关问题，请联系客服：')}
                <Text copyable style={{ marginLeft: 8 }}>billing@alphaarena.com</Text>
              </Text>
              <Text type="secondary">
                {t('billing.help.hours', '客服工作时间：周一至周五 9:00-18:00')}
              </Text>
            </Space>
          </Card>
        </Spin>
      </div>
    </ErrorBoundary>
  );
};

export default BillingHistoryPage;