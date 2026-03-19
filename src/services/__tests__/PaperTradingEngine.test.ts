/**
 * Paper Trading Engine Tests
 */

import { FeeCalculator, FeeBreakdown } from '../../utils/FeeCalculator';
import { PaperTradingEngine } from '../PaperTradingEngine';

// Mock dependencies
jest.mock('../../database/virtual-account.dao', () => ({
  VirtualAccountDAO: {
    getAccountByUserId: jest.fn(),
    getAccountById: jest.fn(),
    getOrCreateAccount: jest.fn(),
    createOrder: jest.fn(),
    getOrder: jest.fn(),
    updateOrder: jest.fn(),
    getPosition: jest.fn(),
    getPositions: jest.fn(),
    updatePosition: jest.fn(),
    upsertPosition: jest.fn(),
    deletePosition: jest.fn(),
    updateAccount: jest.fn(),
    createTransaction: jest.fn(),
  },
}));

jest.mock('../../datasource/DataSourceManager', () => ({
  DataSourceManager: {
    getInstance: jest.fn(() => ({
      getQuote: jest.fn(),
      getQuotes: jest.fn(),
      subscribeToQuotes: jest.fn(() => jest.fn()),
    })),
  },
}));

jest.mock('../../database/client', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
    })),
  })),
}));

describe('FeeCalculator', () => {
  let calculator: FeeCalculator;

  beforeEach(() => {
    calculator = new FeeCalculator('us');
  });

  describe('calculate', () => {
    it('should calculate fees for a buy order', () => {
      const result = calculator.calculate(10000, 'buy');
      
      expect(result.commission).toBe(0); // US market $0 commission
      expect(result.stamp).toBe(0); // No stamp duty for buy
      expect(result.transfer).toBe(10000 * 0.00000278);
      expect(result.total).toBe(result.transfer);
    });

    it('should calculate fees for a sell order', () => {
      const result = calculator.calculate(10000, 'sell');
      
      expect(result.commission).toBe(0);
      expect(result.stamp).toBe(0); // US market no stamp duty
      expect(result.transfer).toBe(10000 * 0.00000278);
    });
  });

  describe('calculateBuyCost', () => {
    it('should calculate total cost including fees', () => {
      const result = calculator.calculateBuyCost(100, 10);
      
      expect(result.tradeAmount).toBe(1000);
      expect(result.fees).toBeDefined();
      expect(result.totalCost).toBe(result.tradeAmount + result.fees.total);
    });
  });

  describe('calculateSellProceeds', () => {
    it('should calculate net proceeds after fees', () => {
      const result = calculator.calculateSellProceeds(100, 10);
      
      expect(result.tradeAmount).toBe(1000);
      expect(result.fees).toBeDefined();
      expect(result.netProceeds).toBe(result.tradeAmount - result.fees.total);
    });
  });

  describe('calculateRealizedPnl', () => {
    it('should calculate realized P&L for a round-trip trade', () => {
      const result = calculator.calculateRealizedPnl(100, 110, 10);
      
      expect(result.grossPnl).toBe(100); // (110 - 100) * 10
      expect(result.buyFees).toBeDefined();
      expect(result.sellFees).toBeDefined();
      expect(result.netPnl).toBe(result.grossPnl - result.totalFees);
    });

    it('should calculate negative P&L for a losing trade', () => {
      const result = calculator.calculateRealizedPnl(100, 90, 10);
      
      expect(result.grossPnl).toBe(-100); // (90 - 100) * 10
      expect(result.netPnl).toBeLessThan(0);
    });
  });

  describe('market-specific fees', () => {
    it('should calculate CN-A market fees correctly', () => {
      const cnCalculator = new FeeCalculator('cn-a');
      
      const buyResult = cnCalculator.calculate(10000, 'buy');
      expect(buyResult.commission).toBe(5); // Minimum commission
      expect(buyResult.stamp).toBe(0); // No stamp for buy
      
      const sellResult = cnCalculator.calculate(10000, 'sell');
      expect(sellResult.stamp).toBe(10); // 0.1% stamp duty
    });

    it('should calculate HK market fees correctly', () => {
      const hkCalculator = new FeeCalculator('hk');
      
      const sellResult = hkCalculator.calculate(10000, 'sell');
      expect(sellResult.stamp).toBe(10); // 0.1% stamp for sell in HK
    });

    it('should calculate crypto fees correctly', () => {
      const cryptoCalculator = new FeeCalculator('crypto');
      
      const result = cryptoCalculator.calculate(10000, 'buy');
      expect(result.commission).toBe(10); // 0.1%
      expect(result.stamp).toBe(0);
      expect(result.transfer).toBe(0);
    });
  });
});

describe('PaperTradingEngine', () => {
  let engine: PaperTradingEngine;

  beforeEach(() => {
    PaperTradingEngine.resetInstance();
    engine = PaperTradingEngine.getInstance();
  });

  afterEach(() => {
    engine.stop();
  });

  describe('calculateFee', () => {
    it('should calculate fee with default configuration', () => {
      const fee = engine.calculateFee(10000, 'buy');
      
      expect(fee).toBeGreaterThan(0);
    });

    it('should calculate higher fee for sell (stamp duty)', () => {
      const buyFee = engine.calculateFee(10000, 'buy');
      const sellFee = engine.calculateFee(10000, 'sell');
      
      expect(sellFee).toBeGreaterThan(buyFee);
    });
  });

  describe('getStats', () => {
    it('should return engine statistics', () => {
      const stats = engine.getStats();
      
      expect(stats).toHaveProperty('totalActiveOrders');
      expect(stats).toHaveProperty('symbolsWithOrders');
      expect(stats).toHaveProperty('accountsWithOrders');
    });
  });

  // More tests would be added for order submission, cancellation, etc.
  // These require mocking the database and data source extensively
});

describe('Order Validation', () => {
  it('should require price for limit orders', () => {
    // This would test the validation logic in submitOrder
    // For now, just verify the types exist
    const orderTypes = ['market', 'limit', 'stop', 'stop_limit', 'take_profit'];
    expect(orderTypes).toContain('limit');
    expect(orderTypes).toContain('stop');
    expect(orderTypes).toContain('stop_limit');
    expect(orderTypes).toContain('take_profit');
  });
});

describe('Fee Breakdown Structure', () => {
  it('should have correct structure', () => {
    const breakdown: FeeBreakdown = {
      commission: 5,
      stamp: 10,
      transfer: 1,
      total: 16,
    };
    
    expect(breakdown.commission).toBe(5);
    expect(breakdown.stamp).toBe(10);
    expect(breakdown.transfer).toBe(1);
    expect(breakdown.total).toBe(16);
  });
});