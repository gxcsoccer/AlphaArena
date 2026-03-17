import { OrderFlowAnalyzer } from '../../src/orderflow/OrderFlowAnalyzer';
import type { OrderBookSnapshot } from '../../src/orderbook/types';
import type { Trade, OrderFlowAnalysisConfig, OrderFlowAlert } from '../../src/orderflow/types';

describe('OrderFlowAnalyzer', () => {
  let analyzer: OrderFlowAnalyzer;
  const symbol = 'BTC/USDT';
  
  beforeEach(() => {
    analyzer = new OrderFlowAnalyzer(symbol, {
      largeOrder: { minNotionalValue: 10000, minQuantity: 0.1, icebergDetection: true, icebergThreshold: 3 },
      alert: { enabled: true, largeOrderThreshold: 50000, imbalanceThreshold: 2.0, deltaSpikeThreshold: 100, volumeSpikeThreshold: 3.0, cooldownMs: 1000 },
      aggregation: { intervalMs: 1000, maxDataPoints: 100 },
      performance: { updateThrottleMs: 10, historySize: 50 },
    });
  });
  
  afterEach(() => { analyzer.reset(); });
  
  const createOrderBook = (bids: Array<[number, number]>, asks: Array<[number, number]>, timestamp: number = Date.now()): OrderBookSnapshot => ({
    bids: bids.map(([price, qty]) => ({ price, orders: [], totalQuantity: qty })),
    asks: asks.map(([price, qty]) => ({ price, orders: [], totalQuantity: qty })),
    timestamp,
  });
  
  const createTrade = (id: string, price: number, quantity: number, side: 'buy' | 'sell', timestamp: number = Date.now()): Trade => ({ id, price, quantity, side, timestamp, symbol });
  
  describe('Delta 计算', () => {
    it('应该正确计算 Delta', () => {
      analyzer.processTrade(createTrade('1', 50000, 1.0, 'buy'));
      analyzer.processTrade(createTrade('2', 50100, 0.5, 'sell'));
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const result = analyzer.getResult();
          expect(result.delta.cumulative).toBe(0.5);
          resolve();
        }, 50);
      });
    });
  });
  
  describe('大单检测', () => {
    it('应该检测到大额成交', () => {
      analyzer.processTrade(createTrade('1', 50000, 2.0, 'buy'));
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const result = analyzer.getResult();
          expect(result.largeOrders.length).toBeGreaterThan(0);
          expect(result.largeOrders[0].notionalValue).toBe(100000);
          resolve();
        }, 50);
      });
    });
  });
  
  describe('订单簿不平衡', () => {
    it('应该正确计算订单簿不平衡', () => {
      analyzer.processOrderBook(createOrderBook([[49900, 100], [49800, 100]], [[50100, 50]]));
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const result = analyzer.getResult();
          expect(result.imbalance.bidDepth).toBe(200);
          expect(result.imbalance.askDepth).toBe(50);
          expect(result.imbalance.imbalanceRatio).toBe(4);
          resolve();
        }, 50);
      });
    });
  });
  
  describe('成交流分析', () => {
    it('应该计算 VWAP', () => {
      [createTrade('1', 50000, 1.0, 'buy'), createTrade('2', 50100, 1.0, 'buy'), createTrade('3', 50200, 1.0, 'sell')].forEach(t => analyzer.processTrade(t));
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const tradeFlow = analyzer.calculateTradeFlow(60000);
          expect(tradeFlow.vwap).toBeCloseTo(50100);
          expect(tradeFlow.totalVolume).toBe(3);
          resolve();
        }, 50);
      });
    });
  });
  
  describe('警报功能', () => {
    it('应该发出大单警报', (done) => {
      analyzer.on('alert', (alert: OrderFlowAlert) => {
        expect(alert.type).toBe('large_order_buy');
        done();
      });
      analyzer.processTrade(createTrade('1', 50000, 2.0, 'buy'));
    });
  });
  
  describe('性能测试', () => {
    it('应该能处理高频更新', () => {
      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        analyzer.processTrade(createTrade(`trade-${i}`, 50000 + Math.random() * 100, Math.random() * 2, Math.random() > 0.5 ? 'buy' : 'sell'));
      }
      expect(Date.now() - startTime).toBeLessThan(1000);
    });
  });
});
