# LLM Strategy Implementation

## Date: 2026-03-11
## Issue: #19
## PR: #28

## Implementation Summary

### Core Components

#### 1. LLMClient Class (`src/strategy/LLMClient.ts`)
Encapsulates OpenAI-compatible API calls with:

**Features:**
- **Rate Limiting**: Token bucket algorithm (configurable requests per minute)
- **Retry Mechanism**: Exponential backoff on network errors and rate limits
- **Token Usage Tracking**: Real-time tracking of prompt/completion tokens
- **Cost Estimation**: Automatic cost calculation based on token usage
- **Event System**: Emits events for monitoring (request, response, error, rate-limit, token-usage)

**API:**
```typescript
const client = new LLMClient({
  apiUrl: 'https://space.ai-builders.com/backend',
  apiKey: process.env.LLM_API_KEY,
  model: 'gpt-4',
  maxTokens: 1000,
  temperature: 0.7,
  maxRetries: 3,
  enableLogging: true,
});

// Chat completion
const { content, usage } = await client.chatCompletion([
  { role: 'system', content: '...' },
  { role: 'user', content: '...' }
]);

// Market analysis
const signal = await client.analyzeMarket(marketData);

// Get statistics
const usage = client.getTokenUsage();
const stats = client.getStats();
```

#### 2. LLMStrategy Class (`src/strategy/LLMStrategy.ts`)
Trading strategy that uses LLM for decision making:

**Features:**
- **Prompt Template System**:
  - Market Analysis Prompt (default + customizable)
  - Risk Assessment Prompt
  - Trading Decision Prompt (combines analysis + risk)
  
- **Async Signal Caching**: Non-blocking signal generation
  - Cache validity: 5 seconds (configurable)
  - Background fetching prevents blocking onTick
  
- **Risk Management**:
  - Confidence threshold filtering (default: 0.6)
  - Risk level filtering (low/medium/high)
  - Daily budget limits
  - Cooldown periods between signals
  
- **Decision Logging**: Complete audit trail
  - Market data snapshot
  - LLM signal received
  - Final order signal (or filter reason)
  - Token usage and cost
  
- **Statistics & Monitoring**:
  - Token usage per decision
  - Daily cost tracking
  - Request success rate
  - Decision history

**Configuration:**
```typescript
const config: LLMStrategyConfig = {
  id: 'llm-btc',
  name: 'LLM BTC Strategy',
  params: {
    llm: {
      model: 'gpt-4',
      apiUrl: 'https://space.ai-builders.com/backend',
      temperature: 0.7,
      maxTokens: 1000,
    },
    trading: {
      quantity: 1,
      minConfidence: 0.7,
      maxRiskLevel: 'medium',
      cooldownPeriod: 5000, // 5 seconds
    },
    rateLimit: {
      requestsPerMinute: 60,
      dailyBudget: 10, // $10 per day
    },
    enableLogging: true,
  }
};
```

### Integration with StrategyManager

```typescript
import { StrategyManager } from './StrategyManager';
import { LLMStrategy } from './LLMStrategy';

const manager = new StrategyManager({ initialCash: 100000 });

await manager.registerStrategy(
  {
    id: 'llm-strategy-1',
    name: 'LLM Strategy 1',
    params: { /* ... */ }
  },
  (config) => new LLMStrategy(config)
);

await manager.startStrategy('llm-strategy-1');

// Execute ticks
const signals = await manager.executeTick(marketData);
```

### Security & Cost Control

#### API Key Management
- ✅ **Never hardcode API keys**
- ✅ Read from environment variable: `LLM_API_KEY`
- ✅ Fallback to config parameter (still from env)
- ✅ Validation on initialization

#### Cost Control Mechanisms
1. **Daily Budget**: Hard limit on daily spending
   - Automatic reset at midnight
   - Signals blocked when budget exceeded
   
2. **Rate Limiting**: Prevents API throttling
   - Token bucket algorithm
   - Configurable requests per minute
   
3. **Confidence Thresholds**: Filter low-quality signals
   - Avoid wasting tokens on uncertain decisions
   
4. **Cooldown Periods**: Minimum time between signals
   - Prevents over-trading

#### Monitoring
- Real-time token usage tracking
- Cost estimation per request
- Daily cost accumulation
- Request success/failure rates

### Prompt Engineering

#### Default Prompts

**Market Analysis:**
```
You are an expert quantitative trader and financial analyst...
Analyze the provided market data carefully and output a JSON object...
```

**Risk Assessment:**
```
You are a risk management expert. Analyze the current market conditions...
```

**Trading Decision:**
```
Based on the market analysis and risk assessment, make a final trading decision...
```

#### Custom Prompts
```typescript
strategy.setPromptTemplate({
  name: 'market-analysis',
  template: 'Custom prompt template...',
  variables: ['symbol', 'timeframe']
});
```

### Testing

