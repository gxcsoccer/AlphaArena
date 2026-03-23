-- Share Events Tables Migration
-- Creates tables for tracking social sharing events and statistics

-- Share Events Table
-- Tracks each share action across different platforms
CREATE TABLE IF NOT EXISTS share_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, -- Nullable for anonymous shares
  platform VARCHAR(20) NOT NULL CHECK (platform IN (
    'wechat', 
    'wechat_moments', 
    'weibo', 
    'twitter', 
    'linkedin', 
    'facebook', 
    'clipboard', 
    'native'
  )),
  content_type VARCHAR(30) NOT NULL CHECK (content_type IN (
    'profile', 
    'trade_result', 
    'strategy_performance', 
    'referral_link',
    'leaderboard',
    'custom'
  )),
  content_id VARCHAR(100), -- ID of the shared content (trade ID, strategy ID, etc.)
  referral_code VARCHAR(20), -- Associated referral code if any
  
  -- UTM tracking
  utm_source VARCHAR(50) NOT NULL DEFAULT 'web',
  utm_medium VARCHAR(50) NOT NULL DEFAULT 'social',
  utm_campaign VARCHAR(50) NOT NULL DEFAULT 'share',
  
  -- Share details
  share_url TEXT,
  user_agent TEXT,
  ip_address VARCHAR(45),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_share_events_user_id ON share_events(user_id);
CREATE INDEX IF NOT EXISTS idx_share_events_platform ON share_events(platform);
CREATE INDEX IF NOT EXISTS idx_share_events_content_type ON share_events(content_type);
CREATE INDEX IF NOT EXISTS idx_share_events_content_id ON share_events(content_id);
CREATE INDEX IF NOT EXISTS idx_share_events_referral_code ON share_events(referral_code);
CREATE INDEX IF NOT EXISTS idx_share_events_created_at ON share_events(created_at DESC);

-- Row Level Security (RLS)
ALTER TABLE share_events ENABLE ROW LEVEL SECURITY;

-- Policies for share_events
CREATE POLICY "Users can view own share events"
  ON share_events FOR SELECT
  USING (auth.uid()::text = user_id::text OR auth.uid() = user_id);

CREATE POLICY "Anyone can insert share events"
  ON share_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can manage share events"
  ON share_events FOR ALL
  USING (auth.role() = 'service_role');

