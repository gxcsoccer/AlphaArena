-- Subscription Plans Tables Migration
-- Creates tables for subscription plans, user subscriptions, and subscription history

-- Subscription Plans Table
-- Defines available subscription tiers and their features
CREATE TABLE IF NOT EXISTS subscription_plans (
  id VARCHAR(20) PRIMARY KEY, -- 'free', 'pro', 'enterprise'
  name VARCHAR(50) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'CNY',
  billing_interval VARCHAR(20) CHECK (billing_interval IN ('month', 'year', 'one-time')),
  features JSONB NOT NULL DEFAULT '{}',
  limits JSONB NOT NULL DEFAULT '{}',
  stripe_price_id VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User Subscriptions Table
-- Tracks user subscription status and billing
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan_id VARCHAR(20) NOT NULL REFERENCES subscription_plans(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired', 'past_due', 'trialing')),
  
  -- Billing period
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  
  -- Stripe integration
  stripe_subscription_id VARCHAR(100),
  stripe_customer_id VARCHAR(100),
  stripe_price_id VARCHAR(100),
  
  -- Cancellation info
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  -- Trial info
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id) -- Each user has only one active subscription
);

-- Subscription History Table
-- Records subscription changes for audit and analytics
CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL CHECK (action IN ('created', 'upgraded', 'downgraded', 'canceled', 'renewed', 'expired', 'trial_started', 'trial_ended')),
  from_plan VARCHAR(20),
  to_plan VARCHAR(20),
  from_status VARCHAR(20),
  to_status VARCHAR(20),
  reason TEXT,
  stripe_event_id VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feature Usage Table
-- Tracks usage of premium features for rate limiting
CREATE TABLE IF NOT EXISTS feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  feature_key VARCHAR(100) NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  usage_count INTEGER NOT NULL DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, feature_key, usage_date)
);

-- Indexes for common queries
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_current_period_end ON user_subscriptions(current_period_end);
CREATE INDEX idx_user_subscriptions_stripe_subscription_id ON user_subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscription_history_user_id ON subscription_history(user_id);
CREATE INDEX idx_subscription_history_created_at ON subscription_history(created_at DESC);
CREATE INDEX idx_feature_usage_user_id ON feature_usage(user_id);
CREATE INDEX idx_feature_usage_feature_key ON feature_usage(feature_key);
CREATE INDEX idx_feature_usage_usage_date ON feature_usage(usage_date);

-- Row Level Security (RLS)
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_usage ENABLE ROW LEVEL SECURITY;

-- Policies for subscription_plans (everyone can read active plans)
CREATE POLICY "Anyone can view active subscription plans"
  ON subscription_plans FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role can manage subscription plans"
  ON subscription_plans FOR ALL
  USING (auth.role() = 'service_role');

-- Policies for user_subscriptions (users can only see their own subscriptions)
CREATE POLICY "Users can view own subscriptions"
  ON user_subscriptions FOR SELECT
  USING (auth.uid()::text = user_id::text OR auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON user_subscriptions FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text OR auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON user_subscriptions FOR UPDATE
  USING (auth.uid()::text = user_id::text OR auth.uid() = user_id);

CREATE POLICY "Service role can manage all subscriptions"
  ON user_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- Policies for subscription_history
CREATE POLICY "Users can view own subscription history"
  ON subscription_history FOR SELECT
  USING (auth.uid()::text = user_id::text OR auth.uid() = user_id);

CREATE POLICY "Service role can manage all subscription history"
  ON subscription_history FOR ALL
  USING (auth.role() = 'service_role');

-- Policies for feature_usage
CREATE POLICY "Users can view own feature usage"
  ON feature_usage FOR SELECT
  USING (auth.uid()::text = user_id::text OR auth.uid() = user_id);

CREATE POLICY "Service role can manage all feature usage"
  ON feature_usage FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger for updated_at timestamp
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

DROP TRIGGER IF EXISTS update_feature_usage_updated_at ON feature_usage;
CREATE TRIGGER update_feature_usage_updated_at
  BEFORE UPDATE ON feature_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default subscription plans
INSERT INTO subscription_plans (id, name, description, price, currency, billing_interval, features, limits, display_order) VALUES
(
  'free',
  '免费版',
  '适合个人投资者和小型项目',
  0,
  'CNY',
  'month',
  '{
    "strategies": "基础策略运行",
    "backtest": "基础回测功能",
    "marketData": "基础市场数据",
    "support": "社区支持"
  }'::jsonb,
  '{
    "concurrentStrategies": 3,
    "dailyBacktests": 10,
    "dataRetention": 7,
    "apiCalls": 100
  }'::jsonb,
  1
),
(
  'pro',
  '专业版',
  '适合专业交易者和团队，解锁全部高级功能',
  99,
  'CNY',
  'month',
  '{
    "strategies": "无限策略运行",
    "backtest": "无限回测",
    "marketData": "高级市场数据（Level 2）",
    "aiAssistant": "AI 策略助手",
    "riskAlerts": "风险预警通知",
    "dataExport": "数据导出",
    "support": "优先支持"
  }'::jsonb,
  '{
    "concurrentStrategies": -1,
    "dailyBacktests": -1,
    "dataRetention": 365,
    "apiCalls": 10000
  }'::jsonb,
  2
),
(
  'enterprise',
  '企业版',
  '适合机构和大型团队，提供专属服务',
  0,
  'CNY',
  'one-time',
  '{
    "strategies": "无限策略运行",
    "backtest": "无限回测",
    "marketData": "高级市场数据（Level 2）",
    "aiAssistant": "AI 策略助手",
    "riskAlerts": "风险预警通知",
    "dataExport": "数据导出",
    "teamManagement": "多用户团队管理",
    "api": "API 访问（高配额）",
    "accountManager": "专属客户经理",
    "privateDeployment": "私有部署支持",
    "support": "专属支持"
  }'::jsonb,
  '{
    "concurrentStrategies": -1,
    "dailyBacktests": -1,
    "dataRetention": -1,
    "apiCalls": -1
  }'::jsonb,
  3
)
ON CONFLICT (id) DO NOTHING;

