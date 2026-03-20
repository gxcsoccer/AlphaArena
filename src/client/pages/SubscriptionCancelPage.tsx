/**
 * SubscriptionCancelPage
 * Displayed when user cancels during Stripe checkout
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Card,
  Button,
  Space,
  Result,
} from '@arco-design/web-react';
import {
  IconCloseCircleFill,
} from '@arco-design/web-react/icon';

const { Title, Paragraph } = Typography;

const SubscriptionCancelPage: React.FC = () => {
  const navigate = useNavigate();

  const handleRetry = () => {
    navigate('/subscription');
  };

  const handleContact = () => {
    window.location.href = 'mailto:support@alphaarena.com';
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
        <Result
          status="warning"
          icon={<IconCloseCircleFill style={{ color: '#ff7d00', fontSize: 64 }} />}
          title={
            <Title heading={3} style={{ marginBottom: 8 }}>
              支付已取消
            </Title>
          }
          subTitle={
            <div>
              <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                您的支付已取消，订阅未被激活。如果您遇到任何问题，请随时联系我们。
              </Paragraph>

              <Space size="large" style={{ marginTop: 24 }}>
                <Button type="primary" onClick={handleRetry}>
                  重试支付
                </Button>
                <Button onClick={handleContact}>
                  联系支持
                </Button>
              </Space>
            </div>
          }
        />
      </Card>
    </div>
  );
};

export default SubscriptionCancelPage;
