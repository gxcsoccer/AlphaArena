/**
 * Export Service
 *
 * @module export/ExportService
 * @description Main service for managing data export and report generation
 */

import { TradesDAO, Trade, TradeFilters } from '../database/trades.dao';
import { PortfoliosDAO } from '../database/portfolios.dao';
import { StrategiesDAO } from '../database/strategies.dao';
import { CSVExporter } from './CSVExporter';
import { PDFReporter } from './PDFReporter';
import {
  ExportFormat,
  TradeExportOptions,
  PerformanceExportOptions,
  BacktestExportOptions,
  PortfolioExportOptions,
  ExportResult,
  PerformanceMetrics,
  TradeExportData,
  PortfolioExportData,
  PositionExportData,
  AssetDistribution,
} from './types';

/**
 * Export Service class
 * Provides unified interface for exporting various data types
 */
export class ExportService {
  private csvExporter: CSVExporter;
  private pdfReporter: PDFReporter;
  private tradesDAO: TradesDAO;
  private portfoliosDAO: PortfoliosDAO;
  private strategiesDAO: StrategiesDAO;

  constructor() {
    this.csvExporter = new CSVExporter();
    this.pdfReporter = new PDFReporter();
    this.tradesDAO = new TradesDAO();
    this.portfoliosDAO = new PortfoliosDAO();
    this.strategiesDAO = new StrategiesDAO();
  }

  /**
   * Export trades to CSV or PDF
   * @param options - Export options
   * @returns ExportResult with exported content
   */
  async exportTrades(options: TradeExportOptions): Promise<ExportResult> {
    // Build filters from options
    const filters: TradeFilters = {
      strategyId: options.strategyId,
      symbol: options.symbol,
      side: options.side,
      startDate: options.startDate,
      endDate: options.endDate,
    };

    // Fetch trades
    const trades = await this.tradesDAO.getMany(filters);

    // Convert to export format
    const exportData: TradeExportData[] = await Promise.all(
      trades.map(async trade => {
        let strategyName: string | undefined;
        if (trade.strategyId) {
          try {
            const strategy = await this.strategiesDAO.getById(trade.strategyId);
            strategyName = strategy?.name;
          } catch {
            // Strategy not found, ignore
          }
        }

        return {
          id: trade.id,
          executedAt: trade.executedAt,
          symbol: trade.symbol,
          side: trade.side,
          price: trade.price,
          quantity: trade.quantity,
          total: trade.total,
          fee: trade.fee,
          feeCurrency: trade.feeCurrency || undefined,
          strategyId: trade.strategyId || undefined,
          strategyName,
          orderId: trade.orderId || undefined,
          tradeId: trade.tradeId || undefined,
        };
      })
    );

    // Export based on format
    if (options.format === 'csv') {
      return this.csvExporter.exportTrades(exportData, options.includeHeaders ?? true);
    } else {
      return this.pdfReporter.exportTrades(exportData, 'Trade History Report');
    }
  }

  /**
   * Export performance report
   * @param options - Export options
   * @returns ExportResult with performance report
   */
  async exportPerformance(options: PerformanceExportOptions): Promise<ExportResult> {
    // Calculate performance metrics
    const metrics = await this.calculatePerformanceMetrics(
      options.startDate,
      options.endDate,
      options.strategyId
    );

    // Export based on format
    if (options.format === 'csv') {
      return this.csvExporter.exportPerformance(metrics);
    } else {
      return this.pdfReporter.exportPerformance(metrics);
    }
  }

  /**
   * Export backtest results
   * @param options - Export options
   * @param backtestResult - Backtest result data (optional, will be loaded if not provided)
   * @returns ExportResult with backtest report
   */
  async exportBacktest(
    options: BacktestExportOptions,
    backtestResult?: any
  ): Promise<ExportResult> {
    // For now, we require the backtest result to be passed in
    // In a full implementation, we would load it from storage
    if (!backtestResult) {
      throw new Error('Backtest result not found');
    }

    if (options.format === 'csv') {
      return this.csvExporter.exportBacktest(backtestResult, options.includeTrades ?? true);
    } else {
      return this.pdfReporter.exportBacktest(backtestResult);
    }
  }

