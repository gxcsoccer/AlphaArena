-- Strategy Portfolio Enhancement Migration
-- Adds support for templates, sharing, and enhanced features

-- Portfolio Templates Table
CREATE TABLE IF NOT EXISTS portfolio_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('conservative', 'balanced', 'aggressive', 'custom')),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  target_return NUMERIC DEFAULT 10,
  allocations JSONB NOT NULL DEFAULT '[]',
  rebalance_config JSONB DEFAULT '{}',
  risk_control_config JSONB DEFAULT '{}',
  signal_aggregation_config JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  rating NUMERIC DEFAULT 0,
  created_by TEXT NOT NULL,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_portfolio_templates_category ON portfolio_templates(category);
CREATE INDEX idx_portfolio_templates_risk_level ON portfolio_templates(risk_level);
CREATE INDEX idx_portfolio_templates_public ON portfolio_templates(is_public) WHERE is_public = true;
CREATE INDEX idx_portfolio_templates_created_by ON portfolio_templates(created_by);

-- Template Ratings Table
CREATE TABLE IF NOT EXISTS template_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT NOT NULL REFERENCES portfolio_templates(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, user_id)
);

CREATE INDEX idx_template_ratings_template ON template_ratings(template_id);

-- Shared Portfolios Table
CREATE TABLE IF NOT EXISTS shared_portfolios (
  id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES strategy_portfolios(id) ON DELETE CASCADE,
  share_code TEXT UNIQUE NOT NULL,
  owner_user_id TEXT NOT NULL,
  shared_with JSONB DEFAULT '[]',
  is_public BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  view_count INTEGER DEFAULT 0,
  copy_count INTEGER DEFAULT 0
);

CREATE INDEX idx_shared_portfolios_code ON shared_portfolios(share_code);
CREATE INDEX idx_shared_portfolios_portfolio ON shared_portfolios(portfolio_id);
CREATE INDEX idx_shared_portfolios_owner ON shared_portfolios(owner_user_id);

-- Portfolio Signals Table (for tracking and aggregation)
CREATE TABLE IF NOT EXISTS portfolio_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id TEXT NOT NULL REFERENCES strategy_portfolios(id) ON DELETE CASCADE,
  strategy_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell', 'hold')),
  confidence NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  quantity NUMERIC,
  price NUMERIC,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_portfolio_signals_portfolio ON portfolio_signals(portfolio_id);
CREATE INDEX idx_portfolio_signals_created ON portfolio_signals(created_at DESC);

-- Strategy Correlations Table
CREATE TABLE IF NOT EXISTS strategy_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id TEXT NOT NULL REFERENCES strategy_portfolios(id) ON DELETE CASCADE,
  strategy_id1 TEXT NOT NULL,
  strategy_id2 TEXT NOT NULL,
  correlation NUMERIC NOT NULL CHECK (correlation >= -1 AND correlation <= 1),
  period TEXT DEFAULT '30d',
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(portfolio_id, strategy_id1, strategy_id2, period)
);

CREATE INDEX idx_strategy_correlations_portfolio ON strategy_correlations(portfolio_id);

-- Portfolio Optimization Suggestions Table
CREATE TABLE IF NOT EXISTS portfolio_optimizations (
  id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES strategy_portfolios(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  title TEXT NOT NULL,
  description TEXT,
  impact JSONB DEFAULT '{}',
  actions JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  dismissed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ
);

CREATE INDEX idx_portfolio_optimizations_portfolio ON portfolio_optimizations(portfolio_id);
CREATE INDEX idx_portfolio_optimizations_status ON portfolio_optimizations(status);

-- Add aggregation config to strategy_portfolios
ALTER TABLE strategy_portfolios 
ADD COLUMN IF NOT EXISTS signal_aggregation_config JSONB DEFAULT '{}';

ALTER TABLE strategy_portfolios 
ADD COLUMN IF NOT EXISTS risk_control_config JSONB DEFAULT '{}';

-- Add template_id to strategy_portfolios for tracking template usage
ALTER TABLE strategy_portfolios 
ADD COLUMN IF NOT EXISTS template_id TEXT REFERENCES portfolio_templates(id);

-- Functions for incrementing counters
CREATE OR REPLACE FUNCTION increment_template_usage(template_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE portfolio_templates 
  SET usage_count = usage_count + 1 
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_share_view(share_code TEXT)
RETURNS void AS $$
BEGIN
  UPDATE shared_portfolios 
  SET view_count = view_count + 1 
  WHERE share_code = share_code;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_share_copy(share_code TEXT)
RETURNS void AS $$
BEGIN
  UPDATE shared_portfolios 
  SET copy_count = copy_count + 1 
  WHERE share_code = share_code;
END;
$$ LANGUAGE plpgsql;

-- Insert default system templates
INSERT INTO portfolio_templates (id, name, description, category, risk_level, target_return, allocations, tags, created_by, is_public)
VALUES 
  (
    'template_conservative',
    'Conservative Portfolio',
    'Low-risk portfolio focused on stable returns with minimal drawdown.',
    'conservative',
    'low',
    8,
    '[{"strategyType": "mean_reversion", "weight": 0.4}, {"strategyType": "arbitrage", "weight": 0.3}, {"strategyType": "trend_following", "weight": 0.2}, {"strategyType": "cash", "weight": 0.1}]',
    ARRAY['low-risk', 'stable', 'conservative'],
    'system',
    true
  ),
  (
    'template_balanced',
    'Balanced Portfolio',
    'Balanced approach combining growth and stability.',
    'balanced',
    'medium',
    15,
    '[{"strategyType": "momentum", "weight": 0.3}, {"strategyType": "mean_reversion", "weight": 0.25}, {"strategyType": "trend_following", "weight": 0.25}, {"strategyType": "arbitrage", "weight": 0.2}]',
    ARRAY['balanced', 'moderate', 'diversified'],
    'system',
    true
  ),
  (
    'template_aggressive',
    'Aggressive Growth Portfolio',
    'High-risk, high-reward portfolio for maximum returns.',
    'aggressive',
    'high',
    30,
    '[{"strategyType": "momentum", "weight": 0.35}, {"strategyType": "breakout", "weight": 0.25}, {"strategyType": "ml_based", "weight": 0.25}, {"strategyType": "trend_following", "weight": 0.15}]',
    ARRAY['high-risk', 'growth', 'aggressive'],
    'system',
    true
  ),
  (
    'template_ml_focused',
    'AI/ML Focused Portfolio',
    'Portfolio leveraging machine learning and AI-based strategies.',
    'custom',
    'medium',
    20,
    '[{"strategyType": "ml_based", "weight": 0.4}, {"strategyType": "reinforcement_learning", "weight": 0.3}, {"strategyType": "anomaly_detection", "weight": 0.2}, {"strategyType": "sentiment", "weight": 0.1}]',
    ARRAY['ai', 'machine-learning', 'advanced'],
    'system',
    true
  ),
  (
    'template_market_neutral',
    'Market Neutral Portfolio',
    'Market-neutral approach using long/short strategies.',
    'balanced',
    'low',
    12,
    '[{"strategyType": "long_short", "weight": 0.35}, {"strategyType": "pairs_trading", "weight": 0.3}, {"strategyType": "statistical_arbitrage", "weight": 0.25}, {"strategyType": "hedging", "weight": 0.1}]',
    ARRAY['market-neutral', 'hedging', 'low-volatility'],
    'system',
    true
  )
ON CONFLICT (id) DO NOTHING;