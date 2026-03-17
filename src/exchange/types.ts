/**
 * Exchange Types - Multi-Exchange Support Framework
 *
 * Provides unified types and interfaces for connecting to multiple cryptocurrency exchanges.
 */

/**
 * Exchange configuration - API credentials and settings
 */
export interface ExchangeConfig {
  /** Exchange identifier (e.g., 'binance', 'mock') */
  exchangeId: string;
  /** API Key */
  apiKey: string;
  /** API Secret */
  apiSecret: string;
  /** API Passphrase (for exchanges that require it, e.g., OKX) */
  passphrase?: string;
  /** Whether to use testnet/sandbox mode */
  testnet?: boolean;
  /** Custom API endpoint (for private deployments) */
  endpoint?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Enable rate limiting */
  rateLimit?: boolean;
  /** Additional exchange-specific options */
  options?: Record<string, unknown>;
}

/**
 * Account balance for a single asset
 */
export interface BalanceItem {
  /** Asset symbol (e.g., 'BTC', 'USDT') */
  asset: string;
  /** Total balance */
  total: number;
  /** Available balance for trading */
  available: number;
  /** Balance locked in open orders */
  locked: number;
}

/**
 * Account balance summary
 */
export interface Balance {
  /** Exchange timestamp */
  timestamp: number;
  /** Individual asset balances */
  assets: BalanceItem[];
  /** Total account value in quote currency (if calculable) */
  totalValue?: number;
}

/**
 * Ticker data - Current market price information
 */
export interface Ticker {
  /** Trading pair symbol */
  symbol: string;
  /** Last trade price */
  last: number;
  /** Highest bid price */
  bid: number;
  /** Lowest ask price */
  ask: number;
  /** 24h high price */
  high: number;
  /** 24h low price */
  low: number;
  /** 24h volume in base currency */
  volume: number;
  /** 24h volume in quote currency */
  quoteVolume: number;
  /** Price change percentage in 24h */
  changePercent: number;
  /** Timestamp of the ticker */
  timestamp: number;
}

/**
 * Order book level - Single price level
 */
export interface OrderBookLevel {
  /** Price */
  price: number;
  /** Quantity at this price level */
  quantity: number;
}

/**
 * Order book snapshot
 */
export interface OrderBook {
  /** Trading pair symbol */
  symbol: string;
  /** Bid levels (sorted by price descending) */
  bids: OrderBookLevel[];
  /** Ask levels (sorted by price ascending) */
  asks: OrderBookLevel[];
  /** Timestamp of the snapshot */
  timestamp: number;
  /** Sequence number (for detecting gaps) */
  sequence?: number;
}

/**
 * Order side - buy or sell
 */
export enum OrderSide {
  BUY = 'buy',
  SELL = 'sell',
}

/**
 * Order type - market, limit, etc.
 */
export enum OrderType {
  MARKET = 'market',
  LIMIT = 'limit',
  STOP_LOSS = 'stop_loss',
  STOP_LOSS_LIMIT = 'stop_loss_limit',
  TAKE_PROFIT = 'take_profit',
  TAKE_PROFIT_LIMIT = 'take_profit_limit',
}

/**
 * Order status
 */
export enum OrderStatus {
  NEW = 'new',
  PARTIALLY_FILLED = 'partially_filled',
  FILLED = 'filled',
  CANCELED = 'canceled',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

/**
 * Time in force options
 */
export enum TimeInForce {
  GOOD_TILL_CANCEL = 'GTC',
  IMMEDIATE_OR_CANCEL = 'IOC',
  FILL_OR_KILL = 'FOK',
  GOOD_TILL_DATE = 'GTD',
}

/**
 * Order parameters for placing a new order
 */
export interface OrderParams {
  /** Trading pair symbol */
  symbol: string;
  /** Order side (buy/sell) */
  side: OrderSide;
  /** Order type */
  type: OrderType;
  /** Quantity to trade */
  quantity: number;
  /** Limit price (required for limit orders) */
  price?: number;
  /** Stop price (for stop orders) */
  stopPrice?: number;
  /** Time in force */
  timeInForce?: TimeInForce;
  /** Client-provided order ID */
  clientOrderId?: string;
  /** Additional notes */
  notes?: string;
}

/**
 * Trade execution record
 */
export interface Trade {
  /** Trade ID */
  id: string;
  /** Order ID that generated this trade */
  orderId: string;
  /** Trading pair symbol */
  symbol: string;
  /** Order side */
  side: OrderSide;
  /** Trade price */
  price: number;
  /** Trade quantity */
  quantity: number;
  /** Trade fee */
  fee: number;
  /** Fee currency */
  feeCurrency: string;
  /** Execution timestamp */
  timestamp: number;
  /** Whether this was a maker or taker order */
  isMaker?: boolean;
}

/**
 * Order result after placing an order
 */
export interface OrderResult {
  /** Exchange-assigned order ID */
  orderId: string;
  /** Client-provided order ID */
  clientOrderId?: string;
  /** Trading pair symbol */
  symbol: string;
  /** Order side */
  side: OrderSide;
  /** Order type */
  type: OrderType;
  /** Order status */
  status: OrderStatus;
  /** Original order quantity */
  quantity: number;
  /** Quantity filled so far */
  filledQuantity: number;
  /** Average fill price */
  avgPrice: number;
  /** Total fee paid */
  fee: number;
  /** Fee currency */
  feeCurrency: string;
  /** Order creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Executed trades */
  trades?: Trade[];
}

/**
 * Order with full details
 */
export interface Order extends OrderResult {
  /** Limit price (for limit orders) */
  price?: number;
  /** Stop price (for stop orders) */
  stopPrice?: number;
  /** Time in force */
  timeInForce?: TimeInForce;
  /** Remaining quantity to fill */
  remainingQuantity: number;
}

/**
 * Trade subscription callback
 */
export type TradeCallback = (trade: Trade) => void;

/**
 * Ticker subscription callback
 */
export type TickerCallback = (ticker: Ticker) => void;

/**
 * Order book subscription callback
 */
export type OrderBookCallback = (orderBook: OrderBook) => void;

/**
 * Exchange connection status
 */
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

/**
 * Exchange adapter interface
 *
 * Defines the common interface for all exchange adapters.
 * All exchanges must implement this interface to be used in the system.
 */
export interface IExchangeAdapter {
  /** Exchange name */
  readonly name: string;
  /** Exchange ID */
  readonly exchangeId: string;
  /** Current connection status */
  readonly status: ConnectionStatus;

