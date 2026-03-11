/**
 * RiskControl Tests
 */

import { RiskControl } from '../../src/engine/RiskControl';
import { RiskControlConfig } from '../../src/engine/types';
import { PortfolioSnapshot } from '../../src/portfolio/types';

describe('RiskControl', () => {
  let riskControl: RiskControl;

  const defaultConfig: RiskControlConfig = {
    maxPositionSize: 1000,
    maxTotalExposure: 1000000,
    stopLossPercent: 0.1, // 10%
    maxOrdersPerMinute: 60,
    enabled: true,
  };

  const createPortfolioSnapshot = (
    cash: number = 100000,
    positions: Array<{ symbol: string; quantity: number; averageCost: number }> = []
  ): PortfolioSnapshot => {
    return {
      cash,
      positions,
      totalValue: cash + positions.reduce((sum, p) => sum + p.quantity * p.averageCost, 0),
      unrealizedPnL: 0,
      timestamp: Date.now(),
    };
  };

  beforeEach(() => {
    riskControl = new RiskControl(defaultConfig);
  });

  describe('Initialization', () => {
    it('should initialize with provided config', () => {
      const config = riskControl.getConfig();
      expect(config.maxPositionSize).toBe(1000);
      expect(config.maxTotalExposure).toBe(1000000);
      expect(config.stopLossPercent).toBe(0.1);
      expect(config.enabled).toBe(true);
    });

    it('should respect enabled flag', () => {
      const disabledConfig = { ...defaultConfig, enabled: false };
      const rc = new RiskControl(disabledConfig);
      expect(rc.getConfig().enabled).toBe(false);
    });
  });

  describe('Position Limit Check', () => {
    it('should approve signals within position limit', () => {
      const signal = {
        id: 'AAPL-signal-1',
        side: 'buy' as const,
        price: 150,
        quantity: 100,
        timestamp: Date.now(),
      };

      const portfolio = createPortfolioSnapshot(100000, [
        { symbol: 'AAPL', quantity: 500, averageCost: 145 },
      ]);

      const result = riskControl.checkSignal(signal, portfolio);
      expect(result.approved).toBe(true);
    });

    it('should reject signals exceeding position limit', () => {
      const signal = {
        id: 'AAPL-signal-1',
        side: 'buy' as const,
        price: 150,
        quantity: 600,
        timestamp: Date.now(),
      };

      const portfolio = createPortfolioSnapshot(100000, [
        { symbol: 'AAPL', quantity: 500, averageCost: 145 },
      ]);

      const result = riskControl.checkSignal(signal, portfolio);
      expect(result.approved).toBe(false);
      expect(result.riskType).toBe('position_limit');
    });

    it('should allow sell signals regardless of position', () => {
      const signal = {
        id: 'AAPL-signal-1',
        side: 'sell' as const,
        price: 150,
        quantity: 2000,
        timestamp: Date.now(),
      };

      const portfolio = createPortfolioSnapshot(100000, [
        { symbol: 'AAPL', quantity: 500, averageCost: 145 },
      ]);

      const result = riskControl.checkSignal(signal, portfolio);
      expect(result.approved).toBe(true);
    });
  });

  describe('Exposure Limit Check', () => {
    it('should approve signals within exposure limit', () => {
      const signal = {
        id: 'AAPL-signal-1',
        side: 'buy' as const,
        price: 150,
        quantity: 100,
        timestamp: Date.now(),
      };

      const portfolio = createPortfolioSnapshot(100000);
      const result = riskControl.checkSignal(signal, portfolio);
      expect(result.approved).toBe(true);
    });

    it('should reject signals exceeding exposure limit', () => {
      // Use quantity within position limit (1000) but exceeding exposure limit
      // 1000 shares * 150 = 150,000, portfolio value = 100,000, total = 250,000
      // maxTotalExposure = 1,000,000, so this won't exceed
      // Let's use a higher price: 1000 * 950 = 950,000 + 100,000 = 1,050,000 > 1,000,000
      const signal = {
        id: 'AAPL-signal-1',
        side: 'buy' as const,
        price: 950,
        quantity: 1000,
        timestamp: Date.now(),
      };

      const portfolio = createPortfolioSnapshot(100000);
      const result = riskControl.checkSignal(signal, portfolio);
      expect(result.approved).toBe(false);
      expect(result.riskType).toBe('exposure_limit');
    });
  });

  describe('Rate Limit Check', () => {
    it('should approve orders within rate limit', () => {
      const result = riskControl.checkSignal(
        { id: 'AAPL-1', side: 'buy', price: 150, quantity: 10, timestamp: Date.now() },
        createPortfolioSnapshot()
      );
      expect(result.approved).toBe(true);
    });

    it('should reject orders exceeding rate limit', () => {
      const lowLimitConfig = { ...defaultConfig, maxOrdersPerMinute: 3 };
      const rc = new RiskControl(lowLimitConfig);

      // Use up the rate limit by recording orders
      for (let i = 0; i < 3; i++) {
        rc.recordOrder();
      }

      // Next order should be rejected
      const result = rc.checkSignal(
        { id: 'AAPL-4', side: 'buy', price: 150, quantity: 10, timestamp: Date.now() },
        createPortfolioSnapshot()
      );

      expect(result.approved).toBe(false);
      expect(result.riskType).toBe('rate_limit');
    });

    it('should track rate limit status', () => {
      const status1 = riskControl.getRateLimitStatus();
      expect(status1.remaining).toBe(60);

      riskControl.recordOrder();
      const status2 = riskControl.getRateLimitStatus();
      expect(status2.remaining).toBe(59);
    });
  });

  describe('Stop Loss Check', () => {
    it('should approve when no position exists', () => {
      const portfolio = createPortfolioSnapshot(100000, []);
      const result = riskControl.checkStopLoss('AAPL', 150, portfolio);
      expect(result.approved).toBe(true);
    });

    it('should approve when price is above stop loss', () => {
      const portfolio = createPortfolioSnapshot(100000, [
        { symbol: 'AAPL', quantity: 100, averageCost: 150 },
      ]);

      // Price dropped 5%, but stop loss is 10%
      const result = riskControl.checkStopLoss('AAPL', 142.5, portfolio);
      expect(result.approved).toBe(true);
    });

    it('should trigger stop loss when price drops below threshold', () => {
      const portfolio = createPortfolioSnapshot(100000, [
        { symbol: 'AAPL', quantity: 100, averageCost: 150 },
      ]);

      // Price dropped 15%, stop loss is 10%
      const result = riskControl.checkStopLoss('AAPL', 127.5, portfolio);
      expect(result.approved).toBe(false);
      expect(result.riskType).toBe('stop_loss');
      expect(result.reason).toContain('Stop loss triggered');
    });
  });

  describe('Enable/Disable', () => {
    it('should bypass all checks when disabled', () => {
      riskControl.setEnabled(false);

      const signal = {
        id: 'AAPL-signal-1',
        side: 'buy' as const,
        price: 150,
        quantity: 10000, // Would normally exceed limits
        timestamp: Date.now(),
      };

      const portfolio = createPortfolioSnapshot(100000);
      const result = riskControl.checkSignal(signal, portfolio);
      expect(result.approved).toBe(true);
    });

    it('should re-enable checks when enabled', () => {
      riskControl.setEnabled(false);
      riskControl.setEnabled(true);

      const signal = {
        id: 'AAPL-signal-1',
        side: 'buy' as const,
        price: 150,
        quantity: 2000, // Exceeds position limit
        timestamp: Date.now(),
      };

      const portfolio = createPortfolioSnapshot(100000, [
        { symbol: 'AAPL', quantity: 500, averageCost: 145 },
      ]);

      const result = riskControl.checkSignal(signal, portfolio);
      expect(result.approved).toBe(false);
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration', () => {
      riskControl.updateConfig({
        maxPositionSize: 500,
        stopLossPercent: 0.05,
      });

      const config = riskControl.getConfig();
      expect(config.maxPositionSize).toBe(500);
      expect(config.stopLossPercent).toBe(0.05);
    });

    it('should reset rate limiter when maxOrdersPerMinute changes', () => {
      riskControl.recordOrder();
      riskControl.recordOrder();

      let status = riskControl.getRateLimitStatus();
      expect(status.remaining).toBe(58);

      riskControl.updateConfig({ maxOrdersPerMinute: 100 });
      status = riskControl.getRateLimitStatus();
      expect(status.remaining).toBe(100);
    });
  });
});
