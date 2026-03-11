# Leaderboard System Implementation

## Overview
Implemented a comprehensive leaderboard system for ranking AI trading strategies in AlphaArena.

## Architecture

### Backend Components

#### 1. LeaderboardService (`src/strategy/LeaderboardService.ts`)
Core calculation engine that computes strategy metrics:
- **ROI** (Return on Investment): `(totalPnL / totalCost) * 100`
- **Sharpe Ratio**: Risk-adjusted return, annualized `(avg / stdDev) * sqrt(252)`
- **Maximum Drawdown**: Largest peak-to-trough decline percentage
- **Win Rate**: Percentage of profitable trades
- **Additional Metrics**: Total P&L, Volume, Avg Trade Size, Consecutive Wins/Losses

Key methods:
- `calculateStrategyMetrics(strategyId)`: Calculate all metrics for a strategy
- `calculateLeaderboard(sortBy)`: Calculate and sort full leaderboard
- `createSnapshot()`: Create historical snapshot
- Events: `leaderboard:updated`, `leaderboard:snapshot`

#### 2. LeaderboardDAO (`src/database/leaderboard.dao.ts`)
Database access layer for leaderboard persistence:
- `saveSnapshot(snapshot)`: Save leaderboard snapshot
- `getLatestSnapshot()`: Get most recent snapshot
- `getStrategyHistory(strategyId)`: Get ranking history for a strategy
- `deleteOldSnapshots(daysToKeep)`: Cleanup old data

#### 3. API Endpoints (`src/api/server.ts`)
- `GET /api/leaderboard?sortBy=roi|sharpeRatio|maxDrawdown|totalPnL|winRate|totalVolume`
- `GET /api/leaderboard/:strategyId`
- `POST /api/leaderboard/refresh?sortBy=...`
- `GET /api/leaderboard/snapshot`

WebSocket event: `leaderboard:update`

### Frontend Components

#### 1. LeaderboardPage (`src/client/pages/LeaderboardPage.tsx`)
Enhanced leaderboard UI with:
- Auto-refresh every 60 seconds
- Sort dropdown (6 criteria)
- Rank change indicators (📈/📉)
- Summary statistics cards (6 metrics)
- Three chart types:
  - Bar chart: Top 10 by ROI
  - Radar chart: Top 5 performance comparison
  - Area chart: ROI vs P&L comparison
- Detailed table with 10 columns
- Tooltips for complex metrics

#### 2. API Client (`src/client/utils/api.ts`)
Added TypeScript interfaces and API methods:
- `StrategyMetrics`: All performance metrics
- `LeaderboardEntry`: Ranking entry with rank change
- `LeaderboardSnapshot`: Historical snapshot
- API methods: `getLeaderboard()`, `getStrategyRank()`, `refreshLeaderboard()`, `getLeaderboardSnapshot()`

### Database Schema

#### leaderboard_snapshots
```sql
- id: UUID
- timestamp: TIMESTAMP
- total_strategies: INTEGER
- total_trades: INTEGER
- total_volume: DECIMAL
- created_at: TIMESTAMP
```

#### leaderboard_entries
```sql
- id: UUID
- snapshot_id: UUID (FK)
- strategy_id: UUID (FK)
- rank: INTEGER
- rank_change: INTEGER
- total_trades: INTEGER
- total_volume: DECIMAL
- total_pnl: DECIMAL
- roi: DECIMAL
- win_rate: DECIMAL
- sharpe_ratio: DECIMAL
- max_drawdown: DECIMAL
- avg_trade_size: DECIMAL
- profitable_trades: INTEGER
- losing_trades: INTEGER
- consecutive_wins: INTEGER
- consecutive_losses: INTEGER
- best_trade: DECIMAL
- worst_trade: DECIMAL
- created_at: TIMESTAMP
```

## Usage

### Calculate Leaderboard
```typescript
const leaderboardService = new LeaderboardService();
const entries = await leaderboardService.calculateLeaderboard('roi');
```

### Listen for Updates
```typescript
leaderboardService.on('leaderboard:updated', (entries) => {
  console.log('Leaderboard updated:', entries);
});
```

### Create Snapshot
```typescript
const snapshot = await leaderboardService.createSnapshot();
await leaderboardDAO.saveSnapshot(snapshot);
```

### Frontend Auto-refresh
```typescript
useEffect(() => {
  fetchLeaderboard();
  const interval = setInterval(fetchLeaderboard, 60000); // 1 minute
  return () => clearInterval(interval);
}, [sortBy]);
```

## Testing

Unit tests cover:
- Sharpe Ratio calculation
- Maximum Drawdown calculation
- Consecutive wins/losses counting
- Snapshot creation
- Event emission

Run tests: `npm test -- LeaderboardService.test.ts`

## Future Improvements
1. Add time-period filtering (daily/weekly/monthly rankings)
2. Implement leaderboard caching with Redis
3. Add email notifications for rank changes
4. Create strategy comparison view
5. Add more advanced metrics (Sortino ratio, Calmar ratio)
6. Implement real-time WebSocket updates on every trade

## Files Modified/Created
- `src/strategy/LeaderboardService.ts` (new)
- `src/database/leaderboard.dao.ts` (new)
- `src/api/server.ts` (modified)
- `src/client/pages/LeaderboardPage.tsx` (modified)
- `src/client/utils/api.ts` (modified)
- `src/strategy/index.ts` (modified)
- `src/database/index.ts` (modified)
- `supabase/migrations/20260311_create_leaderboard_snapshots.sql` (new)
- `tests/strategy/LeaderboardService.test.ts` (new)

## Related Issues
- #18: 排行榜系统 - 多 AI 策略对战
- #13: 数据持久化 (dependency)
- #16: 多策略管理 (dependency)
