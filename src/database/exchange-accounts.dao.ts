/**
 * Exchange Accounts Data Access Object
 * Handles database operations for multi-exchange account management
 */

import { getSupabaseClient } from './client';
import { createLogger } from '../utils/logger';

const log = createLogger('ExchangeAccountsDAO');

// ============================================
// Type Definitions
// ============================================

export type ExchangeType = 'alpaca' | 'binance' | 'okx' | 'bybit' | 'mock';
export type AccountStatus = 'active' | 'inactive' | 'error' | 'connecting';
export type AccountEnvironment = 'live' | 'paper' | 'testnet';

export interface ExchangeAccount {
  id: string;
  user_id: string;
  name: string;
  exchange: ExchangeType;
  environment: AccountEnvironment;
  api_key: string; // Encrypted
  api_secret: string; // Encrypted
  api_passphrase?: string; // For some exchanges like OKX
  is_primary: boolean;
  status: AccountStatus;
  last_sync_at?: string;
  last_error?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AccountBalance {
  id: string;
  account_id: string;
  currency: string;
  total_balance: number;
  available_balance: number;
  frozen_balance: number;
  usd_value: number;
  last_updated: string;
}

export interface AccountPosition {
  id: string;
  account_id: string;
  symbol: string;
  quantity: number;
  available_quantity: number;
  average_cost: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  last_updated: string;
}

export interface AccountGroup {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  account_ids: string[];
  strategy_allocation: Record<string, number>; // strategy_id -> allocation percentage
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UnifiedAccountSummary {
  total_balance_usd: number;
  total_positions_value: number;
  total_unrealized_pnl: number;
  total_realized_pnl: number;
  total_roi_pct: number;
  accounts: AccountSummaryItem[];
  positions_by_symbol: Record<string, UnifiedPositionSummary>;
}

export interface AccountSummaryItem {
  account_id: string;
  account_name: string;
  exchange: ExchangeType;
  environment: AccountEnvironment;
  status: AccountStatus;
  balance_usd: number;
  positions_value: number;
  unrealized_pnl: number;
  roi_pct: number;
  is_primary: boolean;
}

export interface UnifiedPositionSummary {
  symbol: string;
  total_quantity: number;
  weighted_avg_cost: number;
  current_price: number;
  total_market_value: number;
  total_unrealized_pnl: number;
  accounts: {
    account_id: string;
    account_name: string;
    quantity: number;
    unrealized_pnl: number;
  }[];
}

// ============================================
// Create/Update Data Types
// ============================================

export interface CreateExchangeAccountData {
  user_id: string;
  name: string;
  exchange: ExchangeType;
  environment: AccountEnvironment;
  api_key: string;
  api_secret: string;
  api_passphrase?: string;
  is_primary?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdateExchangeAccountData {
  name?: string;
  api_key?: string;
  api_secret?: string;
  api_passphrase?: string;
  is_primary?: boolean;
  status?: AccountStatus;
  metadata?: Record<string, any>;
}

export interface CreateAccountGroupData {
  user_id: string;
  name: string;
  description?: string;
  account_ids: string[];
  strategy_allocation?: Record<string, number>;
}

export interface UpdateAccountGroupData {
  name?: string;
  description?: string;
  account_ids?: string[];
  strategy_allocation?: Record<string, number>;
  is_active?: boolean;
}

// ============================================
// DAO Class
// ============================================

export class ExchangeAccountsDAO {
  // ============================================
  // Account Operations
  // ============================================

  /**
   * Create a new exchange account
   */
  static async createAccount(data: CreateExchangeAccountData): Promise<ExchangeAccount> {
    const supabase = getSupabaseClient();

    // If this is set as primary, unset other primary accounts first
    if (data.is_primary) {
      await supabase
        .from('exchange_accounts')
        .update({ is_primary: false })
        .eq('user_id', data.user_id);
    }

    const { data: account, error } = await supabase
      .from('exchange_accounts')
      .insert({
        user_id: data.user_id,
        name: data.name,
        exchange: data.exchange,
        environment: data.environment,
        api_key: data.api_key, // Should be encrypted before passing
        api_secret: data.api_secret, // Should be encrypted before passing
        api_passphrase: data.api_passphrase,
        is_primary: data.is_primary ?? false,
        status: 'active',
        metadata: data.metadata || {},
      })
      .select()
      .single();

    if (error) {
      log.error('Error creating exchange account:', error);
      throw new Error(`Failed to create exchange account: ${error.message}`);
    }

    return account;
  }

