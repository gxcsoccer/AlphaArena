# LLM Strategy Integration Test Guide

## Overview

This document describes how to integrate and test the LLM Strategy with the real-time trading engine.

## Prerequisites

1. **Environment Setup**
   ```bash
   # Install dependencies
   npm install
   
   # Set up environment variables
   cp .env.example .env
   ```

2. **Environment Variables**
   ```env
   # Required: LLM API Configuration
   LLM_API_KEY=your-api-key-here
   LLM_API_URL=https://space.ai-builders.com/backend
   
   # Optional: LLM Model Configuration
   LLM_MODEL=gpt-4
   LLM_TEMPERATURE=0.7
   LLM_MAX_TOKENS=1000
   
   # Optional: Rate Limiting
   LLM_REQUESTS_PER_MINUTE=60
   LLM_DAILY_BUDGET=10
   ```

## Unit Testing

Run unit tests with mocked LLM API:

```bash
npm test -- tests/strategy/llm-strategy.test.ts
```

### Test Coverage

The unit tests cover:

1. **LLMClient Tests**
   - Initialization with config and environment variables
   - Chat completion with successful responses
   - Error handling (API errors, network errors)
   - Retry mechanism on failures
   - Rate limiting handling
   - Token usage tracking
   - Market analysis and signal parsing

2. **LLMStrategy Tests**
   - Strategy initialization
   - Signal generation from LLM
   - Filtering by confidence threshold
   - Filtering by risk level
   - Cooldown period enforcement
   - Daily budget checking
   - Decision logging
   - Prompt template customization
   - Cleanup and resource management

## Integration Testing

### Test 1: Basic LLM Strategy Integration

```typescript
import { StrategyManager } from '../src/strategy/StrategyManager';
import { LLMStrategy, LLMStrategyConfig } from '../src/strategy/LLMStrategy';
import { MarketData } from '../src/strategy/types';

async function testBasicIntegration() {
  // Create strategy manager
  const manager = new StrategyManager({
    initialCash: 100000,
    enableLogging: true,
  });

  // Register LLM strategy
  const config: LLMStrategyConfig = {
    id: 'llm-test-1',
    name: 'LLM Test Strategy',
    params: {
      llm: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 500,
      },
      trading: {
        quantity: 1,
        minConfidence: 0.7,
        maxRiskLevel: 'medium',
        cooldownPeriod: 5000,
      },
      rateLimit: {
        requestsPerMinute: 10,
        dailyBudget: 5,
      },
      enableLogging: true,
    }
  };

  await manager.registerStrategy(
    config,
    (cfg) => new LLMStrategy(cfg as LLMStrategyConfig)
  );

  // Start strategy
  await manager.startStrategy('llm-test-1');

  // Create mock market data
  const marketData: MarketData = {
    orderBook: createMockOrderBook(50000, 50010),
    trades: [
      { id: '1', side: 'buy', price: 50000, quantity: 1, timestamp: Date.now() }
    ],
    timestamp: Date.now(),
  };

  // Execute tick
  const signals = await manager.executeTick(marketData);
  
  console.log('Generated signals:', signals);

  // Get strategy status
  const status = manager.getStrategyStatus('llm-test-1');
  console.log('Strategy status:', status);

  // Get LLM-specific stats
  const llmStats = (manager as any).strategies.get('llm-test-1')?.strategy.getLLMStats();
  console.log('LLM stats:', llmStats);

  // Cleanup
  await manager.shutdown();
}
```

### Test 2: Multiple LLM Strategies

```typescript
async function testMultipleStrategies() {
  const manager = new StrategyManager({ initialCash: 100000 });

  // Register multiple LLM strategies with different configurations
  const strategies = [
    {
      id: 'llm-conservative',
      params: {
        minConfidence: 0.8,
        maxRiskLevel: 'low' as const,
        quantity: 1,
      }
    },
    {
      id: 'llm-aggressive',
      params: {
        minConfidence: 0.6,
        maxRiskLevel: 'high' as const,
        quantity: 5,
      }
    },
    {
      id: 'llm-balanced',
      params: {
        minConfidence: 0.7,
        maxRiskLevel: 'medium' as const,
        quantity: 2,
      }
    },
  ];

  for (const strat of strategies) {
    await manager.registerStrategy(
      {
        id: strat.id,
        name: `LLM ${strat.id}`,
        params: {
          llm: { model: 'gpt-4', temperature: 0.7 },
          trading: strat.params,
        }
      },
      (cfg) => new LLMStrategy(cfg as LLMStrategyConfig)
    );
    await manager.startStrategy(strat.id);
  }

  // Execute ticks and compare performance
  for (let i = 0; i < 100; i++) {
    const marketData = generateMarketData();
    const signals = await manager.executeTick(marketData);
    
    console.log(`Tick ${i}: Generated ${signals.size} signals`);
  }

  // Compare strategy performance
  for (const strat of strategies) {
    const status = manager.getStrategyStatus(strat.id);
    console.log(`${strat.id}:`, {
      totalSignals: status.totalSignals,
      totalTrades: status.totalTrades,
      portfolioValue: status.portfolioValue,
    });
  }

  await manager.shutdown();
}
```

