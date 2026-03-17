import React, { Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
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
  IconDashboard as IconPerformance,
  IconExclamationCircle,
  IconUserAdd,
  IconUser,
  IconHeart,
  IconExperiment,
  IconBook,
  IconList,
} from '@arco-design/web-react/icon';
import BalanceDisplay from './components/BalanceDisplay';
import ThemeToggle from './components/ThemeToggle';
import SettingsPanel from './components/SettingsPanel';
import NotificationCenter from './components/NotificationCenter';
import OfflineIndicator from './components/OfflineIndicator';
import MobileBottomNav from './components/MobileBottomNav';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SettingsProvider } from './store/settingsStore';
import { AuthProvider } from './hooks/useAuth';
import { ConnectionProvider } from './store/connectionStore';
import { useRealtimeConnection } from './hooks/useRealtimeConnection';
import useErrorReporter from './hooks/useErrorReporter';
import ErrorReporterPanel from './components/ErrorReporterPanel';
import { lazyWithRetry, getPendingRoute } from './utils/lazyWithRetry';

// Lazy load pages for code splitting with retry logic for chunk loading failures
const HomePage = lazyWithRetry(() => import('./pages/HomePage'));
const DashboardPage = lazyWithRetry(() => import('./pages/DashboardPage'));
const StrategiesPage = lazyWithRetry(() => import('./pages/StrategiesPage'));
const TradesPage = lazyWithRetry(() => import('./pages/TradesPage'));
const HoldingsPage = lazyWithRetry(() => import('./pages/HoldingsPage'));
const LeaderboardPage = lazyWithRetry(() => import('./pages/EnhancedLeaderboardPage'));
const PerformancePage = lazyWithRetry(() => import('./pages/PerformancePage'));
const RiskPage = lazyWithRetry(() => import('./pages/RiskPage'));
const SentimentPage = lazyWithRetry(() => import('./pages/SentimentPage'));
const CopyTradingPage = lazyWithRetry(() => import('./pages/CopyTradingPage'));
const BacktestVisualizationPage = lazyWithRetry(() => import('./pages/BacktestVisualizationPage'));
const TradingJournalPage = lazyWithRetry(() => import('./pages/TradingJournalPage'));
const StrategyComparisonPage = lazyWithRetry(() => import('./pages/StrategyComparisonPage'));
const AttributionPage = lazyWithRetry(() => import('./pages/AttributionPage'));
const StrategyMarketplacePage = lazyWithRetry(() => import('./pages/StrategyMarketplacePage'));
const AdvancedOrdersPage = lazyWithRetry(() => import('./pages/AdvancedOrdersPage'));
const LoginPage = lazyWithRetry(() => import('./pages/LoginPage'));
const RegisterPage = lazyWithRetry(() => import('./pages/RegisterPage'));
const UserDashboardPage = lazyWithRetry(() => import('./pages/UserDashboardPage'));
const ApiDocsPage = lazyWithRetry(() => import('./pages/ApiDocsPage'));
const UserProfilePage = lazyWithRetry(() => import('./pages/UserProfilePage'));
const RebalancePage = lazyWithRetry(() => import('./pages/RebalancePage'));

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
            <MenuItem key="/user-dashboard" icon={<IconUser aria-hidden="true" />} role="menuitem">
              我的仪表板
            </MenuItem>
            <MenuItem key="/performance" icon={<IconPerformance aria-hidden="true" />} role="menuitem">
              绩效
            </MenuItem>
            <MenuItem key="/attribution" icon={<IconList aria-hidden="true" />} role="menuitem">
              绩效归因
            </MenuItem>
            <MenuItem key="/risk" icon={<IconExclamationCircle aria-hidden="true" />} role="menuitem">
              风险
            </MenuItem>
            <MenuItem key="/sentiment" icon={<IconHeart aria-hidden="true" />} role="menuitem">
              情绪
            </MenuItem>
            <MenuItem key="/strategies" icon={<IconApps aria-hidden="true" />} role="menuitem">
              Strategies
            </MenuItem>
            <MenuItem key="/trades" icon={<IconSwap aria-hidden="true" />} role="menuitem">
              Trades
            </MenuItem>
            <MenuItem key="/rebalance" icon={<IconExperiment aria-hidden="true" />} role="menuitem">
              再平衡
            </MenuItem>
            <MenuItem key="/holdings" icon={<IconSafe aria-hidden="true" />} role="menuitem">
              Holdings
            </MenuItem>
            <MenuItem key="/copy-trading" icon={<IconUserAdd aria-hidden="true" />} role="menuitem">
              Copy Trading
            </MenuItem>
            <MenuItem key="/journal" icon={<IconBook aria-hidden="true" />} role="menuitem">
              交易日志
            </MenuItem>
            <MenuItem key="/backtest" icon={<IconExperiment aria-hidden="true" />} role="menuitem">
              回测
            </MenuItem>
            <MenuItem key="/advanced-orders" icon={<IconExperiment aria-hidden="true" />} role="menuitem">
              高级订单
            </MenuItem>
            <MenuItem key="/strategy-comparison" icon={<IconApps aria-hidden="true" />} role="menuitem">
              策略比较
            </MenuItem>
            <MenuItem key="/api-docs" icon={<IconBook aria-hidden="true" />} role="menuitem">
              API 文档
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
            <NotificationCenter compact={isMobile} />
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
            <MenuItem key="/user-dashboard" icon={<IconUser aria-hidden="true" />} role="menuitem">
              我的仪表板
            </MenuItem>
          <MenuItem key="/performance" icon={<IconPerformance aria-hidden="true" />} role="menuitem">
            绩效
          </MenuItem>
          <MenuItem key="/risk" icon={<IconExclamationCircle aria-hidden="true" />} role="menuitem">
          <MenuItem key="/attribution" icon={<IconList aria-hidden="true" />} role="menuitem">
            绩效归因
          </MenuItem>
            风险
          </MenuItem>
          <MenuItem key="/sentiment" icon={<IconHeart aria-hidden="true" />} role="menuitem">
            情绪
          </MenuItem>
          <MenuItem key="/strategies" icon={<IconApps aria-hidden="true" />} role="menuitem">
            Strategies
          </MenuItem>
          <MenuItem key="/trades" icon={<IconSwap aria-hidden="true" />} role="menuitem">
            Trades
          </MenuItem>
          <MenuItem key="/rebalance" icon={<IconExperiment aria-hidden="true" />} role="menuitem">
              再平衡
            </MenuItem>
            <MenuItem key="/holdings" icon={<IconSafe aria-hidden="true" />} role="menuitem">
            Holdings
          </MenuItem>
          <MenuItem key="/copy-trading" icon={<IconUserAdd aria-hidden="true" />} role="menuitem">
              Copy Trading
            </MenuItem>
            <MenuItem key="/journal" icon={<IconBook aria-hidden="true" />} role="menuitem">
              交易日志
            </MenuItem>
            <MenuItem key="/backtest" icon={<IconExperiment aria-hidden="true" />} role="menuitem">
              回测
            </MenuItem>
            <MenuItem key="/advanced-orders" icon={<IconExperiment aria-hidden="true" />} role="menuitem">
              高级订单
            </MenuItem>
            <MenuItem key="/strategy-comparison" icon={<IconApps aria-hidden="true" />} role="menuitem">
              策略比较
            </MenuItem>
            <MenuItem key="/api-docs" icon={<IconBook aria-hidden="true" />} role="menuitem">
              API 文档
            </MenuItem>
            <MenuItem key="/leaderboard" icon={<IconTrophy aria-hidden="true" />} role="menuitem">
            Leaderboard
          </MenuItem>
        </Menu>
      </Drawer>
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav visible={isMobile && !['/login', '/register'].includes(location.pathname)} />
      {/* Spacer for bottom nav */}
      {isMobile && <div className="mobile-nav-spacer" />}
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
        <Route path="/performance" element={<PerformancePage />} />
        <Route path="/risk" element={<RiskPage />} />
        <Route path="/sentiment" element={<SentimentPage />} />
        <Route path="/strategies" element={<StrategiesPage />} />
        <Route path="/trades" element={<TradesPage />} />
        <Route path="/holdings" element={<HoldingsPage />} />
        <Route path="/copy-trading" element={<CopyTradingPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/backtest" element={<BacktestVisualizationPage />} />
        <Route path="/journal" element={<TradingJournalPage />} />
        <Route path="/attribution" element={<AttributionPage />} />
        <Route path="/strategy-comparison" element={<StrategyComparisonPage />} />
        <Route path="/marketplace" element={<StrategyMarketplacePage />} />
        <Route path="/advanced-orders" element={<AdvancedOrdersPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/user-dashboard" element={<UserDashboardPage />} />
        <Route path="/api-docs" element={<ApiDocsPage />} />
        <Route path="/rebalance" element={<RebalancePage />} />
        <Route path="/user/:username" element={<UserProfilePage />} />
      </Routes>
    </Suspense>
  );
};

// Wrapper component to use the hook inside ConnectionProvider
function RealtimeConnectionSync() {
  useRealtimeConnection();
  return null;
}

// Component to restore pending route after chunk-error reload
function RouteRestorer() {
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    // Check if we need to restore a pending route
    const pendingRoute = getPendingRoute();
    if (pendingRoute) {
      // Remove the cache-busting query parameter if present
      const cleanPath = pendingRoute.split('?__t=')[0].split('&__t=')[0];
      if (cleanPath && cleanPath !== location.pathname + location.search + location.hash) {
        console.log('[RouteRestorer] Restoring pending route:', cleanPath);
        navigate(cleanPath, { replace: true });
      }
    }
  }, [navigate, location]);
  
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
    <AuthProvider>
    <SettingsProvider>
      <ConnectionProvider>
        <RealtimeConnectionSync />
        <BrowserRouter>
          <RouteRestorer />
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
    </AuthProvider>
  );
}

export default App;
