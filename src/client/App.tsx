import React, { Suspense, useState, useEffect, lazy } from 'react';
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
  IconClockCircle,
  IconUser,
  IconHeart,
  IconExperiment,
  IconBook,
  IconList,
  IconGift,
  IconStorage,
  IconCompass,
  IconNotification,
  IconUserGroup,
  IconArrowRise as IconTrendingUp,
} from '@arco-design/web-react/icon';
import BalanceDisplay from './components/BalanceDisplay';
import ThemeToggle from './components/ThemeToggle';
import SettingsPanel from './components/SettingsPanel';
import NotificationCenter from './components/NotificationCenter';
import { LanguageSwitcher } from './components/LanguageSwitcher'; // Issue #586
import { LocaleProvider } from './i18n/LocaleProvider'; // Issue #768: P0 fix - wrap app with LocaleProvider
import OfflineIndicator from './components/OfflineIndicator';
import InstallPrompt from './components/InstallPrompt'; // Issue #628: PWA 安装提示
import MobileBottomNav from './components/MobileBottomNav';
import SwipeNavigator from './components/SwipeNavigator';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HeaderLogo } from './components/brand/Logo';
import { NotFoundPage } from './components/brand/ErrorPages';
import { SettingsProvider } from './store/settingsStore';
import { AuthProvider, useAuth, ProtectedRoute } from './hooks/useAuth';
import { SubscriptionProvider } from './hooks/useSubscription';
import { ConnectionProvider } from './store/connectionStore';
import { useRealtimeConnection } from './hooks/useRealtimeConnection';
import useErrorReporter from './hooks/useErrorReporter';
import { lazyWithRetry, getPendingRoute } from './utils/lazyWithRetry';
import { usePerformanceMonitoring } from './hooks/usePerformanceMonitoring';

// Lazy load non-critical UI components for better initial load time
const AIAssistantButton = lazy(() => import('./components/AIAssistantButton'));
const FeedbackButton = lazy(() => import('./components/FeedbackButton'));
const SmartOnboarding = lazy(() => import('./components/SmartOnboarding'));
const ErrorReporterPanel = lazy(() => import('./components/ErrorReporterPanel'));

