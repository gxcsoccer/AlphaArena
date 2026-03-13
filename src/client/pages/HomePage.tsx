import React, { useState } from 'react';
import { Layout, Typography, Card, Grid } from '@arco-design/web-react';
import TradingPairList from '../components/TradingPairList';
import KLineChart from '../components/KLineChart';
import TradingOrder from '../components/TradingOrder';
import OrderBook from '../components/OrderBook';

const { Header, Content } = Layout;
const { Title } = Typography;
const { Row, Col } = Grid;

const HomePage: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USD');

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
    <Layout style={{ minHeight: '100vh' }}>
      <Header>
        <Title heading={2} style={{ color: 'white', margin: 0 }}>
          AlphaArena - 交易终端
        </Title>
      </Header>
      <Content style={{ padding: '24px' }}>
        <Row gutter={16} style={{ height: 'calc(100vh - 120px)' }}>
          {/* Left: Trading Pair List */}
          <Col span={4}>
            <Card title="交易对" style={{ height: '100%' }} bodyStyle={{ padding: '12px', height: 'calc(100% - 57px)', overflow: 'hidden' }}>
              <TradingPairList onPairSelect={handlePairSelect} showSearch compact />
            </Card>
          </Col>

          {/* Center-Left: K-Line Chart */}
          <Col span={10}>
            <KLineChart symbol={selectedSymbol} height={500} />
          </Col>

          {/* Center-Right: Order Book */}
          <Col span={5}>
            <OrderBook symbol={selectedSymbol} levels={20} onPriceClick={handlePriceClick} />
          </Col>

          {/* Right: Trading Order Form */}
          <Col span={5}>
            <TradingOrder symbol={selectedSymbol} onOrderPlaced={handleOrderPlaced} />
          </Col>
        </Row>
      </Content>
    </Layout>
  );
};

export default HomePage;
