/**
 * CSV Exporter
 *
 * @module export/CSVExporter
 * @description Handles exporting data to CSV format
 */

import {
  TradeExportData,
  PortfolioExportData,
  PerformanceMetrics,
  ExportResult,
} from './types';

/**
 * CSV Exporter class
 * Provides methods to export various data types to CSV format
 */
export class CSVExporter {
  /**
   * Export trades to CSV
   * @param trades - Array of trade data
   * @param includeHeaders - Whether to include headers (default: true)
   * @returns ExportResult with CSV content
   */
  exportTrades(trades: TradeExportData[], includeHeaders: boolean = true): ExportResult {
    const headers = [
      'ID',
      'Timestamp',
      'Symbol',
      'Side',
      'Price',
      'Quantity',
      'Total',
      'Fee',
      'Fee Currency',
      'Strategy ID',
      'Strategy Name',
      'Order ID',
      'Trade ID',
      'Realized P&L',
    ];

    const rows = trades.map(trade => [
      trade.id,
      trade.executedAt.toISOString(),
      trade.symbol,
      trade.side,
      trade.price.toFixed(8),
      trade.quantity.toFixed(8),
      trade.total.toFixed(8),
      trade.fee.toFixed(8),
      trade.feeCurrency || '',
      trade.strategyId || '',
      trade.strategyName || '',
      trade.orderId || '',
      trade.tradeId || '',
      trade.realizedPnL !== undefined ? trade.realizedPnL.toFixed(8) : '',
    ]);

    const csvContent = [
      ...(includeHeaders ? [headers.join(',')] : []),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `trades_${timestamp}.csv`;

    return {
      content: csvContent,
      contentType: 'text/csv',
      filename,
      size: Buffer.byteLength(csvContent, 'utf-8'),
    };
  }

  /**
   * Export portfolio snapshot to CSV
   * @param portfolio - Portfolio data
   * @param includePositions - Include position details
   * @returns ExportResult with CSV content
   */
  exportPortfolio(portfolio: PortfolioExportData, includePositions: boolean = true): ExportResult {
    const lines: string[] = [];

    // Summary section
    lines.push('Portfolio Summary');
    lines.push(`Timestamp,${portfolio.timestamp.toISOString()}`);
    lines.push(`Total Value,${portfolio.totalValue.toFixed(8)}`);
    lines.push(`Cash Balance,${portfolio.cash.toFixed(8)}`);
    lines.push(`Unrealized P&L,${portfolio.unrealizedPnL.toFixed(8)}`);
    lines.push('');

    // Positions section
    if (includePositions && portfolio.positions.length > 0) {
      lines.push('Positions');
      lines.push('Symbol,Quantity,Average Cost,Current Price,Value,Unrealized P&L,P&L %');
      for (const pos of portfolio.positions) {
        lines.push(
          [
            pos.symbol,
            pos.quantity.toFixed(8),
            pos.averageCost.toFixed(8),
            pos.currentPrice.toFixed(8),
            pos.value.toFixed(8),
            pos.unrealizedPnL.toFixed(8),
            pos.pnlPercent.toFixed(2) + '%',
          ].join(',')
        );
      }
      lines.push('');
    }

    // Asset distribution section
    if (portfolio.assetDistribution && portfolio.assetDistribution.length > 0) {
      lines.push('Asset Distribution');
      lines.push('Symbol,Value,Percentage');
      for (const asset of portfolio.assetDistribution) {
        lines.push(
          [asset.symbol, asset.value.toFixed(8), asset.percentage.toFixed(2) + '%'].join(',')
        );
      }
    }

    const csvContent = lines.join('\n');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `portfolio_${timestamp}.csv`;

    return {
      content: csvContent,
      contentType: 'text/csv',
      filename,
      size: Buffer.byteLength(csvContent, 'utf-8'),
    };
  }

  /**
   * Export performance metrics to CSV
   * @param metrics - Performance metrics data
   * @returns ExportResult with CSV content
   */
  exportPerformance(metrics: PerformanceMetrics): ExportResult {
    const lines: string[] = [];

    lines.push('Performance Report');
    lines.push(`Period,${metrics.startDate.toISOString()} to ${metrics.endDate.toISOString()}`);
    lines.push('');

    lines.push('Capital Summary');
    lines.push(`Initial Capital,${metrics.initialCapital.toFixed(8)}`);
    lines.push(`Final Capital,${metrics.finalCapital.toFixed(8)}`);
    lines.push(`Total Return,${metrics.totalReturn.toFixed(2)}%`);
    lines.push(`Annualized Return,${metrics.annualizedReturn.toFixed(2)}%`);
    lines.push('');

    lines.push('Risk Metrics');
    lines.push(`Sharpe Ratio,${metrics.sharpeRatio.toFixed(4)}`);
    lines.push(`Max Drawdown,${metrics.maxDrawdown.toFixed(2)}%`);
    lines.push('');

    lines.push('Trade Statistics');
    lines.push(`Total Trades,${metrics.totalTrades}`);
    lines.push(`Winning Trades,${metrics.winningTrades}`);
    lines.push(`Losing Trades,${metrics.losingTrades}`);
    lines.push(`Win Rate,${metrics.winRate.toFixed(2)}%`);
    lines.push(`Average Win,${metrics.avgWin.toFixed(8)}`);
    lines.push(`Average Loss,${metrics.avgLoss.toFixed(8)}`);
    lines.push(`Profit Factor,${metrics.profitFactor.toFixed(4)}`);
    lines.push(`Total Volume,${metrics.totalVolume.toFixed(8)}`);
    lines.push(`Total Fees,${metrics.totalFees.toFixed(8)}`);

    const csvContent = lines.join('\n');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `performance_${timestamp}.csv`;

    return {
      content: csvContent,
      contentType: 'text/csv',
      filename,
      size: Buffer.byteLength(csvContent, 'utf-8'),
    };
  }

  /**
   * Export backtest results to CSV
   * @param result - Backtest result data
   * @param includeTrades - Include trade list
   * @returns ExportResult with CSV content
   */
  exportBacktest(result: any, includeTrades: boolean = true): ExportResult {
    const lines: string[] = [];

    // Configuration section
    lines.push('Backtest Configuration');
    lines.push(`Symbol,${result.config.symbol}`);
    lines.push(`Capital,${result.config.capital}`);
    lines.push(`Strategy,${result.config.strategy}`);
    lines.push(
      `Period,${new Date(result.config.startTime).toISOString()} to ${new Date(result.config.endTime).toISOString()}`
    );
    lines.push(`Duration,${result.duration}ms`);
    lines.push('');

    // Statistics section
    if (result.stats) {
      const stats = result.stats;
      lines.push('Performance Statistics');
      lines.push(`Total Return,${stats.totalReturn?.toFixed(2) || 'N/A'}%`);
      lines.push(`Annualized Return,${stats.annualizedReturn?.toFixed(2) || 'N/A'}%`);
      lines.push(`Sharpe Ratio,${stats.sharpeRatio?.toFixed(4) || 'N/A'}`);
      lines.push(`Max Drawdown,${stats.maxDrawdown?.toFixed(2) || 'N/A'}%`);
      lines.push('');
      lines.push('Trade Statistics');
      lines.push(`Total Trades,${stats.totalTrades || 0}`);
      lines.push(`Winning Trades,${stats.winningTrades || 0}`);
      lines.push(`Losing Trades,${stats.losingTrades || 0}`);
      lines.push(`Win Rate,${stats.winRate?.toFixed(2) || 0}%`);
      lines.push(`Profit Factor,${stats.profitFactor?.toFixed(4) || 'N/A'}`);
      lines.push('');
    }

    // Equity curve section
    if (result.snapshots && result.snapshots.length > 0) {
      lines.push('Equity Curve');
      lines.push('Timestamp,Cash,Total Value,Unrealized P&L');
      for (const snapshot of result.snapshots) {
        lines.push(
          [
            new Date(snapshot.timestamp).toISOString(),
            snapshot.cash.toFixed(8),
            snapshot.totalValue.toFixed(8),
            snapshot.unrealizedPnL.toFixed(8),
          ].join(',')
        );
      }
      lines.push('');
    }

    // Trades section
    if (includeTrades && result.trades && result.trades.length > 0) {
      lines.push('Trade Log');
      lines.push('Timestamp,Symbol,Side,Price,Quantity,Total,Fee');
      for (const trade of result.trades) {
        lines.push(
          [
            new Date(trade.timestamp || trade.executedAt).toISOString(),
            trade.symbol || result.config.symbol,
            trade.side,
            trade.price?.toFixed(8) || '0',
            trade.quantity?.toFixed(8) || '0',
            trade.total?.toFixed(8) || '0',
            trade.fee?.toFixed(8) || '0',
          ].join(',')
        );
      }
    }

    const csvContent = lines.join('\n');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backtest_${timestamp}.csv`;

    return {
      content: csvContent,
      contentType: 'text/csv',
      filename,
      size: Buffer.byteLength(csvContent, 'utf-8'),
    };
  }
}
