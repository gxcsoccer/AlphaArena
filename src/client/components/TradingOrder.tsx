import React, { useState, useCallback, useEffect } from 'react';
import {
  Card,
  Tabs,
  InputNumber,
  Button,
  Typography,
  Space,
  Message,
  Form,
  Radio,
  Divider,
} from '@arco-design/web-react';
import type { FormInstance } from '@arco-design/web-react';
import { useOrderBook } from '../hooks/useData';
import { usePortfolio } from '../hooks/useData';
import { api } from '../utils/api';

const { Text } = Typography;
const { TabPane } = Tabs;

export type OrderType = 'limit' | 'market';
export type OrderSide = 'buy' | 'sell';

interface OrderFormData {
  type: OrderType;
  side: OrderSide;
  price?: number;
  quantity: number;
}

interface TradingOrderProps {
  symbol?: string;
  onOrderPlaced?: (orderId: string) => void;
}

const TradingOrder: React.FC<TradingOrderProps> = ({
  symbol = 'BTC/USD',
  onOrderPlaced,
}) => {
  const [activeTab, setActiveTab] = useState<OrderSide>('buy');
  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
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
  const baseCurrency = symbol.split('/')[0];
  const quoteCurrency = symbol.split('/')[1];
  const baseBalance = portfolio?.positions.find(p => p.symbol === baseCurrency)?.quantity || 0;

  // Get current market price
  const currentPrice = orderBook ? 
    ((orderBook.bids[0]?.price + orderBook.asks[0]?.price) / 2) : 0;

  // Handle price click from order book
  const handlePriceClick = useCallback((price: number) => {
    formRef.current?.setFieldValue('price', price);
  }, []);

  // Expose handlePriceClick to parent via custom event
  useEffect(() => {
    const handleCustomEvent = (e: CustomEvent) => {
      if (e.detail.symbol === symbol) {
        handlePriceClick(e.detail.price);
      }
    };

    window.addEventListener('trading-order:set-price' as any, handleCustomEvent as any);
    return () => {
      window.removeEventListener('trading-order:set-price' as any, handleCustomEvent as any);
    };
  }, [symbol, handlePriceClick]);

  // Calculate total
  const calculateTotal = (price: number | undefined, quantity: number) => {
    if (orderType === 'market') {
      return (currentPrice || 0) * quantity;
    }
    return (price || 0) * quantity;
  };

  // Validate quantity
  const validateQuantity = (value: number | undefined) => {
    if (!value || value <= 0) {
      return '数量必须大于 0';
    }
    if (activeTab === 'sell' && value > baseBalance) {
      return `可用余额不足，最多可卖出 ${baseBalance.toFixed(4)} ${baseCurrency}`;
    }
    if (activeTab === 'buy') {
      const formData = formRef.current?.getFieldsValue();
      const price = formData?.price || currentPrice;
      const total = price * value;
      if (total > availableBalance) {
        return `可用余额不足，最多可买入 ${(availableBalance / price).toFixed(4)} ${baseCurrency}`;
      }
    }
    return true;
  };

  // Handle form submission
  const handleSubmit = async () => {
    try {
      const formData = formRef.current?.getFieldsValue();
      if (!formData) return;

      // Validate
      const quantityError = validateQuantity(formData.quantity);
      if (quantityError !== true) {
        Message.error(quantityError);
        return;
      }

      if (orderType === 'limit' && !formData.price) {
        Message.error('请输入价格');
        return;
      }

      setLoading(true);

      // Place order
      const orderData = {
        symbol,
        side: activeTab,
        type: orderType,
        price: orderType === 'limit' ? formData.price : currentPrice,
        quantity: formData.quantity,
      };

      const result = await api.createOrder(orderData);
      
      if (result) {
        Message.success(`${activeTab === 'buy' ? '买入' : '卖出'}订单提交成功！`);
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
      const formData = formRef.current?.getFieldsValue();
      const price = formData?.price || currentPrice;
      const maxQuantity = availableBalance / price;
      formRef.current?.setFieldValue('quantity', maxQuantity * percentage);
    } else {
      formRef.current?.setFieldValue('quantity', baseBalance * percentage);
    }
  };

  return (
    <Card title={`${symbol} 交易`} size="small">
      <Tabs
        activeTab={activeTab}
        onChange={(key) => setActiveTab(key as OrderSide)}
        type="rounded"
        style={{ marginBottom: 16 }}
        size={isMobile ? 'default' : 'default'}
      >
        <TabPane key="buy" title="买入" />
        <TabPane key="sell" title="卖出" />
      </Tabs>

      <Form ref={formRef} layout="vertical">
        {/* Order Type */}
        <Form.Item label="订单类型">
          <Radio.Group
            value={orderType}
            onChange={setOrderType}
            options={[
              { label: '限价单', value: 'limit' },
              { label: '市价单', value: 'market' },
            ]}
            direction={isMobile ? 'vertical' : 'horizontal'}
          />
        </Form.Item>

        {/* Price Input (only for limit orders) */}
        {orderType === 'limit' && (
          <Form.Item
            label="价格"
            tooltip="点击订单簿价格可自动填充"
          >
            <InputNumber
              name="price"
              placeholder="输入价格"
              precision={2}
              min={0}
              style={{ width: '100%' }}
              addonAfter={quoteCurrency}
              size={isMobile ? 'large' : 'default'}
            />
          </Form.Item>
        )}

        {/* Quantity Input */}
        <Form.Item
          label="数量"
          rules={[{ required: true, message: '请输入数量' }]}
        >
          <InputNumber
            name="quantity"
            placeholder="输入数量"
            precision={4}
            min={0}
            style={{ width: '100%' }}
            addonAfter={baseCurrency}
            size={isMobile ? 'large' : 'default'}
          />
        </Form.Item>

        {/* Quick Quantity Buttons - Wrap on mobile */}
        <Form.Item label="快捷数量">
          <Space
            size={isMobile ? 'small' : 'small'}
            wrap
            direction={isMobile ? 'vertical' : 'horizontal'}
          >
            <Button
              size={isMobile ? 'default' : 'mini'}
              onClick={() => handleQuickQuantity(0.25)}
              style={{ minWidth: isMobile ? '100%' : 'auto' }}
            >
              25%
            </Button>
            <Button
              size={isMobile ? 'default' : 'mini'}
              onClick={() => handleQuickQuantity(0.5)}
              style={{ minWidth: isMobile ? '100%' : 'auto' }}
            >
              50%
            </Button>
            <Button
              size={isMobile ? 'default' : 'mini'}
              onClick={() => handleQuickQuantity(0.75)}
              style={{ minWidth: isMobile ? '100%' : 'auto' }}
            >
              75%
            </Button>
            <Button
              size={isMobile ? 'default' : 'mini'}
              onClick={() => handleQuickQuantity(1)}
              style={{ minWidth: isMobile ? '100%' : 'auto' }}
            >
              100%
            </Button>
          </Space>
        </Form.Item>

        {/* Total */}
        <Form.Item label="总计">
          <Text bold>
            $
            {calculateTotal(
              formRef.current?.getFieldValue('price'),
              formRef.current?.getFieldValue('quantity') || 0
            ).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        </Form.Item>

        {/* Balance Info */}
        <Divider style={{ margin: '12px 0' }} />
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <Text type="secondary">可用 {quoteCurrency}:</Text>
            <Text>${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <Text type="secondary">可用 {baseCurrency}:</Text>
            <Text>{baseBalance.toFixed(4)}</Text>
          </div>
        </Space>

        {/* Submit Button */}
        <Button
          type="primary"
          size={isMobile ? 'large' : 'large'}
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
          {activeTab === 'buy' ? '买入' : '卖出'} {baseCurrency}
        </Button>
      </Form>
    </Card>
  );
};

export default TradingOrder;
