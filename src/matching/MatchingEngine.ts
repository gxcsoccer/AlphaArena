import { Order, OrderType } from '../orderbook/types';
import { OrderBook } from '../orderbook/OrderBook';
import { Trade, TradeStatus, OrderWithFill, MatchResult } from './types';

/**
 * MatchingEngine - 订单撮合引擎
 * 
 * Features:
 * - 基于订单簿进行撮合
 * - 支持市价单 (market order) 和限价单 (limit order)
 * - 实现价格优先、时间优先的撮合逻辑
 * - 生成成交记录 (trade record)
 * - 支持部分成交 (partial fill)
 */
export class MatchingEngine {
  private orderBook: OrderBook;
  private trades: Trade[];
  private tradeCounter: number;

  constructor(orderBook: OrderBook) {
    this.orderBook = orderBook;
    this.trades = [];
    this.tradeCounter = 0;
  }

  /**
   * 提交订单并进行撮合
   * @param order 订单对象
   * @returns 撮合结果
   */
  submitOrder(order: Order): MatchResult {
    const result: MatchResult = {
      trades: [],
      remainingOrder: null
    };

    // 根据订单类型确定对手方
    const oppositeType = order.type === OrderType.BID ? OrderType.ASK : OrderType.BID;
    
    // 查找可撮合的订单
    let remainingQuantity = order.quantity;
    const currentPrice = order.price;

    // 撮合循环
    while (remainingQuantity > 0) {
      // 获取最优对手方价格
      const bestOppositePrice = oppositeType === OrderType.BID 
        ? this.orderBook.getBestBid() 
        : this.orderBook.getBestAsk();

      if (bestOppositePrice === null) {
        // 没有对手方订单，退出
        break;
      }

      // 检查价格是否匹配
      // 买单：订单价格 >= 卖单价格
      // 卖单：订单价格 <= 买单价格
      if (order.type === OrderType.BID && currentPrice < bestOppositePrice) {
        break;  // 买价不够高
      }
      if (order.type === OrderType.ASK && currentPrice > bestOppositePrice) {
        break;  // 卖价不够低
      }

      // 获取对手方价格层级的订单
      const oppositeLevels = oppositeType === OrderType.BID 
        ? this.orderBook.getBidsByPrice(bestOppositePrice)
        : this.orderBook.getAsksByPrice(bestOppositePrice);

      if (!oppositeLevels || oppositeLevels.length === 0) {
        break;
      }

      // 按时间优先顺序撮合
      for (const oppositeOrder of oppositeLevels) {
        if (remainingQuantity <= 0) {
          break;
        }

        // 计算成交量
        const fillQuantity = Math.min(remainingQuantity, oppositeOrder.quantity);

        // 生成成交记录
        const trade = this.createTrade(
          order.type === OrderType.BID ? order : oppositeOrder,
          order.type === OrderType.BID ? oppositeOrder : order,
          fillQuantity,
          bestOppositePrice
        );

        result.trades.push(trade);
        this.trades.push(trade);

        // 更新剩余数量
        remainingQuantity -= fillQuantity;

        // 更新对手方订单
        if (fillQuantity >= oppositeOrder.quantity) {
          // 完全成交，取消订单
          this.orderBook.cancel(oppositeOrder.id);
        } else {
          // 部分成交，修改订单数量
          this.orderBook.modify(oppositeOrder.id, oppositeOrder.quantity - fillQuantity);
        }
      }
    }

    // 处理剩余订单
    if (remainingQuantity > 0) {
      // 还有未成交的数量
      const remainingOrder: OrderWithFill = {
        order: {
          ...order,
          quantity: remainingQuantity
        },
        filledQuantity: order.quantity - remainingQuantity,
        remainingQuantity: remainingQuantity,
        status: remainingQuantity === order.quantity ? TradeStatus.PENDING : TradeStatus.PARTIALLY_FILLED
      };

      // 将剩余订单添加到订单簿
      if (remainingQuantity > 0) {
        this.orderBook.add(remainingOrder.order);
      }

      result.remainingOrder = remainingOrder;
    } else if (result.trades.length > 0) {
      // 完全成交
      const remainingOrder: OrderWithFill = {
        order,
        filledQuantity: order.quantity,
        remainingQuantity: 0,
        status: TradeStatus.FILLED
      };
      result.remainingOrder = remainingOrder;
    }

    return result;
  }

  /**
   * 创建成交记录
   */
  private createTrade(buyOrder: Order, sellOrder: Order, quantity: number, price: number): Trade {
    this.tradeCounter++;
    return {
      id: `trade-${this.tradeCounter}`,
      price,
      quantity,
      timestamp: Date.now(),
      buyOrderId: buyOrder.id,
      sellOrderId: sellOrder.id,
      status: TradeStatus.FILLED
    };
  }

  /**
   * 获取所有成交记录
   */
  getTrades(): Trade[] {
    return [...this.trades];
  }

  /**
   * 获取特定订单的成交记录
   */
  getTradesByOrderId(orderId: string): Trade[] {
    return this.trades.filter(
      trade => trade.buyOrderId === orderId || trade.sellOrderId === orderId
    );
  }

  /**
   * 清空撮合引擎
   */
  clear(): void {
    this.trades = [];
    this.tradeCounter = 0;
  }
}

// 扩展 OrderBook 以支持按价格获取订单
declare module '../orderbook/OrderBook' {
  interface OrderBook {
    getBidsByPrice(price: number): Order[];
    getAsksByPrice(price: number): Order[];
  }
}

// 添加方法到 OrderBook 原型
OrderBook.prototype.getBidsByPrice = function(price: number): Order[] {
  const level = (this as any).bids.get(price);
  return level ? [...level.orders] : [];
};

OrderBook.prototype.getAsksByPrice = function(price: number): Order[] {
  const level = (this as any).asks.get(price);
  return level ? [...level.orders] : [];
};
