/**
 * Order Flow Analyzer
 * 
 * 订单流分析服务
 */

import { EventEmitter } from 'events';
import {
  Trade,
  CumulativeDeltaPoint,
  LargeOrder,
  OrderBookImbalance,
  TradeFlow,
  OrderFlowAlert,
  OrderFlowAnalysisResult,
  OrderFlowAnalysisConfig,
  OrderFlowHistory,
  DepthChartPoint,
  OrderQueueAnalysis,
  DEFAULT_ORDER_FLOW_CONFIG,
} from './types';
import type { OrderBookSnapshot } from '../orderbook/types';

export class OrderFlowAnalyzer extends EventEmitter {
  private config: OrderFlowAnalysisConfig;
  private symbol: string;
  private trades: Trade[] = [];
  private largeOrders: LargeOrder[] = [];
  private deltaHistory: CumulativeDeltaPoint[] = [];
  private imbalanceHistory: OrderBookImbalance[] = [];
  private cumulativeDelta: number = 0;
  private lastUpdate: number = 0;
  private lastAlertTime: Map<string, number> = new Map();
  private priceCounter: Map<string, Map<number, number>> = new Map();
  private updateTimer: NodeJS.Timeout | null = null;
  private pendingTrades: Trade[] = [];
  private pendingOrderBook: OrderBookSnapshot | null = null;
  private lastOrderBook: OrderBookSnapshot | null = null;
  private lastQueueAnalysis: OrderQueueAnalysis | null = null;

  constructor(symbol: string, config: Partial<OrderFlowAnalysisConfig> = {}) {
    super();
    this.symbol = symbol;
    this.config = { ...DEFAULT_ORDER_FLOW_CONFIG, ...config };
  }

  processTrade(trade: Trade): void {
    this.pendingTrades.push(trade);
    this.scheduleUpdate();
  }

  processOrderBook(snapshot: OrderBookSnapshot): void {
    this.pendingOrderBook = snapshot;
    this.scheduleUpdate();
  }

  private scheduleUpdate(): void {
    if (this.updateTimer) return;
    this.updateTimer = setTimeout(() => {
      this.updateTimer = null;
      this.performUpdate();
    }, this.config.performance.updateThrottleMs);
  }

  private performUpdate(): void {
    const now = Date.now();
    if (this.pendingTrades.length > 0) {
      this.trades.push(...this.pendingTrades);
      this.processTradesInternal(this.pendingTrades);
      this.pendingTrades = [];
    }
    if (this.pendingOrderBook) {
      this.processOrderBookInternal(this.pendingOrderBook);
      this.pendingOrderBook = null;
    }
    this.lastUpdate = now;
    this.trimHistory();
    this.emit('update', this.getResult());
  }

  private processTradesInternal(trades: Trade[]): void {
    for (const trade of trades) {
      const deltaValue = trade.side === 'buy' ? trade.quantity : -trade.quantity;
      this.cumulativeDelta += deltaValue;
      this.detectLargeOrder(trade);
      this.updatePriceCounter(trade);
    }
    const lastTrades = this.trades.slice(-50);
    const deltaPoint = this.calculateDeltaPoint(lastTrades);
    if (deltaPoint) this.deltaHistory.push(deltaPoint);
  }

  private processOrderBookInternal(snapshot: OrderBookSnapshot): void {
    const imbalance = this.calculateImbalance(snapshot);
    this.imbalanceHistory.push(imbalance);
    this.detectLargeOrdersInBook(snapshot);
    this.checkImbalanceAlert(imbalance);
    this.detectAndAlertLargeOrders(snapshot);
  }

  private detectLargeOrder(trade: Trade): void {
    const notionalValue = trade.price * trade.quantity;
    const { minNotionalValue, minQuantity } = this.config.largeOrder;
    if (notionalValue >= minNotionalValue || trade.quantity >= minQuantity) {
      const largeOrder: LargeOrder = {
        id: `trade-${trade.id}`,
        price: trade.price,
        quantity: trade.quantity,
        side: trade.side === 'buy' ? 'bid' : 'ask',
        timestamp: trade.timestamp,
        notionalValue,
        isIceberg: false,
        detectedAt: Date.now(),
      };
      this.largeOrders.push(largeOrder);
      if (notionalValue >= this.config.alert.largeOrderThreshold) {
        this.emitLargeOrderAlert(largeOrder);
      }
    }
  }

