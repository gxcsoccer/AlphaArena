/**
 * Alpaca Data Provider
 *
 * Implements the IStockDataProvider interface for Alpaca Market Data API.
 * Supports REST API for historical data and WebSocket for real-time streaming.
 * 
 * Features:
 * - Real-time quotes, trades, and bars via WebSocket
 * - Historical bar data via REST API
 * - Automatic reconnection on connection loss
 * - Rate limiting support
 * - Paper trading and live trading environments
 * - IEX data (free tier) support
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
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
 * Alpaca API configuration
 */
interface AlpacaConfig {
  apiKey: string;
  apiSecret: string;
  paper?: boolean; // Use paper trading (default: true for safety)
  baseUrl?: string;
  dataBaseUrl?: string;
  websocketUrl?: string;
}

/**
 * Alpaca REST API endpoints
 */
const ALPACA_ENDPOINTS = {
  paper: {
    trading: 'https://paper-api.alpaca.markets',
    data: 'https://data.alpaca.markets',
    websocket: 'wss://stream.data.alpaca.markets/v2/iex',
  },
  live: {
    trading: 'https://api.alpaca.markets',
    data: 'https://data.alpaca.markets',
    websocket: 'wss://stream.data.alpaca.markets/v2/iex',
  },
};

/**
 * Alpaca WebSocket message types
 */
interface AlpacaWebSocketMessage {
  T: string; // Message type: 'q' (quote), 't' (trade), 'b' (bar), 'success', 'error'
  S?: string; // Symbol
  [key: string]: any;
}

/**
 * Alpaca quote message
 */
interface AlpacaQuoteMessage extends AlpacaWebSocketMessage {
  T: 'q';
  S: string; // Symbol
  bx: string; // Bid exchange
  bp: number; // Bid price
  bs: number; // Bid size
  ax: string; // Ask exchange
  ap: number; // Ask price
  as: number; // Ask size
  t: number; // Timestamp (epoch milliseconds)
  c?: string[]; // Conditions
}

/**
 * Alpaca trade message
 */
interface AlpacaTradeMessage extends AlpacaWebSocketMessage {
  T: 't';
  S: string; // Symbol
  i: number; // Trade ID
  x: string; // Exchange
  p: number; // Price
  s: number; // Size
  t: number; // Timestamp
  c?: string[]; // Conditions
}

/**
 * Alpaca bar message
 */
interface AlpacaBarMessage extends AlpacaWebSocketMessage {
  T: 'b';
  S: string; // Symbol
  o: number; // Open
  h: number; // High
  l: number; // Low
  c: number; // Close
  v: number; // Volume
  t: number; // Timestamp (start of bar)
  n?: number; // Number of trades
  vw?: number; // VWAP
}

/**
 * Alpaca snapshot data (from REST API)
 */
interface AlpacaSnapshot {
  latestQuote: {
    ask_price: string;
    ask_size: number;
    bid_price: string;
    bid_size: number;
    timestamp: string;
  };
  latestTrade: {
    price: string;
    size: number;
    timestamp: string;
  };
  minuteBar: {
    o: string;
    h: string;
    l: string;
    c: string;
    v: number;
    t: string;
  };
  dailyBar: {
    o: string;
    h: string;
    l: string;
    c: string;
    v: number;
    t: string;
  };
}

/**
 * Alpaca Data Provider
 */
export class AlpacaDataProvider extends EventEmitter implements IStockDataProvider {
  readonly name = 'Alpaca Data Provider';
  readonly providerId = 'alpaca';

  private _status: DataSourceStatus = DataSourceStatus.DISCONNECTED;
  private _config: AlpacaConfig | null = null;
  private _ws: WebSocket | null = null;
  private _reconnectTimer: NodeJS.Timeout | null = null;
  private _reconnectAttempts = 0;
  private _maxReconnectAttempts = 5;
  private _reconnectDelay = 1000; // Start with 1 second, exponential backoff

