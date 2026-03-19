import { MockExchangeAdapter } from '../MockExchangeAdapter';
import { ExchangeConfig, OrderSide, OrderType, OrderStatus, ConnectionStatus, ExchangeError } from '../types';

describe('MockExchangeAdapter', () => {
  let adapter: MockExchangeAdapter;
  const testConfig: ExchangeConfig = { exchangeId: 'mock', apiKey: 'test-key', apiSecret: 'test-secret' };

  beforeEach(() => { adapter = new MockExchangeAdapter(); });
  afterEach(async () => { if (adapter.status === ConnectionStatus.CONNECTED) await adapter.disconnect(); });

  describe('Connection', () => {
    it('should start in disconnected state', () => { expect(adapter.status).toBe(ConnectionStatus.DISCONNECTED); });
    it('should connect successfully', async () => { await adapter.connect(testConfig); expect(adapter.status).toBe(ConnectionStatus.CONNECTED); });
    it('should disconnect successfully', async () => { await adapter.connect(testConfig); await adapter.disconnect(); expect(adapter.status).toBe(ConnectionStatus.DISCONNECTED); });
    it('should fail connection without API key', async () => { await expect(adapter.connect({ ...testConfig, apiKey: '' })).rejects.toThrow(ExchangeError); });
  });

  describe('Balance', () => {
    beforeEach(async () => { await adapter.connect(testConfig); });
    it('should return account balance', async () => { const balance = await adapter.getBalance(); expect(balance).toHaveProperty('assets'); expect(Array.isArray(balance.assets)).toBe(true); });
    it('should include default assets', async () => { const balance = await adapter.getBalance(); const assets = balance.assets.map(a => a.asset); expect(assets).toContain('USDT'); expect(assets).toContain('BTC'); });
    it('should allow setting custom balance', async () => { adapter.setBalance('SOL', 100, 80, 20); const balance = await adapter.getBalance(); const sol = balance.assets.find(a => a.asset === 'SOL'); expect(sol).toEqual({ asset: 'SOL', total: 100, available: 80, locked: 20 }); });
  });

  describe('Ticker', () => {
    beforeEach(async () => { await adapter.connect(testConfig); });
    it('should return ticker for valid symbol', async () => { const ticker = await adapter.getTicker('BTCUSDT'); expect(ticker.symbol).toBe('BTCUSDT'); expect(ticker.last).toBeGreaterThan(0); });
    it('should throw error for invalid symbol', async () => { await expect(adapter.getTicker('INVALID')).rejects.toThrow(ExchangeError); });
    it('should have bid < ask', async () => { const ticker = await adapter.getTicker('ETHUSDT'); expect(ticker.bid).toBeLessThan(ticker.ask); });
  });

  describe('OrderBook', () => {
    beforeEach(async () => { await adapter.connect(testConfig); });
    it('should return order book for valid symbol', async () => { const ob = await adapter.getOrderBook('BTCUSDT'); expect(ob.symbol).toBe('BTCUSDT'); expect(ob.bids.length).toBeGreaterThan(0); expect(ob.asks.length).toBeGreaterThan(0); });
    it('should respect depth parameter', async () => { const ob = await adapter.getOrderBook('BTCUSDT', 10); expect(ob.bids.length).toBe(10); expect(ob.asks.length).toBe(10); });
  });

  describe('Orders', () => {
    beforeEach(async () => { await adapter.connect(testConfig); });
    it('should place a market order', async () => { const r = await adapter.placeOrder({ symbol: 'BTCUSDT', side: OrderSide.BUY, type: OrderType.MARKET, quantity: 0.1 }); expect(r.orderId).toBeDefined(); expect(r.status).toBe(OrderStatus.FILLED); });
    it('should place a limit order', async () => { const r = await adapter.placeOrder({ symbol: 'ETHUSDT', side: OrderSide.BUY, type: OrderType.LIMIT, quantity: 1, price: 2500 }); expect(r.orderId).toBeDefined(); expect(r.status).toBe(OrderStatus.NEW); });
    it('should require price for limit orders', async () => { await expect(adapter.placeOrder({ symbol: 'BTCUSDT', side: OrderSide.BUY, type: OrderType.LIMIT, quantity: 0.1 })).rejects.toThrow(ExchangeError); });
    it('should cancel an open order', async () => { const o = await adapter.placeOrder({ symbol: 'BTCUSDT', side: OrderSide.BUY, type: OrderType.LIMIT, quantity: 0.1, price: 40000 }); await adapter.cancelOrder(o.orderId, 'BTCUSDT'); const open = await adapter.getOpenOrders(); expect(open.find(x => x.orderId === o.orderId)).toBeUndefined(); });
    it('should get open orders', async () => { await adapter.placeOrder({ symbol: 'BTCUSDT', side: OrderSide.BUY, type: OrderType.LIMIT, quantity: 0.1, price: 40000 }); const orders = await adapter.getOpenOrders(); expect(orders.length).toBeGreaterThan(0); });
    it('should get order history', async () => { await adapter.placeOrder({ symbol: 'BTCUSDT', side: OrderSide.BUY, type: OrderType.MARKET, quantity: 0.1 }); const history = await adapter.getOrderHistory(); expect(history.length).toBeGreaterThan(0); });
  });

  describe('Subscriptions', () => {
    beforeEach(async () => { await adapter.connect(testConfig); });
    it('should subscribe to ticker updates', (done) => { adapter.subscribeToTicker('BTCUSDT', (t) => { expect(t.symbol).toBe('BTCUSDT'); adapter.unsubscribeFromTicker('BTCUSDT'); done(); }); });
    it('should subscribe to order book updates', (done) => { adapter.subscribeToOrderBook('BTCUSDT', (ob) => { expect(ob.symbol).toBe('BTCUSDT'); adapter.unsubscribeFromOrderBook('BTCUSDT'); done(); }); });
  });

  describe('Capabilities', () => {
    it('should return capabilities', () => { const caps = adapter.getCapabilities(); expect(caps.spot).toBe(true); expect(caps.margin).toBe(true); });
    it('should check feature support', () => { expect(adapter.supportsFeature('spot')).toBe(true); expect(adapter.supportsFeature('futures')).toBe(false); });
  });

  describe('Error Handling', () => {
    it('should throw error when not connected', async () => { await expect(adapter.getBalance()).rejects.toThrow(ExchangeError); });
  });

  describe('Custom Markets', () => {
    beforeEach(async () => { await adapter.connect(testConfig); });
    it('should add custom market', async () => { adapter.addMarket({ symbol: 'SOLUSDT', basePrice: 100, volatility: 0.04, tickSize: 0.01 }); const ticker = await adapter.getTicker('SOLUSDT'); expect(ticker.symbol).toBe('SOLUSDT'); });
  });
});
