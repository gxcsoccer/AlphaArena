/**
 * Order types
 */
export declare enum OrderType {
    BID = "bid",// 买单
    ASK = "ask"
}
/**
 * Order side
 */
export declare enum OrderSide {
    BUY = "buy",
    SELL = "sell"
}
/**
 * Order interface
 */
export interface Order {
    id: string;
    price: number;
    quantity: number;
    timestamp: number;
    type: OrderType;
}
/**
 * Price level interface
 */
export interface PriceLevel {
    price: number;
    orders: Order[];
    totalQuantity: number;
}
/**
 * Order book snapshot
 */
export interface OrderBookSnapshot {
    bids: PriceLevel[];
    asks: PriceLevel[];
    timestamp: number;
}
/**
 * Order book depth
 */
export interface OrderBookDepth {
    bidDepth: number;
    askDepth: number;
    totalDepth: number;
}
//# sourceMappingURL=types.d.ts.map