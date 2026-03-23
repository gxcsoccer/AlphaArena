-- Add COMMENT notification type for signal comments
-- This enables notifications for new comments, replies, and likes on comments

-- Add COMMENT to notification_type enum
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'COMMENT';

-- Add comment_notifications preference to notification_preferences
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS comment_notifications BOOLEAN DEFAULT TRUE;

-- Add like_notifications preference (for comment likes)
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS like_notifications BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN notification_preferences.comment_notifications IS 'Whether to receive notifications for new comments on signals';
COMMENT ON COLUMN notification_preferences.like_notifications IS 'Whether to receive notifications for likes on comments';