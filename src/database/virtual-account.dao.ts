/**
 * Virtual Account Data Access Object
 * Handles database operations for virtual trading accounts
 */

import { getSupabaseClient } from './client';
import { createLogger } from '../utils/logger';

const log = createLogger('VirtualAccountDAO');

// ============================================
// Type Definitions
// ============================================

export interface VirtualAccount {
  id: string;
  user_id: string;
  balance: number;
  initial_capital: number;
  frozen_balance: number;
  total_realized_pnl: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  account_currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VirtualPosition {
  id: string;
  account_id: string;
  symbol: string;
  quantity: number;
  available_quantity: number;
  frozen_quantity: number;
  average_cost: number;
  total_cost: number;
  current_price: number | null;
  market_value: number | null;
  unrealized_pnl: number | null;
  unrealized_pnl_pct: number | null;
  max_quantity: number | null;
  stop_loss_price: number | null;
  take_profit_price: number | null;
  created_at: string;
  updated_at: string;
  last_price_update: string | null;
}

export interface AccountTransaction {
  id: string;
  account_id: string;
  type: 'deposit' | 'withdraw' | 'buy' | 'sell' | 'dividend' | 'fee' | 'adjustment' | 'reset' | 'frozen' | 'unfrozen' | 'transfer_in' | 'transfer_out';
  amount: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  symbol: string | null;
  quantity: number | null;
  price: number | null;
  description: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface VirtualOrder {
  id: string;
  account_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  order_type: 'market' | 'limit' | 'stop_market' | 'stop_limit';
  quantity: number;
  filled_quantity: number;
  remaining_quantity: number;
  price: number | null;
  stop_price: number | null;
  average_fill_price: number | null;
  status: 'pending' | 'open' | 'partial' | 'filled' | 'cancelled' | 'rejected' | 'expired';
  frozen_amount: number | null;
  frozen_quantity: number | null;
  time_in_force: 'GTC' | 'IOC' | 'FOK' | 'GTD';
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  executed_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  metadata: Record<string, any>;
}

export interface AccountSnapshot {
  id: string;
  account_id: string;
  snapshot_at: string;
  snapshot_type: 'minute' | 'hourly' | 'daily' | 'weekly';
  balance: number;
  positions_value: number;
  total_value: number;
  unrealized_pnl: number;
  realized_pnl: number;
  day_pnl: number | null;
  day_pnl_pct: number | null;
  position_count: number;
  created_at: string;
}

// ============================================
// Create/Update Data Types
// ============================================

export interface CreateAccountData {
  user_id: string;
  initial_capital?: number;
}

export interface CreatePositionData {
  account_id: string;
  symbol: string;
  quantity: number;
  average_cost: number;
}

export interface UpdatePositionData {
  quantity?: number;
  available_quantity?: number;
  frozen_quantity?: number;
  average_cost?: number;
  total_cost?: number;
  current_price?: number;
  market_value?: number;
  unrealized_pnl?: number;
  unrealized_pnl_pct?: number;
}

export interface CreateOrderData {
  account_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  order_type: 'market' | 'limit' | 'stop_market' | 'stop_limit';
  quantity: number;
  price?: number;
  stop_price?: number;
  time_in_force?: 'GTC' | 'IOC' | 'FOK' | 'GTD';
  expires_at?: Date;
  metadata?: Record<string, any>;
}

export interface CreateTransactionData {
  account_id: string;
  type: AccountTransaction['type'];
  amount: number;
  balance_after: number;
  reference_type?: string;
  reference_id?: string;
  symbol?: string;
  quantity?: number;
  price?: number;
  description?: string;
  metadata?: Record<string, any>;
}

// ============================================
// Account Summary Types
// ============================================

export interface AccountSummary {
  account: VirtualAccount;
  positions: VirtualPosition[];
  total_value: number;
  available_balance: number;
  positions_value: number;
  total_unrealized_pnl: number;
  total_pnl: number;
  roi_pct: number;
  today_pnl: number | null;
  today_pnl_pct: number | null;
}

// ============================================
// DAO Class
// ============================================

export class VirtualAccountDAO {
  // ============================================
  // Account Operations
  // ============================================

