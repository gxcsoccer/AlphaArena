/**
 * Tests for VirtualAccountService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the database and data source modules
vi.mock('../database/virtual-account.dao', () => ({
  VirtualAccountDAO: {
    getOrCreateAccount: vi.fn(),
    getAccountSummary: vi.fn(),
    getPositions: vi.fn(),
    getPosition: vi.fn(),
    getOrders: vi.fn(),
    getOrder: vi.fn(),
    createOrder: vi.fn(),
    updateOrder: vi.fn(),
    updateAccount: vi.fn(),
    upsertPosition: vi.fn(),
    updatePosition: vi.fn(),
    deletePosition: vi.fn(),
    createTransaction: vi.fn(),
    getTransactions: vi.fn(),
    resetAccount: vi.fn(),
    getValueHistory: vi.fn(),
    updatePositionPrices: vi.fn(),
  },
}));

vi.mock('../datasource/DataSourceManager', () => ({
  DataSourceManager: {
    getInstance: vi.fn(() => ({
      getQuote: vi.fn(),
      getQuotes: vi.fn(),
    })),
  },
}));

describe('VirtualAccountService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAccount', () => {
    it('should get or create account for user', async () => {
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

      const { VirtualAccountDAO } = await import('../database/virtual-account.dao');
      (VirtualAccountDAO.getOrCreateAccount as any).mockResolvedValue(mockAccount);

      const { VirtualAccountService } = await import('../services/VirtualAccountService');
      const service = VirtualAccountService.getInstance();
      const account = await service.getAccount('test-user');

      expect(account).toEqual(mockAccount);
      expect(VirtualAccountDAO.getOrCreateAccount).toHaveBeenCalledWith('test-user');
    });
  });

  describe('getAccountSummary', () => {
    it('should return account summary with positions', async () => {
      const mockSummary = {
        account: {
          id: 'test-account-id',
          user_id: 'test-user',
          balance: 90000,
          initial_capital: 100000,
          frozen_balance: 0,
          total_realized_pnl: 1000,
          total_trades: 10,
          winning_trades: 6,
          losing_trades: 4,
          account_currency: 'USD',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        positions: [
          {
            id: 'pos-1',
            account_id: 'test-account-id',
            symbol: 'AAPL',
            quantity: 10,
            available_quantity: 10,
            frozen_quantity: 0,
            average_cost: 150,
            total_cost: 1500,
            current_price: 160,
            market_value: 1600,
            unrealized_pnl: 100,
            unrealized_pnl_pct: 6.67,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_price_update: new Date().toISOString(),
            max_quantity: null,
            stop_loss_price: null,
            take_profit_price: null,
          },
        ],
        total_value: 91600,
        available_balance: 90000,
        positions_value: 1600,
        total_unrealized_pnl: 100,
        total_pnl: 1100,
        roi_pct: -8.4,
        today_pnl: 100,
        today_pnl_pct: 0.11,
      };

      const { VirtualAccountDAO } = await import('../database/virtual-account.dao');
      (VirtualAccountDAO.getAccountSummary as any).mockResolvedValue(mockSummary);

      const { VirtualAccountService } = await import('../services/VirtualAccountService');
      const service = VirtualAccountService.getInstance();
      const summary = await service.getAccountSummary('test-user');

      expect(summary).toEqual(mockSummary);
    });
  });

  describe('resetAccount', () => {
    it('should reset account to initial capital', async () => {
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

      const { VirtualAccountDAO } = await import('../database/virtual-account.dao');
      (VirtualAccountDAO.getOrCreateAccount as any).mockResolvedValue(mockAccount);
      (VirtualAccountDAO.resetAccount as any).mockResolvedValue(mockAccount);

      const { VirtualAccountService } = await import('../services/VirtualAccountService');
      const service = VirtualAccountService.getInstance();
      const result = await service.resetAccount('test-user');

      expect(result.balance).toBe(100000);
      expect(VirtualAccountDAO.resetAccount).toHaveBeenCalledWith('test-account-id', undefined);
    });
  });
});