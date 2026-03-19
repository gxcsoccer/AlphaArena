/**
 * Exchange Accounts Service
 * Business logic for multi-exchange account management
 */

import {
  ExchangeAccountsDAO,
  ExchangeAccount,
  AccountGroup,
  CreateExchangeAccountData,
  UpdateExchangeAccountData,
  CreateAccountGroupData,
  UpdateAccountGroupData,
  ExchangeType,
  AccountEnvironment,
  UnifiedAccountSummary,
} from '../database/exchange-accounts.dao';
import { createLogger } from '../utils/logger';

const log = createLogger('ExchangeAccountsService');

// Simple encryption for API keys (in production, use proper encryption service)
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY || 'default-key-change-in-production';

function encrypt(text: string): string {
  // Simple XOR encryption for demo - use proper encryption in production
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(
      text.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)
    );
  }
  return Buffer.from(result).toString('base64');
}

function decrypt(encrypted: string): string {
  try {
    const text = Buffer.from(encrypted, 'base64').toString();
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)
      );
    }
    return result;
  } catch {
    return encrypted; // Return as-is if decryption fails
  }
}

export interface AddAccountRequest {
  name: string;
  exchange: ExchangeType;
  environment: AccountEnvironment;
  apiKey: string;
  apiSecret: string;
  apiPassphrase?: string;
  isPrimary?: boolean;
}

export interface UpdateAccountRequest {
  name?: string;
  apiKey?: string;
  apiSecret?: string;
  apiPassphrase?: string;
  isPrimary?: boolean;
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
  accountIds: string[];
  strategyAllocation?: Record<string, number>;
}

export interface UpdateGroupRequest {
  name?: string;
  description?: string;
  accountIds?: string[];
  strategyAllocation?: Record<string, number>;
}

export class ExchangeAccountsService {
  private static instance: ExchangeAccountsService;

  private constructor() {}

  static getInstance(): ExchangeAccountsService {
    if (!ExchangeAccountsService.instance) {
      ExchangeAccountsService.instance = new ExchangeAccountsService();
    }
    return ExchangeAccountsService.instance;
  }

  // ============================================
  // Account Management
  // ============================================

  /**
   * Add a new exchange account
   */
  async addAccount(userId: string, request: AddAccountRequest): Promise<ExchangeAccount> {
    // Validate exchange type
    const validExchanges: ExchangeType[] = ['alpaca', 'binance', 'okx', 'bybit', 'mock'];
    if (!validExchanges.includes(request.exchange)) {
      throw new Error(`Invalid exchange type: ${request.exchange}`);
    }

    // Validate environment
    const validEnvironments: AccountEnvironment[] = ['live', 'paper', 'testnet'];
    if (!validEnvironments.includes(request.environment)) {
      throw new Error(`Invalid environment: ${request.environment}`);
    }

    // Check account limits based on user subscription
    const existingAccounts = await ExchangeAccountsDAO.getAccountsByUserId(userId);
    if (existingAccounts.length >= 10) {
      throw new Error('Maximum number of accounts reached (10)');
    }

    // Validate API credentials format
    this.validateApiCredentials(request.exchange, request.apiKey, request.apiSecret);

    // Encrypt API credentials
    const encryptedApiKey = encrypt(request.apiKey);
    const encryptedApiSecret = encrypt(request.apiSecret);
    const encryptedPassphrase = request.apiPassphrase ? encrypt(request.apiPassphrase) : undefined;

    // Check if this is the first account - make it primary
    const isPrimary = request.isPrimary ?? existingAccounts.length === 0;

    const data: CreateExchangeAccountData = {
      user_id: userId,
      name: request.name,
      exchange: request.exchange,
      environment: request.environment,
      api_key: encryptedApiKey,
      api_secret: encryptedApiSecret,
      api_passphrase: encryptedPassphrase,
      is_primary: isPrimary,
    };

    const account = await ExchangeAccountsDAO.createAccount(data);

    log.info('Exchange account added', {
      userId,
      accountId: account.id,
      exchange: account.exchange,
      environment: account.environment,
    });

    return this.sanitizeAccount(account);
  }

  /**
   * Get all accounts for a user
   */
  async getAccounts(userId: string): Promise<ExchangeAccount[]> {
    const accounts = await ExchangeAccountsDAO.getAccountsByUserId(userId);
    return accounts.map(a => this.sanitizeAccount(a));
  }

