/**
 * Exchange Manager - Manages multiple exchange connections
 */
import { EventEmitter } from 'events';
import {
  IExchangeAdapter, ExchangeConfig, Balance, Ticker, OrderBook,
  OrderParams, OrderResult, Order, TradeCallback, TickerCallback,
  OrderBookCallback, ConnectionStatus, ExchangeError, ExchangeErrorType,
} from './types';
import { MockExchangeAdapter } from './MockExchangeAdapter';
import { BinanceAdapter } from './BinanceAdapter';

export interface ExchangeManagerConfig {
  defaultExchange?: string;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
}

interface ExchangeInfo {
  adapter: IExchangeAdapter;
  config: ExchangeConfig;
  isActive: boolean;
}

export class ExchangeManager extends EventEmitter {
  private _exchanges: Map<string, ExchangeInfo> = new Map();
  private _activeExchange: string | null = null;
  private _config: ExchangeManagerConfig;

  constructor(config: ExchangeManagerConfig = {}) {
    super();
    this._config = { defaultExchange: config.defaultExchange ?? 'mock', autoReconnect: config.autoReconnect ?? true, maxReconnectAttempts: config.maxReconnectAttempts ?? 5 };
  }

  get activeExchangeId(): string | null { return this._activeExchange; }
  get registeredExchanges(): string[] { return Array.from(this._exchanges.keys()); }
  get connectedExchanges(): string[] { return Array.from(this._exchanges.entries()).filter(([, i]) => i.adapter.status === ConnectionStatus.CONNECTED).map(([id]) => id); }

  registerExchange(adapter: IExchangeAdapter): void {
    if (this._exchanges.has(adapter.exchangeId)) throw new ExchangeError(ExchangeErrorType.INVALID_ORDER, `Exchange already registered: ${adapter.exchangeId}`);
    this._exchanges.set(adapter.exchangeId, { adapter, config: {} as ExchangeConfig, isActive: false });
    if (adapter instanceof EventEmitter) {
      adapter.on('statusChange', (data: any) => this.emit('exchangeStatusChange', { exchangeId: adapter.exchangeId, ...data }));
      adapter.on('error', (error: Error) => this.emit('exchangeError', { exchangeId: adapter.exchangeId, error }));
    }
  }

  async unregisterExchange(exchangeId: string): Promise<void> {
    const info = this._exchanges.get(exchangeId);
    if (!info) throw new ExchangeError(ExchangeErrorType.ORDER_NOT_FOUND, `Exchange not found: ${exchangeId}`);
    if (info.adapter.status === ConnectionStatus.CONNECTED) await info.adapter.disconnect();
    this._exchanges.delete(exchangeId);
    if (this._activeExchange === exchangeId) this._activeExchange = Array.from(this._exchanges.keys())[0] ?? null;
  }

  async connect(exchangeId: string, config: ExchangeConfig): Promise<void> {
    let info = this._exchanges.get(exchangeId);
    if (!info) {
      const adapter = this.createBuiltInAdapter(exchangeId);
      if (adapter) { this.registerExchange(adapter); info = this._exchanges.get(exchangeId); }
      else throw new ExchangeError(ExchangeErrorType.MARKET_NOT_FOUND, `Exchange not found: ${exchangeId}`);
    }
    info!.config = config;
    await info!.adapter.connect(config);
    if (!this._activeExchange) this._activeExchange = exchangeId;
    this.emit('exchangeConnected', { exchangeId, timestamp: Date.now() });
  }

  async disconnect(exchangeId?: string): Promise<void> {
    if (exchangeId) {
      const info = this._exchanges.get(exchangeId);
      if (!info) throw new ExchangeError(ExchangeErrorType.ORDER_NOT_FOUND, `Exchange not found: ${exchangeId}`);
      await info.adapter.disconnect();
      this.emit('exchangeDisconnected', { exchangeId, timestamp: Date.now() });
    } else {
      for (const [id, info] of Array.from(this._exchanges)) {
        if (info.adapter.status === ConnectionStatus.CONNECTED) {
          await info.adapter.disconnect();
          this.emit('exchangeDisconnected', { exchangeId: id, timestamp: Date.now() });
        }
      }
      this._activeExchange = null;
    }
  }

  setActiveExchange(exchangeId: string): void {
    const info = this._exchanges.get(exchangeId);
    if (!info) throw new ExchangeError(ExchangeErrorType.ORDER_NOT_FOUND, `Exchange not found: ${exchangeId}`);
    if (info.adapter.status !== ConnectionStatus.CONNECTED) throw new ExchangeError(ExchangeErrorType.CONNECTION_ERROR, `Exchange not connected: ${exchangeId}`);
    this._activeExchange = exchangeId;
    this.emit('activeExchangeChanged', { exchangeId, timestamp: Date.now() });
  }