-- RPC Function: Get global share statistics
CREATE OR REPLACE FUNCTION get_share_stats(
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_total_shares BIGINT;
  v_platform_distribution JSONB;
  v_content_type_distribution JSONB;
  v_recent_shares JSONB;
  v_trend_data JSONB;
BEGIN
  -- Get total shares
  SELECT COUNT(*) INTO v_total_shares
  FROM share_events
  WHERE (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date);

  -- Get platform distribution
  SELECT jsonb_object_agg(platform, count)
  INTO v_platform_distribution
  FROM (
    SELECT platform, COUNT(*) as count
    FROM share_events
    WHERE (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
    GROUP BY platform
  ) sub;

  -- Get content type distribution
  SELECT jsonb_object_agg(content_type, count)
  INTO v_content_type_distribution
  FROM (
    SELECT content_type, COUNT(*) as count
    FROM share_events
    WHERE (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
    GROUP BY content_type
  ) sub;

  -- Get recent shares (last 10)
  SELECT jsonb_agg(
    jsonb_build_object(
      'platform', platform,
      'content_type', content_type,
      'created_at', created_at
    )
  )
  INTO v_recent_shares
  FROM (
    SELECT platform, content_type, created_at
    FROM share_events
    WHERE (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
    ORDER BY created_at DESC
    LIMIT 10
  ) sub;

  -- Get trend data (daily counts for last 30 days)
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', date,
      'count', count
    )
  )
  INTO v_trend_data
  FROM (
    SELECT 
      DATE(created_at)::TEXT as date,
      COUNT(*) as count
    FROM share_events
    WHERE created_at >= NOW() - INTERVAL '30 days'
      AND (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  ) sub;

  RETURN jsonb_build_object(
    'total_shares', v_total_shares,
    'platform_distribution', COALESCE(v_platform_distribution, '{}'::jsonb),
    'content_type_distribution', COALESCE(v_content_type_distribution, '{}'::jsonb),
    'recent_shares', COALESCE(v_recent_shares, '[]'::jsonb),
    'trend_data', COALESCE(v_trend_data, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC Function: Get user share statistics
CREATE OR REPLACE FUNCTION get_user_share_stats(
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_total_shares BIGINT;
  v_referral_shares BIGINT;
  v_platform_distribution JSONB;
  v_top_content_type VARCHAR(30);
  v_shares_trend JSONB;
BEGIN
  -- Get total shares for user
  SELECT COUNT(*) INTO v_total_shares
  FROM share_events
  WHERE user_id = p_user_id;

  -- Get referral shares count
  SELECT COUNT(*) INTO v_referral_shares
  FROM share_events
  WHERE user_id = p_user_id AND content_type = 'referral_link';

  -- Get platform distribution
  SELECT jsonb_object_agg(platform, count)
  INTO v_platform_distribution
  FROM (
    SELECT platform, COUNT(*) as count
    FROM share_events
    WHERE user_id = p_user_id
    GROUP BY platform
  ) sub;

  -- Get top content type
  SELECT content_type INTO v_top_content_type
  FROM share_events
  WHERE user_id = p_user_id
  GROUP BY content_type
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Get shares trend (daily counts for last 30 days)
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', date,
      'count', count
    )
  )
  INTO v_shares_trend
  FROM (
    SELECT 
      DATE(created_at)::TEXT as date,
      COUNT(*) as count
    FROM share_events
    WHERE user_id = p_user_id
      AND created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  ) sub;

  RETURN jsonb_build_object(
    'total_shares', v_total_shares,
    'referral_shares', v_referral_shares,
    'platform_distribution', COALESCE(v_platform_distribution, '{}'::jsonb),
    'top_content_type', COALESCE(v_top_content_type, 'profile'),
    'shares_trend', COALESCE(v_shares_trend, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC Function: Get share-to-signup conversion rate
CREATE OR REPLACE FUNCTION get_share_conversion_rate(
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_total_shares BIGINT;
  v_total_conversions BIGINT;
  v_conversion_rate DECIMAL(5,4);
BEGIN
  -- Count total shares with referral codes
  SELECT COUNT(DISTINCT referral_code) INTO v_total_shares
  FROM share_events
  WHERE referral_code IS NOT NULL
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date);

  -- Count conversions (users who registered via referral)
  SELECT COUNT(*) INTO v_total_conversions
  FROM referrals r
  JOIN referral_codes rc ON r.referrer_code_id = rc.id
  WHERE r.status IN ('registered', 'activated', 'rewarded')
    AND (p_start_date IS NULL OR r.registered_at >= p_start_date)
    AND (p_end_date IS NULL OR r.registered_at <= p_end_date);

  -- Calculate conversion rate
  IF v_total_shares > 0 THEN
    v_conversion_rate := v_total_conversions::DECIMAL / v_total_shares;
  ELSE
    v_conversion_rate := 0;
  END IF;

  RETURN jsonb_build_object(
    'total_shares', v_total_shares,
    'total_conversions', v_total_conversions,
    'conversion_rate', v_conversion_rate
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE share_events IS 'Tracks social sharing events across platforms';
COMMENT ON FUNCTION get_share_stats IS 'Returns global share statistics (admin only)';
COMMENT ON FUNCTION get_user_share_stats IS 'Returns share statistics for a specific user';
COMMENT ON FUNCTION get_share_conversion_rate IS 'Returns share-to-signup conversion rate (admin only)';