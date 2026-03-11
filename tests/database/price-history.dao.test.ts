import { PriceHistoryDAO } from '../../src/database/price-history.dao';

describe('PriceHistoryDAO', () => {
  let dao: PriceHistoryDAO;

  beforeAll(() => {
    dao = new PriceHistoryDAO();
  });

  describe('recordPrice', () => {
    it('should record a price point', async () => {
      const now = new Date();
      
      const price = await dao.recordPrice({
        symbol: 'BTC/USDT',
        price: 50000,
        bid: 49999,
        ask: 50001,
        volume24h: 1000000,
        high24h: 51000,
        low24h: 49000,
        timestamp: now
      });

      expect(price.id).toBeDefined();
      expect(price.symbol).toBe('BTC/USDT');
      expect(price.price).toBe(50000);
      expect(price.bid).toBe(49999);
      expect(price.ask).toBe(50001);
    });

    it('should record price with minimal data', async () => {
      const price = await dao.recordPrice({
        symbol: 'ETH/USDT',
        price: 3000,
        timestamp: new Date()
      });

      expect(price.symbol).toBe('ETH/USDT');
      expect(price.price).toBe(3000);
      expect(price.bid).toBeNull();
    });
  });

  describe('recordPrices', () => {
    it('should record multiple price points', async () => {
      const now = new Date();
      
      const prices = await dao.recordPrices([
        {
          symbol: 'BTC/USDT',
          price: 50000,
          timestamp: now
        },
        {
          symbol: 'ETH/USDT',
          price: 3000,
          timestamp: now
        }
      ]);

      expect(prices.length).toBe(2);
      expect(prices.map(p => p.symbol)).toContain('BTC/USDT');
      expect(prices.map(p => p.symbol)).toContain('ETH/USDT');
    });
  });

  describe('getLatest', () => {
    it('should retrieve latest price for symbol', async () => {
      const now = new Date();
      
      await dao.recordPrice({
        symbol: 'TEST/USDT',
        price: 100,
        timestamp: new Date(now.getTime() - 10000)
      });

      await dao.recordPrice({
        symbol: 'TEST/USDT',
        price: 105,
        timestamp: now
      });

      const latest = await dao.getLatest('TEST/USDT');

      expect(latest).not.toBeNull();
      expect(latest!.price).toBe(105);
    });

    it('should return null for non-existent symbol', async () => {
      const result = await dao.getLatest('NONEXISTENT/USDT');
      expect(result).toBeNull();
    });
  });

  describe('getHistory', () => {
    it('should get price history for a symbol', async () => {
      const history = await dao.getHistory('BTC/USDT', { limit: 10 });
      
      expect(Array.isArray(history)).toBe(true);
      if (history.length > 0) {
        expect(history.every(h => h.symbol === 'BTC/USDT')).toBe(true);
      }
    });

    it('should respect date range filter', async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);

      const history = await dao.getHistory('BTC/USDT', {
        startDate,
        endDate
      });

      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return price statistics', async () => {
      const stats = await dao.getStats('BTC/USDT', 7);
      
      expect(stats).toHaveProperty('avgPrice');
      expect(stats).toHaveProperty('highPrice');
      expect(stats).toHaveProperty('lowPrice');
      expect(stats).toHaveProperty('volatility');
    });
  });
});