  private detectLargeOrdersInBook(snapshot: OrderBookSnapshot): void {
    const { minNotionalValue } = this.config.largeOrder;
    for (const level of snapshot.bids) {
      const notionalValue = level.price * level.totalQuantity;
      if (notionalValue >= minNotionalValue) {
        const existingOrder = this.largeOrders.find(o => o.price === level.price && o.side === 'bid');
        if (!existingOrder) {
          this.largeOrders.push({
            id: `book-bid-${level.price}`,
            price: level.price,
            quantity: level.totalQuantity,
            side: 'bid',
            timestamp: snapshot.timestamp,
            notionalValue,
            isIceberg: this.detectIcebergOrder(level.price, 'bid'),
            detectedAt: Date.now(),
          });
        }
      }
    }
    for (const level of snapshot.asks) {
      const notionalValue = level.price * level.totalQuantity;
      if (notionalValue >= minNotionalValue) {
        const existingOrder = this.largeOrders.find(o => o.price === level.price && o.side === 'ask');
        if (!existingOrder) {
          this.largeOrders.push({
            id: `book-ask-${level.price}`,
            price: level.price,
            quantity: level.totalQuantity,
            side: 'ask',
            timestamp: snapshot.timestamp,
            notionalValue,
            isIceberg: this.detectIcebergOrder(level.price, 'ask'),
            detectedAt: Date.now(),
          });
        }
      }
    }
  }

  private detectIcebergOrder(price: number, side: 'bid' | 'ask'): boolean {
    if (!this.config.largeOrder.icebergDetection) return false;
    const key = `${side}:${price}`;
    const count = this.priceCounter.get(key)?.get(price) || 0;
    return count >= this.config.largeOrder.icebergThreshold;
  }

  private updatePriceCounter(trade: Trade): void {
    const side = trade.side === 'buy' ? 'bid' : 'ask';
    const key = `${side}:${trade.price}`;
    if (!this.priceCounter.has(key)) this.priceCounter.set(key, new Map());
    const counter = this.priceCounter.get(key)!;
    counter.set(trade.price, (counter.get(trade.price) || 0) + 1);
  }

  private calculateImbalance(snapshot: OrderBookSnapshot): OrderBookImbalance {
    const bidDepth = snapshot.bids.reduce((sum, level) => sum + level.totalQuantity, 0);
    const askDepth = snapshot.asks.reduce((sum, level) => sum + level.totalQuantity, 0);
    const totalDepth = bidDepth + askDepth;
    const imbalanceRatio = askDepth > 0 ? bidDepth / askDepth : bidDepth > 0 ? Infinity : 1;
    const imbalancePercent = totalDepth > 0 ? ((bidDepth - askDepth) / totalDepth) * 100 : 0;
    return { bidDepth, askDepth, imbalanceRatio, imbalancePercent, timestamp: snapshot.timestamp };
  }

  private calculateDeltaPoint(trades: Trade[]): CumulativeDeltaPoint | null {
    if (trades.length === 0) return null;
    const buyVolume = trades.filter(t => t.side === 'buy').reduce((sum, t) => sum + t.quantity, 0);
    const sellVolume = trades.filter(t => t.side === 'sell').reduce((sum, t) => sum + t.quantity, 0);
    return { timestamp: Date.now(), delta: buyVolume - sellVolume, cumulative: this.cumulativeDelta, buyVolume, sellVolume };
  }

