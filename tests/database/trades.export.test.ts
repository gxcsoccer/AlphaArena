import { TradesDAO } from '../../src/database/trades.dao';

describe('TradesDAO - Export', () => {
  let tradesDao: TradesDAO;

  beforeAll(() => {
    tradesDao = new TradesDAO();
  });

  describe('exportToCSV', () => {
    it('should export trades to CSV format', async () => {
      // Create test trades
      const trade1 = await tradesDao.create({
        symbol: 'BTC/USDT',
        side: 'buy',
        price: 50000,
        quantity: 0.1,
        total: 5000,
        fee: 5,
        feeCurrency: 'USDT',
        executedAt: new Date('2024-01-01T10:00:00Z'),
      });

      const trade2 = await tradesDao.create({
        symbol: 'ETH/USDT',
        side: 'sell',
        price: 3000,
        quantity: 1,
        total: 3000,
        fee: 3,
        feeCurrency: 'USDT',
        executedAt: new Date('2024-01-02T15:30:00Z'),
      });

      // Export all trades
      const csv = await tradesDao.exportToCSV();

      // Verify CSV structure
      expect(csv).toBeDefined();
      expect(csv).toContain('Timestamp,Symbol,Side,Price,Quantity,Total,Fee,Fee Currency,Strategy ID,Order ID,Trade ID');
      
      // Verify trade data is present
      expect(csv).toContain('BTC/USDT');
      expect(csv).toContain('ETH/USDT');
      expect(csv).toContain('buy');
      expect(csv).toContain('sell');
      
      // Verify CSV has correct number of lines (header + trades)
      const lines = csv.split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter exports by symbol', async () => {
      // Create test trades
      await tradesDao.create({
        symbol: 'BTC/USDT',
        side: 'buy',
        price: 50000,
        quantity: 0.1,
        total: 5000,
        executedAt: new Date(),
      });

      await tradesDao.create({
        symbol: 'ETH/USDT',
        side: 'sell',
        price: 3000,
        quantity: 1,
        total: 3000,
        executedAt: new Date(),
      });

      // Export only BTC trades
      const csv = await tradesDao.exportToCSV({ symbol: 'BTC/USDT' });

      expect(csv).toContain('BTC/USDT');
      expect(csv).not.toContain('ETH/USDT');
    });

    it('should filter exports by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Create test trades
      await tradesDao.create({
        symbol: 'BTC/USDT',
        side: 'buy',
        price: 50000,
        quantity: 0.1,
        total: 5000,
        executedAt: yesterday,
      });

      await tradesDao.create({
        symbol: 'ETH/USDT',
        side: 'sell',
        price: 3000,
        quantity: 1,
        total: 3000,
        executedAt: now,
      });

      // Export only trades from today onwards
      const csv = await tradesDao.exportToCSV({
        startDate: now,
      });

      expect(csv).toContain('ETH/USDT');
      expect(csv).not.toContain('BTC/USDT');
    });

    it('should handle empty results', async () => {
      // Export with filter that matches nothing
      const csv = await tradesDao.exportToCSV({
        symbol: 'NONEXISTENT_SYMBOL',
      });

      expect(csv).toBeDefined();
      expect(csv).toContain('Timestamp,Symbol,Side,Price,Quantity,Total,Fee,Fee Currency,Strategy ID,Order ID,Trade ID');
      
      // Should only have header line
      const lines = csv.split('\n');
      expect(lines.length).toBe(1);
    });
  });
});
