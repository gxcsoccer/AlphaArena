import React, { useState, useCallback } from 'react';
import { Layout, Card, Grid, Spin, Typography, Tabs, Drawer, Space } from '@arco-design/web-react';
import { 
  IconSwap, 
  IconOrderedList, 
  IconTrophy,
  IconMenu,
} from '@arco-design/web-react/icon';
import TradingPairList from '../components/TradingPairList';
import KLineChart from '../components/KLineChart';
import TradingOrder from '../components/TradingOrder';
import OrderBook from '../components/OrderBook';
import ConditionalOrdersPanel from '../components/ConditionalOrdersPanel';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useMarketData } from '../hooks/useMarketData';
import { usePullToRefresh } from '../hooks/useTouchGestures';

const { Content } = Layout;
const { Row, Col } = Grid;
const { Text } = Typography;

const HomePage: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USD');
  const [isMobile, setIsMobile] = useState(false);
  const [mobileTab, setMobileTab] = useState<'chart' | 'orderbook' | 'order'>('chart');
  
  // Get market data to resolve baseCurrency/quoteCurrency for selected symbol
  const { marketData, refresh: refreshMarketData } = useMarketData();
  const selectedPair = marketData.find(p => p.symbol === selectedSymbol);

  // Stable callback for resize handler to prevent re-creation
  const checkMobile = useCallback(() => {
    setIsMobile(window.innerWidth <= 768);
  }, []);

  // Detect mobile on mount and resize with proper cleanup
  React.useEffect(() => {
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, [checkMobile]);

  // Pull-to-refresh functionality
  const handleRefresh = useCallback(async () => {
    await refreshMarketData?.();
    // Force reload of other components by triggering a brief state change
    setSelectedSymbol(prev => prev);
  }, [refreshMarketData]);

  const { 
    containerRef, 
    isRefreshing, 
    pullDistance,
    handlers: pullHandlers 
  } = usePullToRefresh(handleRefresh, { threshold: 60 });

  const handlePairSelect = (symbol: string) => {
    setSelectedSymbol(symbol);
    // On mobile, switch to chart tab when pair is selected
    if (isMobile) {
      setMobileTab('chart');
    }
  };

  const handleOrderPlaced = (orderId: string) => {
    console.log('Order placed:', orderId);
  };

  const handlePriceClick = (price: number, type: 'bid' | 'ask') => {
    // Dispatch custom event to TradingOrder component
    window.dispatchEvent(
      new CustomEvent('trading-order:set-price', {
        detail: { symbol: selectedSymbol, price },
      })
    );
    // On mobile, switch to order tab when price is clicked
    if (isMobile) {
      setMobileTab('order');
    }
  };

  // Mobile tab configuration
  const mobileTabs = [
    { key: 'chart', title: 'K线图', icon: <IconTrophy /> },
    { key: 'orderbook', title: '订单簿', icon: <IconOrderedList /> },
    { key: 'order', title: '交易', icon: <IconSwap /> },
  ];

  return (
    <Content 
      ref={containerRef}
      style={{ 
        padding: isMobile ? 0 : 24,
        overflow: 'auto',
        position: 'relative',
      }}
      {...pullHandlers}
    >
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          style={{
            position: 'absolute',
            top: pullDistance - 40,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            transition: isRefreshing ? 'none' : 'top 0.2s',
          }}
        >
          <Spin loading={isRefreshing} />
          <Text type="secondary" style={{ marginLeft: 8 }}>
            {isRefreshing ? '刷新中...' : '下拉刷新'}
          </Text>
        </div>
      )}

      {/* Mobile: Stack vertically with tabs */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Trading pair selector - collapsible */}
          <div style={{ 
            padding: '8px', 
            borderBottom: '1px solid var(--color-border-1)',
            background: 'var(--color-bg-2)',
          }}>
            <ErrorBoundary>
              <TradingPairList 
                onPairSelect={handlePairSelect} 
                showSearch 
                compact 
              />
            </ErrorBoundary>
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Tabs
              activeTab={mobileTab}
              onChange={(key) => setMobileTab(key as any)}
              type="rounded"
              style={{ 
                padding: '8px 12px 0',
                background: 'var(--color-bg-2)',
              }}
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

            {/* Tab content area */}
            <div style={{ 
              flex: 1, 
              overflow: 'auto',
              padding: '8px',
            }}>
              {mobileTab === 'chart' && (
                <ErrorBoundary>
                  <KLineChart symbol={selectedSymbol} height={300} />
                </ErrorBoundary>
              )}
              
              {mobileTab === 'orderbook' && (
                <ErrorBoundary>
                  <OrderBook 
                    symbol={selectedSymbol} 
                    levels={10} 
                    onPriceClick={handlePriceClick} 
                  />
                </ErrorBoundary>
              )}
              
              {mobileTab === 'order' && (
                <ErrorBoundary>
                  <TradingOrder 
                    symbol={selectedSymbol} 
                    baseCurrency={selectedPair?.baseCurrency} 
                    quoteCurrency={selectedPair?.quoteCurrency} 
                    onOrderPlaced={handleOrderPlaced} 
                  />
                  <div style={{ marginTop: 12 }}>
                    <ErrorBoundary>
                      <ConditionalOrdersPanel symbol={selectedSymbol} limit={5} />
                    </ErrorBoundary>
                  </div>
                </ErrorBoundary>
              )}
            </div>
          </div>
        </div>
      ) : (
        // Desktop: Grid layout
        <Row gutter={16} style={{ height: 'calc(100vh - 120px)' }}>
          <Col xs={24} sm={6} md={4}>
            <Card title="交易对" style={{ height: '100%' }} bodyStyle={{ padding: '12px', height: 'calc(100% - 57px)', overflow: 'hidden' }}>
              <ErrorBoundary><TradingPairList onPairSelect={handlePairSelect} showSearch compact /></ErrorBoundary>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={10}>
            <ErrorBoundary><KLineChart symbol={selectedSymbol} height={500} /></ErrorBoundary>
          </Col>
          <Col xs={24} sm={12} md={5}>
            <ErrorBoundary><OrderBook symbol={selectedSymbol} levels={20} onPriceClick={handlePriceClick} /></ErrorBoundary>
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Row gutter={[0, 16]} style={{ height: '100%', overflow: 'auto' }}>
              <Col span={24}>
                <ErrorBoundary><TradingOrder symbol={selectedSymbol} baseCurrency={selectedPair?.baseCurrency} quoteCurrency={selectedPair?.quoteCurrency} onOrderPlaced={handleOrderPlaced} /></ErrorBoundary>
              </Col>
              <Col span={24}>
                <ErrorBoundary><ConditionalOrdersPanel symbol={selectedSymbol} limit={10} /></ErrorBoundary>
              </Col>
            </Row>
          </Col>
        </Row>
      )}
    </Content>
  );
};

export default HomePage;
