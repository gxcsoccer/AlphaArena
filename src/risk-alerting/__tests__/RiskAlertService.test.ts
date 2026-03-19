/**
 * Risk Alert Service Tests
 */

import { RiskAlertService } from '../RiskAlertService';
import { PortfolioData, RiskType } from '../types';

// Mock the AlertService
jest.mock('../../alerting/AlertService', () => ({
  getAlertService: jest.fn(() => ({
    triggerAlert: jest.fn().mockResolvedValue(null),
  })),
}));

describe('RiskAlertService', () => {
  let service: RiskAlertService;

  beforeEach(() => {
    service = new RiskAlertService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserConfig', () => {
    it('should return default config for new user', async () => {
      const config = await service.getUserConfig('test-user');

      expect(config.userId).toBe('test-user');
      expect(config.alertsEnabled).toBe(true);
      expect(config.defaultChannels.inApp).toBe(true);
      expect(config.maxAlertsPerHour).toBe(10);
      expect(config.presetThresholds.concentration).toBe(0.3);
    });
  });

  describe('updateUserConfig', () => {
    it('should update user config', async () => {
      const userId = 'test-user';
      
      const updated = await service.updateUserConfig(userId, {
        alertsEnabled: false,
        maxAlertsPerHour: 5,
      });

      expect(updated.alertsEnabled).toBe(false);
      expect(updated.maxAlertsPerHour).toBe(5);
    });
  });

  describe('getUserRules', () => {
    it('should return default rules based on user config', async () => {
      const rules = await service.getUserRules('test-user');

      expect(rules.length).toBe(5);
      expect(rules.find(r => r.riskType === 'concentration')).toBeDefined();
      expect(rules.find(r => r.riskType === 'drawdown')).toBeDefined();
      expect(rules.find(r => r.riskType === 'volatility')).toBeDefined();
      expect(rules.find(r => r.riskType === 'leverage')).toBeDefined();
      expect(rules.find(r => r.riskType === 'liquidity')).toBeDefined();
    });
  });

  describe('getRiskMetrics', () => {
    it('should calculate risk metrics for portfolio', () => {
      const portfolio: PortfolioData = {
        totalValue: 10000,
        cash: 5000,
        positions: [
          {
            symbol: 'BTC',
            quantity: 0.5,
            averageCost: 5000,
            currentPrice: 10000,
            marketValue: 5000,
            unrealizedPnL: 2500,
          },
        ],
      };

      const metrics = service.getRiskMetrics(portfolio);

      expect(metrics.concentration).toBeDefined();
      expect(metrics.drawdown).toBeDefined();
      expect(metrics.volatility).toBeDefined();
      expect(metrics.leverage).toBeDefined();
      expect(metrics.liquidity).toBeDefined();
      expect(metrics.overallScore).toBeGreaterThanOrEqual(0);
      expect(metrics.overallScore).toBeLessThanOrEqual(100);
    });
  });

  describe('checkRisk', () => {
    it('should check specific risk type', async () => {
      const portfolio: PortfolioData = {
        totalValue: 10000,
        cash: 0,
        positions: [
          {
            symbol: 'BTC',
            quantity: 1,
            averageCost: 10000,
            currentPrice: 10000,
            marketValue: 10000,
            unrealizedPnL: 0,
          },
        ],
      };

      const result = await service.checkRisk(
        'test-user',
        portfolio,
        'concentration',
        0.5
      );

      expect(result.riskType).toBe('concentration');
      expect(result.value).toBe(1);
      expect(result.threshold).toBe(0.5);
      expect(result.exceeded).toBe(true);
      expect(result.severity).toBe('critical');
    });

    it('should use default threshold if not provided', async () => {
      const portfolio: PortfolioData = {
        totalValue: 10000,
        cash: 5000,
        positions: [
          {
            symbol: 'BTC',
            quantity: 0.1,
            averageCost: 5000,
            currentPrice: 5000,
            marketValue: 5000,
            unrealizedPnL: 0,
          },
        ],
      };

      const result = await service.checkRisk(
        'test-user',
        portfolio,
        'concentration'
      );

      expect(result.threshold).toBe(0.3); // Default from config
    });
  });

  describe('monitorPortfolio', () => {
    it('should detect and report multiple risks', async () => {
      const portfolio: PortfolioData = {
        totalValue: 20000,
        cash: 0,
        positions: [
          {
            symbol: 'BTC',
            quantity: 1,
            averageCost: 20000,
            currentPrice: 20000,
            marketValue: 20000,
            unrealizedPnL: 0,
          },
        ],
        marginUsed: 15000,
        marginAvailable: 5000,
        equityHighWaterMark: 25000,
      };

      const results = await service.monitorPortfolio('test-user', portfolio);

      // Should have at least concentration alert
      expect(results.length).toBeGreaterThan(0);
      
      // Check for concentration alert
      const concentrationAlert = results.find(r => r.riskType === 'concentration');
      expect(concentrationAlert?.exceeded).toBe(true);
    });

    it('should respect cooldown period', async () => {
      const portfolio: PortfolioData = {
        totalValue: 10000,
        cash: 0,
        positions: [
          {
            symbol: 'BTC',
            quantity: 1,
            averageCost: 10000,
            currentPrice: 10000,
            marketValue: 10000,
            unrealizedPnL: 0,
          },
        ],
      };

      // First monitoring should trigger alert
      const firstResults = await service.monitorPortfolio('test-user', portfolio);
      
      // Second monitoring immediately after should respect cooldown
      const secondResults = await service.monitorPortfolio('test-user', portfolio);
      
      // Second monitoring might have fewer or no alerts due to cooldown
      expect(secondResults.length).toBeLessThanOrEqual(firstResults.length);
    });
  });

  describe('getTopConcentratedPositions', () => {
    it('should return top concentrated positions', () => {
      const portfolio: PortfolioData = {
        totalValue: 10000,
        cash: 0,
        positions: [
          {
            symbol: 'BTC',
            quantity: 0.4,
            averageCost: 10000,
            currentPrice: 10000,
            marketValue: 4000,
            unrealizedPnL: 0,
          },
          {
            symbol: 'ETH',
            quantity: 1.2,
            averageCost: 2500,
            currentPrice: 2500,
            marketValue: 3000,
            unrealizedPnL: 0,
          },
          {
            symbol: 'SOL',
            quantity: 15,
            averageCost: 200,
            currentPrice: 200,
            marketValue: 3000,
            unrealizedPnL: 0,
          },
        ],
      };

      const result = service.getTopConcentratedPositions(portfolio, 2);

      expect(result).toHaveLength(2);
      expect(result[0].symbol).toBe('BTC');
      expect(result[0].concentration).toBeCloseTo(0.4, 1);
    });
  });

  describe('Event emission', () => {
    it('should emit monitoring:complete event', (done) => {
      const portfolio: PortfolioData = {
        totalValue: 10000,
        cash: 10000,
        positions: [],
      };

      service.on('monitoring:complete', (data) => {
        expect(data.userId).toBe('test-user');
        expect(data.metrics).toBeDefined();
        expect(data.alerts).toBeDefined();
        done();
      });

      service.monitorPortfolio('test-user', portfolio);
    });

    it('should emit alert:triggered event when alert triggered', (done) => {
      const portfolio: PortfolioData = {
        totalValue: 10000,
        cash: 0,
        positions: [
          {
            symbol: 'BTC',
            quantity: 1,
            averageCost: 10000,
            currentPrice: 10000,
            marketValue: 10000,
            unrealizedPnL: 0,
          },
        ],
      };

      service.on('alert:triggered', (alert) => {
        expect(alert.userId).toBe('test-user');
        // Should have one of the risk types
        expect(['concentration', 'drawdown', 'leverage', 'liquidity']).toContain(alert.riskType);
        expect(alert.status).toBe('active');
        done();
      });

      service.monitorPortfolio('test-user', portfolio);
    });
  });
});