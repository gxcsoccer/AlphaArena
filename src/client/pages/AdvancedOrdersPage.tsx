import React, { useState } from 'react';
import { Typography, Space, Tabs, Card, Grid } from '@arco-design/web-react';
const { Row, Col } = Grid;
import { IconExperiment, IconClockCircle } from '@arco-design/web-react/icon';
import IcebergOrderForm from '../components/IcebergOrderForm';
import IcebergOrdersPanel from '../components/IcebergOrdersPanel';
import TWAPOrderForm from '../components/TWAPOrderForm';
import TWAPOrdersPanel from '../components/TWAPOrdersPanel';
import OCOOrderForm from '../components/OCOOrderForm';
import OCOOrdersPanel from '../components/OCOOrdersPanel';
import ConditionalOrdersPanel from '../components/ConditionalOrdersPanel';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const AdvancedOrdersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('iceberg');
  const [symbol] = useState('BTC/USD');

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Page Header */}
        <div>
          <Title heading={4} style={{ margin: 0 }}>
            高级订单
          </Title>
          <Text type="secondary">
            使用冰山订单、TWAP 订单和 OCO 订单等专业工具，优化大额交易执行
          </Text>
        </div>

        {/* Order Type Tabs */}
        <Tabs
          activeTab={activeTab}
          onChange={setActiveTab}
          type="rounded"
          style={{ marginBottom: 16 }}
        >
          <TabPane
            key="iceberg"
            title={
              <Space>
                <IconExperiment />
                <span>冰山订单</span>
              </Space>
            }
          />
          <TabPane
            key="twap"
            title={
              <Space>
                <IconClockCircle />
                <span>TWAP 订单</span>
              </Space>
            }
          />
          <TabPane
            key="oco"
            title={
              <Space>
                <span>OCO 订单</span>
              </Space>
            }
          />
          <TabPane
            key="conditional"
            title={
              <Space>
                <span>条件单</span>
              </Space>
            }
          />
        </Tabs>

        {/* Iceberg Orders Tab */}
        {activeTab === 'iceberg' && (
          <Row gutter={24}>
            <Col xs={24} lg={12}>
              <IcebergOrderForm symbol={symbol} />
            </Col>
            <Col xs={24} lg={12}>
              <IcebergOrdersPanel symbol={symbol} limit={20} />
            </Col>
          </Row>
        )}

        {/* TWAP Orders Tab */}
        {activeTab === 'twap' && (
          <Row gutter={24}>
            <Col xs={24} lg={12}>
              <TWAPOrderForm symbol={symbol} />
            </Col>
            <Col xs={24} lg={12}>
              <TWAPOrdersPanel symbol={symbol} limit={20} />
            </Col>
          </Row>
        )}

        {/* OCO Orders Tab */}
        {activeTab === 'oco' && (
          <Row gutter={24}>
            <Col xs={24} lg={12}>
              <OCOOrderForm symbol={symbol} />
            </Col>
            <Col xs={24} lg={12}>
              <OCOOrdersPanel symbol={symbol} limit={20} />
            </Col>
          </Row>
        )}

        {/* Conditional Orders Tab */}
        {activeTab === 'conditional' && (
          <Row gutter={24}>
            <Col xs={24}>
              <Card title="条件单列表">
                <Text type="secondary">
                  条件单包括止损单和止盈单，当市场价格达到设定条件时自动触发交易。
                </Text>
                <div style={{ marginTop: 16 }}>
                  <ConditionalOrdersPanel symbol={symbol} limit={50} />
                </div>
              </Card>
            </Col>
          </Row>
        )}
      </Space>
    </div>
  );
};

export default AdvancedOrdersPage;
