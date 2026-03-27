-- Strategy Community Tables (Issue #673)
-- Tables for strategy sharing, leaderboards, and community features

-- ==================== Strategy Reports Table ====================
-- For reporting inappropriate/spam/fraud strategies

CREATE TABLE IF NOT EXISTS strategy_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id VARCHAR(255) NOT NULL,
  strategy_id UUID NOT NULL,
  report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('spam', 'inappropriate', 'fraud', 'copyright', 'other')),
  reason TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  resolved_by VARCHAR(255),
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_strategy_reports_strategy
    FOREIGN KEY (strategy_id) REFERENCES marketplace_strategies(id) ON DELETE CASCADE
);

CREATE INDEX idx_strategy_reports_reporter ON strategy_reports(reporter_id);
CREATE INDEX idx_strategy_reports_strategy ON strategy_reports(strategy_id);
CREATE INDEX idx_strategy_reports_status ON strategy_reports(status);
CREATE INDEX idx_strategy_reports_type ON strategy_reports(report_type);

-- Enable RLS
ALTER TABLE strategy_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own reports"
  ON strategy_reports FOR SELECT
  USING (reporter_id = current_setting('request.jwt.claims')->>'sub');

CREATE POLICY "Users can create reports"
  ON strategy_reports FOR INSERT
  WITH CHECK (reporter_id = current_setting('request.jwt.claims')->>'sub');

CREATE POLICY "Admins can manage all reports"
  ON strategy_reports FOR ALL
  USING (current_setting('request.jwt.claims')->>'role' = 'admin');

-- ==================== Strategy Leaderboard Snapshots ====================
-- For caching leaderboard data

CREATE TABLE IF NOT EXISTS strategy_leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL CHECK (type IN ('returns', 'popularity', 'stability', 'win_rate', 'recent')),
  period VARCHAR(50) NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'all_time')),
  category VARCHAR(100),
  entries JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  UNIQUE(type, period, category)
);

CREATE INDEX idx_leaderboard_snapshots_type_period ON strategy_leaderboard_snapshots(type, period);
CREATE INDEX idx_leaderboard_snapshots_expires ON strategy_leaderboard_snapshots(expires_at);

-- ==================== Strategy Rankings Cache ====================
-- For caching individual strategy rankings

CREATE TABLE IF NOT EXISTS strategy_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL UNIQUE,
  category VARCHAR(100),
  return_rank INTEGER DEFAULT 0,
  popularity_rank INTEGER DEFAULT 0,
  stability_rank INTEGER DEFAULT 0,
  overall_rank INTEGER DEFAULT 0,
  return_score DECIMAL(10, 4) DEFAULT 0,
  popularity_score DECIMAL(10, 4) DEFAULT 0,
  stability_score DECIMAL(10, 4) DEFAULT 0,
  overall_score DECIMAL(10, 4) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_strategy_rankings_strategy
    FOREIGN KEY (strategy_id) REFERENCES marketplace_strategies(id) ON DELETE CASCADE
);

CREATE INDEX idx_strategy_rankings_overall ON strategy_rankings(overall_rank);
CREATE INDEX idx_strategy_rankings_category ON strategy_rankings(category);

-- ==================== Community Statistics Cache ====================
-- For caching overall community statistics

CREATE TABLE IF NOT EXISTS community_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_strategies INTEGER DEFAULT 0,
  active_strategies INTEGER DEFAULT 0,
  total_subscriptions INTEGER DEFAULT 0,
  total_signals INTEGER DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  total_publishers INTEGER DEFAULT 0,
  top_categories JSONB DEFAULT '[]',
  recent_growth JSONB DEFAULT '{"newStrategies": 0, "newSubscriptions": 0, "newSignals": 0}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Single row constraint
  CONSTRAINT single_row CHECK (id IS NOT NULL)
);

-- Insert default row
INSERT INTO community_stats (id) VALUES (gen_random_uuid()) ON CONFLICT DO NOTHING;

-- ==================== Functions ====================

-- Function to update strategy rankings
CREATE OR REPLACE FUNCTION update_strategy_rankings()
RETURNS void AS $$
DECLARE
  strategy_record RECORD;
  rank_record RECORD;
  return_rank_val INTEGER;
  popularity_rank_val INTEGER;
  stability_rank_val INTEGER;
