/**
 * Virtual Account Service
 * Business logic for virtual trading operations
 */

import { VirtualAccountDAO, VirtualAccount, VirtualPosition, VirtualOrder, AccountTransaction, AccountSummary } from '../database/virtual-account.dao';
import { createLogger } from '../utils/logger';
import { DataSourceManager } from '../datasource/DataSourceManager';

const log = createLogger('VirtualAccountService');

// ============================================
// Types
// ============================================

export interface BuyOrderParams {
  userId: string;
  symbol: string;
  quantity: number;
  orderType: 'market' | 'limit';
  price?: number;  // Required for limit orders
  timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'GTD';
  expiresAt?: Date;
}

export interface SellOrderParams {
  userId: string;
  symbol: string;
  quantity: number;
  orderType: 'market' | 'limit';
  price?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'GTD';
  expiresAt?: Date;
}

export interface OrderResult {
  success: boolean;
  order?: VirtualOrder;
  error?: string;
}

export interface TradeExecution {
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  total: number;
  fee: number;
}

// ============================================
// Service Class
// ============================================

export class VirtualAccountService {
  private static instance: VirtualAccountService;
  private dataSourceManager: DataSourceManager;

  private constructor() {
    this.dataSourceManager = DataSourceManager.getInstance();
  }

  static getInstance(): VirtualAccountService {
    if (!VirtualAccountService.instance) {
      VirtualAccountService.instance = new VirtualAccountService();
    }
    return VirtualAccountService.instance;
  }

  // ============================================
  // Account Operations
  // ============================================

  /**
   * Get or create account for user
   */
  async getAccount(userId: string): Promise<VirtualAccount> {
    return VirtualAccountDAO.getOrCreateAccount(userId);
  }

  /**
   * Get account summary
   */
  async getAccountSummary(userId: string): Promise<AccountSummary | null> {
    return VirtualAccountDAO.getAccountSummary(userId);
  }

  /**
   * Reset account
   */
  async resetAccount(userId: string, newCapital?: number): Promise<VirtualAccount> {
    const account = await this.getAccount(userId);
    return VirtualAccountDAO.resetAccount(account.id, newCapital);
  }

  /**
   * Update all position prices for an account
   */
  async updatePositionPrices(userId: string): Promise<void> {
    const account = await this.getAccount(userId);
    const positions = await VirtualAccountDAO.getPositions(account.id);

    if (positions.length === 0) return;

    const symbols = positions.map(p => p.symbol);
    const quotes = await this.dataSourceManager.getQuotes(symbols);

    const updates = positions.map(position => {
      const quote = quotes.find(q => q.symbol === position.symbol);
      if (!quote) return null;

      const currentPrice = quote.lastPrice;
      const marketValue = position.quantity * currentPrice;
      const unrealizedPnl = marketValue - position.total_cost;
      const unrealizedPnlPct = position.total_cost > 0
        ? (unrealizedPnl / position.total_cost) * 100
        : 0;

      return {
        positionId: position.id,
        currentPrice,
        marketValue,
        unrealizedPnl,
        unrealizedPnlPct,
      };
    }).filter(Boolean) as Array<{
      positionId: string;
      currentPrice: number;
      marketValue: number;
      unrealizedPnl: number;
      unrealizedPnlPct: number;
    }>;

    await VirtualAccountDAO.updatePositionPrices(updates);
  }

  // ============================================
  // Order Operations
  // ============================================

