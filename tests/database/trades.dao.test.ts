// Mock the database client before importing
jest.mock('../../src/database/client', () => {
  const createMockQueryBuilder = (initialData: any[] = []) => {
    const data: any[] = [...initialData];
    
    const builder: any = {
      // Make the builder "thenable" so it can be awaited
      then: (resolve: (value: any) => void) => {
        return Promise.resolve({ data, error: null, count: data.length }).then(resolve);
      },
      // Also support catch and finally for Promise-like behavior
      catch: (reject: (reason: any) => void) => Promise.resolve({ data, error: null }).catch(reject),
      finally: (onFinally: () => void) => Promise.resolve({ data, error: null }).finally(onFinally),
    };

    builder.select = jest.fn().mockImplementation((columns?: string) => builder);
    builder.insert = jest.fn().mockImplementation((rows: any[]) => {
      const inserted = rows.map((row: any, i: number) => ({ id: `mock-id-${Date.now()}-${i}`, createdAt: new Date(), ...row }));
      data.push(...inserted);
      // Return a new builder that resolves with the inserted data
      return createMockQueryBuilder(inserted);
    });
    builder.update = jest.fn().mockImplementation((updates: any) => {
      Object.assign(data, updates);
      return builder;
    });
    builder.delete = jest.fn().mockImplementation(() => {
      data.length = 0;
      return builder;
    });
    builder.eq = jest.fn().mockImplementation((column: string, value: any) => builder);
    builder.neq = jest.fn().mockImplementation((column: string, value: any) => builder);
    builder.gt = jest.fn().mockImplementation((column: string, value: any) => builder);
    builder.gte = jest.fn().mockImplementation((column: string, value: any) => builder);
    builder.lt = jest.fn().mockImplementation((column: string, value: any) => builder);
    builder.lte = jest.fn().mockImplementation((column: string, value: any) => builder);
    builder.in = jest.fn().mockImplementation((column: string, values: any[]) => builder);
    builder.order = jest.fn().mockImplementation((column: string, options?: any) => builder);
    builder.limit = jest.fn().mockImplementation((count: number) => builder);
    builder.offset = jest.fn().mockImplementation((count: number) => builder);
    builder.range = jest.fn().mockImplementation((start: number, end: number) => builder);
    builder.single = jest.fn().mockImplementation(() => Promise.resolve({ data: data[0] || null, error: null }));
    builder.maybeSingle = jest.fn().mockImplementation(() => Promise.resolve({ data: data[0] || null, error: null }));
    builder.rpc = jest.fn().mockResolvedValue({ data: null, error: null });

    return builder;
  };

  const mockSupabaseClient = {
    from: jest.fn().mockImplementation((table: string) => createMockQueryBuilder()),
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  };

  return {
    getSupabaseClient: () => mockSupabaseClient,
    getSupabaseAdminClient: () => mockSupabaseClient,
    default: mockSupabaseClient,
  };
});

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
