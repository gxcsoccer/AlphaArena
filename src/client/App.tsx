import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, theme } from 'antd';
import {
  DashboardOutlined,
  AppstoreOutlined,
  TransactionOutlined,
  WalletOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import DashboardPage from './pages/DashboardPage';
import StrategiesPage from './pages/StrategiesPage';
import TradesPage from './pages/TradesPage';
import HoldingsPage from './pages/HoldingsPage';
import LeaderboardPage from './pages/LeaderboardPage';

const { Header, Sider, Content } = Layout;

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/strategies',
      icon: <AppstoreOutlined />,
      label: 'Strategies',
    },
    {
      key: '/trades',
      icon: <TransactionOutlined />,
      label: 'Trades',
    },
    {
      key: '/holdings',
      icon: <WalletOutlined />,
      label: 'Holdings',
    },
    {
      key: '/leaderboard',
      icon: <TrophyOutlined />,
      label: 'Leaderboard',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible>
        <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)', borderRadius: 4 }} />
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 16px', background: colorBgContainer }}>
          <h2 style={{ margin: 0, lineHeight: '64px' }}>AlphaArena</h2>
        </Header>
        <Content
          style={{
            margin: 16,
            padding: 24,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            minHeight: 280,
            overflow: 'auto',
          }}
        >
          {children}
        </Content>
      </Layout>
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
