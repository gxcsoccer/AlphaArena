-- Trading Signals Tables
-- Stores trading signals, subscriptions, and related statistics

-- Signal status enum
CREATE TYPE signal_status AS ENUM ('active', 'expired', 'cancelled', 'executed');

-- Signal type enum
CREATE TYPE signal_type AS ENUM ('entry', 'stop_loss', 'take_profit', 'exit', 'update');

-- Subscription type enum
CREATE TYPE subscription_type AS ENUM ('user', 'strategy');

-- Trading Signals table
CREATE TABLE IF NOT EXISTS trading_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Signal source
  publisher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id UUID,
  
  -- Trading details
  symbol VARCHAR(50) NOT NULL,
  side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
  signal_type signal_type NOT NULL DEFAULT 'entry',
  
  -- Price and quantity
  entry_price DECIMAL(20, 8),
  entry_price_range_low DECIMAL(20, 8),
  entry_price_range_high DECIMAL(20, 8),
  target_price DECIMAL(20, 8),
  stop_loss_price DECIMAL(20, 8),
  quantity DECIMAL(20, 8),
  
  -- Signal metadata
  title VARCHAR(255),
  description TEXT,
  analysis TEXT,
  risk_level VARCHAR(20) DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'very_high')),
  confidence_score DECIMAL(5, 2) CHECK (confidence_score >= 0 AND confidence_score <= 100),
  
  -- Timing
  status signal_status NOT NULL DEFAULT 'active',
  expires_at TIMESTAMP WITH TIME ZONE,
  executed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  
  -- Results (filled after signal completes)
  execution_price DECIMAL(20, 8),
  pnl DECIMAL(20, 8),
  pnl_percent DECIMAL(10, 4),
  
  -- Statistics
  views_count INTEGER DEFAULT 0,
  subscribers_notified INTEGER DEFAULT 0,
  executions_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Signal Subscriptions table
CREATE TABLE IF NOT EXISTS signal_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Subscriber info
  subscriber_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Signal source (either a user or a strategy)
  source_type subscription_type NOT NULL,
  source_id UUID NOT NULL, -- user_id or strategy_id
  
  -- Subscription settings
  auto_execute BOOLEAN NOT NULL DEFAULT FALSE,
  copy_ratio DECIMAL(10, 4) DEFAULT 1.0,
  fixed_amount DECIMAL(20, 8),
  max_amount DECIMAL(20, 8),
  
  -- Risk control
  max_risk_per_trade DECIMAL(5, 2), -- percentage
  allowed_symbols JSONB DEFAULT '[]', -- empty means all symbols
  blocked_symbols JSONB DEFAULT '[]',
  
  -- Notification preferences
  notify_in_app BOOLEAN NOT NULL DEFAULT TRUE,
  notify_push BOOLEAN NOT NULL DEFAULT FALSE,
  notify_email BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  
  -- Statistics
  signals_received INTEGER DEFAULT 0,
  signals_executed INTEGER DEFAULT 0,
  total_pnl DECIMAL(20, 8) DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_subscription UNIQUE (subscriber_id, source_type, source_id),
  CONSTRAINT no_self_subscribe CHECK (
    source_type != 'user' OR subscriber_id != source_id
  )
);

-- Signal Executions table (tracks when subscribers execute a signal)
CREATE TABLE IF NOT EXISTS signal_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  signal_id UUID NOT NULL REFERENCES trading_signals(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES signal_subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Execution details
  execution_type VARCHAR(20) NOT NULL CHECK (execution_type IN ('manual', 'auto')),
  quantity DECIMAL(20, 8) NOT NULL,
  price DECIMAL(20, 8) NOT NULL,
  
  -- Results
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'filled', 'failed', 'cancelled')),
  order_id VARCHAR(255),
  trade_id VARCHAR(255),
  
  -- PnL (updated after trade closes)
  pnl DECIMAL(20, 8),
  pnl_percent DECIMAL(10, 4),
  closed_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Signal Publisher Stats table
