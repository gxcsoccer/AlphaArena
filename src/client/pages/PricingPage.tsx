/**
 * PricingPage - Public pricing page for subscription plans
 * Displays available subscription plans with feature comparison
 */

import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Button,
  Space,
  Tag,
  Grid,
  Spin,
  Message,
  Modal,
  Radio,
  Divider,
  List,
  Table,
  Tooltip,
} from '@arco-design/web-react';
import {
  IconCheck,
  IconClose,
  IconStar,
  IconTrophy,
  IconThunderbolt,
  IconQuestionCircle,
} from '@arco-design/web-react/icon';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useSEO, PAGE_SEO_CONFIGS } from '../hooks/useSEO';
import { useTranslation } from 'react-i18next';

const { Title, Text, Paragraph } = Typography;
const { Row, Col } = Grid;

interface SubscriptionPlan {
  id: string;
  name: string;
  displayName: string;
  price: number;
  currency: string;
  billingPeriod: string;
  features: string[];
  limits: Record<string, number | string>;
  isPopular?: boolean;
  stripePriceId?: string;
}

const PricingPage: React.FC = () => {
  const { t } = useTranslation('subscription');
  
  // SEO: Update meta tags for pricing page
  useSEO({
    title: t('pricing.seo.title', '定价 - AlphaArena'),
    description: t('pricing.seo.description', '选择适合您的订阅计划，解锁更多交易功能'),
    keywords: t('pricing.seo.keywords', '订阅,定价,Pro,Enterprise,VIP'),
  });

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
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
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/subscription/plans');
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans || []);
      }
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = (planId: string) => {
    const token = localStorage.getItem('token') || localStorage.getItem('supabase_token');
    if (!token) {
      window.location.href = `/login?redirect=/subscription&plan=${planId}`;
      return;
    }
    window.location.href = `/subscription?plan=${planId}`;
  };

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case 'free':
        return <IconStar style={{ fontSize: 32, color: '#86909c' }} />;
      case 'pro':
        return <IconThunderbolt style={{ fontSize: 32, color: '#165dff' }} />;
      case 'enterprise':
        return <IconTrophy style={{ fontSize: 32, color: '#f7ba1e' }} />;
      default:
        return <IconStar style={{ fontSize: 32 }} />;
    }
  };

  const getPlanColor = (planId: string) => {
    switch (planId) {
      case 'free':
        return '#86909c';
      case 'pro':
        return '#165dff';
      case 'enterprise':
        return '#f7ba1e';
      default:
        return '#165dff';
    }
  };

  const formatPrice = (plan: SubscriptionPlan) => {
    if (plan.price === 0) return t('pricing.free', '免费');
    const price = billingPeriod === 'yearly' ? plan.price * 10 : plan.price;
    const period = billingPeriod === 'yearly' ? t('pricing.perYear', '/年') : t('pricing.perMonth', '/月');
    return '¥' + price + period;
  };

  const defaultPlans: SubscriptionPlan[] = [
    {
      id: 'free',
      name: 'free',
      displayName: t('plans.free.name', '免费版'),
      price: 0,
      currency: 'CNY',
      billingPeriod: 'monthly',
      features: [
        t('plans.free.features.0', '最多 3 个并发策略'),
        t('plans.free.features.1', '每日 10 次回测'),
        t('plans.free.features.2', '基础市场数据'),
        t('plans.free.features.3', '社区支持'),
      ],
      limits: { maxStrategies: 3, dailyBacktests: 10 },
    },
    {
      id: 'pro',
      name: 'pro',
      displayName: t('plans.pro.name', '专业版'),
      price: 99,
      currency: 'CNY',
      billingPeriod: 'monthly',
      features: [
        t('plans.pro.features.0', '无限策略运行'),
        t('plans.pro.features.1', '无限回测'),
        t('plans.pro.features.2', '高级市场数据 (Level 2)'),
        t('plans.pro.features.3', 'AI 策略助手'),
        t('plans.pro.features.4', '风险预警通知'),
        t('plans.pro.features.5', '数据导出'),
        t('plans.pro.features.6', '优先支持'),
      ],
      limits: { maxStrategies: -1, dailyBacktests: -1 },
      isPopular: true,
    },
    {
      id: 'enterprise',
      name: 'enterprise',
      displayName: t('plans.enterprise.name', '企业版'),
      price: 0,
      currency: 'CNY',
      billingPeriod: 'monthly',
      features: [
        t('plans.enterprise.features.0', '所有 Pro 功能'),
        t('plans.enterprise.features.1', '多用户团队管理'),
        t('plans.enterprise.features.2', 'API 访问（高配额）'),
        t('plans.enterprise.features.3', '专属客户经理'),
        t('plans.enterprise.features.4', '私有部署支持'),
        t('plans.enterprise.features.5', 'SLA 保障'),
      ],
      limits: { maxStrategies: -1, dailyBacktests: -1 },
    },
  ];

  const displayPlans = plans.length > 0 ? plans : defaultPlans;

  // Feature comparison data
  const featureComparison = [
    {
      feature: t('comparison.strategies', '策略数量'),
      free: '3',
      pro: t('comparison.unlimited', '无限'),
      enterprise: t('comparison.unlimited', '无限'),
    },
    {
      feature: t('comparison.backtests', '每日回测次数'),
      free: '10',
      pro: t('comparison.unlimited', '无限'),
      enterprise: t('comparison.unlimited', '无限'),
    },
    {
      feature: t('comparison.marketData', '市场数据'),
      free: t('comparison.basic', '基础'),
      pro: t('comparison.advanced', '高级 (Level 2)'),
      enterprise: t('comparison.premium', '高级 + API'),
    },
    {
      feature: t('comparison.historicalData', '历史数据'),
      free: '7 ' + t('comparison.days', '天'),
      pro: '30 ' + t('comparison.days', '天'),
      enterprise: t('comparison.unlimited', '无限'),
    },
    {
      feature: t('comparison.aiAssistant', 'AI 策略助手'),
      free: false,
      pro: true,
      enterprise: true,
    },
    {
      feature: t('comparison.alerts', '风险预警'),
      free: false,
      pro: true,
      enterprise: true,
    },
    {
      feature: t('comparison.apiAccess', 'API 访问'),
      free: false,
      pro: t('comparison.basic', '基础'),
      enterprise: t('comparison.advanced', '高级'),
    },
    {
      feature: t('comparison.export', '数据导出'),
      free: false,
      pro: true,
      enterprise: true,
    },
    {
      feature: t('comparison.support', '支持'),
      free: t('comparison.community', '社区'),
      pro: t('comparison.priority', '优先'),
      enterprise: t('comparison.dedicated', '专属'),
    },
  ];

  const renderFeatureValue = (value: boolean | string) => {
    if (typeof value === 'boolean') {
      return value ? (
        <IconCheck style={{ fontSize: 18, color: '#00b42a' }} />
      ) : (
        <IconClose style={{ fontSize: 18, color: '#c9cdd4' }} />
      );
    }
    return <Text>{value}</Text>;
  };

  const columns = [
    {
      title: t('comparison.feature', '功能'),
      dataIndex: 'feature',
      key: 'feature',
      width: isMobile ? 120 : 200,
    },
    {
      title: t('plans.free.name', '免费版'),
      dataIndex: 'free',
      key: 'free',
      render: renderFeatureValue,
    },
    {
      title: (
        <Space>
          {t('plans.pro.name', '专业版')}
          <Tag color="blue">{t('pricing.popular', '推荐')}</Tag>
        </Space>
      ),
      dataIndex: 'pro',
      key: 'pro',
      render: renderFeatureValue,
    },
    {
      title: t('plans.enterprise.name', '企业版'),
      dataIndex: 'enterprise',
      key: 'enterprise',
      render: renderFeatureValue,
    },
  ];

  return (
    <ErrorBoundary>
      <div style={{ 
        padding: isMobile ? '16px' : '40px 24px', 
        maxWidth: 1200, 
        margin: '0 auto',
        minHeight: '100vh',
        background: 'var(--color-bg-1)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <Title heading={1} style={{ marginBottom: 8 }}>
            {t('pricing.title', '选择适合您的计划')}
          </Title>
          <Text type="secondary" style={{ fontSize: 16 }}>
            {t('pricing.subtitle', '升级解锁更多功能，提升交易效率')}
          </Text>

          {/* Billing Period Toggle */}
          <div style={{ marginTop: 24 }}>
            <Radio.Group
              value={billingPeriod}
              onChange={(value) => setBillingPeriod(value)}
              type="button"
              size="large"
            >
              <Radio value="monthly">{t('pricing.monthly', '按月付费')}</Radio>
              <Radio value="yearly">
                {t('pricing.yearly', '按年付费')}
                <Tag color="green" style={{ marginLeft: 8 }}>
                  {t('pricing.save', '省 2 个月')}
                </Tag>
              </Radio>
            </Radio.Group>
          </div>
        </div>

        {/* Plan Cards */}
        <Spin loading={loading} style={{ display: 'block' }}>
          <Row gutter={[16, 16]} style={{ marginBottom: 48 }}>
            {displayPlans.map((plan) => (
              <Col key={plan.id} xs={24} sm={8}>
                <Card
                  style={{
                    height: '100%',
                    borderColor: plan.isPopular ? getPlanColor(plan.id) : undefined,
                    borderWidth: plan.isPopular ? 2 : 1,
                    position: 'relative',
                  }}
                  hoverable
                >
                  {plan.isPopular && (
                    <div
                      style={{
                        position: 'absolute',
                        top: -1,
                        right: 16,
                        background: getPlanColor(plan.id),
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '0 0 8px 8px',
                        fontSize: 12,
                      }}
                    >
                      {t('pricing.mostPopular', '最受欢迎')}
                    </div>
                  )}

                  <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    {getPlanIcon(plan.id)}
                    <Title heading={4} style={{ marginTop: 16, marginBottom: 8 }}>
                      {plan.displayName}
                    </Title>
                    <div style={{ marginBottom: 8 }}>
                      <Text
                        style={{
                          fontSize: 36,
                          fontWeight: 'bold',
                          color: getPlanColor(plan.id),
                        }}
                      >
                        {formatPrice(plan)}
                      </Text>
                    </div>
                  </div>

                  <Divider style={{ margin: '16px 0' }} />

                  <List
                    size="small"
                    dataSource={plan.features}
                    renderItem={(feature) => (
                      <List.Item style={{ border: 'none', padding: '8px 0' }}>
                        <Space>
                          <IconCheck style={{ color: '#00b42a' }} />
                          <Text>{feature}</Text>
                        </Space>
                      </List.Item>
                    )}
                  />

                  <div style={{ marginTop: 24 }}>
                    {plan.id === 'enterprise' ? (
                      <Button
                        long
                        type="primary"
                        onClick={() => {
                          Modal.info({
                            title: t('pricing.contactSales', '联系销售'),
                            content: (
                              <div>
                                <Paragraph>{t('pricing.contactSalesDesc', '请发送邮件至：')}</Paragraph>
                                <Text copyable>sales@alphaarena.com</Text>
                              </div>
                            ),
                          });
                        }}
                      >
                        {t('pricing.contactSalesBtn', '联系销售')}
                      </Button>
                    ) : (
                      <Button
                        long
                        type={plan.isPopular ? 'primary' : 'outline'}
                        onClick={() => handleSubscribe(plan.id)}
                      >
                        {plan.price === 0 
                          ? t('pricing.getStarted', '开始使用')
                          : t('pricing.subscribe', '立即订阅')}
                      </Button>
                    )}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>

          {/* Feature Comparison Table */}
          <Card style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Title heading={4} style={{ margin: 0 }}>
                {t('comparison.title', '功能对比')}
              </Title>
              <Tooltip content={t('comparison.tooltip', '详细对比各套餐功能差异')}>
                <IconQuestionCircle style={{ color: '#86909c' }} />
              </Tooltip>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <Table
                columns={columns}
                data={featureComparison}
                pagination={false}
                border={{ wrapper: true, cell: true }}
                style={{ minWidth: isMobile ? 500 : 'auto' }}
              />
            </div>
          </Card>

          {/* FAQ Section */}
          <Card>
            <Title heading={4}>{t('faq.title', '常见问题')}</Title>
            <Divider style={{ margin: '16px 0' }} />
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text strong>{t('faq.q1', '如何取消订阅？')}</Text>
                <Paragraph type="secondary" style={{ margin: '8px 0' }}>
                  {t('faq.a1', '您可以随时在"管理订阅"中取消，取消后您仍可使用当前付费期间的功能。')}
                </Paragraph>
              </div>
              <div>
                <Text strong>{t('faq.q2', '支持哪些支付方式？')}</Text>
                <Paragraph type="secondary" style={{ margin: '8px 0' }}>
                  {t('faq.a2', '目前支持支付宝、微信支付和信用卡支付。')}
                </Paragraph>
              </div>
              <div>
                <Text strong>{t('faq.q3', '升级后如何计费？')}</Text>
                <Paragraph type="secondary" style={{ margin: '8px 0' }}>
                  {t('faq.a3', '升级时会按比例计算差价，无需等待当前周期结束。')}
                </Paragraph>
              </div>
              <div>
                <Text strong>{t('faq.q4', '可以退款吗？')}</Text>
                <Paragraph type="secondary" style={{ margin: '8px 0' }}>
                  {t('faq.a4', '订阅后 7 天内可申请全额退款，请联系客服处理。')}
                </Paragraph>
              </div>
            </Space>
          </Card>
        </Spin>
      </div>
    </ErrorBoundary>
  );
};

export default PricingPage;