/**
 * Binance Exchange Adapter
 */
import { BaseExchangeAdapter } from './BaseExchangeAdapter';
import {
  ExchangeConfig, Balance, BalanceItem, Ticker, OrderBook, OrderParams,
  OrderResult, Order, OrderSide, OrderType, OrderStatus, Trade, TradeCallback,
  TickerCallback, OrderBookCallback, ConnectionStatus, ExchangeError,
  ExchangeErrorType, ExchangeCapabilities, TimeInForce,
} from './types';

const BINANCE_REST_URL = 'https://api.binance.com';
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws';

interface BinanceBalance { a: string; f: string; l: string; }
interface BinanceTicker { s: string; c: string; b: string; a: string; h: string; l: string; v: string; q: string; P: string; E: number; }
interface BinanceOrderBook { lastUpdateId: number; bids: [string, string][]; asks: [string, string][]; }
interface BinanceOrder { orderId: number; clientOrderId?: string; symbol: string; side: 'BUY' | 'SELL'; type: string; status: string; origQty: string; executedQty: string; cummulativeQuoteQty: string; price: string; time: number; updateTime: number; }

type RequestMethod = 'GET' | 'POST' | 'DELETE' | 'PUT';

export class BinanceAdapter extends BaseExchangeAdapter {
  readonly name = 'Binance';
  readonly exchangeId = 'binance';
  private _baseUrl: string = BINANCE_REST_URL;
  private _wsUrl: string = BINANCE_WS_URL;
  private _ws: WebSocket | null = null;
  private _tradeSubscriptions: Map<string, Set<TradeCallback>> = new Map();
  private _tickerSubscriptions: Map<string, Set<TickerCallback>> = new Map();
  private _orderBookSubscriptions: Map<string, Set<OrderBookCallback>> = new Map();

  getCapabilities(): ExchangeCapabilities {
    return {
      spot: true, margin: true, futures: false, websocket: true, rest: true,
      maxOrderBookDepth: 5000,
      supportedTimeInForce: [TimeInForce.GOOD_TILL_CANCEL, TimeInForce.IMMEDIATE_OR_CANCEL, TimeInForce.FILL_OR_KILL],
      stopLoss: true, takeProfit: true, rateLimit: 50,
    };
  }

  async connect(config: ExchangeConfig): Promise<void> {
    this.validateConfig(config);
    this._config = config;
    this.setStatus(ConnectionStatus.CONNECTING);
    if (config.testnet) {
      this._baseUrl = 'https://testnet.binance.vision';
      this._wsUrl = 'wss://testnet.binance.vision/ws';
    }
    try {
      const time = await this.request<{ serverTime: number }>('/api/v3/time');
      this.setStatus(ConnectionStatus.CONNECTED);
      this.emit('connected', { timestamp: time.serverTime });
    } catch (error) {
      throw new ExchangeError(ExchangeErrorType.CONNECTION_ERROR, (error as Error).message, this.exchangeId, error as Error);
    }
  }

  async disconnect(): Promise<void> {
    if (this._ws) { this._ws.close(); this._ws = null; }
    this._tradeSubscriptions.clear();
    this._tickerSubscriptions.clear();
    this._orderBookSubscriptions.clear();
    this._config = null;
    this.setStatus(ConnectionStatus.DISCONNECTED);
    this.emit('disconnected', { timestamp: Date.now() });
  }

  async getBalance(): Promise<Balance> {
    this.ensureConnected();
    const result = await this.signedRequest<{ balances: BinanceBalance[]; updateTime: number }>('/api/v3/account');
    return {
      timestamp: result.updateTime,
      assets: result.balances.filter(b => parseFloat(b.f) > 0 || parseFloat(b.l) > 0).map(b => ({
        asset: b.a, total: parseFloat(b.f) + parseFloat(b.l), available: parseFloat(b.f), locked: parseFloat(b.l),
      })),
    };
  }

  async getTicker(symbol: string): Promise<Ticker> {
    this.ensureConnected();
    const r = await this.request<BinanceTicker>('/api/v3/ticker/24hr', 'GET', { symbol: this.toExchangeSymbol(symbol) });
    return { symbol: this.fromExchangeSymbol(r.s), last: parseFloat(r.c), bid: parseFloat(r.b), ask: parseFloat(r.a), high: parseFloat(r.h), low: parseFloat(r.l), volume: parseFloat(r.v), quoteVolume: parseFloat(r.q), changePercent: parseFloat(r.P), timestamp: r.E };
  }

  async getOrderBook(symbol: string, depth: number = 20): Promise<OrderBook> {
    this.ensureConnected();
    const r = await this.request<BinanceOrderBook>('/api/v3/depth', 'GET', { symbol: this.toExchangeSymbol(symbol), limit: depth });
    return { symbol, bids: r.bids.map(([p, q]) => ({ price: parseFloat(p), quantity: parseFloat(q) })), asks: r.asks.map(([p, q]) => ({ price: parseFloat(p), quantity: parseFloat(q) })), timestamp: Date.now(), sequence: r.lastUpdateId };
  }

