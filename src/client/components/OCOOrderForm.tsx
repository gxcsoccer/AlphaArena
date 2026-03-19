import React, { useState } from 'react';
import {
  Card,
  Form,
  InputNumber,
  Select,
  Button,
  Message,
  Space,
  Divider,
  Typography,
  Switch,
  Input,
} from '@arco-design/web-react';
import { api } from '../utils/api';

const { Text, _Title } = Typography;
const FormItem = Form.Item;

interface OCOOrderFormProps {
  symbol?: string;
  currentPrice?: number;
  onSuccess?: () => void;
}

const OCOOrderForm: React.FC<OCOOrderFormProps> = ({
  symbol: defaultSymbol,
  currentPrice,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [takeProfitOrderType, setTakeProfitOrderType] = useState<'limit' | 'market'>('limit');
  const [stopLossOrderType, setStopLossOrderType] = useState<'limit' | 'market'>('market');

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      setLoading(true);

      const orderData = {
        symbol: values.symbol,
        side: values.side,
        
        takeProfitTriggerPrice: values.takeProfitTriggerPrice,
        takeProfitQuantity: values.takeProfitQuantity,
        takeProfitOrderType,
        takeProfitLimitPrice: takeProfitOrderType === 'limit' ? values.takeProfitLimitPrice : undefined,
        
        stopLossTriggerPrice: values.stopLossTriggerPrice,
        stopLossQuantity: values.stopLossQuantity,
        stopLossOrderType,
        stopLossLimitPrice: stopLossOrderType === 'limit' ? values.stopLossLimitPrice : undefined,
      };

      const result = await api.createOCOOrder(orderData);
      
      if (result) {
        Message.success('OCO订单创建成功');
        form.resetFields();
        onSuccess?.();
      } else {
        Message.error('创建失败');
      }
    } catch (error: any) {
      Message.error(error.message || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="创建OCO订单" size="small">
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          symbol: defaultSymbol,
          side: 'sell',
          takeProfitOrderType: 'limit',
          stopLossOrderType: 'market',
        }}
      >
        <FormItem
          label="交易对"
          field="symbol"
          rules={[{ required: true, message: '请选择交易对' }]}
        >
          <Input placeholder="如 BTC/USDT" />
        </FormItem>

        <FormItem
          label="方向"
          field="side"
          rules={[{ required: true, message: '请选择方向' }]}
        >
          <Select>
            <Select.Option value="buy">买入 (做多)</Select.Option>
            <Select.Option value="sell">卖出 (做空/平仓)</Select.Option>
          </Select>
        </FormItem>

        <Divider orientation="left">
          <Text style={{ color: '#00b42a' }}>止盈设置</Text>
        </Divider>

        <FormItem
          label="止盈触发价"
          field="takeProfitTriggerPrice"
          rules={[{ required: true, message: '请输入止盈触发价' }]}
        >
          <InputNumber
            style={{ width: '100%' }}
            placeholder="价格达到此值时触发止盈"
            min={0}
            step={0.01}
          />
        </FormItem>

        <FormItem
          label="止盈数量"
          field="takeProfitQuantity"
          rules={[{ required: true, message: '请输入止盈数量' }]}
        >
          <InputNumber
            style={{ width: '100%' }}
            placeholder="止盈成交数量"
            min={0}
            step={0.0001}
          />
        </FormItem>

        <FormItem label="止盈订单类型">
          <Space>
            <Select
              value={takeProfitOrderType}
              onChange={setTakeProfitOrderType}
              style={{ width: 120 }}
            >
              <Select.Option value="limit">限价单</Select.Option>
              <Select.Option value="market">市价单</Select.Option>
            </Select>
          </Space>
        </FormItem>

        {takeProfitOrderType === 'limit' && (
          <FormItem
            label="止盈限价"
            field="takeProfitLimitPrice"
            rules={[{ required: true, message: '请输入止盈限价' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="止盈限价"
              min={0}
              step={0.01}
            />
          </FormItem>
        )}

        <Divider orientation="left">
          <Text style={{ color: '#f53f3f' }}>止损设置</Text>
        </Divider>

        <FormItem
          label="止损触发价"
          field="stopLossTriggerPrice"
          rules={[{ required: true, message: '请输入止损触发价' }]}
        >
          <InputNumber
            style={{ width: '100%' }}
            placeholder="价格达到此值时触发止损"
            min={0}
            step={0.01}
          />
        </FormItem>

        <FormItem
          label="止损数量"
          field="stopLossQuantity"
          rules={[{ required: true, message: '请输入止损数量' }]}
        >
          <InputNumber
            style={{ width: '100%' }}
            placeholder="止损成交数量"
            min={0}
            step={0.0001}
          />
        </FormItem>

        <FormItem label="止损订单类型">
          <Select
            value={stopLossOrderType}
            onChange={setStopLossOrderType}
            style={{ width: 120 }}
          >
            <Select.Option value="limit">限价单</Select.Option>
            <Select.Option value="market">市价单</Select.Option>
          </Select>
        </FormItem>

        {stopLossOrderType === 'limit' && (
          <FormItem
            label="止损限价"
            field="stopLossLimitPrice"
            rules={[{ required: true, message: '请输入止损限价' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="止损限价"
              min={0}
              step={0.01}
            />
          </FormItem>
        )}

        {currentPrice && (
          <div style={{ marginBottom: 16, padding: 12, background: '#f7f8fa', borderRadius: 4 }}>
            <Text type="secondary">当前价格: </Text>
            <Text bold>${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
          </div>
        )}

        <FormItem>
          <Button
            type="primary"
            long
            loading={loading}
            onClick={handleSubmit}
          >
            创建OCO订单
          </Button>
        </FormItem>
      </Form>
    </Card>
  );
};

export default OCOOrderForm;
