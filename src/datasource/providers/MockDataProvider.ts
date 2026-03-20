/**
 * Mock Data Provider
 *
 * Adapter that wraps the existing MockExchangeAdapter and implements
 * the IStockDataProvider interface. Provides simulated market data
 * for testing and development.
 */

import { EventEmitter } from 'events';
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
  OrderBookLevel,
} from '../types';
import { IStockDataProvider } from '../interface';

/**
 * Mock market configuration
 */
interface MockMarket {
  symbol: string;
  basePrice: number;
  volatility: number;
  tickSize: number;
  baseCurrency: string;
  quoteCurrency: string;
}

/**
 * Mock Data Provider
 *
 * Provides simulated market data for testing purposes.
 * Generates realistic-looking price movements and order books.
 */
export class MockDataProvider extends EventEmitter implements IStockDataProvider {
  readonly name = 'Mock Data Provider';
  readonly providerId = 'mock';

  private _status: DataSourceStatus = DataSourceStatus.DISCONNECTED;
  private _config: DataSourceConfig | null = null;
  private _markets: Map<string, MockMarket> = new Map();
  private _prices: Map<string, number> = new Map();

  // Subscription management
  private _quoteSubscriptions: Map<string, Set<QuoteCallback>> = new Map();
  private _barSubscriptions: Map<string, Map<string, Set<BarCallback>>> = new Map();
  private _tradeSubscriptions: Map<string, Set<TradeCallback>> = new Map();
  private _orderBookSubscriptions: Map<string, Set<OrderBookCallback>> = new Map();
  private _tickerSubscriptions: Map<string, Set<TickerCallback>> = new Map();

  // Timers for generating updates
  private _quoteTimers: Map<string, NodeJS.Timeout> = new Map();
  private _barTimers: Map<string, NodeJS.Timeout> = new Map();
  private _orderBookTimers: Map<string, NodeJS.Timeout> = new Map();

  // Bar data storage
  private _bars: Map<string, Map<string, Bar[]>> = new Map();

  // Trade ID counter
  private _tradeIdCounter = 0;

  constructor() {
    super();
    this.initializeDefaultMarkets();
  }

  get status(): DataSourceStatus {
    return this._status;
  }

  getCapabilities(): DataSourceCapabilities {
    return {
      realtimeQuotes: true,
      historicalBars: true,
      realtimeTrades: true,
      realtimeOrderBook: true,
      supportedIntervals: ['1m', '5m', '15m', '1h', '4h', '1d'],
      maxBarHistory: 1000,
      maxOrderBookDepth: 100,
      multiSymbolSubscription: true,
      maxSymbolsPerBatch: 50,
    };
  }

  // ========== Connection Management ==========

  async connect(config: DataSourceConfig): Promise<void> {
    this._config = config;
    this.setStatus(DataSourceStatus.CONNECTING);

    // Simulate connection delay
    await this.sleep(100);

    this.setStatus(DataSourceStatus.CONNECTED);
    this.emit('connected', { timestamp: Date.now() });
  }

  async disconnect(): Promise<void> {
    // Clear all timers
    Array.from(this._quoteTimers.values()).forEach(timer => clearInterval(timer));
    Array.from(this._barTimers.values()).forEach(timer => clearInterval(timer));
    Array.from(this._orderBookTimers.values()).forEach(timer => clearInterval(timer));

    // Clear subscriptions
    this._quoteSubscriptions.clear();
    this._barSubscriptions.clear();
    this._tradeSubscriptions.clear();
    this._orderBookSubscriptions.clear();
    this._tickerSubscriptions.clear();

    this._quoteTimers.clear();
    this._barTimers.clear();
    this._orderBookTimers.clear();

    this._config = null;
    this.setStatus(DataSourceStatus.DISCONNECTED);
    this.emit('disconnected', { timestamp: Date.now() });
  }

  // ========== Quote Data ==========

