import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Spin } from '@arco-design/web-react';
import {
  IconDashboard,
  IconApps,
  IconSwap,
  IconSafe,
  IconTrophy,
  IconHome,
} from '@arco-design/web-react/icon';

// Alias the icons for menu items
const DashboardOutlined = IconDashboard;
const AppstoreOutlined = IconApps;
const TransactionOutlined = IconSwap;
const WalletOutlined = IconSafe;
const TrophyOutlined = IconTrophy;
const HomeOutlined = IconHome;

// Lazy load pages for code splitting
const HomePage = lazy(() => import('./pages/HomePage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const StrategiesPage = lazy(() => import('./pages/StrategiesPage'));
const TradesPage = lazy(() => import('./pages/TradesPage'));
const HoldingsPage = lazy(() => import('./pages/HoldingsPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));

// Loading component for lazy routes
const PageLoader: React.FC = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
    <Spin size="large" />
  </div>
);

const { Header, Sider, Content } = Layout;

const menuItems = [
  {
    key: '/',
    icon: <HomeOutlined />,
    label: '行情',
  },
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

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

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
        <Header style={{ padding: '0 16px', background: 'var(--color-bg-2)' }}>
          <h2 style={{ margin: 0, lineHeight: '64px' }}>AlphaArena</h2>
        </Header>
        <Content
          style={{
            margin: 16,
            padding: 24,
            background: 'var(--color-bg-2)',
            borderRadius: 4,
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
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/strategies" element={<StrategiesPage />} />
        <Route path="/trades" element={<TradesPage />} />
        <Route path="/holdings" element={<HoldingsPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <AppRoutes />
      </MainLayout>
    </BrowserRouter>
  );
}

export default App;
