/**
 * Data Source Types - Unified types for stock/crypto market data
 *
 * This module defines the core types used by all data providers,
 * enabling seamless switching between different data sources.
 */

/**
 * Quote - Current market price snapshot
 */
export interface Quote {
  /** Trading symbol (e.g., 'BTC/USDT', 'AAPL') */
  symbol: string;
  /** Last trade price */
  lastPrice: number;
  /** Best bid price */
  bid: number;
  /** Best ask price */
  ask: number;
  /** 24h high price */
  high24h: number;
  /** 24h low price */
  low24h: number;
  /** 24h price change (absolute) */
  priceChange24h: number;
  /** 24h price change percentage */
  priceChangePercent24h: number;
  /** 24h volume in base currency */
  volume24h: number;
  /** 24h volume in quote currency */
  quoteVolume24h: number;
  /** Timestamp of the quote */
  timestamp: number;
  /** Data source identifier */
  source?: string;
}

/**
 * Bar - OHLCV candlestick data
 */
export interface Bar {
  /** Trading symbol */
  symbol: string;
  /** Bar interval (e.g., '1m', '5m', '1h', '1d') */
  interval: string;
  /** Bar open time (timestamp) */
  openTime: number;
  /** Bar close time (timestamp) */
  closeTime: number;
  /** Open price */
  open: number;
  /** High price */
  high: number;
  /** Low price */
  low: number;
  /** Close price */
  close: number;
  /** Volume in base currency */
  volume: number;
  /** Volume in quote currency */
  quoteVolume: number;
  /** Number of trades */
  trades?: number;
  /** Taker buy volume (base currency) */
  takerBuyVolume?: number;
  /** Taker buy volume (quote currency) */
  takerBuyQuoteVolume?: number;
  /** Data source identifier */
  source?: string;
}

/**
 * Trade - Individual trade execution
 */
export interface Trade {
  /** Trade ID */
  id: string;
  /** Trading symbol */
  symbol: string;
  /** Trade price */
  price: number;
  /** Trade quantity */
  quantity: number;
  /** Trade side (buy/sell) */
  side: 'buy' | 'sell';
  /** Trade timestamp */
  timestamp: number;
  /** Whether this was a maker order */
  isMaker?: boolean;
  /** Data source identifier */
  source?: string;
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
  /** Trading symbol */
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
 * Ticker - Real-time price update
 */
export interface Ticker {
  /** Trading symbol */
  symbol: string;
  /** Last trade price */
  lastPrice: number;
  /** Price change in 24h */
  priceChange: number;
  /** Price change percentage in 24h */
  priceChangePercent: number;
  /** Best bid price */
  bid: number;
  /** Best ask price */
  ask: number;
  /** 24h volume */
  volume: number;
  /** 24h quote volume */
  quoteVolume: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Supported bar intervals
 */
export type BarInterval = 
  | '1m' | '3m' | '5m' | '15m' | '30m'  // Minutes
  | '1h' | '2h' | '4h' | '6h' | '12h'   // Hours
  | '1d' | '3d' | '1w' | '1M';          // Days/Weeks/Months

/**
 * Data source connection status
 */
export enum DataSourceStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

/**
 * Data source configuration
 */
export interface DataSourceConfig {
  /** Provider identifier (e.g., 'mock', 'binance', 'alpaca') */
  providerId: string;
  /** API key (if required) */
  apiKey?: string;
  /** API secret (if required) */
  apiSecret?: string;
  /** API passphrase (for exchanges that require it) */
  passphrase?: string;
  /** Whether to use testnet/sandbox mode */
  testnet?: boolean;
  /** Custom API endpoint */
  endpoint?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Enable rate limiting */
  rateLimit?: boolean;
  /** WebSocket endpoint (if different from REST) */
  wsEndpoint?: string;
  /** Additional provider-specific options */
  options?: Record<string, unknown>;
}

/**
 * Data source capabilities
 */
export interface DataSourceCapabilities {
  /** Supports real-time quotes via WebSocket */
  realtimeQuotes: boolean;
  /** Supports historical bar data */
  historicalBars: boolean;
  /** Supports real-time trade stream */
  realtimeTrades: boolean;
  /** Supports order book streaming */
  realtimeOrderBook: boolean;
  /** Supported bar intervals */
  supportedIntervals: BarInterval[];
  /** Maximum bar history length */
  maxBarHistory: number;
  /** Maximum order book depth */
  maxOrderBookDepth: number;
  /** Supports multiple symbols subscription */
  multiSymbolSubscription: boolean;
  /** Maximum symbols per subscription batch */
  maxSymbolsPerBatch: number;
}

/**
 * Subscription callback types
 */
export type QuoteCallback = (quote: Quote) => void;
export type BarCallback = (bar: Bar) => void;
export type TradeCallback = (trade: Trade) => void;
export type OrderBookCallback = (orderBook: OrderBook) => void;
export type TickerCallback = (ticker: Ticker) => void;

/**
 * Data source error types
 */
export enum DataSourceErrorType {
  CONNECTION_ERROR = 'connection_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  INVALID_SYMBOL = 'invalid_symbol',
  INVALID_INTERVAL = 'invalid_interval',
  TIMEOUT = 'timeout',
  SUBSCRIPTION_ERROR = 'subscription_error',
  UNKNOWN = 'unknown',
}

/**
 * Data source error class
 */
export class DataSourceError extends Error {
  constructor(
    public readonly type: DataSourceErrorType,
    message: string,
    public readonly providerId?: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'DataSourceError';
  }
}

/**
 * Market metadata
 */
export interface MarketInfo {
  /** Trading symbol */
  symbol: string;
  /** Base currency (e.g., 'BTC') */
  baseCurrency: string;
  /** Quote currency (e.g., 'USDT') */
  quoteCurrency: string;
  /** Minimum order quantity */
  minQuantity: number;
  /** Maximum order quantity */
  maxQuantity: number;
  /** Quantity step size */
  quantityStep: number;
  /** Minimum price */
  minPrice: number;
  /** Maximum price */
  maxPrice: number;
  /** Price step size (tick size) */
  priceStep: number;
  /** Is this market active/tradable */
  isActive: boolean;
}