  async getQuote(symbol: string): Promise<Quote> {
    this.ensureConnected();
    const normalized = this.normalizeSymbol(symbol);
    const _market = this.getMarket(normalized);
    const price = this.simulatePrice(normalized);

    return {
      symbol: normalized,
      lastPrice: price,
      bid: price * 0.9999,
      ask: price * 1.0001,
      high24h: price * 1.05,
      low24h: price * 0.95,
      priceChange24h: (Math.random() - 0.5) * price * 0.1,
      priceChangePercent24h: (Math.random() - 0.5) * 10,
      volume24h: Math.random() * 1000000,
      quoteVolume24h: Math.random() * 1000000000,
      timestamp: Date.now(),
      source: this.providerId,
    };
  }

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    return Promise.all(symbols.map(s => this.getQuote(s)));
  }

  // ========== Bar Data ==========

  async getBars(symbol: string, interval: BarInterval, limit: number = 100): Promise<Bar[]> {
    this.ensureConnected();
    const normalized = this.normalizeSymbol(symbol);
    const market = this.getMarket(normalized);

    // Generate mock bars
    const bars: Bar[] = [];
    const intervalMs = this.intervalToMs(interval);
    const now = Date.now();
    let currentPrice = this._prices.get(normalized) ?? market.basePrice;

    for (let i = limit - 1; i >= 0; i--) {
      const closeTime = now - i * intervalMs;
      const openTime = closeTime - intervalMs;

      // Simulate price movement
      const open = currentPrice;
      const change = (Math.random() - 0.5) * market.volatility * currentPrice;
      const close = currentPrice + change;
      const high = Math.max(open, close) * (1 + Math.random() * market.volatility * 0.5);
      const low = Math.min(open, close) * (1 - Math.random() * market.volatility * 0.5);
      const volume = Math.random() * 10000;

      bars.push({
        symbol: normalized,
        interval,
        openTime,
        closeTime,
        open,
        high,
        low,
        close,
        volume,
        quoteVolume: volume * (open + close) / 2,
        trades: Math.floor(Math.random() * 1000),
        source: this.providerId,
      });

      currentPrice = close;
    }

    // Store for real-time updates
    if (!this._bars.has(normalized)) {
      this._bars.set(normalized, new Map());
    }
    this._bars.get(normalized)!.set(interval, bars);

    return bars;
  }

  async getBarsByRange(
    symbol: string,
    interval: BarInterval,
    startTime: number,
    endTime: number
  ): Promise<Bar[]> {
    this.ensureConnected();
    const _normalized = this.normalizeSymbol(symbol);
    const intervalMs = this.intervalToMs(interval);
    const limit = Math.ceil((endTime - startTime) / intervalMs);
    return this.getBars(symbol, interval, Math.min(limit, 1000));
  }

  // ========== Order Book ==========

  async getOrderBook(symbol: string, depth: number = 20): Promise<OrderBook> {
    this.ensureConnected();
    const normalized = this.normalizeSymbol(symbol);
    const market = this.getMarket(normalized);
    const price = this._prices.get(normalized) ?? market.basePrice;

    const bids: OrderBookLevel[] = [];
    const asks: OrderBookLevel[] = [];

    for (let i = 0; i < depth; i++) {
      const spread = (i + 1) * market.tickSize;
      bids.push({
        price: price - spread,
        quantity: Math.random() * 10,
      });
      asks.push({
        price: price + spread,
        quantity: Math.random() * 10,
      });
    }

    return {
      symbol: normalized,
      bids,
      asks,
      timestamp: Date.now(),
      sequence: Date.now(),
    };
  }

  // ========== Trade Data ==========

  async getRecentTrades(symbol: string, limit: number = 100): Promise<Trade[]> {
    this.ensureConnected();
    const normalized = this.normalizeSymbol(symbol);
    const _market = this.getMarket(normalized);

    const trades: Trade[] = [];
    const now = Date.now();

    for (let i = 0; i < limit; i++) {
      const price = this.simulatePrice(normalized);
      trades.push({
        id: `mock-trade-${++this._tradeIdCounter}`,
        symbol: normalized,
        price,
        quantity: Math.random() * 10,
        side: Math.random() > 0.5 ? 'buy' : 'sell',
        timestamp: now - i * (1000 + Math.random() * 5000),
        isMaker: Math.random() > 0.5,
        source: this.providerId,
      });
    }

    return trades.reverse();
  }

  // ========== Market Info ==========

  async getMarketInfo(symbol: string): Promise<MarketInfo> {
    this.ensureConnected();
    const normalized = this.normalizeSymbol(symbol);
    const market = this.getMarket(normalized);

    return {
      symbol: normalized,
      baseCurrency: market.baseCurrency,
      quoteCurrency: market.quoteCurrency,
      minQuantity: 0.001,
      maxQuantity: 10000,
      quantityStep: 0.001,
      minPrice: 0.01,
      maxPrice: 1000000,
      priceStep: market.tickSize,
      isActive: true,
    };
  }

  async getAvailableMarkets(): Promise<MarketInfo[]> {
    const markets: MarketInfo[] = [];
    this._markets.forEach((market, symbol) => {
      markets.push({
        symbol,
        baseCurrency: market.baseCurrency,
        quoteCurrency: market.quoteCurrency,
        minQuantity: 0.001,
        maxQuantity: 10000,
        quantityStep: 0.001,
        minPrice: 0.01,
        maxPrice: 1000000,
        priceStep: market.tickSize,
        isActive: true,
      });
    });
    return markets;
  }

  // ========== Real-time Subscriptions ==========

  subscribeToQuotes(symbol: string, callback: QuoteCallback): () => void {
    const normalized = this.normalizeSymbol(symbol);

    if (!this._quoteSubscriptions.has(normalized)) {
      this._quoteSubscriptions.set(normalized, new Set());
      this.startQuoteUpdates(normalized);
    }

    this._quoteSubscriptions.get(normalized)!.add(callback);

    return () => {
      const subs = this._quoteSubscriptions.get(normalized);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this._quoteSubscriptions.delete(normalized);
          const timer = this._quoteTimers.get(normalized);
          if (timer) {
            clearInterval(timer);
            this._quoteTimers.delete(normalized);
          }
        }
      }
    };
  }

  subscribeToBars(symbol: string, interval: BarInterval, callback: BarCallback): () => void {
    const normalized = this.normalizeSymbol(symbol);
    const key = `${normalized}:${interval}`;

    if (!this._barSubscriptions.has(normalized)) {
      this._barSubscriptions.set(normalized, new Map());
    }

    const symbolBars = this._barSubscriptions.get(normalized)!;
    if (!symbolBars.has(interval)) {
      symbolBars.set(interval, new Set());
      this.startBarUpdates(normalized, interval);
    }

    symbolBars.get(interval)!.add(callback);

    return () => {
      const symbolBars = this._barSubscriptions.get(normalized);
      if (symbolBars) {
        const intervalSubs = symbolBars.get(interval);
        if (intervalSubs) {
          intervalSubs.delete(callback);
          if (intervalSubs.size === 0) {
            symbolBars.delete(interval);
            const timer = this._barTimers.get(key);
            if (timer) {
              clearInterval(timer);
              this._barTimers.delete(key);
            }
          }
        }
      }
    };
  }

  subscribeToTrades(symbol: string, callback: TradeCallback): () => void {
    const normalized = this.normalizeSymbol(symbol);

    if (!this._tradeSubscriptions.has(normalized)) {
      this._tradeSubscriptions.set(normalized, new Set());
    }

    this._tradeSubscriptions.get(normalized)!.add(callback);

    return () => {
      const subs = this._tradeSubscriptions.get(normalized);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this._tradeSubscriptions.delete(normalized);
        }
      }
    };
  }

  subscribeToOrderBook(symbol: string, callback: OrderBookCallback): () => void {
    const normalized = this.normalizeSymbol(symbol);

    if (!this._orderBookSubscriptions.has(normalized)) {
      this._orderBookSubscriptions.set(normalized, new Set());
      this.startOrderBookUpdates(normalized);
    }

    this._orderBookSubscriptions.get(normalized)!.add(callback);

    return () => {
      const subs = this._orderBookSubscriptions.get(normalized);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this._orderBookSubscriptions.delete(normalized);
          const timer = this._orderBookTimers.get(normalized);
          if (timer) {
            clearInterval(timer);
            this._orderBookTimers.delete(normalized);
          }
        }
      }
    };
  }

  subscribeToTicker(symbol: string, callback: TickerCallback): () => void {
    const normalized = this.normalizeSymbol(symbol);

    if (!this._tickerSubscriptions.has(normalized)) {
      this._tickerSubscriptions.set(normalized, new Set());
    }

    this._tickerSubscriptions.get(normalized)!.add(callback);

    return () => {
      const subs = this._tickerSubscriptions.get(normalized);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this._tickerSubscriptions.delete(normalized);
        }
      }
    };
  }

  subscribeToMultiQuotes(symbols: string[], onQuote: QuoteCallback): () => void {
    const unsubscribers = symbols.map(s => this.subscribeToQuotes(s, onQuote));
    return () => unsubscribers.forEach(unsub => unsub());
  }

  unsubscribeAll(symbol: string): void {
    const normalized = this.normalizeSymbol(symbol);

    // Clear all subscriptions for this symbol
    this._quoteSubscriptions.delete(normalized);
    this._tradeSubscriptions.delete(normalized);
    this._orderBookSubscriptions.delete(normalized);
    this._tickerSubscriptions.delete(normalized);
    this._barSubscriptions.delete(normalized);

    // Clear timers
    const quoteTimer = this._quoteTimers.get(normalized);
    if (quoteTimer) {
      clearInterval(quoteTimer);
      this._quoteTimers.delete(normalized);
    }

    const obTimer = this._orderBookTimers.get(normalized);
    if (obTimer) {
      clearInterval(obTimer);
      this._orderBookTimers.delete(normalized);
    }
  }

  unsubscribeFromAll(): void {
    // Clear all timers
    Array.from(this._quoteTimers.values()).forEach(timer => clearInterval(timer));
    Array.from(this._barTimers.values()).forEach(timer => clearInterval(timer));
    Array.from(this._orderBookTimers.values()).forEach(timer => clearInterval(timer));

    // Clear all subscriptions
    this._quoteSubscriptions.clear();
    this._barSubscriptions.clear();
    this._tradeSubscriptions.clear();
    this._orderBookSubscriptions.clear();
    this._tickerSubscriptions.clear();

    // Clear timer maps
    this._quoteTimers.clear();
    this._barTimers.clear();
    this._orderBookTimers.clear();
  }

  // ========== Helper Methods ==========

  /**
   * Add a new market to the mock provider
   */
  addMarket(market: MockMarket): void {
    this._markets.set(market.symbol, market);
    this._prices.set(market.symbol, market.basePrice);
  }

  /**
   * Set the current price for a market (for testing)
   */
  setPrice(symbol: string, price: number): void {
    this._prices.set(this.normalizeSymbol(symbol), price);
  }

  private initializeDefaultMarkets(): void {
    const markets: MockMarket[] = [
      { symbol: 'BTC/USDT', basePrice: 50000, volatility: 0.02, tickSize: 1, baseCurrency: 'BTC', quoteCurrency: 'USDT' },
      { symbol: 'ETH/USDT', basePrice: 3000, volatility: 0.03, tickSize: 0.01, baseCurrency: 'ETH', quoteCurrency: 'USDT' },
      { symbol: 'BNB/USDT', basePrice: 400, volatility: 0.025, tickSize: 0.01, baseCurrency: 'BNB', quoteCurrency: 'USDT' },
      { symbol: 'SOL/USDT', basePrice: 100, volatility: 0.04, tickSize: 0.01, baseCurrency: 'SOL', quoteCurrency: 'USDT' },
      { symbol: 'AAPL/USD', basePrice: 175, volatility: 0.015, tickSize: 0.01, baseCurrency: 'AAPL', quoteCurrency: 'USD' },
      { symbol: 'GOOGL/USD', basePrice: 140, volatility: 0.015, tickSize: 0.01, baseCurrency: 'GOOGL', quoteCurrency: 'USD' },
      { symbol: 'MSFT/USD', basePrice: 380, volatility: 0.012, tickSize: 0.01, baseCurrency: 'MSFT', quoteCurrency: 'USD' },
    ];

    markets.forEach(m => {
      this._markets.set(m.symbol, m);
      this._prices.set(m.symbol, m.basePrice);
    });
  }

  private ensureConnected(): void {
    if (this._status !== DataSourceStatus.CONNECTED) {
      throw new DataSourceError(
        DataSourceErrorType.CONNECTION_ERROR,
        'Not connected to Mock Data Provider',
        this.providerId
      );
    }
  }

  private getMarket(symbol: string): MockMarket {
    const normalized = this.normalizeSymbol(symbol);
    const market = this._markets.get(normalized);
    if (!market) {
      throw new DataSourceError(
        DataSourceErrorType.INVALID_SYMBOL,
        `Market not found: ${symbol}`,
        this.providerId
      );
    }
    return market;
  }

  private simulatePrice(symbol: string): number {
    const market = this.getMarket(symbol);
    const currentPrice = this._prices.get(symbol) ?? market.basePrice;
    const change = (Math.random() - 0.5) * 2 * market.volatility * currentPrice;
    const newPrice = currentPrice + change;
    this._prices.set(symbol, newPrice);
    return newPrice;
  }

  private normalizeSymbol(symbol: string): string {
    return symbol.toUpperCase().replace(/[-_/]/g, match => match === '-' || match === '_' ? '/' : match);
  }

  private intervalToMs(interval: BarInterval): number {
    const map: Record<BarInterval, number> = {
      '1m': 60000,
      '3m': 180000,
      '5m': 300000,
      '15m': 900000,
      '30m': 1800000,
      '1h': 3600000,
      '2h': 7200000,
      '4h': 14400000,
      '6h': 21600000,
      '12h': 43200000,
      '1d': 86400000,
      '3d': 259200000,
      '1w': 604800000,
      '1M': 2592000000,
    };
    return map[interval] ?? 60000;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private setStatus(status: DataSourceStatus): void {
    const previousStatus = this._status;
    this._status = status;
    if (previousStatus !== status) {
      this.emit('statusChange', { previousStatus, status, timestamp: Date.now() });
    }
  }

  private startQuoteUpdates(symbol: string): void {
    const timer = setInterval(async () => {
      try {
        const quote = await this.getQuote(symbol);
        const subs = this._quoteSubscriptions.get(symbol);
        if (subs) {
          subs.forEach(cb => cb(quote));
        }
      } catch (err) {
        this.emit('error', err);
      }
    }, 1000);

    this._quoteTimers.set(symbol, timer);
  }

  private startBarUpdates(symbol: string, interval: BarInterval): void {
    const key = `${symbol}:${interval}`;
    const intervalMs = this.intervalToMs(interval);

    const timer = setInterval(async () => {
      try {
        const bars = this._bars.get(symbol)?.get(interval) ?? [];
        const lastBar = bars[bars.length - 1];
        const now = Date.now();

        // Create a new bar
        const market = this.getMarket(symbol);
        const price = this._prices.get(symbol) ?? market.basePrice;

        const newBar: Bar = {
          symbol,
          interval,
          openTime: now - intervalMs,
          closeTime: now,
          open: lastBar?.close ?? price,
          high: price * 1.001,
          low: price * 0.999,
          close: price,
          volume: Math.random() * 100,
          quoteVolume: Math.random() * 100 * price,
          trades: Math.floor(Math.random() * 50),
          source: this.providerId,
        };

        const subs = this._barSubscriptions.get(symbol)?.get(interval);
        if (subs) {
          subs.forEach(cb => cb(newBar));
        }
      } catch (err) {
        this.emit('error', err);
      }
    }, this.intervalToMs(interval) / 10); // Update at 10x the interval frequency for demo

    this._barTimers.set(key, timer);
  }

  private startOrderBookUpdates(symbol: string): void {
    const timer = setInterval(async () => {
      try {
        const orderBook = await this.getOrderBook(symbol);
        const subs = this._orderBookSubscriptions.get(symbol);
        if (subs) {
          subs.forEach(cb => cb(orderBook));
        }
      } catch (err) {
        this.emit('error', err);
      }
    }, 500);

    this._orderBookTimers.set(symbol, timer);
  }
}