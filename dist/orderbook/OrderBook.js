"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderBook = void 0;
const types_1 = require("./types");
/**
 * OrderBook - 高性能模拟订单簿
 *
 * Features:
 * - 支持买单 (bid) 和卖单 (ask) 两种订单类型
 * - 订单按价格优先、时间优先排序
 * - 支持订单的添加、取消、修改操作
 * - 支持查询最优买卖价 (best bid/ask)
 * - 支持查询订单簿深度 (order book depth)
 */
class OrderBook {
    constructor() {
        this.bids = new Map();
        this.asks = new Map();
        this.orders = new Map();
    }
    /**
     * 添加订单
     * @param order 订单对象
     */
    add(order) {
        // 如果订单已存在，先取消
        if (this.orders.has(order.id)) {
            this.cancel(order.id);
        }
        // 存储订单
        this.orders.set(order.id, order);
        // 根据订单类型添加到对应的价格层级
        const priceLevels = order.type === types_1.OrderType.BID ? this.bids : this.asks;
        if (!priceLevels.has(order.price)) {
            priceLevels.set(order.price, {
                price: order.price,
                orders: [],
                totalQuantity: 0
            });
        }
        const level = priceLevels.get(order.price);
        level.orders.push(order);
        level.totalQuantity += order.quantity;
        // 排序：价格优先，时间优先
        this.sortOrders(level.orders);
    }
    /**
     * 取消订单
     * @param orderId 订单 ID
     * @returns 是否成功取消
     */
    cancel(orderId) {
        const order = this.orders.get(orderId);
        if (!order) {
            return false;
        }
        const priceLevels = order.type === types_1.OrderType.BID ? this.bids : this.asks;
        const level = priceLevels.get(order.price);
        if (level) {
            // 从价格层级中移除订单
            const index = level.orders.findIndex(o => o.id === orderId);
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
        return true;
    }
    /**
     * 修改订单
     * @param orderId 订单 ID
     * @param newQuantity 新数量
     * @param newPrice 新价格（可选）
     * @returns 是否成功修改
     */
    modify(orderId, newQuantity, newPrice) {
        const order = this.orders.get(orderId);
        if (!order) {
            return false;
        }
        // 如果价格改变，先取消再添加
        if (newPrice !== undefined && newPrice !== order.price) {
            const updatedOrder = {
                ...order,
                quantity: newQuantity,
                price: newPrice,
                timestamp: Date.now() // 更新时间戳
            };
            this.cancel(orderId);
            this.add(updatedOrder);
            return true;
        }
        // 只修改数量
        const priceLevels = order.type === types_1.OrderType.BID ? this.bids : this.asks;
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
        return true;
    }
    /**
     * 获取最优买价
     * @returns 最优买价，如果没有买单则返回 null
     */
    getBestBid() {
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
    getBestAsk() {
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
    getDepth() {
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
            totalDepth: bidDepth + askDepth
        };
    }
    /**
     * 获取订单簿快照
     * @param levels 价格层级数量（可选）
     * @returns 订单簿快照
     */
    getSnapshot(levels) {
        const getSortedLevels = (priceLevels, isBid) => {
            const sorted = Array.from(priceLevels.values()).sort((a, b) => {
                if (isBid) {
                    return b.price - a.price; // 买单：价格降序
                }
                else {
                    return a.price - b.price; // 卖单：价格升序
                }
            });
            if (levels !== undefined) {
                return sorted.slice(0, levels);
            }
            return sorted;
        };
        return {
            bids: getSortedLevels(this.bids, true),
            asks: getSortedLevels(this.asks, false),
            timestamp: Date.now()
        };
    }
    /**
     * 获取订单数量
     * @returns 订单总数
     */
    getOrderCount() {
        return this.orders.size;
    }
    /**
     * 根据 ID 获取订单
     * @param orderId 订单 ID
     * @returns 订单对象，如果不存在则返回 null
     */
    getOrder(orderId) {
        return this.orders.get(orderId) || null;
    }
    /**
     * 清空订单簿
     */
    clear() {
        this.bids.clear();
        this.asks.clear();
        this.orders.clear();
    }
    /**
     * 排序订单：价格优先，时间优先
     * @param orders 订单列表
     */
    sortOrders(orders) {
        orders.sort((a, b) => {
            // 价格优先
            if (a.price !== b.price) {
                return b.price - a.price; // 价格高的优先
            }
            // 时间优先
            return a.timestamp - b.timestamp; // 时间早的优先
        });
    }
}
exports.OrderBook = OrderBook;
//# sourceMappingURL=OrderBook.js.map