  /**
   * Get account by ID
   */
  async getAccount(userId: string, accountId: string): Promise<ExchangeAccount | null> {
    const account = await ExchangeAccountsDAO.getAccountById(accountId);

    if (!account || account.user_id !== userId) {
      return null;
    }

    return this.sanitizeAccount(account);
  }

  /**
   * Get primary account
   */
  async getPrimaryAccount(userId: string): Promise<ExchangeAccount | null> {
    const account = await ExchangeAccountsDAO.getPrimaryAccount(userId);
    return account ? this.sanitizeAccount(account) : null;
  }

  /**
   * Update account
   */
  async updateAccount(
    userId: string,
    accountId: string,
    request: UpdateAccountRequest
  ): Promise<ExchangeAccount> {
    // Verify ownership
    const account = await ExchangeAccountsDAO.getAccountById(accountId);
    if (!account || account.user_id !== userId) {
      throw new Error('Account not found');
    }

    const updates: UpdateExchangeAccountData = {};

    if (request.name) {
      updates.name = request.name;
    }

    if (request.apiKey && request.apiSecret) {
      this.validateApiCredentials(account.exchange, request.apiKey, request.apiSecret);
      updates.api_key = encrypt(request.apiKey);
      updates.api_secret = encrypt(request.apiSecret);
    }

    if (request.apiPassphrase !== undefined) {
      updates.api_passphrase = request.apiPassphrase ? encrypt(request.apiPassphrase) : undefined;
    }

    if (request.isPrimary !== undefined) {
      updates.is_primary = request.isPrimary;
    }

    const updated = await ExchangeAccountsDAO.updateAccount(accountId, updates);
    log.info('Exchange account updated', { userId, accountId });

    return this.sanitizeAccount(updated);
  }

  /**
   * Delete account
   */
  async deleteAccount(userId: string, accountId: string): Promise<void> {
    // Verify ownership
    const account = await ExchangeAccountsDAO.getAccountById(accountId);
    if (!account || account.user_id !== userId) {
      throw new Error('Account not found');
    }

    await ExchangeAccountsDAO.deleteAccount(accountId);
    log.info('Exchange account deleted', { userId, accountId });
  }

  /**
   * Set primary account
   */
  async setPrimaryAccount(userId: string, accountId: string): Promise<void> {
    // Verify ownership
    const account = await ExchangeAccountsDAO.getAccountById(accountId);
    if (!account || account.user_id !== userId) {
      throw new Error('Account not found');
    }

    await ExchangeAccountsDAO.setPrimaryAccount(userId, accountId);
    log.info('Primary account changed', { userId, accountId });
  }

  /**
   * Switch to account (for session context)
   */
  async switchAccount(userId: string, accountId: string): Promise<ExchangeAccount> {
    const account = await ExchangeAccountsDAO.getAccountById(accountId);
    if (!account || account.user_id !== userId) {
      throw new Error('Account not found');
    }

    if (account.status !== 'active') {
      throw new Error(`Account is not active (status: ${account.status})`);
    }

    log.info('Account switched', { userId, accountId });
    return this.sanitizeAccount(account);
  }

  // ============================================
  // Account Group Management
  // ============================================

  /**
   * Create account group
   */
  async createAccountGroup(userId: string, request: CreateGroupRequest): Promise<AccountGroup> {
    // Validate account IDs
    const accounts = await ExchangeAccountsDAO.getAccountsByUserId(userId);
    const accountIds = new Set(accounts.map(a => a.id));

    for (const id of request.accountIds) {
      if (!accountIds.has(id)) {
        throw new Error(`Account not found: ${id}`);
      }
    }

    // Validate strategy allocation percentages
    if (request.strategyAllocation) {
      for (const [, percentage] of Object.entries(request.strategyAllocation)) {
        if (percentage < 0 || percentage > 100) {
          throw new Error('Strategy allocation must be between 0 and 100');
        }
      }
    }

    const data: CreateAccountGroupData = {
      user_id: userId,
      name: request.name,
      description: request.description,
      account_ids: request.accountIds,
      strategy_allocation: request.strategyAllocation,
    };

    const group = await ExchangeAccountsDAO.createAccountGroup(data);
    log.info('Account group created', { userId, groupId: group.id });

    return group;
  }

  /**
   * Get account groups
   */
  async getAccountGroups(userId: string): Promise<AccountGroup[]> {
    return ExchangeAccountsDAO.getAccountGroupsByUserId(userId);
  }

