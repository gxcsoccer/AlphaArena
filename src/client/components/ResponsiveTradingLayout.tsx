import React, { useState, useEffect, useCallback } from 'react';
import { Layout, Tabs, Space, Typography, Drawer, Button } from '@arco-design/web-react';
import {
  IconTrophy,
  IconOrderedList,
  IconSwap,
  IconSettings,
  IconMenu,
} from '@arco-design/web-react/icon';
import KLineChart from './KLineChart';
import TradingOrder from './TradingOrder';
import OrderBookEnhanced from './OrderBookEnhanced';
import ConditionalOrdersPanel from './ConditionalOrdersPanel';
import { ErrorBoundary } from './ErrorBoundary';
import {
  KLineChartSkeleton,
  TradingOrderSkeleton,
  OrderBookSkeleton,
} from './TradingSkeleton';
import { Toast } from './Toast';

const { Content } = Layout;
const { Text } = Typography;

/**
 * Responsive Trading Layout Component
 * 
 * Issue #514: UX 改进 - 响应式设计改进
 * - 自适应桌面和移动端布局
 * - 优化移动端触摸交互
 * - 改进移动端导航体验
 * - 支持手势操作（下拉刷新、滑动切换）
 */

interface ResponsiveTradingLayoutProps {
  selectedSymbol: string;
  baseCurrency?: string;
  quoteCurrency?: string;
  onSymbolChange?: (symbol: string) => void;
}

type MobileTab = 'chart' | 'orderbook' | 'order' | 'history';
type DesktopView = 'standard' | 'compact';

