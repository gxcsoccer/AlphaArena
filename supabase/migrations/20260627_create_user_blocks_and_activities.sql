-- User Blocks and Activities Migration
-- Adds user blocking and activity tracking for the follow system

-- User Blocks table - 用户屏蔽关系
CREATE TABLE IF NOT EXISTS user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);

-- User Activities table - 用户活动记录 (用于关注动态)
CREATE TABLE IF NOT EXISTS user_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  entity_name VARCHAR(255),
  entity_data JSONB DEFAULT '{}',
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_activities_user ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_type ON user_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activities_created ON user_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activities_public ON user_activities(is_public, created_at DESC);

-- Add notification type for follows
-- Note: We'll add this to the existing notifications table via insert

-- Function to check if user can view another user's profile
CREATE OR REPLACE FUNCTION can_view_profile(viewer_id UUID, target_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Can always view own profile
  IF viewer_id = target_id THEN
    RETURN TRUE;
  END IF;
  
  -- Check if blocked
  IF EXISTS (
    SELECT 1 FROM user_blocks 
    WHERE blocker_id = target_id AND blocked_id = viewer_id
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Check if target profile is public
  IF EXISTS (
    SELECT 1 FROM users WHERE id = target_id AND is_public = TRUE
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if viewer follows target (followers can see private profiles)
  IF EXISTS (
    SELECT 1 FROM user_follows 
    WHERE follower_id = viewer_id AND following_id = target_id
  ) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to log user activity
CREATE OR REPLACE FUNCTION log_user_activity(
  p_user_id UUID,
  p_activity_type VARCHAR(50),
  p_entity_type VARCHAR(50) DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_entity_name VARCHAR(255) DEFAULT NULL,
  p_entity_data JSONB DEFAULT '{}',
  p_is_public BOOLEAN DEFAULT TRUE
)
RETURNS UUID AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  INSERT INTO user_activities (
    user_id, activity_type, entity_type, entity_id, 
    entity_name, entity_data, is_public
  ) VALUES (
    p_user_id, p_activity_type, p_entity_type, p_entity_id,
    p_entity_name, p_entity_data, p_is_public
  ) RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to log follow activity
CREATE OR REPLACE FUNCTION log_follow_activity()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_user_activity(
    NEW.follower_id,
    'followed_user',
    'user',
    NEW.following_id,
    NULL,
    '{}',
    TRUE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS log_follow_activity_trigger ON user_follows;
CREATE TRIGGER log_follow_activity_trigger
  AFTER INSERT ON user_follows
  FOR EACH ROW
  EXECUTE FUNCTION log_follow_activity();

-- Comments
COMMENT ON TABLE user_blocks IS 'User block relationships for privacy control';
COMMENT ON TABLE user_activities IS 'User activity log for follow feed and notifications';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_blocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_activities TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;