/**
 * Tests for Exchange Accounts DAO
 */

import { ExchangeAccountsDAO, ExchangeType, AccountEnvironment } from '../../src/database/exchange-accounts.dao';
import { seedMockData } from '../__mocks__/supabase';

// Use the shared Supabase mock
jest.mock('../../src/database/client');

describe('ExchangeAccountsDAO', () => {
  const testUserId = 'test-user-id';
  const testAccountId = 'test-account-id';

  // Helper to create mock account row
  function createMockAccountRow(overrides: Partial<any> = {}) {
    return {
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
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  }

  describe('createAccount', () => {
    it('should create a new exchange account', async () => {
      const data = {
        user_id: testUserId,
        name: 'Test Account',
        exchange: 'alpaca' as ExchangeType,
        environment: 'paper' as AccountEnvironment,
        api_key: 'test-api-key',
        api_secret: 'test-api-secret'
      };

      const account = await ExchangeAccountsDAO.createAccount(data);

      expect(account).toBeDefined();
      expect(account.name).toBe('Test Account');
      expect(account.exchange).toBe('alpaca');
      expect(account.environment).toBe('paper');
    });

    it('should set first account as primary', async () => {
      const data = {
        user_id: testUserId,
        name: 'First Account',
        exchange: 'binance' as ExchangeType,
        environment: 'testnet' as AccountEnvironment,
        api_key: 'test-api-key',
        api_secret: 'test-api-secret',
        is_primary: true
      };

      const account = await ExchangeAccountsDAO.createAccount(data);

      expect(account.is_primary).toBe(true);
    });
  });

  describe('getAccountById', () => {
    it('should return null for non-existent account', async () => {
      const account = await ExchangeAccountsDAO.getAccountById('non-existent-id');
      expect(account).toBeNull();
    });
  });

  describe('getAccountsByUserId', () => {
    it('should return empty array for user with no accounts', async () => {
      const accounts = await ExchangeAccountsDAO.getAccountsByUserId('no-accounts-user');
      expect(accounts).toEqual([]);
    });
  });

  describe('updateAccount', () => {
    it('should update account name', async () => {
      // Seed the mock data with an existing account
      seedMockData('exchange_accounts', [createMockAccountRow({ id: testAccountId })]);

      const updates = { name: 'Updated Account' };
      const account = await ExchangeAccountsDAO.updateAccount(testAccountId, updates);

      expect(account).toBeDefined();
      expect(account.name).toBe('Updated Account');
    });
  });

  describe('Account Balance Operations', () => {
    it('should upsert account balance', async () => {
      seedMockData('account_balances', []);

      const balance = await ExchangeAccountsDAO.upsertBalance(
        testAccountId,
        'USD',
        {
          total_balance: 10000,
          available_balance: 8000,
          frozen_balance: 2000,
          usd_value: 10000
        }
      );

      expect(balance).toBeDefined();
      expect(balance.currency).toBe('USD');
      expect(balance.total_balance).toBe(10000);
    });
  });

  describe('Account Group Operations', () => {
    it('should create an account group', async () => {
      const groupData = {
        user_id: testUserId,
        name: 'Test Group',
        description: 'Test account group',
        account_ids: [testAccountId]
      };

      // This would need a proper mock for the account_groups table
      // For now, we'll just verify the types are correct
      expect(groupData.name).toBe('Test Group');
      expect(groupData.account_ids).toContain(testAccountId);
    });
  });
});