import { TradesDAO } from '../../src/database/trades.dao';
import { StrategiesDAO } from '../../src/database/strategies.dao';

describe('TradesDAO', () => {
  let tradesDao: TradesDAO;
  let strategiesDao: StrategiesDAO;

  beforeAll(() => {
    tradesDao = new TradesDAO();
    strategiesDao = new StrategiesDAO();
  });

  describe('create', () => {
    it('should create a new trade', async () => {
      const trade = await tradesDao.create({
        symbol: 'BTC/USDT',
        side: 'buy',
        price: 50000,
        quantity: 0.1,
        total: 5000,
        fee: 5,
        feeCurrency: 'USDT',
        executedAt: new Date(),
      });

      expect(trade.id).toBeDefined();
      expect(trade.symbol).toBe('BTC/USDT');
      expect(trade.side).toBe('buy');
      expect(trade.price).toBe(50000);
      expect(trade.quantity).toBe(0.1);
      expect(trade.total).toBe(5000);
    });

    it('should create trade with strategy reference', async () => {
      const strategy = await strategiesDao.create('Trade Test Strategy', 'BTC/USDT');

      const trade = await tradesDao.create({
        strategyId: strategy.id,
        symbol: 'BTC/USDT',
        side: 'sell',
        price: 51000,
        quantity: 0.05,
        total: 2550,
        executedAt: new Date(),
      });

      expect(trade.strategyId).toBe(strategy.id);

      await strategiesDao.delete(strategy.id);
    });
  });

  describe('getById', () => {
    it('should retrieve trade by ID', async () => {
      const created = await tradesDao.create({
        symbol: 'ETH/USDT',
        side: 'buy',
        price: 3000,
        quantity: 1,
        total: 3000,
        executedAt: new Date(),
      });

      const retrieved = await tradesDao.getById(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.symbol).toBe('ETH/USDT');
    });
  });

  describe('getMany', () => {
    it('should filter trades by symbol', async () => {
      const now = new Date();

      await tradesDao.create({
        symbol: 'BTC/USDT',
        side: 'buy',
        price: 50000,
        quantity: 0.1,
        total: 5000,
        executedAt: now,
      });

      await tradesDao.create({
        symbol: 'BTC/USDT',
        side: 'sell',
        price: 51000,
        quantity: 0.1,
        total: 5100,
        executedAt: now,
      });

      const btcTrades = await tradesDao.getMany({ symbol: 'BTC/USDT', limit: 10 });

      expect(btcTrades.length).toBeGreaterThanOrEqual(2);
      expect(btcTrades.every((t) => t.symbol === 'BTC/USDT')).toBe(true);
    });

    it('should filter trades by side', async () => {
      const now = new Date();

      await tradesDao.create({
        symbol: 'ETH/USDT',
        side: 'buy',
        price: 3000,
        quantity: 1,
        total: 3000,
        executedAt: now,
      });

      const buyTrades = await tradesDao.getMany({ side: 'buy', limit: 10 });

      expect(buyTrades.every((t) => t.side === 'buy')).toBe(true);
    });

    it('should filter trades by date range', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1);

      const trades = await tradesDao.getMany({
        startDate,
        endDate,
        limit: 100,
      });

      expect(Array.isArray(trades)).toBe(true);
    });
  });

  describe('getByStrategy', () => {
    it('should get trades for a specific strategy', async () => {
      const strategy = await strategiesDao.create('Strategy Trades Test', 'BTC/USDT');

      await tradesDao.create({
        strategyId: strategy.id,
        symbol: 'BTC/USDT',
        side: 'buy',
        price: 50000,
        quantity: 0.1,
        total: 5000,
        executedAt: new Date(),
      });

      const strategyTrades = await tradesDao.getByStrategy(strategy.id);

      expect(strategyTrades.length).toBeGreaterThanOrEqual(1);
      expect(strategyTrades.every((t) => t.strategyId === strategy.id)).toBe(true);

      await strategiesDao.delete(strategy.id);
    });
  });

  describe('getStats', () => {
    it('should return trade statistics', async () => {
      const stats = await tradesDao.getStats();

      expect(stats).toHaveProperty('totalTrades');
      expect(stats).toHaveProperty('totalVolume');
      expect(stats).toHaveProperty('buyCount');
      expect(stats).toHaveProperty('sellCount');
      expect(stats.totalTrades).toBe(stats.buyCount + stats.sellCount);
    });
  });
});
