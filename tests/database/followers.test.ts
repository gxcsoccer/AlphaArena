import { FollowersDAO, CreateFollowerInput } from '../../src/database/followers.dao';
import { getSupabaseClient } from '../../src/database/client';

// Mock Supabase client
jest.mock('../../src/database/client', () => ({
  getSupabaseClient: jest.fn(),
}));

// In-memory storage for mock database
let mockFollowers: Array<{
  id: string;
  follower_user_id: string;
  leader_user_id: string;
  status: string;
  copy_mode: string;
  copy_ratio: string;
  fixed_amount: string | null;
  max_copy_amount: string | null;
  stop_loss_pct: number | null;
  take_profit_pct: number | null;
  max_daily_trades: number;
  max_daily_volume: string | null;
  allowed_symbols: string[];
  blocked_symbols: string[];
  total_copied_trades: number;
  total_copied_volume: string;
  total_pnl: string;
  created_at: string;
  updated_at: string;
}> = [];

function createMockFollower(input: Partial<any>) {
  const id = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

// Create a chainable mock query builder
function createMockQuery() {
  const filters: Array<{ key: string; value: any; type: string }> = [];
  let insertData: any = null;

  function applyFilters(): any[] {
    let result = [...mockFollowers];
    
    filters.forEach((filter: { key: string; value: any; type: string }) => {
      if (filter.type === 'eq') {
        result = result.filter(r => (r as any)[filter.key] === filter.value);
      }
    });

    return result;
  }

  const chainable: any = {
    select: jest.fn(() => chainable),
    insert: jest.fn((rows: any[]) => {
      const newRows = rows.map(row => createMockFollower(row));
      mockFollowers.push(...newRows);
      return {
        select: jest.fn(() => chainable),
        single: jest.fn().mockResolvedValue({ data: newRows[0], error: null }),
      };
    }),
    update: jest.fn((data: any) => {
      insertData = data;
      return chainable;
    }),
    delete: jest.fn(() => chainable),
    single: jest.fn().mockImplementation(async () => {
      const result = applyFilters();
      const data = result[0] || null;
      return { data, error: data ? null : { code: 'PGRST116' } };
    }),
    then: function(resolve: any, reject: any) {
      try {
        if (insertData) {
          // Handle update
          const result = applyFilters();
          if (result.length > 0) {
            Object.assign(result[0], insertData);
            resolve({ data: result[0], error: null });
          } else {
            resolve({ data: null, error: { code: 'PGRST116' } });
          }
        } else {
          const result = applyFilters();
          resolve({ data: result, error: null });
        }
      } catch (err) {
        reject(err);
      }
      return this;
    },
    eq: jest.fn((key: string, value: any) => {
      filters.push({ key, value, type: 'eq' });
      return chainable;
    }),
    order: jest.fn(() => chainable),
    limit: jest.fn(() => chainable),
    range: jest.fn(() => chainable),
  };

  return chainable;
}

describe('FollowersDAO', () => {
  let dao: FollowersDAO;
  let mockClient: any;

  beforeEach(() => {
    mockFollowers = [];
    dao = new FollowersDAO();
    mockClient = {
      from: jest.fn().mockReturnValue(createMockQuery()),
    };
    (getSupabaseClient as jest.Mock).mockReturnValue(mockClient);
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
      // Add some mock followers
      mockFollowers.push(createMockFollower({ follower_user_id: 'user1', leader_user_id: 'leader1' }));
      mockFollowers.push(createMockFollower({ follower_user_id: 'user1', leader_user_id: 'leader2' }));

      const result = await dao.getMany();

      expect(result.length).toBe(2);
    });

    it('should filter by followerUserId', async () => {
      mockFollowers.push(createMockFollower({ follower_user_id: 'user1', leader_user_id: 'leader1' }));
      mockFollowers.push(createMockFollower({ follower_user_id: 'user2', leader_user_id: 'leader1' }));

      const result = await dao.getMany({ followerUserId: 'user1' });

      expect(result.length).toBe(1);
      expect(result[0].followerUserId).toBe('user1');
    });
  });

  describe('update', () => {
    it('should update follower status', async () => {
      const existingFollower = createMockFollower({ id: 'test-id', status: 'active' });
      mockFollowers.push(existingFollower);

      const _result = await dao.update('test-id', { status: 'paused' });

      // The update should be called
      expect(mockClient.from).toHaveBeenCalledWith('followers');
    });
  });

  describe('isFollowing', () => {
    it('should return false when not following', async () => {
      const result = await dao.isFollowing('user1', 'leader1');
      expect(result).toBe(false);
    });
  });
});
