import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Avatar, Space, Typography, Button, Drawer } from '@arco-design/web-react';
import {
  IconDashboard,
  IconApps,
  IconList,
  IconSettings,
  IconTrophy,
  IconThunderbolt,
  IconUser,
  IconLineHeight,
  IconMenuFold,
  IconMenuUnfold,
} from '@arco-design/web-react/icon';
import DashboardPage from './pages/DashboardPage';
import StrategiesPage from './pages/StrategiesPage';
import TradesPage from './pages/TradesPage';
import HoldingsPage from './pages/HoldingsPage';
import LeaderboardPage from './pages/LeaderboardPage';
import ComparisonPage from './pages/ComparisonPage';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);

  const menuItems = [
    {
      key: '/dashboard',
      icon: <IconDashboard />,
      title: 'Dashboard',
    },
    {
      key: '/strategies',
      icon: <IconApps />,
      title: 'Strategies',
    },
    {
      key: '/trades',
      icon: <IconList />,
      title: 'Trades',
    },
    {
      key: '/holdings',
      icon: <IconSettings />,
      title: 'Holdings',
    },
    {
      key: '/leaderboard',
      icon: <IconTrophy />,
      title: 'Leaderboard',
    },
    {
      key: '/comparison',
      icon: <IconLineHeight />,
      title: 'Comparison',
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
    setMobileMenuVisible(false);
  };

  return (
    <Layout className="app-layout" style={{ minHeight: '100vh' }}>
      {/* Desktop Sider */}
      <Sider 
        theme="light"
        className="app-sider"
        width={220}
        style={{ 
          background: 'var(--bg-white)',
          borderRight: '1px solid var(--border-light)',
          overflow: 'auto'
        }}
      >
        <div className="logo-container">
          <Space>
            <Avatar 
              size={32}
              className="logo-icon"
            >
              <IconThunderbolt style={{ fontSize: 16 }} />
            </Avatar>
            <Text className="logo-text">
              AlphaArena
            </Text>
          </Space>
        </div>
        <Menu
          className="app-menu"
          mode="vertical"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 'none', background: 'transparent' }}
        />
      </Sider>
      
      <Layout style={{ display: 'flex', flexDirection: 'column' }}>
        <Header className="app-header" style={{ 
          padding: '0 24px',
          background: 'var(--bg-white)',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '64px'
        }}>
          <Space>
            {/* Mobile Menu Button */}
            <Button 
              type="text"
              icon={<IconMenuFold />}
              onClick={() => setMobileMenuVisible(true)}
              style={{ display: 'none' }}
              className="mobile-menu-trigger"
            />
            <Text className="welcome-text">
              Welcome back
            </Text>
          </Space>
          
          <Space>
            <Avatar 
              size={32}
              style={{ background: 'var(--primary-color)' }}
            >
              <IconUser />
            </Avatar>
            <Text className="account-text">
              Account
            </Text>
          </Space>
        </Header>
        <Content
          className="app-content"
          style={{ 
            margin: '16px',
            padding: '24px',
            background: 'var(--bg-white)',
            borderRadius: '12px',
            minHeight: 'calc(100vh - 96px)',
            border: '1px solid var(--border-light)',
            overflow: 'auto'
          }}
        >
          {children}
        </Content>
      </Layout>
      
      {/* Mobile Drawer Menu */}
      <Drawer
        title="Menu"
        placement="left"
        visible={mobileMenuVisible}
        onCancel={() => setMobileMenuVisible(false)}
        width={280}
      >
        <Menu
          mode="vertical"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 'none' }}
        />
      </Drawer>
    </Layout>
  );
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard"
        element={
          <MainLayout>
            <DashboardPage />
          </MainLayout>
        }
      />
      <Route
        path="/strategies"
        element={
          <MainLayout>
            <StrategiesPage />
          </MainLayout>
        }
      />
      <Route
        path="/trades"
        element={
          <MainLayout>
            <TradesPage />
          </MainLayout>
        }
      />
      <Route
        path="/holdings"
        element={
          <MainLayout>
            <HoldingsPage />
          </MainLayout>
        }
      />
      <Route
        path="/leaderboard"
        element={
          <MainLayout>
            <LeaderboardPage />
          </MainLayout>
        }
      />
      <Route
        path="/comparison"
        element={
          <MainLayout>
            <ComparisonPage />
          </MainLayout>
        }
      />
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
