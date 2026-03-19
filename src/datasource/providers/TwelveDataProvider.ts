/**
 * Twelve Data Provider
 *
 * Implements the IStockDataProvider interface for Twelve Data API.
 * Supports REST API for historical data, WebSocket for real-time streaming,
 * and technical indicators API.
 *
 * Features:
 * - Real-time quotes via WebSocket
 * - Historical bar data via REST API
 * - Technical indicators (RSI, MACD, MA, EMA, Bollinger Bands, etc.)
 * - Automatic reconnection on connection loss
 * - Rate limiting support (800 API credits/day for free tier)
 * - Multiple time intervals support
 *
 * @see https://twelvedata.com/docs
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import {
  Quote,
  Bar,
  Trade,
  OrderBook,
  Ticker,
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
 * Twelve Data API configuration
 */
interface TwelveDataConfig {
  apiKey: string;
  baseUrl?: string;
  websocketUrl?: string;
  rateLimit?: {
    dailyCredits: number;
    requestsPerMinute: number;
  };
}

/**
 * Twelve Data REST API endpoints
 */
const TWELVEDATA_ENDPOINTS = {
  rest: 'https://api.twelvedata.com',
  websocket: 'wss://ws.twelvedata.com/v1/quotes/price',
};

/**
 * Twelve Data WebSocket message types
 */
interface TwelveDataWebSocketMessage {
  event?: string;
  status?: string;
  message?: string;
  data?: TwelveDataQuoteData | TwelveDataBarData;
  [key: string]: any;
}

/**
 * Twelve Data quote data from WebSocket
 */
interface TwelveDataQuoteData {
  symbol: string;
  price: number;
  timestamp: number;
  bid?: number;
  ask?: number;
  volume?: number;
}

/**
 * Twelve Data bar data
 */
interface TwelveDataBarData {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: string;
}

/**
 * Twelve Data time series response
 */
interface TwelveDataTimeSeriesResponse {
  meta: {
    symbol: string;
    interval: string;
    currency: string;
    exchange_timezone: string;
    exchange: string;
    type: string;
  };
  values: Array<{
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
  }>;
  status: string;
}

/**
 * Twelve Data quote response
 */
interface TwelveDataQuoteResponse {
  symbol: string;
  name: string;
  currency: string;
  exchange: string;
  mic_code: string;
  open: string;
  high: string;
  low: string;
  close: string;
  bid: string;
  ask: string;
  volume: string;
  timestamp: number;
  previous_close: string;
  change: string;
  percent_change: string;
}

/**
 * Technical indicator response
 */
export interface TechnicalIndicator {
  symbol: string;
  interval: string;
  name: string;
  values: Array<Record<string, string | number>>;
  meta: {
    symbol: string;
    interval: string;
    indicator: string;
    type: string;
  };
}

/**
 * Available technical indicators
 */
export type TechnicalIndicatorType =
  | 'sma'       // Simple Moving Average
  | 'ema'       // Exponential Moving Average
  | 'wma'       // Weighted Moving Average
  | 'rsi'       // Relative Strength Index
  | 'macd'      // Moving Average Convergence Divergence
  | 'bbands'    // Bollinger Bands
  | 'stoch'     // Stochastic Oscillator
  | 'atr'       // Average True Range
  | 'adx'       // Average Directional Index
  | 'cci'       // Commodity Channel Index
  | 'obv'       // On-Balance Volume
  | 'willr'     // Williams %R
  | 'roc'       // Rate of Change
  | 'roc';      // Momentum

/**
 * Technical indicator parameters
 */
export interface TechnicalIndicatorParams {
  indicator: TechnicalIndicatorType;
  symbol: string;
  interval: BarInterval;
  time_period?: number;
  series_type?: 'open' | 'high' | 'low' | 'close';
  outputsize?: number;
  // MACD specific
  fast_period?: number;
  slow_period?: number;
  signal_period?: number;
  // Bollinger Bands specific
  nbdevup?: number;
  nbdevdn?: number;
  // Stochastic specific
  fastk_period?: number;
  fastd_period?: number;
  slowk_period?: number;
  slowd_period?: number;
}

