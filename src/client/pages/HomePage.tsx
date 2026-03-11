import React from 'react';
import { Layout, Typography } from 'antd';

const { Header, Content } = Layout;
const { Title } = Typography;

const HomePage: React.FC = () => {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header>
        <Title level={2} style={{ color: 'white', margin: 0 }}>
          AlphaArena
        </Title>
      </Header>
      <Content style={{ padding: '50px' }}>
        <Title level={3}>欢迎来到 AlphaArena</Title>
        <p>算法交易平台 - 实时市场数据与策略回测</p>
      </Content>
    </Layout>
  );
};

export default HomePage;
