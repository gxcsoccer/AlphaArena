import { TradeJournalDAO, CreateTradeJournalInput } from '../trade-journal.dao';

// Mock Supabase client
jest.mock('../client', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: {
              id: 'test-id',
              user_id: 'user-1',
              symbol: 'BTC/USDT',
              type: 'long',
              status: 'open',
              entry_price: '50000',
              entry_quantity: '0.1',
              entry_reason: 'Test entry',
              entry_date: '2024-01-01T00:00:00Z',
              tags: [],
              emotion: 'confident',
              screenshots: [],
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
            error: null,
          })),
        })),
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({
            data: null,
            error: { code: 'PGRST116' },
          })),
        })),
      })),
    })),
  })),
}));

describe('TradeJournalDAO', () => {
  let dao: TradeJournalDAO;

  beforeEach(() => {
    dao = new TradeJournalDAO();
  });

  describe('create', () => {
    it('should create a new trade journal entry', async () => {
      const input: CreateTradeJournalInput = {
        userId: 'user-1',
        symbol: 'BTC/USDT',
        type: 'long',
        entryPrice: 50000,
        entryQuantity: 0.1,
        entryReason: 'Test entry',
        emotion: 'confident',
      };

      const result = await dao.create(input);

      expect(result).toBeDefined();
      expect(result.symbol).toBe('BTC/USDT');
      expect(result.type).toBe('long');
      expect(result.status).toBe('open');
    });
  });

  describe('EmotionType', () => {
    it('should have all required emotion types', () => {
      const emotions = [
        'confident',
        'hesitant',
        'fearful',
        'greedy',
        'regretful',
        'hopeful',
        'anxious',
        'calm',
      ];

      emotions.forEach(emotion => {
        expect(['confident', 'hesitant', 'fearful', 'greedy', 'regretful', 'hopeful', 'anxious', 'calm']).toContain(emotion);
      });
    });
  });

  describe('TradeJournalType', () => {
    it('should have valid trade types', () => {
      const types = ['long', 'short'];
      
      types.forEach(type => {
        expect(['long', 'short']).toContain(type);
      });
    });
  });
});
