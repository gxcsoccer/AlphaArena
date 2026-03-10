"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderSide = exports.OrderType = void 0;
/**
 * Order types
 */
var OrderType;
(function (OrderType) {
    OrderType["BID"] = "bid";
    OrderType["ASK"] = "ask"; // 卖单
})(OrderType || (exports.OrderType = OrderType = {}));
/**
 * Order side
 */
var OrderSide;
(function (OrderSide) {
    OrderSide["BUY"] = "buy";
    OrderSide["SELL"] = "sell";
})(OrderSide || (exports.OrderSide = OrderSide = {}));
//# sourceMappingURL=types.js.map