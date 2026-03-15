import React, { useState, useCallback } from 'react';
import { Layout, Card, Grid } from '@arco-design/web-react';
import TradingPairList from '../components/TradingPairList';
import KLineChart from '../components/KLineChart';
import TradingOrder from '../components/TradingOrder';
import OrderBook from '../components/OrderBook';
import ConditionalOrdersPanel from '../components/ConditionalOrdersPanel';

const { Content } = Layout;
const { Row, Col } = Grid;

const HomePage: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USD');
  const [isMobile, setIsMobile] = useState(false);

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
          {/* Trading Pair List - Full width at top */}
          <Card
            title="交易对"
            size="small"
            bodyStyle={{ padding: 8, maxHeight: 200, overflow: 'auto' }}
          >
            <TradingPairList onPairSelect={handlePairSelect} showSearch compact />
          </Card>

          {/* K-Line Chart - Full width */}
          <KLineChart symbol={selectedSymbol} height={300} />

          {/* Order Book - Scrollable */}
          <OrderBook symbol={selectedSymbol} levels={10} onPriceClick={handlePriceClick} />

          {/* Trading Order Form - Full width */}
          <TradingOrder symbol={selectedSymbol} onOrderPlaced={handleOrderPlaced} />

          {/* Conditional Orders Panel */}
          <ConditionalOrdersPanel symbol={selectedSymbol} limit={5} />
        </div>
      ) : (
        /* Desktop: Original layout */
        <Row gutter={16} style={{ height: 'calc(100vh - 120px)' }}>
          {/* Left: Trading Pair List */}
          <Col xs={24} sm={6} md={4}>
            <Card
              title="交易对"
              style={{ height: '100%' }}
              bodyStyle={{ padding: '12px', height: 'calc(100% - 57px)', overflow: 'hidden' }}
            >
              <TradingPairList onPairSelect={handlePairSelect} showSearch compact />
            </Card>
          </Col>

          {/* Center-Left: K-Line Chart */}
          <Col xs={24} sm={12} md={10}>
            <KLineChart symbol={selectedSymbol} height={500} />
          </Col>

          {/* Center-Right: Order Book */}
          <Col xs={24} sm={12} md={5}>
            <OrderBook symbol={selectedSymbol} levels={20} onPriceClick={handlePriceClick} />
          </Col>

          {/* Right: Trading Order Form + Conditional Orders */}
          <Col xs={24} sm={12} md={5}>
            <Row gutter={[0, 16]} style={{ height: '100%', overflow: 'auto' }}>
              <Col span={24}>
                <TradingOrder symbol={selectedSymbol} onOrderPlaced={handleOrderPlaced} />
              </Col>
              <Col span={24}>
                <ConditionalOrdersPanel symbol={selectedSymbol} limit={10} />
              </Col>
            </Row>
          </Col>
        </Row>
      )}
    </Content>
  );
};

export default HomePage;
