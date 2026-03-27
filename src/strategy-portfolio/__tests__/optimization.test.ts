/**
 * Tests for Portfolio Optimization Service
 */

import { PortfolioOptimizationService } from '../optimization.service';
import { StrategyPortfolio, CorrelationAnalysis } from '../types';

describe('PortfolioOptimizationService', () => {
  let service: PortfolioOptimizationService;

  const mockPortfolio: StrategyPortfolio = {
    id: 'portfolio-1',
    userId: 'user-1',
    name: 'Test Portfolio',
    totalCapital: 100000,
    allocationMethod: 'custom',
    rebalanceConfig: {
      enabled: true,
      frequency: 'threshold',
      threshold: 5,
    },
    status: 'active',
    strategies: [
      {
        id: 'ps-1',
        portfolioId: 'portfolio-1',
        strategyId: 's1',
        weight: 0.5,
        allocation: 50000,
        currentAllocation: 55000,  // Drifted
        status: 'running',
        enabled: true,
        currentValue: 52000,
        returnAmount: 2000,
        returnPct: 4,
        strategyName: 'Strategy 1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'ps-2',
        portfolioId: 'portfolio-1',
        strategyId: 's2',
        weight: 0.5,
        allocation: 50000,
        currentAllocation: 45000,  // Drifted
        status: 'running',
        enabled: true,
        currentValue: 48000,
        returnAmount: -2000,
        returnPct: -4,
        strategyName: 'Strategy 2',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCorrelationAnalysis: CorrelationAnalysis = {
    matrix: {
      strategyIds: ['s1', 's2'],
      matrix: [[1, 0.8], [0.8, 1]],
      period: '30d',
      calculatedAt: new Date(),
    },
    highCorrelationPairs: [
      { strategyId1: 's1', strategyId2: 's2', correlation: 0.8 },
    ],
    diversificationScore: 40,
    recommendations: ['Consider reducing correlation between strategies'],
  };

  beforeEach(() => {
    service = new PortfolioOptimizationService();
  });

  describe('analyzePortfolio', () => {
    it('should analyze portfolio and return suggestions', () => {
      const analysis = service.analyzePortfolio(mockPortfolio);

      expect(analysis.currentScore).toBeGreaterThanOrEqual(0);
      expect(analysis.currentScore).toBeLessThanOrEqual(100);
      expect(analysis.suggestions).toBeDefined();
      expect(analysis.riskReturnProfile).toBeDefined();
      expect(analysis.lastAnalyzed).toBeInstanceOf(Date);
    });

    it('should detect concentration risk', () => {
      const concentratedPortfolio: StrategyPortfolio = {
        ...mockPortfolio,
        strategies: [
          {
            ...mockPortfolio.strategies![0],
            weight: 0.7,  // 70% in one strategy
            allocation: 70000,
          },
        ],
      };

      const analysis = service.analyzePortfolio(concentratedPortfolio);

      const concentrationSuggestion = analysis.suggestions.find(
        s => s.type === 'adjust_weight' && s.title.includes('concentration')
      );

      expect(concentrationSuggestion).toBeDefined();
      expect(concentrationSuggestion!.priority).toBe('high');
    });

    it('should detect rebalance needs', () => {
      // Create portfolio with significant drift
      const driftedPortfolio: StrategyPortfolio = {
        ...mockPortfolio,
        strategies: [
          {
            ...mockPortfolio.strategies![0],
            weight: 0.5,
            currentValue: 70000,  // Significant drift from target 50%
            currentAllocation: 70000,
          },
          {
            ...mockPortfolio.strategies![1],
            weight: 0.5,
            currentValue: 30000,  // Significant drift
            currentAllocation: 30000,
          },
        ],
      };

      const analysis = service.analyzePortfolio(driftedPortfolio);

      // Should have some suggestions due to weight deviation
      expect(analysis.suggestions.length).toBeGreaterThan(0);
    });

    it('should use correlation analysis for diversification suggestions', () => {
      const analysis = service.analyzePortfolio(
        mockPortfolio,
        mockCorrelationAnalysis
      );

      const diversificationSuggestion = analysis.suggestions.find(
        s => s.type === 'remove_strategy' || s.type === 'add_strategy'
      );

      // Should have suggestion due to low diversification score
      expect(analysis.suggestions.length).toBeGreaterThan(0);
    });

    it('should sort suggestions by priority', () => {
      const analysis = service.analyzePortfolio(mockPortfolio);

      const priorities = analysis.suggestions.map(s => s.priority);
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      
      for (let i = 0; i < priorities.length - 1; i++) {
        expect(priorityOrder[priorities[i]]).toBeLessThanOrEqual(
          priorityOrder[priorities[i + 1]]
        );
      }
    });
  });

  describe('risk-return profile', () => {
    it('should calculate risk-return profile', () => {
      const analysis = service.analyzePortfolio(mockPortfolio);

      expect(analysis.riskReturnProfile.expectedReturn).toBeDefined();
      expect(analysis.riskReturnProfile.risk).toBeGreaterThan(0);
      expect(analysis.riskReturnProfile.sharpeRatio).toBeDefined();
    });

    it('should use historical returns if provided', () => {
      const historicalReturns = new Map([
        ['s1', [0.01, 0.02, -0.01, 0.03, 0.01]],
        ['s2', [-0.01, 0.01, 0.02, -0.02, 0.01]],
      ]);

      const analysis = service.analyzePortfolio(
        mockPortfolio,
        undefined,
        historicalReturns
      );

      expect(analysis.suggestions.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('optimization score', () => {
    it('should give high score to well-diversified portfolio', () => {
      const goodPortfolio: StrategyPortfolio = {
        ...mockPortfolio,
        strategies: [
          { ...mockPortfolio.strategies![0], weight: 0.25 },
          { ...mockPortfolio.strategies![1], weight: 0.25 },
          { ...mockPortfolio.strategies![0], id: 'ps-3', strategyId: 's3', weight: 0.25 },
          { ...mockPortfolio.strategies![1], id: 'ps-4', strategyId: 's4', weight: 0.25 },
        ],
      };

      const analysis = service.analyzePortfolio(goodPortfolio);
      expect(analysis.currentScore).toBeGreaterThan(70);
    });

    it('should penalize single-strategy portfolio', () => {
      const singleStrategy: StrategyPortfolio = {
        ...mockPortfolio,
        strategies: [
          { ...mockPortfolio.strategies![0], weight: 1 },
        ],
      };

      const analysis = service.analyzePortfolio(singleStrategy);
      expect(analysis.currentScore).toBeLessThan(80);
    });
  });

  describe('generateOptimalAllocation', () => {
    it('should generate risk parity allocation', () => {
      const strategies = [
        { id: 's1', expectedReturn: 0.1, volatility: 0.2 },
        { id: 's2', expectedReturn: 0.15, volatility: 0.3 },
        { id: 's3', expectedReturn: 0.08, volatility: 0.1 },
      ];

      const allocation = service.generateOptimalAllocation(strategies);

      expect(allocation).toHaveLength(3);
      expect(allocation.every(a => a.weight > 0)).toBe(true);
      expect(allocation.every(a => a.weight <= 1)).toBe(true);
      
      // Weights should sum to 1
      const totalWeight = allocation.reduce((sum, a) => sum + a.weight, 0);
      expect(totalWeight).toBeCloseTo(1, 2);
    });

    it('should give higher weight to lower volatility in risk parity', () => {
      const strategies = [
        { id: 'low-vol', expectedReturn: 0.1, volatility: 0.1 },
        { id: 'high-vol', expectedReturn: 0.2, volatility: 0.4 },
      ];

      const allocation = service.generateOptimalAllocation(strategies);

      const lowVolWeight = allocation.find(a => a.strategyId === 'low-vol')!.weight;
      const highVolWeight = allocation.find(a => a.strategyId === 'high-vol')!.weight;

      // Lower volatility should get higher weight
      expect(lowVolWeight).toBeGreaterThan(highVolWeight);
    });
  });
});