/**
 * Mock Exchange Adapter - For testing and simulation
 */
import { BaseExchangeAdapter } from './BaseExchangeAdapter';
import {
  ExchangeConfig, Balance, BalanceItem, Ticker, OrderBook, OrderBookLevel,
  OrderParams, OrderResult, Order, OrderSide, OrderType, OrderStatus,
  Trade, TradeCallback, TickerCallback, OrderBookCallback,
  ConnectionStatus, ExchangeError, ExchangeErrorType, ExchangeCapabilities, TimeInForce,
} from './types';

interface MockMarket {
  symbol: string;
  basePrice: number;
  volatility: number;
  tickSize: number;
}

interface MockOrder extends Order {
  filledAt?: number[];
}

export class MockExchangeAdapter extends BaseExchangeAdapter {
  readonly name = 'Mock Exchange';
  readonly exchangeId = 'mock';
  private _balances: Map<string, BalanceItem> = new Map();
  private _orders: Map<string, MockOrder> = new Map();
  private _markets: Map<string, MockMarket> = new Map();
  private _tradeSubscriptions: Map<string, Set<TradeCallback>> = new Map();
  private _tickerSubscriptions: Map<string, Set<TickerCallback>> = new Map();
  private _orderBookSubscriptions: Map<string, Set<OrderBookCallback>> = new Map();
  private _tickerIntervals: Map<string, NodeJS.Timeout> = new Map();
  private _orderBookIntervals: Map<string, NodeJS.Timeout> = new Map();
  private _orderIdCounter: number = 1;

  constructor() {
    super();
    this.initializeDefaultMarkets();
    this.initializeDefaultBalances();
  }

  private initializeDefaultMarkets(): void {
    const markets: MockMarket[] = [
      { symbol: 'BTCUSDT', basePrice: 50000, volatility: 0.02, tickSize: 1 },
      { symbol: 'ETHUSDT', basePrice: 3000, volatility: 0.03, tickSize: 0.01 },
      { symbol: 'BNBUSDT', basePrice: 400, volatility: 0.025, tickSize: 0.01 },
    ];
    markets.forEach(m => this._markets.set(m.symbol, m));
  }

  private initializeDefaultBalances(): void {
    const balances: BalanceItem[] = [
      { asset: 'USDT', total: 100000, available: 100000, locked: 0 },
      { asset: 'BTC', total: 1.0, available: 1.0, locked: 0 },
      { asset: 'ETH', total: 10.0, available: 10.0, locked: 0 },
      { asset: 'BNB', total: 50.0, available: 50.0, locked: 0 },
    ];
    balances.forEach(b => this._balances.set(b.asset, b));
  }

  getCapabilities(): ExchangeCapabilities {
    return {
      spot: true, margin: true, futures: false, websocket: true, rest: true,
      maxOrderBookDepth: 1000,
      supportedTimeInForce: [TimeInForce.GOOD_TILL_CANCEL, TimeInForce.IMMEDIATE_OR_CANCEL, TimeInForce.FILL_OR_KILL, TimeInForce.GOOD_TILL_DATE],
      stopLoss: true, takeProfit: true, rateLimit: 1000,
    };
  }

  async connect(config: ExchangeConfig): Promise<void> {
    this.validateConfig(config);
    this._config = config;
    this.setStatus(ConnectionStatus.CONNECTING);
    await this.sleep(100);
    this.setStatus(ConnectionStatus.CONNECTED);
    this.emit('connected', { timestamp: Date.now() });
  }

  async disconnect(): Promise<void> {
    for (const interval of Array.from(this._tickerIntervals.values())) clearInterval(interval);
    for (const interval of Array.from(this._orderBookIntervals.values())) clearInterval(interval);
    this._tickerIntervals.clear();
    this._orderBookIntervals.clear();
    this._tradeSubscriptions.clear();
    this._tickerSubscriptions.clear();
    this._orderBookSubscriptions.clear();
    this._config = null;
    this.setStatus(ConnectionStatus.DISCONNECTED);
    this.emit('disconnected', { timestamp: Date.now() });
  }

  async getBalance(): Promise<Balance> {
    this.ensureConnected();
    const assets = Array.from(this._balances.values());
    return { timestamp: Date.now(), assets };
  }

  async getTicker(symbol: string): Promise<Ticker> {
    this.ensureConnected();
    const market = this.getMarket(symbol);
    const price = this.simulatePrice(market);
    return {
      symbol, last: price, bid: price * 0.9999, ask: price * 1.0001,
      high: price * 1.02, low: price * 0.98, volume: Math.random() * 1000000,
      quoteVolume: Math.random() * 1000000000, changePercent: (Math.random() - 0.5) * 10,
      timestamp: Date.now(),
    };
  }

