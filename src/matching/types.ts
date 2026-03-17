/**
 * Matching engine types
 * 
 * @module matching/types
 * @description Type definitions for the order matching engine
 */

import { Order } from '../orderbook/types';

/**
 * Trade status enumeration
 * 
 * Represents the execution status of a trade.
 * 
 * @property {string} FILLED - Trade is fully executed
 * @property {string} PARTIALLY_FILLED - Trade is partially executed
 * @property {string} PENDING - Trade is waiting to be executed
 * 
 * @example
 * ```typescript
 * if (trade.status === TradeStatus.FILLED) {
 *   console.log('Trade completed successfully');
 * }
 * ```
 */
export enum TradeStatus {
  FILLED = 'filled', // 完全成交
  PARTIALLY_FILLED = 'partially_filled', // 部分成交
  PENDING = 'pending', // 待成交
}

/**
 * Trade record interface
 * 
 * Represents a single executed trade from the matching engine.
 * A trade is created when a buy order matches with a sell order.
 * 
 * @property {string} id - Unique trade identifier
 * @property {number} price - Execution price
 * @property {number} quantity - Executed quantity
 * @property {number} timestamp - Unix timestamp in milliseconds
 * @property {string} buyOrderId - ID of the buy order involved
 * @property {string} sellOrderId - ID of the sell order involved
 * @property {TradeStatus} status - Current trade status
 * 
 * @example
 * ```typescript
 * const trade: Trade = {
 *   id: 'trade-123',
 *   price: 50000,
 *   quantity: 1.5,
 *   timestamp: Date.now(),
 *   buyOrderId: 'order-buy-1',
 *   sellOrderId: 'order-sell-1',
 *   status: TradeStatus.FILLED,
 * };
 * ```
 */
export interface Trade {
  id: string;
  price: number;
  quantity: number;
  timestamp: number;
  buyOrderId: string;
  sellOrderId: string;
  status: TradeStatus;
}

/**
 * Order with fill information
 * 
 * Tracks the execution state of an order during matching.
 * 
 * @property {Order} order - The original order
 * @property {number} filledQuantity - Quantity that has been filled
 * @property {number} remainingQuantity - Quantity still to be filled
 * @property {TradeStatus} status - Current order status
 * 
 * @example
 * ```typescript
 * const orderWithFill: OrderWithFill = {
 *   order: { id: 'order-1', price: 50000, quantity: 10, ... },
 *   filledQuantity: 7,
 *   remainingQuantity: 3,
 *   status: TradeStatus.PARTIALLY_FILLED,
 * };
 * ```
 */
export interface OrderWithFill {
  order: Order;
  filledQuantity: number;
  remainingQuantity: number;
  status: TradeStatus;
}

/**
 * Match result interface
 * 
 * Result of matching an order against the order book.
 * Contains all trades generated and any remaining unfilled portion.
 * 
 * @property {Trade[]} trades - Array of trades generated
 * @property {OrderWithFill | null} remainingOrder - Unfilled order portion (if any)
 * 
 * @example
 * ```typescript
 * const result: MatchResult = matchingEngine.match(order);
 * 
 * // Process generated trades
 * result.trades.forEach(trade => {
 *   console.log(`Trade: ${trade.quantity} @ ${trade.price}`);
 * });
 * 
 * // Check if order was fully filled
 * if (result.remainingOrder) {
 *   console.log(`Remaining: ${result.remainingOrder.remainingQuantity}`);
 * }
 * ```
 */
export interface MatchResult {
  trades: Trade[];
  remainingOrder: OrderWithFill | null; // 未完全成交的订单
}
