-- VIP Subscription System
-- Implements subscription tiers, feature permissions, and subscription history

-- ============================================================================
-- ENUMS AND TYPES
-- ============================================================================

-- Subscription plan types
CREATE TYPE subscription_plan AS ENUM ('free', 'pro', 'enterprise');

-- Subscription status types
CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'expired', 'pending', 'past_due');

-- Subscription action types for history
CREATE TYPE subscription_action AS ENUM ('created', 'upgraded', 'downgraded', 'canceled', 'renewed', 'reactivated', 'expired');

-- ============================================================================
-- TABLES
-- ============================================================================

-- Subscription Plans Configuration
-- Stores plan features and pricing
CREATE TABLE IF NOT EXISTS subscription_plans (
  plan subscription_plan PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  price_monthly DECIMAL(10, 2) NOT NULL DEFAULT 0,
  price_yearly DECIMAL(10, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  features JSONB NOT NULL DEFAULT '{}',
  limits JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User Subscriptions
-- Tracks user subscription status and billing
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan subscription_plan NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'active',
  
  -- Stripe integration
  stripe_subscription_id VARCHAR(100) UNIQUE,
  stripe_customer_id VARCHAR(100),
  
  -- Billing period
  billing_period VARCHAR(20), -- 'monthly', 'yearly'
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  
  -- Trial
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_period CHECK (
    current_period_end IS NULL OR 
    current_period_start IS NULL OR 
    current_period_end > current_period_start
  )
);

-- Subscription History
-- Tracks all subscription changes
CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action subscription_action NOT NULL,
  from_plan subscription_plan,
  to_plan subscription_plan NOT NULL,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feature Permissions
-- Defines which features require which plan level
CREATE TABLE IF NOT EXISTS feature_permissions (
  feature_key VARCHAR(100) PRIMARY KEY,
  required_plan subscription_plan NOT NULL,
  description TEXT,
  category VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feature Usage Tracking (for limits)
CREATE TABLE IF NOT EXISTS feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  feature_key VARCHAR(100) NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One record per user per feature per period
  UNIQUE (user_id, feature_key, period_start)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- User subscriptions indexes
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_stripe_subscription_id ON user_subscriptions(stripe_subscription_id);
CREATE INDEX idx_user_subscriptions_stripe_customer_id ON user_subscriptions(stripe_customer_id);
CREATE INDEX idx_user_subscriptions_current_period_end ON user_subscriptions(current_period_end);

-- Subscription history indexes
CREATE INDEX idx_subscription_history_user_id ON subscription_history(user_id);
CREATE INDEX idx_subscription_history_created_at ON subscription_history(created_at DESC);
CREATE INDEX idx_subscription_history_action ON subscription_history(action);

-- Feature usage indexes
CREATE INDEX idx_feature_usage_user_id ON feature_usage(user_id);
CREATE INDEX idx_feature_usage_feature_key ON feature_usage(feature_key);
CREATE INDEX idx_feature_usage_period ON feature_usage(period_start, period_end);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_usage ENABLE ROW LEVEL SECURITY;

-- Subscription Plans - readable by all authenticated users
CREATE POLICY "Subscription plans are viewable by all"
  ON subscription_plans FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Service role can manage subscription plans"
  ON subscription_plans FOR ALL
  USING (auth.role() = 'service_role');

-- User Subscriptions - users can only see their own
CREATE POLICY "Users can view own subscription"
  ON user_subscriptions FOR SELECT
  USING (auth.uid()::text = user_id::text OR auth.role() = 'service_role');

CREATE POLICY "Service role can manage subscriptions"
  ON user_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- Subscription History - users can only see their own
CREATE POLICY "Users can view own subscription history"
  ON subscription_history FOR SELECT
  USING (auth.uid()::text = user_id::text OR auth.role() = 'service_role');

CREATE POLICY "Service role can manage subscription history"
  ON subscription_history FOR ALL
  USING (auth.role() = 'service_role');

-- Feature Permissions - readable by all authenticated users
CREATE POLICY "Feature permissions are viewable by all"
  ON feature_permissions FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Service role can manage feature permissions"
  ON feature_permissions FOR ALL
  USING (auth.role() = 'service_role');

-- Feature Usage - users can only see their own
CREATE POLICY "Users can view own feature usage"
  ON feature_usage FOR SELECT
  USING (auth.uid()::text = user_id::text OR auth.role() = 'service_role');

CREATE POLICY "Service role can manage feature usage"
  ON feature_usage FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated at triggers
DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_feature_permissions_updated_at ON feature_permissions;
CREATE TRIGGER update_feature_permissions_updated_at
  BEFORE UPDATE ON feature_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_feature_usage_updated_at ON feature_usage;
CREATE TRIGGER update_feature_usage_updated_at
  BEFORE UPDATE ON feature_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Get user's current subscription
CREATE OR REPLACE FUNCTION get_user_subscription(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  plan subscription_plan,
  status subscription_status,
  stripe_subscription_id VARCHAR(100),
  stripe_customer_id VARCHAR(100),
  billing_period VARCHAR(20),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN,
  canceled_at TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM user_subscriptions
  WHERE user_id = p_user_id
    AND status IN ('active', 'past_due', 'pending')
  ORDER BY created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Check if user has access to a feature
CREATE OR REPLACE FUNCTION check_feature_access(
  p_user_id UUID,
  p_feature_key VARCHAR(100)
) RETURNS BOOLEAN AS $$
DECLARE
  v_required_plan subscription_plan;
  v_user_plan subscription_plan;
  v_plan_hierarchy INT;
  v_user_plan_hierarchy INT;
BEGIN
  -- Get required plan for feature
  SELECT required_plan INTO v_required_plan
  FROM feature_permissions
  WHERE feature_key = p_feature_key AND is_active = TRUE;
  
  -- If feature not found or inactive, deny access
  IF v_required_plan IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Get user's current plan
  SELECT plan INTO v_user_plan
  FROM user_subscriptions
  WHERE user_id = p_user_id
    AND status IN ('active', 'past_due')
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Default to free plan if no subscription
  IF v_user_plan IS NULL THEN
    v_user_plan := 'free';
  END IF;
  
  -- Plan hierarchy: free=0, pro=1, enterprise=2
  v_plan_hierarchy := CASE v_required_plan
    WHEN 'free' THEN 0
    WHEN 'pro' THEN 1
    WHEN 'enterprise' THEN 2
  END;
  
  v_user_plan_hierarchy := CASE v_user_plan
    WHEN 'free' THEN 0
    WHEN 'pro' THEN 1
    WHEN 'enterprise' THEN 2
  END;
  
  -- User has access if their plan is >= required plan
  RETURN v_user_plan_hierarchy >= v_plan_hierarchy;
END;
$$ LANGUAGE plpgsql;

-- Create or update subscription
CREATE OR REPLACE FUNCTION upsert_subscription(
  p_user_id UUID,
  p_plan subscription_plan,
  p_status subscription_status DEFAULT 'active',
  p_stripe_subscription_id VARCHAR(100) DEFAULT NULL,
  p_stripe_customer_id VARCHAR(100) DEFAULT NULL,
  p_billing_period VARCHAR(20) DEFAULT NULL,
  p_current_period_start TIMESTAMPTZ DEFAULT NULL,
  p_current_period_end TIMESTAMPTZ DEFAULT NULL,
  p_trial_start TIMESTAMPTZ DEFAULT NULL,
  p_trial_end TIMESTAMPTZ DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_subscription_id UUID;
  v_old_plan subscription_plan;
  v_action subscription_action;
BEGIN
  -- Check if subscription exists
  SELECT id, plan INTO v_subscription_id, v_old_plan
  FROM user_subscriptions
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_subscription_id IS NOT NULL THEN
    -- Update existing subscription
    UPDATE user_subscriptions
    SET 
      plan = p_plan,
      status = p_status,
      stripe_subscription_id = COALESCE(p_stripe_subscription_id, stripe_subscription_id),
      stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
      billing_period = COALESCE(p_billing_period, billing_period),
      current_period_start = COALESCE(p_current_period_start, current_period_start),
      current_period_end = COALESCE(p_current_period_end, current_period_end),
      trial_start = COALESCE(p_trial_start, trial_start),
      trial_end = COALESCE(p_trial_end, trial_end),
      updated_at = NOW()
    WHERE id = v_subscription_id;
    
    -- Determine action
    IF v_old_plan = p_plan THEN
      v_action := 'renewed';
    ELSIF 
      (v_old_plan = 'free' AND p_plan IN ('pro', 'enterprise')) OR
      (v_old_plan = 'pro' AND p_plan = 'enterprise')
    THEN
      v_action := 'upgraded';
    ELSE
      v_action := 'downgraded';
    END IF;
  ELSE
    -- Create new subscription
    INSERT INTO user_subscriptions (
      user_id,
      plan,
      status,
      stripe_subscription_id,
      stripe_customer_id,
      billing_period,
      current_period_start,
      current_period_end,
      trial_start,
      trial_end
    ) VALUES (
      p_user_id,
      p_plan,
      p_status,
      p_stripe_subscription_id,
      p_stripe_customer_id,
      p_billing_period,
      p_current_period_start,
      p_current_period_end,
      p_trial_start,
      p_trial_end
    )
    RETURNING id INTO v_subscription_id;
    
    v_action := 'created';
  END IF;
  
  -- Record in history
  INSERT INTO subscription_history (user_id, action, from_plan, to_plan)
  VALUES (p_user_id, v_action, v_old_plan, p_plan);
  
  RETURN v_subscription_id;
END;
$$ LANGUAGE plpgsql;

-- Cancel subscription
CREATE OR REPLACE FUNCTION cancel_subscription(
  p_user_id UUID,
  p_immediately BOOLEAN DEFAULT FALSE
) RETURNS BOOLEAN AS $$
DECLARE
  v_subscription_id UUID;
  v_current_period_end TIMESTAMPTZ;
BEGIN
  -- Get current subscription
  SELECT id, current_period_end INTO v_subscription_id, v_current_period_end
  FROM user_subscriptions
  WHERE user_id = p_user_id
    AND status IN ('active', 'past_due', 'pending')
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_subscription_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  IF p_immediately THEN
    -- Cancel immediately
    UPDATE user_subscriptions
    SET 
      status = 'canceled',
      canceled_at = NOW(),
      updated_at = NOW()
    WHERE id = v_subscription_id;
    
    -- Record in history
    INSERT INTO subscription_history (user_id, action, from_plan, to_plan, reason)
    SELECT user_id, 'canceled', plan, plan, 'Immediate cancellation'
    FROM user_subscriptions
    WHERE id = v_subscription_id;
  ELSE
    -- Cancel at period end
    UPDATE user_subscriptions
    SET 
      cancel_at_period_end = TRUE,
      updated_at = NOW()
    WHERE id = v_subscription_id;
    
    -- Record in history
    INSERT INTO subscription_history (user_id, action, from_plan, to_plan, reason)
    SELECT user_id, 'canceled', plan, plan, 'Scheduled cancellation at period end'
    FROM user_subscriptions
    WHERE id = v_subscription_id;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Increment feature usage
CREATE OR REPLACE FUNCTION increment_feature_usage(
  p_user_id UUID,
  p_feature_key VARCHAR(100),
  p_increment INTEGER DEFAULT 1
) RETURNS INTEGER AS $$
DECLARE
  v_usage_id UUID;
  v_current_usage INTEGER;
  v_new_usage INTEGER;
BEGIN
  -- Try to get existing usage record for current period
  SELECT id, usage_count INTO v_usage_id, v_current_usage
  FROM feature_usage
  WHERE user_id = p_user_id
    AND feature_key = p_feature_key
    AND period_start <= NOW()
    AND period_end > NOW();
  
  IF v_usage_id IS NOT NULL THEN
    -- Update existing record
    UPDATE feature_usage
    SET usage_count = usage_count + p_increment,
        updated_at = NOW()
    WHERE id = v_usage_id
    RETURNING usage_count INTO v_new_usage;
  ELSE
    -- Create new record for current period
    INSERT INTO feature_usage (user_id, feature_key, usage_count)
    VALUES (p_user_id, p_feature_key, p_increment)
    RETURNING usage_count INTO v_new_usage;
  END IF;
  
  RETURN v_new_usage;
END;
$$ LANGUAGE plpgsql;

-- Get feature usage for current period
CREATE OR REPLACE FUNCTION get_feature_usage(
  p_user_id UUID,
  p_feature_key VARCHAR(100)
) RETURNS INTEGER AS $$
DECLARE
  v_usage INTEGER;
BEGIN
  SELECT usage_count INTO v_usage
  FROM feature_usage
  WHERE user_id = p_user_id
    AND feature_key = p_feature_key
    AND period_start <= NOW()
    AND period_end > NOW();
  
  RETURN COALESCE(v_usage, 0);
END;
$$ LANGUAGE plpgsql;

-- Check and limit feature usage
CREATE OR REPLACE FUNCTION check_feature_limit(
  p_user_id UUID,
  p_feature_key VARCHAR(100)
) RETURNS TABLE (
  allowed BOOLEAN,
  current_usage INTEGER,
  limit_value INTEGER
) AS $$
DECLARE
  v_user_plan subscription_plan;
  v_limit INTEGER;
BEGIN
  -- Get user's plan
  SELECT plan INTO v_user_plan
  FROM user_subscriptions
  WHERE user_id = p_user_id
    AND status IN ('active', 'past_due')
  ORDER BY created_at DESC
  LIMIT 1;
  
  v_user_plan := COALESCE(v_user_plan, 'free');
  
  -- Get limit for plan
  SELECT (limits->p_feature_key)::INTEGER INTO v_limit
  FROM subscription_plans
  WHERE plan = v_user_plan;
  
  -- Get current usage
  RETURN QUERY
  SELECT 
    COALESCE(v_limit = -1 OR fu.usage_count < v_limit, TRUE) AS allowed,
    COALESCE(fu.usage_count, 0) AS current_usage,
    COALESCE(v_limit, -1) AS limit_value
  FROM feature_usage fu
  WHERE fu.user_id = p_user_id
    AND fu.feature_key = p_feature_key
    AND fu.period_start <= NOW()
    AND fu.period_end > NOW();
  
  -- If no usage record, return defaults
  IF NOT FOUND THEN
    RETURN QUERY SELECT TRUE AS allowed, 0 AS current_usage, COALESCE(v_limit, -1) AS limit_value;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert default subscription plans
INSERT INTO subscription_plans (plan, name, price_monthly, price_yearly, features, limits) VALUES
(
  'free',
  'Free',
  0,
  0,
  '{
    "basic_charts": true,
    "single_strategy": true,
    "community_support": true,
    "market_data": "basic"
  }'::jsonb,
  '{
    "strategies": 1,
    "historical_data_days": 7,
    "backtests_per_day": 1,
    "api_calls_per_day": 100
  }'::jsonb
),
(
  'pro',
  'Pro',
  9.99,
  99.99,
  '{
    "advanced_charts": true,
    "multiple_strategies": true,
    "strategy_backtesting": true,
    "priority_support": true,
    "market_data": "advanced",
    "alerts": true
  }'::jsonb,
  '{
    "strategies": 10,
    "historical_data_days": 30,
    "backtests_per_day": 50,
    "api_calls_per_day": 10000
  }'::jsonb
),
(
  'enterprise',
  'Enterprise',
  49.99,
  499.99,
  '{
    "all_pro_features": true,
    "api_access": true,
    "priority_support": true,
    "dedicated_account_manager": true,
    "custom_strategies": true,
    "market_data": "premium",
    "webhooks": true,
    "white_label": true
  }'::jsonb,
  '{
    "strategies": -1,
    "historical_data_days": -1,
    "backtests_per_day": -1,
    "api_calls_per_day": -1
  }'::jsonb
);

