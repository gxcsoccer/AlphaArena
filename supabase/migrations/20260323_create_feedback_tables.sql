-- User Feedback Tables
-- Store and manage user feedback from the application

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Feedback table
CREATE TABLE IF NOT EXISTS feedbacks (
  id TEXT PRIMARY KEY,
  
  -- User identification
  user_id TEXT,
  
  -- Feedback content
  type TEXT NOT NULL CHECK (type IN ('bug', 'suggestion', 'other')),
  description TEXT NOT NULL,
  
  -- Screenshot (base64 encoded)
  screenshot TEXT,
  screenshot_name TEXT,
  
  -- Contact information (optional)
  contact_info TEXT,
  
  -- Environment information
  environment JSONB DEFAULT '{}',
  
  -- Status management
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
  
  -- Admin fields
  tags TEXT[] DEFAULT '{}',
  admin_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_feedbacks_user_id ON feedbacks(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_feedbacks_type ON feedbacks(type);
CREATE INDEX idx_feedbacks_status ON feedbacks(status);
CREATE INDEX idx_feedbacks_created_at ON feedbacks(created_at DESC);

-- Row Level Security (RLS) policies
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

-- Service role can access everything (for backend)
CREATE POLICY "Service role full access on feedbacks" ON feedbacks
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Anonymous and authenticated users can insert feedback
CREATE POLICY "Users can insert feedback" ON feedbacks
  FOR INSERT WITH CHECK (TRUE);

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback" ON feedbacks
  FOR SELECT USING (
    (auth.uid()::text = user_id) OR (user_id IS NULL)
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_feedback_updated_at_trigger ON feedbacks;
CREATE TRIGGER update_feedback_updated_at_trigger
  BEFORE UPDATE ON feedbacks
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_updated_at();

-- Comments for documentation
COMMENT ON TABLE feedbacks IS 'User feedback and bug reports';
COMMENT ON COLUMN feedbacks.id IS 'Unique feedback identifier (e.g., fb_1234567890_abc123)';
COMMENT ON COLUMN feedbacks.type IS 'Feedback type: bug, suggestion, or other';
COMMENT ON COLUMN feedbacks.description IS 'Detailed feedback description';
COMMENT ON COLUMN feedbacks.screenshot IS 'Base64 encoded screenshot image';
COMMENT ON COLUMN feedbacks.screenshot_name IS 'Original screenshot filename';
COMMENT ON COLUMN feedbacks.contact_info IS 'Optional contact information for follow-up';
COMMENT ON COLUMN feedbacks.environment IS 'JSON object containing browser, URL, and other context';
COMMENT ON COLUMN feedbacks.status IS 'Feedback status: new, in_progress, resolved, or closed';
COMMENT ON COLUMN feedbacks.tags IS 'Array of tags for categorization';
COMMENT ON COLUMN feedbacks.admin_notes IS 'Internal notes for admin use';