### Test 3: Prompt Template Customization

```typescript
async function testPromptCustomization() {
  const strategy = new LLMStrategy({
    id: 'llm-custom-prompt',
    name: 'Custom Prompt Strategy',
    params: {
      llm: { model: 'gpt-4' },
      trading: { quantity: 1 },
      enableLogging: true,
    }
  });

  // Set custom market analysis prompt
  strategy.setPromptTemplate({
    name: 'market-analysis',
    template: `You are a contrarian trader. Look for overbought/oversold conditions.

Analyze the market data and output JSON:
{
  "action": "buy" | "sell" | "hold",
  "confidence": 0.0-1.0,
  "reason": "explanation",
  "riskLevel": "low" | "medium" | "high"
}

Focus on:
1. RSI levels (overbought > 70, oversold < 30)
2. Price deviations from moving averages
3. Volume anomalies`,
    variables: ['symbol', 'timeframe']
  });

  // Set custom risk assessment prompt
  strategy.setPromptTemplate({
    name: 'risk-assessment',
    template: `Assess tail risk and black swan potential.

Output JSON:
{
  "riskLevel": "low" | "medium" | "high",
  "riskFactors": ["list"],
  "recommendedPositionSize": 0.0-1.0
}

Consider:
1. Market volatility (VIX)
2. Correlation breakdowns
3. Liquidity conditions
4. Geopolitical risks`,
    variables: []
  });

  // Test with market data
  const context = createMockContext();
  strategy.onInit(context);
  
  const signal = strategy.onTick(context);
  console.log('Signal with custom prompts:', signal);
}
```

### Test 4: Rate Limiting and Cost Control

```typescript
async function testRateLimiting() {
  const strategy = new LLMStrategy({
    id: 'llm-rate-test',
    name: 'Rate Limit Test',
    params: {
      llm: { model: 'gpt-4' },
      rateLimit: {
        requestsPerMinute: 10,
        dailyBudget: 1, // $1 daily budget
      },
      enableLogging: true,
    }
  });

  const context = createMockContext();
  strategy.onInit(context);

  // Rapid fire requests
  for (let i = 0; i < 20; i++) {
    const signal = strategy.onTick(context);
    const stats = strategy.getLLMStats();
    
    console.log(`Request ${i}:`, {
      signal: signal ? 'generated' : 'blocked',
      dailyCost: stats?.dailyCost,
      budgetRemaining: 1 - (stats?.dailyCost || 0),
    });

    // Stop if budget exceeded
    if (stats && stats.dailyCost >= 1) {
      console.log('Daily budget exceeded, stopping');
      break;
    }

    await sleep(100); // 100ms between requests
  }
}
```

### Test 5: Decision Log Analysis

```typescript
async function testDecisionLogAnalysis() {
  const strategy = new LLMStrategy({
    id: 'llm-log-test',
    name: 'Decision Log Test',
    params: {
      llm: { model: 'gpt-4' },
      trading: { quantity: 1 },
      enableLogging: true,
    }
  });

  const context = createMockContext();
  strategy.onInit(context);

  // Run for multiple ticks
  for (let i = 0; i < 50; i++) {
    const marketData = generateMarketData();
    context.getMarketData = () => marketData;
    
    strategy.onTick(context);
    await sleep(1000);
  }

  // Analyze decision log
  const logs = strategy.getDecisionLog(100);
  
  console.log('Decision Log Analysis:');
  console.log(`Total decisions: ${logs.length}`);
  
  const actions = logs.reduce((acc, log) => {
    acc[log.llmSignal.action] = (acc[log.llmSignal.action] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('Action distribution:', actions);
  
  const avgConfidence = logs.reduce((acc, log) => acc + log.llmSignal.confidence, 0) / logs.length;
  console.log(`Average confidence: ${avgConfidence.toFixed(2)}`);
  
  const riskDistribution = logs.reduce((acc, log) => {
    acc[log.llmSignal.riskLevel] = (acc[log.llmSignal.riskLevel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('Risk distribution:', riskDistribution);
  
  const totalCost = logs.reduce((acc, log) => acc + log.tokenUsage.cost, 0);
  console.log(`Total cost: $${totalCost.toFixed(4)}`);
}
```