  /**
   * Connect to the exchange
   * @param config Exchange configuration
   */
  connect(config: ExchangeConfig): Promise<void>;

  /**
   * Disconnect from the exchange
   */
  disconnect(): Promise<void>;

  /**
   * Get account balance
   */
  getBalance(): Promise<Balance>;

  /**
   * Get ticker for a trading pair
   * @param symbol Trading pair symbol
   */
  getTicker(symbol: string): Promise<Ticker>;

  /**
   * Get order book for a trading pair
   * @param symbol Trading pair symbol
   * @param depth Number of price levels to return (default: 20)
   */
  getOrderBook(symbol: string, depth?: number): Promise<OrderBook>;

  /**
   * Place a new order
   * @param order Order parameters
   */
  placeOrder(order: OrderParams): Promise<OrderResult>;

  /**
   * Cancel an existing order
   * @param orderId Order ID to cancel
   * @param symbol Trading pair symbol (required by some exchanges)
   */
  cancelOrder(orderId: string, symbol?: string): Promise<void>;

  /**
   * Get open orders
   * @param symbol Trading pair symbol (optional, returns all if not specified)
   */
  getOpenOrders(symbol?: string): Promise<Order[]>;

  /**
   * Get order history
   * @param symbol Trading pair symbol (optional, returns all if not specified)
   * @param limit Maximum number of orders to return
   */
  getOrderHistory(symbol?: string, limit?: number): Promise<Order[]>;

  /**
   * Subscribe to trade updates
   * @param symbol Trading pair symbol
   * @param callback Function to call when a trade is received
   */
  subscribeToTrades(symbol: string, callback: TradeCallback): void;

  /**
   * Unsubscribe from trade updates
   * @param symbol Trading pair symbol
   */
  unsubscribeFromTrades(symbol: string): void;

  /**
   * Subscribe to ticker updates
   * @param symbol Trading pair symbol
   * @param callback Function to call when a ticker update is received
   */
  subscribeToTicker?(symbol: string, callback: TickerCallback): void;

  /**
   * Unsubscribe from ticker updates
   * @param symbol Trading pair symbol
   */
  unsubscribeFromTicker?(symbol: string): void;

  /**
   * Subscribe to order book updates
   * @param symbol Trading pair symbol
   * @param callback Function to call when order book updates
   */
  subscribeToOrderBook?(symbol: string, callback: OrderBookCallback): void;

  /**
   * Unsubscribe from order book updates
   * @param symbol Trading pair symbol
   */
  unsubscribeFromOrderBook?(symbol: string): void;

  /**
   * Check if the exchange supports a specific feature
   * @param feature Feature name
   */
  supportsFeature?(feature: string): boolean;
}

/**
 * Exchange error types
 */
export enum ExchangeErrorType {
  CONNECTION_ERROR = 'connection_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  INVALID_ORDER = 'invalid_order',
  INSUFFICIENT_BALANCE = 'insufficient_balance',
  ORDER_NOT_FOUND = 'order_not_found',
  MARKET_NOT_FOUND = 'market_not_found',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown',
}

/**
 * Exchange error class
 */
export class ExchangeError extends Error {
  constructor(
    public readonly type: ExchangeErrorType,
    message: string,
    public readonly exchangeId?: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'ExchangeError';
  }
}

/**
 * Exchange capabilities/features
 */
export interface ExchangeCapabilities {
  /** Supports spot trading */
  spot: boolean;
  /** Supports margin trading */
  margin: boolean;
  /** Supports futures trading */
  futures: boolean;
  /** Supports WebSocket subscriptions */
  websocket: boolean;
  /** Supports REST API */
  rest: boolean;
  /** Maximum order book depth */
  maxOrderBookDepth: number;
  /** Supported time in force options */
  supportedTimeInForce: TimeInForce[];
  /** Supports stop-loss orders */
  stopLoss: boolean;
  /** Supports take-profit orders */
  takeProfit: boolean;
  /** Maximum rate limit (requests per second) */
  rateLimit: number;
}
