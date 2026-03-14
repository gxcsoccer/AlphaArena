import React, { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Spin, Drawer, Button } from '@arco-design/web-react';
import {
  IconDashboard,
  IconApps,
  IconSwap,
  IconSafe,
  IconTrophy,
  IconHome,
  IconMenuFold,
  IconMenuUnfold,
} from '@arco-design/web-react/icon';
import BalanceDisplay from './components/BalanceDisplay';
import ThemeToggle from './components/ThemeToggle';
import { ThemeProvider } from './hooks/useTheme.tsx';

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
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile on mount and resize
  React.useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileMenuVisible(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
    if (isMobile) {
      setMobileMenuVisible(false);
    }
  };

  const toggleMobileMenu = () => {
    setMobileMenuVisible(!mobileMenuVisible);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Desktop Sider */}
      {!isMobile && (
        <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
          <div
            style={{
              height: 32,
              margin: 16,
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: collapsed ? 0 : 14,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            {!collapsed && 'AlphaArena'}
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={handleMenuClick}
          />
        </Sider>
      )}

      <Layout>
        <Header
          style={{
            padding: '0 16px',
            background: 'var(--color-bg-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Mobile menu button */}
            {isMobile && (
              <Button
                type="text"
                icon={mobileMenuVisible ? <IconMenuFold /> : <IconMenuUnfold />}
                onClick={toggleMobileMenu}
                style={{ fontSize: 20, padding: 8 }}
              />
            )}
            <h2 style={{ margin: 0, lineHeight: '64px', fontSize: isMobile ? 18 : 20 }}>
              AlphaArena
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ThemeToggle compact={isMobile} />
            <BalanceDisplay compact={isMobile} />
          </div>
        </Header>
        <Content
          style={{
            margin: isMobile ? 8 : 16,
            padding: isMobile ? 12 : 24,
            background: 'var(--color-bg-2)',
            borderRadius: 4,
            minHeight: 280,
            overflow: 'auto',
          }}
        >
          {children}
        </Content>
      </Layout>

      {/* Mobile Drawer Menu */}
      <Drawer
        title="导航"
        placement="left"
        visible={mobileMenuVisible}
        onClose={() => setMobileMenuVisible(false)}
        width={280}
        bodyStyle={{ padding: 0 }}
      >
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ border: 'none' }}
        />
      </Drawer>
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
    <ThemeProvider>
      <BrowserRouter>
        <MainLayout>
          <AppRoutes />
        </MainLayout>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
