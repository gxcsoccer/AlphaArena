/**
 * Export Service Tests
 */

// Mock pdfmake before any imports
jest.mock('pdfmake', () => {
  return jest.fn().mockImplementation(() => ({
    createPdfKitDocument: jest.fn().mockReturnValue({
      on: jest.fn((event: string, callback: any) => {
        if (event === 'end') {
          setTimeout(() => callback(), 10);
        }
      }),
      end: jest.fn(),
    }),
    createPdf: jest.fn().mockImplementation(() => ({
      getBuffer: jest.fn((callback: any) => {
        setTimeout(() => callback(Buffer.from('mock-pdf-content')), 10);
      }),
      download: jest.fn(),
    })),
  }));
});

// Mock dependencies - use factory function to properly mock classes
jest.mock('../../src/database/trades.dao', () => ({
  TradesDAO: jest.fn().mockImplementation(() => ({
    getMany: jest.fn().mockResolvedValue([]),
    getStats: jest.fn().mockResolvedValue({
      totalTrades: 0,
      buyCount: 0,
      sellCount: 0,
      totalVolume: 0,
      avgTradeSize: 0,
    }),
    exportToCSV: jest.fn().mockResolvedValue(''),
  })),
}));
jest.mock('../../src/database/portfolios.dao', () => ({
  PortfoliosDAO: jest.fn().mockImplementation(() => ({
    getLatest: jest.fn().mockResolvedValue(null),
  })),
}));
jest.mock('../../src/database/strategies.dao', () => ({
  StrategiesDAO: jest.fn().mockImplementation(() => ({
    getMany: jest.fn().mockResolvedValue([]),
  })),
}));

import { ExportService } from '../../src/export/ExportService';
import { TradesDAO } from '../../src/database/trades.dao';
import { PortfoliosDAO } from '../../src/database/portfolios.dao';