BEGIN
  -- Clear existing rankings
  TRUNCATE strategy_rankings;
  
  -- Calculate rankings for each approved public strategy
  FOR strategy_record IN 
    SELECT id, category, performance_metrics, subscriber_count
    FROM marketplace_strategies
    WHERE status = 'approved' AND visibility = 'public'
  LOOP
    -- Calculate return rank
    SELECT COUNT(*) + 1 INTO return_rank_val
    FROM marketplace_strategies s
    WHERE s.status = 'approved' 
      AND s.visibility = 'public'
      AND (s.performance_metrics->>'totalReturn')::decimal > (strategy_record.performance_metrics->>'totalReturn')::decimal;
    
    -- Calculate popularity rank
    SELECT COUNT(*) + 1 INTO popularity_rank_val
    FROM marketplace_strategies s
    WHERE s.status = 'approved' 
      AND s.visibility = 'public'
      AND s.subscriber_count > strategy_record.subscriber_count;
    
    -- Calculate stability rank
    SELECT COUNT(*) + 1 INTO stability_rank_val
    FROM marketplace_strategies s
    WHERE s.status = 'approved' 
      AND s.visibility = 'public'
      AND (s.performance_metrics->>'sharpeRatio')::decimal > (strategy_record.performance_metrics->>'sharpeRatio')::decimal;
    
    -- Insert ranking
    INSERT INTO strategy_rankings (
      strategy_id,
      category,
      return_rank,
      popularity_rank,
      stability_rank,
      overall_rank,
      return_score,
      popularity_score,
      stability_score,
      overall_score
    ) VALUES (
      strategy_record.id,
      strategy_record.category,
      return_rank_val,
      popularity_rank_val,
      stability_rank_val,
      (return_rank_val + popularity_rank_val + stability_rank_val) / 3,
      COALESCE((strategy_record.performance_metrics->>'totalReturn')::decimal, 0),
      strategy_record.subscriber_count,
      COALESCE((strategy_record.performance_metrics->>'sharpeRatio')::decimal, 0),
      0
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to update community stats
CREATE OR REPLACE FUNCTION update_community_stats()
RETURNS void AS $$
DECLARE
  total_strats INTEGER;
  active_strats INTEGER;
  total_subs INTEGER;
  total_sigs INTEGER;
  total_revs INTEGER;
  total_pubs INTEGER;
BEGIN
  -- Count total strategies
  SELECT COUNT(*) INTO total_strats FROM marketplace_strategies;
  
  -- Count active strategies
  SELECT COUNT(*) INTO active_strats FROM marketplace_strategies WHERE status = 'approved';
  
  -- Count total subscriptions
  SELECT COUNT(*) INTO total_subs FROM strategy_marketplace_subscriptions;
  
  -- Count total signals
  SELECT COUNT(*) INTO total_sigs FROM marketplace_strategy_signals;
  
  -- Count total reviews
  SELECT COUNT(*) INTO total_revs FROM strategy_reviews;
  
  -- Count unique publishers
  SELECT COUNT(DISTINCT publisher_id) INTO total_pubs FROM marketplace_strategies;
  
  -- Update stats
  UPDATE community_stats SET
    total_strategies = total_strats,
    active_strategies = active_strats,
    total_subscriptions = total_subs,
    total_signals = total_sigs,
    total_reviews = total_revs,
    total_publishers = total_pubs,
    top_categories = (
      SELECT jsonb_agg(jsonb_build_object('category', category, 'count', cnt))
      FROM (
        SELECT category, COUNT(*) as cnt
        FROM marketplace_strategies
        WHERE status = 'approved' AND visibility = 'public'
        GROUP BY category
        ORDER BY cnt DESC
        LIMIT 10
      ) cat_stats
    ),
    recent_growth = jsonb_build_object(
      'newStrategies', (SELECT COUNT(*) FROM marketplace_strategies WHERE created_at > NOW() - INTERVAL '7 days'),
      'newSubscriptions', (SELECT COUNT(*) FROM strategy_marketplace_subscriptions WHERE created_at > NOW() - INTERVAL '7 days'),
      'newSignals', (SELECT COUNT(*) FROM marketplace_strategy_signals WHERE created_at > NOW() - INTERVAL '7 days')
    ),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ==================== Triggers ====================

-- Trigger to update community stats when strategies change
CREATE OR REPLACE FUNCTION trigger_update_community_stats()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_community_stats();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_community_stats_after_strategy
AFTER INSERT OR UPDATE OR DELETE ON marketplace_strategies
FOR EACH STATEMENT EXECUTE FUNCTION trigger_update_community_stats();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_strategy_reports_updated_at
BEFORE UPDATE ON strategy_reports
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_strategy_rankings_updated_at
BEFORE UPDATE ON strategy_rankings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== Comments ====================

COMMENT ON TABLE strategy_reports IS 'Stores user reports for strategies (spam, fraud, etc.)';
COMMENT ON TABLE strategy_leaderboard_snapshots IS 'Cached leaderboard snapshots for performance';
COMMENT ON TABLE strategy_rankings IS 'Cached strategy rankings for quick lookup';
COMMENT ON TABLE community_stats IS 'Overall community statistics cache';

COMMENT ON COLUMN strategy_reports.report_type IS 'Type of report: spam, inappropriate, fraud, copyright, other';
COMMENT ON COLUMN strategy_reports.status IS 'Report status: pending, reviewing, resolved, dismissed';
COMMENT ON COLUMN strategy_leaderboard_snapshots.type IS 'Leaderboard type: returns, popularity, stability, win_rate, recent';
COMMENT ON COLUMN strategy_leaderboard_snapshots.period IS 'Time period: daily, weekly, monthly, all_time';