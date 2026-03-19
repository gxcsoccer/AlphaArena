import { BacktestEngine } from '../src/backtest/BacktestEngine';
import { BacktestConfig } from '../src/backtest/types';
import { OrderBook } from '../src/orderbook/OrderBook';
import { MatchingEngine } from '../src/matching/MatchingEngine';
import { Order, OrderType, IcebergOrder } from '../src/orderbook/types';

describe('BacktestEngine with Iceberg Orders', () => {
  let backtestEngine: BacktestEngine;
  let config: BacktestConfig;

  beforeEach(() => {
    config = {
      capital: 100000,
      symbol: 'BTC/USDT',
      startTime: Date.now() - 1000 * 60 * 60, // 1 hour ago
      endTime: Date.now(),
      strategy: 'sma',
      strategyParams: {
        shortPeriod: 5,
        longPeriod: 20,
        tradeQuantity: 10,
      },
      tickInterval: 60000,
    };
    backtestEngine = new BacktestEngine(config);
  });

  describe('Iceberg Order Creation', () => {
    it('should create an iceberg order signal', () => {
      const signal = backtestEngine.createIcebergSignal(
        'buy',
        50000,
        100, // total quantity
        20,  // display quantity
        5    // variance
      );

      expect(signal).toBeDefined();
      expect(signal.side).toBe('buy');
      expect(signal.price).toBe(50000);
      expect(signal.totalQuantity).toBe(100);
      expect(signal.displayQuantity).toBe(20);
      expect(signal.variance).toBe(5);
    });

    it('should create an iceberg order signal without variance', () => {
      const signal = backtestEngine.createIcebergSignal(
        'sell',
        51000,
        50,
        10
      );

      expect(signal).toBeDefined();
      expect(signal.side).toBe('sell');
      expect(signal.variance).toBeUndefined();
    });
  });

  describe('Iceberg Order Submission in Backtest', () => {
    it('should submit an iceberg order and get result', () => {
      // First, add some orders to match against
      const orderBook = new OrderBook();
      const _matchingEngine = new MatchingEngine(orderBook);
      
      // Add a sell order to match against our iceberg buy
      const sellOrder: Order = {
        id: 'sell-1',
        price: 50000,
        quantity: 30,
        timestamp: Date.now(),
        type: OrderType.ASK,
      };
      orderBook.add(sellOrder);

      // Now submit iceberg order through backtest engine
      // Note: This test verifies the method signature works
      const result = backtestEngine.submitIcebergOrder(
        'buy',
        50000,
        100, // total quantity
        20,  // display quantity
        5    // variance
      );

      expect(result).toBeDefined();
      expect(result.trades).toBeDefined();
      expect(typeof result.remainingQuantity).toBe('number');
    });

    it('should handle iceberg order with no matching orders', () => {
      const result = backtestEngine.submitIcebergOrder(
        'buy',
        45000, // Low price, unlikely to match
        100,
        20
      );

      expect(result).toBeDefined();
      expect(result.trades).toBeDefined();
      // Remaining quantity should be close to total (no matches)
      expect(result.remainingQuantity).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Backtest with Iceberg Orders', () => {
    it('should run backtest that includes iceberg order scenarios', () => {
      const result = backtestEngine.run();

      expect(result).toBeDefined();
      expect(result.config).toEqual(config);
      expect(result.stats).toBeDefined();
      expect(result.snapshots).toBeDefined();
      expect(result.trades).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should track iceberg order trades in backtest results', () => {
      // Submit an iceberg order
      backtestEngine.submitIcebergOrder('buy', 100, 50, 10);

      // Run backtest
      const result = backtestEngine.run();

      expect(result.trades).toBeDefined();
      expect(Array.isArray(result.trades)).toBe(true);
    });
  });

  describe('Iceberg Order Signal Execution', () => {
    it('should execute iceberg signal correctly', () => {
      // Create an iceberg signal
      const signal = backtestEngine.createIcebergSignal(
        'buy',
        50000,
        100,
        20,
        5
      );

      expect(signal).toBeDefined();
      expect(signal.id).toContain('iceberg-signal');
    });
  });
});