  async getOrderBook(symbol: string, depth: number = 20): Promise<OrderBook> {
    this.ensureConnected();
    const market = this.getMarket(symbol);
    const price = this.simulatePrice(market);
    const bids: OrderBookLevel[] = [];
    const asks: OrderBookLevel[] = [];
    for (let i = 0; i < depth; i++) {
      bids.push({ price: price * (1 - (i + 1) * 0.0001), quantity: Math.random() * 10 });
      asks.push({ price: price * (1 + (i + 1) * 0.0001), quantity: Math.random() * 10 });
    }
    return { symbol, bids, asks, timestamp: Date.now(), sequence: Date.now() };
  }

  async placeOrder(order: OrderParams): Promise<OrderResult> {
    this.ensureConnected();
    this.validateOrderParams(order);
    const market = this.getMarket(order.symbol);
    const orderId = `mock-${this._orderIdCounter++}`;
    const now = Date.now();
    const isMarketOrder = order.type === OrderType.MARKET;
    const fillPrice = order.price ?? this.simulatePrice(market);
    const fillQuantity = isMarketOrder ? order.quantity : 0;

    const mockOrder: MockOrder = {
      orderId, clientOrderId: order.clientOrderId, symbol: order.symbol,
      side: order.side, type: order.type, status: isMarketOrder ? OrderStatus.FILLED : OrderStatus.NEW,
      quantity: order.quantity, filledQuantity: fillQuantity, avgPrice: isMarketOrder ? fillPrice : 0,
      price: order.price, timeInForce: order.timeInForce,
      fee: fillQuantity * fillPrice * 0.001, feeCurrency: order.symbol.replace(/USDT?$/, ''),
      remainingQuantity: isMarketOrder ? 0 : order.quantity,
      createdAt: now, updatedAt: now,
    };

    this._orders.set(orderId, mockOrder);
    this.updateBalanceForOrder(order, fillQuantity, fillPrice);

    if (!isMarketOrder && Math.random() > 0.5) {
      setTimeout(() => this.simulateFill(orderId), 1000 + Math.random() * 5000);
    }

    return { ...mockOrder };
  }

  async cancelOrder(orderId: string, symbol?: string): Promise<void> {
    this.ensureConnected();
    const order = this._orders.get(orderId);
    if (!order) throw new ExchangeError(ExchangeErrorType.ORDER_NOT_FOUND, `Order not found: ${orderId}`, this.exchangeId);
    if (order.status === OrderStatus.FILLED || order.status === OrderStatus.CANCELED) {
      throw new ExchangeError(ExchangeErrorType.INVALID_ORDER, `Cannot cancel order in status: ${order.status}`, this.exchangeId);
    }
    order.status = OrderStatus.CANCELED;
    order.updatedAt = Date.now();
    order.remainingQuantity = order.quantity - order.filledQuantity;
    this.releaseLockedBalance(order);
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    this.ensureConnected();
    return Array.from(this._orders.values()).filter(
      o => (o.status === OrderStatus.NEW || o.status === OrderStatus.PARTIALLY_FILLED) && (!symbol || o.symbol === symbol)
    );
  }

