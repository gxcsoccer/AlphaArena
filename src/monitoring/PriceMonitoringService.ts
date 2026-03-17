import { EventEmitter } from 'events';
import { ConditionalOrdersDAO } from '../database/conditional-orders.dao';
import { OCOOrdersDAO, OCOOrder } from '../database/oco-orders.dao';
import { TradesDAO } from '../database/trades.dao';
import { getMonitoringService } from './MonitoringService';

/**
 * Price Monitoring Service
 * 
 * Monitors market prices and triggers conditional orders (stop-loss/take-profit)
 * and OCO (One-Cancels-Other) orders when price conditions are met.
 */
export class PriceMonitoringService extends EventEmitter {
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly checkIntervalMs: number = 5000; // Check every 5 seconds
  private conditionalOrdersDAO: ConditionalOrdersDAO;
  private ocoOrdersDAO: OCOOrdersDAO;
  private tradesDAO: TradesDAO;
  private monitoring = getMonitoringService();
  private isRunning: boolean = false;
  private watchedSymbols: Set<string> = new Set();

  constructor() {
    super();
    this.conditionalOrdersDAO = new ConditionalOrdersDAO();
    this.ocoOrdersDAO = new OCOOrdersDAO();
    this.tradesDAO = new TradesDAO();
  }

  /**
   * Start the price monitoring service
   */
  public start(): void {
    if (this.isRunning) {
      console.warn('[PriceMonitoring] Service is already running');
      return;
    }

    this.isRunning = true;
    console.log('[PriceMonitoring] Service started');

    // Check prices periodically
    this.checkInterval = setInterval(() => {
      this.checkPrices().catch(err => {
        console.error('[PriceMonitoring] Error checking prices:', err);
        this.monitoring.trackError(err, { operation: 'price-check' }, 'high');
      });
    }, this.checkIntervalMs);
  }

  /**
   * Stop the price monitoring service
   */
  public stop(): void {
    if (!this.isRunning) return;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.isRunning = false;
    console.log('[PriceMonitoring] Service stopped');
  }

  /**
   * Add a symbol to watch
   */
  public watchSymbol(symbol: string): void {
    this.watchedSymbols.add(symbol);
    console.log(`[PriceMonitoring] Now watching symbol: ${symbol}`);
  }

  /**
   * Remove a symbol from watching
   */
  public unwatchSymbol(symbol: string): void {
    this.watchedSymbols.delete(symbol);
    console.log(`[PriceMonitoring] Stopped watching symbol: ${symbol}`);
  }

  /**
   * Check prices for all watched symbols and trigger conditional orders
   */
  private async checkPrices(): Promise<void> {
    if (this.watchedSymbols.size === 0) {
      return;
    }

    for (const symbol of this.watchedSymbols) {
      try {
        await this.checkSymbolPrices(symbol);
      } catch (error: any) {
        console.error(`[PriceMonitoring] Error checking ${symbol}:`, error);
        this.emit('error', { symbol, error });
      }
    }
  }

  /**
   * Check prices for a specific symbol and trigger orders
   */
  private async checkSymbolPrices(symbol: string): Promise<void> {
    // Get current market price (in production, this would come from a price feed)
    const currentPrice = await this.getCurrentPrice(symbol);
    
    if (!currentPrice) {
      console.warn(`[PriceMonitoring] No price available for ${symbol}`);
      return;
    }

    // Process OCO orders first (they have higher priority due to linked cancellation)
    await this.checkOCOOrders(symbol, currentPrice);

    // Then process regular conditional orders
    await this.checkConditionalOrders(symbol, currentPrice);
  }

  /**
   * Check and trigger OCO orders for a symbol
   */
  private async checkOCOOrders(symbol: string, currentPrice: number): Promise<void> {
    const ordersToTrigger = await this.ocoOrdersDAO.getOrdersToTrigger(symbol, currentPrice);

    if (ordersToTrigger.length > 0) {
      console.log(`[PriceMonitoring] Found ${ordersToTrigger.length} OCO orders to trigger for ${symbol} @ ${currentPrice}`);
      
      for (const { ocoOrder, triggerType } of ordersToTrigger) {
        await this.triggerOCOOrder(ocoOrder, triggerType, currentPrice);
      }

      this.emit('oco-orders-triggered', { symbol, price: currentPrice, count: ordersToTrigger.length });
    }
  }

