-- Signal Push Configurations Table
-- Stores user preferences for real-time signal notifications

-- Signal push frequency enum
CREATE TYPE signal_push_frequency AS ENUM ('realtime', 'batch_1m', 'batch_5m', 'batch_15m');

-- Signal type filter enum
CREATE TYPE signal_type_filter AS ENUM ('buy', 'sell', 'stop_loss', 'take_profit', 'risk_alert', 'all');

-- Signal Push Configurations table
CREATE TABLE IF NOT EXISTS signal_push_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Master toggle
  push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Signal types to receive
  signal_types JSONB NOT NULL DEFAULT '["all"]',
  
  -- Push frequency
  frequency signal_push_frequency NOT NULL DEFAULT 'realtime',
  
  -- Notification channels
  browser_notify BOOLEAN NOT NULL DEFAULT TRUE,
  in_app_notify BOOLEAN NOT NULL DEFAULT TRUE,
  sound_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Filter settings
  min_confidence_score INTEGER DEFAULT 0 CHECK (min_confidence_score >= 0 AND min_confidence_score <= 100),
  risk_levels JSONB NOT NULL DEFAULT '["low", "medium", "high", "very_high"]',
  symbols JSONB DEFAULT '[]', -- Empty array = all symbols
  
  -- Quiet hours
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_hours_start VARCHAR(5) DEFAULT '22:00', -- HH:MM format
  quiet_hours_end VARCHAR(5) DEFAULT '08:00', -- HH:MM format
  quiet_hours_timezone VARCHAR(50) DEFAULT 'Asia/Shanghai',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_user_push_config UNIQUE (user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_signal_push_configs_user ON signal_push_configs(user_id);

-- Enable RLS
ALTER TABLE signal_push_configs ENABLE ROW LEVEL SECURITY;

-- Policies for signal_push_configs
CREATE POLICY "Users can view own push config" ON signal_push_configs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push config" ON signal_push_configs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push config" ON signal_push_configs
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own push config" ON signal_push_configs
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_signal_push_configs_updated_at ON signal_push_configs;
CREATE TRIGGER update_signal_push_configs_updated_at
  BEFORE UPDATE ON signal_push_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE signal_push_configs IS 'User preferences for real-time trading signal push notifications';
COMMENT ON COLUMN signal_push_configs.signal_types IS 'Array of signal types to receive: buy, sell, stop_loss, take_profit, risk_alert, all';
COMMENT ON COLUMN signal_push_configs.risk_levels IS 'Array of risk levels to receive: low, medium, high, very_high';
COMMENT ON COLUMN signal_push_configs.symbols IS 'Array of symbols to receive signals for. Empty array = all symbols';
COMMENT ON COLUMN signal_push_configs.quiet_hours_start IS 'Start time for quiet hours in HH:MM format';
COMMENT ON COLUMN signal_push_configs.quiet_hours_end IS 'End time for quiet hours in HH:MM format';