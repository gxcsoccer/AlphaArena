/**
 * Paper Trading Engine
 * Real-time simulated trading execution engine
 * 
 * Handles order execution, order book management, and price monitoring
 */

import { EventEmitter } from 'events';
import { VirtualAccountDAO, VirtualAccount, VirtualPosition, VirtualOrder } from '../database/virtual-account.dao';
import { DataSourceManager } from '../datasource/DataSourceManager';
import { Quote } from '../datasource/types';
import { createLogger } from '../utils/logger';

const log = createLogger('PaperTradingEngine');

// ============================================
// Types
// ============================================

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_market' | 'stop_limit' | 'take_profit';
export type OrderStatus = 'pending' | 'open' | 'partial' | 'filled' | 'cancelled' | 'rejected' | 'expired';

export interface FeeConfig {
  commission: number;       // 佣金率 (e.g., 0.0003 = 0.03%)
  minCommission: number;    // 最低佣金
  stamp: number;            // 印花税率 (卖出时，e.g., 0.001 = 0.1%)
  transfer: number;         // 过户费率 (e.g., 0.00001 = 0.001%)
}

export interface TradeResult {
  orderId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  price: number;
  total: number;
  fee: number;
  executedAt: Date;
  realizedPnl?: number;
}

export interface OrderBookEntry {
  orderId: string;
  accountId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
  filledQuantity: number;
  remainingQuantity: number;
  status: OrderStatus;
  createdAt: Date;
}

export interface EngineConfig {
  feeConfig: FeeConfig;
  priceCheckIntervalMs: number;
  maxOrdersPerSymbol: number;
  enablePartialFills: boolean;
}

export interface EngineEvents {
  'order:created': { order: VirtualOrder };
  'order:filled': { order: VirtualOrder; trade: TradeResult };
  'order:partial': { order: VirtualOrder; trade: TradeResult };
  'order:cancelled': { order: VirtualOrder };
  'order:expired': { order: VirtualOrder };
  'order:rejected': { order: VirtualOrder; reason: string };
  'price:update': { symbol: string; quote: Quote };
  'error': { error: Error; context?: string };
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_FEE_CONFIG: FeeConfig = {
  commission: 0.0003,       // 0.03%
  minCommission: 5,         // $5 minimum
  stamp: 0.001,             // 0.1% (sell only)
  transfer: 0.00001,        // 0.001%
};

const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  feeConfig: DEFAULT_FEE_CONFIG,
  priceCheckIntervalMs: 1000,  // Check every second
  maxOrdersPerSymbol: 100,
  enablePartialFills: false,
};

// ============================================
// Paper Trading Engine Class
// ============================================

export class PaperTradingEngine extends EventEmitter {
  private static instance: PaperTradingEngine | null = null;
  
  private config: EngineConfig;
  private dataSourceManager: DataSourceManager;
  
  // Active order subscriptions
  private priceSubscriptions: Map<string, () => void> = new Map();
  
  // Order book (in-memory for fast access)
  private activeOrders: Map<string, OrderBookEntry> = new Map();
  
  // Symbol -> Set of order IDs
  private ordersBySymbol: Map<string, Set<string>> = new Map();
  
  // Account -> Set of order IDs
  private ordersByAccount: Map<string, Set<string>> = new Map();
  
  // Running state
  private isRunning: boolean = false;
  private priceCheckInterval?: NodeJS.Timeout;

