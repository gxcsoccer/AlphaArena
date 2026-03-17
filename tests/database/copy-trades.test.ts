import { CopyTradesDAO, CopyTrade, CreateCopyTradeInput } from '../../src/database/copy-trades.dao';
import { getSupabaseClient } from '../../src/database/client';

// Mock Supabase client
jest.mock('../../src/database/client', () => ({
  getSupabaseClient: jest.fn(),
}));

// In-memory storage for mock database
let mockCopyTrades: Array<{
  id: string;
  follower_id: string;
  original_trade_id: string | null;
  original_order_id: string | null;
  leader_user_id: string;
  follower_user_id: string;
  symbol: string;
  side: string;
  original_quantity: string;
  copied_quantity: string;
  original_price: string;
  copied_price: string | null;
  status: string;
  error: string | null;
  retry_count: number;
  copied_order_id: string | null;
  copied_trade_id: string | null;
  fee: string;
  fee_currency: string | null;
  signal_received_at: string;
  executed_at: string | null;
  completed_at: string | null;
  created_at: string;
}> = [];

function createMockCopyTrade(input: Partial<any>) {
  const id = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  return {
    id,
    follower_id: input.follower_id || 'follower1',
    original_trade_id: input.original_trade_id || null,
    original_order_id: input.original_order_id || null,
    leader_user_id: input.leader_user_id || 'leader1',
    follower_user_id: input.follower_user_id || 'user1',
    symbol: input.symbol || 'BTCUSDT',
    side: input.side || 'buy',
    original_quantity: input.original_quantity || '1.0',
    copied_quantity: input.copied_quantity || '0.5',
    original_price: input.original_price || '50000',
    copied_price: input.copied_price || null,
    status: input.status || 'pending',
    error: input.error || null,
    retry_count: input.retry_count || 0,
    copied_order_id: input.copied_order_id || null,
    copied_trade_id: input.copied_trade_id || null,
    fee: input.fee || '0',
    fee_currency: input.fee_currency || null,
    signal_received_at: input.signal_received_at || now,
    executed_at: input.executed_at || null,
    completed_at: input.completed_at || null,
    created_at: now,
  };
}

// Create a chainable mock query builder
function createMockQuery() {
  const filters: Array<{ key: string; value: any; type: string }> = [];
  let insertData: any = null;

  function applyFilters(): any[] {
    let result = [...mockCopyTrades];
    
    filters.forEach((filter: { key: string; value: any; type: string }) => {
      if (filter.type === 'eq') {
        result = result.filter(r => (r as any)[filter.key] === filter.value);
      } else if (filter.type === 'gte') {
        result = result.filter(r => (r as any)[filter.key] >= filter.value);
      }
    });

    return result;
  }

  const chainable: any = {
    select: jest.fn(() => chainable),
    insert: jest.fn((rows: any[]) => {
      const newRows = rows.map(row => createMockCopyTrade(row));
      mockCopyTrades.push(...newRows);
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
    gte: jest.fn((key: string, value: any) => {
      filters.push({ key, value, type: 'gte' });
      return chainable;
    }),
    order: jest.fn(() => chainable),
    limit: jest.fn(() => chainable),
    range: jest.fn(() => chainable),
  };

  return chainable;
}

describe('CopyTradesDAO', () => {
  let dao: CopyTradesDAO;
  let mockClient: any;

  beforeEach(() => {
    mockCopyTrades = [];
    dao = new CopyTradesDAO();
    mockClient = {
      from: jest.fn().mockReturnValue(createMockQuery()),
    };
    (getSupabaseClient as jest.Mock).mockReturnValue(mockClient);
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
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.side).toBe('buy');
      expect(result.status).toBe('pending');
    });
  });

  describe('getById', () => {
    it('should return null for non-existent copy trade', async () => {
      const result = await dao.getById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getMany', () => {
    it('should return copy trades with filters', async () => {
      mockCopyTrades.push(createMockCopyTrade({ symbol: 'BTCUSDT', side: 'buy' }));
      mockCopyTrades.push(createMockCopyTrade({ symbol: 'ETHUSDT', side: 'sell' }));

      const result = await dao.getMany({ symbol: 'BTCUSDT' });

      expect(result.length).toBe(1);
      expect(result[0].symbol).toBe('BTCUSDT');
    });
  });

  describe('getStats', () => {
    it('should return statistics for copy trades', async () => {
      mockCopyTrades.push(createMockCopyTrade({ status: 'filled', side: 'buy' }));
      mockCopyTrades.push(createMockCopyTrade({ status: 'pending', side: 'sell' }));
      mockCopyTrades.push(createMockCopyTrade({ status: 'failed', side: 'buy' }));

      const result = await dao.getStats();

      expect(result.totalTrades).toBe(3);
      expect(result.filledTrades).toBe(1);
      expect(result.pendingTrades).toBe(1);
      expect(result.failedTrades).toBe(1);
    });
  });
});