const ResponsiveTradingLayout: React.FC<ResponsiveTradingLayoutProps> = ({
  selectedSymbol,
  baseCurrency,
  quoteCurrency,
  onSymbolChange,
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('chart');
  const [desktopView, setDesktopView] = useState<DesktopView>('standard');
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  // 检测屏幕尺寸
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      
      // 如果从移动端切换到桌面，重置标签页
      if (!mobile && mobileTab !== 'chart') {
        // 保持当前标签页
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [mobileTab]);

  // 处理价格点击
  const handlePriceClick = useCallback((price: number, type: 'bid' | 'ask') => {
    // 触发自定义事件，通知 TradingOrder 填充价格
    window.dispatchEvent(
      new CustomEvent('trading-order:set-price', {
        detail: { symbol: selectedSymbol, price },
      })
    );
    
    // 在移动端，自动切换到交易标签页
    if (isMobile) {
      setMobileTab('order');
      
      // 显示提示
      Toast.info(`已填充价格: ${price.toFixed(2)}`, {
        duration: 2000,
        position: 'top',
      });
    }
  }, [selectedSymbol, isMobile]);

  // 处理订单提交
  const handleOrderPlaced = useCallback((orderId: string) => {
    console.log('Order placed:', orderId);
    
    // 在移动端，切换到历史标签页
    if (isMobile) {
      setTimeout(() => {
        setMobileTab('history');
      }, 1000);
    }
  }, [isMobile]);

  // 移动端手势处理 - 左右滑动切换标签页
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;

    // 只处理水平滑动（横向移动距离大于纵向移动距离）
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      const tabs: MobileTab[] = ['chart', 'orderbook', 'order', 'history'];
      const currentIndex = tabs.indexOf(mobileTab);

      if (deltaX > 0 && currentIndex > 0) {
        // 向右滑动 - 上一个标签页
        setMobileTab(tabs[currentIndex - 1]);
      } else if (deltaX < 0 && currentIndex < tabs.length - 1) {
        // 向左滑动 - 下一个标签页
        setMobileTab(tabs[currentIndex + 1]);
      }
    }

    setTouchStart(null);
  }, [touchStart, mobileTab]);

  // 移动端标签页配置
  const mobileTabs = [
    { key: 'chart', title: 'K线图', icon: <IconTrophy /> },
    { key: 'orderbook', title: '订单簿', icon: <IconOrderedList /> },
    { key: 'order', title: '交易', icon: <IconSwap /> },
    { key: 'history', title: '历史', icon: <IconSettings /> },
  ];

  // 渲染移动端布局
  const renderMobileLayout = () => (
    <Content
      style={{
        padding: 0,
        overflow: 'hidden',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 标签页导航 */}
      <div
        style={{
          background: 'var(--color-bg-2)',
          borderBottom: '1px solid var(--color-border-1)',
          flexShrink: 0,
        }}
      >
        <Tabs
          activeTab={mobileTab}
          onChange={(key) => setMobileTab(key as MobileTab)}
          type="rounded"
          style={{ padding: '8px 12px 0' }}
        >
          {mobileTabs.map(tab => (
            <Tabs.TabPane
              key={tab.key}
              title={
                <Space size={4}>
                  {tab.icon}
                  <span>{tab.title}</span>
                </Space>
              }
            />
          ))}
        </Tabs>
      </div>

      {/* 标签页内容 */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {isLoading ? (
          // 显示骨架屏
          <>
            {mobileTab === 'chart' && <KLineChartSkeleton height={300} />}
            {mobileTab === 'orderbook' && <OrderBookSkeleton rows={10} />}
            {mobileTab === 'order' && <TradingOrderSkeleton />}
          </>
        ) : (
          <>
            {mobileTab === 'chart' && (
              <ErrorBoundary>
                <KLineChart
                  symbol={selectedSymbol}
                  height={350}
                  showVolume={true}
                />
              </ErrorBoundary>
            )}

            {mobileTab === 'orderbook' && (
              <ErrorBoundary>
                <OrderBookEnhanced
                  symbol={selectedSymbol}
                  levels={15}
                  onPriceClick={handlePriceClick}
                  showDepth={true}
                />
              </ErrorBoundary>
            )}

            {mobileTab === 'order' && (
              <ErrorBoundary>
                <TradingOrder
                  symbol={selectedSymbol}
                  baseCurrency={baseCurrency}
                  quoteCurrency={quoteCurrency}
                  onOrderPlaced={handleOrderPlaced}
                />
                <div style={{ marginTop: 12 }}>
                  <ErrorBoundary>
                    <ConditionalOrdersPanel
                      symbol={selectedSymbol}
                      limit={3}
                    />
                  </ErrorBoundary>
                </div>
              </ErrorBoundary>
            )}

            {mobileTab === 'history' && (
              <ErrorBoundary>
                <div style={{ padding: '16px', textAlign: 'center' }}>
                  <Text type="secondary">
                    订单历史页面（待实现）
                  </Text>
                </div>
              </ErrorBoundary>
            )}
          </>
        )}
      </div>

      {/* 快捷操作栏 */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--color-bg-2)',
          borderTop: '1px solid var(--color-border-1)',
          padding: '8px 16px',
          display: 'flex',
          justifyContent: 'space-around',
          zIndex: 100,
        }}
      >
        <Button
          type={mobileTab === 'order' ? 'primary' : 'secondary'}
          size="large"
          style={{ flex: 1, marginRight: 8 }}
          onClick={() => setMobileTab('order')}
        >
          买入
        </Button>
        <Button
          type={mobileTab === 'order' ? 'primary' : 'secondary'}
          size="large"
          status="danger"
          style={{ flex: 1 }}
          onClick={() => setMobileTab('order')}
        >
          卖出
        </Button>
      </div>
    </Content>
  );

  // 渲染桌面端布局
  const renderDesktopLayout = () => (
    <Content style={{ padding: 24, overflow: 'auto' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: desktopView === 'standard' 
            ? '280px 1fr 320px' 
            : '220px 1fr 280px',
          gap: 16,
          height: 'calc(100vh - 120px)',
        }}
      >
        {/* 左侧：K线图 + 订单簿 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, gridColumn: '1 / 3' }}>
          {isLoading ? (
            <KLineChartSkeleton height={400} />
          ) : (
            <ErrorBoundary>
              <KLineChart
                symbol={selectedSymbol}
                height={450}
                showVolume={true}
              />
            </ErrorBoundary>
          )}

          {isLoading ? (
            <OrderBookSkeleton rows={15} />
          ) : (
            <ErrorBoundary>
              <OrderBookEnhanced
                symbol={selectedSymbol}
                levels={20}
                onPriceClick={handlePriceClick}
                showDepth={true}
              />
            </ErrorBoundary>
          )}
        </div>

        {/* 右侧：交易下单 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isLoading ? (
            <TradingOrderSkeleton />
          ) : (
            <ErrorBoundary>
              <TradingOrder
                symbol={selectedSymbol}
                baseCurrency={baseCurrency}
                quoteCurrency={quoteCurrency}
                onOrderPlaced={handleOrderPlaced}
              />
            </ErrorBoundary>
          )}

          <ErrorBoundary>
            <ConditionalOrdersPanel
              symbol={selectedSymbol}
              limit={5}
            />
          </ErrorBoundary>
        </div>
      </div>

      {/* 视图切换按钮 */}
      <Button
        type="text"
        icon={<IconMenu />}
        onClick={() => setDesktopView(
          desktopView === 'standard' ? 'compact' : 'standard'
        )}
        style={{
          position: 'fixed',
          top: 80,
          right: 24,
          zIndex: 100,
        }}
      >
        {desktopView === 'standard' ? '紧凑视图' : '标准视图'}
      </Button>
    </Content>
  );

  return (
    <>
      {isMobile ? renderMobileLayout() : renderDesktopLayout()}
      
      {/* Toast 容器 */}
      {/* <ToastContainer /> */}
    </>
  );
};

export default ResponsiveTradingLayout;