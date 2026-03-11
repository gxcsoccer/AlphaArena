import { EventEmitter } from 'events';
import {
  Order,
  OrderType,
  PriceLevel,
  OrderBookSnapshot,
  OrderBookDepth,
  OrderBookUpdate,
  OrderBookDelta,
  OrderBookEvent,
} from './types';

/**
 * OrderBook - 高性能模拟订单簿
 *
 * Features:
 * - 支持买单 (bid) 和卖单 (ask) 两种订单类型
 * - 订单按价格优先、时间优先排序
 * - 支持订单的添加、取消、修改操作
 * - 支持查询最优买卖价 (best bid/ask)
 * - 支持查询订单簿深度 (order book depth)
 * - 支持增量更新和快照
 * - 支持事件发射用于 WebSocket 广播
 */
export class OrderBook extends EventEmitter {
  private bids: Map<number, PriceLevel>; // 买单 - 价格映射
  private asks: Map<number, PriceLevel>; // 卖单 - 价格映射
  private orders: Map<string, Order>; // 订单 ID - 订单映射
  private sequenceNumber: number; // 用于增量更新的序列号

  constructor() {
    super();
    this.bids = new Map();
    this.asks = new Map();
    this.orders = new Map();
    this.sequenceNumber = 0;
  }

  /**
   * 获取并递增序列号
   */
  private getNextSequence(): number {
    return ++this.sequenceNumber;
  }

  /**
   * 发射订单簿事件
   */
  private emitEvent(event: OrderBookEvent): void {
    this.emit('update', event);
  }

  /**
   * 添加订单
   * @param order 订单对象
   */
  add(order: Order): void {
    // 如果订单已存在，先取消
    if (this.orders.has(order.id)) {
      this.cancel(order.id);
    }

    // 存储订单
    this.orders.set(order.id, order);

    // 根据订单类型添加到对应的价格层级
    const priceLevels = order.type === OrderType.BID ? this.bids : this.asks;
    const isNewPriceLevel = !priceLevels.has(order.price);

    if (!priceLevels.has(order.price)) {
      priceLevels.set(order.price, {
        price: order.price,
        orders: [],
        totalQuantity: 0,
      });
    }

    const level = priceLevels.get(order.price)!;
    level.orders.push(order);
    level.totalQuantity += order.quantity;

    // 排序：价格优先，时间优先
    this.sortOrders(level.orders);

    // 递增序列号
    this.getNextSequence();

    // 发射增量更新事件
    const delta: OrderBookDelta = {
      bids: isNewPriceLevel ? this.getSortedLevels(this.bids, true, 1) : [],
      asks: isNewPriceLevel ? this.getSortedLevels(this.asks, false, 1) : [],
      timestamp: Date.now(),
      isSnapshot: false,
    };

    // 只包含变化的价格层级
    if (order.type === OrderType.BID) {
      delta.bids = [level];
    } else {
      delta.asks = [level];
    }

    this.emitEvent({ type: 'delta', data: delta });

    // 同时发射详细更新事件
    const update: OrderBookUpdate = {
      action: 'add',
      order,
      timestamp: Date.now(),
    };
    this.emitEvent({ type: 'update', data: update });
  }

  /**
   * 取消订单
   * @param orderId 订单 ID
   * @returns 是否成功取消
   */
  cancel(orderId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order) {
      return false;
    }

    const priceLevels = order.type === OrderType.BID ? this.bids : this.asks;
    const level = priceLevels.get(order.price);
    const isLastOrderAtLevel = level ? level.orders.length === 1 : false;

    if (level) {
      // 从价格层级中移除订单
      const index = level.orders.findIndex((o) => o.id === orderId);
      if (index !== -1) {
        level.orders.splice(index, 1);
        level.totalQuantity -= order.quantity;

        // 如果价格层级为空，删除该层级
        if (level.orders.length === 0) {
          priceLevels.delete(order.price);
        }
      }
    }

    // 从订单映射中删除
    this.orders.delete(orderId);

    // 递增序列号
    this.getNextSequence();

    // 发射增量更新事件
    const delta: OrderBookDelta = {
      bids: order.type === OrderType.BID ? (isLastOrderAtLevel ? [level!] : []) : [],
      asks: order.type === OrderType.ASK ? (isLastOrderAtLevel ? [level!] : []) : [],
      timestamp: Date.now(),
      isSnapshot: false,
    };

    this.emitEvent({ type: 'delta', data: delta });

    // 发射详细更新事件
    const update: OrderBookUpdate = {
      action: 'cancel',
      orderId,
      timestamp: Date.now(),
    };
    this.emitEvent({ type: 'update', data: update });

