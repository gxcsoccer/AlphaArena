import React, { useState } from 'react';
import { Layout, Typography, Card, Grid } from '@arco-design/web-react';
import TradingPairList from '../components/TradingPairList';
import KLineChart from '../components/KLineChart';
import TradingOrder from '../components/TradingOrder';

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
          <Col span={6}>
            <Card title="交易对" style={{ height: '100%' }} bodyStyle={{ padding: '12px', height: 'calc(100% - 57px)', overflow: 'hidden' }}>
              <TradingPairList onPairSelect={handlePairSelect} showSearch compact />
            </Card>
          </Col>

          {/* Center: K-Line Chart */}
          <Col span={12}>
            <KLineChart symbol={selectedSymbol} height={500} />
          </Col>

          {/* Right: Trading Order Form */}
          <Col span={6}>
            <TradingOrder symbol={selectedSymbol} onOrderPlaced={handleOrderPlaced} />
          </Col>
        </Row>
      </Content>
    </Layout>
  );
};

export default HomePage;
