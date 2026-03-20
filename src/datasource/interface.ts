/**
 * Stock Data Provider Interface
 *
 * Defines the unified interface that all data providers must implement.
 * This enables seamless switching between different data sources
 * (mock, Binance, Alpaca, Polygon.io, etc.)
 */

import {
  Quote,
  Bar,
  Trade,
  OrderBook,
  BarInterval,
  DataSourceStatus,
  DataSourceConfig,
  DataSourceCapabilities,
  DataSourceError,
  DataSourceErrorType,
  QuoteCallback,
  BarCallback,
  TradeCallback,
  OrderBookCallback,
  TickerCallback,
  MarketInfo,
} from './types';

/**
 * Stock Data Provider Interface
 *
 * All data providers (Mock, Binance, Alpaca, etc.) must implement this interface.
 */
export interface IStockDataProvider {
  /** Provider name for display purposes */
  readonly name: string;

  /** Provider identifier (e.g., 'mock', 'binance', 'alpaca') */
  readonly providerId: string;

  /** Current connection status */
  readonly status: DataSourceStatus;

  /** Provider capabilities */
  getCapabilities(): DataSourceCapabilities;

  /**
   * Connect to the data source
   * @param config Configuration options (API keys, endpoints, etc.)
   */
  connect(config: DataSourceConfig): Promise<void>;

  /**
   * Disconnect from the data source
   */
  disconnect(): Promise<void>;

  // ========== Quote Data ==========

  /**
   * Get current quote for a symbol
   * @param symbol Trading symbol (e.g., 'BTC/USDT', 'AAPL')
   */
  getQuote(symbol: string): Promise<Quote>;

  /**
   * Get quotes for multiple symbols
   * @param symbols Array of trading symbols
   */
  getQuotes(symbols: string[]): Promise<Quote[]>;

  // ========== Bar Data ==========

  /**
   * Get historical bar data
   * @param symbol Trading symbol
   * @param interval Bar interval (e.g., '1m', '5m', '1h', '1d')
   * @param limit Number of bars to return (max: capabilities.maxBarHistory)
   */
  getBars(symbol: string, interval: BarInterval, limit?: number): Promise<Bar[]>;

  /**
   * Get historical bar data for a time range
   * @param symbol Trading symbol
   * @param interval Bar interval
   * @param startTime Start timestamp (inclusive)
   * @param endTime End timestamp (inclusive)
   */
  getBarsByRange(
    symbol: string,
    interval: BarInterval,
    startTime: number,
    endTime: number
  ): Promise<Bar[]>;

  // ========== Order Book ==========

  /**
   * Get order book snapshot
   * @param symbol Trading symbol
   * @param depth Number of price levels (default: 20, max: capabilities.maxOrderBookDepth)
   */
  getOrderBook(symbol: string, depth?: number): Promise<OrderBook>;

  // ========== Trade Data ==========

  /**
   * Get recent trades
   * @param symbol Trading symbol
   * @param limit Number of trades to return
   */
  getRecentTrades(symbol: string, limit?: number): Promise<Trade[]>;

  // ========== Market Info ==========

  /**
   * Get market information for a symbol
   * @param symbol Trading symbol
   */
  getMarketInfo(symbol: string): Promise<MarketInfo>;

  /**
   * Get all available markets/symbols
   */
  getAvailableMarkets(): Promise<MarketInfo[]>;

  // ========== Real-time Subscriptions ==========

  /**
   * Subscribe to quote updates for a symbol
   * @param symbol Trading symbol
   * @param callback Function to call when quote updates
   * @returns Unsubscribe function
   */
  subscribeToQuotes(symbol: string, callback: QuoteCallback): () => void;

  /**
   * Subscribe to bar updates for a symbol
   * @param symbol Trading symbol
   * @param interval Bar interval
   * @param callback Function to call when bar updates
   * @returns Unsubscribe function
   */
  subscribeToBars(
    symbol: string,
    interval: BarInterval,
    callback: BarCallback
  ): () => void;

  /**
   * Subscribe to trade stream for a symbol
   * @param symbol Trading symbol
   * @param callback Function to call when a trade occurs
   * @returns Unsubscribe function
   */
  subscribeToTrades(symbol: string, callback: TradeCallback): () => void;

  /**
   * Subscribe to order book updates
   * @param symbol Trading symbol
   * @param callback Function to call when order book updates
   * @returns Unsubscribe function
   */
  subscribeToOrderBook(symbol: string, callback: OrderBookCallback): () => void;

  /**
   * Subscribe to ticker updates
   * @param symbol Trading symbol
   * @param callback Function to call when ticker updates
   * @returns Unsubscribe function
   */
  subscribeToTicker(symbol: string, callback: TickerCallback): () => void;

