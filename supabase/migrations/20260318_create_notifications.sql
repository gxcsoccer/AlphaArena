-- Notifications table - User notification system
-- Stores notifications for trading signals, risk alerts, and performance reports

-- Notification types enum
CREATE TYPE notification_type AS ENUM ('SIGNAL', 'RISK', 'PERFORMANCE', 'SYSTEM');

-- Notification priority enum
CREATE TYPE notification_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Notification content
  type notification_type NOT NULL DEFAULT 'SYSTEM',
  priority notification_priority NOT NULL DEFAULT 'MEDIUM',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  
  -- Additional data (flexible JSON for different notification types)
  data JSONB DEFAULT '{}',
  
  -- Related entity (e.g., trade_id, strategy_id, alert_id)
  entity_type VARCHAR(50),
  entity_id VARCHAR(255),
  
  -- Read status
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Action link (optional URL for user to take action)
  action_url VARCHAR(500),
  
  -- Expiration (notifications can expire)
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Channel preferences
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Type preferences (which types to receive)
  signal_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  risk_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  performance_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  system_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Priority threshold (only notify for this priority and above)
  priority_threshold notification_priority NOT NULL DEFAULT 'LOW',
  
  -- Quiet hours (don't send notifications during these hours)
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '08:00',
  quiet_hours_timezone VARCHAR(50) DEFAULT 'UTC',
  
  -- Digest preferences (batch notifications)
  digest_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  digest_frequency VARCHAR(20) DEFAULT 'daily' CHECK (digest_frequency IN ('hourly', 'daily', 'weekly')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- Enable RLS (Row Level Security)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Policies for notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own notifications" ON notifications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications" ON notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policies for notification preferences
CREATE POLICY "Users can view own preferences" ON notification_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own preferences" ON notification_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON notification_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-create notification preferences for new users
CREATE OR REPLACE FUNCTION create_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create preferences when a user signs up
DROP TRIGGER IF EXISTS on_auth_user_created_notifications ON auth.users;
CREATE TRIGGER on_auth_user_created_notifications
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_preferences();

-- Comments for documentation
COMMENT ON TABLE notifications IS 'User notifications for trading signals, risk alerts, and performance reports';
COMMENT ON TABLE notification_preferences IS 'User preferences for notification delivery and filtering';
COMMENT ON COLUMN notifications.type IS 'Type of notification: SIGNAL (trading signals), RISK (risk alerts), PERFORMANCE (performance reports), SYSTEM (system notifications)';
COMMENT ON COLUMN notifications.priority IS 'Priority level: LOW, MEDIUM, HIGH, URGENT';
COMMENT ON COLUMN notifications.data IS 'Flexible JSON payload for notification-specific data';
COMMENT ON COLUMN notifications.entity_type IS 'Type of related entity (trade, strategy, alert, etc.)';
COMMENT ON COLUMN notifications.entity_id IS 'ID of the related entity';
COMMENT ON COLUMN notifications.action_url IS 'Optional URL for user action (e.g., view trade details)';
COMMENT ON COLUMN notification_preferences.priority_threshold IS 'Minimum priority level to receive notifications';
COMMENT ON COLUMN notification_preferences.quiet_hours_enabled IS 'Enable quiet hours to suppress notifications during specified time';