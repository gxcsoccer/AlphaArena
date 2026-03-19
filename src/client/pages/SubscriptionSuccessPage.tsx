/**
 * SubscriptionSuccessPage
 * Displayed after successful Stripe checkout
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Card,
  Button,
  Space,
  Result,
  Spin,
  Message,
} from '@arco-design/web-react';
import {
  IconCheckCircleFill,
  IconGift,
} from '@arco-design/web-react/icon';

const { Title, Text, Paragraph } = Typography;

const SubscriptionSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);

  const _sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Verify subscription status
    const checkSubscription = async () => {
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('supabase_token');
        if (!token) {
          setLoading(false);
          return;
        }

        const response = await fetch('/api/subscriptions', {
          headers: {
            'Authorization': 'Bearer ' + token,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setSubscription(data.data);
        }
      } catch (error) {
        console.error('Failed to check subscription:', error);
      } finally {
        setLoading(false);
      }
    };

    // Small delay to allow webhook processing
    const timer = setTimeout(checkSubscription, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  const handleViewSubscription = () => {
    navigate('/subscription');
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: 24,
      background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)',
    }}>
      <Card style={{ maxWidth: 500, width: '100%', textAlign: 'center' }}>
        <Spin loading={loading} style={{ display: 'block' }}>
          {!loading && (
            <Result
              status="success"
              icon={<IconCheckCircleFill style={{ color: '#00b42a', fontSize: 64 }} />}
              title={
                <Title heading={3} style={{ marginBottom: 8 }}>
                  订阅成功！
                </Title>
              }
              subTitle={
                <div>
                  <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                    感谢您订阅 AlphaArena！您的订阅已激活。
                  </Paragraph>
                  
                  {subscription && (
                    <Card 
                      style={{ 
                        background: 'var(--color-fill-1)', 
                        marginBottom: 16,
                        textAlign: 'left',
                      }}
                    >
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text type="secondary">当前计划</Text>
                          <Text strong>{subscription.planName}</Text>
                        </div>
                        {subscription.currentPeriodEnd && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text type="secondary">下次续费日期</Text>
                            <Text>{new Date(subscription.currentPeriodEnd).toLocaleDateString('zh-CN')}</Text>
                          </div>
                        )}
                      </Space>
                    </Card>
                  )}

                  <Space size="large" style={{ marginTop: 24 }}>
                    <Button type="primary" onClick={handleGoToDashboard}>
                      开始使用
                    </Button>
                    <Button onClick={handleViewSubscription}>
                      管理订阅
                    </Button>
                  </Space>
                </div>
              }
            />
          )}
        </Spin>
      </Card>
    </div>
  );
};

export default SubscriptionSuccessPage;