  /**
   * Place a buy order
   */
  async placeBuyOrder(params: BuyOrderParams): Promise<OrderResult> {
    try {
      const account = await this.getAccount(params.userId);

      // Validate parameters
      if (params.quantity <= 0) {
        return { success: false, error: 'Quantity must be positive' };
      }

      // Get current price
      let executionPrice = params.price;
      if (params.orderType === 'market' || !executionPrice) {
        const quote = await this.dataSourceManager.getQuote(params.symbol);
        if (!quote) {
          return { success: false, error: 'Unable to get market price' };
        }
        executionPrice = params.orderType === 'market' ? quote.lastPrice : params.price;
      }

      // Ensure we have a valid price
      if (executionPrice === undefined || executionPrice === null) {
        return { success: false, error: 'Invalid price' };
      }

      // Calculate total cost
      const totalCost = executionPrice * params.quantity;
      const fee = this.calculateFee(totalCost);
      const totalWithFee = totalCost + fee;

      // Check if user has enough balance
      const availableBalance = account.balance - account.frozen_balance;
      if (availableBalance < totalWithFee) {
        return {
          success: false,
          error: `Insufficient balance. Required: ${totalWithFee.toFixed(2)}, Available: ${availableBalance.toFixed(2)}`
        };
      }

      // For market orders, execute immediately
      if (params.orderType === 'market') {
        return await this.executeBuyOrder(account, params.symbol, params.quantity, executionPrice, fee);
      }

      // For limit orders, create pending order and freeze funds
      const order = await VirtualAccountDAO.createOrder({
        account_id: account.id,
        symbol: params.symbol,
        side: 'buy',
        order_type: 'limit',
        quantity: params.quantity,
        price: params.price,
        time_in_force: params.timeInForce,
        expires_at: params.expiresAt,
      });

      // Freeze funds
      await VirtualAccountDAO.updateAccount(account.id, {
        frozen_balance: account.frozen_balance + totalWithFee,
      });

      await VirtualAccountDAO.updateOrder(order.id, {
        frozen_amount: totalWithFee,
        status: 'open',
      });

      // Create frozen transaction
      await VirtualAccountDAO.createTransaction({
        account_id: account.id,
        type: 'frozen',
        amount: totalWithFee,
        balance_after: account.balance,
        reference_type: 'order',
        reference_id: order.id,
        symbol: params.symbol,
        description: `Funds frozen for buy order`,
      });

      return { success: true, order };
    } catch (error: any) {
      log.error('Error placing buy order:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Place a sell order
   */
  async placeSellOrder(params: SellOrderParams): Promise<OrderResult> {
    try {
      const account = await this.getAccount(params.userId);

      // Validate parameters
      if (params.quantity <= 0) {
        return { success: false, error: 'Quantity must be positive' };
      }

      // Check if user has the position
      const position = await VirtualAccountDAO.getPosition(account.id, params.symbol);
      if (!position || position.available_quantity < params.quantity) {
        return {
          success: false,
          error: `Insufficient ${params.symbol} to sell. Available: ${position?.available_quantity || 0}`
        };
      }

      // Get current price
      let executionPrice = params.price;
      if (params.orderType === 'market' || !executionPrice) {
        const quote = await this.dataSourceManager.getQuote(params.symbol);
        if (!quote) {
          return { success: false, error: 'Unable to get market price' };
        }
        executionPrice = params.orderType === 'market' ? quote.lastPrice : params.price;
      }

      // Ensure we have a valid price
      if (executionPrice === undefined || executionPrice === null) {
        return { success: false, error: 'Invalid price' };
      }

      // For market orders, execute immediately
      if (params.orderType === 'market') {
        const total = executionPrice * params.quantity;
        const fee = this.calculateFee(total);
        return await this.executeSellOrder(account, params.symbol, params.quantity, executionPrice, fee);
      }

      // For limit orders, create pending order and freeze shares
      const order = await VirtualAccountDAO.createOrder({
        account_id: account.id,
        symbol: params.symbol,
        side: 'sell',
        order_type: 'limit',
        quantity: params.quantity,
        price: params.price,
        time_in_force: params.timeInForce,
        expires_at: params.expiresAt,
      });

      // Freeze shares
      await VirtualAccountDAO.updatePosition(position.id, {
        available_quantity: position.available_quantity - params.quantity,
        frozen_quantity: position.frozen_quantity + params.quantity,
      });

      await VirtualAccountDAO.updateOrder(order.id, {
        frozen_quantity: params.quantity,
        status: 'open',
      });

      return { success: true, order };
    } catch (error: any) {
      log.error('Error placing sell order:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(userId: string, orderId: string): Promise<OrderResult> {
    try {
      const account = await this.getAccount(userId);
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
      if (order.side === 'buy' && order.frozen_amount) {
        await VirtualAccountDAO.updateAccount(account.id, {
          frozen_balance: account.frozen_balance - order.frozen_amount,
        });

        await VirtualAccountDAO.createTransaction({
          account_id: account.id,
          type: 'unfrozen',
          amount: order.frozen_amount,
          balance_after: account.balance,
          reference_type: 'order',
          reference_id: order.id,
          symbol: order.symbol,
          description: 'Funds unfrozen from cancelled order',
        });
      } else if (order.side === 'sell' && order.frozen_quantity) {
        const position = await VirtualAccountDAO.getPosition(account.id, order.symbol);
        if (position) {
          await VirtualAccountDAO.updatePosition(position.id, {
            available_quantity: position.available_quantity + order.frozen_quantity,
            frozen_quantity: position.frozen_quantity - order.frozen_quantity,
          });
        }
      }

      // Cancel the order
      const cancelledOrder = await VirtualAccountDAO.cancelOrder(orderId);

      return { success: true, order: cancelledOrder };
    } catch (error: any) {
      log.error('Error cancelling order:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get orders for user
   */
  async getOrders(
    userId: string,
    options?: {
      status?: VirtualOrder['status'][];
      symbol?: string;
      side?: 'buy' | 'sell';
      limit?: number;
      offset?: number;
    }
  ): Promise<{ orders: VirtualOrder[]; total: number }> {
    const account = await this.getAccount(userId);
    return VirtualAccountDAO.getOrders(account.id, options);
  }

  /**
   * Get order by ID
   */
  async getOrder(userId: string, orderId: string): Promise<VirtualOrder | null> {
    const account = await this.getAccount(userId);
    const order = await VirtualAccountDAO.getOrder(orderId);
    
    if (!order || order.account_id !== account.id) {
      return null;
    }
    
    return order;
  }

  // ============================================
  // Position Operations
  // ============================================

  /**
   * Get positions for user
   */
  async getPositions(userId: string): Promise<VirtualPosition[]> {
    const account = await this.getAccount(userId);
    return VirtualAccountDAO.getPositions(account.id);
  }

  // ============================================
  // Transaction History
  // ============================================

  /**
   * Get transaction history
   */
  async getTransactions(
    userId: string,
    options?: {
      type?: AccountTransaction['type'];
      symbol?: string;
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{ transactions: AccountTransaction[]; total: number }> {
    const account = await this.getAccount(userId);
    return VirtualAccountDAO.getTransactions(account.id, options);
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Execute a buy order immediately
   */
  private async executeBuyOrder(
    account: VirtualAccount,
    symbol: string,
    quantity: number,
    price: number,
    fee: number
  ): Promise<OrderResult> {
    const totalCost = price * quantity;
    const totalWithFee = totalCost + fee;

    // Create order record
    const order = await VirtualAccountDAO.createOrder({
      account_id: account.id,
      symbol,
      side: 'buy',
      order_type: 'market',
      quantity,
    });

    // Update order status
    await VirtualAccountDAO.updateOrder(order.id, {
      status: 'filled',
      filled_quantity: quantity,
      remaining_quantity: 0,
      average_fill_price: price,
      executed_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    // Update account balance
    const newBalance = account.balance - totalWithFee;
    await VirtualAccountDAO.updateAccount(account.id, {
      balance: newBalance,
      total_trades: account.total_trades + 1,
    });

    // Create transaction
    await VirtualAccountDAO.createTransaction({
      account_id: account.id,
      type: 'buy',
      amount: -totalWithFee,
      balance_after: newBalance,
      reference_type: 'order',
      reference_id: order.id,
      symbol,
      quantity,
      price,
      description: `Bought ${quantity} ${symbol} @ ${price}`,
    });

    // Create fee transaction
    await VirtualAccountDAO.createTransaction({
      account_id: account.id,
      type: 'fee',
      amount: -fee,
      balance_after: newBalance,
      reference_type: 'order',
      reference_id: order.id,
      symbol,
      description: `Trading fee for buy order`,
    });

    // Update or create position
    await this.updatePositionAfterBuy(account.id, symbol, quantity, price);

    log.info(`Executed buy order: ${quantity} ${symbol} @ ${price}`);

    return { success: true, order: await VirtualAccountDAO.getOrder(order.id) as VirtualOrder };
  }

  /**
   * Execute a sell order immediately
   */
  private async executeSellOrder(
    account: VirtualAccount,
    symbol: string,
    quantity: number,
    price: number,
    fee: number
  ): Promise<OrderResult> {
    const totalProceeds = price * quantity;
    const netProceeds = totalProceeds - fee;

    // Get current position
    const position = await VirtualAccountDAO.getPosition(account.id, symbol);
    if (!position) {
      return { success: false, error: 'Position not found' };
    }

    // Create order record
    const order = await VirtualAccountDAO.createOrder({
      account_id: account.id,
      symbol,
      side: 'sell',
      order_type: 'market',
      quantity,
    });

    // Update order status
    await VirtualAccountDAO.updateOrder(order.id, {
      status: 'filled',
      filled_quantity: quantity,
      remaining_quantity: 0,
      average_fill_price: price,
      executed_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    // Calculate realized P&L
    const costBasis = (quantity / position.quantity) * position.total_cost;
    const realizedPnl = totalProceeds - costBasis;

    // Update account balance
    const newBalance = account.balance + netProceeds;
    const newRealizedPnl = account.total_realized_pnl + realizedPnl;
    
    await VirtualAccountDAO.updateAccount(account.id, {
      balance: newBalance,
      total_realized_pnl: newRealizedPnl,
      total_trades: account.total_trades + 1,
      winning_trades: account.winning_trades + (realizedPnl > 0 ? 1 : 0),
      losing_trades: account.losing_trades + (realizedPnl < 0 ? 1 : 0),
    });

    // Create transaction
    await VirtualAccountDAO.createTransaction({
      account_id: account.id,
      type: 'sell',
      amount: netProceeds,
      balance_after: newBalance,
      reference_type: 'order',
      reference_id: order.id,
      symbol,
      quantity,
      price,
      description: `Sold ${quantity} ${symbol} @ ${price}`,
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
      symbol,
      description: `Trading fee for sell order`,
    });

    // Update position
    await this.updatePositionAfterSell(account.id, symbol, quantity, realizedPnl);

    log.info(`Executed sell order: ${quantity} ${symbol} @ ${price}, P&L: ${realizedPnl.toFixed(2)}`);

    return { success: true, order: await VirtualAccountDAO.getOrder(order.id) as VirtualOrder };
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
      // Update existing position (average cost)
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
      // Create new position
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
    quantity: number,
    _realizedPnl: number
  ): Promise<void> {
    const position = await VirtualAccountDAO.getPosition(accountId, symbol);
    if (!position) return;

    const newQuantity = position.quantity - quantity;
    const newAvailable = position.available_quantity - quantity;
    const newTotalCost = position.total_cost * (newQuantity / position.quantity);

    if (newQuantity <= 0) {
      // Position closed, delete it
      await VirtualAccountDAO.deletePosition(position.id);
    } else {
      // Update position
      await VirtualAccountDAO.updatePosition(position.id, {
        quantity: newQuantity,
        available_quantity: Math.max(0, newAvailable),
        total_cost: newTotalCost,
        average_cost: newTotalCost / newQuantity,
      });
    }
  }

  /**
   * Calculate trading fee
   */
  private calculateFee(total: number): number {
    // 0.1% fee
    return total * 0.001;
  }
}

export default VirtualAccountService;