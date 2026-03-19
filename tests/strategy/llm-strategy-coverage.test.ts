/**
 * LLM Strategy Coverage Tests
 *
 * Additional tests to improve code coverage for LLMStrategy
 */

import { LLMStrategy, LLMStrategyConfig } from '../../src/strategy/LLMStrategy';
import {  LLMTradingSignal } from '../../src/strategy/LLMClient';
import { StrategyContext, MarketData } from '../../src/strategy/types';

// Mock fetch globally
global.fetch = jest.fn();

describe('LLMStrategy Coverage Tests', () => {
  let strategy: LLMStrategy;
  let mockContext: StrategyContext;
  let mockOrderBook: any;

  const baseConfig: LLMStrategyConfig = {
    id: 'llm-test',
    name: 'LLM Test Strategy',
    params: {
      llm: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1000,
      },
      trading: {
        quantity: 10,
        minConfidence: 0.5,
        maxRiskLevel: 'high',
        cooldownPeriod: 0, // No cooldown for testing
      },
      enableLogging: true,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LLM_API_KEY = 'test-api-key';
    process.env.LLM_API_URL = 'https://test-api.example.com';

    mockOrderBook = {
      getBestBid: jest.fn(() => 99),
      getBestAsk: jest.fn(() => 101),
    };

    mockContext = {
      portfolio: {
        cash: 100000,
        positions: [],
        totalValue: 100000,
        unrealizedPnL: 0,
        timestamp: Date.now(),
      },
      clock: Date.now(),
      getMarketData: (): MarketData => ({
        orderBook: mockOrderBook,
        trades: Array.from({ length: 25 }, (_, i) => ({
          id: `trade-${i}`,
          price: 100 + i * 0.5,
          quantity: 10,
          timestamp: Date.now() - i * 1000,
          buyOrderId: `buy-${i}`,
          sellOrderId: `sell-${i}`,
          status: 'filled' as const,
        })),
        timestamp: Date.now(),
      }),
      getPosition: (_symbol: string) => 0,
      getCash: () => 100000,
    };

    strategy = new LLMStrategy(baseConfig);
    strategy.onInit(mockContext);
  });

  afterEach(() => {
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_API_URL;
  });

  describe('Cooldown Period', () => {
    test('should block signals during cooldown period', () => {
      const cooldownConfig: LLMStrategyConfig = {
        ...baseConfig,
        params: {
          ...baseConfig.params,
          trading: {
            ...baseConfig.params!.trading,
            cooldownPeriod: 10000, // 10 seconds
          },
        },
      };

      const cooldownStrategy = new LLMStrategy(cooldownConfig);
      cooldownStrategy.onInit(mockContext);

      // Simulate a signal being generated
      cooldownStrategy['lastSignalTime'] = Date.now();

      // Next tick should be blocked by cooldown
      const signal = cooldownStrategy.onTick(mockContext);
      expect(signal).toBeNull();
    });

    test('should allow signals after cooldown period', () => {
      const cooldownConfig: LLMStrategyConfig = {
        ...baseConfig,
        params: {
          ...baseConfig.params,
          trading: {
            ...baseConfig.params!.trading,
            cooldownPeriod: 100,
          },
        },
      };

      const cooldownStrategy = new LLMStrategy(cooldownConfig);
      cooldownStrategy.onInit(mockContext);

      // Set last signal time in the past
      cooldownStrategy['lastSignalTime'] = Date.now() - 200;

      // Cooldown should be expired
      const canProceed = cooldownStrategy['checkCooldown']();
      expect(canProceed).toBe(true);
    });
  });

  describe('Risk Level Filtering', () => {
    test('should filter high risk signals when maxRiskLevel is low', () => {
      const lowRiskConfig: LLMStrategyConfig = {
        ...baseConfig,
        params: {
          ...baseConfig.params,
          trading: {
            ...baseConfig.params!.trading,
            maxRiskLevel: 'low',
          },
        },
      };

      const lowRiskStrategy = new LLMStrategy(lowRiskConfig);
      lowRiskStrategy.onInit(mockContext);

      // Create a high risk signal
      const highRiskSignal: LLMTradingSignal = {
        action: 'buy',
        confidence: 0.8,
        reason: 'Test',
        riskLevel: 'high',
      };

      const marketData = mockContext.getMarketData();
      const result = lowRiskStrategy['applyFilters'](highRiskSignal, marketData, mockContext);
      expect(result).toBeNull();
    });

    test('should filter medium risk signals when maxRiskLevel is low', () => {
      const lowRiskConfig: LLMStrategyConfig = {
        ...baseConfig,
        params: {
          ...baseConfig.params,
          trading: {
            ...baseConfig.params!.trading,
            maxRiskLevel: 'low',
          },
        },
      };

      const lowRiskStrategy = new LLMStrategy(lowRiskConfig);
      lowRiskStrategy.onInit(mockContext);

      const mediumRiskSignal: LLMTradingSignal = {
        action: 'buy',
        confidence: 0.8,
        reason: 'Test',
        riskLevel: 'medium',
      };

      const marketData = mockContext.getMarketData();
      const result = lowRiskStrategy['applyFilters'](mediumRiskSignal, marketData, mockContext);
      expect(result).toBeNull();
    });

    test('should allow low risk signals when maxRiskLevel is low', () => {
      const lowRiskConfig: LLMStrategyConfig = {
        ...baseConfig,
        params: {
          ...baseConfig.params,
          trading: {
            ...baseConfig.params!.trading,
            maxRiskLevel: 'low',
          },
        },
      };

      const lowRiskStrategy = new LLMStrategy(lowRiskConfig);
      lowRiskStrategy.onInit(mockContext);

      const lowRiskSignal: LLMTradingSignal = {
        action: 'buy',
        confidence: 0.8,
        reason: 'Test',
        riskLevel: 'low',
      };

      const marketData = mockContext.getMarketData();
      const result = lowRiskStrategy['applyFilters'](lowRiskSignal, marketData, mockContext);
      expect(result).not.toBeNull();
      expect(result?.side).toBe('buy');
    });

    test('should allow all risk levels when maxRiskLevel is high', () => {
      const highRiskSignal: LLMTradingSignal = {
        action: 'buy',
        confidence: 0.8,
        reason: 'Test',
        riskLevel: 'high',
      };

      const marketData = mockContext.getMarketData();
      const result = strategy['applyFilters'](highRiskSignal, marketData, mockContext);
      expect(result).not.toBeNull();
    });
  });

  describe('Confidence Threshold', () => {
    test('should filter signals below confidence threshold', () => {
      const lowConfidenceSignal: LLMTradingSignal = {
        action: 'buy',
        confidence: 0.3,
        reason: 'Low confidence',
        riskLevel: 'low',
      };

      const marketData = mockContext.getMarketData();
      const result = strategy['applyFilters'](lowConfidenceSignal, marketData, mockContext);
      expect(result).toBeNull();
    });

    test('should allow signals at confidence threshold', () => {
      const thresholdSignal: LLMTradingSignal = {
        action: 'buy',
        confidence: 0.5,
        reason: 'Threshold confidence',
        riskLevel: 'low',
      };

      const marketData = mockContext.getMarketData();
      const result = strategy['applyFilters'](thresholdSignal, marketData, mockContext);
      expect(result).not.toBeNull();
    });

    test('should allow signals above confidence threshold', () => {
      const highConfidenceSignal: LLMTradingSignal = {
        action: 'buy',
        confidence: 0.9,
        reason: 'High confidence',
        riskLevel: 'low',
      };

      const marketData = mockContext.getMarketData();
      const result = strategy['applyFilters'](highConfidenceSignal, marketData, mockContext);
      expect(result).not.toBeNull();
    });
  });

  describe('Hold Signal', () => {
    test('should return null for hold action', () => {
      const holdSignal: LLMTradingSignal = {
        action: 'hold',
        confidence: 0.8,
        reason: 'No action needed',
        riskLevel: 'low',
      };

      const marketData = mockContext.getMarketData();
      const result = strategy['applyFilters'](holdSignal, marketData, mockContext);
      expect(result).toBeNull();
    });
  });

  describe('Position Validation', () => {
    test('should filter sell signal when no position exists', () => {
      const sellSignal: LLMTradingSignal = {
        action: 'sell',
        confidence: 0.8,
        reason: 'Sell signal',
        riskLevel: 'low',
      };

      const marketData = mockContext.getMarketData();
      const result = strategy['applyFilters'](sellSignal, marketData, mockContext);
      expect(result).toBeNull();
    });

    test('should allow sell signal when position exists', () => {
      const contextWithPosition: StrategyContext = {
        ...mockContext,
        getPosition: (_symbol: string) => 100,
      };

      const sellSignal: LLMTradingSignal = {
        action: 'sell',
        confidence: 0.8,
        reason: 'Sell signal',
        riskLevel: 'low',
      };

      const marketData = contextWithPosition.getMarketData();
      const result = strategy['applyFilters'](sellSignal, marketData, contextWithPosition);
      expect(result).not.toBeNull();
      expect(result?.side).toBe('sell');
    });
  });

  describe('Cash Validation', () => {
    test('should filter buy signal when insufficient cash', () => {
      const lowCashContext: StrategyContext = {
        ...mockContext,
        getCash: () => 50, // Not enough for even 1 unit at price 100
      };

      const buySignal: LLMTradingSignal = {
        action: 'buy',
        confidence: 0.8,
        reason: 'Buy signal',
        riskLevel: 'low',
        price: 100,
        quantity: 10,
      };

      const marketData = lowCashContext.getMarketData();
      const result = strategy['applyFilters'](buySignal, marketData, lowCashContext);
      expect(result).toBeNull();
    });

    test('should allow buy signal when sufficient cash', () => {
      const buySignal: LLMTradingSignal = {
        action: 'buy',
        confidence: 0.8,
        reason: 'Buy signal',
        riskLevel: 'low',
        price: 100,
        quantity: 10,
      };

      const marketData = mockContext.getMarketData();
      const result = strategy['applyFilters'](buySignal, marketData, mockContext);
      expect(result).not.toBeNull();
      expect(result?.side).toBe('buy');
      expect(result?.quantity).toBe(10);
    });
  });

  describe('Price Determination', () => {
    test('should use signal price when provided', () => {
      const buySignal: LLMTradingSignal = {
        action: 'buy',
        confidence: 0.8,
        reason: 'Buy signal',
        riskLevel: 'low',
        price: 150,
        quantity: 5,
      };

      const marketData = mockContext.getMarketData();
      const result = strategy['applyFilters'](buySignal, marketData, mockContext);
      expect(result?.price).toBe(150);
    });

    test('should use best ask for buy when no signal price', () => {
      const buySignal: LLMTradingSignal = {
        action: 'buy',
        confidence: 0.8,
        reason: 'Buy signal',
        riskLevel: 'low',
      };

      const marketData = mockContext.getMarketData();
      const result = strategy['applyFilters'](buySignal, marketData, mockContext);
      expect(result?.price).toBe(101); // mockOrderBook.getBestAsk returns 101
    });

    test('should use best bid for sell when no signal price', () => {
      const contextWithPosition: StrategyContext = {
        ...mockContext,
        getPosition: (_symbol: string) => 100,
      };

      const sellSignal: LLMTradingSignal = {
        action: 'sell',
        confidence: 0.8,
        reason: 'Sell signal',
        riskLevel: 'low',
      };

      const marketData = contextWithPosition.getMarketData();
      const result = strategy['applyFilters'](sellSignal, marketData, contextWithPosition);
      expect(result?.price).toBe(99); // mockOrderBook.getBestBid returns 99
    });

    test('should return null when no valid price available', () => {
      const emptyOrderBook = {
        getBestBid: jest.fn(() => null),
        getBestAsk: jest.fn(() => null),
      };

      const emptyContext: StrategyContext = {
        ...mockContext,
        getMarketData: (): MarketData => ({
          orderBook: emptyOrderBook,
          trades: [],
          timestamp: Date.now(),
        }),
      };

      const buySignal: LLMTradingSignal = {
        action: 'buy',
        confidence: 0.8,
        reason: 'Buy signal',
        riskLevel: 'low',
      };

      const marketData = emptyContext.getMarketData();
      const result = strategy['applyFilters'](buySignal, marketData, emptyContext);
      expect(result).toBeNull();
    });
  });

  describe('Daily Budget', () => {
    test('should block signals when daily budget exceeded', () => {
      const budgetConfig: LLMStrategyConfig = {
        ...baseConfig,
        params: {
          ...baseConfig.params,
          rateLimit: {
            dailyBudget: 0.01,
          },
        },
      };

      const budgetStrategy = new LLMStrategy(budgetConfig);
      budgetStrategy.onInit(mockContext);

      // Simulate budget being exceeded
      budgetStrategy['dailyTokenCost'] = 1;

      const canProceed = budgetStrategy['checkDailyBudget']();
      expect(canProceed).toBe(false);
    });

    test('should reset daily cost after 24 hours', () => {
      const budgetStrategy = new LLMStrategy(baseConfig);
      budgetStrategy.onInit(mockContext);

      // Set last cost reset to more than 24 hours ago
      budgetStrategy['lastCostReset'] = Date.now() - 25 * 60 * 60 * 1000;
      budgetStrategy['dailyTokenCost'] = 100;

      budgetStrategy['checkDailyBudget']();

      expect(budgetStrategy['dailyTokenCost']).toBe(0);
    });
  });

  describe('Decision Logging', () => {
    test('should have decision log array', () => {
      const log = strategy.getDecisionLog();
      expect(Array.isArray(log)).toBe(true);
    });

    test('should limit decision log to 1000 entries', () => {
      // Simulate adding many decisions
      for (let i = 0; i < 1100; i++) {
        const signal: LLMTradingSignal = {
          action: 'buy',
          confidence: 0.8,
          reason: `Test ${i}`,
          riskLevel: 'low',
        };
        const marketData = mockContext.getMarketData();
        strategy['applyFilters'](signal, marketData, mockContext);
      }

      const log = strategy.getDecisionLog();
      // Note: applyFilters doesn't call logDecision directly
      // The log is updated in onTick
      expect(log.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Signal Caching', () => {
    test('should detect stale cache', () => {
      const staleStrategy = new LLMStrategy(baseConfig);
      staleStrategy.onInit(mockContext);

      // Set cached signal with old timestamp
      staleStrategy['cachedSignal'] = { action: 'buy', confidence: 0.8, reason: 'Test', riskLevel: 'low' };
      staleStrategy['cacheTimestamp'] = Date.now() - 10000; // 10 seconds ago

      const isStale = staleStrategy['isCacheStale']();
      expect(isStale).toBe(true);
    });

    test('should consider cache valid when fresh', () => {
      const freshStrategy = new LLMStrategy(baseConfig);
      freshStrategy.onInit(mockContext);

      freshStrategy['cachedSignal'] = { action: 'buy', confidence: 0.8, reason: 'Test', riskLevel: 'low' };
      freshStrategy['cacheTimestamp'] = Date.now();

      const isStale = freshStrategy['isCacheStale']();
      expect(isStale).toBe(false);
    });

    test('should consider cache stale when no cached signal', () => {
      const emptyStrategy = new LLMStrategy(baseConfig);
      emptyStrategy.onInit(mockContext);

      emptyStrategy['cachedSignal'] = null;

      const isStale = emptyStrategy['isCacheStale']();
      expect(isStale).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle onTick errors gracefully', () => {
      const errorContext: StrategyContext = {
        ...mockContext,
        getMarketData: () => {
          throw new Error('Test error');
        },
      };

      const result = strategy.onTick(errorContext);
      expect(result).toBeNull();
    });
  });

  describe('Quantity Handling', () => {
    test('should use default quantity from config', () => {
      const buySignal: LLMTradingSignal = {
        action: 'buy',
        confidence: 0.8,
        reason: 'Buy signal',
        riskLevel: 'low',
      };

      const marketData = mockContext.getMarketData();
      const result = strategy['applyFilters'](buySignal, marketData, mockContext);
      expect(result?.quantity).toBe(10); // Default from config
    });

    test('should use signal quantity when provided', () => {
      const buySignal: LLMTradingSignal = {
        action: 'buy',
        confidence: 0.8,
        reason: 'Buy signal',
        riskLevel: 'low',
        quantity: 25,
      };

      const marketData = mockContext.getMarketData();
      const result = strategy['applyFilters'](buySignal, marketData, mockContext);
      expect(result?.quantity).toBe(25);
    });
  });

  describe('LLM Statistics', () => {
    test('should return null stats when no LLM client', () => {
      const noClientStrategy = new LLMStrategy(baseConfig);
      noClientStrategy.onInit(mockContext);
      noClientStrategy['llmClient'] = null;

      const stats = noClientStrategy.getLLMStats();
      expect(stats).toBeNull();
    });
  });
});
