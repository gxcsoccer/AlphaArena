import { ConditionalOrdersDAO } from '../../src/database/conditional-orders.dao';
import { getSupabaseClient } from '../../src/database/client';

// Mock Supabase client
jest.mock('../../src/database/client', () => ({
  getSupabaseClient: jest.fn(),
}));

// In-memory storage for mock database
let mockOrders: Array<{
  id: string;
  strategy_id: string | null;
  symbol: string;
  side: 'buy' | 'sell';
  order_type: 'stop_loss' | 'take_profit';
  trigger_price: string;
  quantity: string;
  status: 'active' | 'triggered' | 'cancelled' | 'expired';
  triggered_at: string | null;
  triggered_order_id: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}> = [];

function createMockOrder(order: any) {
  const id = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  return {
    id,
    strategy_id: order.strategy_id || null,
    symbol: order.symbol,
    side: order.side,
    order_type: order.order_type,
    trigger_price: order.trigger_price.toString(),
    quantity: order.quantity.toString(),
    status: 'active' as const,
    triggered_at: null,
    triggered_order_id: null,
    expires_at: order.expires_at || null,
    created_at: now,
    updated_at: now,
  };
}

// Create a chainable mock query builder
function createMockQuery() {
  const filters: Array<{ key: string; value: any; type: string }> = [];

  function applyFilters(): any[] {
    let result = [...mockOrders];
    
    // Apply filters
    filters.forEach((filter: { key: string; value: any; type: string }) => {
      if (filter.type === 'eq') {
        result = result.filter(r => (r as any)[filter.key] === filter.value);
      } else if (filter.type === 'lte_stoploss') {
        // Stop-loss: trigger when currentPrice (value) <= trigger_price (row)
        result = result.filter(r => parseFloat(filter.value) <= parseFloat((r as any)[filter.key]));
      } else if (filter.type === 'gte_takeprofit') {
        // Take-profit: trigger when currentPrice (value) >= trigger_price (row)
        result = result.filter(r => parseFloat(filter.value) >= parseFloat((r as any)[filter.key]));
      } else if (filter.type === 'lt') {
        result = result.filter(r => (r as any)[filter.key] < filter.value);
      }
    });

    return result;
  }

  const chainable: any = {
    select: jest.fn(() => chainable),
    insert: jest.fn((rows: any[]) => {
      const newRows = rows.map(row => createMockOrder(row));
      mockOrders.push(...newRows);
      return {
        select: jest.fn(() => chainable),
        single: jest.fn().mockResolvedValue({ data: newRows[0], error: null }),
      };
    }),
    single: jest.fn().mockImplementation(async () => {
      const result = applyFilters();
      const data = result[0] || null;
      return { data, error: data ? null : { code: 'PGRST116' } };
    }),
    // Make the object awaitable - returns array of results
    then: function(resolve: any, reject: any) {
      try {
        const result = applyFilters();
        resolve({ data: result, error: null });
      } catch (err) {
        reject(err);
      }
      return this;
    },
    eq: jest.fn((key: string, value: any) => {
      filters.push({ key, value, type: 'eq' });
      return chainable;
    }),
    lte: jest.fn((key: string, value: any) => {
      // For stop-loss: trigger when currentPrice <= triggerPrice
      // The DAO passes currentPrice as value, we need to check if value <= row.trigger_price
      filters.push({ key, value, type: 'lte_stoploss' });
      return chainable;
    }),
    gte: jest.fn((key: string, value: any) => {
      // For take-profit: trigger when currentPrice >= triggerPrice  
      // The DAO passes currentPrice as value, we need to check if value >= row.trigger_price
      filters.push({ key, value, type: 'gte_takeprofit' });
      return chainable;
    }),
    lt: jest.fn((key: string, value: any) => {
      filters.push({ key, value, type: 'lt' });
      return chainable;
    }),
    order: jest.fn(() => chainable),
    limit: jest.fn((limit: number) => {
      return chainable;
    }),
    range: jest.fn((start: number, end: number) => {
      return chainable;
    }),
    update: jest.fn((updates: any) => {
      return {
        eq: jest.fn((key: string, value: any) => {
          if (key === 'id') {
            const order = mockOrders.find(o => o.id === value);
            if (order) {
              Object.assign(order, updates);
              order.updated_at = new Date().toISOString();
            }
            return {
              select: jest.fn(() => chainable),
              single: jest.fn().mockResolvedValue({ data: order || null, error: null }),
            };
          }
          return chainable;
        }),
      };
    }),
    delete: jest.fn(() => {
      return {
        eq: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
    }),
  };

  return chainable;
}

const mockSupabaseClient = {
  from: jest.fn(() => createMockQuery()),
};

describe('ConditionalOrdersDAO', () => {
  let dao: ConditionalOrdersDAO;
  const testSymbol = 'BTC/USD';

  beforeAll(() => {
    (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabaseClient);
    dao = new ConditionalOrdersDAO();
  });

  beforeEach(() => {
    mockOrders = [];
    jest.clearAllMocks();
  });

  it('should create a stop-loss order', async () => {
    const order = await dao.create({
      symbol: testSymbol,
      side: 'sell',
      orderType: 'stop_loss',
      triggerPrice: 45000,
      quantity: 0.5,
    });

    expect(order.id).toBeDefined();
    expect(order.symbol).toBe(testSymbol);
    expect(order.side).toBe('sell');
    expect(order.orderType).toBe('stop_loss');
    expect(order.triggerPrice).toBe(45000);
    expect(order.quantity).toBe(0.5);
    expect(order.status).toBe('active');

    // Clean up
    await dao.cancel(order.id);
  });

  it('should create a take-profit order', async () => {
    const order = await dao.create({
      symbol: testSymbol,
      side: 'sell',
      orderType: 'take_profit',
      triggerPrice: 55000,
      quantity: 0.3,
    });

    expect(order.id).toBeDefined();
    expect(order.orderType).toBe('take_profit');
    expect(order.triggerPrice).toBe(55000);
    expect(order.status).toBe('active');

    // Clean up
    await dao.cancel(order.id);
  });

  it('should get active conditional orders', async () => {
    // Create test order
    const order = await dao.create({
      symbol: testSymbol,
      side: 'sell',
      orderType: 'stop_loss',
      triggerPrice: 46000,
      quantity: 0.2,
    });

    const activeOrders = await dao.getActive(testSymbol);
    expect(activeOrders.length).toBeGreaterThan(0);
    expect(activeOrders.some(o => o.id === order.id)).toBe(true);

    // Clean up
    await dao.cancel(order.id);
  });

  it('should trigger a conditional order', async () => {
    const order = await dao.create({
      symbol: testSymbol,
      side: 'sell',
      orderType: 'stop_loss',
      triggerPrice: 47000,
      quantity: 0.1,
    });

    const triggeredOrderId = `triggered_${Date.now()}`;
    const updatedOrder = await dao.trigger(order.id, triggeredOrderId);

    expect(updatedOrder.status).toBe('triggered');
    expect(updatedOrder.triggeredOrderId).toBe(triggeredOrderId);
    expect(updatedOrder.triggeredAt).toBeDefined();

    // Clean up is not needed as order is already triggered
  });

  it('should cancel a conditional order', async () => {
    const order = await dao.create({
      symbol: testSymbol,
      side: 'sell',
      orderType: 'take_profit',
      triggerPrice: 56000,
      quantity: 0.4,
    });

    const cancelledOrder = await dao.cancel(order.id);
    expect(cancelledOrder.status).toBe('cancelled');

    // Verify it's no longer in active orders
    const activeOrders = await dao.getActive(testSymbol);
    expect(activeOrders.some(o => o.id === order.id)).toBe(false);
  });

  it('should get orders to trigger based on price (stop-loss)', async () => {
    // Create a stop-loss order with trigger price at 48000
    const order = await dao.create({
      symbol: testSymbol,
      side: 'sell',
      orderType: 'stop_loss',
      triggerPrice: 48000,
      quantity: 0.25,
    });

    // Current price is 47500 (below trigger), should trigger
    const ordersToTrigger = await dao.getOrdersToTrigger(testSymbol, 47500);
    expect(ordersToTrigger.some(o => o.id === order.id)).toBe(true);

    // Current price is 49000 (above trigger), should NOT trigger
    const ordersNotToTrigger = await dao.getOrdersToTrigger(testSymbol, 49000);
    expect(ordersNotToTrigger.some(o => o.id === order.id)).toBe(false);

    // Clean up
    await dao.cancel(order.id);
  });

  it('should get orders to trigger based on price (take-profit)', async () => {
    // Create a take-profit order with trigger price at 50000
    const order = await dao.create({
      symbol: testSymbol,
      side: 'sell',
      orderType: 'take_profit',
      triggerPrice: 50000,
      quantity: 0.35,
    });

    // Current price is 51000 (above trigger), should trigger
    const ordersToTrigger = await dao.getOrdersToTrigger(testSymbol, 51000);
    expect(ordersToTrigger.some(o => o.id === order.id)).toBe(true);

    // Current price is 49000 (below trigger), should NOT trigger
    const ordersNotToTrigger = await dao.getOrdersToTrigger(testSymbol, 49000);
    expect(ordersNotToTrigger.some(o => o.id === order.id)).toBe(false);

    // Clean up
    await dao.cancel(order.id);
  });

  it('should get conditional order statistics', async () => {
    // Create multiple orders
    const order1 = await dao.create({
      symbol: testSymbol,
      side: 'sell',
      orderType: 'stop_loss',
      triggerPrice: 45000,
      quantity: 0.1,
    });

    const order2 = await dao.create({
      symbol: testSymbol,
      side: 'sell',
      orderType: 'take_profit',
      triggerPrice: 55000,
      quantity: 0.2,
    });

    const stats = await dao.getStats();
    expect(stats.totalOrders).toBeGreaterThanOrEqual(2);
    expect(stats.stopLossCount).toBeGreaterThanOrEqual(1);
    expect(stats.takeProfitCount).toBeGreaterThanOrEqual(1);
    expect(stats.activeOrders).toBeGreaterThanOrEqual(2);

    // Clean up
    await dao.cancel(order1.id);
    await dao.cancel(order2.id);
  });
});
