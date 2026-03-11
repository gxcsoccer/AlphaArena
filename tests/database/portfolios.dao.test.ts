import { PortfoliosDAO } from '../../src/database/portfolios.dao';

describe('PortfoliosDAO', () => {
  let dao: PortfoliosDAO;

  beforeAll(() => {
    dao = new PortfoliosDAO();
  });

  describe('createSnapshot', () => {
    it('should create a portfolio snapshot', async () => {
      const snapshot = await dao.createSnapshot({
        symbol: 'BTC/USDT',
        baseCurrency: 'BTC',
        quoteCurrency: 'USDT',
        baseBalance: 1.5,
        quoteBalance: 10000,
        totalValue: 85000,
        snapshotAt: new Date()
      });

      expect(snapshot.id).toBeDefined();
      expect(snapshot.symbol).toBe('BTC/USDT');
      expect(snapshot.baseBalance).toBe(1.5);
      expect(snapshot.quoteBalance).toBe(10000);
      expect(snapshot.totalValue).toBe(85000);
    });

    it('should create snapshot with strategy reference', async () => {
      const snapshot = await dao.createSnapshot({
        strategyId: 'test-strategy-id',
        symbol: 'ETH/USDT',
        baseCurrency: 'ETH',
        quoteCurrency: 'USDT',
        baseBalance: 10,
        quoteBalance: 5000,
        snapshotAt: new Date()
      });

      expect(snapshot.strategyId).toBe('test-strategy-id');
    });
  });

  describe('getLatest', () => {
    it('should retrieve latest snapshot', async () => {
      const now = new Date();
      
      await dao.createSnapshot({
        symbol: 'TEST/USDT',
        baseCurrency: 'TEST',
        quoteCurrency: 'USDT',
        baseBalance: 100,
        quoteBalance: 1000,
        snapshotAt: new Date(now.getTime() - 10000)
      });

      await dao.createSnapshot({
        symbol: 'TEST/USDT',
        baseCurrency: 'TEST',
        quoteCurrency: 'USDT',
        baseBalance: 150,
        quoteBalance: 1500,
        snapshotAt: now
      });

      const retrieved = await dao.getLatest('TEST/USDT');

      expect(retrieved).not.toBeNull();
      expect(retrieved!.baseBalance).toBe(150);
    });

    it('should return null for non-existent symbol', async () => {
      const result = await dao.getLatest('NONEXISTENT/USDT');
      expect(result).toBeNull();
    });
  });

  describe('getMany', () => {
    it('should filter snapshots by symbol', async () => {
      const snapshots = await dao.getMany({ symbol: 'BTC/USDT', limit: 10 });
      
      expect(Array.isArray(snapshots)).toBe(true);
      if (snapshots.length > 0) {
        expect(snapshots.every(s => s.symbol === 'BTC/USDT')).toBe(true);
      }
    });

    it('should respect limit parameter', async () => {
      const snapshots = await dao.getMany({ limit: 5 });
      
      expect(snapshots.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getHistory', () => {
    it('should get portfolio history for a strategy', async () => {
      const history = await dao.getHistory('test-strategy', 100);
      
      expect(Array.isArray(history)).toBe(true);
    });
  });
});
