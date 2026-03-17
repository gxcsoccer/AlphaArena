/**
 * Order types enumeration
 * 
 * Defines the two types of orders in a trading system:
 * - BID: Buy order (买家报价)
 * - ASK: Sell order (卖家报价)
 * 
 * @example
 * ```typescript
 * const orderType = OrderType.BID;
 * console.log(orderType); // 'bid'
 * ```
 */
export enum OrderType {
  BID = 'bid', // 买单 - 买入报价
  ASK = 'ask', // 卖单 - 卖出报价
}

/**
 * Order side enumeration
 * 
 * Defines the direction of a trade:
 * - BUY: Buying position (开多/买入)
 * - SELL: Selling position (平多/卖出)
 * 
 * @example
 * ```typescript
 * const side = OrderSide.BUY;
 * console.log(side); // 'buy'
 * ```
 */
export enum OrderSide {
  BUY = 'buy',
  SELL = 'sell',
}

/**
 * Order category enumeration
 * 
 * Defines the category of an order:
 * - STANDARD: Regular limit/market order
 * - ICEBERG: Iceberg order with hidden quantity
 * 
 * @example
 * ```typescript
 * const category = OrderCategory.ICEBERG;
 * console.log(category); // 'iceberg'
 * ```
 */
export enum OrderCategory {
  STANDARD = 'standard',
  ICEBERG = 'iceberg',
}

/**
 * Order interface
 * 
 * Represents a single order in the order book.
 * 
 * @property {string} id - Unique identifier for the order
 * @property {number} price - Order price (in quote currency)
 * @property {number} quantity - Order quantity (in base currency)
 * @property {number} timestamp - Unix timestamp in milliseconds
 * @property {OrderType} type - Order type (bid or ask)
 * 
 * @example
 * ```typescript
 * const order: Order = {
 *   id: 'order-123',
 *   price: 50000,
 *   quantity: 1.5,
 *   timestamp: Date.now(),
 *   type: OrderType.BID,
 * };
 * ```
 */
export interface Order {
  id: string;
  price: number;
  quantity: number;
  timestamp: number;
  type: OrderType;
}

/**
 * Iceberg Order interface
 * 
 * Represents an iceberg order with hidden quantity.
 * Only a portion (visible quantity) is shown in the order book,
 * while the rest (hidden quantity) is kept secret.
 * 
 * @property {string} id - Unique identifier for the order
 * @property {number} price - Order price (in quote currency)
 * @property {number} totalQuantity - Total order quantity (visible + hidden)
 * @property {number} visibleQuantity - Quantity shown in the order book
 * @property {number} hiddenQuantity - Quantity hidden from the market
 * @property {number} timestamp - Unix timestamp in milliseconds
 * @property {OrderType} type - Order type (bid or ask)
 * @property {OrderCategory.ICEBERG} category - Always 'iceberg' for iceberg orders
 * 
 * @example
 * ```typescript
 * const icebergOrder: IcebergOrder = {
 *   id: 'iceberg-123',
 *   price: 50000,
 *   totalQuantity: 10,      // Total amount to buy/sell
 *   visibleQuantity: 2,     // Only show 2 in the order book
 *   hiddenQuantity: 8,      // 8 is hidden
 *   timestamp: Date.now(),
 *   type: OrderType.BID,
 *   category: OrderCategory.ICEBERG,
 * };
 * ```
 */
export interface IcebergOrder {
  id: string;
  price: number;
  totalQuantity: number;
  visibleQuantity: number;
  hiddenQuantity: number;
  timestamp: number;
  type: OrderType;
  category: OrderCategory.ICEBERG;
  /**
   * When visible portion is filled, this determines how much becomes visible next
   * Usually equals to the initial visibleQuantity
   */
  displayQuantity: number;
  /**
   * Minimum quantity variance to randomize visible quantity
   * Helps prevent detection of iceberg orders
   * If set, visibleQuantity will vary between (displayQuantity - variance) and displayQuantity
   */
  variance?: number;
}

/**
 * Union type for all order types
 */
export type AnyOrder = Order | IcebergOrder;

/**
 * Type guard to check if an order is an iceberg order
 */
