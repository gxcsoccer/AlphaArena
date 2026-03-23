-- User Preferences Table
-- Issue #586: 语言切换功能实现
-- Stores user-specific preferences including language preference

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  language VARCHAR(10) NOT NULL DEFAULT 'zh-CN',
  theme VARCHAR(20) DEFAULT 'system',
  timezone VARCHAR(50) DEFAULT 'Asia/Shanghai',
  notification_settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Foreign key to app_users
  CONSTRAINT fk_user_preferences_user 
    FOREIGN KEY (user_id) 
    REFERENCES app_users(id) 
    ON DELETE CASCADE
);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Comments for documentation
COMMENT ON TABLE user_preferences IS 'Stores user-specific preferences for language, theme, notifications, etc. Issue #586';
COMMENT ON COLUMN user_preferences.language IS 'User preferred language code (zh-CN, en-US)';
COMMENT ON COLUMN user_preferences.theme IS 'User preferred theme (light, dark, system)';
COMMENT ON COLUMN user_preferences.timezone IS 'User preferred timezone';
COMMENT ON COLUMN user_preferences.notification_settings IS 'JSON object for notification preferences';

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_updated_at();

-- Row Level Security
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own preferences
CREATE POLICY "Users can read own preferences" ON user_preferences
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Users can only update their own preferences
CREATE POLICY "Users can update own preferences" ON user_preferences
  FOR UPDATE
  USING (user_id = auth.uid());

-- Policy: Users can insert their own preferences
CREATE POLICY "Users can insert own preferences" ON user_preferences
  FOR INSERT
  WITH CHECK (user_id = auth.uid());