  /**
   * Export portfolio snapshot
   * @param options - Export options
   * @returns ExportResult with portfolio report
   */
  async exportPortfolio(options: PortfolioExportOptions): Promise<ExportResult> {
    // Get current portfolio data
    const portfolioData = await this.getPortfolioExportData();

    if (options.format === 'csv') {
      return this.csvExporter.exportPortfolio(portfolioData, options.includePositions ?? true);
    } else {
      return this.pdfReporter.exportPortfolio(portfolioData);
    }
  }

  /**
   * Calculate performance metrics for a given period
   */
  private async calculatePerformanceMetrics(
    startDate?: Date,
    endDate?: Date,
    strategyId?: string
  ): Promise<PerformanceMetrics> {
    // Get trades for the period
    const filters: TradeFilters = {
      startDate,
      endDate,
      strategyId,
    };
    const trades = await this.tradesDAO.getMany(filters);

    // Calculate metrics
    const totalTrades = trades.length;
    let winningTrades = 0;
    let losingTrades = 0;
    let totalWin = 0;
    let totalLoss = 0;
    let totalVolume = 0;
    let totalFees = 0;

    for (const trade of trades) {
      totalVolume += trade.total;
      totalFees += trade.fee;

      // Calculate P&L (simplified - real implementation would need position tracking)
      // For now, we'll estimate based on buy/sell
      if (trade.side === 'sell') {
        winningTrades++;
        totalWin += trade.total;
      } else {
        losingTrades++;
        totalLoss += trade.total;
      }
    }

    const avgWin = winningTrades > 0 ? totalWin / winningTrades : 0;
    const avgLoss = losingTrades > 0 ? totalLoss / losingTrades : 0;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const profitFactor = totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0;

    // Get stats from trades DAO
    const stats = await this.tradesDAO.getStats(strategyId);

    // Calculate returns (simplified)
    const initialCapital = 10000; // Default, should be from portfolio
    const finalCapital = initialCapital + (totalWin - totalLoss);
    const totalReturn = ((finalCapital - initialCapital) / initialCapital) * 100;
    const annualizedReturn = totalReturn; // Simplified, should account for period length

    // Calculate Sharpe ratio (simplified)
    const sharpeRatio = 0; // Would need daily returns to calculate properly

    // Max drawdown (simplified)
    const maxDrawdown = 0; // Would need equity curve to calculate properly

    return {
      startDate: startDate || new Date(0),
      endDate: endDate || new Date(),
      initialCapital,
      finalCapital,
      totalReturn,
      annualizedReturn,
      sharpeRatio,
      maxDrawdown,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      totalVolume,
      totalFees,
    };
  }

  /**
   * Get portfolio data for export
   */
  private async getPortfolioExportData(): Promise<PortfolioExportData> {
    // Get latest portfolio from DAO
    const portfolio = await this.portfoliosDAO.getLatest();

    if (!portfolio) {
      // Return empty portfolio if none exists
      return {
        timestamp: new Date(),
        totalValue: 0,
        cash: 0,
        unrealizedPnL: 0,
        positions: [],
        assetDistribution: [],
      };
    }

    // Get current positions (simplified - real implementation would fetch from portfolio service)
    const positions: PositionExportData[] = [];
    const assetDistribution: AssetDistribution[] = [];

    // Calculate totals
    const totalValue = portfolio.totalValue || 0;
    const cash = portfolio.quoteBalance || 0;
    const unrealizedPnL = 0;

    return {
      timestamp: portfolio.snapshotAt,
      totalValue,
      cash,
      unrealizedPnL,
      positions,
      assetDistribution,
    };
  }
}

// Export singleton instance
export const exportService = new ExportService();
