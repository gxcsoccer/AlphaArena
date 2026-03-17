/**
 * Export types and interfaces
 *
 * @module export/types
 * @description Type definitions for data export and reporting functionality
 */

/**
 * Export format options
 */
export type ExportFormat = 'csv' | 'pdf';

/**
 * Base export options
 */
export interface ExportOptions {
  /** Export format (csv or pdf) */
  format: ExportFormat;
  /** Include headers in export */
  includeHeaders?: boolean;
  /** Date format for timestamps */
  dateFormat?: string;
  /** Number format for decimals */
  numberFormat?: string;
}

/**
 * Trade export options
 */
export interface TradeExportOptions extends ExportOptions {
  /** Filter by strategy ID */
  strategyId?: string;
  /** Filter by symbol */
  symbol?: string;
  /** Filter by side (buy/sell) */
  side?: 'buy' | 'sell';
  /** Start date filter */
  startDate?: Date;
  /** End date filter */
  endDate?: Date;
  /** Include strategy name */
  includeStrategyName?: boolean;
}

/**
 * Performance report options
 */
export interface PerformanceExportOptions extends ExportOptions {
  /** Start date for performance period */
  startDate?: Date;
  /** End date for performance period */
  endDate?: Date;
  /** Strategy ID to filter */
  strategyId?: string;
  /** Include charts in PDF */
  includeCharts?: boolean;
  /** Include trade statistics */
  includeStats?: boolean;
}

/**
 * Backtest export options
 */
export interface BacktestExportOptions extends ExportOptions {
  /** Backtest ID */
  backtestId: string;
  /** Include trade list */
  includeTrades?: boolean;
  /** Include equity curve */
  includeEquityCurve?: boolean;
  /** Include charts in PDF */
  includeCharts?: boolean;
}

/**
 * Portfolio export options
 */
export interface PortfolioExportOptions extends ExportOptions {
  /** Include current positions */
  includePositions?: boolean;
  /** Include asset distribution */
  includeDistribution?: boolean;
  /** Include P&L summary */
  includePnL?: boolean;
}

/**
 * Export result
 */
export interface ExportResult {
  /** File content (string for CSV, Buffer for PDF) */
  content: string | Buffer;
  /** Content type (mime type) */
  contentType: string;
  /** Suggested filename */
  filename: string;
  /** File size in bytes */
  size: number;
}

/**
 * Performance metrics for reports
 */
export interface PerformanceMetrics {
  /** Start date of the period */
  startDate: Date;
  /** End date of the period */
  endDate: Date;
  /** Initial capital */
  initialCapital: number;
  /** Final capital */
  finalCapital: number;
  /** Total return percentage */
  totalReturn: number;
  /** Annualized return percentage */
  annualizedReturn: number;
  /** Sharpe ratio */
  sharpeRatio: number;
  /** Maximum drawdown percentage */
  maxDrawdown: number;
  /** Total number of trades */
  totalTrades: number;
  /** Number of winning trades */
  winningTrades: number;
  /** Number of losing trades */
  losingTrades: number;
  /** Win rate percentage */
  winRate: number;
  /** Average profit per winning trade */
  avgWin: number;
  /** Average loss per losing trade */
  avgLoss: number;
  /** Profit factor (gross profit / gross loss) */
  profitFactor: number;
  /** Total trading volume */
  totalVolume: number;
  /** Total fees paid */
  totalFees: number;
}

/**
 * Trade data for export
 */
export interface TradeExportData {
  /** Trade ID */
  id: string;
  /** Execution timestamp */
  executedAt: Date;
  /** Trading pair symbol */
  symbol: string;
  /** Trade side (buy/sell) */
  side: 'buy' | 'sell';
  /** Execution price */
  price: number;
  /** Trade quantity */
  quantity: number;
  /** Total value */
  total: number;
  /** Trading fee */
  fee: number;
  /** Fee currency */
  feeCurrency?: string;
  /** Strategy ID */
  strategyId?: string;
  /** Strategy name */
  strategyName?: string;
  /** Order ID */
  orderId?: string;
  /** External trade ID */
  tradeId?: string;
  /** Realized P&L (if applicable) */
  realizedPnL?: number;
}

/**
 * Portfolio snapshot for export
 */
export interface PortfolioExportData {
  /** Snapshot timestamp */
  timestamp: Date;
  /** Total portfolio value */
  totalValue: number;
  /** Cash balance */
  cash: number;
  /** Unrealized P&L */
  unrealizedPnL: number;
  /** Position list */
  positions: PositionExportData[];
  /** Asset distribution */
  assetDistribution?: AssetDistribution[];
}

/**
 * Position data for export
 */
export interface PositionExportData {
  /** Asset symbol */
  symbol: string;
  /** Position quantity */
  quantity: number;
  /** Average cost */
  averageCost: number;
  /** Current price */
  currentPrice: number;
  /** Position value */
  value: number;
  /** Unrealized P&L */
  unrealizedPnL: number;
  /** P&L percentage */
  pnlPercent: number;
}

/**
 * Asset distribution for pie chart
 */
export interface AssetDistribution {
  /** Asset symbol */
  symbol: string;
  /** Value in quote currency */
  value: number;
  /** Percentage of total portfolio */
  percentage: number;
}

/**
 * Chart data for PDF reports
 */
export interface ChartData {
  /** Chart title */
  title: string;
  /** Chart type */
  type: 'line' | 'bar' | 'pie';
  /** Data labels */
  labels: string[];
  /** Data values */
  values: number[];
  /** Additional series for multi-series charts */
  series?: {
    label: string;
    values: number[];
  }[];
}
