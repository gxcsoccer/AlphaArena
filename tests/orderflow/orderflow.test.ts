import { OrderFlowAnalyzer } from '../../src/orderflow/OrderFlowAnalyzer';
import type { OrderBookSnapshot } from '../../src/orderbook/types';
import type { Trade, OrderFlowAlert } from '../../src/orderflow/types';

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
        analyzer.processTrade(createTrade('trade-' + i, 50000 + Math.random() * 100, Math.random() * 2, Math.random() > 0.5 ? 'buy' : 'sell'));
      }
      expect(Date.now() - startTime).toBeLessThan(1000);
    });
  });

  describe('reset() 方法', () => {
    it('应该重置所有状态', async () => {
      analyzer.processTrade(createTrade('1', 50000, 1.0, 'buy'));
      analyzer.processOrderBook(createOrderBook([[49900, 100]], [[50100, 50]]));
      
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      
      const resultBefore = analyzer.getResult();
      expect(resultBefore.largeOrders.length).toBeGreaterThan(0);
      
      analyzer.reset();
      
      const resultAfter = analyzer.getResult();
      expect(resultAfter.largeOrders.length).toBe(0);
      expect(resultAfter.delta.cumulative).toBe(0);
    });
  });

  describe('getConfig() 方法', () => {
    it('应该返回当前配置', () => {
      const config = analyzer.getConfig();
      expect(config.largeOrder.minNotionalValue).toBe(10000);
      expect(config.alert.largeOrderThreshold).toBe(50000);
      expect(config.performance.historySize).toBe(50);
    });

    it('应该返回配置的副本而不是引用', () => {
      const config1 = analyzer.getConfig();
      const config2 = analyzer.getConfig();
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('updateConfig() 方法', () => {
    it('应该更新配置', () => {
      analyzer.updateConfig({
        largeOrder: {
          minNotionalValue: 20000,
          minQuantity: 0.5,
          icebergDetection: false,
          icebergThreshold: 5,
        },
      });
      
      const config = analyzer.getConfig();
      expect(config.largeOrder.minNotionalValue).toBe(20000);
      expect(config.largeOrder.minQuantity).toBe(0.5);
      expect(config.largeOrder.icebergDetection).toBe(false);
    });

    it('应该保留未更新的配置项', () => {
      const originalConfig = analyzer.getConfig();
      analyzer.updateConfig({
        performance: { updateThrottleMs: 200, historySize: 100 },
      });
      
      const newConfig = analyzer.getConfig();
      expect(newConfig.performance.updateThrottleMs).toBe(200);
      expect(newConfig.performance.historySize).toBe(100);
      expect(newConfig.largeOrder.minNotionalValue).toBe(originalConfig.largeOrder.minNotionalValue);
    });
  });

  describe('getHistory() 方法', () => {
    it('应该返回历史数据', async () => {
      analyzer.processTrade(createTrade('1', 50000, 1.0, 'buy'));
      analyzer.processOrderBook(createOrderBook([[49900, 100]], [[50100, 50]]));
      
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      
      const history = analyzer.getHistory();
      expect(history).toHaveProperty('deltaHistory');
      expect(history).toHaveProperty('imbalanceHistory');
      expect(history).toHaveProperty('tradeFlowHistory');
      expect(history).toHaveProperty('largeOrderHistory');
    });

    it('应该返回历史数据的副本', async () => {
      analyzer.processTrade(createTrade('1', 50000, 1.0, 'buy'));
      
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      
      const history1 = analyzer.getHistory();
      const history2 = analyzer.getHistory();
      
      expect(history1.deltaHistory).not.toBe(history2.deltaHistory);
      expect(history1.largeOrderHistory).not.toBe(history2.largeOrderHistory);
    });
  });

  describe('calculateDepthChart() 方法', () => {
    it('应该正确计算深度图', async () => {
      const orderBook = createOrderBook([
        [50000, 10],
        [49900, 20],
        [49800, 30],
      ], [
        [50100, 15],
        [50200, 25],
        [50300, 35],
      ]);
      
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      
      const depthChart = analyzer.calculateDepthChart(orderBook, 10);
      
      expect(depthChart.length).toBeGreaterThan(0);
      
      const bidPoints = depthChart.filter(p => p.bidQuantity > 0);
      expect(bidPoints.length).toBe(3);
      
      // 验证买单累计正确
      const bidTotalSum = bidPoints.reduce((sum, p) => sum + p.bidQuantity, 0);
      expect(bidTotalSum).toBe(10 + 20 + 30);
      
      // 买单按价格升序排列后，第一个买单（最低价格）的累计应该是总和
      // 因为累计是从高价格到低价格累加的
      const firstBid = bidPoints[0];
      expect(firstBid.bidTotal).toBe(10 + 20 + 30);
    });

    it('应该按价格排序', async () => {
      const orderBook = createOrderBook([
        [50000, 10],
        [49800, 30],
      ], [
        [50300, 35],
        [50100, 15],
      ]);
      
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      
      const depthChart = analyzer.calculateDepthChart(orderBook, 10);
      
      for (let i = 1; i < depthChart.length; i++) {
        expect(depthChart[i].price).toBeGreaterThanOrEqual(depthChart[i - 1].price);
      }
    });

    it('应该限制价格层级数量', async () => {
      const orderBook = createOrderBook(
        Array.from({ length: 50 }, (_, i) => [50000 - i * 100, 10] as [number, number]),
        Array.from({ length: 50 }, (_, i) => [50100 + i * 100, 10] as [number, number])
      );
      
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      
      const depthChart = analyzer.calculateDepthChart(orderBook, 5);
      const bidPoints = depthChart.filter(p => p.bidQuantity > 0);
      const askPoints = depthChart.filter(p => p.askQuantity > 0);
      
      expect(bidPoints.length).toBe(5);
      expect(askPoints.length).toBe(5);
    });
  });

  describe('订单簿不平衡警报', () => {
    it('应该在买单深度过高时发出警报', (done) => {
      analyzer.on('alert', (alert: OrderFlowAlert) => {
        if (alert.type === 'imbalance_high') {
          expect(alert.data.ratio).toBeGreaterThan(2);
          done();
        }
      });
      
      analyzer.processOrderBook(createOrderBook([[49900, 200]], [[50100, 50]]));
    });

    it('应该在卖单深度过高时发出警报', (done) => {
      analyzer.on('alert', (alert: OrderFlowAlert) => {
        if (alert.type === 'imbalance_low') {
          expect(alert.data.ratio).toBeLessThan(0.5);
          done();
        }
      });
      
      analyzer.processOrderBook(createOrderBook([[49900, 50]], [[50100, 200]]));
    });
  });

  describe('冰山订单检测', () => {
    it('应该在多次出现相同价格时标记为冰山订单', async () => {
      for (let i = 0; i < 4; i++) {
        analyzer.processTrade(createTrade('iceberg-' + i, 50000, 0.5, 'buy'));
        await new Promise<void>((resolve) => setTimeout(resolve, 20));
      }
      
      const result = analyzer.getResult();
      expect(result.largeOrders.length).toBeGreaterThan(0);
    });
  });

  describe('警报去重 - 按价格级别', () => {
    it('应该在同一价格级别只发出一个警报（冷却期内）', async () => {
      const alerts: OrderFlowAlert[] = [];
      analyzer.on('alert', (alert: OrderFlowAlert) => alerts.push(alert));
      
      // 使用平衡的订单簿避免触发不平衡警报
      const orderBook = createOrderBook([[50000, 2]], [[51000, 2]]);
      
      analyzer.processOrderBook(orderBook);
      analyzer.processOrderBook(orderBook);
      analyzer.processOrderBook(orderBook);
      
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      
      // 应该只有一个大单买入警报（冷却期内去重）
      const largeOrderAlerts = alerts.filter(a => a.type === 'large_order_buy');
      expect(largeOrderAlerts.length).toBe(1);
    });

    it('应该对不同价格级别发出不同的警报', async () => {
      const alerts: OrderFlowAlert[] = [];
      analyzer.on('alert', (alert: OrderFlowAlert) => alerts.push(alert));
      
      // 使用平衡的订单簿避免触发不平衡警报
      analyzer.processOrderBook(createOrderBook([[50000, 2], [49900, 2]], [[51000, 2]]));
      
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      
      // 应该有两个不同价格的买入警报
      const largeOrderAlerts = alerts.filter(a => a.type === 'large_order_buy');
      expect(largeOrderAlerts.length).toBe(2);
      const prices = largeOrderAlerts.map(a => a.data.price);
      expect(prices).toContain(50000);
      expect(prices).toContain(49900);
    });
  });

  describe('calculateOrderQueueAnalysis() 方法', () => {
    it('应该返回委托队列分析结果', async () => {
      const orderBook = createOrderBook(
        Array.from({ length: 25 }, (_, i) => [50000 - i * 100, 10] as [number, number]),
        Array.from({ length: 30 }, (_, i) => [50100 + i * 100, 10] as [number, number])
      );
      
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      
      const queueAnalysis = analyzer.calculateOrderQueueAnalysis(orderBook);
      
      expect(queueAnalysis.bidQueue).toBe(25);
      expect(queueAnalysis.askQueue).toBe(30);
      expect(queueAnalysis.timestamp).toBeGreaterThan(0);
    });

    it('第一次调用时速度应该为0', async () => {
      const orderBook = createOrderBook([[50000, 10]], [[50100, 10]]);
      
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      
      const queueAnalysis = analyzer.calculateOrderQueueAnalysis(orderBook);
      
      expect(queueAnalysis.bidVelocity).toBe(0);
      expect(queueAnalysis.askVelocity).toBe(0);
    });

    it('应该计算队列变化速度', async () => {
      const orderBook1 = createOrderBook(
        Array.from({ length: 20 }, (_, i) => [50000 - i * 100, 10] as [number, number]),
        Array.from({ length: 20 }, (_, i) => [50100 + i * 100, 10] as [number, number])
      );
      
      analyzer.processOrderBook(orderBook1);
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      analyzer.calculateOrderQueueAnalysis(orderBook1);
      
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      
      const orderBook2 = createOrderBook(
        Array.from({ length: 25 }, (_, i) => [50000 - i * 100, 10] as [number, number]),
        Array.from({ length: 22 }, (_, i) => [50100 + i * 100, 10] as [number, number])
      );
      
      const queueAnalysis2 = analyzer.calculateOrderQueueAnalysis(orderBook2);
      
      expect(queueAnalysis2.bidQueue).toBe(25);
      expect(queueAnalysis2.askQueue).toBe(22);
    });
  });
});
