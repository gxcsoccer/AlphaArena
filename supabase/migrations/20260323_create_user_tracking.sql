-- User Tracking Tables
-- Analytics events and user behavior tracking

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User tracking events table
CREATE TABLE IF NOT EXISTS user_tracking_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User identification
  user_id TEXT,
  session_id TEXT NOT NULL,
  device_id TEXT,
  
  -- Event data
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL,
  event_name TEXT NOT NULL,
  
  -- Event properties (flexible JSON)
  properties JSONB DEFAULT '{}',
  
  -- Page/context information
  page_url TEXT,
  page_title TEXT,
  referrer TEXT,
  
  -- Device/Browser info
  user_agent TEXT,
  screen_resolution TEXT,
  viewport_size TEXT,
  language TEXT,
  timezone TEXT,
  
  -- Geographic info (from IP)
  country TEXT,
  region TEXT,
  city TEXT,
  
  -- Performance metrics
  load_time_ms INTEGER,
  
  -- Timestamps
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Index-optimized fields for common queries
  event_date DATE GENERATED ALWAYS AS (DATE(occurred_at)) STORED,
  event_hour INTEGER GENERATED ALWAYS AS (EXTRACT(HOUR FROM occurred_at)) STORED
);

-- Create indexes for efficient querying
CREATE INDEX idx_tracking_events_user_id ON user_tracking_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_tracking_events_session_id ON user_tracking_events(session_id);
CREATE INDEX idx_tracking_events_type ON user_tracking_events(event_type);
CREATE INDEX idx_tracking_events_category ON user_tracking_events(event_category);
CREATE INDEX idx_tracking_events_date ON user_tracking_events(event_date);
CREATE INDEX idx_tracking_events_date_hour ON user_tracking_events(event_date, event_hour);
CREATE INDEX idx_tracking_events_occurred ON user_tracking_events(occurred_at DESC);

-- User sessions table for session tracking
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT UNIQUE NOT NULL,
  user_id TEXT,
  device_id TEXT,
  
  -- Session metadata
  first_event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_count INTEGER DEFAULT 0,
  
  -- Entry/Exit info
  entry_page TEXT,
  exit_page TEXT,
  entry_referrer TEXT,
  
  -- Device info
  user_agent TEXT,
  screen_resolution TEXT,
  language TEXT,
  timezone TEXT,
  
  -- Geographic info
  country TEXT,
  region TEXT,
  city TEXT,
  
  -- UTM parameters for marketing attribution
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  
  -- Session status
  is_active BOOLEAN DEFAULT TRUE,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_session_id ON user_sessions(session_id);
CREATE INDEX idx_sessions_user_id ON user_sessions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_sessions_active ON user_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_sessions_first_event ON user_sessions(first_event_at DESC);

-- Daily analytics aggregations table
CREATE TABLE IF NOT EXISTS daily_analytics_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL UNIQUE,
  
  -- Page view metrics
  page_views BIGINT DEFAULT 0,
  unique_visitors BIGINT DEFAULT 0,
  unique_sessions BIGINT DEFAULT 0,
  
  -- User engagement
  avg_session_duration_seconds DOUBLE PRECISION,
  bounce_rate DOUBLE PRECISION,
  pages_per_session DOUBLE PRECISION,
  
  -- Event counts by category
  event_counts JSONB DEFAULT '{}',
  
  -- Top pages
  top_pages JSONB DEFAULT '[]',
  
  -- Traffic sources
  traffic_sources JSONB DEFAULT '[]',
  
  -- Geographic distribution
  top_countries JSONB DEFAULT '[]',
  
  -- Device breakdown
  device_breakdown JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_daily_analytics_date ON daily_analytics_summary(date DESC);

-- User event funnels for tracking conversion
CREATE TABLE IF NOT EXISTS user_event_funnels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  funnel_name TEXT NOT NULL,
  step_name TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  properties JSONB DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_funnels_user ON user_event_funnels(user_id);
CREATE INDEX idx_funnels_session ON user_event_funnels(session_id);
CREATE INDEX idx_funnels_name ON user_event_funnels(funnel_name);
CREATE INDEX idx_funnels_occurred ON user_event_funnels(occurred_at DESC);

-- Row Level Security (RLS) policies
ALTER TABLE user_tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_analytics_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_event_funnels ENABLE ROW LEVEL SECURITY;

-- Service role can access everything (for backend)
CREATE POLICY "Service role full access on tracking events" ON user_tracking_events
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Service role full access on sessions" ON user_sessions
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Service role full access on analytics summary" ON daily_analytics_summary
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Service role full access on funnels" ON user_event_funnels
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Anonymous users can insert their own events (for client-side tracking)
CREATE POLICY "Anyone can insert tracking events" ON user_tracking_events
  FOR INSERT WITH CHECK (TRUE);

-- Function to update session on new event
CREATE OR REPLACE FUNCTION update_session_on_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_sessions (
    session_id, user_id, device_id, 
    first_event_at, last_event_at, event_count,
    entry_page, entry_referrer, user_agent, screen_resolution, language, timezone
  )
  VALUES (
    NEW.session_id, NEW.user_id, NEW.device_id,
    NEW.occurred_at, NEW.occurred_at, 1,
    NEW.page_url, NEW.referrer, NEW.user_agent, NEW.screen_resolution, NEW.language, NEW.timezone
  )
  ON CONFLICT (session_id) DO UPDATE SET
    user_id = COALESCE(EXCLUDED.user_id, user_sessions.user_id),
    last_event_at = NEW.occurred_at,
    event_count = user_sessions.event_count + 1,
    exit_page = NEW.page_url,
    updated_at = NOW(),
    duration_seconds = EXTRACT(EPOCH FROM (NEW.occurred_at - user_sessions.first_event_at));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update sessions
