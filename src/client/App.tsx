import React, { Suspense, useState } from 'react';
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
import SettingsPanel from './components/SettingsPanel';
import OfflineIndicator from './components/OfflineIndicator';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SettingsProvider } from './store/settingsStore';
import { ConnectionProvider } from './store/connectionStore';
import { useRealtimeConnection } from './hooks/useRealtimeConnection';
import useErrorReporter from './hooks/useErrorReporter';
import ErrorReporterPanel from './components/ErrorReporterPanel';
import { lazyWithRetry } from './utils/lazyWithRetry';

// Lazy load pages for code splitting with retry logic for chunk loading failures
const HomePage = lazyWithRetry(() => import('./pages/HomePage'));
const DashboardPage = lazyWithRetry(() => import('./pages/DashboardPage'));
const StrategiesPage = lazyWithRetry(() => import('./pages/StrategiesPage'));
const TradesPage = lazyWithRetry(() => import('./pages/TradesPage'));
const HoldingsPage = lazyWithRetry(() => import('./pages/HoldingsPage'));
const LeaderboardPage = lazyWithRetry(() => import('./pages/LeaderboardPage'));

// Loading component for lazy routes
const PageLoader: React.FC = () => (
  <div 
    style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}
    role="status"
    aria-label="页面加载中"
  >
    <Spin size="large" />
  </div>
);

const { Header, Sider, Content } = Layout;

const MenuItem = Menu.Item;

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
    <ErrorBoundary>
      <Layout style={{ minHeight: '100vh' }}>
        {/* Skip to main content link for keyboard users */}
        <a 
          href="#main-content" 
          className="skip-to-content"
          style={{
            position: 'absolute',
            left: '-9999px',
            top: 'auto',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
          }}
          onFocus={(e) => {
            e.target.style.left = '8px';
            e.target.style.top = '8px';
            e.target.style.width = 'auto';
            e.target.style.height = 'auto';
            e.target.style.padding = '8px 16px';
            e.target.style.background = 'var(--color-primary)';
            e.target.style.color = 'white';
            e.target.style.borderRadius = '4px';
            e.target.style.zIndex = '9999';
          }}
          onBlur={(e) => {
            e.target.style.left = '-9999px';
            e.target.style.top = 'auto';
            e.target.style.width = '1px';
            e.target.style.height = '1px';
          }}
        >
          跳转到主内容
        </a>

        {/* Desktop Sider */}
        {!isMobile && (
          <Sider 
            width={200} 
            collapsedWidth={48} 
            collapsible 
            collapsed={collapsed} 
            onCollapse={setCollapsed} 
            theme="dark"
            role="navigation"
            aria-label="主导航菜单"
          >
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
            role="banner"
            aria-label="AlphaArena"
          >
            {!collapsed && 'AlphaArena'}
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            onClickMenuItem={(key) => handleMenuClick({ key })}
            role="menubar"
            aria-label="主导航"
          >
            <MenuItem key="/" icon={<IconHome aria-hidden="true" />} role="menuitem">
              行情
            </MenuItem>
            <MenuItem key="/dashboard" icon={<IconDashboard aria-hidden="true" />} role="menuitem">
              Dashboard
            </MenuItem>
            <MenuItem key="/strategies" icon={<IconApps aria-hidden="true" />} role="menuitem">
              Strategies
            </MenuItem>
            <MenuItem key="/trades" icon={<IconSwap aria-hidden="true" />} role="menuitem">
              Trades
            </MenuItem>
            <MenuItem key="/holdings" icon={<IconSafe aria-hidden="true" />} role="menuitem">
              Holdings
            </MenuItem>
            <MenuItem key="/leaderboard" icon={<IconTrophy aria-hidden="true" />} role="menuitem">
              Leaderboard
            </MenuItem>
          </Menu>
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
          role="banner"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Mobile menu button */}
            {isMobile && (
              <Button
                type="text"
                icon={mobileMenuVisible ? <IconMenuFold /> : <IconMenuUnfold />}
                onClick={toggleMobileMenu}
                style={{ fontSize: 20, padding: 8 }}
                aria-label={mobileMenuVisible ? '关闭导航菜单' : '打开导航菜单'}
                aria-expanded={mobileMenuVisible}
                aria-controls="mobile-menu-drawer"
              />
            )}
            <h1 style={{ margin: 0, lineHeight: '64px', fontSize: isMobile ? 18 : 20 }}>
              AlphaArena
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} role="toolbar" aria-label="工具栏">
            <ThemeToggle compact={isMobile} />
            <SettingsPanel compact={isMobile} />
            <BalanceDisplay compact={isMobile} />
          </div>
        </Header>
        <Content
          id="main-content"
          tabIndex={-1}
          style={{
            margin: isMobile ? 8 : 16,
            padding: isMobile ? 12 : 24,
            background: 'var(--color-bg-2)',
            borderRadius: 4,
            minHeight: 280,
            overflow: 'auto',
          }}
          role="main"
          aria-label="主内容区域"
        >
          {children}
        </Content>
      </Layout>

      {/* Mobile Drawer Menu */}
      <Drawer
        id="mobile-menu-drawer"
        title="导航"
        placement="left"
        visible={mobileMenuVisible}
        onClose={() => setMobileMenuVisible(false)}
        width={280}
        bodyStyle={{ padding: 0 }}
        role="dialog"
        aria-modal="true"
        aria-label="导航菜单"
      >
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[location.pathname]}
          onClickMenuItem={(key) => handleMenuClick({ key })}
          style={{ border: 'none' }}
          role="menu"
          aria-label="移动端导航"
        >
          <MenuItem key="/" icon={<IconHome aria-hidden="true" />} role="menuitem">
            行情
          </MenuItem>
          <MenuItem key="/dashboard" icon={<IconDashboard aria-hidden="true" />} role="menuitem">
            Dashboard
          </MenuItem>
          <MenuItem key="/strategies" icon={<IconApps aria-hidden="true" />} role="menuitem">
            Strategies
          </MenuItem>
          <MenuItem key="/trades" icon={<IconSwap aria-hidden="true" />} role="menuitem">
            Trades
          </MenuItem>
          <MenuItem key="/holdings" icon={<IconSafe aria-hidden="true" />} role="menuitem">
            Holdings
          </MenuItem>
          <MenuItem key="/leaderboard" icon={<IconTrophy aria-hidden="true" />} role="menuitem">
            Leaderboard
          </MenuItem>
        </Menu>
      </Drawer>
    </Layout>
    </ErrorBoundary>
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

// Wrapper component to use the hook inside ConnectionProvider
function RealtimeConnectionSync() {
  useRealtimeConnection();
  return null;
}

function App() {
  // Enable error reporting with localStorage fallback
  const { errors, clearErrors, hasErrors } = useErrorReporter({
    enableLocalStorage: true,
    maxLocalStorageErrors: 50,
    debug: process.env.NODE_ENV === 'development',
  });

  return (
    <SettingsProvider>
      <ConnectionProvider>
        <RealtimeConnectionSync />
        <BrowserRouter>
          <OfflineIndicator />
          <MainLayout>
            <AppRoutes />
          </MainLayout>
          {/* Error reporter panel - shown when errors are captured */}
          {hasErrors && (
            <ErrorReporterPanel
              errors={errors}
              onClear={clearErrors}
              visible={process.env.NODE_ENV === 'development'}
            />
          )}
        </BrowserRouter>
      </ConnectionProvider>
    </SettingsProvider>
  );
}

export default App;
