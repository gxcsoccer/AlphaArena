-- Strategy Marketplace Tables Migration
-- Creates tables for strategy sharing, subscription, and creator ecosystem

-- Marketplace Strategies Table
-- Published strategies that users can subscribe to
CREATE TABLE IF NOT EXISTS marketplace_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  strategy_type VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  symbols TEXT[] NOT NULL DEFAULT '{}',
  config JSONB NOT NULL DEFAULT '{}',
  risk_params JSONB NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  
  -- Visibility and status
  visibility VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'unlisted')),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'delisted')),
  
  -- Performance metrics (updated periodically)
  performance_metrics JSONB NOT NULL DEFAULT '{
    "totalReturn": null,
    "annualizedReturn": null,
    "sharpeRatio": null,
    "maxDrawdown": null,
    "winRate": null,
    "profitFactor": null,
    "avgTradeDuration": null,
    "totalTrades": null
  }'::jsonb,
  
  -- Backtest info
  backtest_period JSONB,
  backtest_stats JSONB,
  
  -- Pricing
  subscription_fee DECIMAL(18, 2) NOT NULL DEFAULT 0,
  fee_currency VARCHAR(10) NOT NULL DEFAULT 'USDT',
  revenue_share_percent DECIMAL(5, 2) NOT NULL DEFAULT 70.00, -- Publisher gets 70%
  
  -- Stats
  subscriber_count INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  rating_avg DECIMAL(3, 2) NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  signal_count INTEGER NOT NULL DEFAULT 0,
  
  -- Featured/verified flags
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_subscription_fee CHECK (subscription_fee >= 0),
  CONSTRAINT valid_revenue_share CHECK (revenue_share_percent >= 0 AND revenue_share_percent <= 100)
);

-- Strategy Subscriptions Table
-- Users subscribing to published strategies
CREATE TABLE IF NOT EXISTS strategy_marketplace_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id TEXT NOT NULL,
  strategy_id UUID NOT NULL REFERENCES marketplace_strategies(id) ON DELETE CASCADE,
  
  -- Subscription settings
  auto_execute BOOLEAN NOT NULL DEFAULT false,
  copy_ratio DECIMAL(10, 4) NOT NULL DEFAULT 1.0,
  fixed_amount DECIMAL(18, 2),
  max_risk_per_trade DECIMAL(18, 2),
  
  -- Symbol filters
  allowed_symbols TEXT[] NOT NULL DEFAULT '{}',
  blocked_symbols TEXT[] NOT NULL DEFAULT '{}',
  
  -- Notifications
  notify_signal BOOLEAN NOT NULL DEFAULT true,
  notify_execution BOOLEAN NOT NULL DEFAULT true,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
  
  -- Subscription period
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Stats
  signals_received INTEGER NOT NULL DEFAULT 0,
  signals_executed INTEGER NOT NULL DEFAULT 0,
  total_pnl DECIMAL(18, 2) NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint
  UNIQUE(subscriber_id, strategy_id)
);

-- Strategy Reviews Table
-- User reviews and ratings for strategies
CREATE TABLE IF NOT EXISTS strategy_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL REFERENCES marketplace_strategies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  content TEXT,
  
  -- Verification
  is_verified_subscriber BOOLEAN NOT NULL DEFAULT false,
  
  -- Moderation
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'deleted')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One review per user per strategy
  UNIQUE(strategy_id, user_id)
);

-- Strategy Publisher Stats Table
-- Aggregated stats for strategy publishers
CREATE TABLE IF NOT EXISTS strategy_publisher_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id TEXT NOT NULL UNIQUE,
  
  -- Strategy counts
  total_strategies INTEGER NOT NULL DEFAULT 0,
  active_strategies INTEGER NOT NULL DEFAULT 0,
  featured_strategies INTEGER NOT NULL DEFAULT 0,
  
  -- Subscriber stats
  total_subscribers INTEGER NOT NULL DEFAULT 0,
  active_subscribers INTEGER NOT NULL DEFAULT 0,
  
  -- Performance stats
  avg_rating DECIMAL(3, 2) NOT NULL DEFAULT 0,
  total_reviews INTEGER NOT NULL DEFAULT 0,
  
  -- Revenue stats
  total_revenue DECIMAL(18, 2) NOT NULL DEFAULT 0,
  withdrawn_revenue DECIMAL(18, 2) NOT NULL DEFAULT 0,
  pending_revenue DECIMAL(18, 2) NOT NULL DEFAULT 0,
  
  -- Signal stats
  total_signals_sent INTEGER NOT NULL DEFAULT 0,
  total_signals_executed INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Strategy Signals Table (for marketplace strategies)
