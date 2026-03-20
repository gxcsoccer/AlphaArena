import { FollowersDAO, CreateFollowerInput } from '../../src/database/followers.dao';
import { seedMockData } from '../__mocks__/supabase';

// Use the shared Supabase mock
jest.mock('../../src/database/client');

// Create a mock follower row
function createMockFollowerRow(input: Partial<any> = {}) {
  const id = input.id || `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  return {
    id,
    follower_user_id: input.follower_user_id || 'user1',
    leader_user_id: input.leader_user_id || 'leader1',
    status: input.status || 'active',
    copy_mode: input.copy_mode || 'proportional',
    copy_ratio: input.copy_ratio || '1.0',
    fixed_amount: input.fixed_amount || null,
    max_copy_amount: input.max_copy_amount || null,
    stop_loss_pct: input.stop_loss_pct || null,
    take_profit_pct: input.take_profit_pct || null,
    max_daily_trades: input.max_daily_trades || 10,
    max_daily_volume: input.max_daily_volume || null,
    allowed_symbols: input.allowed_symbols || [],
    blocked_symbols: input.blocked_symbols || [],
    total_copied_trades: input.total_copied_trades || 0,
    total_copied_volume: input.total_copied_volume || '0',
    total_pnl: input.total_pnl || '0',
    created_at: now,
    updated_at: now,
  };
}

describe('FollowersDAO', () => {
  let dao: FollowersDAO;

  beforeEach(() => {
    dao = new FollowersDAO();
  });

  describe('create', () => {
    it('should create a new follower relationship', async () => {
      const input: CreateFollowerInput = {
        followerUserId: 'user1',
        leaderUserId: 'leader1',
      };

      const result = await dao.create(input);

      expect(result).toBeDefined();
      expect(result.followerUserId).toBe('user1');
      expect(result.leaderUserId).toBe('leader1');
      expect(result.status).toBe('active');
    });

    it('should create follower with custom settings', async () => {
      const input: CreateFollowerInput = {
        followerUserId: 'user1',
        leaderUserId: 'leader1',
        settings: {
          copyMode: 'fixed',
          copyRatio: 0.5,
          fixedAmount: 100,
          maxDailyTrades: 5,
          allowedSymbols: ['BTCUSDT'],
          blockedSymbols: [],
        },
      };

      const result = await dao.create(input);

      expect(result.settings.copyMode).toBe('fixed');
      expect(result.settings.copyRatio).toBe(0.5);
      expect(result.settings.fixedAmount).toBe(100);
    });
  });

  describe('getById', () => {
    it('should return null for non-existent follower', async () => {
      const result = await dao.getById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getMany', () => {
    it('should return all followers when no filters', async () => {
      // Seed the mock data
      seedMockData('followers', [
        createMockFollowerRow({ follower_user_id: 'user1', leader_user_id: 'leader1' }),
        createMockFollowerRow({ follower_user_id: 'user1', leader_user_id: 'leader2' }),
      ]);

      const result = await dao.getMany();

      expect(result.length).toBe(2);
    });

    it('should filter by followerUserId', async () => {
      seedMockData('followers', [
        createMockFollowerRow({ follower_user_id: 'user1', leader_user_id: 'leader1' }),
        createMockFollowerRow({ follower_user_id: 'user2', leader_user_id: 'leader1' }),
      ]);

      const result = await dao.getMany({ followerUserId: 'user1' });

      expect(result.length).toBe(1);
      expect(result[0].followerUserId).toBe('user1');
    });
  });

  describe('update', () => {
    it('should update follower status', async () => {
      const existingFollower = createMockFollowerRow({ status: 'active' });
      seedMockData('followers', [existingFollower]);

      const result = await dao.update(existingFollower.id, { status: 'paused' });

      expect(result).toBeDefined();
      expect(result.status).toBe('paused');
    });
  });

  describe('isFollowing', () => {
    it('should return false when not following', async () => {
      const result = await dao.isFollowing('user1', 'leader1');
      expect(result).toBe(false);
    });
  });
});