  /**
   * Check and trigger regular conditional orders for a symbol
   */
  private async checkConditionalOrders(symbol: string, currentPrice: number): Promise<void> {
    const ordersToTrigger = await this.conditionalOrdersDAO.getOrdersToTrigger(symbol, currentPrice);

    if (ordersToTrigger.length > 0) {
      console.log(`[PriceMonitoring] Found ${ordersToTrigger.length} conditional orders to trigger for ${symbol} @ ${currentPrice}`);
      
      for (const order of ordersToTrigger) {
        // Skip if this conditional order is part of an OCO order
        // OCO orders are handled separately above
        await this.triggerOrder(order, currentPrice);
      }

      this.emit('orders-triggered', { symbol, price: currentPrice, count: ordersToTrigger.length });
    }
  }

  /**
   * Get current market price for a symbol
   */
  private async getCurrentPrice(symbol: string): Promise<number | null> {
    try {
      // In production, this would connect to a price feed or exchange API
      // For now, we'll use a simulated price based on the order book
      const response = await fetch(`http://localhost:3001/api/orderbook/${symbol}/best`);
      if (!response.ok) return null;
      
      const data = await response.json();
      if (data.success && data.data) {
        // Use mid-price (average of best bid and ask)
        const { bestBid, bestAsk } = data.data;
        if (bestBid && bestAsk) {
          return (bestBid + bestAsk) / 2;
        }
        return bestBid || bestAsk || null;
      }
      return null;
    } catch (error) {
      console.error(`[PriceMonitoring] Failed to get price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Trigger an OCO order
   * 
   * When one leg of an OCO order triggers, the other leg is automatically cancelled
   */
  private async triggerOCOOrder(
    ocoOrder: OCOOrder,
    triggerType: 'take_profit' | 'stop_loss',
    currentPrice: number
  ): Promise<void> {
    try {
      console.log(`[PriceMonitoring] Triggering OCO order ${ocoOrder.id}: ${triggerType} @ ${currentPrice}`);

      // Determine which leg to execute and which to cancel
      const triggeredLeg = triggerType === 'take_profit' ? {
        triggerPrice: ocoOrder.takeProfitTriggerPrice,
        quantity: ocoOrder.takeProfitQuantity,
        orderType: ocoOrder.takeProfitOrderType,
        limitPrice: ocoOrder.takeProfitLimitPrice,
      } : {
        triggerPrice: ocoOrder.stopLossTriggerPrice,
        quantity: ocoOrder.stopLossQuantity,
        orderType: ocoOrder.stopLossOrderType,
        limitPrice: ocoOrder.stopLossLimitPrice,
      };

      // Create a market order when the condition is triggered
      const executionPrice = triggeredLeg.orderType === 'limit' && triggeredLeg.limitPrice
        ? triggeredLeg.limitPrice
        : currentPrice;

      const trade = {
        symbol: ocoOrder.symbol,
        side: ocoOrder.side,
        price: executionPrice,
        quantity: triggeredLeg.quantity,
        total: executionPrice * triggeredLeg.quantity,
        fee: executionPrice * triggeredLeg.quantity * 0.001, // 0.1% fee
        feeCurrency: ocoOrder.symbol.split('/')[1],
        orderId: `oco_triggered_${ocoOrder.id}_${triggerType}`,
        tradeId: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        executedAt: new Date(),
      };

      // Save the trade
      await this.tradesDAO.create(trade);

      // Cancel the other leg's conditional order if it exists
      let cancelledOrderId: string | null = null;
      if (triggerType === 'take_profit' && ocoOrder.stopLossConditionalOrderId) {
        await this.conditionalOrdersDAO.cancel(ocoOrder.stopLossConditionalOrderId);
        cancelledOrderId = ocoOrder.stopLossConditionalOrderId;
      } else if (triggerType === 'stop_loss' && ocoOrder.takeProfitConditionalOrderId) {
        await this.conditionalOrdersDAO.cancel(ocoOrder.takeProfitConditionalOrderId);
        cancelledOrderId = ocoOrder.takeProfitConditionalOrderId;
      }

      // Update the OCO order status
      await this.ocoOrdersDAO.trigger(
        ocoOrder.id,
        triggerType,
        trade.orderId!,
        cancelledOrderId || `cancelled_${triggerType === 'take_profit' ? 'stop_loss' : 'take_profit'}_${ocoOrder.id}`
      );

      // Emit event for notification
      this.emit('oco-order-triggered', {
        ocoOrderId: ocoOrder.id,
        triggerType,
        symbol: ocoOrder.symbol,
        side: ocoOrder.side,
        triggeredLeg,
        executedPrice: executionPrice,
        quantity: triggeredLeg.quantity,
        tradeId: trade.tradeId,
      });

      console.log(`[PriceMonitoring] OCO order ${ocoOrder.id} triggered successfully via ${triggerType}`);
    } catch (error: any) {
      console.error(`[PriceMonitoring] Failed to trigger OCO order ${ocoOrder.id}:`, error);
      this.monitoring.trackError(error, { 
        operation: 'trigger-oco-order',
        metadata: { ocoOrderId: ocoOrder.id, triggerType },
      }, 'critical');
      this.emit('error', { ocoOrderId: ocoOrder.id, error });
    }
  }

  /**
   * Trigger a conditional order by creating a market order
   */
  private async triggerOrder(order: any, currentPrice: number): Promise<void> {
    try {
      console.log(`[PriceMonitoring] Triggering order ${order.id}: ${order.orderType} ${order.side} ${order.quantity} @ ${currentPrice}`);

      // Create a market order when the condition is triggered
      const marketOrder = {
        symbol: order.symbol,
        side: order.side,
        type: 'market' as const,
        quantity: order.quantity,
        price: currentPrice,
      };

      // In production, this would go through the matching engine
      // For now, we'll simulate it by creating a trade record
      const trade = {
        symbol: order.symbol,
        side: order.side,
        price: currentPrice,
        quantity: order.quantity,
        total: currentPrice * order.quantity,
        fee: currentPrice * order.quantity * 0.001, // 0.1% fee
        feeCurrency: order.symbol.split('/')[1],
        orderId: `triggered_${order.id}`,
        tradeId: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        executedAt: new Date(),
      };

      await this.tradesDAO.create(trade);

      // Update the conditional order status
      await this.conditionalOrdersDAO.trigger(order.id, trade.tradeId!);

      // Emit event for notification
      this.emit('order-triggered', {
        orderId: order.id,
        orderType: order.orderType,
        symbol: order.symbol,
        side: order.side,
        triggerPrice: order.triggerPrice,
        executedPrice: currentPrice,
        quantity: order.quantity,
        tradeId: trade.tradeId,
      });

      console.log(`[PriceMonitoring] Order ${order.id} triggered successfully, trade: ${trade.tradeId}`);
    } catch (error: any) {
      console.error(`[PriceMonitoring] Failed to trigger order ${order.id}:`, error);
      this.monitoring.trackError(error, { 
        operation: 'trigger-order',
        metadata: { orderId: order.id },
      }, 'critical');
      this.emit('error', { orderId: order.id, error });
    }
  }

  /**
   * Get service status
   */
  public getStatus(): {
    isRunning: boolean;
    watchedSymbols: string[];
    checkIntervalMs: number;
  } {
    return {
      isRunning: this.isRunning,
      watchedSymbols: Array.from(this.watchedSymbols),
      checkIntervalMs: this.checkIntervalMs,
    };
  }
}

// Singleton instance
let instance: PriceMonitoringService | null = null;

export function getPriceMonitoringService(): PriceMonitoringService {
  if (!instance) {
    instance = new PriceMonitoringService();
  }
  return instance;
}
