import { Portfolio } from '../src/portfolio/Portfolio';
import { Trade, TradeStatus } from '../src/matching/types';

describe('Portfolio', () => {
  let portfolio: Portfolio;

  beforeEach(() => {
    portfolio = new Portfolio(100000); // 初始现金 10 万
  });

  describe('Constructor & Initial State', () => {
    it('should initialize with default cash of 0', () => {
      const emptyPortfolio = new Portfolio();
      expect(emptyPortfolio.getCash()).toBe(0);
    });

    it('should initialize with specified cash', () => {
      expect(portfolio.getCash()).toBe(100000);
    });

    it('should have no positions initially', () => {
      expect(portfolio.getAllPositions()).toHaveLength(0);
    });
  });

  describe('getPosition', () => {
    it('should return undefined for non-existent position', () => {
      expect(portfolio.getPosition('AAPL')).toBeUndefined();
    });

    it('should return position after trade', () => {
      const { trade, portfolioOrderId } = createTrade('AAPL-1', 'AAPL-2', 150, 10, 'buy');
      portfolio.onTrade(trade, portfolioOrderId);

      const position = portfolio.getPosition('AAPL');
      expect(position).toBeDefined();
      expect(position!.quantity).toBe(10);
      expect(position!.averageCost).toBe(150);
    });
  });

  describe('onTrade - Buy Orders', () => {
    it('should create new position on first buy', () => {
      const { trade, portfolioOrderId } = createTrade('AAPL-1', 'AAPL-2', 150, 10, 'buy');
      const result = portfolio.onTrade(trade, portfolioOrderId);

      expect(result.position.quantity).toBe(10);
      expect(result.position.averageCost).toBe(150);
      expect(result.realizedPnL).toBe(0); // 买入不产生已实现盈亏
      expect(portfolio.getCash()).toBe(100000 - 150 * 10); // 扣除现金
    });

    it('should update average cost on additional buys', () => {
      // 第一次买入：10 股 @ 150
      const { trade: trade1, portfolioOrderId: orderId1 } = createTrade(
        'AAPL-1',
        'AAPL-2',
        150,
        10,
        'buy'
      );
      portfolio.onTrade(trade1, orderId1);

      // 第二次买入：10 股 @ 170
      const { trade: trade2, portfolioOrderId: orderId2 } = createTrade(
        'AAPL-3',
        'AAPL-4',
        170,
        10,
        'buy'
      );
      const result = portfolio.onTrade(trade2, orderId2);

      expect(result.position.quantity).toBe(20);
      expect(result.position.averageCost).toBe(160); // (150*10 + 170*10) / 20 = 160
      expect(portfolio.getCash()).toBe(100000 - 150 * 10 - 170 * 10);
    });

    it('should handle multiple buy trades for same symbol', () => {
      const { trade: t1, portfolioOrderId: o1 } = createTrade('AAPL-1', 'AAPL-2', 100, 5, 'buy');
      const { trade: t2, portfolioOrderId: o2 } = createTrade('AAPL-3', 'AAPL-4', 120, 5, 'buy');
      const { trade: t3, portfolioOrderId: o3 } = createTrade('AAPL-5', 'AAPL-6', 110, 10, 'buy');

      portfolio.onTrade(t1, o1);
      portfolio.onTrade(t2, o2);
      portfolio.onTrade(t3, o3);

      const position = portfolio.getPosition('AAPL');
      expect(position!.quantity).toBe(20);
      expect(position!.averageCost).toBe(110); // (100*5 + 120*5 + 110*10) / 20 = 110
    });
  });

  describe('onTrade - Sell Orders', () => {
    beforeEach(() => {
      // 先买入建立持仓
      const { trade, portfolioOrderId } = createTrade('AAPL-1', 'AAPL-2', 150, 20, 'buy');
      portfolio.onTrade(trade, portfolioOrderId);
    });

    it('should reduce position on sell', () => {
      const { trade, portfolioOrderId } = createTrade('AAPL-3', 'AAPL-4', 160, 10, 'sell');
      const result = portfolio.onTrade(trade, portfolioOrderId);

      expect(result.position.quantity).toBe(10);
      expect(result.position.averageCost).toBe(150); // 平均成本不变
      expect(result.realizedPnL).toBe(100); // (160 - 150) * 10 = 100
      expect(portfolio.getCash()).toBe(100000 - 150 * 20 + 160 * 10);
    });

    it('should calculate realized PnL correctly on profitable sale', () => {
      const { trade, portfolioOrderId } = createTrade('AAPL-3', 'AAPL-4', 200, 10, 'sell');
      const result = portfolio.onTrade(trade, portfolioOrderId);

      expect(result.realizedPnL).toBe(500); // (200 - 150) * 10 = 500
    });

    it('should calculate realized PnL correctly on loss sale', () => {
      const { trade, portfolioOrderId } = createTrade('AAPL-3', 'AAPL-4', 120, 10, 'sell');
      const result = portfolio.onTrade(trade, portfolioOrderId);

      expect(result.realizedPnL).toBe(-300); // (120 - 150) * 10 = -300
    });

    it('should clear position when selling all shares', () => {
      const { trade, portfolioOrderId } = createTrade('AAPL-3', 'AAPL-4', 160, 20, 'sell');
      const result = portfolio.onTrade(trade, portfolioOrderId);

      expect(result.position.quantity).toBe(0);
      expect(result.position.averageCost).toBe(0);
      expect(result.realizedPnL).toBe(200); // (160 - 150) * 20 = 200
    });

    it('should handle partial sell leaving remaining position', () => {
      const { trade, portfolioOrderId } = createTrade('AAPL-3', 'AAPL-4', 160, 5, 'sell');
      portfolio.onTrade(trade, portfolioOrderId);

      const position = portfolio.getPosition('AAPL');
      expect(position!.quantity).toBe(15);
      expect(position!.averageCost).toBe(150);
    });
  });

  describe('getPositionValue', () => {
    it('should calculate position value with market prices', () => {
      const { trade: t1, portfolioOrderId: o1 } = createTrade('AAPL-1', 'AAPL-2', 150, 10, 'buy');
      const { trade: t2, portfolioOrderId: o2 } = createTrade('GOOG-1', 'GOOG-2', 100, 5, 'buy');

      portfolio.onTrade(t1, o1);
      portfolio.onTrade(t2, o2);

      const prices = new Map([
        ['AAPL', 160],
        ['GOOG', 110],
      ]);

      const value = portfolio.getPositionValue(prices);
      expect(value).toBe(160 * 10 + 110 * 5); // 1600 + 550 = 2150
    });

    it('should ignore positions without market price', () => {
      const { trade: t1, portfolioOrderId: o1 } = createTrade('AAPL-1', 'AAPL-2', 150, 10, 'buy');
      const { trade: t2, portfolioOrderId: o2 } = createTrade(
        'UNKNOWN-1',
        'UNKNOWN-2',
        100,
        5,
        'buy'
      );

      portfolio.onTrade(t1, o1);
      portfolio.onTrade(t2, o2);

      const prices = new Map([['AAPL', 160]]);
      const value = portfolio.getPositionValue(prices);

      expect(value).toBe(160 * 10); // 只计算 AAPL
    });

    it('should return 0 for empty portfolio', () => {
      const prices = new Map([['AAPL', 160]]);
      expect(portfolio.getPositionValue(prices)).toBe(0);
    });
  });

  describe('getTotalValue', () => {
    it('should calculate total value (cash + positions)', () => {
      const { trade, portfolioOrderId } = createTrade('AAPL-1', 'AAPL-2', 150, 10, 'buy');
      portfolio.onTrade(trade, portfolioOrderId);

      const prices = new Map([['AAPL', 160]]);
      const totalValue = portfolio.getTotalValue(prices);

      expect(totalValue).toBe(100000 - 150 * 10 + 160 * 10); // 现金 + 持仓市值
    });

    it('should return cash only for empty positions', () => {
      const prices = new Map([['AAPL', 160]]);
      expect(portfolio.getTotalValue(prices)).toBe(100000);
    });
  });

  describe('getUnrealizedPnL', () => {
    it('should calculate unrealized PnL for profitable positions', () => {
      const { trade, portfolioOrderId } = createTrade('AAPL-1', 'AAPL-2', 150, 10, 'buy');
      portfolio.onTrade(trade, portfolioOrderId);

      const prices = new Map([['AAPL', 170]]);
      const unrealizedPnL = portfolio.getUnrealizedPnL(prices);

      expect(unrealizedPnL).toBe(200); // (170 - 150) * 10 = 200
    });

    it('should calculate unrealized PnL for losing positions', () => {
      const { trade, portfolioOrderId } = createTrade('AAPL-1', 'AAPL-2', 150, 10, 'buy');
      portfolio.onTrade(trade, portfolioOrderId);

      const prices = new Map([['AAPL', 130]]);
      const unrealizedPnL = portfolio.getUnrealizedPnL(prices);

      expect(unrealizedPnL).toBe(-200); // (130 - 150) * 10 = -200
    });

    it('should handle multiple positions', () => {
      const { trade: t1, portfolioOrderId: o1 } = createTrade('AAPL-1', 'AAPL-2', 150, 10, 'buy');
      const { trade: t2, portfolioOrderId: o2 } = createTrade('GOOG-1', 'GOOG-2', 100, 5, 'buy');

      portfolio.onTrade(t1, o1);
      portfolio.onTrade(t2, o2);

      const prices = new Map([
        ['AAPL', 160], // +100
        ['GOOG', 90], // -50
      ]);

      const unrealizedPnL = portfolio.getUnrealizedPnL(prices);
      expect(unrealizedPnL).toBe(50); // 100 - 50 = 50
    });

    it('should return 0 for empty positions', () => {
      const prices = new Map([['AAPL', 160]]);
      expect(portfolio.getUnrealizedPnL(prices)).toBe(0);
    });

    it('should ignore positions with zero quantity', () => {
      const { trade: t1, portfolioOrderId: o1 } = createTrade('AAPL-1', 'AAPL-2', 150, 10, 'buy');
      const { trade: t2, portfolioOrderId: o2 } = createTrade('AAPL-3', 'AAPL-4', 160, 10, 'sell');

      portfolio.onTrade(t1, o1);
      portfolio.onTrade(t2, o2);

      const prices = new Map([['AAPL', 170]]);
      expect(portfolio.getUnrealizedPnL(prices)).toBe(0);
    });
  });

  describe('getSnapshot', () => {
    it('should return complete portfolio snapshot', () => {
      const { trade, portfolioOrderId } = createTrade('AAPL-1', 'AAPL-2', 150, 10, 'buy');
      portfolio.onTrade(trade, portfolioOrderId);

      const prices = new Map([['AAPL', 160]]);
      const snapshot = portfolio.getSnapshot(prices);

      expect(snapshot.cash).toBe(100000 - 150 * 10);
      expect(snapshot.positions).toHaveLength(1);
      expect(snapshot.totalValue).toBeGreaterThan(0);
      expect(snapshot.unrealizedPnL).toBe(100);
      expect(snapshot.timestamp).toBeDefined();
    });
  });

  describe('Multiple Symbols', () => {
    it('should track multiple stock positions independently', () => {
      const { trade: t1, portfolioOrderId: o1 } = createTrade('AAPL-1', 'AAPL-2', 150, 10, 'buy');
      const { trade: t2, portfolioOrderId: o2 } = createTrade('GOOG-1', 'GOOG-2', 100, 5, 'buy');
      const { trade: t3, portfolioOrderId: o3 } = createTrade('MSFT-1', 'MSFT-2', 200, 8, 'buy');

      portfolio.onTrade(t1, o1);
      portfolio.onTrade(t2, o2);
      portfolio.onTrade(t3, o3);

      expect(portfolio.getPosition('AAPL')!.quantity).toBe(10);
      expect(portfolio.getPosition('GOOG')!.quantity).toBe(5);
      expect(portfolio.getPosition('MSFT')!.quantity).toBe(8);
      expect(portfolio.getAllPositions()).toHaveLength(3);
    });

    it('should handle buy and sell across multiple symbols', () => {
      // 买入多个股票
      const { trade: t1, portfolioOrderId: o1 } = createTrade('AAPL-1', 'AAPL-2', 150, 10, 'buy');
      const { trade: t2, portfolioOrderId: o2 } = createTrade('GOOG-1', 'GOOG-2', 100, 5, 'buy');

      portfolio.onTrade(t1, o1);
      portfolio.onTrade(t2, o2);

      // 卖出部分 AAPL
      const { trade: t3, portfolioOrderId: o3 } = createTrade('AAPL-3', 'AAPL-4', 160, 5, 'sell');
      portfolio.onTrade(t3, o3);

      expect(portfolio.getPosition('AAPL')!.quantity).toBe(5);
      expect(portfolio.getPosition('GOOG')!.quantity).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero quantity trades', () => {
      const { trade, portfolioOrderId } = createTrade('AAPL-1', 'AAPL-2', 150, 0, 'buy');
      portfolio.onTrade(trade, portfolioOrderId);

      const position = portfolio.getPosition('AAPL');
      expect(position!.quantity).toBe(0);
    });

    it('should handle very large numbers', () => {
      const largeQuantity = 1000000;
      const largePrice = 10000;

      const { trade, portfolioOrderId } = createTrade(
        'AAPL-1',
        'AAPL-2',
        largePrice,
        largeQuantity,
        'buy'
      );
      portfolio.onTrade(trade, portfolioOrderId);

      const position = portfolio.getPosition('AAPL');
      expect(position!.quantity).toBe(largeQuantity);
      expect(position!.averageCost).toBe(largePrice);
    });
  });
});

/**
 * Helper function to create trade records
 * @param buyOrderId The buyer's order ID (always the buyer)
 * @param sellOrderId The seller's order ID (always the seller)
 * @param side Which side the portfolio is on ('buy' means portfolio is the buyer)
 * @returns Object containing the trade and the portfolio's order ID
 */
function createTrade(
  buyOrderId: string,
  sellOrderId: string,
  price: number,
  quantity: number,
  side: 'buy' | 'sell'
): { trade: Trade; portfolioOrderId: string } {
  // buyOrderId and sellOrderId are always the buyer's and seller's IDs respectively
  // The portfolioOrderId is which one belongs to the portfolio
  const portfolioOrderId = side === 'buy' ? buyOrderId : sellOrderId;

  return {
    trade: {
      id: `trade-${Date.now()}-${Math.random()}`,
      price,
      quantity,
      timestamp: Date.now(),
      buyOrderId, // Always the buyer's order ID
      sellOrderId, // Always the seller's order ID
      status: TradeStatus.FILLED,
    },
    portfolioOrderId,
  };
}