describe('ExportService', () => {
  let service: ExportService;

  beforeEach(() => {
    service = new ExportService();
    jest.clearAllMocks();
  });

  describe('exportTrades', () => {
    it('should export trades to CSV format', async () => {
      const mockGetMany = jest.fn().mockResolvedValue([
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
          strategyId: null,
          orderId: null,
          tradeId: null,
          createdAt: new Date(),
        },
      ]);
      
      // Reset and reconfigure the mock
      (TradesDAO as jest.Mock).mockImplementation(() => ({
        getMany: mockGetMany,
        getStats: jest.fn().mockResolvedValue({
          totalTrades: 1,
          buyCount: 1,
          sellCount: 0,
          totalVolume: 5000,
          avgTradeSize: 5000,
        }),
        exportToCSV: jest.fn().mockResolvedValue(''),
      }));

      const newService = new ExportService();
      const result = await newService.exportTrades({
        format: 'csv',
      });

      expect(result.contentType).toBe('text/csv');
      expect(result.filename).toMatch(/^trades_.*\.csv$/);
      expect(result.content).toContain('BTC/USDT');
    });

    it('should export trades to PDF format', async () => {
      const mockGetMany = jest.fn().mockResolvedValue([
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
          strategyId: null,
          orderId: null,
          tradeId: null,
          createdAt: new Date(),
        },
      ]);
      (TradesDAO as jest.Mock).mockImplementation(() => ({
        getMany: mockGetMany,
        getStats: jest.fn().mockResolvedValue({
          totalTrades: 1,
          buyCount: 1,
          sellCount: 0,
          totalVolume: 5000,
          avgTradeSize: 5000,
        }),
      }));

      const newService = new ExportService();
      const result = await newService.exportTrades({
        format: 'pdf',
      });

      expect(result.contentType).toBe('application/pdf');
      expect(result.filename).toMatch(/^trades_.*\.pdf$/);
      expect(Buffer.isBuffer(result.content)).toBe(true);
    });

    it('should apply filters when exporting trades', async () => {
      const mockGetMany = jest.fn().mockResolvedValue([]);
      (TradesDAO as jest.Mock).mockImplementation(() => ({
        getMany: mockGetMany,
        getStats: jest.fn().mockResolvedValue({
          totalTrades: 0,
          buyCount: 0,
          sellCount: 0,
          totalVolume: 0,
          avgTradeSize: 0,
        }),
      }));

      const newService = new ExportService();
      await newService.exportTrades({
        format: 'csv',
        symbol: 'BTC/USDT',
        side: 'buy',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      });

      expect(mockGetMany).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTC/USDT',
          side: 'buy',
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        })
      );
    });
  });

  describe('exportPortfolio', () => {
    it('should export portfolio to CSV format', async () => {
      const mockGetLatest = jest.fn().mockResolvedValue({
        id: '1',
        symbol: 'BTC/USDT',
        baseCurrency: 'BTC',
        quoteCurrency: 'USDT',
        baseBalance: 0.1,
        quoteBalance: 5000,
        totalValue: 10000,
        snapshotAt: new Date(),
        createdAt: new Date(),
      });
      (PortfoliosDAO as jest.Mock).mockImplementation(() => ({
        getLatest: mockGetLatest,
      }));

      const newService = new ExportService();
      const result = await newService.exportPortfolio({
        format: 'csv',
      });

      expect(result.contentType).toBe('text/csv');
      expect(result.filename).toMatch(/^portfolio_.*\.csv$/);
    });

    it('should export portfolio to PDF format', async () => {
      const mockGetLatest = jest.fn().mockResolvedValue(null);
      (PortfoliosDAO as jest.Mock).mockImplementation(() => ({
        getLatest: mockGetLatest,
      }));

      const newService = new ExportService();
      const result = await newService.exportPortfolio({
        format: 'pdf',
      });

      expect(result.contentType).toBe('application/pdf');
      expect(result.filename).toMatch(/^portfolio_.*\.pdf$/);
    });
  });

  describe('exportPerformance', () => {
    it('should export performance report to CSV', async () => {
      const mockGetMany = jest.fn().mockResolvedValue([]);
      const mockGetStats = jest.fn().mockResolvedValue({
        totalTrades: 0,
        totalVolume: 0,
        buyCount: 0,
        sellCount: 0,
      });
      (TradesDAO as jest.Mock).mockImplementation(() => ({
        getMany: mockGetMany,
        getStats: mockGetStats,
      }));

      const newService = new ExportService();
      const result = await newService.exportPerformance({
        format: 'csv',
      });

      expect(result.contentType).toBe('text/csv');
      expect(result.filename).toMatch(/^performance_.*\.csv$/);
    });

    it('should export performance report to PDF', async () => {
      const mockGetMany = jest.fn().mockResolvedValue([]);
      const mockGetStats = jest.fn().mockResolvedValue({
        totalTrades: 0,
        totalVolume: 0,
        buyCount: 0,
        sellCount: 0,
      });
      (TradesDAO as jest.Mock).mockImplementation(() => ({
        getMany: mockGetMany,
        getStats: mockGetStats,
      }));

      const newService = new ExportService();
      const result = await newService.exportPerformance({
        format: 'pdf',
      });

      expect(result.contentType).toBe('application/pdf');
      expect(result.filename).toMatch(/^performance_.*\.pdf$/);
    });
  });

  describe('exportBacktest', () => {
    it('should export backtest results to CSV', async () => {
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
          sharpeRatio: 1.2,
        },
        duration: 1000,
      };

      const result = await service.exportBacktest(
        {
          format: 'csv',
          backtestId: 'test',
          includeTrades: true,
        },
        backtestResult
      );

      expect(result.contentType).toBe('text/csv');
      expect(result.filename).toMatch(/^backtest_.*\.csv$/);
    });

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
          sharpeRatio: 1.2,
        },
        duration: 1000,
      };

      const result = await service.exportBacktest(
        {
          format: 'pdf',
          backtestId: 'test',
        },
        backtestResult
      );

      expect(result.contentType).toBe('application/pdf');
      expect(result.filename).toMatch(/^backtest_.*\.pdf$/);
    });

    it('should throw error when backtest result is missing', async () => {
      await expect(
        service.exportBacktest({
          format: 'csv',
          backtestId: 'missing',
        })
      ).rejects.toThrow('Backtest result not found');
    });
  });
});