-- Leaderboard Snapshots table - 排行榜快照
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  total_strategies INTEGER NOT NULL DEFAULT 0,
  total_trades INTEGER NOT NULL DEFAULT 0,
  total_volume DECIMAL(20, 8) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leaderboard Entries table - 排行榜条目
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID REFERENCES leaderboard_snapshots(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES strategies(id),
  rank INTEGER NOT NULL,
  rank_change INTEGER NOT NULL DEFAULT 0,
  total_trades INTEGER NOT NULL DEFAULT 0,
  total_volume DECIMAL(20, 8) NOT NULL DEFAULT 0,
  total_pnl DECIMAL(20, 8) NOT NULL DEFAULT 0,
  roi DECIMAL(10, 4) NOT NULL DEFAULT 0,
  win_rate DECIMAL(10, 4) NOT NULL DEFAULT 0,
  sharpe_ratio DECIMAL(10, 4) NOT NULL DEFAULT 0,
  max_drawdown DECIMAL(10, 4) NOT NULL DEFAULT 0,
  avg_trade_size DECIMAL(20, 8) NOT NULL DEFAULT 0,
  profitable_trades INTEGER NOT NULL DEFAULT 0,
  losing_trades INTEGER NOT NULL DEFAULT 0,
  consecutive_wins INTEGER NOT NULL DEFAULT 0,
  consecutive_losses INTEGER NOT NULL DEFAULT 0,
  best_trade DECIMAL(20, 8) NOT NULL DEFAULT 0,
  worst_trade DECIMAL(20, 8) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_timestamp ON leaderboard_snapshots(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_snapshot_id ON leaderboard_entries(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_strategy_id ON leaderboard_entries(strategy_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_rank ON leaderboard_entries(rank);

-- Comment on tables
COMMENT ON TABLE leaderboard_snapshots IS 'Stores historical leaderboard snapshots for trend analysis';
COMMENT ON TABLE leaderboard_entries IS 'Individual strategy entries in leaderboard snapshots';
