import React, { useState, useCallback } from 'react';
import { Layout, Card, Grid } from '@arco-design/web-react';
import TradingPairList from '../components/TradingPairList';
import KLineChart from '../components/KLineChart';
import TradingOrder from '../components/TradingOrder';
import OrderBook from '../components/OrderBook';
import ConditionalOrdersPanel from '../components/ConditionalOrdersPanel';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useMarketData } from '../hooks/useMarketData';

const { Content } = Layout;
const { Row, Col } = Grid;

const HomePage: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USD');
  const [isMobile, setIsMobile] = useState(false);
  
  // Get market data to resolve baseCurrency/quoteCurrency for selected symbol
  const { marketData } = useMarketData();
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

  const handlePairSelect = (symbol: string) => {
    setSelectedSymbol(symbol);
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
  };

  return (
    <Content style={{ padding: isMobile ? 8 : 24 }}>
      {/* Mobile: Stack vertically */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card title="交易对" size="small" bodyStyle={{ padding: 8, maxHeight: 200, overflow: 'auto' }}>
            <ErrorBoundary><TradingPairList onPairSelect={handlePairSelect} showSearch compact /></ErrorBoundary>
          </Card>
          <ErrorBoundary><KLineChart symbol={selectedSymbol} height={300} /></ErrorBoundary>
          <ErrorBoundary><OrderBook symbol={selectedSymbol} levels={10} onPriceClick={handlePriceClick} /></ErrorBoundary>
          <ErrorBoundary><TradingOrder symbol={selectedSymbol} baseCurrency={selectedPair?.baseCurrency} quoteCurrency={selectedPair?.quoteCurrency} onOrderPlaced={handleOrderPlaced} /></ErrorBoundary>
          <ErrorBoundary><ConditionalOrdersPanel symbol={selectedSymbol} limit={5} /></ErrorBoundary>
        </div>
      ) : (
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
