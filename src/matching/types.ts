import { Order } from '../orderbook/types';

/**
 * Trade status
 */
export enum TradeStatus {
  FILLED = 'filled',           // 完全成交
  PARTIALLY_FILLED = 'partially_filled',  // 部分成交
  PENDING = 'pending'          // 待成交
}

/**
 * Trade record - 成交记录
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
 */
export interface OrderWithFill {
  order: Order;
  filledQuantity: number;
  remainingQuantity: number;
  status: TradeStatus;
}

/**
 * Match result - 撮合结果
 */
export interface MatchResult {
  trades: Trade[];
  remainingOrder: OrderWithFill | null;  // 未完全成交的订单
}
