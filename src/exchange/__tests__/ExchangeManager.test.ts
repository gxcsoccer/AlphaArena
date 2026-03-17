import { ExchangeManager, resetExchangeManager } from '../ExchangeManager';
import { MockExchangeAdapter } from '../MockExchangeAdapter';
import { ExchangeConfig, OrderSide, OrderType, ConnectionStatus, ExchangeError } from '../types';

describe('ExchangeManager', () => {
  let manager: ExchangeManager;
  const testConfig: ExchangeConfig = { exchangeId: 'mock', apiKey: 'test-key', apiSecret: 'test-secret' };

  beforeEach(() => { manager = new ExchangeManager(); });
  afterEach(async () => { await manager.disconnect(); resetExchangeManager(); });

  describe('Registration', () => {
    it('should register an exchange adapter', () => { const a = new MockExchangeAdapter(); manager.registerExchange(a); expect(manager.registeredExchanges).toContain('mock'); });
    it('should throw error when registering duplicate exchange', () => { const a1 = new MockExchangeAdapter(); const a2 = new MockExchangeAdapter(); manager.registerExchange(a1); expect(() => manager.registerExchange(a2)).toThrow(ExchangeError); });
    it('should unregister an exchange', async () => { const a = new MockExchangeAdapter(); manager.registerExchange(a); await manager.unregisterExchange('mock'); expect(manager.registeredExchanges).not.toContain('mock'); });
  });

  describe('Connection', () => {
    it('should connect to a registered exchange', async () => { const a = new MockExchangeAdapter(); manager.registerExchange(a); await manager.connect('mock', testConfig); expect(manager.connectedExchanges).toContain('mock'); });
    it('should create built-in adapter when connecting', async () => { await manager.connect('mock', testConfig); expect(manager.registeredExchanges).toContain('mock'); });
    it('should disconnect from an exchange', async () => { await manager.connect('mock', testConfig); await manager.disconnect('mock'); expect(manager.connectedExchanges).not.toContain('mock'); });
    it('should disconnect all exchanges', async () => { await manager.connect('mock', testConfig); await manager.disconnect(); expect(manager.connectedExchanges.length).toBe(0); });
  });

  describe('Active Exchange', () => {
    beforeEach(async () => { await manager.connect('mock', testConfig); });
    it('should set first connected exchange as active', () => { expect(manager.activeExchangeId).toBe('mock'); });
    it('should get active exchange adapter', () => { const a = manager.getActiveExchange(); expect(a.exchangeId).toBe('mock'); });
    it('should throw error when no active exchange', async () => { await manager.disconnect(); expect(() => manager.getActiveExchange()).toThrow(ExchangeError); });
  });

  describe('Proxy Methods', () => {
    beforeEach(async () => { await manager.connect('mock', testConfig); });
    it('should get balance from active exchange', async () => { const b = await manager.getBalance(); expect(b).toHaveProperty('assets'); });
    it('should get ticker from active exchange', async () => { const t = await manager.getTicker('BTCUSDT'); expect(t.symbol).toBe('BTCUSDT'); });
    it('should place order on active exchange', async () => { const r = await manager.placeOrder({ symbol: 'BTCUSDT', side: OrderSide.BUY, type: OrderType.MARKET, quantity: 0.1 }); expect(r.orderId).toBeDefined(); });
  });

  describe('Status', () => {
    it('should get exchange status', async () => { await manager.connect('mock', testConfig); expect(manager.getExchangeStatus('mock')).toBe(ConnectionStatus.CONNECTED); });
    it('should check if exchange is connected', async () => { await manager.connect('mock', testConfig); expect(manager.isExchangeConnected('mock')).toBe(true); });
  });
});
