/**
 * BillingPage - User billing and subscription management
 * Settings page for subscription and payment management
 * Issue #638: VIP 订阅管理 UI
 */

import React from 'react';
import { Typography, Grid, Space, Button } from '@arco-design/web-react';
import { IconLeft } from '@arco-design/web-react/icon';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary';
import SubscriptionStatus from '../components/SubscriptionStatus';
import BillingHistory from '../components/BillingHistory';
import { useSEO } from '../hooks/useSEO';

const { Title, Text } = Typography;
const { Row, Col } = Grid;

const BillingPage: React.FC = () => {
  const navigate = useNavigate();

  // SEO
  useSEO({
    title: '账单管理 - AlphaArena',
    description: '管理您的订阅和支付方式',
  });

  return (
    <ErrorBoundary>
      <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <Button
            type="text"
            icon={<IconLeft />}
            onClick={() => navigate('/settings')}
            style={{ marginBottom: 8 }}
          >
            返回设置
          </Button>
          <Title heading={4} style={{ margin: 0 }}>
            账单与订阅
          </Title>
          <Text type="secondary">管理您的订阅计划和支付方式</Text>
        </div>

        {/* Content */}
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={12}>
            <SubscriptionStatus />
          </Col>
          <Col xs={24} lg={12}>
            <BillingHistory />
          </Col>
        </Row>

        {/* Quick Links */}
        <div style={{ marginTop: 24 }}>
          <Space>
            <Button type="text" onClick={() => navigate('/pricing')}>
              查看所有计划
            </Button>
            <Button type="text" onClick={() => navigate('/subscription')}>
              更改计划
            </Button>
          </Space>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default BillingPage;