  async placeOrder(order: OrderParams): Promise<OrderResult> {
    this.ensureConnected();
    const params: Record<string, string | number> = { symbol: this.toExchangeSymbol(order.symbol), side: order.side === OrderSide.BUY ? 'BUY' : 'SELL', type: this.toBinanceOrderType(order.type), quantity: order.quantity };
    if (order.price) params.price = order.price;
    if (order.timeInForce) params.timeInForce = order.timeInForce;
    const r = await this.signedRequest<BinanceOrder>('/api/v3/order', 'POST', params);
    return this.parseOrderResult(r);
  }

  async cancelOrder(orderId: string, symbol?: string): Promise<void> {
    this.ensureConnected();
    if (!symbol) throw new ExchangeError(ExchangeErrorType.INVALID_ORDER, 'Symbol is required for Binance order cancellation', this.exchangeId);
    await this.signedRequest('/api/v3/order', 'DELETE', { symbol: this.toExchangeSymbol(symbol), orderId });
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    this.ensureConnected();
    const params: Record<string, string> = {};
    if (symbol) params.symbol = this.toExchangeSymbol(symbol);
    const r = await this.signedRequest<BinanceOrder[]>('/api/v3/openOrders', 'GET', params);
    return r.map(o => this.parseOrder(o));
  }

  async getOrderHistory(symbol?: string, limit: number = 500): Promise<Order[]> {
    this.ensureConnected();
    const params: Record<string, string | number> = { limit };
    if (symbol) params.symbol = this.toExchangeSymbol(symbol);
    const r = await this.signedRequest<BinanceOrder[]>('/api/v3/allOrders', 'GET', params);
    return r.map(o => this.parseOrder(o));
  }

  subscribeToTrades(symbol: string, callback: TradeCallback): void {
    if (!this._tradeSubscriptions.has(symbol)) this._tradeSubscriptions.set(symbol, new Set());
    this._tradeSubscriptions.get(symbol)!.add(callback);
    this.updateWebSocketSubscriptions();
  }

  unsubscribeFromTrades(symbol: string): void { this._tradeSubscriptions.delete(symbol); this.updateWebSocketSubscriptions(); }
  subscribeToTicker(symbol: string, callback: TickerCallback): void {
    if (!this._tickerSubscriptions.has(symbol)) this._tickerSubscriptions.set(symbol, new Set());
    this._tickerSubscriptions.get(symbol)!.add(callback);
    this.updateWebSocketSubscriptions();
  }
  unsubscribeFromTicker(symbol: string): void { this._tickerSubscriptions.delete(symbol); this.updateWebSocketSubscriptions(); }
  subscribeToOrderBook(symbol: string, callback: OrderBookCallback): void {
    if (!this._orderBookSubscriptions.has(symbol)) this._orderBookSubscriptions.set(symbol, new Set());
    this._orderBookSubscriptions.get(symbol)!.add(callback);
    this.updateWebSocketSubscriptions();
  }
  unsubscribeFromOrderBook(symbol: string): void { this._orderBookSubscriptions.delete(symbol); this.updateWebSocketSubscriptions(); }

  private ensureConnected(): void {
    if (this._status !== ConnectionStatus.CONNECTED) throw new ExchangeError(ExchangeErrorType.CONNECTION_ERROR, 'Not connected to Binance', this.exchangeId);
  }

  protected toExchangeSymbol(symbol: string): string { return symbol.toUpperCase().replace(/[-_/]/g, ''); }
  protected fromExchangeSymbol(s: string): string { const m = s.match(/^(.+)(USDT?)$/); return m ? `${m[1]}/${m[2]}` : s; }

  private toBinanceOrderType(type: OrderType): string {
    const map: Record<OrderType, string> = { [OrderType.MARKET]: 'MARKET', [OrderType.LIMIT]: 'LIMIT', [OrderType.STOP_LOSS]: 'STOP_LOSS', [OrderType.STOP_LOSS_LIMIT]: 'STOP_LOSS_LIMIT', [OrderType.TAKE_PROFIT]: 'TAKE_PROFIT', [OrderType.TAKE_PROFIT_LIMIT]: 'TAKE_PROFIT_LIMIT' };
    return map[type] || 'LIMIT';
  }

  private parseOrderStatus(s: string): OrderStatus { return { NEW: OrderStatus.NEW, PARTIALLY_FILLED: OrderStatus.PARTIALLY_FILLED, FILLED: OrderStatus.FILLED, CANCELED: OrderStatus.CANCELED, REJECTED: OrderStatus.REJECTED, EXPIRED: OrderStatus.EXPIRED }[s] || OrderStatus.NEW; }

