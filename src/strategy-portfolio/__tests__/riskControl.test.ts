/**
 * Tests for Risk Control Service
 */

import { RiskControlService, DEFAULT_RISK_CONTROL_CONFIG } from '../riskControl.service';
import { StrategySignal, ConflictResolution } from '../types';

describe('RiskControlService', () => {
  let service: RiskControlService;

  beforeEach(() => {
    service = new RiskControlService();
  });

  describe('checkPositionLimits', () => {
    it('should return within limits for valid positions', () => {
      const result = service.checkPositionLimits({
        currentTotalPosition: 50000,
        currentPositionByAsset: new Map([['BTC', 10000], ['ETH', 5000]]),
        currentPositionByStrategy: new Map([['s1', 30000], ['s2', 20000]]),
      });

      expect(result.withinLimits).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect total position limit violation', () => {
      const result = service.checkPositionLimits({
        currentTotalPosition: 200000,  // Exceeds default 100k
        currentPositionByAsset: new Map(),
        currentPositionByStrategy: new Map(),
      });

      expect(result.withinLimits).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0]).toContain('Total position');
    });

    it('should detect single asset position violation', () => {
      const result = service.checkPositionLimits({
        currentTotalPosition: 50000,
        currentPositionByAsset: new Map([['BTC', 30000]]),  // Exceeds 20k
        currentPositionByStrategy: new Map(),
      });

      expect(result.withinLimits).toBe(false);
      expect(result.violations.some(v => v.includes('BTC'))).toBe(true);
    });

    it('should generate warnings when approaching limits', () => {
      const result = service.checkPositionLimits({
        currentTotalPosition: 95000,  // 95% of 100k
        currentPositionByAsset: new Map(),
        currentPositionByStrategy: new Map(),
      });

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should check proposed position', () => {
      const result = service.checkPositionLimits({
        currentTotalPosition: 80000,
        currentPositionByAsset: new Map([['BTC', 15000]]),
        currentPositionByStrategy: new Map([['s1', 40000]]),
        proposedPosition: {
          strategyId: 's1',
          symbol: 'BTC',
          value: 10000,  // Would exceed BTC limit
        },
      });

      expect(result.violations.some(v => v.includes('exceed'))).toBe(true);
    });
  });

  describe('detectConflicts', () => {
    const signals: StrategySignal[] = [
      {
        strategyId: 's1',
        symbol: 'BTC',
        side: 'buy',
        confidence: 0.8,
        quantity: 10,
        timestamp: new Date(),
      },
      {
        strategyId: 's2',
        symbol: 'BTC',
        side: 'sell',
        confidence: 0.7,
        quantity: 5,
        timestamp: new Date(),
      },
    ];

    it('should detect opposite direction conflicts', () => {
      const conflicts = service.detectConflicts(signals);

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].type).toBe('opposite_direction');
      expect(conflicts[0].strategyIds).toContain('s1');
      expect(conflicts[0].strategyIds).toContain('s2');
    });

    it('should not detect conflicts when disabled', () => {
      service.updateConfig({ enableConflictDetection: false });
      const conflicts = service.detectConflicts(signals);
      expect(conflicts).toHaveLength(0);
    });

    it('should detect same direction conflicts for large positions', () => {
      const sameDirectionSignals: StrategySignal[] = [
        {
          strategyId: 's1',
          symbol: 'BTC',
          side: 'buy',
          confidence: 0.8,
          quantity: 15000,  // Large quantity
          timestamp: new Date(),
        },
        {
          strategyId: 's2',
          symbol: 'BTC',
          side: 'buy',
          confidence: 0.7,
          quantity: 12000,
          timestamp: new Date(),
        },
      ];

      const conflicts = service.detectConflicts(sameDirectionSignals);
      expect(conflicts.some(c => c.type === 'same_direction')).toBe(true);
    });

    it('should determine conflict severity', () => {
      // Many strategies with opposite signals
      const manySignals: StrategySignal[] = [];
      for (let i = 0; i < 5; i++) {
        manySignals.push({
          strategyId: `buy-${i}`,
          symbol: 'BTC',
          side: 'buy',
          confidence: 0.6,
          timestamp: new Date(),
        });
        manySignals.push({
          strategyId: `sell-${i}`,
          symbol: 'BTC',
          side: 'sell',
          confidence: 0.6,
          timestamp: new Date(),
        });
      }

      const conflicts = service.detectConflicts(manySignals);
      expect(conflicts[0].severity).toBe('high');
    });
  });

  describe('resolveConflicts', () => {
    const signals: StrategySignal[] = [
      {
        strategyId: 's1',
        symbol: 'BTC',
        side: 'buy',
        confidence: 0.9,
        quantity: 10,
        timestamp: new Date(),
      },
      {
        strategyId: 's2',
        symbol: 'BTC',
        side: 'sell',
        confidence: 0.6,
        quantity: 5,
        timestamp: new Date(),
      },
    ];

    const weights = new Map([['s1', 0.6], ['s2', 0.4]]);

    beforeEach(() => {
      service.updateConfig({ autoResolveConflicts: true });
    });

    it('should resolve using highest confidence', () => {
      service.updateConfig({ conflictResolution: 'highest_confidence' });
      
      const conflicts = service.detectConflicts(signals);
      const { resolvedSignals, resolutions } = service.resolveConflicts(
        conflicts,
        signals,
        weights
      );

      expect(resolutions.length).toBeGreaterThan(0);
      expect(resolvedSignals.some(s => s.strategyId === 's1')).toBe(true);
    });

    it('should resolve using weighted vote', () => {
      service.updateConfig({ conflictResolution: 'weighted_vote' });
      
      const conflicts = service.detectConflicts(signals);
      const { resolutions } = service.resolveConflicts(
        conflicts,
        signals,
        weights
      );

      expect(resolutions.length).toBeGreaterThan(0);
      expect(resolutions[0].action).toContain('weighted vote');
    });

    it('should not auto-resolve when disabled', () => {
      service.updateConfig({ 
        autoResolveConflicts: false,
        conflictResolution: 'manual'
      });
      
      const conflicts = service.detectConflicts(signals);
      const { resolutions } = service.resolveConflicts(
        conflicts,
        signals,
        weights
      );

      // When autoResolveConflicts is false, it returns empty resolutions
      // and the conflict requires manual resolution
      expect(resolutions.every(r => r.action === 'Requires manual resolution')).toBe(true);
    });
  });

  describe('calculateRiskScore', () => {
    it('should calculate risk score', () => {
      const result = service.calculateRiskScore({
        totalPosition: 50000,
        positionByAsset: new Map([['BTC', 30000], ['ETH', 20000]]),
        positionByStrategy: new Map([['s1', 25000], ['s2', 25000]]),
        conflictCount: 1,
      });

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.breakdown.concentrationRisk).toBeDefined();
      expect(result.breakdown.limitUtilization).toBeDefined();
      expect(result.breakdown.conflictRisk).toBeDefined();
    });

    it('should have higher risk score with conflicts', () => {
      const lowRisk = service.calculateRiskScore({
        totalPosition: 30000,
        positionByAsset: new Map([['BTC', 15000], ['ETH', 15000]]),
        positionByStrategy: new Map([['s1', 15000], ['s2', 15000]]),
        conflictCount: 0,
      });

      const highRisk = service.calculateRiskScore({
        totalPosition: 90000,
        positionByAsset: new Map([['BTC', 85000]]),  // Concentrated
        positionByStrategy: new Map([['s1', 90000]]),
        conflictCount: 5,
      });

      expect(highRisk.score).toBeGreaterThan(lowRisk.score);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      service.updateConfig({
        conflictResolution: 'first_come',
        enableConflictDetection: false,
      });

      const config = service.getConfig();
      expect(config.conflictResolution).toBe('first_come');
      expect(config.enableConflictDetection).toBe(false);
    });

    it('should update position limits', () => {
      service.updatePositionLimits({
        maxTotalPosition: 500000,
        maxLeverage: 5,
      });

      const config = service.getConfig();
      expect(config.positionLimits.maxTotalPosition).toBe(500000);
      expect(config.positionLimits.maxLeverage).toBe(5);
    });
  });
});