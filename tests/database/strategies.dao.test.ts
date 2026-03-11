import { StrategiesDAO } from '../../src/database/strategies.dao';

describe('StrategiesDAO', () => {
  let dao: StrategiesDAO;

  beforeAll(() => {
    dao = new StrategiesDAO();
  });

  describe('create', () => {
    it('should create a new strategy', async () => {
      const strategy = await dao.create(
        'Test Strategy',
        'BTC/USDT',
        'A test trading strategy',
        { threshold: 0.5 }
      );

      expect(strategy.id).toBeDefined();
      expect(strategy.name).toBe('Test Strategy');
      expect(strategy.symbol).toBe('BTC/USDT');
      expect(strategy.status).toBe('active');
      expect(strategy.config).toEqual({ threshold: 0.5 });

      // Cleanup
      await dao.delete(strategy.id);
    });

    it('should create strategy with default values', async () => {
      const strategy = await dao.create('Simple Strategy', 'ETH/USDT');

      expect(strategy.name).toBe('Simple Strategy');
      expect(strategy.symbol).toBe('ETH/USDT');
      expect(strategy.status).toBe('active');
      expect(strategy.config).toEqual({});

      await dao.delete(strategy.id);
    });
  });

  describe('getById', () => {
    it('should retrieve strategy by ID', async () => {
      const created = await dao.create('Get Test', 'BTC/USDT');
      const retrieved = await dao.getById(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.name).toBe('Get Test');

      await dao.delete(created.id);
    });

    it('should return null for non-existent ID', async () => {
      const result = await dao.getById('00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    });
  });

  describe('getActive', () => {
    it('should return only active strategies', async () => {
      const active1 = await dao.create('Active 1', 'BTC/USDT');
      const active2 = await dao.create('Active 2', 'ETH/USDT');
      const paused = await dao.create('Paused', 'XRP/USDT');
      
      await dao.updateStatus(paused.id, 'paused');

      const activeStrategies = await dao.getActive();
      
      expect(activeStrategies.length).toBeGreaterThanOrEqual(2);
      expect(activeStrategies.every(s => s.status === 'active')).toBe(true);

      await dao.delete(active1.id);
      await dao.delete(active2.id);
      await dao.delete(paused.id);
    });
  });

  describe('updateStatus', () => {
    it('should update strategy status', async () => {
      const strategy = await dao.create('Status Test', 'BTC/USDT');
      
      const updated = await dao.updateStatus(strategy.id, 'paused');
      
      expect(updated.status).toBe('paused');

      const stopped = await dao.updateStatus(strategy.id, 'stopped');
      expect(stopped.status).toBe('stopped');

      await dao.delete(strategy.id);
    });
  });

  describe('updateConfig', () => {
    it('should update strategy config', async () => {
      const strategy = await dao.create('Config Test', 'BTC/USDT');
      
      const updated = await dao.updateConfig(strategy.id, {
        threshold: 0.8,
        maxTrades: 10
      });
      
      expect(updated.config).toEqual({
        threshold: 0.8,
        maxTrades: 10
      });

      await dao.delete(strategy.id);
    });
  });
});
