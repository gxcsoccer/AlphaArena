-- Create users table if not exists
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  avatar_url TEXT,
  bio TEXT,
  website_url TEXT,
  twitter_handle VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_public BOOLEAN DEFAULT true,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0
);

-- Create user_follows table if not exists
CREATE TABLE IF NOT EXISTS user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);

-- Create user_badges table if not exists
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_type VARCHAR(50) NOT NULL,
  badge_name VARCHAR(100) NOT NULL,
  badge_description TEXT,
  badge_icon TEXT,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Signal status enum
DO $$ BEGIN
  CREATE TYPE signal_status AS ENUM ('active', 'expired', 'cancelled', 'executed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Signal type enum
DO $$ BEGIN
  CREATE TYPE signal_type AS ENUM ('entry', 'stop_loss', 'take_profit', 'exit', 'update');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Subscription type enum
DO $$ BEGIN
  CREATE TYPE subscription_type AS ENUM ('user', 'strategy');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Trading Signals table
CREATE TABLE IF NOT EXISTS trading_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id UUID NOT NULL,
  strategy_id UUID,
  symbol VARCHAR(50) NOT NULL,
  side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
  signal_type signal_type NOT NULL DEFAULT 'entry',
  entry_price DECIMAL(20, 8),
  entry_price_range_low DECIMAL(20, 8),
  entry_price_range_high DECIMAL(20, 8),
  target_price DECIMAL(20, 8),
  stop_loss_price DECIMAL(20, 8),
  quantity DECIMAL(20, 8),
  title VARCHAR(255),
  description TEXT,
  analysis TEXT,
  risk_level VARCHAR(20) DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'very_high')),
  confidence_score DECIMAL(5, 2) CHECK (confidence_score >= 0 AND confidence_score <= 100),
  status signal_status NOT NULL DEFAULT 'active',
  expires_at TIMESTAMP WITH TIME ZONE,
  executed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  execution_price DECIMAL(20, 8),
  pnl DECIMAL(20, 8),
  pnl_percent DECIMAL(10, 4),
  views_count INTEGER DEFAULT 0,
  subscribers_notified INTEGER DEFAULT 0,
  executions_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Signal Subscriptions table
CREATE TABLE IF NOT EXISTS signal_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL,
  source_type subscription_type NOT NULL,
  source_id UUID NOT NULL,
  auto_execute BOOLEAN NOT NULL DEFAULT FALSE,
  copy_ratio DECIMAL(10, 4) DEFAULT 1.0,
  fixed_amount DECIMAL(20, 8),
  max_amount DECIMAL(20, 8),
  max_risk_per_trade DECIMAL(5, 2),
  allowed_symbols JSONB DEFAULT '[]',
  blocked_symbols JSONB DEFAULT '[]',
  notify_in_app BOOLEAN NOT NULL DEFAULT TRUE,
  notify_push BOOLEAN NOT NULL DEFAULT FALSE,
  notify_email BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  signals_received INTEGER DEFAULT 0,
  signals_executed INTEGER DEFAULT 0,
  total_pnl DECIMAL(20, 8) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(subscriber_id, source_type, source_id)
);

-- Signal Executions table
CREATE TABLE IF NOT EXISTS signal_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID NOT NULL REFERENCES trading_signals(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES signal_subscriptions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  execution_type VARCHAR(20) DEFAULT 'manual',
  quantity DECIMAL(20, 8) NOT NULL,
  price DECIMAL(20, 8) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'filled', 'partial', 'failed', 'cancelled')),
  pnl DECIMAL(20, 8),
  pnl_percent DECIMAL(10, 4),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Signal Publisher Stats table (materialized view for performance)
CREATE TABLE IF NOT EXISTS signal_publisher_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id UUID NOT NULL,
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'all_time')),
  period_start DATE,
  period_end DATE,
  total_signals INTEGER DEFAULT 0,
  active_signals INTEGER DEFAULT 0,
  executed_signals INTEGER DEFAULT 0,
  winning_signals INTEGER DEFAULT 0,
  losing_signals INTEGER DEFAULT 0,
  win_rate DECIMAL(5, 2),
  total_pnl DECIMAL(20, 8),
  avg_pnl_percent DECIMAL(10, 4),
  subscriber_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(publisher_id, period_type, period_start)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_trading_signals_publisher ON trading_signals(publisher_id);
CREATE INDEX IF NOT EXISTS idx_trading_signals_symbol ON trading_signals(symbol);
CREATE INDEX IF NOT EXISTS idx_trading_signals_status ON trading_signals(status);
CREATE INDEX IF NOT EXISTS idx_signal_subscriptions_subscriber ON signal_subscriptions(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_signal_executions_signal ON signal_executions(signal_id);
CREATE INDEX IF NOT EXISTS idx_signal_executions_user ON signal_executions(user_id);

-- Insert a test user
INSERT INTO users (username, display_name, bio, is_public)
VALUES ('admin', 'Admin User', 'System administrator', true)
ON CONFLICT (username) DO NOTHING;
