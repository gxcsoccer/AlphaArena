/**
 * Base Exchange Adapter - Abstract base class for exchange implementations
 */
import { EventEmitter } from 'events';
import {
  IExchangeAdapter, ExchangeConfig, Balance, Ticker, OrderBook,
  OrderParams, OrderResult, Order, TradeCallback,
  ConnectionStatus, ExchangeError, ExchangeErrorType,
  ExchangeCapabilities, TimeInForce,
} from './types';

export abstract class BaseExchangeAdapter extends EventEmitter implements IExchangeAdapter {
  abstract readonly name: string;
  abstract readonly exchangeId: string;
  protected _status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  protected _config: ExchangeConfig | null = null;
  protected _reconnectAttempts: number = 0;
  protected _maxReconnectAttempts: number = 5;
  protected _reconnectDelay: number = 1000;

  get status(): ConnectionStatus { return this._status; }

  getCapabilities(): ExchangeCapabilities {
    return {
      spot: true, margin: false, futures: false, websocket: true, rest: true,
      maxOrderBookDepth: 100,
      supportedTimeInForce: [TimeInForce.GOOD_TILL_CANCEL, TimeInForce.IMMEDIATE_OR_CANCEL, TimeInForce.FILL_OR_KILL],
      stopLoss: false, takeProfit: false, rateLimit: 20,
    };
  }

  abstract connect(config: ExchangeConfig): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract getBalance(): Promise<Balance>;
  abstract getTicker(symbol: string): Promise<Ticker>;
  abstract getOrderBook(symbol: string, depth?: number): Promise<OrderBook>;
  abstract placeOrder(order: OrderParams): Promise<OrderResult>;
  abstract cancelOrder(orderId: string, symbol?: string): Promise<void>;
  abstract getOpenOrders(symbol?: string): Promise<Order[]>;
  abstract getOrderHistory(symbol?: string, limit?: number): Promise<Order[]>;
  abstract subscribeToTrades(symbol: string, callback: TradeCallback): void;
  abstract unsubscribeFromTrades(symbol: string): void;

  protected setStatus(status: ConnectionStatus): void {
    const previousStatus = this._status;
    this._status = status;
    if (previousStatus !== status) {
      this.emit('statusChange', { previousStatus, status, timestamp: Date.now() });
    }
  }

  protected validateConfig(config: ExchangeConfig): void {
    if (!config.exchangeId) {
      throw new ExchangeError(ExchangeErrorType.INVALID_ORDER, 'Exchange ID is required', this.exchangeId);
    }
    if (!config.apiKey || !config.apiSecret) {
      throw new ExchangeError(ExchangeErrorType.AUTHENTICATION_ERROR, 'API key and secret are required', this.exchangeId);
    }
  }

  protected generateOrderId(): string {
    return `${this.exchangeId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  protected generateTradeId(): string {
    return `${this.exchangeId}-trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  supportsFeature(feature: string): boolean {
    const capabilities = this.getCapabilities();
    return feature in capabilities && (capabilities as any)[feature] === true;
  }

  protected normalizeSymbol(symbol: string): string {
    return symbol.toUpperCase().replace(/[-_]/g, '');
  }

  protected toExchangeSymbol(symbol: string): string {
    return this.normalizeSymbol(symbol);
  }

  protected fromExchangeSymbol(exchangeSymbol: string): string {
    return exchangeSymbol;
  }
}