  /**
   * Subscribe to multiple symbols at once
   * @param symbols Array of trading symbols
   * @param onQuote Callback for quote updates
   * @returns Unsubscribe function
   */
  subscribeToMultiQuotes(
    symbols: string[],
    onQuote: QuoteCallback
  ): () => void;

  /**
   * Unsubscribe from all subscriptions for a symbol
   * @param symbol Trading symbol
   */
  unsubscribeAll(symbol: string): void;

  /**
   * Unsubscribe from all subscriptions
   */
  unsubscribeFromAll(): void;
}

/**
 * Base class for data providers
 * Provides common utilities and default implementations
 */
export abstract class BaseStockDataProvider implements IStockDataProvider {
  abstract readonly name: string;
  abstract readonly providerId: string;

  protected _status: DataSourceStatus = DataSourceStatus.DISCONNECTED;
  protected _config: DataSourceConfig | null = null;
  protected _subscriptions: Map<string, Set<() => void>> = new Map();

  get status(): DataSourceStatus {
    return this._status;
  }

  abstract getCapabilities(): DataSourceCapabilities;
  abstract connect(config: DataSourceConfig): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract getQuote(symbol: string): Promise<Quote>;
  abstract getQuotes(symbols: string[]): Promise<Quote[]>;
  abstract getBars(symbol: string, interval: BarInterval, limit?: number): Promise<Bar[]>;
  abstract getBarsByRange(symbol: string, interval: BarInterval, startTime: number, endTime: number): Promise<Bar[]>;
  abstract getOrderBook(symbol: string, depth?: number): Promise<OrderBook>;
  abstract getRecentTrades(symbol: string, limit?: number): Promise<Trade[]>;
  abstract getMarketInfo(symbol: string): Promise<MarketInfo>;
  abstract getAvailableMarkets(): Promise<MarketInfo[]>;
  abstract subscribeToQuotes(symbol: string, callback: QuoteCallback): () => void;
  abstract subscribeToBars(symbol: string, interval: BarInterval, callback: BarCallback): () => void;
  abstract subscribeToTrades(symbol: string, callback: TradeCallback): () => void;
  abstract subscribeToOrderBook(symbol: string, callback: OrderBookCallback): () => void;
  abstract subscribeToTicker(symbol: string, callback: TickerCallback): () => void;

  /**
   * Default implementation for multi-symbol subscription
   * Providers can override for more efficient batch subscriptions
   */
  subscribeToMultiQuotes(symbols: string[], onQuote: QuoteCallback): () => void {
    const unsubscribers = symbols.map(symbol => 
      this.subscribeToQuotes(symbol, onQuote)
    );
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }

  unsubscribeAll(symbol: string): void {
    const subs = this._subscriptions.get(symbol);
    if (subs) {
      subs.forEach(unsub => unsub());
      this._subscriptions.delete(symbol);
    }
  }

  unsubscribeFromAll(): void {
    this._subscriptions.forEach(subs => {
      subs.forEach(unsub => unsub());
    });
    this._subscriptions.clear();
  }

  protected setStatus(status: DataSourceStatus): void {
    const previousStatus = this._status;
    this._status = status;
    if (previousStatus !== status) {
      this.emit('statusChange', { previousStatus, status, timestamp: Date.now() });
    }
  }

  protected trackSubscription(symbol: string, unsubscribe: () => void): void {
    if (!this._subscriptions.has(symbol)) {
      this._subscriptions.set(symbol, new Set());
    }
    this._subscriptions.get(symbol)!.add(unsubscribe);
  }

  protected removeSubscription(symbol: string, unsubscribe: () => void): void {
    const subs = this._subscriptions.get(symbol);
    if (subs) {
      subs.delete(unsubscribe);
      if (subs.size === 0) {
        this._subscriptions.delete(symbol);
      }
    }
  }

  /**
   * Emit an event (to be overridden by EventEmitter-based implementations)
   */
  protected emit(_event: string, _data: unknown): void {
    // Default: no-op. Override in subclasses that need event emission.
  }

  /**
   * Validate that the provider is connected
   */
  protected ensureConnected(): void {
    if (this._status !== DataSourceStatus.CONNECTED) {
      throw new DataSourceError(
        DataSourceErrorType.CONNECTION_ERROR,
        `Not connected to ${this.name}`,
        this.providerId
      );
    }
  }

  /**
   * Validate configuration
   */
  protected validateConfig(config: DataSourceConfig): void {
    if (!config.providerId) {
      throw new DataSourceError(
        DataSourceErrorType.AUTHENTICATION_ERROR,
        'Provider ID is required',
        this.providerId
      );
    }
  }

  /**
   * Normalize symbol format
   */
  protected normalizeSymbol(symbol: string): string {
    return symbol.toUpperCase().replace(/[-_]/g, '/');
  }

  /**
   * Sleep utility
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate unique ID
   */
  protected generateId(prefix: string = ''): string {
    return `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}