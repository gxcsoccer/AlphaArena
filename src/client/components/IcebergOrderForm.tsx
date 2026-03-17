import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Card,
  InputNumber,
  Button,
  Typography,
  Space,
  Message,
  Form,
  Radio,
  Divider,
  Tooltip,
  Progress,
  Switch,
} from '@arco-design/web-react';
import type { FormInstance } from '@arco-design/web-react';
import { 
  IconInfoCircle,
  IconExperiment,
} from '@arco-design/web-react/icon';
import { useOrderBook } from '../hooks/useData';
import { usePortfolio } from '../hooks/useData';
import { api } from '../utils/api';

const { Text } = Typography;

interface IcebergOrderFormProps {
  symbol?: string;
  baseCurrency?: string;
  quoteCurrency?: string;
  onOrderPlaced?: (orderId: string) => void;
}

const TRADING_FEE_RATE = 0.001; // 0.1% trading fee

const IcebergOrderForm: React.FC<IcebergOrderFormProps> = ({
  symbol = 'BTC/USD',
  baseCurrency: baseCurrencyProp,
  quoteCurrency: quoteCurrencyProp,
  onOrderPlaced,
}) => {
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [useVariance, setUseVariance] = useState(false);
  const formRef = React.useRef<FormInstance>(null);

  // Detect mobile on mount and resize
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { orderBook } = useOrderBook(symbol, 20);
  const { portfolio } = usePortfolio(undefined, symbol);

  // Calculate available balance
  const availableBalance = portfolio?.cashBalance || 0;
  
  // Resolve currencies
  const symbolParts = symbol.split('/');
  const baseCurrency = baseCurrencyProp || symbolParts[0] || symbol;
  const quoteCurrency = quoteCurrencyProp || symbolParts[1] || 'USD';
  const baseBalance = portfolio?.positions.find(p => p.symbol === baseCurrency)?.quantity || 0;

  // Get current market price
  const currentPrice = useMemo(() => {
    if (!orderBook?.bids?.length || !orderBook?.asks?.length) {
      return 0;
    }

    let bestBid = -Infinity;
    let bestAsk = Infinity;

    for (let i = 0; i < orderBook.bids.length; i++) {
      const price = orderBook.bids[i].price;
      if (price > bestBid) bestBid = price;
    }

    for (let i = 0; i < orderBook.asks.length; i++) {
      const price = orderBook.asks[i].price;
      if (price < bestAsk) bestAsk = price;
    }

    if (bestBid === -Infinity || bestAsk === Infinity) {
      return 0;
    }

    return (bestBid + bestAsk) / 2;
  }, [orderBook]);

  // Calculate max quantity
  const maxQuantity = useMemo(() => {
    const price = currentPrice;
    if (activeTab === 'buy') {
      return price > 0 ? availableBalance / (price * (1 + TRADING_FEE_RATE)) : 0;
    } else {
      return baseBalance;
    }
  }, [activeTab, availableBalance, baseBalance, currentPrice]);

  // Handle form submission
  const handleSubmit = async () => {
    const formData = formRef.current?.getFieldsValue();
    if (!formData) return;

    // Validate
    if (!formData.price || formData.price <= 0) {
      Message.error('请输入有效的价格');
      return;
    }

    if (!formData.totalQuantity || formData.totalQuantity <= 0) {
      Message.error('请输入有效的总数量');
      return;
    }

    if (!formData.displayQuantity || formData.displayQuantity <= 0) {
      Message.error('请输入有效的显示数量');
      return;
    }

    if (formData.displayQuantity >= formData.totalQuantity) {
      Message.error('显示数量必须小于总数量');
      return;
    }

    // Calculate hidden quantity
    const hiddenQuantity = formData.totalQuantity - formData.displayQuantity;
    const variance = useVariance && formData.variance ? formData.variance : undefined;

    // Prepare order data
    const orderData = {
      symbol,
      side: activeTab,
      price: formData.price,
      totalQuantity: formData.totalQuantity,
      displayQuantity: formData.displayQuantity,
      hiddenQuantity,
      variance,
    };

    try {
      setLoading(true);
      
      // Call the iceberg order API
      const result = await api.createIcebergOrder(orderData);
      
      if (result) {
        Message.success({
          content: `冰山订单提交成功！总数量: ${formData.totalQuantity}, 显示: ${formData.displayQuantity}`,
        });
        onOrderPlaced?.(result.id);
        formRef.current?.resetFields();
      } else {
        Message.error('订单提交失败');
      }
    } catch (err: any) {
      Message.error(err.message || '订单提交失败');
    } finally {
      setLoading(false);
    }
  };

  // Handle quick quantity buttons
  const handleQuickQuantity = (percentage: number) => {
    if (activeTab === 'buy') {
      const maxQty = availableBalance / (currentPrice * (1 + TRADING_FEE_RATE));
      formRef.current?.setFieldValue('totalQuantity', maxQty * percentage);
    } else {
      formRef.current?.setFieldValue('totalQuantity', baseBalance * percentage);
    }
  };

  return (
    <Card 
      title={
        <Space>
          <IconExperiment style={{ color: '#165dff' }} />
          <span>冰山订单</span>
          <Tooltip content="冰山订单只在订单簿中显示部分数量，隐藏剩余数量，适合大额交易">
            <IconInfoCircle style={{ color: '#86909c', cursor: 'help' }} />
          </Tooltip>
        </Space>
      } 
      size="small"
    >
      <Tabs
        activeTab={activeTab}
        onChange={(key) => setActiveTab(key as 'buy' | 'sell')}
        type="rounded"
        style={{ marginBottom: 16 }}
      >
        <TabPane 
          key="buy" 
          title={
            <span style={{ color: activeTab === 'buy' ? '#00b42a' : undefined }}>
              买入
            </span>
          } 
        />
        <TabPane 
          key="sell" 
          title={
            <span style={{ color: activeTab === 'sell' ? '#f53f3f' : undefined }}>
              卖出
            </span>
          } 
        />
      </Tabs>

      <Form ref={formRef} layout="vertical">
        {/* Price Input */}
        <Form.Item
          label={
            <Space>
              <span>价格</span>
              {currentPrice > 0 && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  (当前市价: {currentPrice.toFixed(2)})
                </Text>
              )}
            </Space>
          }
          required
        >
          <InputNumber
            name="price"
            placeholder={`输入价格 (${quoteCurrency})`}
            precision={2}
            min={0}
            style={{ width: '100%' }}
            size={isMobile ? 'large' : 'default'}
            suffix={
              currentPrice > 0 && (
                <Button 
                  type="text" 
                  size="mini" 
                  onClick={() => formRef.current?.setFieldValue('price', currentPrice)}
                >
                  使用市价
                </Button>
              )
            }
          />
        </Form.Item>

        {/* Total Quantity Input */}
        <Form.Item
          label={
            <Space>
              <span>总数量</span>
              <Text type="secondary" style={{ fontSize: 12 }}>
                (实际交易总量)
              </Text>
              {maxQuantity > 0 && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  (最大: {maxQuantity.toFixed(4)})
                </Text>
              )}
            </Space>
          }
          required
        >
          <InputNumber
            name="totalQuantity"
            placeholder={`输入总数量 (${baseCurrency})`}
            precision={4}
            min={0}
            max={maxQuantity}
            style={{ width: '100%' }}
            size={isMobile ? 'large' : 'default'}
          />
        </Form.Item>

        {/* Display Quantity Input */}
        <Form.Item
          label={
            <Space>
              <span>显示数量</span>
              <Tooltip content="订单簿中显示的数量，建议为总数量的10%-30%">
                <IconInfoCircle style={{ color: '#86909c', cursor: 'help' }} />
              </Tooltip>
            </Space>
          }
          required
        >
          <InputNumber
            name="displayQuantity"
            placeholder="订单簿中显示的数量"
            precision={4}
            min={0}
            style={{ width: '100%' }}
            size={isMobile ? 'large' : 'default'}
          />
        </Form.Item>

        {/* Variance Switch */}
        <Form.Item label="随机方差">
          <Space direction="vertical">
            <Switch
              checked={useVariance}
              onChange={setUseVariance}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              启用后，显示数量会在 (显示数量 - 方差) 到 显示数量 之间随机变化，防止被检测
            </Text>
          </Space>
        </Form.Item>

        {/* Variance Input */}
        {useVariance && (
          <Form.Item
            label={
              <Space>
                <span>方差值</span>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  (显示数量的随机波动范围)
                </Text>
              </Space>
            }
          >
            <InputNumber
              name="variance"
              placeholder="例如: 0.5"
              precision={4}
              min={0}
              style={{ width: '100%' }}
              size={isMobile ? 'large' : 'default'}
            />
          </Form.Item>
        )}

        {/* Quick Quantity Buttons */}
        <Form.Item label="快捷数量">
          <Space wrap>
            <Button size="mini" onClick={() => handleQuickQuantity(0.25)}>25%</Button>
            <Button size="mini" onClick={() => handleQuickQuantity(0.5)}>50%</Button>
            <Button size="mini" onClick={() => handleQuickQuantity(0.75)}>75%</Button>
            <Button size="mini" type="primary" onClick={() => handleQuickQuantity(1)}>全部</Button>
          </Space>
        </Form.Item>

        {/* Order Summary */}
        <Divider style={{ margin: '12px 0' }} />
        
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">可用 {quoteCurrency}:</Text>
            <Text>${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">可用 {baseCurrency}:</Text>
            <Text>{baseBalance.toFixed(4)}</Text>
          </div>
        </Space>

        {/* Submit Button */}
        <Button
          type="primary"
          size="large"
          long
          loading={loading}
          onClick={handleSubmit}
          style={{
            marginTop: 16,
            background: activeTab === 'buy' ? '#00b42a' : '#f53f3f',
            borderColor: activeTab === 'buy' ? '#00b42a' : '#f53f3f',
            minHeight: 48,
          }}
        >
          {loading ? '处理中...' : `提交冰山${activeTab === 'buy' ? '买入' : '卖出'}订单`}
        </Button>

        {/* Help Text */}
        <div style={{ marginTop: 12, padding: 8, background: '#f7f8fa', borderRadius: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            💡 冰山订单适合大额交易，只在订单簿中显示部分数量，减少对市场价格的影响。
            当显示部分成交后，会自动从隐藏部分补充。
          </Text>
        </div>
      </Form>
    </Card>
  );
};

// Import Tabs component
import { Tabs } from '@arco-design/web-react';
const { TabPane } = Tabs;

export default IcebergOrderForm;