  /**
   * 计算委托队列分析
   * 分析买卖队列长度和变化速度
   */
  calculateOrderQueueAnalysis(snapshot: OrderBookSnapshot): OrderQueueAnalysis {
    const bidQueue = snapshot.bids.length;
    const askQueue = snapshot.asks.length;
    const now = Date.now();
    
    let bidVelocity = 0;
    let askVelocity = 0;
    
    // 如果有上一次的订单簿快照，计算变化速度
    if (this.lastOrderBook && this.lastQueueAnalysis) {
      const timeDiff = now - this.lastQueueAnalysis.timestamp;
      if (timeDiff > 0) {
        const bidQueueDiff = bidQueue - this.lastOrderBook.bids.length;
        const askQueueDiff = askQueue - this.lastOrderBook.asks.length;
        // 队列变化速度 = 每秒变化的订单数
        bidVelocity = bidQueueDiff / (timeDiff / 1000);
        askVelocity = askQueueDiff / (timeDiff / 1000);
      }
    }
    
    const analysis: OrderQueueAnalysis = {
      bidQueue,
      askQueue,
      bidVelocity,
      askVelocity,
      timestamp: now,
    };
    
    this.lastQueueAnalysis = analysis;
    return analysis;
  }

  calculateTradeFlow(timeWindowMs: number = 60000): TradeFlow {
    const now = Date.now();
    const cutoff = now - timeWindowMs;
    const recentTrades = this.trades.filter(t => t.timestamp >= cutoff);
    const buyVolume = recentTrades.filter(t => t.side === 'buy').reduce((sum, t) => sum + t.quantity, 0);
    const sellVolume = recentTrades.filter(t => t.side === 'sell').reduce((sum, t) => sum + t.quantity, 0);
    const totalVolume = buyVolume + sellVolume;
    const vwap = recentTrades.length > 0 ? recentTrades.reduce((sum, t) => sum + t.price * t.quantity, 0) / totalVolume : 0;
    return { trades: recentTrades, buyVolume, sellVolume, totalVolume, vwap, timestamp: now };
  }

  calculateDepthChart(snapshot: OrderBookSnapshot, levels: number = 20): DepthChartPoint[] {
    const points: DepthChartPoint[] = [];
    let bidTotal = 0, askTotal = 0;
    for (const level of snapshot.bids.slice(0, levels)) {
      bidTotal += level.totalQuantity;
      points.push({ price: level.price, bidQuantity: level.totalQuantity, askQuantity: 0, bidTotal, askTotal: 0 });
    }
    for (const level of snapshot.asks.slice(0, levels)) {
      askTotal += level.totalQuantity;
      points.push({ price: level.price, bidQuantity: 0, askQuantity: level.totalQuantity, bidTotal: 0, askTotal });
    }
    return points.sort((a, b) => a.price - b.price);
  }

  private checkImbalanceAlert(imbalance: OrderBookImbalance): void {
    if (!this.config.alert.enabled) return;
    const { imbalanceThreshold } = this.config.alert;
    if (imbalance.imbalanceRatio >= imbalanceThreshold) {
      this.emitAlert({ id: `imbalance-high-${Date.now()}`, type: 'imbalance_high', message: `买单深度是卖单的 ${imbalance.imbalanceRatio.toFixed(2)} 倍`, data: { ratio: imbalance.imbalanceRatio }, timestamp: Date.now(), severity: 'warning', acknowledged: false });
    } else if (imbalance.imbalanceRatio <= 1 / imbalanceThreshold) {
      this.emitAlert({ id: `imbalance-low-${Date.now()}`, type: 'imbalance_low', message: `卖单深度是买单的 ${(1 / imbalance.imbalanceRatio).toFixed(2)} 倍`, data: { ratio: imbalance.imbalanceRatio }, timestamp: Date.now(), severity: 'warning', acknowledged: false });
    }
  }

  private detectAndAlertLargeOrders(snapshot: OrderBookSnapshot): void {
    if (!this.config.alert.enabled) return;
    const { largeOrderThreshold } = this.config.alert;
    for (const level of snapshot.bids) {
      const notionalValue = level.price * level.totalQuantity;
      if (notionalValue >= largeOrderThreshold) {
        this.emitAlert({ id: `large-order-bid-${level.price}-${Date.now()}`, type: 'large_order_buy', message: `检测到大额买单：价格 ${level.price}，数量 ${level.totalQuantity.toFixed(4)}`, data: { price: level.price, quantity: level.totalQuantity, value: notionalValue }, timestamp: Date.now(), severity: 'info', acknowledged: false }, level.price);
      }
    }
    for (const level of snapshot.asks) {
      const notionalValue = level.price * level.totalQuantity;
      if (notionalValue >= largeOrderThreshold) {
        this.emitAlert({ id: `large-order-ask-${level.price}-${Date.now()}`, type: 'large_order_sell', message: `检测到大额卖单：价格 ${level.price}，数量 ${level.totalQuantity.toFixed(4)}`, data: { price: level.price, quantity: level.totalQuantity, value: notionalValue }, timestamp: Date.now(), severity: 'info', acknowledged: false }, level.price);
      }
    }
  }

