-- Signal Notification Enhancement Migration
-- Issue #670: 策略信号通知增强

-- 1. Extend signal_push_configs with more options
ALTER TABLE signal_push_configs 
ADD COLUMN IF NOT EXISTS per_strategy_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS rate_limit_per_hour INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS include_market_context BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS include_quick_actions BOOLEAN DEFAULT true;

-- 2. Add notification_history table for tracking all notifications sent
CREATE TABLE IF NOT EXISTS notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Notification details
  notification_type VARCHAR(50) NOT NULL,
  channel VARCHAR(20) NOT NULL, -- 'in_app', 'email', 'push', 'sms'
  
  -- Content
  title TEXT NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}',
  
  -- Related entity
  entity_type VARCHAR(50),
  entity_id UUID,
  
  -- Delivery status
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- User interaction
  read_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  action_taken VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_notification_history_user ON notification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_type ON notification_history(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_history_created ON notification_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_history_entity ON notification_history(entity_type, entity_id);

-- 3. Signal notification configuration per strategy
CREATE TABLE IF NOT EXISTS strategy_notification_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id UUID NOT NULL,
  
  -- Notification toggles
  enabled BOOLEAN DEFAULT true,
  signal_types TEXT[] DEFAULT ARRAY['all'],
  
  -- Filter settings
  min_confidence_score INTEGER DEFAULT 0,
  risk_levels TEXT[] DEFAULT ARRAY['low', 'medium', 'high', 'very_high'],
  
  -- Channel preferences
  notify_in_app BOOLEAN DEFAULT true,
  notify_push BOOLEAN DEFAULT true,
  notify_email BOOLEAN DEFAULT false,
  notify_sms BOOLEAN DEFAULT false, -- VIP only
  
  -- Timing
  quiet_hours_enabled BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, strategy_id)
);

CREATE INDEX IF NOT EXISTS idx_strategy_notification_user ON strategy_notification_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_strategy_notification_strategy ON strategy_notification_configs(strategy_id);

-- 4. Notification rate limiting
CREATE TABLE IF NOT EXISTS notification_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
  
  -- Rate limit window
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  
  -- Count
  notification_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, notification_type, window_start)
);

CREATE INDEX IF NOT EXISTS idx_notification_rate_limits_user ON notification_rate_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_rate_limits_window ON notification_rate_limits(window_start, window_end);

-- 5. Signal notification templates
CREATE TABLE IF NOT EXISTS signal_notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Template identification
  template_key VARCHAR(100) NOT NULL UNIQUE,
  notification_type VARCHAR(50) NOT NULL,
  
  -- Content templates (with placeholders)
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  
  -- Localization
  language VARCHAR(10) DEFAULT 'zh',
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default templates
INSERT INTO signal_notification_templates (template_key, notification_type, title_template, body_template, language) VALUES
('signal.new', 'SIGNAL', '【{strategy_name}】{side}信号', '{symbol} {side}信号\n入场价: {entry_price}\n目标价: {target_price}\n止损价: {stop_loss}\n置信度: {confidence}%\n\n{analysis}', 'zh'),
('signal.update', 'SIGNAL', '【{strategy_name}】信号更新', '{symbol} 信号状态更新: {status}\n当前价: {current_price}\n盈亏: {pnl_percent}%', 'zh'),
('signal.close', 'SIGNAL', '【{strategy_name}】信号平仓', '{symbol} 信号已平仓\n盈亏: {pnl_percent}%\n\n点击查看详情', 'zh'),
('signal.alert', 'SIGNAL', '【{strategy_name}】价格提醒', '{symbol} 价格提醒\n{alert_type}: {message}\n当前价: {current_price}', 'zh'),
('signal.new', 'SIGNAL', '[{strategy_name}] {side} Signal', '{symbol} {side} Signal\nEntry: {entry_price}\nTarget: {target_price}\nStop Loss: {stop_loss}\nConfidence: {confidence}%\n\n{analysis}', 'en'),
('signal.update', 'SIGNAL', '[{strategy_name}] Signal Update', '{symbol} Status: {status}\nCurrent: {current_price}\nPnL: {pnl_percent}%', 'en'),
('signal.close', 'SIGNAL', '[{strategy_name}] Signal Closed', '{symbol} Signal closed\nPnL: {pnl_percent}%\n\nTap for details', 'en'),
('signal.alert', 'SIGNAL', '[{strategy_name}] Price Alert', '{symbol} Alert\n{alert_type}: {message}\nCurrent: {current_price}', 'en')
ON CONFLICT (template_key) DO NOTHING;

-- 6. Add SMS notification support (VIP feature)
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sms_notifications BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

-- 7. Row Level Security
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_notification_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notification history" ON notification_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own strategy notification configs" ON strategy_notification_configs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own rate limits" ON notification_rate_limits
  FOR SELECT USING (auth.uid() = user_id);

-- 8. Function to check rate limit
CREATE OR REPLACE FUNCTION check_notification_rate_limit(
  p_user_id UUID,
  p_notification_type VARCHAR(50),
  p_limit INTEGER DEFAULT 10
) RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM notification_rate_limits
  WHERE user_id = p_user_id
    AND notification_type = p_notification_type
    AND window_start >= NOW() - INTERVAL '1 hour';
  
  RETURN v_count < p_limit;
END;
$$ LANGUAGE plpgsql;

-- 9. Function to record notification
CREATE OR REPLACE FUNCTION record_notification_rate(
  p_user_id UUID,
  p_notification_type VARCHAR(50)
) RETURNS VOID AS $$
BEGIN
  INSERT INTO notification_rate_limits (user_id, notification_type, window_start, window_end, notification_count)
  VALUES (p_user_id, p_notification_type, NOW(), NOW() + INTERVAL '1 hour', 1)
  ON CONFLICT (user_id, notification_type, window_start)
  DO UPDATE SET notification_count = notification_rate_limits.notification_count + 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE notification_history IS 'Tracks all notifications sent to users';
COMMENT ON TABLE strategy_notification_configs IS 'Per-strategy notification preferences';
COMMENT ON TABLE notification_rate_limits IS 'Rate limiting for notifications';
COMMENT ON TABLE signal_notification_templates IS 'Templates for signal notifications';