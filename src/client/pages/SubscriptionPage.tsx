/**
 * SubscriptionPage - Subscription Plans and Pricing
 * Displays available subscription plans and allows users to subscribe or upgrade
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
} from '@arco-design/web-react';
import {
  IconCheck,
  IconStar,
  IconTrophy,
  IconThunderbolt,
} from '@arco-design/web-react/icon';
import { ErrorBoundary } from '../components/ErrorBoundary';
import HelpButton, { HelpButtons } from '../components/HelpButton';

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

interface UserSubscription {
  planId: string;
  planName: string;
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

const SubscriptionPage: React.FC = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
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
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch plans
      const plansRes = await fetch('/api/subscriptions/plans');
      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setPlans(plansData.data || []);
      }

      // Fetch current subscription
      const token = localStorage.getItem('token') || localStorage.getItem('supabase_token');
      if (token) {
        const subRes = await fetch('/api/subscriptions', {
          headers: {
            'Authorization': 'Bearer ' + token,
          },
        });
        if (subRes.ok) {
          const subData = await subRes.json();
          setCurrentSubscription(subData.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch subscription data:', error);
      Message.error('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    const token = localStorage.getItem('token') || localStorage.getItem('supabase_token');
    if (!token) {
      Modal.warning({
        title: 'Login Required',
        content: 'Please log in to subscribe to a plan.',
      });
      return;
    }

    setCheckoutLoading(planId);
    try {
      const response = await fetch('/api/subscriptions/checkout', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          billingPeriod,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Checkout failed');
      }

      const data = await response.json();
      
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        // Free plan - no redirect needed
        Message.success('Successfully subscribed!');
        fetchData();
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      Message.error(error.message || 'Failed to start checkout');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    const token = localStorage.getItem('token') || localStorage.getItem('supabase_token');
    if (!token) return;

    try {
      const response = await fetch('/api/subscriptions/portal', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to open billing portal');
      }

      const data = await response.json();
      if (data.portalUrl) {
        window.location.href = data.portalUrl;
      }
    } catch (error) {
      console.error('Portal error:', error);
      Message.error('Failed to open billing portal');
    }
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
    if (plan.price === 0) return '免费';
    const price = billingPeriod === 'yearly' ? plan.price * 10 : plan.price; // 2 months free for yearly
    const period = billingPeriod === 'yearly' ? '/年' : '/月';
    return '¥' + price + period;
  };

  const defaultPlans: SubscriptionPlan[] = [
    {
      id: 'free',
      name: 'free',
      displayName: '免费版',
      price: 0,
      currency: 'CNY',
      billingPeriod: 'monthly',
      features: [
        '最多 3 个并发策略',
        '每日 10 次回测',
        '基础市场数据',
        '社区支持',
      ],
      limits: { maxStrategies: 3, dailyBacktests: 10 },
    },
    {
      id: 'pro',
      name: 'pro',
      displayName: '专业版',
      price: 99,
      currency: 'CNY',
      billingPeriod: 'monthly',
      features: [
        '无限策略运行',
        '无限回测',
        '高级市场数据 (Level 2)',
        'AI 策略助手',
        '风险预警通知',
        '数据导出',
        '优先支持',
      ],
      limits: { maxStrategies: -1, dailyBacktests: -1 },
      isPopular: true,
    },
    {
      id: 'enterprise',
      name: 'enterprise',
      displayName: '企业版',
      price: 0,
      currency: 'CNY',
      billingPeriod: 'monthly',
      features: [
        '所有 Pro 功能',
        '多用户团队管理',
        'API 访问（高配额）',
        '专属客户经理',
        '私有部署支持',
        'SLA 保障',
      ],
      limits: { maxStrategies: -1, dailyBacktests: -1 },
    },
  ];

  const displayPlans = plans.length > 0 ? plans : defaultPlans;

  return (
    <ErrorBoundary>
      <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Title heading={2} style={{ margin: 0 }}>选择适合您的计划</Title>
            <HelpButton
              compact
              {...HelpButtons.subscription}
            />
          </div>
          <Text type="secondary">
            升级解锁更多功能，提升交易效率
          </Text>

          {/* Billing Period Toggle */}
          <div style={{ marginTop: 24 }}>
            <Radio.Group
              value={billingPeriod}
              onChange={(value) => setBillingPeriod(value)}
              type="button"
            >
              <Radio value="monthly">按月付费</Radio>
              <Radio value="yearly">
                按年付费
                <Tag color="green" style={{ marginLeft: 8 }}>省 2 个月</Tag>
              </Radio>
            </Radio.Group>
          </div>
        </div>

        <Spin loading={loading} style={{ display: 'block' }}>
          <Row gutter={[16, 16]}>
            {displayPlans.map((plan) => (
              <Col key={plan.id} xs={24} sm={8}>
                <Card
                  style={{
                    height: '100%',
                    borderColor: plan.isPopular ? getPlanColor(plan.id) : undefined,
                    borderWidth: plan.isPopular ? 2 : 1,
                  }}
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
                      最受欢迎
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
                          fontSize: 32,
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
                    {currentSubscription && currentSubscription.planId === plan.id ? (
                      <Button
                        long
                        type="outline"
                        disabled
                      >
                        当前计划
                      </Button>
                    ) : plan.id === 'enterprise' ? (
                      <Button
                        long
                        type="primary"
                        onClick={() => {
                          Modal.info({
                            title: '联系销售',
                            content: (
                              <div>
                                <Paragraph>请发送邮件至：</Paragraph>
                                <Text copyable>sales@alphaarena.com</Text>
                              </div>
                            ),
                          });
                        }}
                      >
                        联系销售
                      </Button>
                    ) : (
                      <Button
                        long
                        type={plan.isPopular ? 'primary' : 'outline'}
                        loading={checkoutLoading === plan.id}
                        onClick={() => handleSubscribe(plan.id)}
                      >
                        {currentSubscription ? '升级' : '立即订阅'}
                      </Button>
                    )}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>

          {/* Current Subscription Info */}
          {currentSubscription && (
            <Card style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text type="secondary">当前计划：</Text>
                  <Text strong style={{ marginLeft: 8 }}>
                    {currentSubscription.planName}
                  </Text>
                  {currentSubscription.status === 'active' && (
                    <Tag color="green" style={{ marginLeft: 8 }}>活跃</Tag>
                  )}
                  {currentSubscription.cancelAtPeriodEnd && (
                    <Tag color="orange" style={{ marginLeft: 8 }}>已取消</Tag>
                  )}
                </div>
                <Space>
                  {currentSubscription.planId !== 'free' && (
                    <Button onClick={handleManageSubscription}>
                      管理订阅
                    </Button>
                  )}
                </Space>
              </div>
            </Card>
          )}

          {/* FAQ Section */}
          <Card style={{ marginTop: 24 }}>
            <Title heading={5}>常见问题</Title>
            <Divider style={{ margin: '16px 0' }} />
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>如何取消订阅？</Text>
                <Paragraph type="secondary" style={{ margin: '8px 0' }}>
                  您可以随时在"管理订阅"中取消，取消后您仍可使用当前付费期间的功能。
                </Paragraph>
              </div>
              <div>
                <Text strong>支持哪些支付方式？</Text>
                <Paragraph type="secondary" style={{ margin: '8px 0' }}>
                  目前支持支付宝、微信支付和信用卡支付。
                </Paragraph>
              </div>
              <div>
                <Text strong>升级后如何计费？</Text>
                <Paragraph type="secondary" style={{ margin: '8px 0' }}>
                  升级时会按比例计算差价，无需等待当前周期结束。
                </Paragraph>
              </div>
            </Space>
          </Card>
        </Spin>
      </div>
    </ErrorBoundary>
  );
};

export default SubscriptionPage;
