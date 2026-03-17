/**
 * Tests for Bot Configuration Types
 */

import {
  BotStatus,
  TradingMode,
  DEFAULT_RISK_SETTINGS,
  DEFAULT_STRATEGY_PARAMS,
  generateBotId,
  generateLogId,
  generateTradeId,
} from '../BotConfig';

describe('BotConfig', () => {
  describe('BotStatus enum', () => {
    it('should have correct status values', () => {
      expect(BotStatus.STOPPED).toBe('stopped');
      expect(BotStatus.RUNNING).toBe('running');
      expect(BotStatus.PAUSED).toBe('paused');
      expect(BotStatus.ERROR).toBe('error');
    });
  });

  describe('TradingMode enum', () => {
    it('should have correct mode values', () => {
      expect(TradingMode.PAPER).toBe('paper');
      expect(TradingMode.LIVE).toBe('live');
    });
  });

  describe('DEFAULT_RISK_SETTINGS', () => {
    it('should have sensible default values', () => {
      expect(DEFAULT_RISK_SETTINGS.maxCapitalPerTrade).toBe(0.1);
      expect(DEFAULT_RISK_SETTINGS.usePercentageCapital).toBe(true);
      expect(DEFAULT_RISK_SETTINGS.stopLossPercent).toBe(0.05);
      expect(DEFAULT_RISK_SETTINGS.takeProfitPercent).toBe(0.15);
      expect(DEFAULT_RISK_SETTINGS.maxPositionSize).toBe(1000);
      expect(DEFAULT_RISK_SETTINGS.maxOrdersPerMinute).toBe(10);
      expect(DEFAULT_RISK_SETTINGS.maxDailyLoss).toBe(0.1);
      expect(DEFAULT_RISK_SETTINGS.riskControlEnabled).toBe(true);
    });
  });

  describe('DEFAULT_STRATEGY_PARAMS', () => {
    it('should have params for all strategy types', () => {
      const strategies = ['SMA', 'RSI', 'MACD', 'Bollinger', 'Stochastic', 'ATR'] as const;
      strategies.forEach((strategy) => {
        expect(DEFAULT_STRATEGY_PARAMS[strategy]).toBeDefined();
      });
    });

    it('should have correct SMA default params', () => {
      expect(DEFAULT_STRATEGY_PARAMS.SMA.shortPeriod).toBe(10);
      expect(DEFAULT_STRATEGY_PARAMS.SMA.longPeriod).toBe(20);
    });

    it('should have correct RSI default params', () => {
      expect(DEFAULT_STRATEGY_PARAMS.RSI.rsiPeriod).toBe(14);
      expect(DEFAULT_STRATEGY_PARAMS.RSI.rsiOverbought).toBe(70);
      expect(DEFAULT_STRATEGY_PARAMS.RSI.rsiOversold).toBe(30);
    });
  });

  describe('ID generators', () => {
    it('should generate unique bot IDs', () => {
      const id1 = generateBotId();
      const id2 = generateBotId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^bot-\d+-[a-z0-9]+$/);
    });

    it('should generate unique log IDs', () => {
      const id1 = generateLogId();
      const id2 = generateLogId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^log-\d+-[a-z0-9]+$/);
    });

    it('should generate unique trade IDs', () => {
      const id1 = generateTradeId();
      const id2 = generateTradeId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^trade-\d+-[a-z0-9]+$/);
    });
  });
});