  private parseOrder(o: BinanceOrder): Order { return { orderId: String(o.orderId), clientOrderId: o.clientOrderId, symbol: this.fromExchangeSymbol(o.symbol), side: o.side === 'BUY' ? OrderSide.BUY : OrderSide.SELL, type: OrderType[o.type as keyof typeof OrderType] || OrderType.LIMIT, status: this.parseOrderStatus(o.status), quantity: parseFloat(o.origQty), filledQuantity: parseFloat(o.executedQty), avgPrice: parseFloat(o.cummulativeQuoteQty) / parseFloat(o.executedQty) || 0, price: o.price ? parseFloat(o.price) : undefined, timeInForce: (o as any).timeInForce as TimeInForce, remainingQuantity: parseFloat(o.origQty) - parseFloat(o.executedQty), fee: 0, feeCurrency: '', createdAt: o.time, updatedAt: o.updateTime }; }
  private parseOrderResult(o: BinanceOrder): OrderResult { return { orderId: String(o.orderId), clientOrderId: o.clientOrderId, symbol: this.fromExchangeSymbol(o.symbol), side: o.side === 'BUY' ? OrderSide.BUY : OrderSide.SELL, type: OrderType[o.type as keyof typeof OrderType] || OrderType.LIMIT, status: this.parseOrderStatus(o.status), quantity: parseFloat(o.origQty), filledQuantity: parseFloat(o.executedQty), avgPrice: parseFloat(o.cummulativeQuoteQty) / parseFloat(o.executedQty) || 0, fee: 0, feeCurrency: '', createdAt: o.time, updatedAt: o.updateTime }; }

  private async request<T>(endpoint: string, method: RequestMethod = 'GET', params: Record<string, string | number> = {}): Promise<T> {
    const url = new URL(`${this._baseUrl}${endpoint}`);
    if (method === 'GET') Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, String(v)));
    const r = await fetch(url.toString(), { method, headers: { 'Content-Type': 'application/json' } });
    if (!r.ok) { const e = await r.json().catch(() => ({ msg: 'Unknown error' })); throw new ExchangeError(ExchangeErrorType.UNKNOWN, e.msg || `HTTP ${r.status}`, this.exchangeId); }
    return r.json();
  }

  private async signedRequest<T>(endpoint: string, method: RequestMethod = 'GET', params: Record<string, string | number> = {}): Promise<T> {
    if (!this._config) throw new ExchangeError(ExchangeErrorType.AUTHENTICATION_ERROR, 'Not configured', this.exchangeId);
    params.timestamp = Date.now();
    const qs = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&');
    const sig = await this.hmacSha256(qs, this._config.apiSecret);
    const url = new URL(`${this._baseUrl}${endpoint}`);
    url.search = `${qs}&signature=${sig}`;
    const r = await fetch(url.toString(), { method, headers: { 'Content-Type': 'application/json', 'X-MBX-APIKEY': this._config.apiKey } });
    if (!r.ok) { const e = await r.json().catch(() => ({ msg: 'Unknown error' })); throw new ExchangeError(ExchangeErrorType.UNKNOWN, e.msg || `HTTP ${r.status}`, this.exchangeId); }
    return r.json();
  }

  private async hmacSha256(msg: string, secret: string): Promise<string> {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private updateWebSocketSubscriptions(): void {
    const streams: string[] = [];
    for (const s of Array.from(this._tradeSubscriptions.keys())) streams.push(`${s.toLowerCase()}@trade`);
    for (const s of Array.from(this._tickerSubscriptions.keys())) streams.push(`${s.toLowerCase()}@ticker`);
    for (const s of Array.from(this._orderBookSubscriptions.keys())) streams.push(`${s.toLowerCase()}@depth`);
    if (streams.length > 0) this.connectWebSocket(streams);
    else if (this._ws) { this._ws.close(); this._ws = null; }
  }

  private connectWebSocket(streams: string[]): void {
    if (this._ws) this._ws.close();
    this._ws = new WebSocket(`${this._wsUrl}/${streams.join('/')}`);
    this._ws.onopen = () => this.emit('websocketConnected', { timestamp: Date.now() });
    this._ws.onmessage = (e) => { try { this.handleWebSocketMessage(JSON.parse(e.data)); } catch (err) { this.emit('error', err); } };
    this._ws.onerror = () => this.emit('error', new ExchangeError(ExchangeErrorType.CONNECTION_ERROR, 'WebSocket error', this.exchangeId));
    this._ws.onclose = () => this.emit('websocketDisconnected', { timestamp: Date.now() });
  }

  private handleWebSocketMessage(data: any): void {
    if (data.e === 'trade') {
      const t: Trade = { id: String(data.t), orderId: String(data.t), symbol: this.fromExchangeSymbol(data.s), side: data.m ? OrderSide.SELL : OrderSide.BUY, price: parseFloat(data.p), quantity: parseFloat(data.q), fee: 0, feeCurrency: '', timestamp: data.T, isMaker: data.m };
      const cbs = this._tradeSubscriptions.get(t.symbol); if (cbs) Array.from(cbs).forEach(cb => cb(t));
    } else if (data.e === '24hrTicker') {
      const t: Ticker = { symbol: this.fromExchangeSymbol(data.s), last: parseFloat(data.c), bid: parseFloat(data.b), ask: parseFloat(data.a), high: parseFloat(data.h), low: parseFloat(data.l), volume: parseFloat(data.v), quoteVolume: parseFloat(data.q), changePercent: parseFloat(data.P), timestamp: data.E };
      const cbs = this._tickerSubscriptions.get(t.symbol); if (cbs) Array.from(cbs).forEach(cb => cb(t));
    }
  }
}
