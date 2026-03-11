/**
 * Position - 持仓信息
 */
export interface Position {
  symbol: string;
  quantity: number;
  averageCost: number; // 平均成本
}

/**
 * Portfolio snapshot - 组合快照
 */
export interface PortfolioSnapshot {
  cash: number;
  positions: Position[];
  totalValue: number;
  unrealizedPnL: number;
  timestamp: number;
}

/**
 * Portfolio update result - 持仓更新结果
 */
export interface PortfolioUpdateResult {
  position: Position;
  tradeQuantity: number;
  tradePrice: number;
  realizedPnL: number; // 已实现盈亏（卖出时产生）
}
