/**
 * Tests for VirtualAccountDAO
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  delete: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  single: vi.fn(),
  order: vi.fn(() => mockSupabase),
  limit: vi.fn(() => mockSupabase),
  range: vi.fn(() => mockSupabase),
  gt: vi.fn(() => mockSupabase),
  gte: vi.fn(() => mockSupabase),
  lte: vi.fn(() => mockSupabase),
  in: vi.fn(() => mockSupabase),
  upsert: vi.fn(() => mockSupabase),
};

vi.mock('./client', () => ({
  getSupabaseClient: () => mockSupabase,
}));

describe('VirtualAccountDAO', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAccount', () => {
    it('should create a new virtual account', async () => {
      const mockAccount = {
        id: 'test-account-id',
        user_id: 'test-user',
        balance: 100000,
        initial_capital: 100000,
        frozen_balance: 0,
        total_realized_pnl: 0,
        total_trades: 0,
        winning_trades: 0,
        losing_trades: 0,
        account_currency: 'USD',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockSupabase.single.mockResolvedValueOnce({ data: mockAccount, error: null });
      mockSupabase.insert.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);

      const { VirtualAccountDAO } = await import('./virtual-account.dao');
      const account = await VirtualAccountDAO.createAccount({
        user_id: 'test-user',
        initial_capital: 100000,
      });

      expect(account).toEqual(mockAccount);
      expect(mockSupabase.from).toHaveBeenCalledWith('virtual_accounts');
    });
  });

  describe('getAccountByUserId', () => {
    it('should return account for existing user', async () => {
      const mockAccount = {
        id: 'test-account-id',
        user_id: 'test-user',
        balance: 100000,
        initial_capital: 100000,
      };

      mockSupabase.single.mockResolvedValueOnce({ data: mockAccount, error: null });

      const { VirtualAccountDAO } = await import('./virtual-account.dao');
      const account = await VirtualAccountDAO.getAccountByUserId('test-user');

      expect(account).toEqual(mockAccount);
    });

    it('should return null for non-existent user', async () => {
      mockSupabase.single.mockResolvedValueOnce({ 
        data: null, 
        error: { code: 'PGRST116' } 
      });

      const { VirtualAccountDAO } = await import('./virtual-account.dao');
      const account = await VirtualAccountDAO.getAccountByUserId('non-existent');

      expect(account).toBeNull();
    });
  });

  describe('getPositions', () => {
    it('should return all positions for an account', async () => {
      const mockPositions = [
        {
          id: 'pos-1',
          account_id: 'test-account-id',
          symbol: 'AAPL',
          quantity: 10,
          available_quantity: 10,
          average_cost: 150,
          total_cost: 1500,
        },
        {
          id: 'pos-2',
          account_id: 'test-account-id',
          symbol: 'GOOGL',
          quantity: 5,
          available_quantity: 5,
          average_cost: 140,
          total_cost: 700,
        },
      ];

      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);
      mockSupabase.gt.mockReturnValue(mockSupabase);
      mockSupabase.order.mockResolvedValueOnce({ data: mockPositions, error: null });

      const { VirtualAccountDAO } = await import('./virtual-account.dao');
      const positions = await VirtualAccountDAO.getPositions('test-account-id');

      expect(positions).toEqual(mockPositions);
    });
  });

  describe('createTransaction', () => {
    it('should create a transaction record', async () => {
      const mockTransaction = {
        id: 'tx-1',
        account_id: 'test-account-id',
        type: 'buy',
        amount: -1500,
        balance_after: 98500,
        symbol: 'AAPL',
        quantity: 10,
        price: 150,
        description: 'Bought 10 AAPL @ 150',
        created_at: new Date().toISOString(),
      };

      mockSupabase.single.mockResolvedValueOnce({ data: mockTransaction, error: null });

      const { VirtualAccountDAO } = await import('./virtual-account.dao');
      const transaction = await VirtualAccountDAO.createTransaction({
        account_id: 'test-account-id',
        type: 'buy',
        amount: -1500,
        balance_after: 98500,
        symbol: 'AAPL',
        quantity: 10,
        price: 150,
        description: 'Bought 10 AAPL @ 150',
      });

      expect(transaction).toEqual(mockTransaction);
    });
  });

  describe('createOrder', () => {
    it('should create a new order', async () => {
      const mockOrder = {
        id: 'order-1',
        account_id: 'test-account-id',
        symbol: 'AAPL',
        side: 'buy',
        order_type: 'limit',
        quantity: 10,
        filled_quantity: 0,
        remaining_quantity: 10,
        price: 145,
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      mockSupabase.single.mockResolvedValueOnce({ data: mockOrder, error: null });

      const { VirtualAccountDAO } = await import('./virtual-account.dao');
      const order = await VirtualAccountDAO.createOrder({
        account_id: 'test-account-id',
        symbol: 'AAPL',
        side: 'buy',
        order_type: 'limit',
        quantity: 10,
        price: 145,
      });

      expect(order).toEqual(mockOrder);
    });
  });
});