  private constructor(config: Partial<EngineConfig> = {}) {
    super();
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...config };
    this.dataSourceManager = DataSourceManager.getInstance();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<EngineConfig>): PaperTradingEngine {
    if (!PaperTradingEngine.instance) {
      PaperTradingEngine.instance = new PaperTradingEngine(config);
    }
    return PaperTradingEngine.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance(): void {
    if (PaperTradingEngine.instance) {
      PaperTradingEngine.instance.stop();
      PaperTradingEngine.instance = null;
    }
  }

  // ============================================
  // Engine Lifecycle
  // ============================================

  /**
   * Start the trading engine
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      log.warn('Engine already running');
      return;
    }

    log.info('Starting Paper Trading Engine...');
    
    // Load active orders from database
    await this.loadActiveOrders();
    
    // Start price monitoring
    this.startPriceMonitoring();
    
    this.isRunning = true;
    log.info('Paper Trading Engine started');
  }

  /**
   * Stop the trading engine
   */
  stop(): void {
    if (!this.isRunning) return;

    log.info('Stopping Paper Trading Engine...');
    
    // Clear price check interval
    if (this.priceCheckInterval) {
      clearInterval(this.priceCheckInterval);
      this.priceCheckInterval = undefined;
    }
    
    // Unsubscribe from all price feeds
    for (const [symbol, unsubscribe] of this.priceSubscriptions) {
      unsubscribe();
    }
    this.priceSubscriptions.clear();
    
    // Clear in-memory data
    this.activeOrders.clear();
    this.ordersBySymbol.clear();
    this.ordersByAccount.clear();
    
    this.isRunning = false;
    log.info('Paper Trading Engine stopped');
  }

  // ============================================
  // Order Submission
  // ============================================

  /**
   * Submit a new order
   */
  async submitOrder(params: {
    userId: string;
    symbol: string;
    side: OrderSide;
    type: OrderType;
    quantity: number;
    price?: number;
    stopPrice?: number;
    timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'GTD';
    expiresAt?: Date;
  }): Promise<{ success: boolean; order?: VirtualOrder; error?: string }> {
    try {
      const { userId, symbol, side, type, quantity, price, stopPrice, timeInForce, expiresAt } = params;
      
      // Validate parameters
      const validation = this.validateOrder(params);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }
      
      // Get account
      const account = await VirtualAccountDAO.getAccountByUserId(userId);
      if (!account) {
        return { success: false, error: 'Account not found' };
      }
      
      // Get current market price
      const quote = await this.dataSourceManager.getQuote(symbol);
      if (!quote) {
        return { success: false, error: 'Unable to get market price for symbol' };
      }
      
      const currentPrice = quote.lastPrice;
      
      // For market orders, execute immediately
      if (type === 'market') {
        return await this.executeMarketOrder(account, symbol, side, quantity, currentPrice);
      }
      
      // For limit orders, check if can execute immediately
      if (type === 'limit' && price) {
        const canExecute = side === 'buy' 
          ? currentPrice <= price 
          : currentPrice >= price;
        
        if (canExecute) {
          return await this.executeLimitOrder(account, symbol, side, quantity, price);
        }
      }
      
      // For stop orders, check if already triggered
      if ((type === 'stop' || type === 'stop_limit') && stopPrice) {
        const triggered = side === 'buy'
          ? currentPrice >= stopPrice
          : currentPrice <= stopPrice;
        
        if (triggered) {
          if (type === 'stop') {
            // Execute as market order
            return await this.executeMarketOrder(account, symbol, side, quantity, currentPrice);
          } else if (type === 'stop_limit' && price) {
            // Execute as limit order
            return await this.executeLimitOrder(account, symbol, side, quantity, price);
          }
        }
      }
      
      // For take profit orders, check if already triggered
      if (type === 'take_profit' && stopPrice) {
        const triggered = side === 'sell'
          ? currentPrice >= stopPrice
          : currentPrice <= stopPrice;
        
        if (triggered) {
          return await this.executeMarketOrder(account, symbol, side, quantity, currentPrice);
        }
      }
      
      // Order cannot be executed immediately, add to order book
      return await this.addOrderToBook(account, {
        symbol,
        side,
        type,
        quantity,
        price,
        stopPrice,
        timeInForce: timeInForce || 'GTC',
        expiresAt,
      });
      
    } catch (error: any) {
      log.error('Error submitting order:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(userId: string, orderId: string): Promise<{ success: boolean; order?: VirtualOrder; error?: string }> {
    try {
      const account = await VirtualAccountDAO.getAccountByUserId(userId);
      if (!account) {
        return { success: false, error: 'Account not found' };
      }
      
      const order = await VirtualAccountDAO.getOrder(orderId);
      if (!order) {
        return { success: false, error: 'Order not found' };
      }
      
      if (order.account_id !== account.id) {
        return { success: false, error: 'Order does not belong to your account' };
      }
      
      if (!['pending', 'open', 'partial'].includes(order.status)) {
        return { success: false, error: `Cannot cancel order with status: ${order.status}` };
      }
      
      // Unfreeze funds or shares
      await this.unfreezeOrderResources(account, order);
      
      // Update order status
      const cancelledOrder = await VirtualAccountDAO.updateOrder(orderId, {
        status: 'cancelled',
        completed_at: new Date().toISOString(),
      });
      
      // Remove from in-memory order book
      this.removeOrderFromBook(orderId);
      
      this.emit('order:cancelled', { order: cancelledOrder });
      
      log.info(`Order ${orderId} cancelled`);
      
      return { success: true, order: cancelledOrder };
      
    } catch (error: any) {
      log.error('Error cancelling order:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Modify an order (price only)
   */
  async modifyOrder(
    userId: string, 
    orderId: string, 
    updates: { price?: number; stopPrice?: number; quantity?: number }
  ): Promise<{ success: boolean; order?: VirtualOrder; error?: string }> {
    try {
      const account = await VirtualAccountDAO.getAccountByUserId(userId);
      if (!account) {
        return { success: false, error: 'Account not found' };
      }
      
      const order = await VirtualAccountDAO.getOrder(orderId);
      if (!order) {
        return { success: false, error: 'Order not found' };
      }
      
      if (order.account_id !== account.id) {
        return { success: false, error: 'Order does not belong to your account' };
      }
      
      if (!['pending', 'open'].includes(order.status)) {
        return { success: false, error: `Cannot modify order with status: ${order.status}` };
      }
      
      // Check if it's a limit order (only limit orders can be modified)
      if (order.order_type !== 'limit' && order.order_type !== 'stop_limit') {
        return { success: false, error: 'Only limit and stop-limit orders can be modified' };
      }
      
      // Update order
      const orderUpdates: Partial<VirtualOrder> = {};
      
      if (updates.price !== undefined) {
        orderUpdates.price = updates.price;
      }
      
      if (updates.stopPrice !== undefined) {
        orderUpdates.stop_price = updates.stopPrice;
      }
      
      if (updates.quantity !== undefined && updates.quantity > order.filled_quantity) {
        // If increasing quantity, need to freeze more funds
        if (order.side === 'buy' && updates.quantity > order.quantity) {
          const additionalQty = updates.quantity - order.quantity;
          const price = updates.price || order.price || 0;
          const additionalCost = additionalQty * price;
          const additionalFee = this.calculateFee(additionalCost, 'buy');
          
          const availableBalance = account.balance - account.frozen_balance;
          if (availableBalance < additionalCost + additionalFee) {
            return { success: false, error: 'Insufficient balance to increase order quantity' };
          }
          
          // Freeze additional funds
          await VirtualAccountDAO.updateAccount(account.id, {
            frozen_balance: account.frozen_balance + additionalCost + additionalFee,
          });
          
          orderUpdates.frozen_amount = (order.frozen_amount || 0) + additionalCost + additionalFee;
        }
        
        orderUpdates.quantity = updates.quantity;
        orderUpdates.remaining_quantity = updates.quantity - order.filled_quantity;
      }
      
      const updatedOrder = await VirtualAccountDAO.updateOrder(orderId, orderUpdates);
      
      // Update in-memory order book
      const entry = this.activeOrders.get(orderId);
      if (entry) {
        if (updates.price !== undefined) entry.price = updates.price;
        if (updates.stopPrice !== undefined) entry.stopPrice = updates.stopPrice;
        if (updates.quantity !== undefined) {
          entry.quantity = updates.quantity;
          entry.remainingQuantity = updates.quantity - entry.filledQuantity;
        }
      }
      
      log.info(`Order ${orderId} modified`);
      
      return { success: true, order: updatedOrder };
      
    } catch (error: any) {
      log.error('Error modifying order:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // Order Execution
  // ============================================

  /**
   * Execute a market order
   */
  private async executeMarketOrder(
    account: VirtualAccount,
    symbol: string,
    side: OrderSide,
    quantity: number,
    price: number
  ): Promise<{ success: boolean; order?: VirtualOrder; error?: string }> {
    // Validate sufficient funds/shares
    if (side === 'buy') {
      const totalCost = price * quantity;
      const fee = this.calculateFee(totalCost, 'buy');
      const totalWithFee = totalCost + fee;
      
      const availableBalance = account.balance - account.frozen_balance;
      if (availableBalance < totalWithFee) {
        return {
          success: false,
          error: `Insufficient balance. Required: ${totalWithFee.toFixed(2)}, Available: ${availableBalance.toFixed(2)}`
        };
      }
    } else {
      const position = await VirtualAccountDAO.getPosition(account.id, symbol);
      if (!position || position.available_quantity < quantity) {
        return {
          success: false,
          error: `Insufficient ${symbol} to sell. Available: ${position?.available_quantity || 0}`
        };
      }
    }
    
    // Create order record
    const order = await VirtualAccountDAO.createOrder({
      account_id: account.id,
      symbol,
      side,
      order_type: 'market',
      quantity,
    });
    
    // Execute immediately
    const trade = await this.executeTrade(account, order, quantity, price);
    
    const updatedOrder = await VirtualAccountDAO.getOrder(order.id);
    
    this.emit('order:filled', { order: updatedOrder!, trade });
    
    return { success: true, order: updatedOrder! };
  }

  /**
   * Execute a limit order
   */
  private async executeLimitOrder(
    account: VirtualAccount,
    symbol: string,
    side: OrderSide,
    quantity: number,
    price: number
  ): Promise<{ success: boolean; order?: VirtualOrder; error?: string }> {
    // Validate and freeze resources
    if (side === 'buy') {
      const totalCost = price * quantity;
      const fee = this.calculateFee(totalCost, 'buy');
      const totalWithFee = totalCost + fee;
      
      const availableBalance = account.balance - account.frozen_balance;
      if (availableBalance < totalWithFee) {
        return {
          success: false,
          error: `Insufficient balance. Required: ${totalWithFee.toFixed(2)}, Available: ${availableBalance.toFixed(2)}`
        };
      }
      
      // Freeze funds
      await VirtualAccountDAO.updateAccount(account.id, {
        frozen_balance: account.frozen_balance + totalWithFee,
      });
    } else {
      const position = await VirtualAccountDAO.getPosition(account.id, symbol);
      if (!position || position.available_quantity < quantity) {
        return {
          success: false,
          error: `Insufficient ${symbol} to sell. Available: ${position?.available_quantity || 0}`
        };
      }
      
      // Freeze shares
      await VirtualAccountDAO.updatePosition(position.id, {
        available_quantity: position.available_quantity - quantity,
        frozen_quantity: position.frozen_quantity + quantity,
      });
    }
    
    // Create order record
    const order = await VirtualAccountDAO.createOrder({
      account_id: account.id,
      symbol,
      side,
      order_type: 'limit',
      quantity,
      price,
    });
    
    // Execute immediately
    const trade = await this.executeTrade(account, order, quantity, price);
    
    // Unfreeze remaining resources
    await this.unfreezeOrderResources(account, await VirtualAccountDAO.getOrder(order.id) as VirtualOrder);
    
    const updatedOrder = await VirtualAccountDAO.getOrder(order.id);
    
    this.emit('order:filled', { order: updatedOrder!, trade });
    
    return { success: true, order: updatedOrder! };
  }

  /**
   * Execute a trade
   */
  private async executeTrade(
    account: VirtualAccount,
    order: VirtualOrder,
    quantity: number,
    price: number
  ): Promise<TradeResult> {
    const total = price * quantity;
    const fee = this.calculateFee(total, order.side);
    
    // Update order
    await VirtualAccountDAO.updateOrder(order.id, {
      status: 'filled',
      filled_quantity: quantity,
      remaining_quantity: 0,
      average_fill_price: price,
      executed_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
    
    let realizedPnl: number | undefined;
    
    if (order.side === 'buy') {
      // Update account balance
      const totalCost = total + fee;
      const newBalance = account.balance - totalCost;
      
      await VirtualAccountDAO.updateAccount(account.id, {
        balance: newBalance,
        frozen_balance: account.frozen_balance - (order.frozen_amount || 0),
        total_trades: account.total_trades + 1,
      });
      
      // Update position
      await this.updatePositionAfterBuy(account.id, order.symbol, quantity, price);
      
      // Create transaction
      await VirtualAccountDAO.createTransaction({
        account_id: account.id,
        type: 'buy',
        amount: -totalCost,
        balance_after: newBalance,
        reference_type: 'order',
        reference_id: order.id,
        symbol: order.symbol,
        quantity,
        price,
        description: `Bought ${quantity} ${order.symbol} @ ${price}`,
      });
      
      // Create fee transaction
      await VirtualAccountDAO.createTransaction({
        account_id: account.id,
        type: 'fee',
        amount: -fee,
        balance_after: newBalance,
        reference_type: 'order',
        reference_id: order.id,
        symbol: order.symbol,
        description: `Trading fee for buy order`,
      });
      
    } else {
      // Get current position for realized P&L calculation
      const position = await VirtualAccountDAO.getPosition(account.id, order.symbol);
      const costBasis = position ? (quantity / position.quantity) * position.total_cost : 0;
      realizedPnl = total - costBasis - fee;
      
      // Update account balance
      const netProceeds = total - fee;
      const newBalance = account.balance + netProceeds;
      
      await VirtualAccountDAO.updateAccount(account.id, {
        balance: newBalance,
        total_realized_pnl: account.total_realized_pnl + realizedPnl,
        total_trades: account.total_trades + 1,
        winning_trades: account.winning_trades + (realizedPnl > 0 ? 1 : 0),
        losing_trades: account.losing_trades + (realizedPnl < 0 ? 1 : 0),
      });
      
      // Update position
      await this.updatePositionAfterSell(account.id, order.symbol, quantity);
      
      // Create transaction
      await VirtualAccountDAO.createTransaction({
        account_id: account.id,
        type: 'sell',
        amount: netProceeds,
        balance_after: newBalance,
        reference_type: 'order',
        reference_id: order.id,
        symbol: order.symbol,
        quantity,
        price,
        description: `Sold ${quantity} ${order.symbol} @ ${price}`,
        metadata: { realizedPnl },
      });
      
      // Create fee transaction
      await VirtualAccountDAO.createTransaction({
        account_id: account.id,
        type: 'fee',
        amount: -fee,
        balance_after: newBalance,
        reference_type: 'order',
        reference_id: order.id,
        symbol: order.symbol,
        description: `Trading fee for sell order`,
      });
    }
    
    log.info(`Executed ${order.side} order: ${quantity} ${order.symbol} @ ${price}`);
    
    return {
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      quantity,
      price,
      total,
      fee,
      executedAt: new Date(),
      realizedPnl,
    };
  }

  // ============================================
  // Order Book Management
  // ============================================

  /**
   * Add order to order book
   */
  private async addOrderToBook(
    account: VirtualAccount,
    params: {
      symbol: string;
      side: OrderSide;
      type: OrderType;
      quantity: number;
      price?: number;
      stopPrice?: number;
      timeInForce: 'GTC' | 'IOC' | 'FOK' | 'GTD';
      expiresAt?: Date;
    }
  ): Promise<{ success: boolean; order?: VirtualOrder; error?: string }> {
    const { symbol, side, type, quantity, price, stopPrice, timeInForce, expiresAt } = params;
    
    // Freeze resources
    if (side === 'buy') {
      const orderPrice = price || stopPrice || 0;
      const totalCost = orderPrice * quantity;
      const fee = this.calculateFee(totalCost, 'buy');
      const totalWithFee = totalCost + fee;
      
      const availableBalance = account.balance - account.frozen_balance;
      if (availableBalance < totalWithFee) {
        return {
          success: false,
          error: `Insufficient balance. Required: ${totalWithFee.toFixed(2)}, Available: ${availableBalance.toFixed(2)}`
        };
      }
      
      // Freeze funds
      await VirtualAccountDAO.updateAccount(account.id, {
        frozen_balance: account.frozen_balance + totalWithFee,
      });
    } else {
      const position = await VirtualAccountDAO.getPosition(account.id, symbol);
      if (!position || position.available_quantity < quantity) {
        return {
          success: false,
          error: `Insufficient ${symbol} to sell. Available: ${position?.available_quantity || 0}`
        };
      }
      
      // Freeze shares
      await VirtualAccountDAO.updatePosition(position.id, {
        available_quantity: position.available_quantity - quantity,
        frozen_quantity: position.frozen_quantity + quantity,
      });
    }
    
    // Create order in database
    const order = await VirtualAccountDAO.createOrder({
      account_id: account.id,
      symbol,
      side,
      order_type: type === 'take_profit' ? 'stop_market' : type as any,
      quantity,
      price,
      stop_price: stopPrice,
      time_in_force: timeInForce,
      expires_at: expiresAt,
      metadata: type === 'take_profit' ? { original_type: 'take_profit' } : undefined,
    });
    
    // Update order status to open
    const updatedOrder = await VirtualAccountDAO.updateOrder(order.id, {
      status: 'open',
    });
    
    // Add to in-memory order book
    const entry: OrderBookEntry = {
      orderId: order.id,
      accountId: account.id,
      symbol,
      side,
      type,
      quantity,
      price,
      stopPrice,
      filledQuantity: 0,
      remainingQuantity: quantity,
      status: 'open',
      createdAt: new Date(),
    };
    
    this.activeOrders.set(order.id, entry);
    
    // Index by symbol
    if (!this.ordersBySymbol.has(symbol)) {
      this.ordersBySymbol.set(symbol, new Set());
    }
    this.ordersBySymbol.get(symbol)!.add(order.id);
    
    // Index by account
    if (!this.ordersByAccount.has(account.id)) {
      this.ordersByAccount.set(account.id, new Set());
    }
    this.ordersByAccount.get(account.id)!.add(order.id);
    
    // Subscribe to price updates for this symbol
    this.subscribeToPriceUpdates(symbol);
    
    this.emit('order:created', { order: updatedOrder });
    
    log.info(`Order ${order.id} added to book: ${side} ${quantity} ${symbol}`);
    
    return { success: true, order: updatedOrder };
  }

  /**
   * Remove order from order book
   */
  private removeOrderFromBook(orderId: string): void {
    const entry = this.activeOrders.get(orderId);
    if (!entry) return;
    
    // Remove from symbol index
    const symbolOrders = this.ordersBySymbol.get(entry.symbol);
    if (symbolOrders) {
      symbolOrders.delete(orderId);
      if (symbolOrders.size === 0) {
        this.ordersBySymbol.delete(entry.symbol);
        // Unsubscribe from price updates if no more orders for this symbol
        this.unsubscribeFromPriceUpdates(entry.symbol);
      }
    }
    
    // Remove from account index
    const accountOrders = this.ordersByAccount.get(entry.accountId);
    if (accountOrders) {
      accountOrders.delete(orderId);
      if (accountOrders.size === 0) {
        this.ordersByAccount.delete(entry.accountId);
      }
    }
    
    // Remove from active orders
    this.activeOrders.delete(orderId);
  }

  /**
   * Load active orders from database
   */
  private async loadActiveOrders(): Promise<void> {
    try {
      // Get all open/pending/partial orders
      // Note: This is a simplified approach; in production, we'd want pagination
      const supabase = (await import('../database/client')).getSupabaseClient();
      
      const { data: orders, error } = await supabase
        .from('virtual_orders')
        .select('*')
        .in('status', ['pending', 'open', 'partial']);
      
      if (error) {
        log.error('Error loading active orders:', error);
        return;
      }
      
      for (const order of orders || []) {
        const entry: OrderBookEntry = {
          orderId: order.id,
          accountId: order.account_id,
          symbol: order.symbol,
          side: order.side,
          type: order.order_type,
          quantity: order.quantity,
          price: order.price,
          stopPrice: order.stop_price,
          filledQuantity: order.filled_quantity || 0,
          remainingQuantity: order.remaining_quantity || order.quantity,
          status: order.status,
          createdAt: new Date(order.created_at),
        };
        
        this.activeOrders.set(order.id, entry);
        
        // Index by symbol
        if (!this.ordersBySymbol.has(order.symbol)) {
          this.ordersBySymbol.set(order.symbol, new Set());
        }
        this.ordersBySymbol.get(order.symbol)!.add(order.id);
        
        // Index by account
        if (!this.ordersByAccount.has(order.account_id)) {
          this.ordersByAccount.set(order.account_id, new Set());
        }
        this.ordersByAccount.get(order.account_id)!.add(order.id);
      }
      
      log.info(`Loaded ${orders?.length || 0} active orders`);
      
      // Subscribe to price updates for all symbols with active orders
      for (const symbol of this.ordersBySymbol.keys()) {
        this.subscribeToPriceUpdates(symbol);
      }
      
    } catch (error) {
      log.error('Error loading active orders:', error);
    }
  }

  // ============================================
  // Price Monitoring
  // ============================================

  /**
   * Start price monitoring
   */
  private startPriceMonitoring(): void {
    // Check for expired orders periodically
    this.priceCheckInterval = setInterval(() => {
      this.checkExpiredOrders();
    }, 60000); // Check every minute
  }

  /**
   * Subscribe to price updates for a symbol
   */
  private subscribeToPriceUpdates(symbol: string): void {
    if (this.priceSubscriptions.has(symbol)) return;
    
    try {
      const unsubscribe = this.dataSourceManager.subscribeToQuotes(symbol, (quote: Quote) => {
        this.handlePriceUpdate(symbol, quote);
      });
      
      this.priceSubscriptions.set(symbol, unsubscribe);
      log.debug(`Subscribed to price updates for ${symbol}`);
    } catch (error) {
      log.error(`Error subscribing to price updates for ${symbol}:`, error);
    }
  }

  /**
   * Unsubscribe from price updates for a symbol
   */
  private unsubscribeFromPriceUpdates(symbol: string): void {
    const unsubscribe = this.priceSubscriptions.get(symbol);
    if (unsubscribe) {
      unsubscribe();
      this.priceSubscriptions.delete(symbol);
      log.debug(`Unsubscribed from price updates for ${symbol}`);
    }
  }

  /**
   * Handle price update
   */
  private async handlePriceUpdate(symbol: string, quote: Quote): Promise<void> {
    this.emit('price:update', { symbol, quote });
    
    const currentPrice = quote.lastPrice;
    const orderIds = this.ordersBySymbol.get(symbol);
    
    if (!orderIds || orderIds.size === 0) return;
    
    // Check each order for this symbol
    for (const orderId of orderIds) {
      const entry = this.activeOrders.get(orderId);
      if (!entry || entry.status !== 'open') continue;
      
      try {
        await this.checkOrderTrigger(entry, currentPrice);
      } catch (error) {
        log.error(`Error checking order ${orderId}:`, error);
      }
    }
  }

  /**
   * Check if an order should be triggered
   */
  private async checkOrderTrigger(entry: OrderBookEntry, currentPrice: number): Promise<void> {
    let shouldTrigger = false;
    let executionPrice = entry.price;
    
    switch (entry.type) {
      case 'limit':
        if (entry.side === 'buy' && currentPrice <= (entry.price || 0)) {
          shouldTrigger = true;
          executionPrice = entry.price;
        } else if (entry.side === 'sell' && currentPrice >= (entry.price || 0)) {
          shouldTrigger = true;
          executionPrice = entry.price;
        }
        break;
        
      case 'stop':
      case 'stop_market':
        if (entry.side === 'buy' && currentPrice >= (entry.stopPrice || 0)) {
          shouldTrigger = true;
          executionPrice = currentPrice; // Market price
        } else if (entry.side === 'sell' && currentPrice <= (entry.stopPrice || 0)) {
          shouldTrigger = true;
          executionPrice = currentPrice;
        }
        break;
        
      case 'stop_limit':
        if (entry.side === 'buy' && currentPrice >= (entry.stopPrice || 0)) {
          // Convert to limit order at entry.price
          shouldTrigger = true;
          executionPrice = entry.price;
        } else if (entry.side === 'sell' && currentPrice <= (entry.stopPrice || 0)) {
          shouldTrigger = true;
          executionPrice = entry.price;
        }
        break;
        
      case 'take_profit':
        if (entry.side === 'sell' && currentPrice >= (entry.stopPrice || 0)) {
          shouldTrigger = true;
          executionPrice = currentPrice;
        } else if (entry.side === 'buy' && currentPrice <= (entry.stopPrice || 0)) {
          shouldTrigger = true;
          executionPrice = currentPrice;
        }
        break;
    }
    
    if (shouldTrigger && executionPrice) {
      await this.triggerOrder(entry, executionPrice);
    }
  }

  /**
   * Trigger an order execution
   */
  private async triggerOrder(entry: OrderBookEntry, price: number): Promise<void> {
    try {
      const account = await VirtualAccountDAO.getAccountById(entry.accountId);
      if (!account) {
        log.error(`Account ${entry.accountId} not found for order ${entry.orderId}`);
        return;
      }
      
      const order = await VirtualAccountDAO.getOrder(entry.orderId);
      if (!order || order.status !== 'open') {
        return;
      }
      
      log.info(`Triggering order ${entry.orderId} at price ${price}`);
      
      // Execute the trade
      const trade = await this.executeTrade(account, order, entry.remainingQuantity, price);
      
      // Remove from order book
      this.removeOrderFromBook(entry.orderId);
      
      const updatedOrder = await VirtualAccountDAO.getOrder(entry.orderId);
      
      this.emit('order:filled', { order: updatedOrder!, trade });
      
    } catch (error) {
      log.error(`Error triggering order ${entry.orderId}:`, error);
    }
  }

  /**
   * Check for expired orders
   */
  private async checkExpiredOrders(): Promise<void> {
    const now = new Date();
    
    for (const [orderId, entry] of this.activeOrders) {
      const order = await VirtualAccountDAO.getOrder(orderId);
      if (!order) continue;
      
      if (order.expires_at && new Date(order.expires_at) <= now) {
        // Order has expired
        const account = await VirtualAccountDAO.getAccountById(entry.accountId);
        if (account) {
          await this.unfreezeOrderResources(account, order);
        }
        
        const updatedOrder = await VirtualAccountDAO.updateOrder(orderId, {
          status: 'expired',
          completed_at: now.toISOString(),
        });
        
        this.removeOrderFromBook(orderId);
        
        this.emit('order:expired', { order: updatedOrder });
        
        log.info(`Order ${orderId} expired`);
      }
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Validate order parameters
   */
  private validateOrder(params: {
    symbol: string;
    side: OrderSide;
    type: OrderType;
    quantity: number;
    price?: number;
    stopPrice?: number;
  }): { valid: boolean; error?: string } {
    if (!params.symbol) {
      return { valid: false, error: 'Symbol is required' };
    }
    
    if (!params.quantity || params.quantity <= 0) {
      return { valid: false, error: 'Quantity must be positive' };
    }
    
    if (params.type === 'limit' && !params.price) {
      return { valid: false, error: 'Price is required for limit orders' };
    }
    
    if ((params.type === 'stop' || params.type === 'stop_limit' || params.type === 'take_profit') && !params.stopPrice) {
      return { valid: false, error: 'Stop price is required for stop/take-profit orders' };
    }
    
    if (params.type === 'stop_limit' && !params.price) {
      return { valid: false, error: 'Limit price is required for stop-limit orders' };
    }
    
    return { valid: true };
  }

  /**
   * Calculate trading fee
   */
  calculateFee(total: number, side: OrderSide): number {
    const config = this.config.feeConfig;
    
    // Commission
    let fee = Math.max(total * config.commission, config.minCommission);
    
    // Stamp duty (sell only)
    if (side === 'sell') {
      fee += total * config.stamp;
    }
    
    // Transfer fee
    fee += total * config.transfer;
    
    return fee;
  }

  /**
   * Unfreeze resources for an order
   */
  private async unfreezeOrderResources(account: VirtualAccount, order: VirtualOrder): Promise<void> {
    if (order.side === 'buy' && order.frozen_amount) {
      await VirtualAccountDAO.updateAccount(account.id, {
        frozen_balance: Math.max(0, account.frozen_balance - order.frozen_amount),
      });
      
      await VirtualAccountDAO.createTransaction({
        account_id: account.id,
        type: 'unfrozen',
        amount: order.frozen_amount,
        balance_after: account.balance,
        reference_type: 'order',
        reference_id: order.id,
        symbol: order.symbol,
        description: 'Funds unfrozen',
      });
    } else if (order.side === 'sell' && order.frozen_quantity) {
      const position = await VirtualAccountDAO.getPosition(account.id, order.symbol);
      if (position) {
        await VirtualAccountDAO.updatePosition(position.id, {
          available_quantity: position.available_quantity + order.frozen_quantity,
          frozen_quantity: Math.max(0, position.frozen_quantity - order.frozen_quantity),
        });
      }
    }
  }

  /**
   * Update position after a buy
   */
  private async updatePositionAfterBuy(
    accountId: string,
    symbol: string,
    quantity: number,
    price: number
  ): Promise<void> {
    const existingPosition = await VirtualAccountDAO.getPosition(accountId, symbol);
    
    if (existingPosition) {
      const newQuantity = existingPosition.quantity + quantity;
      const newTotalCost = existingPosition.total_cost + (quantity * price);
      const newAverageCost = newTotalCost / newQuantity;
      
      await VirtualAccountDAO.updatePosition(existingPosition.id, {
        quantity: newQuantity,
        available_quantity: existingPosition.available_quantity + quantity,
        average_cost: newAverageCost,
        total_cost: newTotalCost,
      });
    } else {
      await VirtualAccountDAO.upsertPosition(accountId, symbol, {
        quantity,
        average_cost: price,
        total_cost: quantity * price,
      });
    }
  }

  /**
   * Update position after a sell
   */
  private async updatePositionAfterSell(
    accountId: string,
    symbol: string,
    quantity: number
  ): Promise<void> {
    const position = await VirtualAccountDAO.getPosition(accountId, symbol);
    if (!position) return;
    
    const newQuantity = position.quantity - quantity;
    const newTotalCost = position.total_cost * (newQuantity / position.quantity);
    
    if (newQuantity <= 0) {
      await VirtualAccountDAO.deletePosition(position.id);
    } else {
      await VirtualAccountDAO.updatePosition(position.id, {
        quantity: newQuantity,
        available_quantity: position.available_quantity - quantity,
        total_cost: newTotalCost,
        average_cost: newTotalCost / newQuantity,
      });
    }
  }

  // ============================================
  // Query Methods
  // ============================================

  /**
   * Get active orders for a symbol
   */
  getActiveOrdersForSymbol(symbol: string): OrderBookEntry[] {
    const orderIds = this.ordersBySymbol.get(symbol);
    if (!orderIds) return [];
    
    return Array.from(orderIds)
      .map(id => this.activeOrders.get(id))
      .filter((entry): entry is OrderBookEntry => entry !== undefined);
  }

  /**
   * Get active orders for an account
   */
  getActiveOrdersForAccount(accountId: string): OrderBookEntry[] {
    const orderIds = this.ordersByAccount.get(accountId);
    if (!orderIds) return [];
    
    return Array.from(orderIds)
      .map(id => this.activeOrders.get(id))
      .filter((entry): entry is OrderBookEntry => entry !== undefined);
  }

  /**
   * Get engine statistics
   */
  getStats(): {
    totalActiveOrders: number;
    symbolsWithOrders: number;
    accountsWithOrders: number;
  } {
    return {
      totalActiveOrders: this.activeOrders.size,
      symbolsWithOrders: this.ordersBySymbol.size,
      accountsWithOrders: this.ordersByAccount.size,
    };
  }
}

export default PaperTradingEngine;