  private emitLargeOrderAlert(order: LargeOrder): void {
    if (!this.config.alert.enabled) return;
    const alertType = order.side === 'bid' ? 'large_order_buy' : 'large_order_sell';
    this.emitAlert({ id: `large-order-${order.id}`, type: alertType, message: `检测到大额${order.side === 'bid' ? '买' : '卖'}单：价格 ${order.price}，数量 ${order.quantity.toFixed(4)}`, data: { price: order.price, quantity: order.quantity, value: order.notionalValue }, timestamp: Date.now(), severity: 'info', acknowledged: false }, order.price);
  }

  /**
   * 发出警报
   * @param alert 警报对象
   * @param price 价格级别（可选，用于去重）
   */
  private emitAlert(alert: OrderFlowAlert, price?: number): void {
    // 使用 type 和 price 组合作为去重 key，确保同一价格级别的大单能触发多个警报
    const key = price !== undefined ? `${alert.type}:${price}` : alert.type;
    const lastTime = this.lastAlertTime.get(key) || 0;
    const now = Date.now();
    if (now - lastTime < this.config.alert.cooldownMs) return;
    this.lastAlertTime.set(key, now);
    this.emit('alert', alert);
  }

  private trimHistory(): void {
    const maxSize = this.config.performance.historySize;
    if (this.trades.length > maxSize * 10) this.trades = this.trades.slice(-maxSize);
    if (this.largeOrders.length > maxSize) this.largeOrders = this.largeOrders.slice(-maxSize);
    if (this.deltaHistory.length > maxSize) this.deltaHistory = this.deltaHistory.slice(-maxSize);
    if (this.imbalanceHistory.length > maxSize) this.imbalanceHistory = this.imbalanceHistory.slice(-maxSize);
  }

  getResult(): OrderFlowAnalysisResult {
    const now = Date.now();
    const tradeFlow = this.calculateTradeFlow();
    const lastDelta = this.deltaHistory[this.deltaHistory.length - 1];
    const lastImbalance = this.imbalanceHistory[this.imbalanceHistory.length - 1];
    return {
      symbol: this.symbol,
      timestamp: now,
      delta: { value: lastDelta?.delta || 0, cumulative: this.cumulativeDelta, timestamp: now },
      imbalance: lastImbalance || { bidDepth: 0, askDepth: 0, imbalanceRatio: 1, imbalancePercent: 0, timestamp: now },
      largeOrders: this.largeOrders.slice(-50),
      tradeFlow,
      alerts: [],
    };
  }

  getHistory(): OrderFlowHistory {
    return { deltaHistory: [...this.deltaHistory], imbalanceHistory: [...this.imbalanceHistory], tradeFlowHistory: [], largeOrderHistory: [...this.largeOrders] };
  }

  reset(): void {
    this.trades = [];
    this.largeOrders = [];
    this.deltaHistory = [];
    this.imbalanceHistory = [];
    this.cumulativeDelta = 0;
    this.priceCounter.clear();
    this.lastAlertTime.clear();
    this.pendingTrades = [];
    this.pendingOrderBook = null;
    this.lastOrderBook = null;
    this.lastQueueAnalysis = null;
    if (this.updateTimer) { clearTimeout(this.updateTimer); this.updateTimer = null; }
  }

  getConfig(): OrderFlowAnalysisConfig { return { ...this.config }; }
  updateConfig(config: Partial<OrderFlowAnalysisConfig>): void { this.config = { ...this.config, ...config }; }
}

export default OrderFlowAnalyzer;
