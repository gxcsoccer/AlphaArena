import React from 'react';
import { Layout, Typography, Card } from '@arco-design/web-react';
import TradingPairList from '../components/TradingPairList';

const { Header, Content } = Layout;
const { Title } = Typography;

const HomePage: React.FC = () => {
  const handlePairSelect = (symbol: string) => {
    console.log('Selected trading pair:', symbol);
    // TODO: Navigate to trading page or show details
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header>
        <Title heading={2} style={{ color: 'white', margin: 0 }}>
          AlphaArena - 市场行情
        </Title>
      </Header>
      <Content style={{ padding: '24px' }}>
        <Card title="交易对列表" style={{ height: 'calc(100vh - 120px)' }}>
          <TradingPairList onPairSelect={handlePairSelect} />
        </Card>
      </Content>
    </Layout>
  );
};

export default HomePage;