/**
 * Twelve Data Provider
 *
 * Supports stock, forex, and crypto data from Twelve Data API.
 * Includes technical indicators API for analysis.
 */
export class TwelveDataProvider extends EventEmitter implements IStockDataProvider {
  readonly name = 'Twelve Data Provider';
  readonly providerId = 'twelvedata';

  private _status: DataSourceStatus = DataSourceStatus.DISCONNECTED;
  private _config: TwelveDataConfig | null = null;
  private _ws: WebSocket | null = null;
  private _reconnectTimer: NodeJS.Timeout | null = null;
  private _reconnectAttempts = 0;
  private _maxReconnectAttempts = 5;
  private _reconnectDelay = 1000;

  // Subscription management
  private _quoteSubscriptions: Map<string, Set<QuoteCallback>> = new Map();
  private _barSubscriptions: Map<string, Map<string, Set<BarCallback>>> = new Map();
  private _tradeSubscriptions: Map<string, Set<TradeCallback>> = new Map();
  private _orderBookSubscriptions: Map<string, Set<OrderBookCallback>> = new Map();
  private _tickerSubscriptions: Map<string, Set<TickerCallback>> = new Map();

  // Market data cache
  private _quotes: Map<string, Quote> = new Map();
  private _symbols: Set<string> = new Set();

  // Rate limiting
  private _dailyCredits = 800; // Free tier default
  private _creditsUsed = 0;
  private _lastResetDate = '';
  private _requestQueue: Array<() => Promise<void>> = [];
  private _isProcessingQueue = false;
  private _minRequestInterval = 100; // 100ms between requests

  get status(): DataSourceStatus {
    return this._status;
  }

  getCapabilities(): DataSourceCapabilities {
    return {
      realtimeQuotes: true,
      historicalBars: true,
      realtimeTrades: false, // Twelve Data doesn't provide trade-level data in basic tier
      realtimeOrderBook: false,
      supportedIntervals: ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'],
      maxBarHistory: 5000,
      maxOrderBookDepth: 0,
      multiSymbolSubscription: true,
      maxSymbolsPerBatch: 50,
    };
  }

  // ========== Connection Management ==========

