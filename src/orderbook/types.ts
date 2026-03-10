/**
 * Order types
 */
export enum OrderType {
  BID = 'bid',   // 买单
  ASK = 'ask'    // 卖单
}

/**
 * Order side
 */
export enum OrderSide {
  BUY = 'buy',
  SELL = 'sell'
}

/**
 * Order interface
 */
export interface Order {
  id: string;
  price: number;
  quantity: number;
  timestamp: number;
  type: OrderType;
}

/**
 * Price level interface
 */
export interface PriceLevel {
  price: number;
  orders: Order[];
  totalQuantity: number;
}

/**
 * Order book snapshot
 */
export interface OrderBookSnapshot {
  bids: PriceLevel[];
  asks: PriceLevel[];
  timestamp: number;
}

/**
 * Order book depth
 */
export interface OrderBookDepth {
  bidDepth: number;
  askDepth: number;
  totalDepth: number;
}