  // Subscription management
  private _quoteSubscriptions: Map<string, Set<QuoteCallback>> = new Map();
  private _barSubscriptions: Map<string, Map<string, Set<BarCallback>>> = new Map();
  private _tradeSubscriptions: Map<string, Set<TradeCallback>> = new Map();
  private _orderBookSubscriptions: Map<string, Set<OrderBookCallback>> = new Map();
  private _tickerSubscriptions: Map<string, Set<TickerCallback>> = new Map();

  // Market data cache
  private _quotes: Map<string, Quote> = new Map();
  private _bars: Map<string, Map<string, Bar[]>> = new Map();

  // REST API rate limiting
  private _rateLimitRemaining = 200; // Alpaca default rate limit
  private _lastRequestTime = 0;
  private _minRequestInterval = 50; // Minimum ms between requests

  get status(): DataSourceStatus {
    return this._status;
  }

  getCapabilities(): DataSourceCapabilities {
    return {
      realtimeQuotes: true,
      historicalBars: true,
      realtimeTrades: true,
      realtimeOrderBook: false, // Alpaca doesn't provide full order book via IEX
      supportedIntervals: ['1m', '5m', '15m', '1h', '1d'],
      maxBarHistory: 10000,
      maxOrderBookDepth: 0, // Not supported
      multiSymbolSubscription: true,
      maxSymbolsPerBatch: 30, // Alpaca recommends max 30 symbols per connection
    };
  }

  // ========== Connection Management ==========

  async connect(config: DataSourceConfig): Promise<void> {
    this._config = {
      apiKey: config.apiKey || process.env.ALPACA_API_KEY || '',
      apiSecret: config.apiSecret || process.env.ALPACA_API_SECRET || '',
      paper: config.testnet ?? true, // Default to paper trading for safety
      ...config.options,
    };

    if (!this._config.apiKey || !this._config.apiSecret) {
      console.warn('[AlpacaDataProvider] No API credentials provided, running in demo mode with mock data');
      // In demo mode, we'll still "connect" but use mock data
      this._status = DataSourceStatus.CONNECTED;
      this.emit('connected', { timestamp: Date.now() });
      return;
    }

    // Check if credentials are demo/test credentials (skip validation)
    if (this.isDemoCredentials(this._config.apiKey, this._config.apiSecret)) {
      console.warn('[AlpacaDataProvider] Demo/test credentials detected, running in demo mode');
      this._status = DataSourceStatus.CONNECTED;
      this.emit('connected', { timestamp: Date.now() });
      return;
    }

    this.setStatus(DataSourceStatus.CONNECTING);

    try {
      // Validate credentials by fetching account info
      await this.validateCredentials();
      
      // Connect to WebSocket for real-time data
      await this.connectWebSocket();
      
      this._reconnectAttempts = 0;
      this._status = DataSourceStatus.CONNECTED;
      this.emit('connected', { timestamp: Date.now() });
    } catch (error) {
      this._status = DataSourceStatus.ERROR;
      throw new DataSourceError(
        DataSourceErrorType.CONNECTION_ERROR,
        `Failed to connect to Alpaca: ${error instanceof Error ? error.message : String(error)}`,
        this.providerId,
        error instanceof Error ? error : undefined
      );
    }
  }

  async disconnect(): Promise<void> {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }

    // Clear all subscriptions
    this._quoteSubscriptions.clear();
    this._barSubscriptions.clear();
    this._tradeSubscriptions.clear();
    this._orderBookSubscriptions.clear();
    this._tickerSubscriptions.clear();

