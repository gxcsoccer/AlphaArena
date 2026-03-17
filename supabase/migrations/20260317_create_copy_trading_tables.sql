-- Followers table - Users who follow other traders
CREATE TABLE IF NOT EXISTS followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_user_id VARCHAR(255) NOT NULL,
  leader_user_id VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  
  -- Copy trading parameters
  copy_mode VARCHAR(20) DEFAULT 'proportional' CHECK (copy_mode IN ('proportional', 'fixed', 'mirror')),
  copy_ratio DECIMAL(10, 4) DEFAULT 1.0,
  fixed_amount DECIMAL(20, 8),
  max_copy_amount DECIMAL(20, 8),
  stop_loss_pct DECIMAL(5, 2),
  take_profit_pct DECIMAL(5, 2),
  
  -- Risk control settings
  max_daily_trades INTEGER DEFAULT 10,
  max_daily_volume DECIMAL(20, 8),
  allowed_symbols JSONB DEFAULT '[]',
  blocked_symbols JSONB DEFAULT '[]',
  
  -- Statistics
  total_copied_trades INTEGER DEFAULT 0,
  total_copied_volume DECIMAL(20, 8) DEFAULT 0,
  total_pnl DECIMAL(20, 8) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_follower_leader UNIQUE (follower_user_id, leader_user_id),
  CONSTRAINT no_self_follow CHECK (follower_user_id != leader_user_id)
);

-- Copy trades table - Records of copied trades
CREATE TABLE IF NOT EXISTS copy_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES followers(id) ON DELETE CASCADE,
  
  original_trade_id UUID,
  original_order_id VARCHAR(255),
  leader_user_id VARCHAR(255) NOT NULL,
  follower_user_id VARCHAR(255) NOT NULL,
  
  symbol VARCHAR(50) NOT NULL,
  side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
  original_quantity DECIMAL(20, 8) NOT NULL,
  copied_quantity DECIMAL(20, 8) NOT NULL,
  original_price DECIMAL(20, 8) NOT NULL,
  copied_price DECIMAL(20, 8),
  
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'executing', 'filled', 'partial', 'failed', 'cancelled')),
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  
  copied_order_id VARCHAR(255),
  copied_trade_id VARCHAR(255),
  fee DECIMAL(20, 8) DEFAULT 0,
  fee_currency VARCHAR(10),
  
  signal_received_at TIMESTAMP WITH TIME ZONE NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Follower stats table
CREATE TABLE IF NOT EXISTS follower_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES followers(id) ON DELETE CASCADE,
  
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'all_time')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  
  total_volume DECIMAL(20, 8) DEFAULT 0,
  total_pnl DECIMAL(20, 8) DEFAULT 0,
  total_fees DECIMAL(20, 8) DEFAULT 0,
  roi_pct DECIMAL(10, 4) DEFAULT 0,
  
  leader_pnl DECIMAL(20, 8) DEFAULT 0,
  leader_roi_pct DECIMAL(10, 4) DEFAULT 0,
  correlation DECIMAL(5, 4),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_follower_period UNIQUE (follower_id, period_type, period_start)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_followers_follower_user ON followers(follower_user_id);
CREATE INDEX IF NOT EXISTS idx_followers_leader_user ON followers(leader_user_id);
CREATE INDEX IF NOT EXISTS idx_followers_status ON followers(status);

CREATE INDEX IF NOT EXISTS idx_copy_trades_follower ON copy_trades(follower_id);
CREATE INDEX IF NOT EXISTS idx_copy_trades_follower_user ON copy_trades(follower_user_id);
CREATE INDEX IF NOT EXISTS idx_copy_trades_leader_user ON copy_trades(leader_user_id);
CREATE INDEX IF NOT EXISTS idx_copy_trades_symbol ON copy_trades(symbol);
CREATE INDEX IF NOT EXISTS idx_copy_trades_status ON copy_trades(status);

CREATE INDEX IF NOT EXISTS idx_follower_stats_follower ON follower_stats(follower_id);
CREATE INDEX IF NOT EXISTS idx_follower_stats_period ON follower_stats(period_start, period_end);

-- Update trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_followers_updated_at
    BEFORE UPDATE ON followers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