  /**
   * Get account by ID
   */
  static async getAccountById(accountId: string): Promise<ExchangeAccount | null> {
    const supabase = getSupabaseClient();

    const { data: account, error } = await supabase
      .from('exchange_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      log.error('Error getting account:', error);
      throw new Error(`Failed to get account: ${error.message}`);
    }

    return account;
  }

  /**
   * Get all accounts for a user
   */
  static async getAccountsByUserId(userId: string): Promise<ExchangeAccount[]> {
    const supabase = getSupabaseClient();

    const { data: accounts, error } = await supabase
      .from('exchange_accounts')
      .select('*')
      .eq('user_id', userId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      log.error('Error getting accounts:', error);
      throw new Error(`Failed to get accounts: ${error.message}`);
    }

    return accounts || [];
  }

  /**
   * Get primary account for a user
   */
  static async getPrimaryAccount(userId: string): Promise<ExchangeAccount | null> {
    const supabase = getSupabaseClient();

    const { data: account, error } = await supabase
      .from('exchange_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      log.error('Error getting primary account:', error);
      throw new Error(`Failed to get primary account: ${error.message}`);
    }

    return account;
  }

  /**
   * Update account
   */
  static async updateAccount(
    accountId: string,
    updates: UpdateExchangeAccountData
  ): Promise<ExchangeAccount> {
    const supabase = getSupabaseClient();

    // If setting as primary, unset other primary accounts
    if (updates.is_primary) {
      const account = await this.getAccountById(accountId);
      if (account) {
        await supabase
          .from('exchange_accounts')
          .update({ is_primary: false })
          .eq('user_id', account.user_id);
      }
    }

    const { data: updated, error } = await supabase
      .from('exchange_accounts')
      .update(updates)
      .eq('id', accountId)
      .select()
      .single();

    if (error) {
      log.error('Error updating account:', error);
      throw new Error(`Failed to update account: ${error.message}`);
    }

    return updated;
  }

  /**
   * Delete account
   */
  static async deleteAccount(accountId: string): Promise<void> {
    const supabase = getSupabaseClient();

    // Delete related balances and positions first
    await supabase.from('account_balances').delete().eq('account_id', accountId);
    await supabase.from('account_positions').delete().eq('account_id', accountId);

    // Remove from account groups
    const { data: groups } = await supabase
      .from('account_groups')
      .select('id, account_ids')
      .contains('account_ids', [accountId]);

    if (groups) {
      for (const group of groups) {
        const newAccountIds = group.account_ids.filter((id: string) => id !== accountId);
        await supabase
          .from('account_groups')
          .update({ account_ids: newAccountIds })
          .eq('id', group.id);
      }
    }

    // Delete the account
    const { error } = await supabase
      .from('exchange_accounts')
      .delete()
      .eq('id', accountId);

    if (error) {
      log.error('Error deleting account:', error);
      throw new Error(`Failed to delete account: ${error.message}`);
    }
  }

  /**
   * Set primary account
   */
  static async setPrimaryAccount(userId: string, accountId: string): Promise<void> {
    const supabase = getSupabaseClient();

    // Unset all primary accounts
    await supabase
      .from('exchange_accounts')
      .update({ is_primary: false })
      .eq('user_id', userId);

    // Set the new primary
    await supabase
      .from('exchange_accounts')
      .update({ is_primary: true })
      .eq('id', accountId);
  }

  /**
   * Update account sync status
   */
  static async updateSyncStatus(
    accountId: string,
    status: AccountStatus,
    error?: string
  ): Promise<void> {
    const supabase = getSupabaseClient();

    const updates: Partial<ExchangeAccount> = {
      status,
      last_sync_at: new Date().toISOString(),
    };

    if (error) {
      updates.last_error = error;
    }

    await supabase
      .from('exchange_accounts')
      .update(updates)
      .eq('id', accountId);
  }

  // ============================================
  // Balance Operations
  // ============================================

  /**
   * Get account balances
   */
  static async getAccountBalances(accountId: string): Promise<AccountBalance[]> {
    const supabase = getSupabaseClient();

    const { data: balances, error } = await supabase
      .from('account_balances')
      .select('*')
      .eq('account_id', accountId)
      .gt('total_balance', 0);

    if (error) {
      log.error('Error getting balances:', error);
      throw new Error(`Failed to get balances: ${error.message}`);
    }

    return balances || [];
  }

