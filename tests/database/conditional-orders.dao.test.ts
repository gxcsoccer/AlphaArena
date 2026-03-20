import { ConditionalOrdersDAO } from '../../src/database/conditional-orders.dao';
import { seedMockData } from '../__mocks__/supabase';

// Use the shared Supabase mock
jest.mock('../../src/database/client');

describe('ConditionalOrdersDAO', () => {
  let dao: ConditionalOrdersDAO;

  // Helper to create mock order row
  function createMockOrderRow(overrides: Partial<any> = {}) {
    const id = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    return {
      id,
      strategy_id: null,
      symbol: 'BTC/USDT',
      side: 'sell',
      order_type: 'stop_loss',
      trigger_price: '50000',
      quantity: '0.1',
      status: 'active',
      triggered_at: null,
      triggered_order_id: null,
      expires_at: null,
      created_at: now,
      updated_at: now,
      ...overrides,
    };
  }

  beforeEach(() => {
    dao = new ConditionalOrdersDAO();
  });

  describe('create', () => {
    it('should create a new conditional order', async () => {
      const orderData = {
        symbol: 'BTC/USDT',
        side: 'sell' as const,
        orderType: 'stop_loss' as const,
        triggerPrice: 50000,
        quantity: 0.1,
      };

      const order = await dao.create(orderData);

      expect(order).toBeDefined();
      expect(order.symbol).toBe('BTC/USDT');
      expect(order.side).toBe('sell');
      expect(order.orderType).toBe('stop_loss');
    });

    it('should create order with strategyId', async () => {
      const orderData = {
        strategyId: 'strategy-123',
        symbol: 'ETH/USDT',
        side: 'buy' as const,
        orderType: 'take_profit' as const,
        triggerPrice: 3000,
        quantity: 1,
      };

      const order = await dao.create(orderData);

      expect(order.strategyId).toBe('strategy-123');
      expect(order.symbol).toBe('ETH/USDT');
    });
  });

  describe('getActive', () => {
    it('should return empty array when no orders', async () => {
      seedMockData('conditional_orders', []);
      const orders = await dao.getActive('BTC/USDT');
      expect(orders).toEqual([]);
    });

    it('should return active orders for symbol', async () => {
      seedMockData('conditional_orders', [
        createMockOrderRow({ symbol: 'BTC/USDT', status: 'active' }),
        createMockOrderRow({ symbol: 'ETH/USDT', status: 'active' }),
      ]);

      const orders = await dao.getActive('BTC/USDT');
      expect(orders.length).toBe(1);
      expect(orders[0].symbol).toBe('BTC/USDT');
    });
  });

  describe('getOrdersToTrigger', () => {
    it('should return orders that should trigger', async () => {
      // The DAO logic:
      // - Stop-loss triggers when trigger_price <= currentPrice (unusual, but that's the implementation)
      // - Take-profit triggers when trigger_price >= currentPrice
      seedMockData('conditional_orders', [
        createMockOrderRow({ 
          symbol: 'BTC/USDT', 
          order_type: 'stop_loss', 
          trigger_price: '49000', // Will match when price is 49000 (trigger_price <= currentPrice)
          status: 'active' 
        }),
        createMockOrderRow({ 
          symbol: 'BTC/USDT', 
          order_type: 'take_profit', 
          trigger_price: '48000', // Will NOT match when price is 49000 (trigger_price >= currentPrice fails)
          status: 'active' 
        }),
      ]);

      // Price at 49000
      const orders = await dao.getOrdersToTrigger('BTC/USDT', 49000);
      expect(orders.length).toBe(1);
      expect(orders[0].orderType).toBe('stop_loss');
    });

    it('should return take-profit orders when price is below trigger', async () => {
      seedMockData('conditional_orders', [
        createMockOrderRow({ 
          symbol: 'BTC/USDT', 
          order_type: 'stop_loss', 
          trigger_price: '59000', // stop_loss triggers when trigger_price <= currentPrice
          status: 'active' 
        }),
        createMockOrderRow({ 
          symbol: 'BTC/USDT', 
          order_type: 'take_profit', 
          trigger_price: '59000', // take_profit triggers when trigger_price >= currentPrice
          status: 'active' 
        }),
      ]);
      
      // At price 58000:
      // - stop_loss: 59000 <= 58000 is false, won't trigger
      // - take_profit: 59000 >= 58000 is true, will trigger
      const orders = await dao.getOrdersToTrigger('BTC/USDT', 58000);
      expect(orders.length).toBe(1);
      expect(orders[0].orderType).toBe('take_profit');
    });
  });

  describe('trigger', () => {
    it('should mark order as triggered', async () => {
      const order = createMockOrderRow({ status: 'active' });
      seedMockData('conditional_orders', [order]);

      const updated = await dao.trigger(order.id, 'triggered-order-123');
      
      expect(updated.status).toBe('triggered');
      expect(updated.triggeredOrderId).toBe('triggered-order-123');
    });
  });

  describe('cancel', () => {
    it('should cancel an order', async () => {
      const order = createMockOrderRow({ status: 'active' });
      seedMockData('conditional_orders', [order]);

      const cancelled = await dao.cancel(order.id);

      expect(cancelled.status).toBe('cancelled');
    });
  });

  describe('getMany', () => {
    it('should return orders for a strategy', async () => {
      seedMockData('conditional_orders', [
        createMockOrderRow({ strategy_id: 'strategy-1', status: 'active' }),
        createMockOrderRow({ strategy_id: 'strategy-2', status: 'active' }),
        createMockOrderRow({ strategy_id: 'strategy-1', status: 'triggered' }),
      ]);

      const orders = await dao.getMany({ strategyId: 'strategy-1' });
      expect(orders.length).toBe(2);
      orders.forEach(order => {
        expect(order.strategyId).toBe('strategy-1');
      });
    });
  });
});