  getActiveExchange(): IExchangeAdapter {
    if (!this._activeExchange) throw new ExchangeError(ExchangeErrorType.CONNECTION_ERROR, 'No active exchange set');
    const info = this._exchanges.get(this._activeExchange);
    if (!info) throw new ExchangeError(ExchangeErrorType.ORDER_NOT_FOUND, `Active exchange not found: ${this._activeExchange}`);
    return info.adapter;
  }

  getExchange(exchangeId: string): IExchangeAdapter {
    const info = this._exchanges.get(exchangeId);
    if (!info) throw new ExchangeError(ExchangeErrorType.ORDER_NOT_FOUND, `Exchange not found: ${exchangeId}`);
    return info.adapter;
  }

  async getBalance(exchangeId?: string): Promise<Balance> { return (exchangeId ? this.getExchange(exchangeId) : this.getActiveExchange()).getBalance(); }
  async getTicker(symbol: string, exchangeId?: string): Promise<Ticker> { return (exchangeId ? this.getExchange(exchangeId) : this.getActiveExchange()).getTicker(symbol); }
  async getOrderBook(symbol: string, depth?: number, exchangeId?: string): Promise<OrderBook> { return (exchangeId ? this.getExchange(exchangeId) : this.getActiveExchange()).getOrderBook(symbol, depth); }
  async placeOrder(order: OrderParams, exchangeId?: string): Promise<OrderResult> { return (exchangeId ? this.getExchange(exchangeId) : this.getActiveExchange()).placeOrder(order); }
  async cancelOrder(orderId: string, symbol?: string, exchangeId?: string): Promise<void> { return (exchangeId ? this.getExchange(exchangeId) : this.getActiveExchange()).cancelOrder(orderId, symbol); }
  async getOpenOrders(symbol?: string, exchangeId?: string): Promise<Order[]> { return (exchangeId ? this.getExchange(exchangeId) : this.getActiveExchange()).getOpenOrders(symbol); }
  async getOrderHistory(symbol?: string, limit?: number, exchangeId?: string): Promise<Order[]> { return (exchangeId ? this.getExchange(exchangeId) : this.getActiveExchange()).getOrderHistory(symbol, limit); }

  subscribeToTrades(symbol: string, callback: TradeCallback, exchangeId?: string): void { (exchangeId ? this.getExchange(exchangeId) : this.getActiveExchange()).subscribeToTrades(symbol, callback); }
  unsubscribeFromTrades(symbol: string, exchangeId?: string): void { (exchangeId ? this.getExchange(exchangeId) : this.getActiveExchange()).unsubscribeFromTrades(symbol); }
  subscribeToTicker(symbol: string, callback: TickerCallback, exchangeId?: string): void { const a = exchangeId ? this.getExchange(exchangeId) : this.getActiveExchange(); if (a.subscribeToTicker) a.subscribeToTicker(symbol, callback); }
  unsubscribeFromTicker(symbol: string, exchangeId?: string): void { const a = exchangeId ? this.getExchange(exchangeId) : this.getActiveExchange(); if (a.unsubscribeFromTicker) a.unsubscribeFromTicker(symbol); }
  subscribeToOrderBook(symbol: string, callback: OrderBookCallback, exchangeId?: string): void { const a = exchangeId ? this.getExchange(exchangeId) : this.getActiveExchange(); if (a.subscribeToOrderBook) a.subscribeToOrderBook(symbol, callback); }
  unsubscribeFromOrderBook(symbol: string, exchangeId?: string): void { const a = exchangeId ? this.getExchange(exchangeId) : this.getActiveExchange(); if (a.unsubscribeFromOrderBook) a.unsubscribeFromOrderBook(symbol); }

  getExchangeStatus(exchangeId: string): ConnectionStatus { const info = this._exchanges.get(exchangeId); if (!info) throw new ExchangeError(ExchangeErrorType.ORDER_NOT_FOUND, `Exchange not found: ${exchangeId}`); return info.adapter.status; }
  isExchangeConnected(exchangeId: string): boolean { return this.getExchangeStatus(exchangeId) === ConnectionStatus.CONNECTED; }

  private createBuiltInAdapter(exchangeId: string): IExchangeAdapter | null {
    switch (exchangeId.toLowerCase()) {
      case 'mock': return new MockExchangeAdapter();
      case 'binance': return new BinanceAdapter();
      default: return null;
    }
  }
}

let _instance: ExchangeManager | null = null;
export function getExchangeManager(): ExchangeManager { if (!_instance) _instance = new ExchangeManager(); return _instance; }
export function resetExchangeManager(): void { if (_instance) { _instance.disconnect().catch(() => {}); _instance = null; } }
