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
  IcebergOrder,
  AnyOrder,
  OrderCategory,
  isIcebergOrder,
} from './types';

/**
 * Internal order wrapper that tracks both visible and hidden quantities
 */
interface InternalOrder {
  order: AnyOrder;
  /**
   * For iceberg orders, this is the currently visible quantity
   * For regular orders, this equals order.quantity
   */
  visibleQuantity: number;
  /**
   * For iceberg orders, this is the hidden quantity
   * For regular orders, this is 0
   */
  hiddenQuantity: number;
}

/**
 * OrderBook - 高性能模拟订单簿
 *
 * Features:
 * - 支持买单 (bid) 和卖单 (ask) 两种订单类型
 * - 支持冰山订单 (iceberg order) - 只显示部分数量，隐藏剩余数量
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
  private orders: Map<string, InternalOrder>; // 订单 ID - 内部订单映射
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
   * 添加订单（支持普通订单和冰山订单）
   * @param order 订单对象
   */
  add(order: AnyOrder): void {
    // 如果订单已存在，先取消
    if (this.orders.has(order.id)) {
      this.cancel(order.id);
    }

    // 创建内部订单包装
    const internalOrder: InternalOrder = isIcebergOrder(order)
      ? {
          order,
          visibleQuantity: order.visibleQuantity,
          hiddenQuantity: order.hiddenQuantity,
        }
      : {
          order,
          visibleQuantity: order.quantity,
          hiddenQuantity: 0,
        };

    // 存储订单
    this.orders.set(order.id, internalOrder);

    // 获取用于显示的订单（冰山订单只显示可见部分）
    const displayOrder = this.getDisplayOrder(internalOrder);

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
    level.orders.push(displayOrder);
    level.totalQuantity += displayOrder.quantity;

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
      order: displayOrder,
      timestamp: Date.now(),
    };
    this.emitEvent({ type: 'update', data: update });
  }

  /**
   * 添加冰山订单
   * @param icebergOrder 冰山订单对象
   */
  addIceberg(icebergOrder: IcebergOrder): void {
    this.add(icebergOrder);
  }

  /**
   * 取消订单
   * @param orderId 订单 ID
   * @returns 是否成功取消
   */
  cancel(orderId: string): boolean {
    const internalOrder = this.orders.get(orderId);
    if (!internalOrder) {
      return false;
    }

    const order = internalOrder.order;
    const priceLevels = order.type === OrderType.BID ? this.bids : this.asks;
    const level = priceLevels.get(order.price);
    const isLastOrderAtLevel = level ? level.orders.length === 1 : false;

    if (level) {
      // 从价格层级中移除订单
      const index = level.orders.findIndex((o) => o.id === orderId);
      if (index !== -1) {
        level.orders.splice(index, 1);
        level.totalQuantity -= internalOrder.visibleQuantity;

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
    const internalOrder = this.orders.get(orderId);
    if (!internalOrder) {
      return false;
    }

    const order = internalOrder.order;

    // 冰山订单不支持修改，需要取消后重新下单
    if (isIcebergOrder(order)) {
      return false;
    }

    const oldPrice = order.price;

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
    internalOrder.visibleQuantity = newQuantity;
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
   * 填充冰山订单的可见部分
   * 当可见部分被完全成交后，从隐藏部分补充
   * 
   * @param orderId 订单 ID
   * @param fillQuantity 成交数量
   * @returns 剩余订单信息，如果订单完全成交则返回 null
   */
  fillIcebergOrder(
    orderId: string,
    fillQuantity: number
  ): { remainingQuantity: number; isVisibleRefilled: boolean } | null {
    const internalOrder = this.orders.get(orderId);
    if (!internalOrder) {
      return null;
    }

    const order = internalOrder.order;

    // 普通订单直接返回
    if (!isIcebergOrder(order)) {
      const remaining = order.quantity - fillQuantity;
      if (remaining <= 0) {
        this.cancel(orderId);
        return null;
      }
      return { remainingQuantity: remaining, isVisibleRefilled: false };
    }

    // 冰山订单处理
    const totalRemaining = order.totalQuantity - fillQuantity;
    
    if (totalRemaining <= 0) {
      // 完全成交，取消订单
      this.cancel(orderId);
      return null;
    }

    // 更新总数量
    order.totalQuantity = totalRemaining;

    // 计算新的可见和隐藏数量
    if (fillQuantity >= internalOrder.visibleQuantity) {
      // 可见部分被完全成交，从隐藏部分补充
      const displayQty = order.displayQuantity;
      
      // 应用随机方差（如果配置了）
      let newVisibleQty = displayQty;
      if (order.variance && order.variance > 0) {
        const minVisible = displayQty - order.variance;
        newVisibleQty = minVisible + Math.random() * order.variance;
      }
      
      // 确保不超过剩余总量
      newVisibleQty = Math.min(newVisibleQty, totalRemaining);
      const newHiddenQty = totalRemaining - newVisibleQty;

      internalOrder.visibleQuantity = newVisibleQty;
      internalOrder.hiddenQuantity = newHiddenQty;
      order.visibleQuantity = newVisibleQty;
      order.hiddenQuantity = newHiddenQty;

      // 更新订单簿中的显示
      this.updateIcebergDisplay(orderId);

      return { remainingQuantity: totalRemaining, isVisibleRefilled: true };
    } else {
      // 部分成交可见部分
      internalOrder.visibleQuantity -= fillQuantity;
      order.visibleQuantity = internalOrder.visibleQuantity;
      
      // 更新订单簿中的显示
      this.updateIcebergDisplay(orderId);

      return { remainingQuantity: totalRemaining, isVisibleRefilled: false };
    }
  }

  /**
   * 更新冰山订单在订单簿中的显示
   */
  private updateIcebergDisplay(orderId: string): void {
    const internalOrder = this.orders.get(orderId);
    if (!internalOrder || !isIcebergOrder(internalOrder.order)) {
      return;
    }

    const order = internalOrder.order as IcebergOrder;
    const priceLevels = order.type === OrderType.BID ? this.bids : this.asks;
    const level = priceLevels.get(order.price);

    if (level) {
      // 找到并更新订单
      const index = level.orders.findIndex((o) => o.id === orderId);
      if (index !== -1) {
        // 更新总数量
        level.totalQuantity -= level.orders[index].quantity;
        level.orders[index].quantity = internalOrder.visibleQuantity;
        level.totalQuantity += internalOrder.visibleQuantity;
      }
    }
  }

  /**
   * 获取订单的显示版本（冰山订单只显示可见部分）
   */
  private getDisplayOrder(internalOrder: InternalOrder): Order {
    const order = internalOrder.order;
    return {
      id: order.id,
      price: order.price,
      quantity: internalOrder.visibleQuantity,
      timestamp: order.timestamp,
      type: order.type,
    };
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
   * 根据 ID 获取订单（返回原始订单，包含冰山订单的完整信息）
   * @param orderId 订单 ID
   * @returns 订单对象，如果不存在则返回 null
   */
  getOrder(orderId: string): AnyOrder | null {
    const internalOrder = this.orders.get(orderId);
    return internalOrder ? internalOrder.order : null;
  }

  /**
   * 根据 ID 获取内部订单（包含可见/隐藏数量信息）
   * @param orderId 订单 ID
   * @returns 内部订单对象，如果不存在则返回 null
   */
  getInternalOrder(orderId: string): InternalOrder | null {
    return this.orders.get(orderId) || null;
  }

  /**
   * 检查订单是否为冰山订单
   * @param orderId 订单 ID
   * @returns 是否为冰山订单
   */
  isIcebergOrder(orderId: string): boolean {
    const internalOrder = this.orders.get(orderId);
    return internalOrder ? isIcebergOrder(internalOrder.order) : false;
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
          const internalOrder: InternalOrder = {
            order,
            visibleQuantity: order.quantity,
            hiddenQuantity: 0,
          };
          this.orders.set(order.id, internalOrder);
        }
        this.bids.set(level.price, level);
      }

      // 应用卖单
      for (const level of delta.asks) {
        for (const order of level.orders) {
          const internalOrder: InternalOrder = {
            order,
            visibleQuantity: order.quantity,
            hiddenQuantity: 0,
          };
          this.orders.set(order.id, internalOrder);
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
  batchAdd(orders: AnyOrder[]): void {
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
