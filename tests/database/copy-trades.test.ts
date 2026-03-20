import { CopyTradesDAO, CreateCopyTradeInput } from '../../src/database/copy-trades.dao';
import { seedMockData } from '../__mocks__/supabase';

// Use the shared Supabase mock
jest.mock('../../src/database/client');

describe('CopyTradesDAO', () => {
  let dao: CopyTradesDAO;

  // Helper to create mock copy trade row
  function createMockCopyTradeRow(overrides: Partial<any> = {}) {
    const id = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    return {
      id,
      follower_id: 'follower1',
      original_trade_id: null,
      original_order_id: null,
      leader_user_id: 'leader1',
      follower_user_id: 'user1',
      symbol: 'BTCUSDT',
      side: 'buy',
      original_quantity: '1.0',
      copied_quantity: '0.5',
      original_price: '50000',
      copied_price: null,
      status: 'pending',
      error: null,
      retry_count: 0,
      copied_order_id: null,
      copied_trade_id: null,
      fee: '0',
      fee_currency: null,
      signal_received_at: now,
      executed_at: null,
      completed_at: null,
      created_at: now,
      ...overrides,
    };
  }

  beforeEach(() => {
    dao = new CopyTradesDAO();
  });

  describe('create', () => {
    it('should create a new copy trade', async () => {
      const input: CreateCopyTradeInput = {
        followerId: 'follower1',
        leaderUserId: 'leader1',
        followerUserId: 'user1',
        symbol: 'BTCUSDT',
        side: 'buy',
        originalQuantity: 1.0,
        copiedQuantity: 0.5,
        originalPrice: 50000,
        signalReceivedAt: new Date(),
      };

      const result = await dao.create(input);

      expect(result).toBeDefined();
      expect(result.followerId).toBe('follower1');
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.side).toBe('buy');
      expect(result.status).toBe('pending');
    });
  });

  describe('getById', () => {
    it('should return null for non-existent copy trade', async () => {
      const result = await dao.getById('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return copy trade by id', async () => {
      const trade = createMockCopyTradeRow({ id: 'test-id' });
      seedMockData('copy_trades', [trade]);

      const result = await dao.getById('test-id');
      expect(result).toBeDefined();
      expect(result?.id).toBe('test-id');
    });
  });

  describe('getMany', () => {
    it('should return all copy trades when no filters', async () => {
      seedMockData('copy_trades', [
        createMockCopyTradeRow({ follower_user_id: 'user1' }),
        createMockCopyTradeRow({ follower_user_id: 'user2' }),
      ]);

      const result = await dao.getMany();

      expect(result.length).toBe(2);
    });

    it('should filter by followerUserId', async () => {
      seedMockData('copy_trades', [
        createMockCopyTradeRow({ follower_user_id: 'user1' }),
        createMockCopyTradeRow({ follower_user_id: 'user2' }),
      ]);

      const result = await dao.getMany({ followerUserId: 'user1' });

      expect(result.length).toBe(1);
      expect(result[0].followerUserId).toBe('user1');
    });

    it('should filter by status', async () => {
      seedMockData('copy_trades', [
        createMockCopyTradeRow({ status: 'pending' }),
        createMockCopyTradeRow({ status: 'filled' }),
      ]);

      const result = await dao.getMany({ status: 'pending' });

      expect(result.length).toBe(1);
      expect(result[0].status).toBe('pending');
    });
  });

  describe('updateStatus', () => {
    it('should update copy trade status', async () => {
      const trade = createMockCopyTradeRow({ status: 'pending' });
      seedMockData('copy_trades', [trade]);

      const result = await dao.updateStatus(trade.id, 'filled');

      expect(result.status).toBe('filled');
    });
  });

  describe('getPending', () => {
    it('should return pending trades', async () => {
      seedMockData('copy_trades', [
        createMockCopyTradeRow({ status: 'pending' }),
        createMockCopyTradeRow({ status: 'filled' }),
      ]);

      const result = await dao.getPending();

      expect(result.length).toBe(1);
      expect(result[0].status).toBe('pending');
    });
  });

  describe('incrementRetry', () => {
    it('should increment retry count', async () => {
      const trade = createMockCopyTradeRow({ retry_count: 0 });
      seedMockData('copy_trades', [trade]);

      const result = await dao.incrementRetry(trade.id);

      expect(result.retryCount).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return stats', async () => {
      seedMockData('copy_trades', [
        createMockCopyTradeRow({ status: 'filled', copied_quantity: '0.5' }),
        createMockCopyTradeRow({ status: 'failed', copied_quantity: '0.3' }),
      ]);

      const stats = await dao.getStats();

      expect(stats.totalTrades).toBe(2);
      expect(stats.filledTrades).toBe(1);
      expect(stats.failedTrades).toBe(1);
    });
  });
});