// Lazy load pages for code splitting with retry logic for chunk loading failures
const IndexPage = lazyWithRetry(() => import('./pages/IndexPage'));
const LandingPage = lazyWithRetry(() => import('./pages/LandingPage'));
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
const SchedulerPage = lazyWithRetry(() => import('./pages/SchedulerPage'));
const UserProfilePage = lazyWithRetry(() => import('./pages/UserProfilePage'));
const RebalancePage = lazyWithRetry(() => import('./pages/RebalancePage'));
const SubscriptionPage = lazyWithRetry(() => import('./pages/SubscriptionPage'));
const SubscriptionSuccessPage = lazyWithRetry(() => import('./pages/SubscriptionSuccessPage'));
const SubscriptionCancelPage = lazyWithRetry(() => import('./pages/SubscriptionCancelPage'));
const PricingPage = lazyWithRetry(() => import('./pages/PricingPage'));
const SettingsPage = lazyWithRetry(() => import('./pages/SettingsPage')); // Issue #732: Settings page
const BillingPage = lazyWithRetry(() => import('./pages/BillingPage'));
const AdminDashboardPage = lazyWithRetry(() => import('./pages/AdminDashboardPage'));
const FeedbackManagementPage = lazyWithRetry(() => import('./pages/FeedbackManagementPage'));
const DataSourceSettingsPage = lazyWithRetry(() => import('./pages/DataSourceSettingsPage'));
const VirtualAccountPage = lazyWithRetry(() => import('./pages/VirtualAccountPage'));
const StrategyPortfolioPage = lazyWithRetry(() => import('./pages/StrategyPortfolioPage'));
const PortfolioDetailPage = lazyWithRetry(() => import('./pages/PortfolioDetailPage'));
const UserBehaviorAnalyticsPage = lazyWithRetry(() => import('./pages/UserBehaviorAnalyticsPage'));
const ExchangeAccountsPage = lazyWithRetry(() => import('./pages/ExchangeAccountsPage'));
const PerformanceMonitoringPage = lazyWithRetry(() => import('./pages/PerformanceMonitoringPage'));
const APMDashboardPage = lazyWithRetry(() => import('./pages/APMDashboardPage')); // Issue #651: APM
const PaymentMonitoringPage = lazyWithRetry(() => import('./pages/PaymentMonitoringPage'));
const NotificationPreferencesPage = lazyWithRetry(() => import('./pages/NotificationPreferencesPage'));
const NotificationHistoryPage = lazyWithRetry(() => import('./pages/NotificationHistoryPage'));
const PrivacySettingsPage = lazyWithRetry(() => import('./pages/PrivacySettingsPage')); // Issue #642: GDPR
const BusinessMetricsPage = lazyWithRetry(() => import('./pages/BusinessMetricsPage')); // Issue #652: Business Metrics
const ReferralPage = lazyWithRetry(() => import('./pages/ReferralPage')); // Issue #653: 邀请系统
const UnifiedAdminMonitoringPage = lazyWithRetry(() => import('./pages/UnifiedAdminMonitoringPage')); // Issue #660: Admin 后台集成
const LiveBacktestComparisonPage = lazyWithRetry(() => import('./pages/LiveBacktestComparisonPage')); // Issue #669: 实盘与回测对比分析

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
  
  // Debug: Log route changes
  useEffect(() => {
    console.log('[Route] Location changed:', {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
    });
  }, [location]);
  
  // Initialize performance monitoring for all pages
  usePerformanceMonitoring({
    autoReport: true,
    reportInterval: 30000, // 30 seconds
    batchEnabled: true,
    maxBatchSize: 10,
    debug: process.env.NODE_ENV === 'development',
  });

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
    console.log('[Navigation] Menu clicked:', key);
    console.log('[Navigation] Current location:', location.pathname);
    console.log('[Navigation] Navigating to:', key);
    navigate(key);
    console.log('[Navigation] Navigate called');
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
              height: 40,
              margin: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              paddingLeft: collapsed ? 0 : 8,
            }}
            role="banner"
            aria-label="AlphaArena"
          >
            <HeaderLogo 
              collapsed={collapsed} 
              onClick={() => navigate('/')}
            />
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
            <MenuItem key="/strategies" icon={<IconApps aria-hidden="true" />} role="menuitem" data-onboarding="strategies-nav">
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
            <MenuItem key="/virtual-account" icon={<IconSafe aria-hidden="true" />} role="menuitem">
              Virtual Account
            </MenuItem>
            <MenuItem key="/exchange-accounts" icon={<IconStorage aria-hidden="true" />} role="menuitem">
              Exchange Accounts
            </MenuItem>
            <MenuItem key="/copy-trading" icon={<IconUserAdd aria-hidden="true" />} role="menuitem">
              Copy Trading
            </MenuItem>
            <MenuItem key="/scheduler" icon={<IconClockCircle aria-hidden="true" />} role="menuitem">
              Scheduler
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
            <MenuItem key="/comparison/live-backtest" icon={<IconTrendingUp aria-hidden="true" />} role="menuitem">
              实盘回测对比
            </MenuItem>
            <MenuItem key="/strategy-portfolio" icon={<IconApps aria-hidden="true" />} role="menuitem">
              策略组合
            </MenuItem>
            <MenuItem key="/docs/api" icon={<IconBook aria-hidden="true" />} role="menuitem">
              API 文档
            </MenuItem>
            <MenuItem key="/leaderboard" icon={<IconTrophy aria-hidden="true" />} role="menuitem">
              Leaderboard
            </MenuItem>
            <MenuItem key="/subscription" icon={<IconGift aria-hidden="true" />} role="menuitem">
              订阅
            </MenuItem>
            <MenuItem key="/referral" icon={<IconUserAdd aria-hidden="true" />} role="menuitem">
              邀请好友
            </MenuItem>
            <MenuItem key="/notification-preferences" icon={<IconNotification aria-hidden="true" />} role="menuitem">
              通知设置
            </MenuItem>
            <MenuItem key="/data-source" icon={<IconStorage aria-hidden="true" />} role="menuitem">
              数据源
            </MenuItem>
            <MenuItem key="/marketplace" icon={<IconCompass aria-hidden="true" />} role="menuitem">
              策略市场
            </MenuItem>
            <MenuItem key="/user-analytics" icon={<IconUserGroup aria-hidden="true" />} role="menuitem">
              用户分析
            </MenuItem>
            <MenuItem key="/admin/monitoring" icon={<IconDashboard aria-hidden="true" />} role="menuitem">
              监控中心
            </MenuItem>
          </Menu>
        </Sider>
      )}

      <Layout>
        {/* Offline indicator - only shown for authenticated users */}
        <OfflineIndicator />
        {/* PWA Install prompt - Issue #628 */}
        <InstallPrompt autoShowDelay={10000} />
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
              <HeaderLogo size="sm" onClick={() => navigate('/')} />
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} role="toolbar" aria-label="工具栏">
            <LanguageSwitcher compact={isMobile} />
            <ThemeToggle compact={isMobile} />
            <span data-onboarding="notification-bell"><NotificationCenter compact={isMobile} /></span>
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
          <SwipeNavigator enabled={isMobile}>
            {children}
          </SwipeNavigator>
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
          <MenuItem key="/attribution" icon={<IconList aria-hidden="true" />} role="menuitem">
            绩效归因
          </MenuItem>
          <MenuItem key="/risk" icon={<IconExclamationCircle aria-hidden="true" />} role="menuitem">
            风险
          </MenuItem>
          <MenuItem key="/sentiment" icon={<IconHeart aria-hidden="true" />} role="menuitem">
            情绪
          </MenuItem>
          <MenuItem key="/strategies" icon={<IconApps aria-hidden="true" />} role="menuitem" data-onboarding="strategies-nav">
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
          <MenuItem key="/virtual-account" icon={<IconSafe aria-hidden="true" />} role="menuitem">
            Virtual Account
          </MenuItem>
          <MenuItem key="/exchange-accounts" icon={<IconStorage aria-hidden="true" />} role="menuitem">
            Exchange Accounts
          </MenuItem>
          <MenuItem key="/copy-trading" icon={<IconUserAdd aria-hidden="true" />} role="menuitem">
            Copy Trading
          </MenuItem>
          <MenuItem key="/scheduler" icon={<IconClockCircle aria-hidden="true" />} role="menuitem">
            Scheduler
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
          <MenuItem key="/strategy-portfolio" icon={<IconApps aria-hidden="true" />} role="menuitem">
            策略组合
          </MenuItem>
          <MenuItem key="/docs/api" icon={<IconBook aria-hidden="true" />} role="menuitem">
            API 文档
          </MenuItem>
          <MenuItem key="/leaderboard" icon={<IconTrophy aria-hidden="true" />} role="menuitem">
            Leaderboard
          </MenuItem>
          <MenuItem key="/subscription" icon={<IconGift aria-hidden="true" />} role="menuitem">
            订阅
          </MenuItem>
          <MenuItem key="/referral" icon={<IconUserAdd aria-hidden="true" />} role="menuitem">
            邀请好友
          </MenuItem>
          <MenuItem key="/notification-preferences" icon={<IconNotification aria-hidden="true" />} role="menuitem">
            通知设置
          </MenuItem>
          <MenuItem key="/notifications" icon={<IconList aria-hidden="true" />} role="menuitem">
            通知历史
          </MenuItem>
          <MenuItem key="/data-source" icon={<IconStorage aria-hidden="true" />} role="menuitem">
            数据源
          </MenuItem>
          <MenuItem key="/marketplace" icon={<IconCompass aria-hidden="true" />} role="menuitem">
            策略市场
          </MenuItem>
          <MenuItem key="/user-analytics" icon={<IconUserGroup aria-hidden="true" />} role="menuitem">
            用户分析
          </MenuItem>
          <MenuItem key="/admin/monitoring" icon={<IconDashboard aria-hidden="true" />} role="menuitem">
            监控中心
          </MenuItem>
        </Menu>
      </Drawer>
      {/* AI Strategy Assistant Floating Button */}
      <div data-onboarding="ai-assistant">
        <Suspense fallback={null}>
          <AIAssistantButton />
        </Suspense>
      </div>
      {/* User Feedback Floating Button */}
      <Suspense fallback={null}>
        <FeedbackButton />
      </Suspense>
      {/* Smart Onboarding for new users */}
      <Suspense fallback={null}>
        <SmartOnboarding autoShow={true} />
      </Suspense>
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav visible={isMobile && !['/login', '/register'].includes(location.pathname)} />
      {/* Spacer for bottom nav */}
      {isMobile && <div className="mobile-nav-spacer" />}
    </Layout>
    </ErrorBoundary>
  );
};