  async connect(config: DataSourceConfig): Promise<void> {
    this._config = {
      apiKey: config.apiKey || process.env.TWELVE_DATA_API_KEY || '',
      baseUrl: config.endpoint || TWELVEDATA_ENDPOINTS.rest,
      websocketUrl: config.wsEndpoint || TWELVEDATA_ENDPOINTS.websocket,
      rateLimit: {
        dailyCredits: (config.options?.dailyCredits as number) || 800,
        requestsPerMinute: (config.options?.requestsPerMinute as number) || 8,
      },
    };

    if (!this._config.apiKey) {
      console.warn('[TwelveDataProvider] No API key provided, running in demo mode with mock data');
      this._status = DataSourceStatus.CONNECTED;
      this.emit('connected', { timestamp: Date.now() });
      return;
    }

    // Check for demo credentials
    if (this.isDemoCredentials(this._config.apiKey)) {
      console.warn('[TwelveDataProvider] Demo credentials detected, running in demo mode');
      this._status = DataSourceStatus.CONNECTED;
      this.emit('connected', { timestamp: Date.now() });
      return;
    }

    this.setStatus(DataSourceStatus.CONNECTING);

    try {
      // Validate API key
      await this.validateApiKey();

      // Connect WebSocket for real-time data
      await this.connectWebSocket();

      this._reconnectAttempts = 0;
      this._status = DataSourceStatus.CONNECTED;
      this.emit('connected', { timestamp: Date.now() });
    } catch (error) {
      this._status = DataSourceStatus.ERROR;
      throw new DataSourceError(
        DataSourceErrorType.CONNECTION_ERROR,
        `Failed to connect to Twelve Data: ${error instanceof Error ? error.message : String(error)}`,
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
    this._symbols.clear();

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

    // Demo mode
    if (!this._config?.apiKey || this.isDemoCredentials(this._config.apiKey)) {
      return this.getMockQuote(normalized);
    }

    try {
      const response = await this.restRequest(`/quote?symbol=${normalized}`);
      const quote = this.convertQuote(normalized, response);
      this._quotes.set(normalized, quote);
      return quote;
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

    // Demo mode
    if (!this._config?.apiKey || this.isDemoCredentials(this._config.apiKey)) {
      return this.getMockBars(normalized, interval, limit);
    }

    const tdInterval = this.convertInterval(interval);

    try {
      const response = await this.restRequest(
        `/time_series?symbol=${normalized}&interval=${tdInterval}&outputsize=${limit}`
      );

      if (!response.values || !Array.isArray(response.values)) {
        throw new Error('Invalid response from Twelve Data API');
      }

      return response.values.map((bar: any) => this.convertBar(normalized, interval, bar));
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

    // Demo mode
    if (!this._config?.apiKey || this.isDemoCredentials(this._config.apiKey)) {
      return this.getMockBars(normalized, interval, Math.ceil((endTime - startTime) / this.intervalToMs(interval)));
    }

    const tdInterval = this.convertInterval(interval);
    const startDate = new Date(startTime).toISOString().split('T')[0];
    const endDate = new Date(endTime).toISOString().split('T')[0];

    try {
      const response = await this.restRequest(
        `/time_series?symbol=${normalized}&interval=${tdInterval}&start_date=${startDate}&end_date=${endDate}`
      );

      if (!response.values || !Array.isArray(response.values)) {
        throw new Error('Invalid response from Twelve Data API');
      }

      return response.values.map((bar: any) => this.convertBar(normalized, interval, bar));
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

  async getOrderBook(symbol: string, depth: number = 20): Promise<OrderBook> {
    this.ensureConnected();
    const normalized = this.normalizeSymbol(symbol);

    // Twelve Data doesn't provide order book data
    // Return best bid/ask from quote as a minimal order book
    const quote = await this.getQuote(normalized);

    const bids: OrderBookLevel[] = [{
      price: quote.bid,
      quantity: 100,
    }];

    const asks: OrderBookLevel[] = [{
      price: quote.ask,
      quantity: 100,
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

    // Twelve Data doesn't provide trade-level data in basic tier
    // Return mock trades based on current quote
    const quote = await this.getQuote(normalized);
    return this.getMockTrades(normalized, quote.lastPrice, limit);
  }

  // ========== Market Info ==========

  async getMarketInfo(symbol: string): Promise<MarketInfo> {
    this.ensureConnected();
    const normalized = this.normalizeSymbol(symbol);

    // Demo mode
    if (!this._config?.apiKey || this.isDemoCredentials(this._config.apiKey)) {
      return this.getMockMarketInfo(normalized);
    }

    try {
      const _response = await this.restRequest(`/quote?symbol=${normalized}`);

      return {
        symbol: normalized,
        baseCurrency: normalized.split('/')[0] || normalized,
        quoteCurrency: normalized.split('/')[1] || 'USD',
        minQuantity: 1,
        maxQuantity: 1000000,
        quantityStep: 1,
        minPrice: 0.0001,
        maxPrice: 100000,
        priceStep: 0.01,
        isActive: true,
      };
    } catch (_error) {
      // Return basic info if API call fails
      return this.getMockMarketInfo(normalized);
    }
  }

  async getAvailableMarkets(): Promise<MarketInfo[]> {
    this.ensureConnected();

    // Return popular stocks/forex pairs
    const popularSymbols = [
      'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'META', 'TSLA', 'NVDA', 'JPM',
      'V', 'JNJ', 'WMT', 'PG', 'MA', 'UNH', 'HD', 'DIS', 'PYPL', 'NFLX',
      'EUR/USD', 'GBP/USD', 'USD/JPY', 'BTC/USD', 'ETH/USD',
    ];

    return Promise.all(popularSymbols.map(symbol => this.getMarketInfo(symbol)));
  }

  // ========== Technical Indicators (Twelve Data Specialty) ==========

  /**
   * Get technical indicator data
   * @param params Indicator parameters
   * @returns Technical indicator values
   */
  async getTechnicalIndicator(params: TechnicalIndicatorParams): Promise<TechnicalIndicator> {
    this.ensureConnected();

    // Demo mode
    if (!this._config?.apiKey || this.isDemoCredentials(this._config.apiKey)) {
      return this.getMockTechnicalIndicator(params);
    }

    const tdInterval = this.convertInterval(params.interval);
    let endpoint = `/technical_indicators?symbol=${params.symbol}&interval=${tdInterval}&type=${params.indicator}`;

    if (params.time_period) {
      endpoint += `&time_period=${params.time_period}`;
    }
    if (params.series_type) {
      endpoint += `&series_type=${params.series_type}`;
    }
    if (params.outputsize) {
      endpoint += `&outputsize=${params.outputsize}`;
    }
    // MACD specific
    if (params.fast_period) {
      endpoint += `&fast_period=${params.fast_period}`;
    }
    if (params.slow_period) {
      endpoint += `&slow_period=${params.slow_period}`;
    }
    if (params.signal_period) {
      endpoint += `&signal_period=${params.signal_period}`;
    }
    // Bollinger Bands specific
    if (params.nbdevup) {
      endpoint += `&nbdevup=${params.nbdevup}`;
    }
    if (params.nbdevdn) {
      endpoint += `&nbdevdn=${params.nbdevdn}`;
    }
    // Stochastic specific
    if (params.fastk_period) {
      endpoint += `&fastk_period=${params.fastk_period}`;
    }
    if (params.fastd_period) {
      endpoint += `&fastd_period=${params.fastd_period}`;
    }
    if (params.slowk_period) {
      endpoint += `&slowk_period=${params.slowk_period}`;
    }
    if (params.slowd_period) {
      endpoint += `&slowd_period=${params.slowd_period}`;
    }

    try {
      const response = await this.restRequest(endpoint);
      return response;
    } catch (error) {
      throw new DataSourceError(
        DataSourceErrorType.UNKNOWN,
        `Failed to get technical indicator ${params.indicator}: ${error instanceof Error ? error.message : String(error)}`,
        this.providerId,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get Simple Moving Average
   */
  async getSMA(symbol: string, interval: BarInterval, timePeriod: number = 20): Promise<TechnicalIndicator> {
    return this.getTechnicalIndicator({
      indicator: 'sma',
      symbol,
      interval,
      time_period: timePeriod,
    });
  }

  /**
   * Get Exponential Moving Average
   */
  async getEMA(symbol: string, interval: BarInterval, timePeriod: number = 20): Promise<TechnicalIndicator> {
    return this.getTechnicalIndicator({
      indicator: 'ema',
      symbol,
      interval,
      time_period: timePeriod,
    });
  }

  /**
   * Get RSI (Relative Strength Index)
   */
  async getRSI(symbol: string, interval: BarInterval, timePeriod: number = 14): Promise<TechnicalIndicator> {
    return this.getTechnicalIndicator({
      indicator: 'rsi',
      symbol,
      interval,
      time_period: timePeriod,
    });
  }

  /**
   * Get MACD (Moving Average Convergence Divergence)
   */
  async getMACD(
    symbol: string,
    interval: BarInterval,
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
  ): Promise<TechnicalIndicator> {
    return this.getTechnicalIndicator({
      indicator: 'macd',
      symbol,
      interval,
      fast_period: fastPeriod,
      slow_period: slowPeriod,
      signal_period: signalPeriod,
    });
  }

  /**
   * Get Bollinger Bands
   */
  async getBollingerBands(
    symbol: string,
    interval: BarInterval,
    timePeriod: number = 20,
    stdDevUp: number = 2,
    stdDevDown: number = 2
  ): Promise<TechnicalIndicator> {
    return this.getTechnicalIndicator({
      indicator: 'bbands',
      symbol,
      interval,
      time_period: timePeriod,
      nbdevup: stdDevUp,
      nbdevdn: stdDevDown,
    });
  }

  // ========== Real-time Subscriptions ==========

  subscribeToQuotes(symbol: string, callback: QuoteCallback): () => void {
    const normalized = this.normalizeSymbol(symbol);

    if (!this._quoteSubscriptions.has(normalized)) {
      this._quoteSubscriptions.set(normalized, new Set());
      this._symbols.add(normalized);
      this.updateWebSocketSubscriptions();
    }

    this._quoteSubscriptions.get(normalized)!.add(callback);

    return () => {
      const subs = this._quoteSubscriptions.get(normalized);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this._quoteSubscriptions.delete(normalized);
          this._symbols.delete(normalized);
          this.updateWebSocketSubscriptions();
        }
      }
    };
  }

  subscribeToBars(symbol: string, interval: BarInterval, callback: BarCallback): () => void {
    const normalized = this.normalizeSymbol(symbol);
    const _key = `${normalized}:${interval}`;

    if (!this._barSubscriptions.has(normalized)) {
      this._barSubscriptions.set(normalized, new Map());
    }

    const symbolBars = this._barSubscriptions.get(normalized)!;
    if (!symbolBars.has(interval)) {
      symbolBars.set(interval, new Set());
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
          }
        }
      }
    };
  }

  subscribeToTrades(symbol: string, callback: TradeCallback): () => void {
    const normalized = this.normalizeSymbol(symbol);

    // Twelve Data doesn't support real-time trades
    // Simulate from quotes
    const unsubscribeQuote = this.subscribeToQuotes(symbol, (quote) => {
      const trade: Trade = {
        id: `${normalized}-${Date.now()}`,
        symbol: normalized,
        price: quote.lastPrice,
        quantity: Math.random() * 100,
        side: Math.random() > 0.5 ? 'buy' : 'sell',
        timestamp: Date.now(),
        source: this.providerId,
      };
      callback(trade);
    });

    return unsubscribeQuote;
  }

  subscribeToOrderBook(symbol: string, callback: OrderBookCallback): () => void {
    const normalized = this.normalizeSymbol(symbol);

    // Use quote updates as a proxy for order book
    const unsubscribeQuote = this.subscribeToQuotes(symbol, async (_quote) => {
      const orderBook = await this.getOrderBook(normalized);
      callback(orderBook);
    });

    return unsubscribeQuote;
  }

  subscribeToTicker(symbol: string, callback: TickerCallback): () => void {
    const normalized = this.normalizeSymbol(symbol);

    const unsubscribeQuote = this.subscribeToQuotes(symbol, (quote) => {
      const ticker: Ticker = {
        symbol: normalized,
        lastPrice: quote.lastPrice,
        priceChange: quote.priceChange24h,
        priceChangePercent: quote.priceChangePercent24h,
        bid: quote.bid,
        ask: quote.ask,
        volume: quote.volume24h,
        quoteVolume: quote.quoteVolume24h,
        timestamp: quote.timestamp,
      };
      callback(ticker);
    });

    return unsubscribeQuote;
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
    this._symbols.delete(normalized);

    this.updateWebSocketSubscriptions();
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
        'Not connected to Twelve Data Provider',
        this.providerId
      );
    }
  }

  private normalizeSymbol(symbol: string): string {
    // Convert to uppercase and standardize format
    return symbol.toUpperCase().replace(/[-_]/g, '/');
  }

  private isDemoCredentials(apiKey: string): boolean {
    const demoPatterns = [
      /^demo/i,
      /^test/i,
      /^mock/i,
      /^fake/i,
      /^example/i,
      /^your[-_]?key/i,
      /^xxxxx/i,
      /^demo/i,
    ];

    return demoPatterns.some(pattern => pattern.test(apiKey));
  }

  private async validateApiKey(): Promise<void> {
    try {
      // Test API key with a simple quote request
      await this.restRequest('/quote?symbol=AAPL');
    } catch (error) {
      throw new DataSourceError(
        DataSourceErrorType.AUTHENTICATION_ERROR,
        'Invalid Twelve Data API key',
        this.providerId,
        error instanceof Error ? error : undefined
      );
    }
  }

  private async connectWebSocket(): Promise<void> {
    if (!this._config?.apiKey || !this._config?.websocketUrl) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this._ws = new WebSocket(this._config!.websocketUrl!);

        this._ws.on('open', () => {
          // Authenticate
          this._ws!.send(JSON.stringify({
            action: 'heartbeat',
            params: {
              apikey: this._config!.apiKey,
            },
          }));
        });

        this._ws.on('message', (data: WebSocket.Data) => {
          try {
            const msg = JSON.parse(data.toString());
            this.handleWebSocketMessage(msg);
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

        // Wait for connection
        const timeout = setTimeout(() => {
          resolve(); // Don't reject, continue in demo mode
        }, 5000);

        this.once('ws:connected', () => {
          clearTimeout(timeout);
          resolve();
        });
      } catch (_error) {
        // Continue without WebSocket if connection fails
        console.warn('[TwelveDataProvider] WebSocket connection failed, real-time updates disabled');
        resolve();
      }
    });
  }

  private handleWebSocketMessage(msg: TwelveDataWebSocketMessage): void {
    if (msg.status === 'error') {
      this.emit('error', new Error(msg.message || 'WebSocket error'));
      return;
    }

    if (msg.event === 'heartbeat' && msg.status === 'ok') {
      this.emit('ws:connected');
      return;
    }

    if (msg.event === 'subscribe' && msg.status === 'ok') {
      console.log('[TwelveDataProvider] Subscribed to symbol:', msg);
      return;
    }

    if (msg.event === 'price') {
      // Real-time price update
      const data = msg.data as TwelveDataQuoteData;
      if (data) {
        this.handleQuoteUpdate(data);
      }
    }
  }

  private handleQuoteUpdate(data: TwelveDataQuoteData): void {
    const quote: Quote = {
      symbol: data.symbol,
      lastPrice: data.price,
      bid: data.bid || data.price * 0.9999,
      ask: data.ask || data.price * 1.0001,
      high24h: 0,
      low24h: 0,
      priceChange24h: 0,
      priceChangePercent24h: 0,
      volume24h: data.volume || 0,
      quoteVolume24h: 0,
      timestamp: data.timestamp,
      source: this.providerId,
    };

    this._quotes.set(data.symbol, quote);

    const subs = this._quoteSubscriptions.get(data.symbol);
    if (subs) {
      subs.forEach(cb => cb(quote));
    }
  }

  private handleWebSocketDisconnect(): void {
    if (this._status === DataSourceStatus.DISCONNECTED) {
      return;
    }

    this.setStatus(DataSourceStatus.RECONNECTING);

    if (this._reconnectAttempts < this._maxReconnectAttempts) {
      const delay = this._reconnectDelay * Math.pow(2, this._reconnectAttempts);

      this._reconnectTimer = setTimeout(async () => {
        this._reconnectAttempts++;

        try {
          await this.connectWebSocket();
          this._reconnectAttempts = 0;
          this._status = DataSourceStatus.CONNECTED;
          this.updateWebSocketSubscriptions();
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

  private updateWebSocketSubscriptions(): void {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // Subscribe to all active symbols
    if (this._symbols.size > 0) {
      this._ws.send(JSON.stringify({
        action: 'subscribe',
        params: {
          symbols: Array.from(this._symbols).join(','),
          apikey: this._config!.apiKey,
        },
      }));
    }
  }

  private async restRequest(path: string): Promise<any> {
    // Check rate limiting
    this.checkRateLimit();

    const url = `${this._config!.baseUrl}${path}${path.includes('?') ? '&' : '?'}apikey=${this._config!.apiKey}`;

    await this.enforceRateLimit();

    return this.httpRequest('GET', url);
  }

  private async httpRequest(method: string, url: string, body?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const protocol = isHttps ? require('https') : require('http');

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      };

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
            reject(new DataSourceError(
              DataSourceErrorType.RATE_LIMIT_ERROR,
              'Twelve Data API rate limit exceeded',
              this.providerId
            ));
          } else if (res.statusCode === 401) {
            reject(new DataSourceError(
              DataSourceErrorType.AUTHENTICATION_ERROR,
              'Invalid API key',
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

  private checkRateLimit(): void {
    const today = new Date().toISOString().split('T')[0];

    if (this._lastResetDate !== today) {
      this._creditsUsed = 0;
      this._lastResetDate = today;
    }

    if (this._creditsUsed >= this._dailyCredits) {
      throw new DataSourceError(
        DataSourceErrorType.RATE_LIMIT_ERROR,
        `Daily API credit limit (${this._dailyCredits}) exceeded`,
        this.providerId
      );
    }
  }

  private async enforceRateLimit(): Promise<void> {
    await this.sleep(this._minRequestInterval);
    this._creditsUsed++;
  }

  private convertInterval(interval: BarInterval): string {
    const map: Record<BarInterval, string> = {
      '1m': '1min',
      '3m': '3min',
      '5m': '5min',
      '15m': '15min',
      '30m': '30min',
      '1h': '1h',
      '2h': '2h',
      '4h': '4h',
      '6h': '6h',
      '12h': '12h',
      '1d': '1day',
      '3d': '3day',
      '1w': '1week',
      '1M': '1month',
    };
    return map[interval] || '1day';
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
    return map[interval] ?? 86400000;
  }

  private convertQuote(symbol: string, response: TwelveDataQuoteResponse): Quote {
    const close = parseFloat(response.close);
    const previousClose = parseFloat(response.previous_close);
    const priceChange = close - previousClose;
    const priceChangePercent = previousClose > 0 ? (priceChange / previousClose) * 100 : 0;

    return {
      symbol,
      lastPrice: close,
      bid: parseFloat(response.bid) || close * 0.9999,
      ask: parseFloat(response.ask) || close * 1.0001,
      high24h: parseFloat(response.high),
      low24h: parseFloat(response.low),
      priceChange24h: priceChange,
      priceChangePercent24h: priceChangePercent,
      volume24h: parseFloat(response.volume) || 0,
      quoteVolume24h: parseFloat(response.volume) * close || 0,
      timestamp: response.timestamp * 1000,
      source: this.providerId,
    };
  }

  private convertBar(symbol: string, interval: BarInterval, bar: any): Bar {
    const openTime = new Date(bar.datetime).getTime();

    return {
      symbol,
      interval,
      openTime,
      closeTime: openTime + this.intervalToMs(interval),
      open: parseFloat(bar.open),
      high: parseFloat(bar.high),
      low: parseFloat(bar.low),
      close: parseFloat(bar.close),
      volume: parseFloat(bar.volume) || 0,
      quoteVolume: parseFloat(bar.volume) * (parseFloat(bar.open) + parseFloat(bar.close)) / 2 || 0,
      trades: 0,
      source: this.providerId,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ========== Mock Data Methods ==========

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

  private getMockTrades(symbol: string, basePrice: number, limit: number): Trade[] {
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

  private getMockMarketInfo(symbol: string): MarketInfo {
    const [base, quote] = symbol.split('/');

    return {
      symbol,
      baseCurrency: base || symbol,
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

  private getMockTechnicalIndicator(params: TechnicalIndicatorParams): TechnicalIndicator {
    const values: Array<Record<string, string | number>> = [];
    const outputsize = params.outputsize || 30;

    for (let i = 0; i < outputsize; i++) {
      const value: Record<string, string | number> = {
        datetime: new Date(Date.now() - i * this.intervalToMs(params.interval)).toISOString(),
      };

      switch (params.indicator) {
        case 'sma':
        case 'ema':
        case 'wma':
          value[params.indicator] = this.getBasePrice(params.symbol) * (1 + (Math.random() - 0.5) * 0.1);
          break;
        case 'rsi':
          value.rsi = 30 + Math.random() * 40; // RSI between 30-70
          break;
        case 'macd':
          value.macd = (Math.random() - 0.5) * 10;
          value.macd_signal = (Math.random() - 0.5) * 10;
          value.macd_histogram = (Math.random() - 0.5) * 5;
          break;
        case 'bbands':
          const base = this.getBasePrice(params.symbol);
          value.upper_band = base * 1.02;
          value.middle_band = base;
          value.lower_band = base * 0.98;
          break;
        default:
          value.value = Math.random() * 100;
      }

      values.push(value);
    }

    return {
      symbol: params.symbol,
      interval: params.interval,
      name: params.indicator,
      values: values.reverse(),
      meta: {
        symbol: params.symbol,
        interval: params.interval,
        indicator: params.indicator,
        type: 'indicator',
      },
    };
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
      'EUR/USD': 1.08,
      'GBP/USD': 1.25,
      'USD/JPY': 150,
      'BTC/USD': 45000,
      'ETH/USD': 3000,
    };

    return prices[symbol] || 100;
  }
}