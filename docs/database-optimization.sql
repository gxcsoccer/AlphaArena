-- API Performance Optimization - Database Indexes
-- Run these migrations to improve query performance

-- ============================================
-- Trade queries optimization
-- ============================================

-- Index for filtering trades by strategy_id (used in leaderboard, portfolio calculations)
CREATE INDEX IF NOT EXISTS idx_trades_strategy_id ON trades(strategy_id);

-- Index for ordering trades by execution time (used in most trade queries)
CREATE INDEX IF NOT EXISTS idx_trades_executed_at ON trades(executed_at DESC);

-- Composite index for strategy + time range queries
CREATE INDEX IF NOT EXISTS idx_trades_strategy_executed 
ON trades(strategy_id, executed_at DESC);

-- Index for filtering trades by symbol
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);

-- Index for order_id lookups (used in trade matching)
CREATE INDEX IF NOT EXISTS idx_trades_order_id ON trades(order_id) 
WHERE order_id IS NOT NULL;

-- ============================================
-- Strategy queries optimization
-- ============================================

-- Index for filtering by status (active strategies)
CREATE INDEX IF NOT EXISTS idx_strategies_status ON strategies(status);

-- Index for ordering by creation time
CREATE INDEX IF NOT EXISTS idx_strategies_created_at ON strategies(created_at DESC);

-- ============================================
-- User queries optimization
-- ============================================

-- Index for username lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Index for filtering public profiles
CREATE INDEX IF NOT EXISTS idx_users_is_public ON users(is_public) 
WHERE is_public = true;

-- ============================================
-- Portfolio queries optimization
-- ============================================

-- Index for getting latest portfolio by strategy
CREATE INDEX IF NOT EXISTS idx_portfolios_strategy_created 
ON portfolios(strategy_id, created_at DESC);

-- ============================================
-- Social queries optimization
-- ============================================

-- Index for follower relationships
CREATE INDEX IF NOT EXISTS idx_user_follows_following_id ON user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id ON user_follows(follower_id);

-- Composite index for checking if user A follows user B
CREATE INDEX IF NOT EXISTS idx_user_follows_unique ON user_follows(follower_id, following_id);

-- Index for activity feed queries
CREATE INDEX IF NOT EXISTS idx_user_activities_user_created 
ON user_activities(user_id, created_at DESC);

-- Index for public activities
CREATE INDEX IF NOT EXISTS idx_user_activities_public 
ON user_activities(is_public, created_at DESC) 
WHERE is_public = true;

-- ============================================
-- Signal queries optimization
-- ============================================

-- Index for active signals
CREATE INDEX IF NOT EXISTS idx_trading_signals_status 
ON trading_signals(status, created_at DESC) 
WHERE status = 'active';

-- Index for signal subscriptions
CREATE INDEX IF NOT EXISTS idx_signal_subscriptions_user 
ON signal_subscriptions(user_id, signal_id);

-- ============================================
-- Conditional orders optimization
-- ============================================

-- Index for active conditional orders
CREATE INDEX IF NOT EXISTS idx_conditional_orders_active 
ON conditional_orders(status, symbol, trigger_price) 
WHERE status = 'active';

-- ============================================
-- Leaderboard cache table (for pre-computed rankings)
-- ============================================

CREATE TABLE IF NOT EXISTS leaderboard_cache (
  id SERIAL PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  rank INTEGER NOT NULL,
  metrics JSONB NOT NULL,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sort_by TEXT DEFAULT 'roi',
  UNIQUE(strategy_id, sort_by)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_rank 
ON leaderboard_cache(sort_by, rank);

CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_calculated 
ON leaderboard_cache(calculated_at DESC);

-- ============================================
-- Query performance monitoring view
-- ============================================

-- Note: This requires pg_stat_statements extension
-- Run: CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View for identifying slow queries (requires superuser)
-- CREATE OR REPLACE VIEW slow_queries AS
-- SELECT 
--   query,
--   calls,
--   total_exec_time,
--   mean_exec_time,
--   rows
-- FROM pg_stat_statements
-- ORDER BY mean_exec_time DESC
-- LIMIT 20;

-- ============================================
-- Maintenance
-- ============================================

-- Analyze tables after creating indexes
ANALYZE trades;
ANALYZE strategies;
ANALYZE users;
ANALYZE portfolios;
ANALYZE user_follows;
ANALYZE user_activities;
ANALYZE trading_signals;
ANALYZE conditional_orders;

-- ============================================
-- Notes
-- ============================================

/*
Performance recommendations:

1. Index Usage:
   - These indexes cover the most common query patterns
   - Monitor slow queries and add indexes as needed
   - Remove unused indexes to reduce write overhead

2. Query Optimization:
   - Use EXPLAIN ANALYZE to verify index usage
   - Avoid SELECT * - select only needed columns
   - Use LIMIT with OFFSET for pagination
   - Consider cursor-based pagination for large datasets

3. Connection Pooling:
   - Use connection pooling (PgBouncer or Supabase pooler)
   - Set appropriate pool size based on load

4. Caching Strategy:
   - Cache frequently accessed, rarely changing data
   - Use Redis for distributed caching
   - Set appropriate TTLs based on data freshness requirements

5. Monitoring:
   - Enable pg_stat_statements for query analysis
   - Monitor connection count and wait events
   - Set up alerts for slow queries
*/