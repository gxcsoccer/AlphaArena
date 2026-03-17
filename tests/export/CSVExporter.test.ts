/**
 * CSV Exporter Tests
 */

import { CSVExporter } from '../../src/export/CSVExporter';
import { TradeExportData, PortfolioExportData, PerformanceMetrics } from '../../src/export/types';

describe('CSVExporter', () => {
  let exporter: CSVExporter;

  beforeEach(() => {
    exporter = new CSVExporter();
  });

  describe('exportTrades', () => {
    it('should export trades to CSV with headers', () => {
      const trades: TradeExportData[] = [
        {
          id: '1',
          executedAt: new Date('2024-01-01T10:00:00Z'),
          symbol: 'BTC/USDT',
          side: 'buy',
          price: 50000,
          quantity: 0.1,
          total: 5000,
          fee: 5,
          feeCurrency: 'USDT',
        },
        {
          id: '2',
          executedAt: new Date('2024-01-01T11:00:00Z'),
          symbol: 'BTC/USDT',
          side: 'sell',
          price: 51000,
          quantity: 0.1,
          total: 5100,
          fee: 5.1,
          feeCurrency: 'USDT',
          realizedPnL: 100,
        },
      ];

      const result = exporter.exportTrades(trades, true);

      expect(result.contentType).toBe('text/csv');
      expect(result.filename).toMatch(/^trades_.*\.csv$/);
      expect(result.content).toContain('ID,Timestamp,Symbol,Side');
      expect(result.content).toContain('BTC/USDT');
      expect(result.content).toContain('buy');
      expect(result.content).toContain('sell');
      expect(result.size).toBeGreaterThan(0);
    });

    it('should export trades without headers', () => {
      const trades: TradeExportData[] = [
        {
          id: '1',
          executedAt: new Date('2024-01-01T10:00:00Z'),
          symbol: 'BTC/USDT',
          side: 'buy',
          price: 50000,
          quantity: 0.1,
          total: 5000,
          fee: 5,
        },
      ];

      const result = exporter.exportTrades(trades, false);

      expect(result.content).not.toContain('ID,Timestamp');
      expect(result.content).toContain('BTC/USDT');
    });

    it('should handle empty trade list', () => {
      const result = exporter.exportTrades([], true);

      expect(result.content).toContain('ID,Timestamp');
      expect(result.size).toBeGreaterThan(0);
    });
  });

  describe('exportPortfolio', () => {
    it('should export portfolio snapshot to CSV', () => {
      const portfolio: PortfolioExportData = {
        timestamp: new Date('2024-01-01T10:00:00Z'),
        totalValue: 10000,
        cash: 5000,
        unrealizedPnL: 100,
        positions: [
          {
            symbol: 'BTC',
            quantity: 0.1,
            averageCost: 50000,
            currentPrice: 51000,
            value: 5100,
            unrealizedPnL: 100,
            pnlPercent: 2,
          },
        ],
        assetDistribution: [
          { symbol: 'BTC', value: 5100, percentage: 51 },
          { symbol: 'USDT', value: 4900, percentage: 49 },
        ],
      };

      const result = exporter.exportPortfolio(portfolio, true);

      expect(result.contentType).toBe('text/csv');
      expect(result.filename).toMatch(/^portfolio_.*\.csv$/);
      expect(result.content).toContain('Portfolio Summary');
      expect(result.content).toContain('Total Value');
      expect(result.content).toContain('Positions');
      expect(result.content).toContain('BTC');
    });

    it('should export portfolio without positions', () => {
      const portfolio: PortfolioExportData = {
        timestamp: new Date(),
        totalValue: 10000,
        cash: 10000,
        unrealizedPnL: 0,
        positions: [],
      };

      const result = exporter.exportPortfolio(portfolio, false);

      expect(result.content).toContain('Portfolio Summary');
      expect(result.content).not.toContain('Positions');
    });
  });

  describe('exportPerformance', () => {
    it('should export performance metrics to CSV', () => {
      const metrics: PerformanceMetrics = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        initialCapital: 10000,
        finalCapital: 12000,
        totalReturn: 20,
        annualizedReturn: 240,
        sharpeRatio: 1.5,
        maxDrawdown: 5,
        totalTrades: 100,
        winningTrades: 60,
        losingTrades: 40,
        winRate: 60,
        avgWin: 100,
        avgLoss: 50,
        profitFactor: 3,
        totalVolume: 100000,
        totalFees: 100,
      };

      const result = exporter.exportPerformance(metrics);

      expect(result.contentType).toBe('text/csv');
      expect(result.filename).toMatch(/^performance_.*\.csv$/);
      expect(result.content).toContain('Performance Report');
      expect(result.content).toContain('Capital Summary');
      expect(result.content).toContain('Risk Metrics');
      expect(result.content).toContain('Trade Statistics');
      expect(result.content).toContain('20.00%');
      expect(result.content).toContain('1.5');
    });
  });

  describe('exportBacktest', () => {
    it('should export backtest results to CSV', () => {
      const backtestResult = {
        config: {
          symbol: 'BTC/USDT',
          capital: 10000,
          strategy: 'sma',
          startTime: Date.now() - 86400000 * 30,
          endTime: Date.now(),
        },
        stats: {
          totalReturn: 15,
          annualizedReturn: 180,
          sharpeRatio: 1.2,
          maxDrawdown: 8,
          totalTrades: 50,
          winningTrades: 30,
          losingTrades: 20,
          winRate: 60,
          profitFactor: 2.5,
        },
        snapshots: [
          {
            timestamp: Date.now() - 86400000 * 30,
            cash: 9000,
            totalValue: 10000,
            unrealizedPnL: 0,
          },
        ],
        trades: [
          {
            timestamp: Date.now() - 86400000 * 29,
            side: 'buy',
            price: 50000,
            quantity: 0.1,
            total: 5000,
            fee: 5,
          },
        ],
        duration: 1000,
      };

      const result = exporter.exportBacktest(backtestResult, true);

      expect(result.contentType).toBe('text/csv');
      expect(result.filename).toMatch(/^backtest_.*\.csv$/);
      expect(result.content).toContain('Backtest Configuration');
      expect(result.content).toContain('Performance Statistics');
      expect(result.content).toContain('Equity Curve');
      expect(result.content).toContain('Trade Log');
    });
  });
});