-- Real-time signals from published strategies
CREATE TABLE IF NOT EXISTS marketplace_strategy_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL REFERENCES marketplace_strategies(id) ON DELETE CASCADE,
  publisher_id TEXT NOT NULL,
  
  -- Signal details
  symbol TEXT NOT NULL,
  side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
  signal_type VARCHAR(20) NOT NULL DEFAULT 'entry' CHECK (signal_type IN ('entry', 'exit', 'stop_loss', 'take_profit', 'update')),
  
  -- Prices
  entry_price DECIMAL(18, 4),
  target_price DECIMAL(18, 4),
  stop_loss DECIMAL(18, 4),
  
  -- Quantity and risk
  quantity DECIMAL(18, 4),
  risk_percent DECIMAL(5, 2),
  
  -- Analysis
  title TEXT,
  description TEXT,
  analysis TEXT,
  
  -- Metadata
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  risk_level VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'very_high')),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'executed', 'cancelled', 'expired')),
  
  -- Execution tracking
  executed_at TIMESTAMPTZ,
  execution_price DECIMAL(18, 4),
  pnl DECIMAL(18, 2),
  
  -- Stats
  subscribers_notified INTEGER NOT NULL DEFAULT 0,
  executions_count INTEGER NOT NULL DEFAULT 0,
  
  -- Expiry
  expires_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Revenue Transactions Table
