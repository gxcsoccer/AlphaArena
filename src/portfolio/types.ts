/**
 * Position interface
 * 
 * Represents a single position in the portfolio.
 * Tracks the quantity and cost basis for a specific trading pair.
 * 
 * @property {string} symbol - Trading pair symbol (e.g., 'BTC/USD')
 * @property {number} quantity - Position size (positive = long, negative = short)
 * @property {number} averageCost - Weighted average entry price
 * 
 * @example
 * ```typescript
 * const position: Position = {
 *   symbol: 'BTC/USD',
 *   quantity: 1.5,
 *   averageCost: 50000,
 * };
 * 
 * // Calculate position value
 * const value = position.quantity * currentPrice;
 * ```
 */
export interface Position {
  symbol: string;
  quantity: number;
  averageCost: number; // 平均成本
}

/**
 * Portfolio snapshot interface
 * 
 * Complete state of the portfolio at a specific point in time.
 * Contains cash balance, positions, and calculated metrics.
 * 
 * @property {number} cash - Available cash balance (in quote currency)
 * @property {Position[]} positions - Array of current positions
 * @property {number} totalValue - Total portfolio value (cash + positions)
 * @property {number} unrealizedPnL - Unrealized profit/loss from open positions
 * @property {number} timestamp - Unix timestamp in milliseconds
 * 
 * @example
 * ```typescript
 * const snapshot: PortfolioSnapshot = {
 *   cash: 50000,
 *   positions: [
 *     { symbol: 'BTC/USD', quantity: 1, averageCost: 50000 },
 *   ],
 *   totalValue: 100000,
 *   unrealizedPnL: 5000,
 *   timestamp: Date.now(),
 * };
 * ```
 */
export interface PortfolioSnapshot {
  cash: number;
  positions: Position[];
  totalValue: number;
  unrealizedPnL: number;
  timestamp: number;
}

/**
 * Portfolio update result interface
 * 
 * Result of a portfolio update after a trade execution.
 * Contains the updated position and trade details.
 * 
 * @property {Position} position - Updated position after the trade
 * @property {number} tradeQuantity - Quantity traded in this update
 * @property {number} tradePrice - Price at which the trade was executed
 * @property {number} realizedPnL - Realized profit/loss (only for closing trades)
 * 
 * @example
 * ```typescript
 * // After selling 0.5 BTC at $55000
 * const result: PortfolioUpdateResult = {
 *   position: { symbol: 'BTC/USD', quantity: 0.5, averageCost: 50000 },
 *   tradeQuantity: 0.5,
 *   tradePrice: 55000,
 *   realizedPnL: 2500, // (55000 - 50000) * 0.5
 * };
 * ```
 */
export interface PortfolioUpdateResult {
  position: Position;
  tradeQuantity: number;
  tradePrice: number;
  realizedPnL: number; // 已实现盈亏（卖出时产生）
}
