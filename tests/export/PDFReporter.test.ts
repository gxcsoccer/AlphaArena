/**
 * PDF Reporter Tests
 */

import { TradeExportData, PortfolioExportData, PerformanceMetrics } from '../../src/export/types';

// Mock pdfmake before importing PDFReporter
jest.mock('pdfmake', () => {
  return jest.fn().mockImplementation(() => ({
    createPdfKitDocument: jest.fn().mockReturnValue({
      on: jest.fn((event: string, callback: any) => {
        if (event === 'end') {
          // Simulate PDF generation
          setTimeout(() => callback(), 10);
        }
      }),
      end: jest.fn(),
    }),
  }));
});

import { PDFReporter } from '../../src/export/PDFReporter';

describe('PDFReporter', () => {
  let reporter: PDFReporter;

  beforeEach(() => {
    reporter = new PDFReporter();
  });

  describe('exportTrades', () => {
    it('should export trades to PDF', async () => {
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

      const result = await reporter.exportTrades(trades, 'Trade Report');

      expect(result.contentType).toBe('application/pdf');
      expect(result.filename).toMatch(/^trades_.*\.pdf$/);
      expect(result.size).toBeGreaterThanOrEqual(0);
      expect(Buffer.isBuffer(result.content)).toBe(true);
    });

    it('should handle empty trade list', async () => {
      const result = await reporter.exportTrades([]);

      expect(result.contentType).toBe('application/pdf');
      expect(result.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('exportPortfolio', () => {
    it('should export portfolio snapshot to PDF', async () => {
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
      };

      const result = await reporter.exportPortfolio(portfolio);

      expect(result.contentType).toBe('application/pdf');
      expect(result.filename).toMatch(/^portfolio_.*\.pdf$/);
      expect(result.size).toBeGreaterThanOrEqual(0);
    });

    it('should export portfolio without positions', async () => {
      const portfolio: PortfolioExportData = {
        timestamp: new Date(),
        totalValue: 10000,
        cash: 10000,
        unrealizedPnL: 0,
        positions: [],
      };

      const result = await reporter.exportPortfolio(portfolio);

      expect(result.contentType).toBe('application/pdf');
      expect(result.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('exportPerformance', () => {
    it('should export performance metrics to PDF', async () => {
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

      const result = await reporter.exportPerformance(metrics);

      expect(result.contentType).toBe('application/pdf');
      expect(result.filename).toMatch(/^performance_.*\.pdf$/);
      expect(result.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('exportBacktest', () => {
    it('should export backtest results to PDF', async () => {
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
        duration: 1000,
      };

      const result = await reporter.exportBacktest(backtestResult);

      expect(result.contentType).toBe('application/pdf');
      expect(result.filename).toMatch(/^backtest_.*\.pdf$/);
      expect(result.size).toBeGreaterThanOrEqual(0);
    });
  });
});
