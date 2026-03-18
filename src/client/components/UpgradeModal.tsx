/**
 * UpgradeModal Component
 * Modal that prompts users to upgrade their subscription
 */

import React from 'react';
import {
  Modal,
  Typography,
  Space,
  Button,
  List,
  Divider,
  Tag,
  Grid,
  Card,
} from '@arco-design/web-react';
import {
  IconCheck,
  IconStar,
  IconThunderbolt,
  IconTrophy,
  IconClose,
} from '@arco-design/web-react/icon';

const { Title, Text, Paragraph } = Typography;
const { Row, Col } = Grid;

interface PlanFeature {
  icon?: React.ReactNode;
  text: string;
  included: boolean;
}

interface Plan {
  id: string;
  name: string;
  displayName: string;
  price: number;
  period: string;
  features: PlanFeature[];
  isPopular?: boolean;
  buttonText: string;
}

interface UpgradeModalProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade: (planId: string) => void;
  currentPlan?: string;
  featureName?: string;
  loading?: boolean;
}

const proFeatures: PlanFeature[] = [
  { text: '无限策略运行', included: true },
  { text: '无限回测', included: true },
  { text: 'Level 2 市场数据', included: true },
  { text: 'AI 策略助手', included: true },
  { text: '风险预警通知', included: true },
  { text: '数据导出', included: true },
  { text: '优先技术支持', included: true },
  { text: 'API 访问', included: true },
];

const UpgradeModal: React.FC<UpgradeModalProps> = ({
  visible,
  onClose,
  onUpgrade,
  currentPlan = 'free',
  featureName,
  loading = false,
}) => {
  const plans: Plan[] = [
    {
      id: 'pro',
      name: 'pro',
      displayName: '专业版',
      price: 99,
      period: '月',
      features: proFeatures,
      isPopular: true,
      buttonText: '立即升级',
    },
  ];

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case 'pro':
        return <IconThunderbolt style={{ fontSize: 24, color: '#165dff' }} />;
      default:
        return <IconStar style={{ fontSize: 24, color: '#86909c' }} />;
    }
  };

  return (
    <Modal
      visible={visible}
      onCancel={onClose}
      footer={null}
      style={{ width: 600, maxWidth: '90vw' }}
      unmountOnExit
    >
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <IconTrophy style={{ fontSize: 48, color: '#f7ba1e' }} />
        <Title heading={4} style={{ marginTop: 16 }}>
          {featureName ? `解锁「${featureName}」功能` : '升级到专业版'}
        </Title>
        <Text type="secondary">
          {featureName 
            ? '升级以解锁此功能，享受更多专业特性'
            : '解锁所有专业功能，提升交易效率'}
        </Text>
      </div>

      <Divider style={{ margin: '16px 0' }} />

      {plans.map((plan) => (
        <Card
          key={plan.id}
          style={{
            borderColor: plan.isPopular ? '#165dff' : undefined,
            borderWidth: plan.isPopular ? 2 : 1,
            marginBottom: 16,
          }}
        >
          {plan.isPopular && (
            <div
              style={{
                position: 'absolute',
                top: -1,
                right: 16,
                background: '#165dff',
                color: 'white',
                padding: '4px 12px',
                borderRadius: '0 0 8px 8px',
                fontSize: 12,
              }}
            >
              最受欢迎
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ textAlign: 'center', minWidth: 80 }}>
              {getPlanIcon(plan.id)}
              <div style={{ marginTop: 8 }}>
                <Text strong>{plan.displayName}</Text>
              </div>
              <div style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#165dff' }}>
                  ¥{plan.price}
                </Text>
                <Text type="secondary">/{plan.period}</Text>
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <List
                size="small"
                dataSource={plan.features}
                renderItem={(feature) => (
                  <List.Item style={{ border: 'none', padding: '6px 0' }}>
                    <Space size={8}>
                      {feature.included ? (
                        <IconCheck style={{ color: '#00b42a' }} />
                      ) : (
                        <IconClose style={{ color: '#c9cdd4' }} />
                      )}
                      <Text>{feature.text}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
            <Button
              type="primary"
              long
              size="large"
              loading={loading}
              onClick={() => onUpgrade(plan.id)}
            >
              {plan.buttonText}
            </Button>
          </div>
        </Card>
      ))}

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          支持支付宝、微信支付 · 随时可取消 · 7天无理由退款
        </Text>
      </div>
    </Modal>
  );
};

export default UpgradeModal;