## Performance Testing

### Benchmark: LLM Latency

```typescript
async function benchmarkLatency() {
  const client = new LLMClient({
    apiUrl: process.env.LLM_API_URL!,
    model: 'gpt-4',
    enableLogging: false,
  });

  const latencies: number[] = [];
  
  for (let i = 0; i < 10; i++) {
    const start = Date.now();
    
    await client.analyzeMarket({
      symbol: 'BTC-USD',
      lastPrice: 50000,
      priceHistory: generatePriceHistory(100),
    });
    
    const latency = Date.now() - start;
    latencies.push(latency);
    
    console.log(`Request ${i + 1}: ${latency}ms`);
  }

  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const min = Math.min(...latencies);
  const max = Math.max(...latencies);
  
  console.log('Latency Statistics:');
  console.log(`  Average: ${avg.toFixed(0)}ms`);
  console.log(`  Min: ${min}ms`);
  console.log(`  Max: ${max}ms`);
}
```

## Monitoring and Observability

### Real-time Monitoring

```typescript
// Monitor LLM strategy performance
setInterval(() => {
  const stats = strategy.getLLMStats();
  if (stats) {
    console.log('LLM Stats:', {
      tokens: stats.tokenUsage.totalTokens,
      cost: stats.tokenUsage.estimatedCost,
      requests: stats.requestStats.requestCount,
      successRate: stats.requestStats.successRate.toFixed(1) + '%',
      dailyCost: stats.dailyCost,
    });
  }
}, 60000); // Every minute
```

### Event Listening

```typescript
const llmClient = new LLMClient(config);

llmClient.on('request', (event) => {
  console.log('LLM Request:', event.timestamp);
});

llmClient.on('response', (event) => {
  console.log('LLM Response:', event.timestamp);
});

llmClient.on('token-usage', (event) => {
  console.log('Token Usage:', event.usage);
});

llmClient.on('rate-limit', (event) => {
  console.warn('Rate Limited:', event);
});

llmClient.on('error', (event) => {
  console.error('LLM Error:', event.error);
});
```

## Troubleshooting

### Common Issues

1. **API Key Errors**
   ```
   Error: LLM_API_KEY environment variable is required
   ```
   **Solution**: Set `LLM_API_KEY` in your `.env` file or environment.

2. **Rate Limiting**
   ```
   Rate limit exceeded, retrying after delay
   ```
   **Solution**: Reduce `requestsPerMinute` or implement exponential backoff.

3. **Budget Exceeded**
   ```
   Daily budget exceeded, skipping signal generation
   ```
   **Solution**: Increase `dailyBudget` or reduce trading frequency.

4. **Invalid LLM Response**
   ```
   Failed to parse LLM response: No JSON object found
   ```
   **Solution**: Improve prompt template to enforce JSON output format.

### Debug Mode

Enable detailed logging:

```typescript
const strategy = new LLMStrategy({
  // ... config
  params: {
    // ... other params
    enableLogging: true,
  }
});
```

## Best Practices

1. **Start Conservative**: Begin with high confidence thresholds (0.7+) and low risk levels
2. **Monitor Costs**: Set daily budgets and alert thresholds
3. **Test Extensively**: Use mock LLM API for development, real API only for integration tests
4. **Log Everything**: Decision logs are crucial for debugging and improvement
5. **Customize Prompts**: Tailor prompts to your trading style and market conditions
6. **Rate Limiting**: Always implement rate limiting to avoid API throttling
7. **Error Handling**: Gracefully handle LLM API failures with fallback strategies

## Next Steps

1. Run unit tests: `npm test -- tests/strategy/llm-strategy.test.ts`
2. Set up environment variables in `.env`
3. Run integration tests with real LLM API
4. Deploy to production with monitoring
5. Iterate on prompt templates based on performance