export function isIcebergOrder(order: AnyOrder): order is IcebergOrder {
  return (order as IcebergOrder).category === OrderCategory.ICEBERG;
}

/**
 * Price level interface
 * 
 * Represents aggregated orders at a specific price point.
 * Multiple orders at the same price are grouped into a single price level.
 * 
 * @property {number} price - Price level (in quote currency)
 * @property {Order[]} orders - Array of orders at this price level
 * @property {number} totalQuantity - Sum of all order quantities at this level
 * 
 * @example
 * ```typescript
 * const priceLevel: PriceLevel = {
 *   price: 50000,
 *   orders: [order1, order2],
 *   totalQuantity: 3.5,
 * };
 * ```
 */
export interface PriceLevel {
  price: number;
  orders: Order[];
  totalQuantity: number;
}

/**
 * Order book snapshot
 * 
 * Complete state of the order book at a specific point in time.
 * Contains all bid and ask price levels.
 * 
 * @property {PriceLevel[]} bids - Bid (buy) price levels, sorted by price descending
 * @property {PriceLevel[]} asks - Ask (sell) price levels, sorted by price ascending
 * @property {number} timestamp - Unix timestamp in milliseconds
 * 
 * @example
 * ```typescript
 * const snapshot: OrderBookSnapshot = {
 *   bids: [
 *     { price: 50000, orders: [], totalQuantity: 10 },
 *     { price: 49900, orders: [], totalQuantity: 20 },
 *   ],
 *   asks: [
 *     { price: 50100, orders: [], totalQuantity: 15 },
 *     { price: 50200, orders: [], totalQuantity: 25 },
 *   ],
 *   timestamp: Date.now(),
 * };
 * ```
 */
export interface OrderBookSnapshot {
  bids: PriceLevel[];
  asks: PriceLevel[];
  timestamp: number;
}

/**
 * Order book depth
 * 
 * Measures the liquidity depth of the order book.
 * 
 * @property {number} bidDepth - Total quantity of all bid orders
 * @property {number} askDepth - Total quantity of all ask orders
 * @property {number} totalDepth - Sum of bid and ask depths
 */
export interface OrderBookDepth {
  bidDepth: number;
  askDepth: number;
  totalDepth: number;
}

/**
 * Order book incremental update
 * 
 * Represents a single change to the order book.
 * Used for real-time updates instead of full snapshots.
 * 
 * @property {'add' | 'cancel' | 'modify'} action - Type of update
 * @property {Order} [order] - The order being added or modified
 * @property {string} [orderId] - ID of the order being cancelled
 * @property {number} [price] - Price for modification
 * @property {number} [newQuantity] - New quantity for modification
 * @property {number} timestamp - Unix timestamp in milliseconds
 */
export interface OrderBookUpdate {
  action: 'add' | 'cancel' | 'modify';
  order?: Order;
  orderId?: string;
  price?: number;
  newQuantity?: number;
  timestamp: number;
}

/**
 * Order book delta for incremental updates
 * 
 * Contains the changes to apply to the order book.
 * Can represent either a snapshot or incremental delta.
 * 
 * @property {PriceLevel[]} bids - Updated bid levels
 * @property {PriceLevel[]} asks - Updated ask levels
 * @property {number} timestamp - Unix timestamp in milliseconds
 * @property {boolean} isSnapshot - Whether this is a full snapshot or delta
 */
export interface OrderBookDelta {
  bids: PriceLevel[];
  asks: PriceLevel[];
  timestamp: number;
  isSnapshot: boolean;
}

/**
 * Order book event types
 * 
 * Union type representing all possible order book events.
 * 
 * @example
 * ```typescript
 * // Handle order book events
 * function handleEvent(event: OrderBookEvent) {
 *   switch (event.type) {
 *     case 'snapshot':
 *       updateOrderBook(event.data);
 *       break;
 *     case 'delta':
 *       applyDelta(event.data);
 *       break;
 *     case 'update':
 *       processUpdate(event.data);
 *       break;
 *   }
 * }
 * ```
 */
export type OrderBookEvent =
  | { type: 'snapshot'; data: OrderBookSnapshot }
  | { type: 'delta'; data: OrderBookDelta }
  | { type: 'update'; data: OrderBookUpdate };