-- Track revenue sharing for strategy subscriptions
CREATE TABLE IF NOT EXISTS strategy_revenue_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL REFERENCES marketplace_strategies(id) ON DELETE CASCADE,
  publisher_id TEXT NOT NULL,
  subscriber_id TEXT NOT NULL,
  subscription_id UUID NOT NULL REFERENCES strategy_marketplace_subscriptions(id) ON DELETE CASCADE,
  
  -- Transaction details
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('subscription_fee', 'performance_fee', 'withdrawal', 'refund')),
  gross_amount DECIMAL(18, 2) NOT NULL,
  platform_fee DECIMAL(18, 2) NOT NULL DEFAULT 0,
  publisher_amount DECIMAL(18, 2) NOT NULL,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  
  -- Payment info
  payment_method VARCHAR(50),
  payment_reference TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_marketplace_strategies_publisher ON marketplace_strategies(publisher_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_strategies_status ON marketplace_strategies(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_strategies_category ON marketplace_strategies(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_strategies_featured ON marketplace_strategies(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_marketplace_strategies_rating ON marketplace_strategies(rating_avg DESC);

CREATE INDEX IF NOT EXISTS idx_strategy_subscriptions_subscriber ON strategy_marketplace_subscriptions(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_strategy_subscriptions_strategy ON strategy_marketplace_subscriptions(strategy_id);
CREATE INDEX IF NOT EXISTS idx_strategy_subscriptions_status ON strategy_marketplace_subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_strategy_reviews_strategy ON strategy_reviews(strategy_id);
CREATE INDEX IF NOT EXISTS idx_strategy_reviews_user ON strategy_reviews(user_id);

CREATE INDEX IF NOT EXISTS idx_marketplace_signals_strategy ON marketplace_strategy_signals(strategy_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_signals_status ON marketplace_strategy_signals(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_signals_created ON marketplace_strategy_signals(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_revenue_transactions_publisher ON strategy_revenue_transactions(publisher_id);
CREATE INDEX IF NOT EXISTS idx_revenue_transactions_strategy ON strategy_revenue_transactions(strategy_id);

-- Row Level Security
ALTER TABLE marketplace_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_marketplace_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_publisher_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_strategy_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_revenue_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for marketplace_strategies
CREATE POLICY "Public strategies are viewable by everyone" ON marketplace_strategies
  FOR SELECT USING (visibility = 'public' AND status = 'approved');

CREATE POLICY "Publishers can view their own strategies" ON marketplace_strategies
  FOR SELECT USING (publisher_id = auth.uid()::text);

CREATE POLICY "Publishers can insert their own strategies" ON marketplace_strategies
  FOR INSERT WITH CHECK (publisher_id = auth.uid()::text);

CREATE POLICY "Publishers can update their own strategies" ON marketplace_strategies
  FOR UPDATE USING (publisher_id = auth.uid()::text);

-- RLS Policies for strategy_marketplace_subscriptions
CREATE POLICY "Users can view their own subscriptions" ON strategy_marketplace_subscriptions
  FOR SELECT USING (subscriber_id = auth.uid()::text);

CREATE POLICY "Users can insert their own subscriptions" ON strategy_marketplace_subscriptions
  FOR INSERT WITH CHECK (subscriber_id = auth.uid()::text);

CREATE POLICY "Users can update their own subscriptions" ON strategy_marketplace_subscriptions
  FOR UPDATE USING (subscriber_id = auth.uid()::text);

-- RLS Policies for strategy_reviews
CREATE POLICY "Reviews are viewable by everyone" ON strategy_reviews
  FOR SELECT USING (status = 'active');

CREATE POLICY "Users can insert their own reviews" ON strategy_reviews
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own reviews" ON strategy_reviews
  FOR UPDATE USING (user_id = auth.uid()::text);

-- RLS Policies for strategy_publisher_stats
CREATE POLICY "Publisher stats are viewable by everyone" ON strategy_publisher_stats
  FOR SELECT USING (true);

CREATE POLICY "Publishers can view their own stats" ON strategy_publisher_stats
  FOR SELECT USING (publisher_id = auth.uid()::text);

-- RLS Policies for marketplace_strategy_signals
CREATE POLICY "Signals from public strategies are viewable by subscribers" ON marketplace_strategy_signals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM marketplace_strategies 
      WHERE marketplace_strategies.id = marketplace_strategy_signals.strategy_id 
      AND marketplace_strategies.visibility = 'public'
    )
  );

CREATE POLICY "Publishers can view their own signals" ON marketplace_strategy_signals
  FOR SELECT USING (publisher_id = auth.uid()::text);

CREATE POLICY "Publishers can insert their own signals" ON marketplace_strategy_signals
  FOR INSERT WITH CHECK (publisher_id = auth.uid()::text);

CREATE POLICY "Publishers can update their own signals" ON marketplace_strategy_signals
  FOR UPDATE USING (publisher_id = auth.uid()::text);

-- RLS Policies for strategy_revenue_transactions
CREATE POLICY "Users can view their own revenue transactions" ON strategy_revenue_transactions
  FOR SELECT USING (publisher_id = auth.uid()::text OR subscriber_id = auth.uid()::text);

-- Functions for atomic counter updates
CREATE OR REPLACE FUNCTION increment_strategy_subscribers(strategy_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE marketplace_strategies 
  SET subscriber_count = subscriber_count + 1,
      updated_at = NOW()
  WHERE id = strategy_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_strategy_subscribers(strategy_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE marketplace_strategies 
  SET subscriber_count = GREATEST(subscriber_count - 1, 0),
      updated_at = NOW()
  WHERE id = strategy_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_strategy_views(strategy_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE marketplace_strategies 
  SET view_count = view_count + 1
  WHERE id = strategy_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_strategy_rating(strategy_uuid UUID)
RETURNS void AS $$
DECLARE
  avg_rating DECIMAL(3, 2);
  review_count INTEGER;
BEGIN
  SELECT AVG(rating)::DECIMAL(3, 2), COUNT(*)::INTEGER
  INTO avg_rating, review_count
  FROM strategy_reviews
  WHERE strategy_id = strategy_uuid AND status = 'active';
  
  UPDATE marketplace_strategies
  SET rating_avg = COALESCE(avg_rating, 0),
      rating_count = COALESCE(review_count, 0),
      updated_at = NOW()
  WHERE id = strategy_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_subscription_signal_received(sub_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE strategy_marketplace_subscriptions
  SET signals_received = signals_received + 1,
      updated_at = NOW()
  WHERE id = sub_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_subscription_signal_executed(sub_uuid UUID, pnl_value DECIMAL(18, 2))
RETURNS void AS $$
BEGIN
  UPDATE strategy_marketplace_subscriptions
  SET signals_executed = signals_executed + 1,
      total_pnl = total_pnl + pnl_value,
      updated_at = NOW()
  WHERE id = sub_uuid;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS update_marketplace_strategies_updated_at ON marketplace_strategies;
CREATE TRIGGER update_marketplace_strategies_updated_at
  BEFORE UPDATE ON marketplace_strategies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_strategy_subscriptions_updated_at ON strategy_marketplace_subscriptions;
CREATE TRIGGER update_strategy_subscriptions_updated_at
  BEFORE UPDATE ON strategy_marketplace_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_strategy_reviews_updated_at ON strategy_reviews;
CREATE TRIGGER update_strategy_reviews_updated_at
  BEFORE UPDATE ON strategy_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_publisher_stats_updated_at ON strategy_publisher_stats;
CREATE TRIGGER update_publisher_stats_updated_at
  BEFORE UPDATE ON strategy_publisher_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_marketplace_signals_updated_at ON marketplace_strategy_signals;
CREATE TRIGGER update_marketplace_signals_updated_at
  BEFORE UPDATE ON marketplace_strategy_signals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update strategy rating when reviews change
DROP TRIGGER IF EXISTS update_rating_on_review ON strategy_reviews;
CREATE TRIGGER update_rating_on_review
  AFTER INSERT OR UPDATE OR DELETE ON strategy_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_strategy_rating_on_review();

CREATE OR REPLACE FUNCTION update_strategy_rating_on_review()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM update_strategy_rating(NEW.strategy_id);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM update_strategy_rating(NEW.strategy_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM update_strategy_rating(OLD.strategy_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;