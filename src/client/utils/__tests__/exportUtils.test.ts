/**
 * Unit tests for export utilities
 */

import {
  exportToCSV,
  exportToJSON,
  exportToPDF,
  filterTrades,
  type ExportOptions,
  type Trade,
} from '../exportUtils';

// Mock trades data
const mockTrades: Trade[] = [
  {
    id: 'trade-1',
    strategyId: 'strategy-1',
    symbol: 'BTCUSDT',
    side: 'buy',
    price: 50000,
    quantity: 0.1,
    total: 5000,
    fee: 5,
    executedAt: '2026-03-15T10:00:00Z',
  },
  {
    id: 'trade-2',
    strategyId: 'strategy-1',
    symbol: 'BTCUSDT',
    side: 'sell',
    price: 51000,
    quantity: 0.1,
    total: 5100,
    fee: 5.1,
    executedAt: '2026-03-15T11:00:00Z',
  },
  {
    id: 'trade-3',
    strategyId: 'strategy-2',
    symbol: 'ETHUSDT',
    side: 'buy',
    price: 3000,
    quantity: 1,
    total: 3000,
    fee: 3,
    executedAt: '2026-03-16T10:00:00Z',
  },
  {
    id: 'trade-4',
    strategyId: 'strategy-2',
    symbol: 'ETHUSDT',
    side: 'sell',
    price: 3100,
    quantity: 1,
    total: 3100,
    fee: 3.1,
    executedAt: '2026-03-16T11:00:00Z',
  },
];

const defaultOptions: ExportOptions = {
  format: 'csv',
  filters: {},
  includeSummary: true,
  timezone: 'UTC',
};