-- Function to check if a user has access to a feature
CREATE OR REPLACE FUNCTION check_feature_access(
  p_user_id UUID,
  p_feature_key VARCHAR(100)
) RETURNS JSONB AS $$
DECLARE
  v_plan_id VARCHAR(20);
  v_limits JSONB;
  v_current_usage INTEGER;
  v_limit INTEGER;
  v_result JSONB;
BEGIN
  -- Get user's current plan
  SELECT plan_id INTO v_plan_id
  FROM user_subscriptions
  WHERE user_id = p_user_id AND status = 'active';
  
  -- Default to free plan if no active subscription
  IF v_plan_id IS NULL THEN
    v_plan_id := 'free';
  END IF;
  
  -- Get plan limits
  SELECT limits INTO v_limits
  FROM subscription_plans
  WHERE id = v_plan_id;
  
  -- Get feature limit (-1 means unlimited)
  v_limit := (v_limits->>p_feature_key)::INTEGER;
  
  -- Get current usage today
  SELECT COALESCE(SUM(usage_count), 0) INTO v_current_usage
  FROM feature_usage
  WHERE user_id = p_user_id 
    AND feature_key = p_feature_key
    AND usage_date = CURRENT_DATE;
  
  -- Build result
  v_result := jsonb_build_object(
    'hasAccess', v_limit = -1 OR v_current_usage < v_limit,
    'limit', v_limit,
    'currentUsage', v_current_usage,
    'remaining', CASE WHEN v_limit = -1 THEN -1 ELSE v_limit - v_current_usage END,
    'planId', v_plan_id
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function to increment feature usage
CREATE OR REPLACE FUNCTION increment_feature_usage(
  p_user_id UUID,
  p_feature_key VARCHAR(100),
  p_increment INTEGER DEFAULT 1
) RETURNS VOID AS $$
BEGIN
  INSERT INTO feature_usage (user_id, feature_key, usage_count)
  VALUES (p_user_id, p_feature_key, p_increment)
  ON CONFLICT (user_id, feature_key, usage_date)
  DO UPDATE SET 
    usage_count = feature_usage.usage_count + p_increment,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get user's subscription status
CREATE OR REPLACE FUNCTION get_user_subscription_status(p_user_id UUID)
RETURNS TABLE (
  plan_id VARCHAR(20),
  plan_name VARCHAR(50),
  status VARCHAR(20),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  features JSONB,
  limits JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.plan_id,
    sp.name as plan_name,
    us.status,
    us.current_period_start,
    us.current_period_end,
    sp.features,
    sp.limits
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = p_user_id AND us.status = 'active';
  
  -- Return free plan if no active subscription
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      'free'::VARCHAR(20) as plan_id,
      '免费版'::VARCHAR(50) as plan_name,
      'active'::VARCHAR(20) as status,
      NOW() as current_period_start,
      NOW() + INTERVAL '30 days' as current_period_end,
      sp.features,
      sp.limits
    FROM subscription_plans sp
    WHERE sp.id = 'free';
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE subscription_plans IS 'Defines available subscription tiers and their features';
COMMENT ON TABLE user_subscriptions IS 'Tracks user subscription status and billing information';
COMMENT ON TABLE subscription_history IS 'Records subscription changes for audit and analytics';
COMMENT ON TABLE feature_usage IS 'Tracks usage of premium features for rate limiting';