CREATE TABLE IF NOT EXISTS signal_publisher_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Period
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'all_time')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Signal counts
  total_signals INTEGER DEFAULT 0,
  active_signals INTEGER DEFAULT 0,
  expired_signals INTEGER DEFAULT 0,
  executed_signals INTEGER DEFAULT 0,
  cancelled_signals INTEGER DEFAULT 0,
  
  -- Performance
  winning_signals INTEGER DEFAULT 0,
  losing_signals INTEGER DEFAULT 0,
  win_rate DECIMAL(5, 2) DEFAULT 0,
  avg_pnl_percent DECIMAL(10, 4) DEFAULT 0,
  total_pnl DECIMAL(20, 8) DEFAULT 0,
  
  -- Engagement
  total_views INTEGER DEFAULT 0,
  total_executions INTEGER DEFAULT 0,
  subscriber_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_publisher_period UNIQUE (publisher_id, period_type, period_start)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trading_signals_publisher ON trading_signals(publisher_id);
CREATE INDEX IF NOT EXISTS idx_trading_signals_strategy ON trading_signals(strategy_id);
CREATE INDEX IF NOT EXISTS idx_trading_signals_symbol ON trading_signals(symbol);
CREATE INDEX IF NOT EXISTS idx_trading_signals_status ON trading_signals(status);
CREATE INDEX IF NOT EXISTS idx_trading_signals_type ON trading_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_trading_signals_created_at ON trading_signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trading_signals_expires_at ON trading_signals(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_signal_subscriptions_subscriber ON signal_subscriptions(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_signal_subscriptions_source ON signal_subscriptions(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_signal_subscriptions_status ON signal_subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_signal_executions_signal ON signal_executions(signal_id);
CREATE INDEX IF NOT EXISTS idx_signal_executions_user ON signal_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_signal_executions_status ON signal_executions(status);

CREATE INDEX IF NOT EXISTS idx_signal_publisher_stats_publisher ON signal_publisher_stats(publisher_id);
CREATE INDEX IF NOT EXISTS idx_signal_publisher_stats_period ON signal_publisher_stats(period_start, period_end);

-- Enable RLS
ALTER TABLE trading_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_publisher_stats ENABLE ROW LEVEL SECURITY;

-- Policies for trading_signals
CREATE POLICY "Users can view all active signals" ON trading_signals
  FOR SELECT
  USING (status = 'active');

CREATE POLICY "Publishers can view own signals" ON trading_signals
  FOR SELECT
  USING (auth.uid() = publisher_id);

CREATE POLICY "Publishers can create signals" ON trading_signals
  FOR INSERT
  WITH CHECK (auth.uid() = publisher_id);

CREATE POLICY "Publishers can update own signals" ON trading_signals
  FOR UPDATE
  USING (auth.uid() = publisher_id);

CREATE POLICY "Publishers can delete own signals" ON trading_signals
  FOR DELETE
  USING (auth.uid() = publisher_id);

-- Policies for signal_subscriptions
CREATE POLICY "Users can view own subscriptions" ON signal_subscriptions
  FOR SELECT
  USING (auth.uid() = subscriber_id);

CREATE POLICY "Users can create own subscriptions" ON signal_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = subscriber_id);

CREATE POLICY "Users can update own subscriptions" ON signal_subscriptions
  FOR UPDATE
  USING (auth.uid() = subscriber_id);

CREATE POLICY "Users can delete own subscriptions" ON signal_subscriptions
  FOR DELETE
  USING (auth.uid() = subscriber_id);

-- Policies for signal_executions
CREATE POLICY "Users can view own executions" ON signal_executions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own executions" ON signal_executions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own executions" ON signal_executions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policies for signal_publisher_stats
CREATE POLICY "Users can view publisher stats" ON signal_publisher_stats
  FOR SELECT
  USING (true);

CREATE POLICY "System can manage publisher stats" ON signal_publisher_stats
  FOR ALL
  USING (true);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_trading_signals_updated_at ON trading_signals;
CREATE TRIGGER update_trading_signals_updated_at
  BEFORE UPDATE ON trading_signals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_signal_subscriptions_updated_at ON signal_subscriptions;
CREATE TRIGGER update_signal_subscriptions_updated_at
  BEFORE UPDATE ON signal_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_signal_executions_updated_at ON signal_executions;
CREATE TRIGGER update_signal_executions_updated_at
  BEFORE UPDATE ON signal_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE trading_signals IS 'Trading signals published by users for subscribers';
COMMENT ON TABLE signal_subscriptions IS 'User subscriptions to signal sources (users or strategies)';
COMMENT ON TABLE signal_executions IS 'Records of when subscribers execute trading signals';
COMMENT ON TABLE signal_publisher_stats IS 'Statistics for signal publishers';