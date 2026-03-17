import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Card,
  InputNumber,
  Button,
  Typography,
  Space,
  Message,
  Form,
  DatePicker,
  Divider,
  Tooltip,
  Select,
} from '@arco-design/web-react';
import type { FormInstance } from '@arco-design/web-react';
import { 
  IconInfoCircle,
  IconClockCircle,
} from '@arco-design/web-react/icon';
import { useOrderBook } from '../hooks/useData';
import { usePortfolio } from '../hooks/useData';
import { api } from '../utils/api';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface TWAPOrderFormProps {
  symbol?: string;
  baseCurrency?: string;
  quoteCurrency?: string;
  onOrderPlaced?: (orderId: string) => void;
}

const TRADING_FEE_RATE = 0.001; // 0.1% trading fee

const TWAPOrderForm: React.FC<TWAPOrderFormProps> = ({
  symbol = 'BTC/USD',
  baseCurrency: baseCurrencyProp,
  quoteCurrency: quoteCurrencyProp,
  onOrderPlaced,
}) => {
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [timeRange, setTimeRange] = useState<[Date, Date] | null>(null);
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [usePriceLimit, setUsePriceLimit] = useState(false);
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

  // Calculate estimated slices
  const estimatedSlices = useMemo(() => {
    if (!timeRange || intervalMinutes < 1) return 0;
    const [start, end] = timeRange;
    const durationMs = end.getTime() - start.getTime();
    const durationMinutes = durationMs / (1000 * 60);
    return Math.floor(durationMinutes / intervalMinutes);
  }, [timeRange, intervalMinutes]);

  // Handle form submission
  const handleSubmit = async () => {
    const formData = formRef.current?.getFieldsValue();
    if (!formData) return;

    // Validate
    if (!formData.totalQuantity || formData.totalQuantity <= 0) {
      Message.error('请输入有效的总数量');
      return;
    }

    if (!timeRange) {
      Message.error('请选择执行时间范围');
      return;
    }

    if (intervalMinutes < 1) {
      Message.error('执行间隔至少为 1 分钟');
      return;
    }

    if (estimatedSlices < 2) {
      Message.error('时间范围不足以创建至少 2 个切片');
      return;
    }

    // Prepare order data
    const orderData = {
      symbol,
      side: activeTab,
      totalQuantity: formData.totalQuantity,
      startTime: timeRange[0].toISOString(),
      endTime: timeRange[1].toISOString(),
      intervalSeconds: intervalMinutes * 60,
      priceLimit: usePriceLimit && formData.priceLimit ? formData.priceLimit : undefined,
      priceLimitType: usePriceLimit ? (activeTab === 'buy' ? 'max' : 'min') : 'none',
    };

    try {
      setLoading(true);
      
      // Call the TWAP order API
      const result = await api.createTWAPOrder(orderData);
      
      if (result) {
        Message.success({
          content: `TWAP 订单提交成功！将分为 ${estimatedSlices} 个切片执行`,
        });
        onOrderPlaced?.(result.id);
        formRef.current?.resetFields();
        setTimeRange(null);
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

  // Handle quick time range
  const handleQuickTimeRange = (hours: number) => {
    const now = new Date();
    const end = new Date(now.getTime() + hours * 60 * 60 * 1000);
    setTimeRange([now, end]);
  };

  return (
    <Card 
      title={
        <Space>
          <IconClockCircle style={{ color: '#165dff' }} />
          <span>TWAP 订单</span>
          <Tooltip content="TWAP 订单在指定时间段内均匀分批执行，减少市场冲击">
            <IconInfoCircle style={{ color: '#86909c', cursor: 'help' }} />
          </Tooltip>
        </Space>
      } 
      size="small"
    >
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type={activeTab === 'buy' ? 'primary' : 'secondary'}
            style={{ 
              minWidth: 80,
              background: activeTab === 'buy' ? '#00b42a' : undefined,
              borderColor: activeTab === 'buy' ? '#00b42a' : undefined,
            }}
            onClick={() => setActiveTab('buy')}
          >
            买入
          </Button>
          <Button
            type={activeTab === 'sell' ? 'primary' : 'secondary'}
            style={{ 
              minWidth: 80,
              background: activeTab === 'sell' ? '#f53f3f' : undefined,
              borderColor: activeTab === 'sell' ? '#f53f3f' : undefined,
            }}
            onClick={() => setActiveTab('sell')}
          >
            卖出
          </Button>
        </Space>
      </div>

      <Form ref={formRef} layout="vertical">
        {/* Total Quantity Input */}
        <Form.Item
          label={
            <Space>
              <span>总数量</span>
              <Text type="secondary" style={{ fontSize: 12 }}>
                (分批执行的总量)
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

        {/* Time Range */}
        <Form.Item
          label={
            <Space>
              <span>执行时间范围</span>
              <Tooltip content="订单将在此时间范围内均匀分批执行">
                <IconInfoCircle style={{ color: '#86909c', cursor: 'help' }} />
              </Tooltip>
            </Space>
          }
          required
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <RangePicker
              showTime
              format="YYYY-MM-DD HH:mm"
              value={timeRange}
              onChange={(val) => setTimeRange(val as [Date, Date] | null)}
              style={{ width: '100%' }}
              disabledDate={(current) => current && current < new Date()}
            />
            <Space wrap>
              <Text type="secondary" style={{ fontSize: 12 }}>快捷:</Text>
              <Button size="mini" onClick={() => handleQuickTimeRange(1)}>1小时</Button>
              <Button size="mini" onClick={() => handleQuickTimeRange(4)}>4小时</Button>
              <Button size="mini" onClick={() => handleQuickTimeRange(8)}>8小时</Button>
              <Button size="mini" onClick={() => handleQuickTimeRange(24)}>24小时</Button>
            </Space>
          </Space>
        </Form.Item>

        {/* Interval */}
        <Form.Item
          label={
            <Space>
              <span>执行间隔</span>
              <Tooltip content="每个切片之间的时间间隔">
                <IconInfoCircle style={{ color: '#86909c', cursor: 'help' }} />
              </Tooltip>
            </Space>
          }
        >
          <Space>
            <Select
              value={intervalMinutes}
              onChange={setIntervalMinutes}
              style={{ width: 120 }}
            >
              <Select.Option value={1}>1 分钟</Select.Option>
              <Select.Option value={5}>5 分钟</Select.Option>
              <Select.Option value={10}>10 分钟</Select.Option>
              <Select.Option value={15}>15 分钟</Select.Option>
              <Select.Option value={30}>30 分钟</Select.Option>
              <Select.Option value={60}>1 小时</Select.Option>
            </Select>
          </Space>
        </Form.Item>

        {/* Price Limit */}
        <Form.Item label="价格限制">
          <Space direction="vertical">
            <Select
              value={usePriceLimit ? 'yes' : 'no'}
              onChange={(val) => setUsePriceLimit(val === 'yes')}
              style={{ width: 200 }}
            >
              <Select.Option value="no">无限制</Select.Option>
              <Select.Option value="yes">设置价格限制</Select.Option>
            </Select>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {activeTab === 'buy' 
                ? '买入时，超过此价格将暂停执行' 
                : '卖出时，低于此价格将暂停执行'}
            </Text>
          </Space>
        </Form.Item>

        {/* Price Limit Input */}
        {usePriceLimit && (
          <Form.Item
            label={
              <Space>
                <span>{activeTab === 'buy' ? '最高价格' : '最低价格'}</span>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  ({quoteCurrency})
                </Text>
              </Space>
            }
          >
            <InputNumber
              name="priceLimit"
              placeholder={`输入${activeTab === 'buy' ? '最高' : '最低'}价格`}
              precision={2}
              min={0}
              style={{ width: '100%' }}
              size={isMobile ? 'large' : 'default'}
              suffix={
                currentPrice > 0 && (
                  <Button 
                    type="text" 
                    size="mini" 
                    onClick={() => formRef.current?.setFieldValue('priceLimit', currentPrice)}
                  >
                    使用市价
                  </Button>
                )
              }
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
          {timeRange && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">预计切片数:</Text>
              <Text bold>{estimatedSlices} 个</Text>
            </div>
          )}
          {timeRange && estimatedSlices > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">每切片数量:</Text>
              <Text>
                {formRef.current?.getFieldValue('totalQuantity') 
                  ? (formRef.current.getFieldValue('totalQuantity') / estimatedSlices).toFixed(4)
                  : '-'
                } {baseCurrency}
              </Text>
            </div>
          )}
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
          {loading ? '处理中...' : `提交 TWAP ${activeTab === 'buy' ? '买入' : '卖出'}订单`}
        </Button>

        {/* Help Text */}
        <div style={{ marginTop: 12, padding: 8, background: '#f7f8fa', borderRadius: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            💡 TWAP (时间加权平均价) 订单在指定时间段内均匀分批执行，
            适合大额交易，可有效减少市场冲击和滑点。
          </Text>
        </div>
      </Form>
    </Card>
  );
};

export default TWAPOrderForm;
