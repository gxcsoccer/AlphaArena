-- AI Strategy Assistant Tables
-- Stores conversation history and messages for the AI assistant feature

-- AI Conversations table
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200),
  context JSONB DEFAULT '{}', -- Context data (current strategy, market, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Messages table
CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  context JSONB, -- Snapshot of context when message was sent
  tokens_used INT,
  model VARCHAR(50), -- Which model was used (e.g., 'gpt-4', 'claude-3')
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Market Analysis Cache
-- Cache market analysis results to avoid repeated LLM calls
CREATE TABLE IF NOT EXISTS ai_market_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(20) NOT NULL,
  analysis_type VARCHAR(50) NOT NULL, -- 'trend', 'support_resistance', 'sentiment'
  analysis_result JSONB NOT NULL,
  market_data_hash VARCHAR(64), -- Hash of market data used for analysis
  model VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour'),
  
  UNIQUE(symbol, analysis_type, market_data_hash)
);

-- AI Strategy Suggestions Cache
-- Cache strategy optimization suggestions
CREATE TABLE IF NOT EXISTS ai_strategy_suggestions_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
  suggestion_type VARCHAR(50) NOT NULL, -- 'optimization', 'risk', 'stop_loss', 'take_profit'
  suggestion_result JSONB NOT NULL,
  strategy_data_hash VARCHAR(64), -- Hash of strategy data
  model VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour'),
  
  UNIQUE(strategy_id, suggestion_type, strategy_data_hash)
);

-- Indexes for performance
CREATE INDEX idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX idx_ai_conversations_created_at ON ai_conversations(created_at DESC);
CREATE INDEX idx_ai_messages_conversation_id ON ai_messages(conversation_id);
CREATE INDEX idx_ai_messages_created_at ON ai_messages(created_at DESC);
CREATE INDEX idx_ai_market_analysis_cache_symbol ON ai_market_analysis_cache(symbol);
CREATE INDEX idx_ai_market_analysis_cache_expires_at ON ai_market_analysis_cache(expires_at);
CREATE INDEX idx_ai_strategy_suggestions_cache_strategy_id ON ai_strategy_suggestions_cache(strategy_id);
CREATE INDEX idx_ai_strategy_suggestions_cache_expires_at ON ai_strategy_suggestions_cache(expires_at);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS ai_conversations_updated_at ON ai_conversations;
CREATE TRIGGER ai_conversations_updated_at
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_conversation_updated_at();

-- Row Level Security (RLS)
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_market_analysis_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_strategy_suggestions_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_conversations
CREATE POLICY "Users can view their own conversations"
  ON ai_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations"
  ON ai_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
  ON ai_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
  ON ai_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for ai_messages
CREATE POLICY "Users can view messages in their conversations"
  ON ai_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ai_conversations
      WHERE ai_conversations.id = ai_messages.conversation_id
      AND ai_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in their conversations"
  ON ai_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_conversations
      WHERE ai_conversations.id = ai_messages.conversation_id
      AND ai_conversations.user_id = auth.uid()
    )
  );

-- RLS Policies for ai_market_analysis_cache (public read, authenticated write)
CREATE POLICY "Authenticated users can read market analysis cache"
  ON ai_market_analysis_cache FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can write market analysis cache"
  ON ai_market_analysis_cache FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies for ai_strategy_suggestions_cache
CREATE POLICY "Users can read suggestions for their strategies"
  ON ai_strategy_suggestions_cache FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM strategies
      WHERE strategies.id = ai_strategy_suggestions_cache.strategy_id
      AND strategies.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can write strategy suggestions cache"
  ON ai_strategy_suggestions_cache FOR ALL
  USING (auth.role() = 'service_role');

-- Comments for documentation
COMMENT ON TABLE ai_conversations IS 'Stores AI assistant conversation sessions';
COMMENT ON TABLE ai_messages IS 'Stores individual messages within AI conversations';
COMMENT ON TABLE ai_market_analysis_cache IS 'Cache for market analysis results to avoid repeated LLM calls';
COMMENT ON TABLE ai_strategy_suggestions_cache IS 'Cache for strategy optimization suggestions';