    this._config = null;
    this._status = DataSourceStatus.DISCONNECTED;
    this.emit('disconnected', { timestamp: Date.now() });
  }

  // ========== Quote Data ==========

  async getQuote(symbol: string): Promise<Quote> {
    this.ensureConnected();
    const normalized = this.normalizeSymbol(symbol);

    // Check cache first
    const cached = this._quotes.get(normalized);
    if (cached && Date.now() - cached.timestamp < 5000) {
      return cached;
    }

    // If demo mode, return mock data
    if (!this._config?.apiKey || !this._config?.apiSecret) {
      return this.getMockQuote(normalized);
    }

    try {
      const snapshot = await this.restRequest(`/v2/stocks/${normalized}/snapshot`);
      return this.convertSnapshotToQuote(normalized, snapshot);
    } catch (error) {
      throw new DataSourceError(
        DataSourceErrorType.UNKNOWN,
        `Failed to get quote for ${normalized}: ${error instanceof Error ? error.message : String(error)}`,
        this.providerId,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    return Promise.all(symbols.map(s => this.getQuote(s)));
  }

  // ========== Bar Data ==========

  async getBars(symbol: string, interval: BarInterval, limit: number = 100): Promise<Bar[]> {
    this.ensureConnected();
    const normalized = this.normalizeSymbol(symbol);

    // If demo mode, return mock data
    if (!this._config?.apiKey || !this._config?.apiSecret) {
      return this.getMockBars(normalized, interval, limit);
    }

    const timeframe = this.convertInterval(interval);
    
    try {
      const data = await this.restRequest(
        `/v2/stocks/${normalized}/bars?timeframe=${timeframe}&limit=${limit}`
      );
      
      return data.bars.map((bar: any) => this.convertBar(normalized, interval, bar));
    } catch (error) {
      throw new DataSourceError(
        DataSourceErrorType.UNKNOWN,
        `Failed to get bars for ${normalized}: ${error instanceof Error ? error.message : String(error)}`,
        this.providerId,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getBarsByRange(
    symbol: string,
    interval: BarInterval,
    startTime: number,
    endTime: number
  ): Promise<Bar[]> {
    this.ensureConnected();
    const normalized = this.normalizeSymbol(symbol);

    // If demo mode, return mock data
    if (!this._config?.apiKey || !this._config?.apiSecret) {
      return this.getMockBars(normalized, interval, Math.ceil((endTime - startTime) / this.intervalToMs(interval)));
    }

    const timeframe = this.convertInterval(interval);
    const start = new Date(startTime).toISOString();
    const end = new Date(endTime).toISOString();

    try {
      const data = await this.restRequest(
        `/v2/stocks/${normalized}/bars?timeframe=${timeframe}&start=${start}&end=${end}`
      );
      
      return data.bars.map((bar: any) => this.convertBar(normalized, interval, bar));
    } catch (error) {
      throw new DataSourceError(
        DataSourceErrorType.UNKNOWN,
        `Failed to get bars for ${normalized}: ${error instanceof Error ? error.message : String(error)}`,
        this.providerId,
        error instanceof Error ? error : undefined
      );
    }
  }

  // ========== Order Book ==========

  async getOrderBook(symbol: string, _depth: number = 20): Promise<OrderBook> {
    this.ensureConnected();
    const normalized = this.normalizeSymbol(symbol);

    // Alpaca IEX doesn't provide full order book
    // Return best bid/ask as a minimal order book
    const quote = await this.getQuote(normalized);
    
    const bids: OrderBookLevel[] = [{
      price: quote.bid,
      quantity: 100, // Placeholder size
    }];
    
    const asks: OrderBookLevel[] = [{
      price: quote.ask,
      quantity: 100, // Placeholder size
    }];

    return {
      symbol: normalized,
      bids,
      asks,
      timestamp: Date.now(),
    };
  }

  // ========== Trade Data ==========

  async getRecentTrades(symbol: string, limit: number = 100): Promise<Trade[]> {
    this.ensureConnected();
    const normalized = this.normalizeSymbol(symbol);

    // If demo mode, return mock data
    if (!this._config?.apiKey || !this._config?.apiSecret) {
      return this.getMockTrades(normalized, limit);
    }

    try {
      const data = await this.restRequest(
        `/v2/stocks/${normalized}/trades?limit=${limit}`
      );
      
      return data.trades.map((trade: any, index: number) => this.convertTrade(normalized, trade, index));
    } catch (error) {
      throw new DataSourceError(
        DataSourceErrorType.UNKNOWN,
        `Failed to get trades for ${normalized}: ${error instanceof Error ? error.message : String(error)}`,
        this.providerId,
        error instanceof Error ? error : undefined
      );
    }
  }

  // ========== Market Info ==========

  async getMarketInfo(symbol: string): Promise<MarketInfo> {
    this.ensureConnected();
    const normalized = this.normalizeSymbol(symbol);

    // Alpaca doesn't have a dedicated market info endpoint
    // Return basic info based on symbol
    const [base, quote] = normalized.split('/');
    
    return {
      symbol: normalized,
      baseCurrency: base || normalized,
      quoteCurrency: quote || 'USD',
      minQuantity: 1,
      maxQuantity: 1000000,
      quantityStep: 1,
      minPrice: 0.0001,
      maxPrice: 100000,
      priceStep: 0.01,
      isActive: true,
    };
  }

  async getAvailableMarkets(): Promise<MarketInfo[]> {
    this.ensureConnected();

    // Return popular stocks available on Alpaca
    const popularStocks = [
      'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'META', 'TSLA', 'NVDA', 'JPM',
      'V', 'JNJ', 'WMT', 'PG', 'MA', 'UNH', 'HD', 'DIS', 'PYPL', 'NFLX',
    ];

    return Promise.all(popularStocks.map(symbol => this.getMarketInfo(symbol)));
  }

  // ========== Real-time Subscriptions ==========

  subscribeToQuotes(symbol: string, callback: QuoteCallback): () => void {
    const normalized = this.normalizeSymbol(symbol);

    if (!this._quoteSubscriptions.has(normalized)) {
      this._quoteSubscriptions.set(normalized, new Set());
      this.subscribeWebSocket(normalized, 'quotes');
    }

    this._quoteSubscriptions.get(normalized)!.add(callback);

    return () => {
      const subs = this._quoteSubscriptions.get(normalized);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this._quoteSubscriptions.delete(normalized);
          this.unsubscribeWebSocket(normalized, 'quotes');
        }
      }
    };
  }

  subscribeToBars(symbol: string, interval: BarInterval, callback: BarCallback): () => void {
    const normalized = this.normalizeSymbol(symbol);

    if (!this._barSubscriptions.has(normalized)) {
      this._barSubscriptions.set(normalized, new Map());
    }

    const symbolBars = this._barSubscriptions.get(normalized)!;
    if (!symbolBars.has(interval)) {
      symbolBars.set(interval, new Set());
      this.subscribeWebSocket(normalized, 'bars');
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
            if (symbolBars.size === 0) {
              this.unsubscribeWebSocket(normalized, 'bars');
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
      this.subscribeWebSocket(normalized, 'trades');
    }

    this._tradeSubscriptions.get(normalized)!.add(callback);

    return () => {
      const subs = this._tradeSubscriptions.get(normalized);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this._tradeSubscriptions.delete(normalized);
          this.unsubscribeWebSocket(normalized, 'trades');
        }
      }
    };
  }

  subscribeToOrderBook(symbol: string, callback: OrderBookCallback): () => void {
    // Alpaca IEX doesn't support full order book
    // Use quote updates as a proxy
    const normalized = this.normalizeSymbol(symbol);
    
    const unsubscribeQuote = this.subscribeToQuotes(symbol, async (_quote) => {
      const orderBook = await this.getOrderBook(normalized);
      callback(orderBook);
    });

    return unsubscribeQuote;
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

    this._quoteSubscriptions.delete(normalized);
    this._tradeSubscriptions.delete(normalized);
    this._orderBookSubscriptions.delete(normalized);
    this._tickerSubscriptions.delete(normalized);
    this._barSubscriptions.delete(normalized);

    this.unsubscribeWebSocket(normalized, 'quotes');
    this.unsubscribeWebSocket(normalized, 'trades');
    this.unsubscribeWebSocket(normalized, 'bars');
  }

  unsubscribeFromAll(): void {
    const allSymbols = new Set<string>();
    
    this._quoteSubscriptions.forEach((_, symbol) => allSymbols.add(symbol));
    this._tradeSubscriptions.forEach((_, symbol) => allSymbols.add(symbol));
    this._barSubscriptions.forEach((_, symbol) => allSymbols.add(symbol));

    allSymbols.forEach(symbol => this.unsubscribeAll(symbol));
  }

  // ========== Private Methods ==========

  private setStatus(status: DataSourceStatus): void {
    const previousStatus = this._status;
    this._status = status;
    if (previousStatus !== status) {
      this.emit('statusChange', { previousStatus, status, timestamp: Date.now() });
    }
  }

  private ensureConnected(): void {
    if (this._status !== DataSourceStatus.CONNECTED) {
      throw new DataSourceError(
        DataSourceErrorType.CONNECTION_ERROR,
        'Not connected to Alpaca Data Provider',
        this.providerId
      );
    }
  }

  private normalizeSymbol(symbol: string): string {
    // Convert symbols like AAPL/USD or AAPL-USD to AAPL (Alpaca format)
    return symbol.toUpperCase().split(/[\/\-]/)[0];
  }

  private isDemoCredentials(apiKey: string, apiSecret: string): boolean {
    // Detect demo/test credentials
    const demoPatterns = [
      /^demo/i,
      /^test/i,
      /^mock/i,
      /^fake/i,
      /^example/i,
      /^your[-_]?key/i,
      /^xxxxx/i,
    ];
    
    return demoPatterns.some(pattern => 
      pattern.test(apiKey) || pattern.test(apiSecret)
    );
  }

  private async validateCredentials(): Promise<void> {
    const endpoints = this._config!.paper ? ALPACA_ENDPOINTS.paper : ALPACA_ENDPOINTS.live;
    
    try {
      const response = await this.httpRequest(
        'GET',
        `${endpoints.trading}/v2/account`,
        undefined,
        {
          'APCA-API-KEY-ID': this._config!.apiKey,
          'APCA-API-SECRET-KEY': this._config!.apiSecret,
        }
      );
      
      if (!response || response.status === 'INACTIVE') {
        throw new Error('Invalid or inactive Alpaca account');
      }
    } catch (error) {
      throw new DataSourceError(
        DataSourceErrorType.AUTHENTICATION_ERROR,
        'Failed to validate Alpaca credentials',
        this.providerId,
        error instanceof Error ? error : undefined
      );
    }
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const endpoints = this._config!.paper ? ALPACA_ENDPOINTS.paper : ALPACA_ENDPOINTS.live;
      const wsUrl = endpoints.websocket;

      this._ws = new WebSocket(wsUrl);

      this._ws.on('open', () => {
        // Authenticate
        this._ws!.send(JSON.stringify({
          action: 'auth',
          key: this._config!.apiKey,
          secret: this._config!.apiSecret,
        }));
      });

      this._ws.on('message', (data: WebSocket.Data) => {
        try {
          const messages = JSON.parse(data.toString());
          
          // Handle array of messages
          const msgArray = Array.isArray(messages) ? messages : [messages];
          
          msgArray.forEach((msg: AlpacaWebSocketMessage) => {
            this.handleWebSocketMessage(msg);
          });
        } catch (error) {
          this.emit('error', error);
        }
      });

      this._ws.on('error', (error: Error) => {
        this.emit('error', error);
        reject(error);
      });

      this._ws.on('close', () => {
        this.handleWebSocketDisconnect();
      });

      // Wait for authentication success
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      this.once('ws:authenticated', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  private handleWebSocketMessage(msg: AlpacaWebSocketMessage): void {
    switch (msg.T) {
      case 'success':
        // Authentication success
        if (msg.msg === 'authenticated') {
          this.emit('ws:authenticated');
        }
        break;
      
      case 'error':
        this.emit('error', new Error(msg.msg || 'WebSocket error'));
        break;
      
      case 'q':
        // Quote update
        this.handleQuoteMessage(msg as AlpacaQuoteMessage);
        break;
      
      case 't':
        // Trade update
        this.handleTradeMessage(msg as AlpacaTradeMessage);
        break;
      
      case 'b':
        // Bar update
        this.handleBarMessage(msg as AlpacaBarMessage);
        break;
    }
  }

  private handleQuoteMessage(msg: AlpacaQuoteMessage): void {
    const quote: Quote = {
      symbol: msg.S,
      lastPrice: (msg.bp + msg.ap) / 2, // Mid price
      bid: msg.bp,
      ask: msg.ap,
      high24h: 0, // Not provided in quote message
      low24h: 0,
      priceChange24h: 0,
      priceChangePercent24h: 0,
      volume24h: 0,
      quoteVolume24h: 0,
      timestamp: msg.t,
      source: this.providerId,
    };

    this._quotes.set(msg.S, quote);

    const subs = this._quoteSubscriptions.get(msg.S);
    if (subs) {
      subs.forEach(cb => cb(quote));
    }
  }

  private handleTradeMessage(msg: AlpacaTradeMessage): void {
    const trade: Trade = {
      id: msg.i.toString(),
      symbol: msg.S,
      price: msg.p,
      quantity: msg.s,
      side: 'buy', // Can't determine from Alpaca trade message
      timestamp: msg.t,
      source: this.providerId,
    };

    const subs = this._tradeSubscriptions.get(msg.S);
    if (subs) {
      subs.forEach(cb => cb(trade));
    }
  }

  private handleBarMessage(msg: AlpacaBarMessage): void {
    // Determine interval based on timestamp difference
    // Alpaca sends minute bars by default
    const interval: BarInterval = '1m';

    const bar: Bar = {
      symbol: msg.S,
      interval,
      openTime: msg.t,
      closeTime: msg.t + this.intervalToMs(interval),
      open: msg.o,
      high: msg.h,
      low: msg.l,
      close: msg.c,
      volume: msg.v,
      quoteVolume: msg.v * (msg.o + msg.c) / 2,
      trades: msg.n,
      source: this.providerId,
    };

    const symbolBars = this._barSubscriptions.get(msg.S);
    if (symbolBars) {
      symbolBars.forEach((subs, int) => {
        if (int === interval) {
          subs.forEach(cb => cb(bar));
        }
      });
    }
  }

  private handleWebSocketDisconnect(): void {
    if (this._status === DataSourceStatus.DISCONNECTED) {
      return; // Intentional disconnect
    }

    this.setStatus(DataSourceStatus.RECONNECTING);

    // Attempt reconnection with exponential backoff
    if (this._reconnectAttempts < this._maxReconnectAttempts) {
      const delay = this._reconnectDelay * Math.pow(2, this._reconnectAttempts);
      
      this._reconnectTimer = setTimeout(async () => {
        this._reconnectAttempts++;
        
        try {
          await this.connectWebSocket();
          this._reconnectAttempts = 0;
          this._status = DataSourceStatus.CONNECTED;
          
          // Resubscribe to all active subscriptions
          this.resubscribeAll();
        } catch (error) {
          this.emit('error', error);
          this.handleWebSocketDisconnect();
        }
      }, delay);
    } else {
      this._status = DataSourceStatus.ERROR;
      this.emit('error', new Error('Max reconnection attempts reached'));
    }
  }

  private resubscribeAll(): void {
    // Resubscribe to quotes
    this._quoteSubscriptions.forEach((_, symbol) => {
      this.subscribeWebSocket(symbol, 'quotes');
    });

    // Resubscribe to trades
    this._tradeSubscriptions.forEach((_, symbol) => {
      this.subscribeWebSocket(symbol, 'trades');
    });

    // Resubscribe to bars
    this._barSubscriptions.forEach((_, symbol) => {
      this.subscribeWebSocket(symbol, 'bars');
    });
  }

  private subscribeWebSocket(symbol: string, channel: 'quotes' | 'trades' | 'bars'): void {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const channelMap = {
      quotes: 'q',
      trades: 't',
      bars: 'b',
    };

    this._ws.send(JSON.stringify({
      action: 'subscribe',
      [channelMap[channel]]: [symbol],
    }));
  }

  private unsubscribeWebSocket(symbol: string, channel: 'quotes' | 'trades' | 'bars'): void {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const channelMap = {
      quotes: 'q',
      trades: 't',
      bars: 'b',
    };

    this._ws.send(JSON.stringify({
      action: 'unsubscribe',
      [channelMap[channel]]: [symbol],
    }));
  }

  private async restRequest(path: string): Promise<any> {
    const endpoints = this._config!.paper ? ALPACA_ENDPOINTS.paper : ALPACA_ENDPOINTS.live;
    const url = `${endpoints.data}${path}`;

    await this.enforceRateLimit();

    return this.httpRequest('GET', url, undefined, {
      'APCA-API-KEY-ID': this._config!.apiKey,
      'APCA-API-SECRET-KEY': this._config!.apiSecret,
    });
  }

  private async httpRequest(
    method: string,
    url: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      const protocol = urlObj.protocol === 'https:' ? require('https') : require('http');
      
      const req = protocol.request(options, (res: any) => {
        let data = '';
        
        res.on('data', (chunk: string) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve(data);
            }
          } else if (res.statusCode === 429) {
            // Rate limited
            reject(new DataSourceError(
              DataSourceErrorType.RATE_LIMIT_ERROR,
              'Alpaca API rate limit exceeded',
              this.providerId
            ));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      
      if (body) {
        req.write(JSON.stringify(body));
      }
      
      req.end();
    });
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this._lastRequestTime;
    
    if (elapsed < this._minRequestInterval) {
      await this.sleep(this._minRequestInterval - elapsed);
    }
    
    this._lastRequestTime = Date.now();
  }

  private convertInterval(interval: BarInterval): string {
    const map: Record<BarInterval, string> = {
      '1m': '1Min',
      '3m': '3Min',
      '5m': '5Min',
      '15m': '15Min',
      '30m': '30Min',
      '1h': '1Hour',
      '2h': '2Hour',
      '4h': '4Hour',
      '6h': '6Hour',
      '12h': '12Hour',
      '1d': '1Day',
      '3d': '3Day',
      '1w': '1Week',
      '1M': '1Month',
    };
    return map[interval] || '1Min';
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

  private convertBar(symbol: string, interval: BarInterval, bar: any): Bar {
    return {
      symbol,
      interval,
      openTime: new Date(bar.t).getTime(),
      closeTime: new Date(bar.t).getTime() + this.intervalToMs(interval),
      open: parseFloat(bar.o),
      high: parseFloat(bar.h),
      low: parseFloat(bar.l),
      close: parseFloat(bar.c),
      volume: bar.v,
      quoteVolume: bar.vw ? bar.v * parseFloat(bar.vw) : bar.v * parseFloat(bar.c),
      trades: bar.n,
      source: this.providerId,
    };
  }

  private convertTrade(symbol: string, trade: any, index: number): Trade {
    return {
      id: trade.i || `${symbol}-${index}`,
      symbol,
      price: parseFloat(trade.p),
      quantity: trade.s,
      side: 'buy', // Can't determine from trade data
      timestamp: new Date(trade.t).getTime(),
      source: this.providerId,
    };
  }

  private convertSnapshotToQuote(symbol: string, snapshot: AlpacaSnapshot): Quote {
    const quote = snapshot.latestQuote;
    const dailyBar = snapshot.dailyBar;
    
    const bid = parseFloat(quote.bid_price);
    const ask = parseFloat(quote.ask_price);
    const lastPrice = (bid + ask) / 2;
    
    const open = parseFloat(dailyBar.o);
    const close = parseFloat(dailyBar.c);
    const priceChange = close - open;
    const priceChangePercent = open > 0 ? (priceChange / open) * 100 : 0;

    return {
      symbol,
      lastPrice,
      bid,
      ask,
      high24h: parseFloat(dailyBar.h),
      low24h: parseFloat(dailyBar.l),
      priceChange24h: priceChange,
      priceChangePercent24h: priceChangePercent,
      volume24h: dailyBar.v,
      quoteVolume24h: dailyBar.v * close,
      timestamp: new Date(quote.timestamp).getTime(),
      source: this.providerId,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ========== Mock Data Methods (for demo/testing without API keys) ==========

  private getMockQuote(symbol: string): Quote {
    const basePrice = this.getBasePrice(symbol);
    const spread = basePrice * 0.0001;
    
    return {
      symbol,
      lastPrice: basePrice,
      bid: basePrice - spread,
      ask: basePrice + spread,
      high24h: basePrice * 1.05,
      low24h: basePrice * 0.95,
      priceChange24h: basePrice * (Math.random() - 0.5) * 0.1,
      priceChangePercent24h: (Math.random() - 0.5) * 10,
      volume24h: Math.random() * 10000000,
      quoteVolume24h: Math.random() * 1000000000,
      timestamp: Date.now(),
      source: this.providerId,
    };
  }

  private getMockBars(symbol: string, interval: BarInterval, limit: number): Bar[] {
    const basePrice = this.getBasePrice(symbol);
    const intervalMs = this.intervalToMs(interval);
    const bars: Bar[] = [];
    const now = Date.now();
    let currentPrice = basePrice;

    for (let i = limit - 1; i >= 0; i--) {
      const closeTime = now - i * intervalMs;
      const openTime = closeTime - intervalMs;
      
      const open = currentPrice;
      const change = (Math.random() - 0.5) * 2 * basePrice * 0.02;
      const close = currentPrice + change;
      const high = Math.max(open, close) * (1 + Math.random() * 0.01);
      const low = Math.min(open, close) * (1 - Math.random() * 0.01);
      const volume = Math.random() * 1000000;

      bars.push({
        symbol,
        interval,
        openTime,
        closeTime,
        open,
        high,
        low,
        close,
        volume,
        quoteVolume: volume * (open + close) / 2,
        trades: Math.floor(Math.random() * 5000),
        source: this.providerId,
      });

      currentPrice = close;
    }

    return bars;
  }

  private getMockTrades(symbol: string, limit: number): Trade[] {
    const basePrice = this.getBasePrice(symbol);
    const trades: Trade[] = [];
    const now = Date.now();

    for (let i = 0; i < limit; i++) {
      trades.push({
        id: `mock-${symbol}-${i}`,
        symbol,
        price: basePrice * (1 + (Math.random() - 0.5) * 0.001),
        quantity: Math.random() * 1000,
        side: Math.random() > 0.5 ? 'buy' : 'sell',
        timestamp: now - i * 1000,
        source: this.providerId,
      });
    }

    return trades.reverse();
  }

  private getBasePrice(symbol: string): number {
    const prices: Record<string, number> = {
      'AAPL': 175,
      'GOOGL': 140,
      'MSFT': 380,
      'AMZN': 180,
      'META': 500,
      'TSLA': 250,
      'NVDA': 800,
      'JPM': 195,
      'V': 280,
      'JNJ': 160,
    };
    
    return prices[symbol] || 100;
  }
}