-- Insert default feature permissions
INSERT INTO feature_permissions (feature_key, required_plan, description, category) VALUES
-- Trading features
('basic_trading', 'free', 'Basic trading functionality', 'trading'),
('advanced_orders', 'pro', 'Advanced order types (stop-loss, take-profit, trailing-stop)', 'trading'),
('conditional_orders', 'pro', 'Conditional order execution', 'trading'),
('algorithmic_trading', 'enterprise', 'Algorithmic trading strategies', 'trading'),

-- Data features
('basic_charts', 'free', 'Basic chart types and indicators', 'data'),
('advanced_charts', 'pro', 'Advanced chart types and technical indicators', 'data'),
('real_time_data', 'pro', 'Real-time market data streaming', 'data'),
('historical_data_7d', 'free', '7 days historical data access', 'data'),
('historical_data_30d', 'pro', '30 days historical data access', 'data'),
('historical_data_unlimited', 'enterprise', 'Unlimited historical data access', 'data'),

-- Strategy features
('single_strategy', 'free', 'Create and run one trading strategy', 'strategies'),
('multiple_strategies', 'pro', 'Create and run multiple trading strategies', 'strategies'),
('backtesting', 'pro', 'Strategy backtesting functionality', 'strategies'),
('custom_strategies', 'enterprise', 'Create custom trading strategies', 'strategies'),