  /**
   * Create a new virtual account for a user
   */
  static async createAccount(data: CreateAccountData): Promise<VirtualAccount> {
    const supabase = getSupabaseClient();
    const initialCapital = data.initial_capital ?? 100000;

    const { data: account, error } = await supabase
      .from('virtual_accounts')
      .insert({
        user_id: data.user_id,
        balance: initialCapital,
        initial_capital: initialCapital,
      })
      .select()
      .single();

    if (error) {
      log.error('Error creating account:', error);
      throw new Error(`Failed to create account: ${error.message}`);
    }

    // Create initial transaction
    await this.createTransaction({
      account_id: account.id,
      type: 'deposit',
      amount: initialCapital,
      balance_after: initialCapital,
      description: 'Initial capital',
    });

    return account;
  }

  /**
   * Get account by user ID
   */
  static async getAccountByUserId(userId: string): Promise<VirtualAccount | null> {
    const supabase = getSupabaseClient();

    const { data: account, error } = await supabase
      .from('virtual_accounts')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      log.error('Error getting account:', error);
      throw new Error(`Failed to get account: ${error.message}`);
    }

    return account;
  }

  /**
   * Get account by ID
   */
  static async getAccountById(accountId: string): Promise<VirtualAccount | null> {
    const supabase = getSupabaseClient();

    const { data: account, error } = await supabase
      .from('virtual_accounts')
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
   * Get or create account for a user
   */
  static async getOrCreateAccount(userId: string, initialCapital?: number): Promise<VirtualAccount> {
    let account = await this.getAccountByUserId(userId);
    
    if (!account) {
      account = await this.createAccount({
        user_id: userId,
        initial_capital: initialCapital,
      });
    }

    return account;
  }

  /**
   * Update account
   */
  static async updateAccount(accountId: string, updates: Partial<VirtualAccount>): Promise<VirtualAccount> {
    const supabase = getSupabaseClient();

    const { data: account, error } = await supabase
      .from('virtual_accounts')
      .update(updates)
      .eq('id', accountId)
      .select()
      .single();

    if (error) {
      log.error('Error updating account:', error);
      throw new Error(`Failed to update account: ${error.message}`);
    }

    return account;
  }

  /**
   * Reset account to initial state
   */
  static async resetAccount(accountId: string, newCapital?: number): Promise<VirtualAccount> {
    const supabase = getSupabaseClient();

    // Get current account
    const account = await this.getAccountById(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    const resetCapital = newCapital ?? account.initial_capital;

    // Delete all positions
    await supabase
      .from('virtual_positions')
      .delete()
      .eq('account_id', accountId);

    // Delete all pending orders
    await supabase
      .from('virtual_orders')
      .delete()
      .eq('account_id', accountId)
      .in('status', ['pending', 'open', 'partial']);

    // Update account
    const { data: updatedAccount, error } = await supabase
      .from('virtual_accounts')
      .update({
        balance: resetCapital,
        frozen_balance: 0,
        total_realized_pnl: 0,
        total_trades: 0,
        winning_trades: 0,
        losing_trades: 0,
      })
      .eq('id', accountId)
      .select()
      .single();

    if (error) {
      log.error('Error resetting account:', error);
      throw new Error(`Failed to reset account: ${error.message}`);
    }

    // Record reset transaction
    await this.createTransaction({
      account_id: accountId,
      type: 'reset',
      amount: resetCapital,
      balance_after: resetCapital,
      description: 'Account reset',
    });

    return updatedAccount;
  }

  /**
   * Get account summary with positions
   */
  static async getAccountSummary(userId: string): Promise<AccountSummary | null> {
    const account = await this.getAccountByUserId(userId);
    if (!account) return null;

    const positions = await this.getPositions(account.id);

    const positionsValue = positions.reduce((sum, p) => sum + (p.market_value || 0), 0);
    const totalUnrealizedPnl = positions.reduce((sum, p) => sum + (p.unrealized_pnl || 0), 0);
    const totalValue = account.balance + positionsValue;
    const totalPnl = account.total_realized_pnl + totalUnrealizedPnl;
    const roiPct = account.initial_capital > 0 
      ? ((totalValue - account.initial_capital) / account.initial_capital) * 100 
      : 0;

    // Get today's P&L from snapshots or calculate
    const todayPnl = await this.getTodayPnL(account.id);

    return {
      account,
      positions,
      total_value: totalValue,
      available_balance: account.balance - account.frozen_balance,
      positions_value: positionsValue,
      total_unrealized_pnl: totalUnrealizedPnl,
      total_pnl: totalPnl,
      roi_pct: roiPct,
      today_pnl: todayPnl?.pnl ?? null,
      today_pnl_pct: todayPnl?.pnlPct ?? null,
    };
  }

  // ============================================
  // Position Operations
  // ============================================

  /**
   * Get all positions for an account
   */
  static async getPositions(accountId: string): Promise<VirtualPosition[]> {
    const supabase = getSupabaseClient();

    const { data: positions, error } = await supabase
      .from('virtual_positions')
      .select('*')
      .eq('account_id', accountId)
      .gt('quantity', 0)
      .order('created_at', { ascending: false });

    if (error) {
      log.error('Error getting positions:', error);
      throw new Error(`Failed to get positions: ${error.message}`);
    }

    return positions || [];
  }

  /**
   * Get position by symbol
   */
  static async getPosition(accountId: string, symbol: string): Promise<VirtualPosition | null> {
    const supabase = getSupabaseClient();

    const { data: position, error } = await supabase
      .from('virtual_positions')
      .select('*')
      .eq('account_id', accountId)
      .eq('symbol', symbol)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      log.error('Error getting position:', error);
      throw new Error(`Failed to get position: ${error.message}`);
    }

    return position;
  }

  /**
   * Create or update position (upsert)
   */
  static async upsertPosition(
    accountId: string,
    symbol: string,
    data: {
      quantity: number;
      average_cost: number;
      total_cost: number;
    }
  ): Promise<VirtualPosition> {
    const supabase = getSupabaseClient();

    const { data: position, error } = await supabase
      .from('virtual_positions')
      .upsert({
        account_id: accountId,
        symbol,
        quantity: data.quantity,
        available_quantity: data.quantity,
        average_cost: data.average_cost,
        total_cost: data.total_cost,
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
   * Update position
   */
  static async updatePosition(
    positionId: string,
    updates: UpdatePositionData
  ): Promise<VirtualPosition> {
    const supabase = getSupabaseClient();

    const { data: position, error } = await supabase
      .from('virtual_positions')
      .update(updates)
      .eq('id', positionId)
      .select()
      .single();

    if (error) {
      log.error('Error updating position:', error);
      throw new Error(`Failed to update position: ${error.message}`);
    }

    return position;
  }

  /**
   * Update position prices (batch update)
   */
  static async updatePositionPrices(
    updates: Array<{
      positionId: string;
      currentPrice: number;
      marketValue: number;
      unrealizedPnl: number;
      unrealizedPnlPct: number;
    }>
  ): Promise<void> {
    const supabase = getSupabaseClient();

    for (const update of updates) {
      await supabase
        .from('virtual_positions')
        .update({
          current_price: update.currentPrice,
          market_value: update.marketValue,
          unrealized_pnl: update.unrealizedPnl,
          unrealized_pnl_pct: update.unrealizedPnlPct,
          last_price_update: new Date().toISOString(),
        })
        .eq('id', update.positionId);
    }
  }

  /**
   * Delete position
   */
  static async deletePosition(positionId: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('virtual_positions')
      .delete()
      .eq('id', positionId);

    if (error) {
      log.error('Error deleting position:', error);
      throw new Error(`Failed to delete position: ${error.message}`);
    }
  }

  // ============================================
  // Transaction Operations
  // ============================================

  /**
   * Create a transaction record
   */
  static async createTransaction(data: CreateTransactionData): Promise<AccountTransaction> {
    const supabase = getSupabaseClient();

    const { data: transaction, error } = await supabase
      .from('account_transactions')
      .insert({
        account_id: data.account_id,
        type: data.type,
        amount: data.amount,
        balance_after: data.balance_after,
        reference_type: data.reference_type,
        reference_id: data.reference_id,
        symbol: data.symbol,
        quantity: data.quantity,
        price: data.price,
        description: data.description,
        metadata: data.metadata || {},
      })
      .select()
      .single();

    if (error) {
      log.error('Error creating transaction:', error);
      throw new Error(`Failed to create transaction: ${error.message}`);
    }

    return transaction;
  }

  /**
   * Get transaction history
   */
  static async getTransactions(
    accountId: string,
    options?: {
      type?: AccountTransaction['type'];
      symbol?: string;
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{ transactions: AccountTransaction[]; total: number }> {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('account_transactions')
      .select('*', { count: 'exact' })
      .eq('account_id', accountId);

    if (options?.type) {
      query = query.eq('type', options.type);
    }
    if (options?.symbol) {
      query = query.eq('symbol', options.symbol);
    }
    if (options?.startDate) {
      query = query.gte('created_at', options.startDate.toISOString());
    }
    if (options?.endDate) {
      query = query.lte('created_at', options.endDate.toISOString());
    }

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: transactions, error, count } = await query;

    if (error) {
      log.error('Error getting transactions:', error);
      throw new Error(`Failed to get transactions: ${error.message}`);
    }

    return {
      transactions: transactions || [],
      total: count || 0,
    };
  }

  // ============================================
  // Order Operations
  // ============================================

  /**
   * Create an order
   */
  static async createOrder(data: CreateOrderData): Promise<VirtualOrder> {
    const supabase = getSupabaseClient();

    const { data: order, error } = await supabase
      .from('virtual_orders')
      .insert({
        account_id: data.account_id,
        symbol: data.symbol,
        side: data.side,
        order_type: data.order_type,
        quantity: data.quantity,
        remaining_quantity: data.quantity,
        price: data.price,
        stop_price: data.stop_price,
        time_in_force: data.time_in_force || 'GTC',
        expires_at: data.expires_at?.toISOString(),
        metadata: data.metadata || {},
      })
      .select()
      .single();

    if (error) {
      log.error('Error creating order:', error);
      throw new Error(`Failed to create order: ${error.message}`);
    }

    return order;
  }

  /**
   * Get order by ID
   */
  static async getOrder(orderId: string): Promise<VirtualOrder | null> {
    const supabase = getSupabaseClient();

    const { data: order, error } = await supabase
      .from('virtual_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      log.error('Error getting order:', error);
      throw new Error(`Failed to get order: ${error.message}`);
    }

    return order;
  }

  /**
   * Get orders for an account
   */
  static async getOrders(
    accountId: string,
    options?: {
      status?: VirtualOrder['status'][];
      symbol?: string;
      side?: 'buy' | 'sell';
      limit?: number;
      offset?: number;
    }
  ): Promise<{ orders: VirtualOrder[]; total: number }> {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('virtual_orders')
      .select('*', { count: 'exact' })
      .eq('account_id', accountId);

    if (options?.status && options.status.length > 0) {
      query = query.in('status', options.status);
    }
    if (options?.symbol) {
      query = query.eq('symbol', options.symbol);
    }
    if (options?.side) {
      query = query.eq('side', options.side);
    }

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: orders, error, count } = await query;

    if (error) {
      log.error('Error getting orders:', error);
      throw new Error(`Failed to get orders: ${error.message}`);
    }

    return {
      orders: orders || [],
      total: count || 0,
    };
  }

  /**
   * Update order
   */
  static async updateOrder(
    orderId: string,
    updates: Partial<VirtualOrder>
  ): Promise<VirtualOrder> {
    const supabase = getSupabaseClient();

    const { data: order, error } = await supabase
      .from('virtual_orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      log.error('Error updating order:', error);
      throw new Error(`Failed to update order: ${error.message}`);
    }

    return order;
  }

  /**
   * Cancel order
   */
  static async cancelOrder(orderId: string): Promise<VirtualOrder> {
    return this.updateOrder(orderId, {
      status: 'cancelled',
      completed_at: new Date().toISOString(),
    });
  }

  // ============================================
  // Snapshot Operations
  // ============================================

  /**
   * Create account snapshot
   */
  static async createSnapshot(
    accountId: string,
    snapshotType: 'minute' | 'hourly' | 'daily' | 'weekly' = 'hourly'
  ): Promise<AccountSnapshot> {
    const account = await this.getAccountById(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    const positions = await this.getPositions(accountId);
    const positionsValue = positions.reduce((sum, p) => sum + (p.market_value || 0), 0);
    const totalValue = account.balance + positionsValue;
    const unrealizedPnl = positions.reduce((sum, p) => sum + (p.unrealized_pnl || 0), 0);

    const supabase = getSupabaseClient();

    const { data: snapshot, error } = await supabase
      .from('account_snapshots')
      .insert({
        account_id: accountId,
        snapshot_type: snapshotType,
        balance: account.balance,
        positions_value: positionsValue,
        total_value: totalValue,
        unrealized_pnl: unrealizedPnl,
        realized_pnl: account.total_realized_pnl,
        position_count: positions.length,
      })
      .select()
      .single();

    if (error) {
      log.error('Error creating snapshot:', error);
      throw new Error(`Failed to create snapshot: ${error.message}`);
    }

    return snapshot;
  }

  /**
   * Get account value history
   */
  static async getValueHistory(
    accountId: string,
    options?: {
      snapshotType?: 'minute' | 'hourly' | 'daily' | 'weekly';
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<AccountSnapshot[]> {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('account_snapshots')
      .select('*')
      .eq('account_id', accountId);

    if (options?.snapshotType) {
      query = query.eq('snapshot_type', options.snapshotType);
    }
    if (options?.startDate) {
      query = query.gte('snapshot_at', options.startDate.toISOString());
    }
    if (options?.endDate) {
      query = query.lte('snapshot_at', options.endDate.toISOString());
    }

    const limit = options?.limit ?? 100;
    query = query
      .order('snapshot_at', { ascending: true })
      .limit(limit);

    const { data: snapshots, error } = await query;

    if (error) {
      log.error('Error getting value history:', error);
      throw new Error(`Failed to get value history: ${error.message}`);
    }

    return snapshots || [];
  }

  /**
   * Get today's P&L
   */
  private static async getTodayPnL(accountId: string): Promise<{ pnl: number; pnlPct: number } | null> {
    const supabase = getSupabaseClient();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: snapshots, error } = await supabase
      .from('account_snapshots')
      .select('*')
      .eq('account_id', accountId)
      .gte('snapshot_at', today.toISOString())
      .order('snapshot_at', { ascending: true })
      .limit(2);

    if (error || !snapshots || snapshots.length === 0) {
      return null;
    }

    const firstSnapshot = snapshots[0];
    const lastSnapshot = snapshots[snapshots.length - 1];
    const pnl = lastSnapshot.total_value - firstSnapshot.total_value;
    const pnlPct = firstSnapshot.total_value > 0
      ? (pnl / firstSnapshot.total_value) * 100
      : 0;

    return { pnl, pnlPct };
  }
}

export default VirtualAccountDAO;