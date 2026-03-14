import { ConditionalOrdersDAO } from '../../src/database/conditional-orders.dao';

describe('ConditionalOrdersDAO', () => {
  let dao: ConditionalOrdersDAO;
  const testSymbol = 'BTC/USD';

  beforeAll(() => {
    dao = new ConditionalOrdersDAO();
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
