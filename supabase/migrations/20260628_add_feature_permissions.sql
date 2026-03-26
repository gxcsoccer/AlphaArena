-- Feature Permissions Table
-- Defines which features require which plan level

CREATE TABLE IF NOT EXISTS feature_permissions (
  feature_key VARCHAR(100) PRIMARY KEY,
  required_plan VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (required_plan IN ('free', 'pro', 'enterprise')),
  description TEXT,
  category VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feature_permissions_required_plan ON feature_permissions(required_plan);
CREATE INDEX IF NOT EXISTS idx_feature_permissions_category ON feature_permissions(category);
CREATE INDEX IF NOT EXISTS idx_feature_permissions_is_active ON feature_permissions(is_active);

-- Row Level Security
ALTER TABLE feature_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Everyone can read active feature permissions
CREATE POLICY "feature_permissions_are_public" ON feature_permissions
  FOR SELECT
  USING (is_active = true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_feature_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_feature_permissions_updated_at
  BEFORE UPDATE ON feature_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_feature_permissions_updated_at();

-- Seed default feature permissions
INSERT INTO feature_permissions (feature_key, required_plan, description, category) VALUES
  -- Trading features
  ('basic_trading', 'free', 'Basic trading functionality', 'trading'),
  ('advanced_orders', 'pro', 'Advanced order types (OCO, conditional)', 'trading'),
  ('algorithmic_trading', 'enterprise', 'Algorithmic trading and automation', 'trading'),
  
  -- Data features
  ('basic_charts', 'free', 'Basic charting', 'data'),
  ('advanced_charts', 'pro', 'Advanced charting with indicators', 'data'),
  ('real_time_data', 'pro', 'Real-time market data', 'data'),
  ('historical_data_7d', 'free', '7 days historical data', 'data'),
  ('historical_data_30d', 'pro', '30 days historical data', 'data'),
  ('historical_data_unlimited', 'enterprise', 'Unlimited historical data', 'data'),
  
  -- Strategy features
  ('single_strategy', 'free', 'Create one trading strategy', 'strategy'),
  ('multiple_strategies', 'pro', 'Create multiple trading strategies', 'strategy'),
  ('backtesting', 'pro', 'Backtest trading strategies', 'strategy'),
  ('custom_strategies', 'enterprise', 'Create custom strategies', 'strategy'),
  
  -- API features
  ('api_basic', 'pro', 'Basic API access', 'api'),
  ('api_advanced', 'enterprise', 'Advanced API access', 'api'),
  ('webhooks', 'enterprise', 'Webhook notifications', 'api'),
  
  -- Support features
  ('community_support', 'free', 'Community forum support', 'support'),
  ('email_support', 'pro', 'Email support', 'support'),
  ('priority_support', 'enterprise', 'Priority support', 'support'),
  
  -- Portfolio features
  ('portfolio_tracking', 'free', 'Basic portfolio tracking', 'portfolio'),
  ('portfolio_analytics', 'pro', 'Advanced portfolio analytics', 'portfolio'),
  ('tax_reporting', 'enterprise', 'Tax reporting tools', 'portfolio'),
  
  -- Alert features
  ('price_alerts', 'free', 'Basic price alerts', 'alerts'),
  ('advanced_alerts', 'pro', 'Advanced alert conditions', 'alerts'),
  ('custom_alerts', 'enterprise', 'Custom alert integrations', 'alerts')
ON CONFLICT (feature_key) DO NOTHING;