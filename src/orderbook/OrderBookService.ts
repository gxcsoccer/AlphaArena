/**
 * OrderBook Service - 订单簿服务
 * 
 * 负责：
 * - 通过 WebSocket 接收市场数据源的订单簿更新
 * - 维护本地 OrderBook 实例
 * - 广播订单簿更新到客户端
 */

import { EventEmitter } from 'events';
import { OrderBook } from './OrderBook';
import { Order, OrderType, OrderBookSnapshot, OrderBookDelta, OrderBookUpdate } from './types';
import { createLogger } from '../utils/logger';

// Create logger for this module
const log = createLogger('OrderBookService');

/**
 * 市场数据源配置
 */
export interface MarketDataSourceConfig {
  symbol: string;
  url: string;
  apiKey?: string;
}

/**
 * 外部市场数据订单格式（示例：币安、火币等）
 */
export interface MarketOrderBookUpdate {
  bids: [string, string][]; // [[price, quantity], ...]
  asks: [string, string][];
  timestamp?: number;
  isSnapshot?: boolean;
}

/**
 * OrderBook Service 事件
 */
export type OrderBookServiceEvent =
  | { type: 'connected'; symbol: string }
  | { type: 'disconnected'; symbol: string }
  | { type: 'snapshot'; data: OrderBookSnapshot }
  | { type: 'delta'; data: OrderBookDelta }
  | { type: 'error'; error: Error };

/**
 * OrderBookService - 订单簿服务
 * 
 * 连接外部市场数据源，接收订单簿更新，维护本地 OrderBook 实例
 */
export class OrderBookService extends EventEmitter {
  private orderBook: OrderBook;
  private symbol: string;
  private connected: boolean = false;
  private ws: any = null; // WebSocket 实例
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 3000;

  constructor(symbol: string) {
    super();
    this.symbol = symbol;
    this.orderBook = new OrderBook();
    
    // 监听 OrderBook 内部事件并转发
    this.orderBook.on('update', (event) => {
      this.emit('update', event);
    });
  }

  /**
   * 获取 OrderBook 实例
   */
  getOrderBook(): OrderBook {
    return this.orderBook;
  }

  /**
   * 获取连接状态
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 获取当前最优买卖价
   */
  getBestPrices(): { bestBid: number | null; bestAsk: number | null; spread: number | null } {
    const bestBid = this.orderBook.getBestBid();
    const bestAsk = this.orderBook.getBestAsk();
    const spread = (bestBid && bestAsk) ? bestAsk - bestBid : null;
    
    return { bestBid, bestAsk, spread };
  }

  /**
   * 获取订单簿快照
   */
  getSnapshot(levels?: number): OrderBookSnapshot {
    return this.orderBook.getSnapshot(levels);
  }

  /**
   * 连接模拟市场数据源
   */
  connect(config?: MarketDataSourceConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      // 模拟连接延迟
      setTimeout(() => {
        this.connected = true;
        this.reconnectAttempts = 0;
        log.info('Connected to market data source', { symbol: this.symbol });
        
        this.emit('connected', { symbol: this.symbol });
        resolve();
        
        // 模拟接收市场数据更新
        this.startSimulatedUpdates();
      }, 500);
    });
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    log.info('Disconnected from market data source', { symbol: this.symbol });
    this.emit('disconnected', { symbol: this.symbol });
  }

  /**
   * 应用市场数据更新
   */
  applyMarketUpdate(update: MarketOrderBookUpdate): void {
    const timestamp = update.timestamp || Date.now();
    
    if (update.isSnapshot) {
      // 处理快照 - 清空并重建订单簿
      this.orderBook.clear();
      
      const orders: Order[] = [];
      
      // 添加买单
      update.bids.forEach(([price, quantity], index) => {
        orders.push({
          id: `bid-${this.symbol}-${price}-${index}`,
          price: parseFloat(price),
          quantity: parseFloat(quantity),
          timestamp,
          type: OrderType.BID,
        });
      });
      
      // 添加卖单
      update.asks.forEach(([price, quantity], index) => {
        orders.push({
          id: `ask-${this.symbol}-${price}-${index}`,
          price: parseFloat(price),
          quantity: parseFloat(quantity),
          timestamp,
          type: OrderType.ASK,
        });
      });
      
      // 批量添加订单
      this.orderBook.batchAdd(orders);
      
      // 发射快照事件
      const snapshot = this.orderBook.getSnapshot();
      this.emit('snapshot', { data: snapshot });
    } else {
      // 处理增量更新（简化版本）
      const delta: OrderBookDelta = {
        bids: [],
        asks: [],
        timestamp,
        isSnapshot: false,
      };
      this.emit('delta', { data: delta });
    }
  }

  /**
   * 模拟市场数据更新（用于测试和演示）
   */
  private startSimulatedUpdates(): void {
    let basePrice = 50000;
    let sequenceNumber = 0;
    
    // 初始快照
    const initialOrders: MarketOrderBookUpdate = {
      bids: [],
      asks: [],
      isSnapshot: true,
      timestamp: Date.now(),
    };
    
    for (let i = 0; i < 20; i++) {
      const bidPrice = basePrice - i * 5 - Math.random() * 2;
      const askPrice = basePrice + i * 5 + Math.random() * 2;
      const bidQty = 0.5 + Math.random() * 2;
      const askQty = 0.5 + Math.random() * 2;
      
      initialOrders.bids.push([bidPrice.toFixed(2), bidQty.toFixed(4)]);
      initialOrders.asks.push([askPrice.toFixed(2), askQty.toFixed(4)]);
    }
    
    this.applyMarketUpdate(initialOrders);
  }
}

export default OrderBookService;
