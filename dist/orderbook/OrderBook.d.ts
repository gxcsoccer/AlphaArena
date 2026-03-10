import { Order, OrderBookSnapshot, OrderBookDepth } from './types';
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
export declare class OrderBook {
    private bids;
    private asks;
    private orders;
    constructor();
    /**
     * 添加订单
     * @param order 订单对象
     */
    add(order: Order): void;
    /**
     * 取消订单
     * @param orderId 订单 ID
     * @returns 是否成功取消
     */
    cancel(orderId: string): boolean;
    /**
     * 修改订单
     * @param orderId 订单 ID
     * @param newQuantity 新数量
     * @param newPrice 新价格（可选）
     * @returns 是否成功修改
     */
    modify(orderId: string, newQuantity: number, newPrice?: number): boolean;
    /**
     * 获取最优买价
     * @returns 最优买价，如果没有买单则返回 null
     */
    getBestBid(): number | null;
    /**
     * 获取最优卖价
     * @returns 最优卖价，如果没有卖单则返回 null
     */
    getBestAsk(): number | null;
    /**
     * 获取订单簿深度
     * @returns 订单簿深度信息
     */
    getDepth(): OrderBookDepth;
    /**
     * 获取订单簿快照
     * @param levels 价格层级数量（可选）
     * @returns 订单簿快照
     */
    getSnapshot(levels?: number): OrderBookSnapshot;
    /**
     * 获取订单数量
     * @returns 订单总数
     */
    getOrderCount(): number;
    /**
     * 根据 ID 获取订单
     * @param orderId 订单 ID
     * @returns 订单对象，如果不存在则返回 null
     */
    getOrder(orderId: string): Order | null;
    /**
     * 清空订单簿
     */
    clear(): void;
    /**
     * 排序订单：价格优先，时间优先
     * @param orders 订单列表
     */
    private sortOrders;
}
//# sourceMappingURL=OrderBook.d.ts.map