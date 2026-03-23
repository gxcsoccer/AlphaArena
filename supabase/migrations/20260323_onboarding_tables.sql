-- User Onboarding State Table
-- Stores user's progress through the onboarding flow

CREATE TABLE IF NOT EXISTS user_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_steps INTEGER DEFAULT 0,
  completed_step_ids TEXT[] DEFAULT '{}',
  current_step_id TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  skipped BOOLEAN DEFAULT FALSE,
  last_active_step TEXT DEFAULT '',
  step_timestamps JSONB DEFAULT '{}',
  variant TEXT,
  user_role TEXT DEFAULT 'free',
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_user_onboarding UNIQUE (user_id)
);

-- Indexes for user_onboarding
CREATE INDEX IF NOT EXISTS idx_user_onboarding_user_id ON user_onboarding(user_id);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_is_completed ON user_onboarding(is_completed);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_started_at ON user_onboarding(started_at);

-- Onboarding Analytics Events Table
-- Tracks detailed events for analytics

CREATE TABLE IF NOT EXISTS onboarding_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  event_type TEXT NOT NULL,
  flow_id TEXT NOT NULL,
  step_id TEXT,
  step_order INTEGER,
  time_on_step BIGINT,
  variant TEXT,
  properties JSONB DEFAULT '{}',
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Add computed date column for easier querying
  event_date DATE GENERATED ALWAYS AS (DATE(occurred_at)) STORED
);

-- Indexes for onboarding_analytics
CREATE INDEX IF NOT EXISTS idx_onboarding_analytics_user_id ON onboarding_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_analytics_event_type ON onboarding_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_onboarding_analytics_flow_id ON onboarding_analytics(flow_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_analytics_occurred_at ON onboarding_analytics(occurred_at);
CREATE INDEX IF NOT EXISTS idx_onboarding_analytics_event_date ON onboarding_analytics(event_date);

-- Row Level Security Policies

-- user_onboarding policies
ALTER TABLE user_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own onboarding state"
  ON user_onboarding FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own onboarding state"
  ON user_onboarding FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own onboarding state"
  ON user_onboarding FOR UPDATE
  USING (auth.uid() = user_id);

-- onboarding_analytics policies
ALTER TABLE onboarding_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own onboarding analytics"
  ON onboarding_analytics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own onboarding analytics"
  ON onboarding_analytics FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_onboarding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS onboarding_updated_at ON user_onboarding;
CREATE TRIGGER onboarding_updated_at
  BEFORE UPDATE ON user_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION update_onboarding_updated_at();

-- Comments for documentation
COMMENT ON TABLE user_onboarding IS 'Stores user progress through the onboarding flow';
COMMENT ON TABLE onboarding_analytics IS 'Tracks detailed events for onboarding analytics';

COMMENT ON COLUMN user_onboarding.completed_steps IS 'Number of steps completed';
COMMENT ON COLUMN user_onboarding.completed_step_ids IS 'Array of completed step IDs';
COMMENT ON COLUMN user_onboarding.current_step_id IS 'Current step the user is on';
COMMENT ON COLUMN user_onboarding.step_timestamps IS 'JSON object mapping step IDs to completion timestamps';
COMMENT ON COLUMN user_onboarding.variant IS 'A/B test variant assigned to user';

COMMENT ON COLUMN onboarding_analytics.event_type IS 'Type of event: step_viewed, step_completed, step_skipped, flow_started, flow_completed, flow_abandoned';
COMMENT ON COLUMN onboarding_analytics.time_on_step IS 'Time spent on step in milliseconds';