/**
 * AppRoutes - Route definitions with authentication protection
 * 
 * Issue #683: P0 - /strategies 页面无法访问
 * Root cause: Private routes (strategies, dashboard, etc.) were not protected.
 * Unauthenticated users could access them but data failed to load.
 * 
 * Fix: Wrap private routes with ProtectedRoute component to redirect
 * unauthenticated users to login page.
 * 
 * Public routes (no auth required):
 * - /, /landing, /login, /register - Landing and auth pages
 * - /leaderboard, /docs/api, /marketplace, /pricing, /subscription - Public content
 * - /user/:username - Public user profiles
 * 
 * Protected routes (auth required):
 * - All dashboard, trading, strategy, and admin pages
 */
const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes - no authentication required */}
        <Route path="/" element={<IndexPage />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/docs/api" element={<ApiDocsPage />} />
        <Route path="/marketplace" element={<StrategyMarketplacePage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/subscription" element={<SubscriptionPage />} />
        <Route path="/subscription/success" element={<SubscriptionSuccessPage />} />
        <Route path="/subscription/cancel" element={<SubscriptionCancelPage />} />
        <Route path="/user/:username" element={<UserProfilePage />} />

        {/* Protected routes - authentication required */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/strategies" element={<ProtectedRoute><StrategiesPage /></ProtectedRoute>} />
        <Route path="/trades" element={<ProtectedRoute><TradesPage /></ProtectedRoute>} />
        <Route path="/holdings" element={<ProtectedRoute><HoldingsPage /></ProtectedRoute>} />
        <Route path="/performance" element={<ProtectedRoute><PerformancePage /></ProtectedRoute>} />
        <Route path="/risk" element={<ProtectedRoute><RiskPage /></ProtectedRoute>} />
        <Route path="/sentiment" element={<ProtectedRoute><SentimentPage /></ProtectedRoute>} />
        <Route path="/copy-trading" element={<ProtectedRoute><CopyTradingPage /></ProtectedRoute>} />
        <Route path="/backtest" element={<ProtectedRoute><BacktestVisualizationPage /></ProtectedRoute>} />
        <Route path="/journal" element={<ProtectedRoute><TradingJournalPage /></ProtectedRoute>} />
        <Route path="/attribution" element={<ProtectedRoute><AttributionPage /></ProtectedRoute>} />
        <Route path="/strategy-comparison" element={<ProtectedRoute><StrategyComparisonPage /></ProtectedRoute>} />
        <Route path="/advanced-orders" element={<ProtectedRoute><AdvancedOrdersPage /></ProtectedRoute>} />
        <Route path="/user-dashboard" element={<ProtectedRoute><UserDashboardPage /></ProtectedRoute>} />
        <Route path="/rebalance" element={<ProtectedRoute><RebalancePage /></ProtectedRoute>} />
        <Route path="/scheduler" element={<ProtectedRoute><SchedulerPage /></ProtectedRoute>} />
        <Route path="/settings/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
        <Route path="/data-source" element={<ProtectedRoute><DataSourceSettingsPage /></ProtectedRoute>} />
        <Route path="/virtual-account" element={<ProtectedRoute><VirtualAccountPage /></ProtectedRoute>} />
        <Route path="/exchange-accounts" element={<ProtectedRoute><ExchangeAccountsPage /></ProtectedRoute>} />
        <Route path="/strategy-portfolio" element={<ProtectedRoute><StrategyPortfolioPage /></ProtectedRoute>} />
        <Route path="/strategy-portfolio/:portfolioId" element={<ProtectedRoute><PortfolioDetailPage /></ProtectedRoute>} />
        <Route path="/notification-preferences" element={<ProtectedRoute><NotificationPreferencesPage /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><NotificationHistoryPage /></ProtectedRoute>} />
        <Route path="/privacy" element={<ProtectedRoute><PrivacySettingsPage /></ProtectedRoute>} />
        <Route path="/user-analytics" element={<ProtectedRoute><UserBehaviorAnalyticsPage /></ProtectedRoute>} />
        <Route path="/referral" element={<ProtectedRoute><ReferralPage /></ProtectedRoute>} />
        <Route path="/comparison/live-backtest" element={<ProtectedRoute><LiveBacktestComparisonPage /></ProtectedRoute>} />

        {/* Admin routes - authentication required */}
        <Route path="/admin/revenue" element={<ProtectedRoute><AdminDashboardPage /></ProtectedRoute>} />
        <Route path="/admin/performance" element={<ProtectedRoute><PerformanceMonitoringPage /></ProtectedRoute>} />
        <Route path="/admin/apm" element={<ProtectedRoute><APMDashboardPage /></ProtectedRoute>} />
        <Route path="/admin/payment-monitoring" element={<ProtectedRoute><PaymentMonitoringPage /></ProtectedRoute>} />
        <Route path="/admin/feedback" element={<ProtectedRoute><FeedbackManagementPage /></ProtectedRoute>} />
        <Route path="/admin/business-metrics" element={<ProtectedRoute><BusinessMetricsPage /></ProtectedRoute>} />
        <Route path="/admin/monitoring" element={<ProtectedRoute><UnifiedAdminMonitoringPage /></ProtectedRoute>} />

        {/* Catch-all route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
};

// Wrapper component to use the hook inside ConnectionProvider
// Issue #579: Only initialize realtime connection for authenticated users
function RealtimeConnectionSync() {
  const { isAuthenticated } = useAuth();
  
  // Only initialize realtime connection when user is authenticated
  // This prevents unnecessary WebSocket connections on Landing Page
  useRealtimeConnection(isAuthenticated);
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

// Routes that don't need MainLayout (public pages)
// Issue #731, #732: Pricing and Settings pages should be public routes
const PUBLIC_ROUTES = [
  '/',
  '/landing',
  '/login',
  '/register',
  '/leaderboard',
  '/docs/api',
  '/marketplace',
  '/pricing',
  '/settings',  // Issue #732: Settings hub page
  '/subscription',
  '/user',  // User profile pages (e.g., /user/:username)
];

// Conditional layout wrapper
function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    route === '/' ? location.pathname === '/' : location.pathname.startsWith(route)
  );

  if (isPublicRoute) {
    // Public routes render without sidebar layout
    return <>{children}</>;
  }

  // Protected routes render with MainLayout
  return <MainLayout>{children}</MainLayout>;
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
    <SubscriptionProvider>
    <SettingsProvider>
      <ConnectionProvider>
        <RealtimeConnectionSync />
        {/* Issue #768: P0 fix - LocaleProvider wraps the entire app so LanguageSwitcher works on all pages */}
        <LocaleProvider>
          <BrowserRouter>
            <RouteRestorer />
            <AppLayout>
              <AppRoutes />
            </AppLayout>
            {/* Error reporter panel - shown when errors are captured */}
            {hasErrors && (
              <Suspense fallback={null}>
                <ErrorReporterPanel
                  errors={errors}
                  onClear={clearErrors}
                  visible={process.env.NODE_ENV === 'development'}
                />
              </Suspense>
            )}
          </BrowserRouter>
        </LocaleProvider>
      </ConnectionProvider>
    </SettingsProvider>
    </SubscriptionProvider>
    </AuthProvider>
  );
}

export default App;