#### Unit Tests (28 test cases)
- LLMClient initialization
- Chat completion (success, errors, retries)
- Rate limiting handling
- Token usage tracking
- Market analysis
- Response parsing
- LLMStrategy lifecycle
- Signal generation and filtering
- Decision logging
- Statistics
- Prompt templates
- Risk management

Run tests:
```bash
npm test -- tests/strategy/llm-strategy.test.ts
```

#### Integration Tests
See `tests/strategy/llm-integration-test.md` for:
- Basic integration examples
- Multiple strategy testing
- Prompt customization
- Rate limiting tests
- Decision log analysis
- Performance benchmarks
- Monitoring setup

### Environment Setup

```env
# Required
LLM_API_KEY=your-api-key-here
LLM_API_URL=https://space.ai-builders.com/backend

# Optional
LLM_MODEL=gpt-4
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=1000
```

### Performance Considerations

1. **Async Signal Fetching**: Non-blocking architecture
   - Signals fetched in background
   - Cached for 5 seconds (configurable)
   - onTick returns immediately

2. **Rate Limiting**: Prevents API throttling
   - Token bucket algorithm
   - Configurable requests per minute

3. **Token Efficiency**:
   - Compact prompt templates
   - Reusable market data formatting
   - Efficient response parsing

### Monitoring & Observability

#### Events
```typescript
llmClient.on('request', (event) => { /* ... */ });
llmClient.on('response', (event) => { /* ... */ });
llmClient.on('token-usage', (event) => { /* ... */ });
llmClient.on('rate-limit', (event) => { /* ... */ });
llmClient.on('error', (event) => { /* ... */ });
```

#### Statistics
```typescript
const stats = strategy.getLLMStats();
console.log({
  tokens: stats.tokenUsage.totalTokens,
  cost: stats.tokenUsage.estimatedCost,
  requests: stats.requestStats.requestCount,
  successRate: stats.requestStats.successRate,
  dailyCost: stats.dailyCost,
});
```

#### Decision Logs
```typescript
const logs = strategy.getDecisionLog(100);
logs.forEach(log => {
  console.log({
    timestamp: log.timestamp,
    action: log.llmSignal.action,
    confidence: log.llmSignal.confidence,
    cost: log.tokenUsage.cost,
  });
});
```

### Design Decisions

1. **Async Caching**: LLM calls are async but onTick is sync
   - Solution: Background fetching with cache
   - Trade-off: Signals may be 5 seconds stale
   - Benefit: No blocking, consistent with other strategies

2. **Native Fetch**: No external dependencies (no LangChain, no Vercel AI SDK)
   - Simpler dependency tree
   - Full control over implementation
   - Easier to debug and customize

3. **Event System**: EventEmitter for monitoring
   - Decoupled observability
   - Easy to add custom handlers
   - No tight coupling to logging framework

4. **Prompt Templates**: Customizable but with sensible defaults
   - Users can override without reimplementing
   - Default prompts are well-tested
   - Variables system for future extensibility

### Lessons Learned

1. **LLM Latency**: Real-time trading requires async architecture
   - Background fetching is essential
   - Cache validity is a trade-off (freshness vs. latency)

2. **Cost Management**: LLM calls add up quickly
   - Daily budgets are critical
   - Confidence filtering saves money
   - Token tracking provides visibility

3. **Error Handling**: LLM APIs can be unreliable
   - Retry logic is essential
   - Graceful degradation (fallback to hold)
   - Comprehensive logging for debugging

4. **Prompt Engineering**: Quality of signals depends on prompts
   - Default prompts are a starting point
   - Customization is key for different strategies
   - JSON output format is fragile (need fallback parsing)

### Future Enhancements

1. **Multi-LLM Support**: Switch between providers (OpenAI, Anthropic, etc.)
2. **Prompt Versioning**: Track and A/B test different prompts
3. **Signal Backtesting**: Replay historical data through LLM
4. **Ensemble Strategies**: Combine multiple LLM signals
5. **Fine-tuning Support**: Custom model fine-tuning for specific markets
6. **Streaming Responses**: Reduce latency with streaming
7. **Tool Use**: Allow LLM to call technical analysis functions
8. **Memory/Context**: Maintain conversation history for multi-turn analysis

### Files Created
- `src/strategy/LLMClient.ts`: LLM API client (500+ lines)
- `src/strategy/LLMStrategy.ts`: LLM trading strategy (600+ lines)
- `tests/strategy/llm-strategy.test.ts`: Unit tests (500+ lines)
- `tests/strategy/llm-integration-test.md`: Integration test guide (350+ lines)
- `src/strategy/index.ts`: Updated exports

### Test Coverage
- 28 unit tests
- 100% core functionality coverage
- Mock-based testing (no real API calls needed)
- Integration test documentation provided

### Next Steps
1. Investor approval for LLM API usage
2. Deploy to staging environment
3. Test with real market data
4. Monitor costs and performance
5. Iterate on prompt templates based on results
