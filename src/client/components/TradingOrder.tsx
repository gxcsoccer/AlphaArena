import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Tooltip,
  Progress,
} from '@arco-design/web-react';
import type { FormInstance } from '@arco-design/web-react';
import { 
  IconExclamationCircle, 
  IconCheckCircle, 
  IconInfoCircle,
  IconDelete,
  IconExperiment,
} from '@arco-design/web-react/icon';
import { useOrderBook } from '../hooks/useData';
import { usePortfolio } from '../hooks/useData';
import { api } from '../utils/api';

const { Text } = Typography;
const { TabPane } = Tabs;

export type OrderType = 'limit' | 'market' | 'stop_loss' | 'take_profit' | 'advanced';
export type OrderSide = 'buy' | 'sell';

interface TradingOrderProps {
  /**
   * Optional base currency (e.g., "BTC", "AAPL")
   * If not provided, will be parsed from symbol
   */
  baseCurrency?: string;
  /**
   * Optional quote currency (e.g., "USD", "USDT")
   * If not provided, will be parsed from symbol or default to "USD"
   */
  quoteCurrency?: string;
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

// Error type categorization for better error messages
enum ErrorCategory {
  NETWORK = 'network',
  BUSINESS = 'business',
  VALIDATION = 'validation',
  UNKNOWN = 'unknown',
}

// Parse error and return user-friendly message
const parseError = (error: any): { message: string; category: ErrorCategory } => {
  // Network errors
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return {
      message: '网络连接失败，请检查网络后重试',
      category: ErrorCategory.NETWORK,
    };
  }
  if (error.message?.includes('timeout')) {
    return {
      message: '请求超时，请稍后重试',
      category: ErrorCategory.NETWORK,
    };
  }
  
  // Business errors
  if (error.message?.includes('Insufficient balance')) {
    return {
      message: '可用余额不足，无法完成交易',
      category: ErrorCategory.BUSINESS,
    };
  }
  if (error.message?.includes('Invalid order')) {
    return {
      message: '订单无效，请检查订单参数',
      category: ErrorCategory.BUSINESS,
    };
  }
  if (error.message?.includes('Market closed')) {
    return {
      message: '市场已关闭，请在交易时间内下单',
      category: ErrorCategory.BUSINESS,
    };
  }
  
  // Default to original message
  return {
    message: error.message || '操作失败，请稍后重试',
    category: ErrorCategory.UNKNOWN,
  };
};

// Show toast with icon based on error category
const showErrorToast = (error: any) => {
  const { message, category } = parseError(error);
  const icon = category === ErrorCategory.NETWORK ? '🌐' : 
               category === ErrorCategory.BUSINESS ? '📊' : '⚠️';
  Message.error(`${icon} ${message}`);
};

// CSS for success animation
const successAnimationStyle = `
  @keyframes successPulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.02); }
    100% { transform: scale(1); }
  }
  .order-success-pulse {
    animation: successPulse 0.3s ease-in-out;
  }
`;

