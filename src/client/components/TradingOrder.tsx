import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
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
  Modal,
} from '@arco-design/web-react';
import type { FormInstance } from '@arco-design/web-react';
import { IconExclamationCircle, IconCheckCircle } from '@arco-design/web-react/icon';
import { useOrderBook } from '../hooks/useData';
import { usePortfolio } from '../hooks/useData';
import { api } from '../utils/api';

const { Text } = Typography;
const { TabPane } = Tabs;

export type OrderType = 'limit' | 'market' | 'stop_loss' | 'take_profit';
export type OrderSide = 'buy' | 'sell';

interface OrderFormData {
  type: OrderType;
  side: OrderSide;
  price?: number;
  triggerPrice?: number;
  quantity: number;
}

interface TradingOrderProps {
  symbol?: string;
  onOrderPlaced?: (orderId: string) => void;
}

// Validation error types
interface ValidationError {
  field: 'price' | 'quantity' | 'triggerPrice' | 'general';
  message: string;
  type: 'error' | 'warning';
}

const TRADING_FEE_RATE = 0.001; // 0.1% trading fee

const TradingOrder: React.FC<TradingOrderProps> = ({
  symbol = 'BTC/USD',
  onOrderPlaced,
}) => {
  const [activeTab, setActiveTab] = useState<OrderSide>('buy');
  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [conditionalOrderType, setConditionalOrderType] = useState<'stop_loss' | 'take_profit'>('stop_loss');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState<any>(null);
  const [orderSummary, setOrderSummary] = useState<{
    total: number;
    fee: number;
    totalWithFee: number;
    percentageOfPortfolio: number;
  } | null>(null);
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
  const totalPortfolioValue = portfolio?.totalValue || availableBalance;

  // Get current market price - must find best bid/ask (highest bid, lowest ask)
  // because API returns unsorted arrays
  const currentPrice = useMemo(() => {
    if (!orderBook?.bids?.length || !orderBook?.asks?.length) {
      return 0;
    }

    // Find best bid (highest price) and best ask (lowest price)
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

    // Validate we found valid prices
    if (bestBid === -Infinity || bestAsk === Infinity) {
      return 0;
    }

    return (bestBid + bestAsk) / 2;
  }, [orderBook]);
  // Real-time validation function
  const validateField = useCallback((field: 'price' | 'quantity' | 'triggerPrice', value: number | undefined): ValidationError | null => {
    const formData = formRef.current?.getFieldsValue();

    // Price validation
    if (field === 'price' && orderType === 'limit') {
      if (!value || value <= 0) {
        return { field: 'price', message: '价格必须是正数', type: 'error' };
      }
      if (value > currentPrice * 10) {
        return { field: 'price', message: '价格过高，请确认是否正确', type: 'warning' };
      }
    }

    // Trigger price validation
    if (field === 'triggerPrice' && (orderType === 'stop_loss' || orderType === 'take_profit')) {
      if (!value || value <= 0) {
        return { field: 'triggerPrice', message: '触发价格必须是正数', type: 'error' };
      }
    }

    // Quantity validation
    if (field === 'quantity') {
      if (!value || value <= 0) {
        return { field: 'quantity', message: '数量必须是正数', type: 'error' };
      }

      const price = formData?.price || currentPrice;
      const total = price * value;

      if (activeTab === 'buy') {
        const fee = total * TRADING_FEE_RATE;
        const totalWithFee = total + fee;
        if (totalWithFee > availableBalance) {
          const maxQty = availableBalance / (price * (1 + TRADING_FEE_RATE));
          return { 
            field: 'quantity', 
            message: `可用余额不足（含手续费），最多可买入 ${maxQty.toFixed(4)} ${baseCurrency}`, 
            type: 'error' 
          };
        }
      }

      if (activeTab === 'sell' && value > baseBalance) {
        return { 
          field: 'quantity', 
          message: `可用余额不足，最多可卖出 ${baseBalance.toFixed(4)} ${baseCurrency}`, 
          type: 'error' 
        };
      }
    }

    return null;
  }, [orderType, activeTab, currentPrice, availableBalance, baseBalance, baseCurrency]);

  // Validate all fields and return errors
  const validateAllFields = useCallback((): ValidationError[] => {
    const errors: ValidationError[] = [];
    const formData = formRef.current?.getFieldsValue();

    // Validate price for limit orders
    if (orderType === 'limit') {
      const priceError = validateField('price', formData?.price);
      if (priceError) errors.push(priceError);
    }

    // Validate trigger price for conditional orders
    if (orderType === 'stop_loss' || orderType === 'take_profit') {
      const triggerError = validateField('triggerPrice', formData?.triggerPrice);
      if (triggerError) errors.push(triggerError);
    }

    // Validate quantity
    const quantityError = validateField('quantity', formData?.quantity);
    if (quantityError) errors.push(quantityError);

    return errors;
  }, [orderType, validateField]);

  // Calculate order summary
  const calculateOrderSummary = useCallback(() => {
    const formData = formRef.current?.getFieldsValue();
    if (!formData?.quantity) return null;

    const price = (orderType === 'limit' ? formData.price : currentPrice) || currentPrice;
    const quantity = formData.quantity;
    const total = price * quantity;
    const fee = total * TRADING_FEE_RATE;
    const totalWithFee = total + fee;
    const percentageOfPortfolio = totalPortfolioValue > 0 ? (totalWithFee / totalPortfolioValue) * 100 : 0;

    return {
      total,
      fee,
      totalWithFee,
      percentageOfPortfolio,
    };
  }, [orderType, currentPrice, totalPortfolioValue]);

  // Update validation errors when form values change
  useEffect(() => {
    const formData = formRef.current?.getFieldsValue();
    if (!formData?.quantity) {
      setValidationErrors([]);
      return;
    }

    const errors = validateAllFields();
    setValidationErrors(errors);
    setOrderSummary(calculateOrderSummary());
  }, [validateAllFields, calculateOrderSummary]);

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

  // Execute order (called after confirmation or directly for small orders)
  const executeOrder = async (orderData: any) => {
    try {
      setLoading(true);

      let result;

      // Place order based on type
      if (orderData.orderType === 'stop_loss' || orderData.orderType === 'take_profit') {
        // Conditional order
        result = await api.createConditionalOrder(orderData);
        
        if (result) {
          Message.success(`${orderData.orderType === 'stop_loss' ? '止损' : '止盈'}订单提交成功！`);
          onOrderPlaced?.(result.id);
          formRef.current?.resetFields();
          setValidationErrors([]);
          setOrderSummary(null);
        } else {
          Message.error('订单提交失败');
        }
      } else {
        // Regular order (limit or market)
        result = await api.createOrder(orderData);
        
        if (result) {
          Message.success(`${orderData.side === 'buy' ? '买入' : '卖出'}订单提交成功！`);
          onOrderPlaced?.(result.id);
          formRef.current?.resetFields();
          setValidationErrors([]);
          setOrderSummary(null);
        } else {
          Message.error('订单提交失败');
        }
      }
    } catch (err: any) {
      Message.error(err.message || '订单提交失败');
    } finally {
      setLoading(false);
    }
  };

  // Handle form submission with validation and confirmation
  const handleSubmit = async () => {
    const formData = formRef.current?.getFieldsValue();
    if (!formData) return;

    // Validate all fields
    const errors = validateAllFields();
    if (errors.length > 0) {
      const errorMessages = errors.map(e => e.message).join('; ');
      Message.error(errorMessages);
      return;
    }

    // Check for warnings
    const warnings = errors.filter(e => e.type === 'warning');
    if (warnings.length > 0) {
      const warningMessages = warnings.map(e => e.message).join('; ');
      Message.warning(warningMessages);
    }

    // Calculate order summary
    const summary = calculateOrderSummary();
    if (!summary) {
      Message.error('订单数据不完整');
      return;
    }

    // Prepare order data
    let orderData: any;
    if (orderType === 'stop_loss' || orderType === 'take_profit') {
      orderData = {
        symbol,
        side: activeTab,
        orderType: orderType as 'stop_loss' | 'take_profit',
        triggerPrice: formData.triggerPrice,
        quantity: formData.quantity,
      };
    } else {
      orderData = {
        symbol,
        side: activeTab,
        type: orderType,
        price: orderType === 'limit' ? formData.price : currentPrice,
        quantity: formData.quantity,
      };
    }

    // Check if order is large (>10% of portfolio)
    if (summary.percentageOfPortfolio > 10) {
      // Show confirmation modal for large orders
      setPendingOrderData(orderData);
      setShowConfirmModal(true);
      return;
    }

    // Execute order directly for small orders
    await executeOrder(orderData);
  };

  // Handle confirmation modal
  const handleConfirmOrder = async () => {
    setShowConfirmModal(false);
    if (pendingOrderData) {
      await executeOrder(pendingOrderData);
      setPendingOrderData(null);
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
            onChange={(value) => {
              setOrderType(value);
              // Set conditional order type based on selection
              if (value === 'stop_loss' || value === 'take_profit') {
                setConditionalOrderType(value);
              }
            }}
            options={[
              { label: '市价单', value: 'market' },
              { label: '限价单', value: 'limit' },
              { label: '止损单', value: 'stop_loss' },
              { label: '止盈单', value: 'take_profit' },
            ]}
            direction={isMobile ? 'vertical' : 'horizontal'}
          />
        </Form.Item>

        {/* Conditional Order Type Selector (for stop_loss/take_profit) */}
        {(orderType === 'stop_loss' || orderType === 'take_profit') && (
          <Form.Item label="条件单类型">
            <Radio.Group
              value={conditionalOrderType}
              onChange={setConditionalOrderType}
              options={[
                { label: '止损 (价格下跌触发)', value: 'stop_loss' },
                { label: '止盈 (价格上涨触发)', value: 'take_profit' },
              ]}
              direction={isMobile ? 'vertical' : 'horizontal'}
            />
          </Form.Item>
        )}

        {/* Price Input (for limit orders) */}
        {orderType === 'limit' && (
          <Form.Item
            label="价格"
            tooltip="点击订单簿价格可自动填充"
            validateStatus={validationErrors.find(e => e.field === 'price')?.type === 'error' ? 'error' : 
                           validationErrors.find(e => e.field === 'price')?.type === 'warning' ? 'warning' : undefined}
            help={validationErrors.find(e => e.field === 'price')?.message}
          >
            <InputNumber
              name="price"
              placeholder={`输入价格 (${quoteCurrency})`}
              precision={2}
              min={0}
              style={{ width: '100%' }}
              size={isMobile ? 'large' : 'default'}
            />
          </Form.Item>
        )}

        {/* Trigger Price Input (for conditional orders) */}
        {(orderType === 'stop_loss' || orderType === 'take_profit') && (
          <Form.Item
            label="触发价格"
            tooltip={orderType === 'stop_loss' ? '当市场价格跌破此价格时触发卖出' : '当市场价格涨破此价格时触发卖出'}
            validateStatus={validationErrors.find(e => e.field === 'triggerPrice')?.type === 'error' ? 'error' : 
                           validationErrors.find(e => e.field === 'triggerPrice')?.type === 'warning' ? 'warning' : undefined}
            help={validationErrors.find(e => e.field === 'triggerPrice')?.message}
          >
            <InputNumber
              name="triggerPrice"
              placeholder={`输入触发价格 (${quoteCurrency})`}
              precision={2}
              min={0}
              style={{ width: '100%' }}
              size={isMobile ? 'large' : 'default'}
            />
          </Form.Item>
        )}

        {/* Quantity Input */}
        <Form.Item
          label="数量"
          rules={[{ required: true, message: '请输入数量' }]}
          validateStatus={validationErrors.find(e => e.field === 'quantity')?.type === 'error' ? 'error' : 
                         validationErrors.find(e => e.field === 'quantity')?.type === 'warning' ? 'warning' : undefined}
          help={validationErrors.find(e => e.field === 'quantity')?.message}
        >
          <InputNumber
            name="quantity"
            placeholder={`输入数量 (${baseCurrency})`}
            precision={4}
            min={0}
            style={{ width: '100%' }}
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

        {/* Order Summary */}
        {orderSummary && (
          <>
            <Form.Item label="订单金额">
              <Text>
                ${orderSummary.total.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            </Form.Item>

            <Form.Item label="预计手续费">
              <Text type="secondary">
                ${orderSummary.fee.toLocaleString(undefined, {
                  minimumFractionDigits: 4,
                  maximumFractionDigits: 4,
                })}{' '}
                <Text type="secondary" style={{ fontSize: '12px' }}>(费率 {TRADING_FEE_RATE * 100}%)</Text>
              </Text>
            </Form.Item>

            <Form.Item label="总计（含手续费）">
              <Text bold>
                ${orderSummary.totalWithFee.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            </Form.Item>

            {orderSummary.percentageOfPortfolio > 5 && (
              <Form.Item>
                <div style={{ 
                  padding: '8px 12px', 
                  borderRadius: 4, 
                  background: orderSummary.percentageOfPortfolio > 10 ? '#fff7e6' : '#f0f0f0',
                  border: `1px solid ${orderSummary.percentageOfPortfolio > 10 ? '#faad14' : '#d9d9d9'}`,
                  marginBottom: 8,
                }}>
                  <Space>
                    <IconExclamationCircle style={{ 
                      color: orderSummary.percentageOfPortfolio > 10 ? '#faad14' : '#8c8c8c' 
                    }} />
                    <Text type={orderSummary.percentageOfPortfolio > 10 ? 'warning' : 'secondary'}>
                      此订单占您账户的 {orderSummary.percentageOfPortfolio.toFixed(1)}%，属于大额订单
                    </Text>
                  </Space>
                </div>
              </Form.Item>
            )}
          </>
        )}

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
          disabled={validationErrors.some(e => e.type === 'error')}
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

      {/* Confirmation Modal for Large Orders */}
      <Modal
        visible={showConfirmModal}
        title="确认大额订单"
        onOk={handleConfirmOrder}
        onCancel={() => {
          setShowConfirmModal(false);
          setPendingOrderData(null);
        }}
        okText="确认提交"
        cancelText="取消"
        okButtonProps={{ 
          status: 'warning',
          loading: loading,
        }}
      >
        <div style={{ padding: '16px 0' }}>
          <div style={{ 
            padding: '12px', 
            background: '#fff7e6', 
            borderRadius: 4, 
            border: '1px solid #faad14',
            marginBottom: 16,
          }}>
            <Space>
              <IconExclamationCircle style={{ color: '#faad14' }} />
              <Text type="warning" style={{ fontWeight: 'bold' }}>
                此订单金额较大，请仔细确认
              </Text>
            </Space>
          </div>

          <div style={{ marginBottom: 12 }}>
            <Text type="secondary">订单类型：</Text>
            <Text>
              {orderType === 'limit' ? '限价单' : 
               orderType === 'market' ? '市价单' :
               orderType === 'stop_loss' ? '止损单' : '止盈单'}
            </Text>
          </div>

          <div style={{ marginBottom: 12 }}>
            <Text type="secondary">方向：</Text>
            <Text style={{ color: activeTab === 'buy' ? '#00b42a' : '#f53f3f', fontWeight: 'bold' }}>
              {activeTab === 'buy' ? '买入' : '卖出'}
            </Text>
          </div>

          <div style={{ marginBottom: 12 }}>
            <Text type="secondary">数量：</Text>
            <Text>{pendingOrderData?.quantity} {baseCurrency}</Text>
          </div>

          {orderSummary && (
            <>
              <Divider style={{ margin: '12px 0' }} />
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">订单金额：</Text>
                  <Text>${orderSummary.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">手续费：</Text>
                  <Text>${orderSummary.fee.toLocaleString(undefined, { minimumFractionDigits: 4 })}</Text>
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">总计：</Text>
                  <Text style={{ fontWeight: 'bold' }}>${orderSummary.totalWithFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">占账户比例：</Text>
                  <Text type="warning" style={{ fontWeight: 'bold' }}>{orderSummary.percentageOfPortfolio.toFixed(1)}%</Text>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>
    </Card>
  );
};

export default TradingOrder;