describe('exportUtils', () => {
  describe('filterTrades', () => {
    it('should return all trades when no filters applied', () => {
      const result = filterTrades(mockTrades, {});
      expect(result).toHaveLength(4);
    });

    it('should filter by symbol', () => {
      const result = filterTrades(mockTrades, { symbol: 'BTCUSDT' });
      expect(result).toHaveLength(2);
      expect(result.every(t => t.symbol === 'BTCUSDT')).toBe(true);
    });

    it('should filter by side', () => {
      const result = filterTrades(mockTrades, { side: 'buy' });
      expect(result).toHaveLength(2);
      expect(result.every(t => t.side === 'buy')).toBe(true);
    });

    it('should filter by strategyId', () => {
      const result = filterTrades(mockTrades, { strategyId: 'strategy-1' });
      expect(result).toHaveLength(2);
      expect(result.every(t => t.strategyId === 'strategy-1')).toBe(true);
    });

    it('should filter by startDate', () => {
      const startDate = new Date('2026-03-16T00:00:00Z');
      const result = filterTrades(mockTrades, { startDate });
      expect(result).toHaveLength(2);
      expect(result.every(t => new Date(t.executedAt) >= startDate)).toBe(true);
    });

    it('should filter by endDate', () => {
      const endDate = new Date('2026-03-15T23:59:59Z');
      const result = filterTrades(mockTrades, { endDate });
      expect(result).toHaveLength(2);
      expect(result.every(t => new Date(t.executedAt) <= endDate)).toBe(true);
    });

    it('should combine multiple filters', () => {
      const result = filterTrades(mockTrades, {
        symbol: 'BTCUSDT',
        side: 'buy',
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('trade-1');
    });
  });

  describe('exportToCSV', () => {
    it('should generate valid CSV content', () => {
      const csv = exportToCSV(mockTrades, defaultOptions);
      
      expect(csv).toContain('Timestamp');
      expect(csv).toContain('Symbol');
      expect(csv).toContain('Side');
      expect(csv).toContain('Price');
      expect(csv).toContain('Quantity');
      expect(csv).toContain('Total');
      expect(csv).toContain('Fee');
      
      // Check data
      expect(csv).toContain('BTCUSDT');
      expect(csv).toContain('ETHUSDT');
      expect(csv).toContain('BUY');
      expect(csv).toContain('SELL');
      
      // Check summary
      expect(csv).toContain('SUMMARY');
      expect(csv).toContain('Total Trades');
      expect(csv).toContain('Total Volume');
    });

    it('should include BOM for Excel compatibility', () => {
      const csv = exportToCSV(mockTrades, defaultOptions);
      expect(csv.startsWith('\uFEFF')).toBe(true);
    });

    it('should not include summary when disabled', () => {
      const options = { ...defaultOptions, includeSummary: false };
      const csv = exportToCSV(mockTrades, options);
      expect(csv).not.toContain('SUMMARY');
    });

    it('should respect filters', () => {
      const options = {
        ...defaultOptions,
        filters: { symbol: 'BTCUSDT' },
      };
      const csv = exportToCSV(mockTrades, options);
      
      expect(csv).toContain('BTCUSDT');
      expect(csv).not.toContain('ETHUSDT');
    });

    it('should escape fields with commas', () => {
      const tradeWithComma: Trade = {
        id: 'test-id',
        symbol: 'TEST,USDT',
        side: 'buy',
        price: 100,
        quantity: 1,
        total: 100,
        fee: 0,
        executedAt: '2026-03-15T10:00:00Z',
      };
      
      const csv = exportToCSV([tradeWithComma], defaultOptions);
      expect(csv).toContain('"TEST,USDT"');
    });

    it('should call progress callback', () => {
      const progressCallback = jest.fn();
      exportToCSV(mockTrades, defaultOptions, progressCallback);
      
      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: 'complete',
          progress: 100,
        })
      );
    });
  });

  describe('exportToJSON', () => {
    it('should generate valid JSON content', () => {
      const json = exportToJSON(mockTrades, defaultOptions);
      const parsed = JSON.parse(json);
      
      expect(parsed).toHaveProperty('exportInfo');
      expect(parsed).toHaveProperty('trades');
      expect(parsed.exportInfo.totalRecords).toBe(4);
      expect(parsed.trades).toHaveLength(4);
    });

    it('should include export metadata', () => {
      const json = exportToJSON(mockTrades, defaultOptions);
      const parsed = JSON.parse(json);
      
      expect(parsed.exportInfo).toHaveProperty('exportedAt');
      expect(parsed.exportInfo).toHaveProperty('timezone');
      expect(parsed.exportInfo).toHaveProperty('filters');
    });

    it('should include summary when enabled', () => {
      const json = exportToJSON(mockTrades, defaultOptions);
      const parsed = JSON.parse(json);
      
      expect(parsed).toHaveProperty('summary');
      expect(parsed.summary.totalTrades).toBe(4);
      expect(parsed.summary.buyCount).toBe(2);
      expect(parsed.summary.sellCount).toBe(2);
    });

    it('should not include summary when disabled', () => {
      const options = { ...defaultOptions, includeSummary: false };
      const json = exportToJSON(mockTrades, options);
      const parsed = JSON.parse(json);
      
      expect(parsed).not.toHaveProperty('summary');
    });

    it('should respect filters', () => {
      const options = {
        ...defaultOptions,
        filters: { side: 'buy' },
      };
      const json = exportToJSON(mockTrades, options);
      const parsed = JSON.parse(json);
      
      expect(parsed.trades).toHaveLength(2);
      expect(parsed.trades.every((t: Trade) => t.side === 'buy')).toBe(true);
    });

    it('should include both formatted and ISO timestamps', () => {
      const json = exportToJSON(mockTrades, defaultOptions);
      const parsed = JSON.parse(json);
      
      expect(parsed.trades[0]).toHaveProperty('executedAt');
      expect(parsed.trades[0]).toHaveProperty('executedAtISO');
    });
  });

  describe('exportToPDF', () => {
    it('should generate valid HTML content', () => {
      const html = exportToPDF(mockTrades, defaultOptions);
      
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html>');
      expect(html).toContain('</html>');
      expect(html).toContain('Trading History Report');
    });

    it('should include summary when enabled', () => {
      const html = exportToPDF(mockTrades, defaultOptions);
      
      expect(html).toContain('Summary');
      expect(html).toContain('Total Trades');
      expect(html).toContain('Total Volume');
    });

    it('should include trade table', () => {
      const html = exportToPDF(mockTrades, defaultOptions);
      
      expect(html).toContain('<table>');
      expect(html).toContain('<thead>');
      expect(html).toContain('<tbody>');
      expect(html).toContain('BTCUSDT');
      expect(html).toContain('ETHUSDT');
    });

    it('should respect filters', () => {
      const options = {
        ...defaultOptions,
        filters: { symbol: 'BTCUSDT' },
      };
      const html = exportToPDF(mockTrades, options);
      
      expect(html).toContain('BTCUSDT');
      expect(html).not.toContain('ETHUSDT');
    });

    it('should include filter info in export info section', () => {
      const options = {
        ...defaultOptions,
        filters: { symbol: 'BTCUSDT', side: 'buy' },
      };
      const html = exportToPDF(mockTrades, options);
      
      expect(html).toContain('Symbol Filter');
      expect(html).toContain('Side Filter');
    });
  });
});
