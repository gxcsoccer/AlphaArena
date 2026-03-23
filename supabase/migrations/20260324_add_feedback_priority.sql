-- Add priority and new status to feedbacks table

-- Add priority column
ALTER TABLE feedbacks 
ADD COLUMN IF NOT EXISTS priority TEXT 
CHECK (priority IN ('p0', 'p1', 'p2', 'p3'));

-- Create index for priority
CREATE INDEX IF NOT EXISTS idx_feedbacks_priority ON feedbacks(priority) WHERE priority IS NOT NULL;

-- Update status constraint to include 'confirmed'
-- First drop the old constraint
ALTER TABLE feedbacks DROP CONSTRAINT IF EXISTS feedbacks_status_check;

-- Add new constraint with all statuses
ALTER TABLE feedbacks ADD CONSTRAINT feedbacks_status_check 
CHECK (status IN ('new', 'confirmed', 'in_progress', 'resolved', 'closed'));

-- Comment for the new column
COMMENT ON COLUMN feedbacks.priority IS 'Feedback priority: p0 (urgent), p1 (high), p2 (medium), p3 (low)';