/**
 * Tests for Exchange Accounts Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExchangeAccountsService } from '../src/services/ExchangeAccountsService';
import * as dao from '../src/database/exchange-accounts.dao';

// Mock the DAO
vi.mock('../src/database/exchange-accounts.dao', () => ({
  ExchangeAccountsDAO: {
    createAccount: vi.fn(),
    getAccountById: vi.fn(),
    getAccountsByUserId: vi.fn(),
    getPrimaryAccount: vi.fn(),
    updateAccount: vi.fn(),
    deleteAccount: vi.fn(),
    setPrimaryAccount: vi.fn(),
    updateSyncStatus: vi.fn(),
    getAccountBalances: vi.fn(),
    upsertBalance: vi.fn(),
    getAccountPositions: vi.fn(),
    upsertPosition: vi.fn(),
    createAccountGroup: vi.fn(),
    getAccountGroupById: vi.fn(),
    getAccountGroupsByUserId: vi.fn(),
    updateAccountGroup: vi.fn(),
    deleteAccountGroup: vi.fn(),
    getUnifiedAccountSummary: vi.fn()
  }
}));

describe('ExchangeAccountsService', () => {
  const service = ExchangeAccountsService.getInstance();
  const testUserId = 'test-user-id';
  const testAccountId = 'test-account-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addAccount', () => {
    it('should add a new exchange account with valid data', async () => {
      // Mock getAccountsByUserId to return empty array (no existing accounts)
      vi.mocked(dao.ExchangeAccountsDAO.getAccountsByUserId).mockResolvedValueOnce([]);
      
      // Mock createAccount
      vi.mocked(dao.ExchangeAccountsDAO.createAccount).mockResolvedValueOnce({
        id: testAccountId,
        user_id: testUserId,
        name: 'Test Alpaca',
        exchange: 'alpaca',
        environment: 'paper',
        api_key: 'encrypted',
        api_secret: 'encrypted',
        is_primary: true,
        status: 'active',
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const account = await service.addAccount(testUserId, {
        name: 'Test Alpaca',
        exchange: 'alpaca',
        environment: 'paper',
        apiKey: 'test-api-key-12345678',
        apiSecret: 'test-api-secret-12345678'
      });

      expect(account).toBeDefined();
      expect(account.name).toBe('Test Alpaca');
      expect(account.exchange).toBe('alpaca');
    });

    it('should reject invalid exchange type', async () => {
      await expect(service.addAccount(testUserId, {
        name: 'Invalid Account',
        exchange: 'invalid' as any,
        environment: 'paper',
        apiKey: 'test-key',
        apiSecret: 'test-secret'
      })).rejects.toThrow('Invalid exchange type');
    });

    it('should reject invalid environment', async () => {
      await expect(service.addAccount(testUserId, {
        name: 'Invalid Account',
        exchange: 'alpaca',
        environment: 'invalid' as any,
        apiKey: 'test-key',
        apiSecret: 'test-secret'
      })).rejects.toThrow('Invalid environment');
    });

    it('should reject short API key', async () => {
      await expect(service.addAccount(testUserId, {
        name: 'Invalid Account',
        exchange: 'alpaca',
        environment: 'paper',
        apiKey: 'short',
        apiSecret: 'test-api-secret-12345678'
      })).rejects.toThrow('API key is too short');
    });

    it('should enforce account limit', async () => {
      // Mock 10 existing accounts
      const existingAccounts = Array(10).fill(null).map((_, i) => ({
        id: `account-${i}`,
        user_id: testUserId,
        name: `Account ${i}`,
        exchange: 'alpaca' as const,
        environment: 'paper' as const,
        api_key: 'encrypted',
        api_secret: 'encrypted',
        is_primary: i === 0,
        status: 'active' as const,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      vi.mocked(dao.ExchangeAccountsDAO.getAccountsByUserId).mockResolvedValueOnce(existingAccounts);

      await expect(service.addAccount(testUserId, {
        name: 'Overflow Account',
        exchange: 'alpaca',
        environment: 'paper',
        apiKey: 'test-api-key-12345678',
        apiSecret: 'test-api-secret-12345678'
      })).rejects.toThrow('Maximum number of accounts reached');
    });
  });

  describe('getAccounts', () => {
    it('should return sanitized accounts', async () => {
      vi.mocked(dao.ExchangeAccountsDAO.getAccountsByUserId).mockResolvedValueOnce([
        {
          id: testAccountId,
          user_id: testUserId,
          name: 'Test Account',
          exchange: 'alpaca',
          environment: 'paper',
          api_key: 'encrypted-key',
          api_secret: 'encrypted-secret',
          is_primary: true,
          status: 'active',
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);

      const accounts = await service.getAccounts(testUserId);

      expect(accounts).toHaveLength(1);
      expect(accounts[0].api_key).toBe('***');
      expect(accounts[0].api_secret).toBe('***');
    });
  });

  describe('setPrimaryAccount', () => {
    it('should set primary account', async () => {
      vi.mocked(dao.ExchangeAccountsDAO.getAccountById).mockResolvedValueOnce({
        id: testAccountId,
        user_id: testUserId,
        name: 'Test Account',
        exchange: 'alpaca',
        environment: 'paper',
        api_key: 'encrypted',
        api_secret: 'encrypted',
        is_primary: false,
        status: 'active',
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      vi.mocked(dao.ExchangeAccountsDAO.setPrimaryAccount).mockResolvedValueOnce(undefined);

      await service.setPrimaryAccount(testUserId, testAccountId);

      expect(dao.ExchangeAccountsDAO.setPrimaryAccount).toHaveBeenCalledWith(testUserId, testAccountId);
    });

    it('should reject setting primary for non-owned account', async () => {
      vi.mocked(dao.ExchangeAccountsDAO.getAccountById).mockResolvedValueOnce({
        id: testAccountId,
        user_id: 'other-user-id',
        name: 'Test Account',
        exchange: 'alpaca',
        environment: 'paper',
        api_key: 'encrypted',
        api_secret: 'encrypted',
        is_primary: false,
        status: 'active',
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      await expect(service.setPrimaryAccount(testUserId, testAccountId))
        .rejects.toThrow('Account not found');
    });
  });

  describe('switchAccount', () => {
    it('should switch to active account', async () => {
      vi.mocked(dao.ExchangeAccountsDAO.getAccountById).mockResolvedValueOnce({
        id: testAccountId,
        user_id: testUserId,
        name: 'Test Account',
        exchange: 'alpaca',
        environment: 'paper',
        api_key: 'encrypted',
        api_secret: 'encrypted',
        is_primary: true,
        status: 'active',
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const account = await service.switchAccount(testUserId, testAccountId);

      expect(account).toBeDefined();
      expect(account.id).toBe(testAccountId);
    });

    it('should reject switching to inactive account', async () => {
      vi.mocked(dao.ExchangeAccountsDAO.getAccountById).mockResolvedValueOnce({
        id: testAccountId,
        user_id: testUserId,
        name: 'Test Account',
        exchange: 'alpaca',
        environment: 'paper',
        api_key: 'encrypted',
        api_secret: 'encrypted',
        is_primary: true,
        status: 'error',
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      await expect(service.switchAccount(testUserId, testAccountId))
        .rejects.toThrow('Account is not active');
    });
  });

  describe('Account Groups', () => {
    it('should create account group', async () => {
      vi.mocked(dao.ExchangeAccountsDAO.getAccountsByUserId).mockResolvedValueOnce([
        {
          id: testAccountId,
          user_id: testUserId,
          name: 'Test Account',
          exchange: 'alpaca',
          environment: 'paper',
          api_key: 'encrypted',
          api_secret: 'encrypted',
          is_primary: true,
          status: 'active',
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);

      vi.mocked(dao.ExchangeAccountsDAO.createAccountGroup).mockResolvedValueOnce({
        id: 'group-id',
        user_id: testUserId,
        name: 'Test Group',
        account_ids: [testAccountId],
        strategy_allocation: {},
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const group = await service.createAccountGroup(testUserId, {
        name: 'Test Group',
        accountIds: [testAccountId]
      });

      expect(group).toBeDefined();
      expect(group.name).toBe('Test Group');
    });

    it('should reject invalid allocation percentages', async () => {
      vi.mocked(dao.ExchangeAccountsDAO.getAccountsByUserId).mockResolvedValueOnce([
        {
          id: testAccountId,
          user_id: testUserId,
          name: 'Test Account',
          exchange: 'alpaca',
          environment: 'paper',
          api_key: 'encrypted',
          api_secret: 'encrypted',
          is_primary: true,
          status: 'active',
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);

      await expect(service.createAccountGroup(testUserId, {
        name: 'Test Group',
        accountIds: [testAccountId],
        strategyAllocation: { 'strategy-1': 150 } // Invalid: > 100
      })).rejects.toThrow('Strategy allocation must be between 0 and 100');
    });
  });

  describe('getUnifiedSummary', () => {
    it('should return unified summary', async () => {
      vi.mocked(dao.ExchangeAccountsDAO.getUnifiedAccountSummary).mockResolvedValueOnce({
        total_balance_usd: 10000,
        total_positions_value: 5000,
        total_unrealized_pnl: 500,
        total_realized_pnl: 200,
        total_roi_pct: 3.33,
        accounts: [],
        positions_by_symbol: {}
      });

      const summary = await service.getUnifiedSummary(testUserId);

      expect(summary).toBeDefined();
      expect(summary.total_balance_usd).toBe(10000);
      expect(summary.total_positions_value).toBe(5000);
    });
  });
});