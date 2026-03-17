/**
 * Tests for Risk Controller
 */

import { RiskController } from '../RiskController';
import { BotStatus, DEFAULT_RISK_SETTINGS, BotState } from '../BotConfig';

describe('RiskController', () => {
  let controller: RiskController;
  const botId = 'test-bot';
  const defaultState: BotState = {
    botId,
    status: BotStatus.RUNNING,
    portfolioValue: 100000,
    initialCapital: 100000,
    realizedPnL: 0,
    unrealizedPnL: 0,
    totalPnL: 0,
    tradeCount: 0,
    winCount: 0,
    lossCount: 0,
    positionQuantity: 0,
    positionAveragePrice: 0,
    totalRuntimeMs: 0,
    dailyPnL: 0,
  };

  beforeEach(() => {
    controller = new RiskController(botId, { ...DEFAULT_RISK_SETTINGS });
  });

  describe('checkBuyOrder', () => {
    it('should approve valid buy orders', () => {
      const result = controller.checkBuyOrder(100, 10, defaultState);
      expect(result.approved).toBe(true);
    });

    it('should reject orders exceeding position limit', () => {
      const result = controller.checkBuyOrder(100, 2000, defaultState);
      expect(result.approved).toBe(false);
      expect(result.riskType).toBe('position_limit');
    });

    it('should reject orders exceeding capital limit', () => {
      const result = controller.checkBuyOrder(10000, 5, defaultState);
      expect(result.approved).toBe(false);
      expect(result.riskType).toBe('capital_limit');
    });

    it('should approve orders when risk control is disabled', () => {
      controller.setEnabled(false);
      const result = controller.checkBuyOrder(10000, 5, defaultState);
      expect(result.approved).toBe(true);
    });
  });

  describe('checkSellOrder', () => {
    it('should approve valid sell orders with sufficient position', () => {
      const stateWithPosition = {
        ...defaultState,
        positionQuantity: 100,
      };
      const result = controller.checkSellOrder(100, 50, stateWithPosition);
      expect(result.approved).toBe(true);
    });

    it('should reject sell orders exceeding position', () => {
      const stateWithPosition = {
        ...defaultState,
        positionQuantity: 50,
      };
      const result = controller.checkSellOrder(100, 100, stateWithPosition);
      expect(result.approved).toBe(false);
      expect(result.riskType).toBe('position_limit');
    });
  });

  describe('rate limiting', () => {
    it('should enforce order rate limits', () => {
      // Place max orders
      for (let i = 0; i < DEFAULT_RISK_SETTINGS.maxOrdersPerMinute; i++) {
        const result = controller.checkBuyOrder(100, 1, defaultState);
        expect(result.approved).toBe(true);
      }

      // Next order should be rejected
      const result = controller.checkBuyOrder(100, 1, defaultState);
      expect(result.approved).toBe(false);
      expect(result.riskType).toBe('rate_limit');
    });

    it('should provide rate limit status', () => {
      const status = controller.getRateLimitStatus();
      expect(status.maxOrders).toBe(DEFAULT_RISK_SETTINGS.maxOrdersPerMinute);
      expect(status.remaining).toBe(DEFAULT_RISK_SETTINGS.maxOrdersPerMinute);
    });
  });

  describe('stop loss', () => {
    it('should detect stop loss trigger', () => {
      const stateWithPosition = {
        ...defaultState,
        positionQuantity: 100,
      };
      const averageCost = 100;
      const triggerPrice = averageCost * (1 - DEFAULT_RISK_SETTINGS.stopLossPercent) - 1;

      const isTriggered = controller.checkStopLoss(triggerPrice, averageCost, stateWithPosition);
      expect(isTriggered).toBe(true);
    });

    it('should not trigger stop loss for profitable positions', () => {
      const stateWithPosition = {
        ...defaultState,
        positionQuantity: 100,
      };
      const averageCost = 100;
      const currentPrice = 110;

      const isTriggered = controller.checkStopLoss(currentPrice, averageCost, stateWithPosition);
      expect(isTriggered).toBe(false);
    });
  });

  describe('take profit', () => {
    it('should detect take profit trigger', () => {
      const stateWithPosition = {
        ...defaultState,
        positionQuantity: 100,
      };
      const averageCost = 100;
      const triggerPrice = averageCost * (1 + DEFAULT_RISK_SETTINGS.takeProfitPercent) + 1;

      const isTriggered = controller.checkTakeProfit(triggerPrice, averageCost, stateWithPosition);
      expect(isTriggered).toBe(true);
    });

    it('should not trigger take profit for small gains', () => {
      const stateWithPosition = {
        ...defaultState,
        positionQuantity: 100,
      };
      const averageCost = 100;
      const currentPrice = 105;

      const isTriggered = controller.checkTakeProfit(currentPrice, averageCost, stateWithPosition);
      expect(isTriggered).toBe(false);
    });
  });

  describe('daily loss limit', () => {
    it('should block orders when daily loss limit is reached', () => {
      const stateWithLoss = {
        ...defaultState,
        dailyPnL: -defaultState.initialCapital * DEFAULT_RISK_SETTINGS.maxDailyLoss - 1,
      };

      const result = controller.checkBuyOrder(100, 1, stateWithLoss);
      expect(result.approved).toBe(false);
      expect(result.riskType).toBe('daily_loss_limit');
    });
  });

  describe('price anomaly detection', () => {
    it('should not detect anomaly with stable prices', () => {
      for (let i = 0; i < 20; i++) {
        const isAnomaly = controller.checkPriceAnomaly(100 + Math.random() * 0.5);
        expect(isAnomaly).toBe(false);
      }
    });

    it('should detect large price deviation', () => {
      // Build up price history
      for (let i = 0; i < 20; i++) {
        controller.checkPriceAnomaly(100);
      }

      // Sudden price jump
      const isAnomaly = controller.checkPriceAnomaly(120);
      expect(isAnomaly).toBe(true);
    });
  });

  describe('events', () => {
    it('should emit risk events', (done) => {
      controller.on('risk', (event) => {
        expect(event.type).toBeDefined();
        expect(event.message).toBeDefined();
        expect(event.action).toBeDefined();
        done();
      });

      // Trigger a risk event
      controller.checkBuyOrder(10000, 5, defaultState);
    });
  });

  describe('updateSettings', () => {
    it('should update risk settings', () => {
      controller.updateSettings({ maxPositionSize: 500 });
      const settings = controller.getSettings();
      expect(settings.maxPositionSize).toBe(500);
    });

    it('should recreate rate limiter when maxOrdersPerMinute changes', () => {
      controller.updateSettings({ maxOrdersPerMinute: 5 });
      const status = controller.getRateLimitStatus();
      expect(status.maxOrders).toBe(5);
    });
  });
});
