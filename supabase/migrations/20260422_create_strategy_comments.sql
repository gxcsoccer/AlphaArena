-- Strategy Comments table - 策略评论和讨论系统
-- Supports threaded comments (replies), likes, and moderation

-- Main comments table
CREATE TABLE IF NOT EXISTS strategy_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL REFERENCES strategy_templates(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  parent_id UUID REFERENCES strategy_comments(id) ON DELETE CASCADE,
  
  -- Content
  content TEXT NOT NULL,
  content_html TEXT, -- Rendered HTML from Markdown
  
  -- Stats
  likes_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  
  -- Status flags
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE, -- Soft delete
  is_pinned BOOLEAN DEFAULT FALSE, -- Pinned by author/moderator
  is_hidden BOOLEAN DEFAULT FALSE, -- Hidden by moderator
  
  -- Moderation
  reported_count INTEGER DEFAULT 0,
  moderated_at TIMESTAMP WITH TIME ZONE,
  moderated_by VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comment likes table
CREATE TABLE IF NOT EXISTS strategy_comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES strategy_comments(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_comment_like UNIQUE (comment_id, user_id)
);

-- Comment reports table (for moderation)
CREATE TABLE IF NOT EXISTS strategy_comment_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES strategy_comments(id) ON DELETE CASCADE,
  reporter_id VARCHAR(255) NOT NULL,
  
  reason VARCHAR(50) NOT NULL, -- spam, abuse, inappropriate, other
  description TEXT,
  
  status VARCHAR(20) DEFAULT 'pending', -- pending, reviewed, resolved, dismissed
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by VARCHAR(255),
  review_note TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_comment_report UNIQUE (comment_id, reporter_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_comments_strategy ON strategy_comments(strategy_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON strategy_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON strategy_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON strategy_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_likes ON strategy_comments(likes_count DESC);
CREATE INDEX IF NOT EXISTS idx_comments_deleted ON strategy_comments(is_deleted);
CREATE INDEX IF NOT EXISTS idx_comments_pinned ON strategy_comments(is_pinned DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON strategy_comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user ON strategy_comment_likes(user_id);

CREATE INDEX IF NOT EXISTS idx_comment_reports_status ON strategy_comment_reports(status);
CREATE INDEX IF NOT EXISTS idx_comment_reports_comment ON strategy_comment_reports(comment_id);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_strategy_comments_updated_at
    BEFORE UPDATE ON strategy_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update replies_count when a new comment is added
CREATE OR REPLACE FUNCTION update_replies_count_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    UPDATE strategy_comments
    SET replies_count = replies_count + 1
    WHERE id = NEW.parent_id;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_replies_count_insert
    AFTER INSERT ON strategy_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_replies_count_on_insert();

-- Function to update replies_count when a comment is deleted
CREATE OR REPLACE FUNCTION update_replies_count_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.parent_id IS NOT NULL THEN
    UPDATE strategy_comments
    SET replies_count = GREATEST(replies_count - 1, 0)
    WHERE id = OLD.parent_id;
  END IF;
  RETURN OLD;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_replies_count_delete
    AFTER DELETE ON strategy_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_replies_count_on_delete();

-- Function to update likes_count when a like is added/removed
CREATE OR REPLACE FUNCTION update_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE strategy_comments
    SET likes_count = likes_count + 1
    WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE strategy_comments
    SET likes_count = GREATEST(likes_count - 1, 0)
    WHERE id = OLD.comment_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_likes_count_insert
    AFTER INSERT ON strategy_comment_likes
    FOR EACH ROW
    EXECUTE FUNCTION update_likes_count();

CREATE TRIGGER trigger_update_likes_count_delete
    AFTER DELETE ON strategy_comment_likes
    FOR EACH ROW
    EXECUTE FUNCTION update_likes_count();

-- Function to update reported_count when a report is added
CREATE OR REPLACE FUNCTION update_reported_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE strategy_comments
  SET reported_count = reported_count + 1
  WHERE id = NEW.comment_id;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_reported_count
    AFTER INSERT ON strategy_comment_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_reported_count();

-- Comment on tables for documentation
COMMENT ON TABLE strategy_comments IS 'Stores threaded comments for strategy templates';
COMMENT ON TABLE strategy_comment_likes IS 'Tracks which users liked which comments';
COMMENT ON TABLE strategy_comment_reports IS 'User reports for comment moderation';