  async getOrderHistory(symbol?: string, limit: number = 100): Promise<Order[]> {
    this.ensureConnected();
    return Array.from(this._orders.values())
      .filter(o => !symbol || o.symbol === symbol)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  subscribeToTrades(symbol: string, callback: TradeCallback): void {
    if (!this._tradeSubscriptions.has(symbol)) this._tradeSubscriptions.set(symbol, new Set());
    this._tradeSubscriptions.get(symbol)!.add(callback);
  }

  unsubscribeFromTrades(symbol: string): void { this._tradeSubscriptions.delete(symbol); }

  subscribeToTicker(symbol: string, callback: TickerCallback): void {
    if (!this._tickerSubscriptions.has(symbol)) this._tickerSubscriptions.set(symbol, new Set());
    this._tickerSubscriptions.get(symbol)!.add(callback);
    if (!this._tickerIntervals.has(symbol)) {
      this._tickerIntervals.set(symbol, setInterval(() => this.emitTickerUpdate(symbol), 1000));
    }
  }

  unsubscribeFromTicker(symbol: string): void {
    this._tickerSubscriptions.delete(symbol);
    const interval = this._tickerIntervals.get(symbol);
    if (interval) { clearInterval(interval); this._tickerIntervals.delete(symbol); }
  }

  subscribeToOrderBook(symbol: string, callback: OrderBookCallback): void {
    if (!this._orderBookSubscriptions.has(symbol)) this._orderBookSubscriptions.set(symbol, new Set());
    this._orderBookSubscriptions.get(symbol)!.add(callback);
    if (!this._orderBookIntervals.has(symbol)) {
      this._orderBookIntervals.set(symbol, setInterval(() => this.emitOrderBookUpdate(symbol), 500));
    }
  }

  unsubscribeFromOrderBook(symbol: string): void {
    this._orderBookSubscriptions.delete(symbol);
    const interval = this._orderBookIntervals.get(symbol);
    if (interval) { clearInterval(interval); this._orderBookIntervals.delete(symbol); }
  }

  setBalance(asset: string, total: number, available?: number, locked: number = 0): void {
    this._balances.set(asset, { asset, total, available: available ?? total - locked, locked });
  }

  addMarket(market: MockMarket): void { this._markets.set(market.symbol, market); }

  private ensureConnected(): void {
    if (this._status !== ConnectionStatus.CONNECTED) {
      throw new ExchangeError(ExchangeErrorType.CONNECTION_ERROR, 'Not connected to exchange', this.exchangeId);
    }
  }

  private getMarket(symbol: string): MockMarket {
    const normalized = this.normalizeSymbol(symbol);
    const market = this._markets.get(normalized);
    if (!market) throw new ExchangeError(ExchangeErrorType.MARKET_NOT_FOUND, `Market not found: ${symbol}`, this.exchangeId);
    return market;
  }

  private simulatePrice(market: MockMarket): number {
    return market.basePrice * (1 + (Math.random() - 0.5) * 2 * market.volatility);
  }

  private validateOrderParams(order: OrderParams): void {
    this.getMarket(order.symbol);
    if (order.quantity <= 0) throw new ExchangeError(ExchangeErrorType.INVALID_ORDER, 'Quantity must be positive', this.exchangeId);
    if (order.type === OrderType.LIMIT && !order.price) throw new ExchangeError(ExchangeErrorType.INVALID_ORDER, 'Limit orders require a price', this.exchangeId);
  }

  private updateBalanceForOrder(order: OrderParams, quantity: number, price: number): void {
    const baseAsset = order.symbol.replace(/USDT?$/, '');
    const quoteAsset = order.symbol.match(/USDT?$/)?.[0] || 'USDT';
    if (order.side === OrderSide.BUY) {
      const qb = this._balances.get(quoteAsset);
      if (qb) { qb.available -= quantity * price; qb.locked += quantity * price; }
      let bb = this._balances.get(baseAsset);
      if (!bb) { bb = { asset: baseAsset, total: 0, available: 0, locked: 0 }; this._balances.set(baseAsset, bb); }
      bb.total += quantity; bb.available += quantity;
    } else {
      const bb = this._balances.get(baseAsset);
      if (bb) { bb.available -= quantity; bb.locked += quantity; }
      const qb = this._balances.get(quoteAsset);
      if (qb) { qb.total += quantity * price; qb.available += quantity * price; }
    }
  }

  private releaseLockedBalance(order: MockOrder): void {
    const baseAsset = order.symbol.replace(/USDT?$/, '');
    const quoteAsset = order.symbol.match(/USDT?$/)?.[0] || 'USDT';
    if (order.side === OrderSide.BUY) {
      const qb = this._balances.get(quoteAsset);
      if (qb) { const cost = order.remainingQuantity * (order.price || 0); qb.locked -= cost; qb.available += cost; }
    } else {
      const bb = this._balances.get(baseAsset);
      if (bb) { bb.locked -= order.remainingQuantity; bb.available += order.remainingQuantity; }
    }
  }

  private simulateFill(orderId: string): void {
    const order = this._orders.get(orderId);
    if (!order || order.status !== OrderStatus.NEW) return;
    const market = this.getMarket(order.symbol);
    const fillPrice = order.price ?? this.simulatePrice(market);
    order.status = OrderStatus.FILLED;
    order.filledQuantity = order.quantity;
    order.avgPrice = fillPrice;
    order.remainingQuantity = 0;
    order.updatedAt = Date.now();
    order.fee = order.quantity * fillPrice * 0.001;

    const trade: Trade = {
      id: this.generateTradeId(), orderId: order.orderId, symbol: order.symbol,
      side: order.side, price: fillPrice, quantity: order.quantity,
      fee: order.fee, feeCurrency: order.feeCurrency, timestamp: order.updatedAt, isMaker: false,
    };
    const callbacks = this._tradeSubscriptions.get(order.symbol);
    if (callbacks) Array.from(callbacks).forEach(cb => cb(trade));
  }

  private emitTickerUpdate(symbol: string): void {
    this.getTicker(symbol).then(ticker => {
      const callbacks = this._tickerSubscriptions.get(symbol);
      if (callbacks) Array.from(callbacks).forEach(cb => cb(ticker));
    }).catch(err => this.emit('error', err));
  }

  private emitOrderBookUpdate(symbol: string): void {
    this.getOrderBook(symbol).then(orderBook => {
      const callbacks = this._orderBookSubscriptions.get(symbol);
      if (callbacks) Array.from(callbacks).forEach(cb => cb(orderBook));
    }).catch(err => this.emit('error', err));
  }
}