const TradingOrder: React.FC<TradingOrderProps> = ({
  symbol = 'BTC/USD',
  baseCurrency: baseCurrencyProp,
  quoteCurrency: quoteCurrencyProp,
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
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);
  const [formPrice, setFormPrice] = useState<number | undefined>(undefined);
  const navigate = useNavigate();
  const formRef = React.useRef<FormInstance>(null);

  // Inject success animation style
  useEffect(() => {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = successAnimationStyle;
    document.head.appendChild(styleSheet);
    return () => {
      document.head.removeChild(styleSheet);
    };
  }, []);

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
  
  // Resolve baseCurrency and quoteCurrency:
  // 1. Use props if provided (from parent with API data)
  // 2. Fallback to parsing symbol (works for crypto pairs like "BTC/USD")
  // 3. For stock symbols like "AAPL", default quoteCurrency to "USD"
  const symbolParts = symbol.split('/');
  const baseCurrency = baseCurrencyProp || symbolParts[0] || symbol;
  const quoteCurrency = quoteCurrencyProp || symbolParts[1] || 'USD';
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

  // Calculate price range for hints
  const priceRange = useMemo(() => {
    if (!orderBook?.bids?.length || !orderBook?.asks?.length) {
      return null;
    }

    let minBid = Infinity;
    let maxBid = -Infinity;
    let minAsk = Infinity;
    let maxAsk = -Infinity;

    for (const bid of orderBook.bids) {
      if (bid.price < minBid) minBid = bid.price;
      if (bid.price > maxBid) maxBid = bid.price;
    }

    for (const ask of orderBook.asks) {
      if (ask.price < minAsk) minAsk = ask.price;
      if (ask.price > maxAsk) maxAsk = ask.price;
    }

    return {
      minBid: minBid === Infinity ? null : minBid,
      maxBid: maxBid === -Infinity ? null : maxBid,
      minAsk: minAsk === Infinity ? null : minAsk,
      maxAsk: maxAsk === -Infinity ? null : maxAsk,
    };
  }, [orderBook]);

  // Calculate max quantity based on available balance
  const maxQuantity = useMemo(() => {
    const price = formPrice || currentPrice;
    if (activeTab === 'buy') {
      // For buy: max = availableBalance / (price * (1 + fee))
      return price > 0 ? availableBalance / (price * (1 + TRADING_FEE_RATE)) : 0;
    } else {
      // For sell: max = baseBalance
      return baseBalance;
    }
  }, [activeTab, availableBalance, baseBalance, currentPrice, formPrice]);

  // Real-time validation function
  const validateField = useCallback((field: 'price' | 'quantity' | 'triggerPrice', value: number | undefined): ValidationError | null => {
    const formData = formRef.current?.getFieldsValue();

    // Price validation
    if (field === 'price' && orderType === 'limit') {
      if (!value || value <= 0) {
        return { field: 'price', message: '价格必须是正数', type: 'error' };
      }
      
      // Show warning for prices far from market price
      if (currentPrice > 0) {
        const deviation = Math.abs(value - currentPrice) / currentPrice;
        if (deviation > 0.1) {
          return { 
            field: 'price', 
            message: `价格偏离市价 ${(deviation * 100).toFixed(1)}%，请确认是否正确`, 
            type: 'warning' 
          };
        }
      }
      
      // Check if price is within order book range
      if (priceRange && priceRange.maxBid && priceRange.minAsk) {
        if (activeTab === 'buy' && value > priceRange.maxAsk * 1.1) {
          return { 
            field: 'price', 
            message: `买入价格高于卖一价 ${((value / priceRange.maxAsk - 1) * 100).toFixed(1)}%`, 
            type: 'warning' 
          };
        }
        if (activeTab === 'sell' && value < priceRange.minBid * 0.9) {
          return { 
            field: 'price', 
            message: `卖出价格低于买一价 ${((1 - value / priceRange.minBid) * 100).toFixed(1)}%`, 
            type: 'warning' 
          };
        }
      }
    }

    // Trigger price validation
    if (field === 'triggerPrice' && (orderType === 'stop_loss' || orderType === 'take_profit')) {
      if (!value || value <= 0) {
        return { field: 'triggerPrice', message: '触发价格必须是正数', type: 'error' };
      }
      
      // Warn if trigger price is far from current price
      if (currentPrice > 0) {
        const deviation = Math.abs(value - currentPrice) / currentPrice;
        if (deviation > 0.2) {
          return { 
            field: 'triggerPrice', 
            message: `触发价格偏离市价 ${(deviation * 100).toFixed(1)}%`, 
            type: 'warning' 
          };
        }
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
  }, [orderType, activeTab, currentPrice, availableBalance, baseBalance, baseCurrency, priceRange]);

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
  const _calculateTotal = (price: number | undefined, quantity: number) => {
    if (orderType === 'market') {
      return (currentPrice || 0) * quantity;
    }
    return (price || 0) * quantity;
  };

  // Validate quantity
  const _validateQuantity = (value: number | undefined) => {
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
      setOrderSuccess(false);
      setSuccessOrderId(null);

      let result;

      // Place order based on type
      if (orderData.orderType === 'stop_loss' || orderData.orderType === 'take_profit') {
        // Conditional order
        result = await api.createConditionalOrder(orderData);
        
        if (result) {
          setOrderSuccess(true);
          setSuccessOrderId(result.id);
          Message.success({
            content: `${orderData.orderType === 'stop_loss' ? '止损' : '止盈'}订单提交成功！`,
            icon: <IconCheckCircle />,
          });
          onOrderPlaced?.(result.id);
          formRef.current?.resetFields();
          setValidationErrors([]);
          setOrderSummary(null);
          
          // Clear success state after animation
          setTimeout(() => {
            setOrderSuccess(false);
            setSuccessOrderId(null);
          }, 3000);
        } else {
          showErrorToast(new Error('订单提交失败'));
        }
      } else {
        // Regular order (limit or market)
        result = await api.createOrder(orderData);
        
        if (result) {
          setOrderSuccess(true);
          setSuccessOrderId(result.id);
          Message.success({
            content: `${orderData.side === 'buy' ? '买入' : '卖出'}订单提交成功！`,
            icon: <IconCheckCircle />,
          });
          onOrderPlaced?.(result.id);
          formRef.current?.resetFields();
          setValidationErrors([]);
          setOrderSummary(null);
          
          // Clear success state after animation
          setTimeout(() => {
            setOrderSuccess(false);
            setSuccessOrderId(null);
          }, 3000);
        } else {
          showErrorToast(new Error('订单提交失败'));
        }
      }
    } catch (err: any) {
      showErrorToast(err);
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
      const maxQuantity = availableBalance / (price * (1 + TRADING_FEE_RATE));
      formRef.current?.setFieldValue('quantity', maxQuantity * percentage);
    } else {
      formRef.current?.setFieldValue('quantity', baseBalance * percentage);
    }
  };

  // Handle one-click clear position (sell all)
  const handleClearPosition = () => {
    if (baseBalance <= 0) {
      Message.warning('没有可卖出的持仓');
      return;
    }

    Modal.confirm({
      title: '确认一键清仓',
      content: (
        <div>
          <p>确定要以市价卖出所有 {baseBalance.toFixed(4)} {baseCurrency} 吗？</p>
          <p style={{ color: '#86909c', fontSize: 12 }}>
            预计金额：${(baseBalance * currentPrice).toFixed(2)}
          </p>
        </div>
      ),
      okText: '确认清仓',
      cancelText: '取消',
      okButtonProps: {
        status: 'danger',
      },
      onOk: async () => {
        try {
          setLoading(true);
          const result = await api.createOrder({
            symbol,
            side: 'sell',
            type: 'market',
            quantity: baseBalance,
          });

          if (result) {
            setOrderSuccess(true);
            setSuccessOrderId(result.id);
            Message.success({
              content: '一键清仓成功！',
              icon: <IconCheckCircle />,
            });
            formRef.current?.resetFields();
            
            setTimeout(() => {
              setOrderSuccess(false);
              setSuccessOrderId(null);
            }, 3000);
          } else {
            showErrorToast(new Error('清仓失败'));
          }
        } catch (err: any) {
          showErrorToast(err);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  return (
    <Card 
      title={
        <Space>
          <span>{symbol} 交易</span>
          {orderSuccess && (
            <span 
              className="order-success-pulse"
              style={{ color: '#00b42a', fontSize: 12 }}
            >
              ✓ 订单已提交
            </span>
          )}
        </Space>
      } 
      size="small"
      extra={
        activeTab === 'sell' && baseBalance > 0 && (
          <Tooltip content="以市价卖出所有持仓">
            <Button
              type="text"
              size="small"
              status="danger"
              icon={<IconDelete />}
              onClick={handleClearPosition}
            >
              {!isMobile && '一键清仓'}
            </Button>
          </Tooltip>
        )
      }
    >
      <Tabs
        activeTab={activeTab}
        onChange={(key) => {
          setActiveTab(key as OrderSide);
          setOrderSuccess(false);
        }}
        type="rounded"
        style={{ marginBottom: 16 }}
        size={isMobile ? 'default' : 'default'}
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

      <Form 
      ref={formRef} 
      layout="vertical"
      onValuesChange={(changedValues) => {
        if (changedValues.price !== undefined) {
          setFormPrice(changedValues.price);
        }
      }}
    >
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
              { label: '高级订单', value: 'advanced' },
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

        {/* Advanced Order Selection */}
        {orderType === 'advanced' && (
          <Card 
            style={{ 
              marginTop: 16, 
              background: 'var(--color-fill-1)', 
              border: '1px dashed var(--color-border)' 
            }}
          >
            <Space direction="vertical" size="medium" style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconExperiment style={{ fontSize: 20, color: 'var(--color-primary)' }} />
                <Text bold>高级订单类型</Text>
              </div>
              <Text type="secondary">
                使用专业工具优化大额交易执行，减少市场冲击
              </Text>
              <Space wrap>
                <Button 
                  type="outline" 
                  size="small"
                  onClick={() => navigate('/advanced-orders?tab=iceberg')}
                >
                  冰山订单
                </Button>
                <Button 
                  type="outline" 
                  size="small"
                  onClick={() => navigate('/advanced-orders?tab=twap')}
                >
                  TWAP 订单
                </Button>
                <Button 
                  type="outline" 
                  size="small"
                  onClick={() => navigate('/advanced-orders?tab=oco')}
                >
                  OCO 订单
                </Button>
              </Space>
              <Divider style={{ margin: '8px 0' }} />
              <Button 
                type="primary" 
                long
                onClick={() => navigate('/advanced-orders')}
              >
                前往高级订单页面
              </Button>
            </Space>
          </Card>
        )}

        {/* Price Input (for limit orders) */}
        {orderType === 'limit' && (
          <Form.Item
            label={
              <Space>
                <span>价格</span>
                {priceRange && (
                  <Tooltip 
                    content={
                      <div>
                        <div>买一价: {priceRange.maxBid?.toFixed(2)}</div>
                        <div>卖一价: {priceRange.minAsk?.toFixed(2)}</div>
                        <div>当前市价: {currentPrice.toFixed(2)}</div>
                      </div>
                    }
                  >
                    <IconInfoCircle style={{ color: '#86909c' }} />
                  </Tooltip>
                )}
              </Space>
            }
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
              suffix={
                currentPrice > 0 && (
                  <Tooltip content="点击使用市价">
                    <Button 
                      type="text" 
                      size="mini" 
                      onClick={() => formRef.current?.setFieldValue('price', currentPrice)}
                    >
                      市价: {currentPrice.toFixed(2)}
                    </Button>
                  </Tooltip>
                )
              }
            />
          </Form.Item>
        )}

        {/* Trigger Price Input (for conditional orders) */}
        {(orderType === 'stop_loss' || orderType === 'take_profit') && (
          <Form.Item
            label={
              <Space>
                <span>触发价格</span>
                {currentPrice > 0 && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    (当前: {currentPrice.toFixed(2)})
                  </Text>
                )}
              </Space>
            }
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
          label={
            <Space>
              <span>数量</span>
              {maxQuantity > 0 && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  (最大: {maxQuantity.toFixed(4)})
                </Text>
              )}
            </Space>
          }
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
            max={maxQuantity}
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
              type="primary"
              onClick={() => handleQuickQuantity(1)}
              style={{ minWidth: isMobile ? '100%' : 'auto' }}
            >
              全部
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

            {/* Portfolio percentage indicator */}
            <Form.Item>
              <div style={{ marginBottom: 4 }}>
                <Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    占账户比例
                  </Text>
                  <Text 
                    style={{ 
                      fontSize: 12, 
                      color: orderSummary.percentageOfPortfolio > 10 ? '#faad14' : '#86909c' 
                    }}
                  >
                    {orderSummary.percentageOfPortfolio.toFixed(1)}%
                  </Text>
                </Space>
              </div>
              <Progress
                percent={Math.min(orderSummary.percentageOfPortfolio, 100)}
                strokeWidth={6}
                style={{ width: '100%' }}
                color={orderSummary.percentageOfPortfolio > 10 ? '#faad14' : '#00b42a'}
              />
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
          className={orderSuccess ? 'order-success-pulse' : ''}
          style={{
            marginTop: 16,
            background: activeTab === 'buy' ? '#00b42a' : '#f53f3f',
            borderColor: activeTab === 'buy' ? '#00b42a' : '#f53f3f',
            minHeight: 48,
            transition: 'all 0.3s ease',
            ...(orderSuccess && {
              background: '#00b42a',
              borderColor: '#00b42a',
            }),
          }}
          icon={orderSuccess ? <IconCheckCircle /> : undefined}
        >
          {loading ? '处理中...' : 
           orderSuccess ? '✓ 已提交' :
           `${activeTab === 'buy' ? '买入' : '卖出'} ${baseCurrency}`}
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
