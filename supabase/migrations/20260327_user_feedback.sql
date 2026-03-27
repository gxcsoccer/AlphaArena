-- User Feedback System Tables
-- Creates tables for collecting, managing, and analyzing user feedback

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Feedback types
CREATE TYPE feedback_type AS ENUM (
  'feature_request',  -- 功能建议
  'bug_report',       -- Bug报告
  'other'             -- 其他
);

-- Feedback status
CREATE TYPE feedback_status AS ENUM (
  'pending',      -- 待处理
  'in_progress',  -- 处理中
  'resolved',     -- 已解决
  'closed'        -- 已关闭
);

-- Sentiment type for analysis
CREATE TYPE sentiment_type AS ENUM (
  'positive',  -- 正面
  'neutral',   -- 中性
  'negative'   -- 负面
);

-- User Feedback table
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  type feedback_type NOT NULL DEFAULT 'other',
  status feedback_status NOT NULL DEFAULT 'pending',
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',  -- Array of image URLs
  sentiment sentiment_type,
  sentiment_score DECIMAL(3, 2), -- Score from -1.00 to 1.00
  tags TEXT[] DEFAULT '{}',      -- Auto-extracted tags for aggregation
  admin_reply TEXT,
  admin_reply_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  admin_reply_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Index-optimized fields
  is_read_by_admin BOOLEAN DEFAULT FALSE
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_status ON user_feedback(status);
CREATE INDEX IF NOT EXISTS idx_user_feedback_type ON user_feedback(type);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON user_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_feedback_sentiment ON user_feedback(sentiment);
CREATE INDEX IF NOT EXISTS idx_user_feedback_tags ON user_feedback USING GIN(tags);

-- Feedback Status History table (for tracking status changes)
CREATE TABLE IF NOT EXISTS feedback_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feedback_id UUID NOT NULL REFERENCES user_feedback(id) ON DELETE CASCADE,
  old_status feedback_status,
  new_status feedback_status NOT NULL,
  changed_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_feedback_status_history_feedback_id ON feedback_status_history(feedback_id);

-- Feedback Notifications table (for notifying users about status changes)
CREATE TABLE IF NOT EXISTS feedback_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feedback_id UUID NOT NULL REFERENCES user_feedback(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL, -- 'status_change', 'admin_reply', 'feature_released'
  is_sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_notifications_user_id ON feedback_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_notifications_feedback_id ON feedback_notifications(feedback_id);

-- Row Level Security Policies
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own feedback
CREATE POLICY "Users can view their own feedback" ON user_feedback
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own feedback
CREATE POLICY "Users can create their own feedback" ON user_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own feedback (only content and title, before admin reply)
CREATE POLICY "Users can update their own feedback" ON user_feedback
  FOR UPDATE USING (auth.uid() = user_id AND admin_reply IS NULL)
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all feedback
CREATE POLICY "Admins can view all feedback" ON user_feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM app_users 
      WHERE app_users.id = auth.uid() 
      AND app_users.role = 'admin'
    )
  );

-- Admins can update all feedback
CREATE POLICY "Admins can update all feedback" ON user_feedback
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM app_users 
      WHERE app_users.id = auth.uid() 
      AND app_users.role = 'admin'
    )
  );

-- Users can delete their own pending feedback
CREATE POLICY "Users can delete their own pending feedback" ON user_feedback
  FOR DELETE USING (auth.uid() = user_id AND status = 'pending');

-- Admins can delete all feedback
CREATE POLICY "Admins can delete all feedback" ON user_feedback
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM app_users 
      WHERE app_users.id = auth.uid() 
      AND app_users.role = 'admin'
    )
  );

-- Status history policies
CREATE POLICY "Users can view status history for their feedback" ON feedback_status_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_feedback 
      WHERE user_feedback.id = feedback_status_history.feedback_id 
      AND user_feedback.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM app_users 
      WHERE app_users.id = auth.uid() 
      AND app_users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert status history" ON feedback_status_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users 
      WHERE app_users.id = auth.uid() 
      AND app_users.role = 'admin'
    )
  );

-- Notification policies
CREATE POLICY "Users can view their own notifications" ON feedback_notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_feedback
DROP TRIGGER IF EXISTS update_user_feedback_updated_at ON user_feedback;
CREATE TRIGGER update_user_feedback_updated_at
  BEFORE UPDATE ON user_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create notification on status change
CREATE OR REPLACE FUNCTION notify_feedback_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO feedback_status_history (feedback_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.resolved_by);
    
    INSERT INTO feedback_notifications (feedback_id, user_id, notification_type)
    VALUES (NEW.id, NEW.user_id, 'status_change');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for status change notifications
DROP TRIGGER IF EXISTS notify_feedback_status_change_trigger ON user_feedback;
CREATE TRIGGER notify_feedback_status_change_trigger
  AFTER UPDATE ON user_feedback
  FOR EACH ROW
  EXECUTE FUNCTION notify_feedback_status_change();

-- Function to create notification on admin reply
CREATE OR REPLACE FUNCTION notify_feedback_admin_reply()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.admin_reply IS NULL AND NEW.admin_reply IS NOT NULL THEN
    INSERT INTO feedback_notifications (feedback_id, user_id, notification_type)
    VALUES (NEW.id, NEW.user_id, 'admin_reply');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for admin reply notifications
DROP TRIGGER IF EXISTS notify_feedback_admin_reply_trigger ON user_feedback;
CREATE TRIGGER notify_feedback_admin_reply_trigger
  AFTER UPDATE ON user_feedback
  FOR EACH ROW
  EXECUTE FUNCTION notify_feedback_admin_reply();

-- Statistics view for admin dashboard
CREATE OR REPLACE VIEW feedback_statistics AS
SELECT 
  COUNT(*) AS total_feedback,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
  COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress_count,
  COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_count,
  COUNT(*) FILTER (WHERE status = 'closed') AS closed_count,
  COUNT(*) FILTER (WHERE type = 'feature_request') AS feature_request_count,
  COUNT(*) FILTER (WHERE type = 'bug_report') AS bug_report_count,
  COUNT(*) FILTER (WHERE type = 'other') AS other_count,
  COUNT(*) FILTER (WHERE sentiment = 'positive') AS positive_count,
  COUNT(*) FILTER (WHERE sentiment = 'neutral') AS neutral_count,
  COUNT(*) FILTER (WHERE sentiment = 'negative') AS negative_count,
  AVG(sentiment_score) AS avg_sentiment_score
FROM user_feedback;

-- Hot topics view (most common tags)
CREATE OR REPLACE VIEW feedback_hot_topics AS
SELECT 
  UNNEST(tags) AS tag,
  COUNT(*) AS occurrence_count,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS recent_count
FROM user_feedback
WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
GROUP BY UNNEST(tags)
ORDER BY recent_count DESC, occurrence_count DESC
LIMIT 20;