  /**
   * Upsert account balance
   */
  static async upsertBalance(
    accountId: string,
    currency: string,
    data: {
      total_balance: number;
      available_balance: number;
      frozen_balance: number;
      usd_value: number;
    }
  ): Promise<AccountBalance> {
    const supabase = getSupabaseClient();

    const { data: balance, error } = await supabase
      .from('account_balances')
      .upsert({
        account_id: accountId,
        currency,
        ...data,
        last_updated: new Date().toISOString(),
      }, {
        onConflict: 'account_id,currency',
      })
      .select()
      .single();

    if (error) {
      log.error('Error upserting balance:', error);
      throw new Error(`Failed to upsert balance: ${error.message}`);
    }

    return balance;
  }

  /**
   * Batch update balances
   */
  static async batchUpdateBalances(
    accountId: string,
    balances: Array<{
      currency: string;
      total_balance: number;
      available_balance: number;
      frozen_balance: number;
      usd_value: number;
    }>
  ): Promise<void> {
    const supabase = getSupabaseClient();

    const records = balances.map(b => ({
      account_id: accountId,
      ...b,
      last_updated: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('account_balances')
      .upsert(records, {
        onConflict: 'account_id,currency',
      });

    if (error) {
      log.error('Error batch updating balances:', error);
      throw new Error(`Failed to batch update balances: ${error.message}`);
    }
  }

  // ============================================
  // Position Operations
  // ============================================

  /**
   * Get account positions
   */
  static async getAccountPositions(accountId: string): Promise<AccountPosition[]> {
    const supabase = getSupabaseClient();

    const { data: positions, error } = await supabase
      .from('account_positions')
      .select('*')
      .eq('account_id', accountId)
      .gt('quantity', 0);

    if (error) {
      log.error('Error getting positions:', error);
      throw new Error(`Failed to get positions: ${error.message}`);
    }

    return positions || [];
  }

  /**
   * Upsert account position
   */
  static async upsertPosition(
    accountId: string,
    symbol: string,
    data: {
      quantity: number;
      available_quantity: number;
      average_cost: number;
      current_price: number;
      market_value: number;
      unrealized_pnl: number;
      unrealized_pnl_pct: number;
    }
  ): Promise<AccountPosition> {
    const supabase = getSupabaseClient();

    const { data: position, error } = await supabase
      .from('account_positions')
      .upsert({
        account_id: accountId,
        symbol,
        ...data,
        last_updated: new Date().toISOString(),
      }, {
        onConflict: 'account_id,symbol',
      })
      .select()
      .single();

    if (error) {
      log.error('Error upserting position:', error);
      throw new Error(`Failed to upsert position: ${error.message}`);
    }

    return position;
  }

  /**
   * Delete position
   */
  static async deletePosition(accountId: string, symbol: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('account_positions')
      .delete()
      .eq('account_id', accountId)
      .eq('symbol', symbol);

    if (error) {
      log.error('Error deleting position:', error);
      throw new Error(`Failed to delete position: ${error.message}`);
    }
  }

  // ============================================
  // Account Group Operations
  // ============================================

  /**
   * Create account group
   */
  static async createAccountGroup(data: CreateAccountGroupData): Promise<AccountGroup> {
    const supabase = getSupabaseClient();

    const { data: group, error } = await supabase
      .from('account_groups')
      .insert({
        user_id: data.user_id,
        name: data.name,
        description: data.description,
        account_ids: data.account_ids,
        strategy_allocation: data.strategy_allocation || {},
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      log.error('Error creating account group:', error);
      throw new Error(`Failed to create account group: ${error.message}`);
    }

    return group;
  }

  /**
   * Get account group by ID
   */
  static async getAccountGroupById(groupId: string): Promise<AccountGroup | null> {
    const supabase = getSupabaseClient();

    const { data: group, error } = await supabase
      .from('account_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      log.error('Error getting account group:', error);
      throw new Error(`Failed to get account group: ${error.message}`);
    }

    return group;
  }

  /**
   * Get all account groups for a user
   */
  static async getAccountGroupsByUserId(userId: string): Promise<AccountGroup[]> {
    const supabase = getSupabaseClient();

    const { data: groups, error } = await supabase
      .from('account_groups')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      log.error('Error getting account groups:', error);
      throw new Error(`Failed to get account groups: ${error.message}`);
    }

    return groups || [];
  }

  /**
   * Update account group
   */
  static async updateAccountGroup(
    groupId: string,
    updates: UpdateAccountGroupData
  ): Promise<AccountGroup> {
    const supabase = getSupabaseClient();

    const { data: group, error } = await supabase
      .from('account_groups')
      .update(updates)
      .eq('id', groupId)
      .select()
      .single();

    if (error) {
      log.error('Error updating account group:', error);
      throw new Error(`Failed to update account group: ${error.message}`);
    }

    return group;
  }

  /**
   * Delete account group
   */
  static async deleteAccountGroup(groupId: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('account_groups')
      .delete()
      .eq('id', groupId);

    if (error) {
      log.error('Error deleting account group:', error);
      throw new Error(`Failed to delete account group: ${error.message}`);
    }
  }

  // ============================================
  // Unified Summary Operations
  // ============================================

  /**
   * Get unified account summary
   */
  static async getUnifiedAccountSummary(userId: string): Promise<UnifiedAccountSummary> {
    const accounts = await this.getAccountsByUserId(userId);

    const accountSummaries: AccountSummaryItem[] = [];
    const positionsBySymbol: Record<string, UnifiedPositionSummary> = {};

    let totalBalanceUsd = 0;
    let totalPositionsValue = 0;
    let totalUnrealizedPnl = 0;

    for (const account of accounts) {
      const balances = await this.getAccountBalances(account.id);
      const positions = await this.getAccountPositions(account.id);

      const balanceUsd = balances.reduce((sum, b) => sum + b.usd_value, 0);
      const positionsValue = positions.reduce((sum, p) => sum + p.market_value, 0);
      const unrealizedPnl = positions.reduce((sum, p) => sum + p.unrealized_pnl, 0);

      totalBalanceUsd += balanceUsd;
      totalPositionsValue += positionsValue;
      totalUnrealizedPnl += unrealizedPnl;

      accountSummaries.push({
        account_id: account.id,
        account_name: account.name,
        exchange: account.exchange,
        environment: account.environment,
        status: account.status,
        balance_usd: balanceUsd,
        positions_value: positionsValue,
        unrealized_pnl: unrealizedPnl,
        roi_pct: positionsValue > 0 ? (unrealizedPnl / (positionsValue - unrealizedPnl)) * 100 : 0,
        is_primary: account.is_primary,
      });

      // Aggregate positions by symbol
      for (const position of positions) {
        if (!positionsBySymbol[position.symbol]) {
          positionsBySymbol[position.symbol] = {
            symbol: position.symbol,
            total_quantity: 0,
            weighted_avg_cost: 0,
            current_price: position.current_price,
            total_market_value: 0,
            total_unrealized_pnl: 0,
            accounts: [],
          };
        }

        const summary = positionsBySymbol[position.symbol];
        summary.total_quantity += position.quantity;
        summary.total_market_value += position.market_value;
        summary.total_unrealized_pnl += position.unrealized_pnl;
        summary.accounts.push({
          account_id: account.id,
          account_name: account.name,
          quantity: position.quantity,
          unrealized_pnl: position.unrealized_pnl,
        });
      }
    }

    // Calculate weighted average cost for each symbol
    for (const symbol of Object.keys(positionsBySymbol)) {
      const summary = positionsBySymbol[symbol];
      const totalCost = summary.total_market_value - summary.total_unrealized_pnl;
      summary.weighted_avg_cost = summary.total_quantity > 0 ? totalCost / summary.total_quantity : 0;
    }

    const totalRealizedPnl = 0; // Would need to track this separately
    const totalRoiPct = (totalBalanceUsd + totalPositionsValue) > 0
      ? (totalUnrealizedPnl / (totalBalanceUsd + totalPositionsValue)) * 100
      : 0;

    return {
      total_balance_usd: totalBalanceUsd,
      total_positions_value: totalPositionsValue,
      total_unrealized_pnl: totalUnrealizedPnl,
      total_realized_pnl: totalRealizedPnl,
      total_roi_pct: totalRoiPct,
      accounts: accountSummaries,
      positions_by_symbol: positionsBySymbol,
    };
  }

  /**
   * Get positions for multiple accounts (for account group strategies)
   */
  static async getPositionsForAccounts(accountIds: string[]): Promise<Map<string, AccountPosition[]>> {
    const supabase = getSupabaseClient();

    const { data: positions, error } = await supabase
      .from('account_positions')
      .select('*')
      .in('account_id', accountIds)
      .gt('quantity', 0);

    if (error) {
      log.error('Error getting positions for accounts:', error);
      throw new Error(`Failed to get positions: ${error.message}`);
    }

    const result = new Map<string, AccountPosition[]>();
    for (const position of positions || []) {
      if (!result.has(position.account_id)) {
        result.set(position.account_id, []);
      }
      result.get(position.account_id)!.push(position);
    }

    return result;
  }
}

export default ExchangeAccountsDAO;