-- API features
('api_basic', 'pro', 'Basic API access (limited calls)', 'api'),
('api_advanced', 'enterprise', 'Advanced API access (unlimited calls)', 'api'),
('webhooks', 'enterprise', 'Webhook notifications for events', 'api'),

-- Support features
('community_support', 'free', 'Access to community support', 'support'),
('email_support', 'pro', 'Email support with 24h response time', 'support'),
('priority_support', 'enterprise', 'Priority support with dedicated account manager', 'support'),

-- Portfolio features
('portfolio_tracking', 'free', 'Basic portfolio tracking', 'portfolio'),
('portfolio_analytics', 'pro', 'Advanced portfolio analytics', 'portfolio'),
('tax_reporting', 'enterprise', 'Automated tax reporting', 'portfolio'),

-- Alert features
('price_alerts', 'free', 'Basic price alerts (limited)', 'alerts'),
('advanced_alerts', 'pro', 'Advanced alerts with multiple conditions', 'alerts'),
('custom_alerts', 'enterprise', 'Custom alert integrations', 'alerts');

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE subscription_plans IS 'Stores subscription plan configurations and pricing';
COMMENT ON TABLE user_subscriptions IS 'Tracks user subscription status and billing information';
COMMENT ON TABLE subscription_history IS 'Records all subscription changes for audit purposes';
COMMENT ON TABLE feature_permissions IS 'Defines which features require which subscription tier';
COMMENT ON TABLE feature_usage IS 'Tracks feature usage for plan limit enforcement';

COMMENT ON FUNCTION get_user_subscription IS 'Get the current active subscription for a user';
COMMENT ON FUNCTION check_feature_access IS 'Check if a user has access to a specific feature';
COMMENT ON FUNCTION upsert_subscription IS 'Create or update a user subscription';
COMMENT ON FUNCTION cancel_subscription IS 'Cancel a user subscription';
COMMENT ON FUNCTION increment_feature_usage IS 'Increment usage count for a feature';
COMMENT ON FUNCTION get_feature_usage IS 'Get current usage count for a feature';
COMMENT ON FUNCTION check_feature_limit IS 'Check if user has hit their plan limit for a feature';