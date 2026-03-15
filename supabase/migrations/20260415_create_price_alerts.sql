-- Price Alerts table - User price alert notifications
CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol VARCHAR(50) NOT NULL,
  condition_type VARCHAR(20) NOT NULL CHECK (condition_type IN ('above', 'below')),
  target_price DECIMAL(20, 8) NOT NULL,
  current_price DECIMAL(20, 8),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'triggered', 'disabled', 'expired')),
  notification_method VARCHAR(50) DEFAULT 'in_app' CHECK (notification_method IN ('in_app', 'feishu', 'email', 'push')),
  triggered_at TIMESTAMP WITH TIME ZONE,
  triggered_price DECIMAL(20, 8),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_recurring BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_price_alerts_user_id ON price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_symbol ON price_alerts(symbol);
CREATE INDEX IF NOT EXISTS idx_price_alerts_status ON price_alerts(status);
CREATE INDEX IF NOT EXISTS idx_price_alerts_condition_type ON price_alerts(condition_type);
CREATE INDEX IF NOT EXISTS idx_price_alerts_created_at ON price_alerts(created_at);

-- Add comment
COMMENT ON TABLE price_alerts IS 'User price alerts that trigger notifications when price conditions are met';
COMMENT ON COLUMN price_alerts.condition_type IS 'Type of condition: above (alert when price rises above target) or below (alert when price falls below target)';
COMMENT ON COLUMN price_alerts.target_price IS 'Price level that triggers the alert';
COMMENT ON COLUMN price_alerts.notification_method IS 'How to notify the user: in_app, feishu, email, or push notification';
COMMENT ON COLUMN price_alerts.is_recurring IS 'If true, alert resets after triggering; if false, alert is one-time';

-- Enable RLS (Row Level Security)
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own alerts
CREATE POLICY "Users can view own alerts" ON price_alerts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create their own alerts
CREATE POLICY "Users can create own alerts" ON price_alerts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own alerts
CREATE POLICY "Users can update own alerts" ON price_alerts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own alerts
CREATE POLICY "Users can delete own alerts" ON price_alerts
  FOR DELETE
  USING (auth.uid() = user_id);
