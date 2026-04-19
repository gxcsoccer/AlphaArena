/**
 * Settings Page - User settings hub
 * Central page for all user settings and preferences
 * Issue #732: Create settings page to replace missing route
 */

import React from 'react';
import {
  Typography,
  Card,
  List,
  Button,
  Space,
  Grid,
} from '@arco-design/web-react';
import {
  IconGift,
  IconNotification,
  IconLock,
  IconStorage,
  IconUser,
  IconLeft,
  IconSettings,
} from '@arco-design/web-react/icon';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useSEO } from '../hooks/useSEO';

const { Title, Text } = Typography;
const { Row, Col } = Grid;

interface SettingsItem {
  key: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  route: string;
  requiresAuth?: boolean;
}

const settingsItems: SettingsItem[] = [
  {
    key: 'billing',
    title: '账单与订阅',
    description: '管理您的订阅计划和支付方式',
    icon: <IconGift style={{ fontSize: 24 }} />,
    route: '/settings/billing',
    requiresAuth: true,
  },
  {
    key: 'privacy',
    title: '隐私设置',
    description: '数据导出、删除等 GDPR 相关设置',
    icon: <IconLock style={{ fontSize: 24 }} />,
    route: '/privacy',
    requiresAuth: true,
  },
  {
    key: 'notifications',
    title: '通知偏好',
    description: '配置推送、邮件等通知方式',
    icon: <IconNotification style={{ fontSize: 24 }} />,
    route: '/notification-preferences',
    requiresAuth: true,
  },
  {
    key: 'data-source',
    title: '数据源设置',
    description: '配置交易所 API 连接和数据源',
    icon: <IconStorage style={{ fontSize: 24 }} />,
    route: '/data-source',
    requiresAuth: true,
  },
  {
    key: 'profile',
    title: '个人资料',
    description: '查看和编辑您的个人资料',
    icon: <IconUser style={{ fontSize: 24 }} />,
    route: '/user-dashboard',
    requiresAuth: true,
  },
];

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // SEO
  useSEO({
    title: '设置 - AlphaArena',
    description: '管理您的账户设置、订阅和偏好',
  });

  const handleItemClick = (item: SettingsItem) => {
    if (item.requiresAuth && !isAuthenticated) {
      navigate(`/login?redirect=${item.route}`);
    } else {
      navigate(item.route);
    }
  };

  return (
    <ErrorBoundary>
      <div style={{ 
        padding: '24px', 
        maxWidth: 800, 
        margin: '0 auto',
        minHeight: '100vh',
        background: 'var(--color-bg-1)',
      }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <Button
            type="text"
            icon={<IconLeft />}
            onClick={() => navigate('/')}
            style={{ marginBottom: 8 }}
          >
            返回首页
          </Button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconSettings style={{ fontSize: 28 }} />
            <Title heading={4} style={{ margin: 0 }}>
              设置
            </Title>
          </div>
          <Text type="secondary">管理您的账户和应用偏好</Text>
        </div>

        {/* Settings List */}
        <Card>
          <List
            dataSource={settingsItems}
            render={(item: SettingsItem) => (
              <List.Item
                style={{ 
                  cursor: 'pointer',
                  padding: '16px 20px',
                }}
                onClick={() => handleItemClick(item)}
                actions={[
                  <Button type="text" icon={<IconLeft style={{ transform: 'rotate(180deg)' }} />}>
                    进入
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <div style={{ 
                      width: 48, 
                      height: 48, 
                      borderRadius: 8,
                      background: 'var(--color-fill-1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {item.icon}
                    </div>
                  }
                  title={<Text strong>{item.title}</Text>}
                  description={
                    <Space direction="vertical" size="small">
                      <Text type="secondary">{item.description}</Text>
                      {item.requiresAuth && !isAuthenticated && (
                        <Text type="warning" style={{ fontSize: 12 }}>
                          需要登录
                        </Text>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>

        {/* Help Section */}
        <Card style={{ marginTop: 24 }}>
          <Title heading={5}>需要帮助?</Title>
          <Text type="secondary">
            如有任何问题，请联系客服：{' '}
            <Text copyable>support@alphaarena.com</Text>
          </Text>
        </Card>
      </div>
    </ErrorBoundary>
  );
};

export default SettingsPage;