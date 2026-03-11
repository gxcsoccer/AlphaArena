# StrategyManager Implementation

## Date: 2026-03-11
## Issue: #16
## PR: #26

## Implementation Summary

### Core Architecture
- **StrategyManager class**: Central coordinator for multiple trading strategies
- **StrategyInstance interface**: Wrapper containing strategy + isolated components
- **Event-driven design**: Extends EventEmitter for strategy lifecycle events

### Key Features Implemented

#### 1. Strategy Registration & Lifecycle
- `registerStrategy(config, factory)`: Register a new strategy with factory pattern
- `unregisterStrategy(id)`: Remove strategy and cleanup resources
- `startStrategy/stopStrategy(id)`: Control strategy execution
- `pauseStrategy/resumeStrategy(id)`: Temporary suspension
- `shutdown()`: Graceful shutdown of all strategies

#### 2. Strategy Isolation
Each strategy has:
- **Independent Portfolio**: Separate cash and positions tracking
- **Independent OrderBook view**: Isolated market data view
- **Independent Context**: StrategyContext with isolated state
- **Independent Statistics**: Track signals and trades per strategy

#### 3. Configuration Management
- `updateStrategyConfig(id, config)`: Update strategy parameters
- Database persistence via StrategiesDAO (when enabled)
- Hot reload support for configuration changes

#### 4. Database Integration
- `loadFromDatabase(factoryMap)`: Load active strategies from Supabase
- Automatic status sync (active/paused/stopped)
- Config persistence on updates

#### 5. Inter-Strategy Communication (Optional)
- `sendMessage(from, to, type, payload)`: Send messages between strategies
- Broadcast support (to: '*')
- Message queue processing
- Note: Strategies need onMessage handler (placeholder for future)

#### 6. Event System
Events emitted:
- `strategy:added/removed`: Registration changes
- `strategy:started/stopped/paused/resumed`: Lifecycle events
- `strategy:signal`: When strategy generates trading signal
- `strategy:trade`: When strategy's trade is executed
- `strategy:error`: Error handling
- `strategy:config-updated`: Configuration changes

### API Usage Example

```typescript
import { StrategyManager } from './strategy/StrategyManager';
import { SMAStrategy } from './strategy/SMAStrategy';

// Create manager
const manager = new StrategyManager({
  enableCommunication: false,
  enablePersistence: true,
  initialCash: 100000,
  enableLogging: true,
});

// Register strategies
await manager.registerStrategy(
  { id: 'sma-1', name: 'SMA Strategy 1', params: { shortPeriod: 5, longPeriod: 20 } },
  (config) => new SMAStrategy(config)
);

await manager.registerStrategy(
  { id: 'sma-2', name: 'SMA Strategy 2', params: { shortPeriod: 10, longPeriod: 50 } },
  (config) => new SMAStrategy(config)
);

// Start strategies
await manager.startStrategy('sma-1');
await manager.startStrategy('sma-2');

// Execute tick
const marketData = getMarketData();
const signals = await manager.executeTick(marketData);

// Get status
const status = manager.getStrategyStatus('sma-1');
console.log(status); // { id, name, isRunning, totalSignals, totalTrades, portfolioValue, cash }

// Shutdown
await manager.shutdown();
```

### Integration with TradingEngine

The TradingEngine can be updated to use StrategyManager:

```typescript
// In TradingEngine
private strategyManager: StrategyManager;

constructor(config: EngineConfig, ...) {
  this.strategyManager = new StrategyManager({
    initialCash: config.initialCash,
    enableLogging: config.enableLogging,
  });
}

// Replace addStrategy with:
async addStrategy(strategy: IStrategy): Promise<void> {
  await this.strategyManager.registerStrategy(
    strategy.getConfig(),
    () => strategy
  );
  await this.strategyManager.startStrategy(strategy.getConfig().id);
}

// Replace tick handling with:
private async handleMarketTick(tick: any): Promise<void> {
  const marketData = this.createMarketData(tick);
  const signals = await this.strategyManager.executeTick(marketData);
  
  // Process signals
  for (const [strategyId, signal] of signals) {
    if (signal) {
      this.executeSignal(signal, strategyId);
    }
  }
}
```

### Test Coverage

27 test cases covering:
- Strategy registration (3 tests)
- Lifecycle management (5 tests)
- Strategy execution (4 tests)
- Strategy isolation (3 tests)
- Configuration updates (2 tests)
- Status queries (3 tests)
- Event emission (3 tests)
- Shutdown (2 tests)
- Edge cases (2 tests)

### Files Created
- `src/strategy/StrategyManager.ts`: Main implementation (750+ lines)
- `src/strategy/index.ts`: Updated exports
- `tests/strategy/strategy-manager.test.ts`: Comprehensive tests

### Design Decisions

1. **Factory Pattern**: Strategies registered via factory function for flexibility
2. **Isolation**: Each strategy gets independent Portfolio and OrderBook
3. **Optional Persistence**: Database integration can be enabled/disabled
4. **Event-Driven**: All state changes emit events for monitoring
5. **Graceful Degradation**: Errors in one strategy don't affect others
6. **Type Safety**: Full TypeScript types for all interfaces

### Future Enhancements

1. **Worker Threads**: Use worker_threads for true isolation (CPU-intensive strategies)
2. **Strategy Templates**: Pre-built strategy templates for common patterns
3. **Performance Metrics**: Track latency, throughput per strategy
4. **Strategy Cloning**: Clone existing strategy with modified params
5. **Backtest Integration**: Run strategies in backtest mode
6. **Message Handlers**: Implement onMessage for inter-strategy communication

### Lessons Learned

1. Strategy isolation is critical for fair multi-strategy competition
2. Factory pattern provides flexibility for strategy instantiation
3. Event system enables external monitoring and debugging
4. Database persistence should be optional (not all deployments need it)
5. Inter-strategy communication is complex - keep it optional and simple

### Next Steps

1. Update TradingEngine to use StrategyManager (optional refactoring)
2. Add web UI for strategy management (Issue #17)
3. Implement leaderboard system (Issue #18)
4. Add LLM strategy support (Issue #19)