DROP TRIGGER IF EXISTS update_session_trigger ON user_tracking_events;
CREATE TRIGGER update_session_trigger
  AFTER INSERT ON user_tracking_events
  FOR EACH ROW
  EXECUTE FUNCTION update_session_on_event();

-- Function to aggregate daily analytics
CREATE OR REPLACE FUNCTION aggregate_daily_analytics(target_date DATE DEFAULT CURRENT_DATE - 1)
RETURNS VOID AS $$
DECLARE
  v_page_views BIGINT;
  v_unique_visitors BIGINT;
  v_unique_sessions BIGINT;
  v_avg_duration DOUBLE PRECISION;
  v_bounce_rate DOUBLE PRECISION;
  v_pages_per_session DOUBLE PRECISION;
  v_event_counts JSONB;
  v_top_pages JSONB;
  v_traffic_sources JSONB;
  v_top_countries JSONB;
  v_device_breakdown JSONB;
BEGIN
  -- Calculate basic metrics
  SELECT COUNT(*) INTO v_page_views
  FROM user_tracking_events
  WHERE event_type = 'page_view' AND event_date = target_date;
  
  SELECT COUNT(DISTINCT user_id) INTO v_unique_visitors
  FROM user_tracking_events
  WHERE event_date = target_date AND user_id IS NOT NULL;
  
  SELECT COUNT(DISTINCT session_id) INTO v_unique_sessions
  FROM user_tracking_events
  WHERE event_date = target_date;
  
  -- Calculate session metrics
  SELECT 
    AVG(duration_seconds),
    AVG(CASE WHEN event_count = 1 THEN 1 ELSE 0 END) * 100,
    AVG(event_count)
  INTO v_avg_duration, v_bounce_rate, v_pages_per_session
  FROM user_sessions
  WHERE DATE(first_event_at) = target_date;
  
  -- Event counts by category
  SELECT jsonb_object_agg(event_category, cnt)
  INTO v_event_counts
  FROM (
    SELECT event_category, COUNT(*) as cnt
    FROM user_tracking_events
    WHERE event_date = target_date
    GROUP BY event_category
  ) sub;
  
  -- Top pages
  SELECT jsonb_agg(row_to_json(t))
  INTO v_top_pages
  FROM (
    SELECT page_url as url, COUNT(*) as views
    FROM user_tracking_events
    WHERE event_type = 'page_view' AND event_date = target_date
    GROUP BY page_url
    ORDER BY views DESC
    LIMIT 20
  ) t;
  
  -- Traffic sources
  SELECT jsonb_agg(row_to_json(t))
  INTO v_traffic_sources
  FROM (
    SELECT 
      COALESCE(utm_source, 'direct') as source,
      COUNT(DISTINCT session_id) as sessions
    FROM user_sessions
    WHERE DATE(first_event_at) = target_date
    GROUP BY utm_source
    ORDER BY sessions DESC
    LIMIT 10
  ) t;
  
  -- Top countries
  SELECT jsonb_agg(row_to_json(t))
  INTO v_top_countries
  FROM (
    SELECT 
      COALESCE(country, 'unknown') as country,
      COUNT(DISTINCT session_id) as sessions
    FROM user_tracking_events
    WHERE event_date = target_date
    GROUP BY country
    ORDER BY sessions DESC
    LIMIT 10
  ) t;
  
  -- Device breakdown
  SELECT jsonb_build_object(
    'mobile', COUNT(CASE WHEN user_agent ~* 'mobile|android|iphone' THEN 1 END),
    'desktop', COUNT(CASE WHEN user_agent !~* 'mobile|android|iphone' THEN 1 END)
  )
  INTO v_device_breakdown
  FROM user_sessions
  WHERE DATE(first_event_at) = target_date;
  
  -- Upsert daily summary
  INSERT INTO daily_analytics_summary (
    date, page_views, unique_visitors, unique_sessions,
    avg_session_duration_seconds, bounce_rate, pages_per_session,
    event_counts, top_pages, traffic_sources, top_countries, device_breakdown
  )
  VALUES (
    target_date, v_page_views, v_unique_visitors, v_unique_sessions,
    v_avg_duration, v_bounce_rate, v_pages_per_session,
    v_event_counts, v_top_pages, v_traffic_sources, v_top_countries, v_device_breakdown
  )
  ON CONFLICT (date) DO UPDATE SET
    page_views = EXCLUDED.page_views,
    unique_visitors = EXCLUDED.unique_visitors,
    unique_sessions = EXCLUDED.unique_sessions,
    avg_session_duration_seconds = EXCLUDED.avg_session_duration_seconds,
    bounce_rate = EXCLUDED.bounce_rate,
    pages_per_session = EXCLUDED.pages_per_session,
    event_counts = EXCLUDED.event_counts,
    top_pages = EXCLUDED.top_pages,
    traffic_sources = EXCLUDED.traffic_sources,
    top_countries = EXCLUDED.top_countries,
    device_breakdown = EXCLUDED.device_breakdown,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE user_tracking_events IS 'Raw user tracking events for analytics';
COMMENT ON TABLE user_sessions IS 'Aggregated session information';
COMMENT ON TABLE daily_analytics_summary IS 'Pre-aggregated daily analytics metrics';
COMMENT ON TABLE user_event_funnels IS 'Funnel tracking for conversion analysis';