    return true;
  }

  /**
   * 修改订单
   * @param orderId 订单 ID
   * @param newQuantity 新数量
   * @param newPrice 新价格（可选）
   * @returns 是否成功修改
   */
  modify(orderId: string, newQuantity: number, newPrice?: number): boolean {
    const order = this.orders.get(orderId);
    if (!order) {
      return false;
    }

    const oldPrice = order.price;
    const oldQuantity = order.quantity;

    // 如果价格改变，先取消再添加
    if (newPrice !== undefined && newPrice !== order.price) {
      const updatedOrder: Order = {
        ...order,
        quantity: newQuantity,
        price: newPrice,
        timestamp: Date.now(), // 更新时间戳
      };
      this.cancel(orderId);
      this.add(updatedOrder);
      return true;
    }

    // 只修改数量
    const priceLevels = order.type === OrderType.BID ? this.bids : this.asks;
    const level = priceLevels.get(order.price);

    if (level) {
      // 更新总数量
      level.totalQuantity = level.totalQuantity - order.quantity + newQuantity;
    }

    // 更新订单
    order.quantity = newQuantity;
    order.timestamp = Date.now();

    // 重新排序
    if (level) {
      this.sortOrders(level.orders);
    }

    // 递增序列号
    this.getNextSequence();

    // 发射增量更新事件
    const delta: OrderBookDelta = {
      bids: order.type === OrderType.BID ? [level!] : [],
      asks: order.type === OrderType.ASK ? [level!] : [],
      timestamp: Date.now(),
      isSnapshot: false,
    };
    this.emitEvent({ type: 'delta', data: delta });

    // 发射详细更新事件
    const update: OrderBookUpdate = {
      action: 'modify',
      order: { ...order },
      timestamp: Date.now(),
    };
    this.emitEvent({ type: 'update', data: update });

    return true;
  }

  /**
   * 获取最优买价
   * @returns 最优买价，如果没有买单则返回 null
   */
  getBestBid(): number | null {
    if (this.bids.size === 0) {
      return null;
    }

    // 买单：价格越高优先级越高
    return Math.max(...Array.from(this.bids.keys()));
  }

  /**
   * 获取最优卖价
   * @returns 最优卖价，如果没有卖单则返回 null
   */
  getBestAsk(): number | null {
    if (this.asks.size === 0) {
      return null;
    }

    // 卖单：价格越低优先级越高
    return Math.min(...Array.from(this.asks.keys()));
  }

  /**
   * 获取订单簿深度
   * @returns 订单簿深度信息
   */
  getDepth(): OrderBookDepth {
    let bidDepth = 0;
    let askDepth = 0;

    for (const level of this.bids.values()) {
      bidDepth += level.totalQuantity;
    }

    for (const level of this.asks.values()) {
      askDepth += level.totalQuantity;
    }

    return {
      bidDepth,
      askDepth,
      totalDepth: bidDepth + askDepth,
    };
  }

  /**
   * 获取订单簿快照
   * @param levels 价格层级数量（可选）
   * @returns 订单簿快照
   */
  getSnapshot(levels?: number): OrderBookSnapshot {
    return {
      bids: this.getSortedLevels(this.bids, true, levels),
      asks: this.getSortedLevels(this.asks, false, levels),
      timestamp: Date.now(),
    };
  }

  /**
   * 获取订单数量
   * @returns 订单总数
   */
  getOrderCount(): number {
    return this.orders.size;
  }

  /**
   * 根据 ID 获取订单
   * @param orderId 订单 ID
   * @returns 订单对象，如果不存在则返回 null
   */
  getOrder(orderId: string): Order | null {
    return this.orders.get(orderId) || null;
  }

  /**
   * 清空订单簿
   */
  clear(): void {
    this.bids.clear();
    this.asks.clear();
    this.orders.clear();
  }

  /**
   * 排序订单：价格优先，时间优先
   * @param orders 订单列表
   */
  private sortOrders(orders: Order[]): void {
    orders.sort((a, b) => {
      // 价格优先
      if (a.price !== b.price) {
        return b.price - a.price; // 价格高的优先
      }
      // 时间优先
      return a.timestamp - b.timestamp; // 时间早的优先
    });
  }

  /**
   * 获取排序后的价格层级
   * @param priceLevels 价格层级 Map
   * @param isBid 是否为买单
   * @param levels 限制返回的层级数量
   */
  private getSortedLevels(
    priceLevels: Map<number, PriceLevel>,
    isBid: boolean,
    levels?: number
  ): PriceLevel[] {
    const sorted = Array.from(priceLevels.values()).sort((a, b) => {
      if (isBid) {
        return b.price - a.price; // 买单：价格降序
      } else {
        return a.price - b.price; // 卖单：价格升序
      }
    });

    if (levels !== undefined) {
      return sorted.slice(0, levels);
    }
    return sorted;
  }

  /**
   * 应用增量更新
   * @param delta 增量数据
   */
  applyDelta(delta: OrderBookDelta): void {
    // 清空现有数据并应用快照
    if (delta.isSnapshot) {
      this.bids.clear();
      this.asks.clear();
      this.orders.clear();

      // 应用买单
      for (const level of delta.bids) {
        for (const order of level.orders) {
          this.orders.set(order.id, order);
        }
        this.bids.set(level.price, level);
      }

      // 应用卖单
      for (const level of delta.asks) {
        for (const order of level.orders) {
          this.orders.set(order.id, order);
        }
        this.asks.set(level.price, level);
      }

      this.emitEvent({
        type: 'snapshot',
        data: {
          bids: delta.bids,
          asks: delta.asks,
          timestamp: delta.timestamp,
        },
      });
    }
  }

  /**
   * 批量添加订单（用于快照初始化）
   * @param orders 订单列表
   */
  batchAdd(orders: Order[]): void {
    for (const order of orders) {
      this.add(order);
    }
  }

  /**
   * 获取所有买单价格层级
   */
  getAllBids(): PriceLevel[] {
    return this.getSortedLevels(this.bids, true);
  }

  /**
   * 获取所有卖单价格层级
   */
  getAllAsks(): PriceLevel[] {
    return this.getSortedLevels(this.asks, false);
  }

  /**
   * 获取序列号
   */
  getSequenceNumber(): number {
    return this.sequenceNumber;
  }
}
