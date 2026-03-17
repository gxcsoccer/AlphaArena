-- Trade Journal Table
-- Stores user trade journal entries for tracking and analysis

CREATE TABLE IF NOT EXISTS trade_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Basic trade info
  symbol VARCHAR(20) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('long', 'short')),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
  
  -- Entry details
  entry_price DECIMAL(20, 8) NOT NULL,
  entry_quantity DECIMAL(20, 8) NOT NULL,
  entry_reason TEXT,
  entry_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Exit details (optional, for closed trades)
  exit_price DECIMAL(20, 8),
  exit_quantity DECIMAL(20, 8),
  exit_reason TEXT,
  exit_date TIMESTAMP WITH TIME ZONE,
  
  -- Financials
  pnl DECIMAL(20, 8),
  pnl_percent DECIMAL(10, 4),
  fees DECIMAL(20, 8),
  
  -- Notes and metadata
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  emotion VARCHAR(20) NOT NULL DEFAULT 'calm' CHECK (emotion IN ('confident', 'hesitant', 'fearful', 'greedy', 'regretful', 'hopeful', 'anxious', 'calm')),
  screenshots TEXT[] DEFAULT '{}',
  
  -- Strategy association
  strategy_id UUID,
  strategy_name VARCHAR(100),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_trade_journal_user_id ON trade_journal(user_id);
CREATE INDEX idx_trade_journal_symbol ON trade_journal(symbol);
CREATE INDEX idx_trade_journal_status ON trade_journal(status);
CREATE INDEX idx_trade_journal_entry_date ON trade_journal(entry_date DESC);
CREATE INDEX idx_trade_journal_emotion ON trade_journal(emotion);
CREATE INDEX idx_trade_journal_strategy_id ON trade_journal(strategy_id);

-- Row Level Security (RLS) - Users can only access their own entries
ALTER TABLE trade_journal ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own entries
CREATE POLICY "Users can view own trade journal entries"
  ON trade_journal FOR SELECT
  USING (auth.uid()::text = user_id::text OR auth.uid() = user_id);

-- Policy: Users can insert their own entries
CREATE POLICY "Users can insert own trade journal entries"
  ON trade_journal FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text OR auth.uid() = user_id);

-- Policy: Users can update their own entries
CREATE POLICY "Users can update own trade journal entries"
  ON trade_journal FOR UPDATE
  USING (auth.uid()::text = user_id::text OR auth.uid() = user_id)
  WITH CHECK (auth.uid()::text = user_id::text OR auth.uid() = user_id);

-- Policy: Users can delete their own entries
CREATE POLICY "Users can delete own trade journal entries"
  ON trade_journal FOR DELETE
  USING (auth.uid()::text = user_id::text OR auth.uid() = user_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_trade_journal_updated_at
    BEFORE UPDATE ON trade_journal
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comment on table
COMMENT ON TABLE trade_journal IS 'Trade journal entries for tracking and analyzing trading decisions';
COMMENT ON COLUMN trade_journal.user_id IS 'Reference to the user who created this entry';
COMMENT ON COLUMN trade_journal.type IS 'Trade type: long (buy) or short (sell)';
COMMENT ON COLUMN trade_journal.status IS 'Trade status: open, closed, or cancelled';
COMMENT ON COLUMN trade_journal.emotion IS 'Emotional state when entering the trade';