  /**
   * Get account group by ID
   */
  async getAccountGroup(userId: string, groupId: string): Promise<AccountGroup | null> {
    const group = await ExchangeAccountsDAO.getAccountGroupById(groupId);

    if (!group || group.user_id !== userId) {
      return null;
    }

    return group;
  }

  /**
   * Update account group
   */
  async updateAccountGroup(
    userId: string,
    groupId: string,
    request: UpdateGroupRequest
  ): Promise<AccountGroup> {
    // Verify ownership
    const group = await ExchangeAccountsDAO.getAccountGroupById(groupId);
    if (!group || group.user_id !== userId) {
      throw new Error('Account group not found');
    }

    // Validate account IDs if provided
    if (request.accountIds) {
      const accounts = await ExchangeAccountsDAO.getAccountsByUserId(userId);
      const accountIds = new Set(accounts.map(a => a.id));

      for (const id of request.accountIds) {
        if (!accountIds.has(id)) {
          throw new Error(`Account not found: ${id}`);
        }
      }
    }

    // Validate strategy allocation if provided
    if (request.strategyAllocation) {
      for (const [, percentage] of Object.entries(request.strategyAllocation)) {
        if (percentage < 0 || percentage > 100) {
          throw new Error('Strategy allocation must be between 0 and 100');
        }
      }
    }

    const updates: UpdateAccountGroupData = {
      name: request.name,
      description: request.description,
      account_ids: request.accountIds,
      strategy_allocation: request.strategyAllocation,
    };

    const updated = await ExchangeAccountsDAO.updateAccountGroup(groupId, updates);
    log.info('Account group updated', { userId, groupId });

    return updated;
  }

  /**
   * Delete account group
   */
  async deleteAccountGroup(userId: string, groupId: string): Promise<void> {
    // Verify ownership
    const group = await ExchangeAccountsDAO.getAccountGroupById(groupId);
    if (!group || group.user_id !== userId) {
      throw new Error('Account group not found');
    }

    await ExchangeAccountsDAO.deleteAccountGroup(groupId);
    log.info('Account group deleted', { userId, groupId });
  }

  // ============================================
  // Unified Summary
  // ============================================

  /**
   * Get unified account summary
   */
  async getUnifiedSummary(userId: string): Promise<UnifiedAccountSummary> {
    return ExchangeAccountsDAO.getUnifiedAccountSummary(userId);
  }

  /**
   * Sync account balances and positions
   */
  async syncAccount(userId: string, accountId: string): Promise<void> {
    const account = await ExchangeAccountsDAO.getAccountById(accountId);
    if (!account || account.user_id !== userId) {
      throw new Error('Account not found');
    }

    try {
      await ExchangeAccountsDAO.updateSyncStatus(accountId, 'connecting');

      // Get decrypted credentials for API calls
      const apiKey = decrypt(account.api_key);
      const _apiSecret = decrypt(account.api_secret);

      // In production, call the exchange API here
      // For now, just update the sync timestamp
      log.info('Syncing account', { accountId, exchange: account.exchange, apiKey: apiKey.substring(0, 4) + '...' });

      await ExchangeAccountsDAO.updateSyncStatus(accountId, 'active');
    } catch (error: any) {
      await ExchangeAccountsDAO.updateSyncStatus(accountId, 'error', error.message);
      throw error;
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Validate API credentials format
   */
  private validateApiCredentials(exchange: ExchangeType, apiKey: string, apiSecret: string): void {
    if (!apiKey || apiKey.length < 8) {
      throw new Error('API key is too short');
    }

    if (!apiSecret || apiSecret.length < 8) {
      throw new Error('API secret is too short');
    }

    // Exchange-specific validation
    switch (exchange) {
      case 'alpaca':
        // Alpaca keys are typically alphanumeric
        if (!/^[A-Za-z0-9]+$/.test(apiKey)) {
          throw new Error('Invalid Alpaca API key format');
        }
        break;
      case 'binance':
        // Binance keys are typically 64 characters
        if (apiKey.length !== 64) {
          log.warn('Binance API key length is not 64 characters');
        }
        break;
    }
  }

  /**
   * Sanitize account for API response (remove sensitive data)
   */
  private sanitizeAccount(account: ExchangeAccount): ExchangeAccount {
    return {
      ...account,
      api_key: '***', // Don't expose encrypted API key
      api_secret: '***', // Don't expose encrypted API secret
      api_passphrase: account.api_passphrase ? '***' : undefined,
    };
  }
}

export default ExchangeAccountsService;