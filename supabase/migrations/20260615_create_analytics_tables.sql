-- ============================================================
-- Analytics Infrastructure Tables
-- ============================================================
-- Issue #524: Data analytics infrastructure
-- Creates tables for metrics snapshots and reports
-- ============================================================

-- ============================================================
-- Metric Snapshots Table
-- ============================================================
-- Stores calculated metric values for historical tracking

CREATE TABLE IF NOT EXISTS metric_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('north_star', 'secondary')),
    metric_name VARCHAR(100) NOT NULL,
    value DECIMAL(20, 6) NOT NULL,
    previous_value DECIMAL(20, 6),
    change_percent DECIMAL(10, 4),
    metadata JSONB DEFAULT '{}',
    calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for metric snapshots
CREATE INDEX idx_metric_snapshots_name ON metric_snapshots(metric_name);
CREATE INDEX idx_metric_snapshots_calculated ON metric_snapshots(calculated_at DESC);
CREATE INDEX idx_metric_snapshots_period ON metric_snapshots(period_start, period_end);
CREATE INDEX idx_metric_snapshots_type ON metric_snapshots(metric_type);

-- Comments
COMMENT ON TABLE metric_snapshots IS 'Historical snapshots of calculated metrics';
COMMENT ON COLUMN metric_snapshots.metric_type IS 'Type of metric: north_star or secondary';
COMMENT ON COLUMN metric_snapshots.metric_name IS 'Name identifier of the metric';
COMMENT ON COLUMN metric_snapshots.value IS 'Current metric value';
COMMENT ON COLUMN metric_snapshots.previous_value IS 'Previous period value for comparison';
COMMENT ON COLUMN metric_snapshots.change_percent IS 'Percentage change from previous period';
COMMENT ON COLUMN metric_snapshots.metadata IS 'Additional metric data as JSON';

-- ============================================================
-- Analytics Reports Table
-- ============================================================
-- Stores generated daily and weekly reports

CREATE TABLE IF NOT EXISTS analytics_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('daily', 'weekly')),
    report_date DATE NOT NULL,
    content JSONB NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(report_type, report_date)
);

-- Indexes for reports
CREATE INDEX idx_analytics_reports_type ON analytics_reports(report_type);
CREATE INDEX idx_analytics_reports_date ON analytics_reports(report_date DESC);
CREATE INDEX idx_analytics_reports_generated ON analytics_reports(generated_at DESC);

-- Comments
COMMENT ON TABLE analytics_reports IS 'Generated analytics reports (daily/weekly)';
COMMENT ON COLUMN analytics_reports.report_type IS 'Type of report: daily or weekly';
COMMENT ON COLUMN analytics_reports.report_date IS 'Date of the report';
COMMENT ON COLUMN analytics_reports.content IS 'Full report content as JSON';

-- ============================================================
-- User Tracking Events Table (if not exists)
-- ============================================================
-- Ensure the tracking events table exists

CREATE TABLE IF NOT EXISTS user_tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255),
    session_id VARCHAR(255) NOT NULL,
    device_id VARCHAR(255),
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50) NOT NULL,
    event_name VARCHAR(255) NOT NULL,
    properties JSONB DEFAULT '{}',
    page_url TEXT,
    page_title TEXT,
    referrer TEXT,
    user_agent TEXT,
    screen_resolution VARCHAR(50),
    viewport_size VARCHAR(50),
    language VARCHAR(20),
    timezone VARCHAR(50),
    country VARCHAR(100),
    region VARCHAR(100),
    city VARCHAR(100),
    load_time_ms INTEGER,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    event_date DATE GENERATED ALWAYS AS (DATE(occurred_at)) STORED,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for tracking events
CREATE INDEX IF NOT EXISTS idx_tracking_events_user ON user_tracking_events(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_session ON user_tracking_events(session_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_type ON user_tracking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_tracking_events_category ON user_tracking_events(event_category);
CREATE INDEX IF NOT EXISTS idx_tracking_events_occurred ON user_tracking_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_events_date ON user_tracking_events(event_date);

-- Partial indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tracking_events_signup ON user_tracking_events(event_type) 
    WHERE event_type = 'user_signup';
CREATE INDEX IF NOT EXISTS idx_tracking_events_pageview ON user_tracking_events(event_type) 
    WHERE event_type = 'page_view';
CREATE INDEX IF NOT EXISTS idx_tracking_events_order ON user_tracking_events(event_type) 
    WHERE event_type IN ('order_placed', 'order_filled', 'order_cancelled');

-- Comments
COMMENT ON TABLE user_tracking_events IS 'User behavior tracking events';
COMMENT ON COLUMN user_tracking_events.event_date IS 'Generated column for efficient date queries';

-- ============================================================
-- User Sessions Table (if not exists)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255),
    device_id VARCHAR(255),
    first_event_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_event_at TIMESTAMP WITH TIME ZONE NOT NULL,
    event_count INTEGER DEFAULT 1,
    entry_page TEXT,
    exit_page TEXT,
    entry_referrer TEXT,
    user_agent TEXT,
    screen_resolution VARCHAR(50),
    language VARCHAR(20),
    timezone VARCHAR(50),
    country VARCHAR(100),
    region VARCHAR(100),
    city VARCHAR(100),
    utm_source VARCHAR(255),
    utm_medium VARCHAR(255),
    utm_campaign VARCHAR(255),
    utm_term VARCHAR(255),
    utm_content VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_first_event ON user_sessions(first_event_at DESC);

-- Comments
COMMENT ON TABLE user_sessions IS 'User session aggregation';

-- ============================================================
-- Daily Analytics Summary Table (if not exists)
-- ============================================================

CREATE TABLE IF NOT EXISTS daily_analytics_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE UNIQUE NOT NULL,
    page_views INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    unique_sessions INTEGER DEFAULT 0,
    avg_session_duration_seconds DECIMAL(10, 2) DEFAULT 0,
    bounce_rate DECIMAL(5, 2) DEFAULT 0,
    pages_per_session DECIMAL(5, 2) DEFAULT 0,
    event_counts JSONB DEFAULT '{}',
    top_pages JSONB DEFAULT '[]',
    traffic_sources JSONB DEFAULT '[]',
    top_countries JSONB DEFAULT '[]',
    device_breakdown JSONB DEFAULT '{"mobile": 0, "desktop": 0}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for daily summary
CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON daily_analytics_summary(date DESC);

-- Comments
COMMENT ON TABLE daily_analytics_summary IS 'Pre-aggregated daily analytics data';

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE metric_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_analytics_summary ENABLE ROW LEVEL SECURITY;

-- Service role can access all tables
CREATE POLICY "Service role can manage metric_snapshots" ON metric_snapshots
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage analytics_reports" ON analytics_reports
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage user_tracking_events" ON user_tracking_events
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage user_sessions" ON user_sessions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage daily_analytics_summary" ON daily_analytics_summary
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users can insert their own tracking events (for client-side tracking)
CREATE POLICY "Users can insert own tracking events" ON user_tracking_events
    FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id OR user_id IS NULL);

-- ============================================================
-- Functions
-- ============================================================

-- Function to aggregate daily analytics
CREATE OR REPLACE FUNCTION aggregate_daily_analytics(target_date DATE)
RETURNS void AS $$
DECLARE
    v_page_views INTEGER;
    v_unique_visitors INTEGER;
    v_unique_sessions INTEGER;
    v_avg_duration DECIMAL(10, 2);
    v_bounce_rate DECIMAL(5, 2);
    v_pages_per_session DECIMAL(5, 2);
BEGIN
    -- Calculate metrics
    SELECT 
        COUNT(*)::INTEGER,
        COUNT(DISTINCT user_id)::INTEGER,
        COUNT(DISTINCT session_id)::INTEGER
    INTO v_page_views, v_unique_visitors, v_unique_sessions
    FROM user_tracking_events
    WHERE event_type = 'page_view'
      AND event_date = target_date;

    -- Calculate average session duration
    SELECT COALESCE(AVG(duration_seconds), 0)
    INTO v_avg_duration
    FROM user_sessions
    WHERE DATE(first_event_at) = target_date
      AND duration_seconds IS NOT NULL;

    -- Calculate bounce rate (sessions with only 1 page view)
    SELECT COALESCE(
        (COUNT(*) FILTER (WHERE event_count = 1)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 
        0
    )
    INTO v_bounce_rate
    FROM user_sessions
    WHERE DATE(first_event_at) = target_date;

    -- Calculate pages per session
    SELECT COALESCE(AVG(event_count), 0)
    INTO v_pages_per_session
    FROM user_sessions
    WHERE DATE(first_event_at) = target_date;

    -- Upsert summary
    INSERT INTO daily_analytics_summary (
        date, page_views, unique_visitors, unique_sessions,
        avg_session_duration_seconds, bounce_rate, pages_per_session,
        updated_at
    ) VALUES (
        target_date, v_page_views, v_unique_visitors, v_unique_sessions,
        v_avg_duration, v_bounce_rate, v_pages_per_session, NOW()
    ) ON CONFLICT (date) DO UPDATE SET
        page_views = EXCLUDED.page_views,
        unique_visitors = EXCLUDED.unique_visitors,
        unique_sessions = EXCLUDED.unique_sessions,
        avg_session_duration_seconds = EXCLUDED.avg_session_duration_seconds,
        bounce_rate = EXCLUDED.bounce_rate,
        pages_per_session = EXCLUDED.pages_per_session,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get event counts
CREATE OR REPLACE FUNCTION get_event_counts(
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    user_id_filter VARCHAR DEFAULT NULL,
    granularity VARCHAR DEFAULT 'day'
)
RETURNS TABLE (
    event_type VARCHAR,
    event_category VARCHAR,
    count BIGINT,
    date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.event_type,
        e.event_category,
        COUNT(*)::BIGINT as count,
        CASE 
            WHEN granularity = 'hour' THEN date_trunc('hour', e.occurred_at)
            WHEN granularity = 'week' THEN date_trunc('week', e.occurred_at)
            WHEN granularity = 'month' THEN date_trunc('month', e.occurred_at)
            ELSE date_trunc('day', e.occurred_at)
        END as date
    FROM user_tracking_events e
    WHERE e.occurred_at >= start_date
      AND e.occurred_at <= end_date
      AND (user_id_filter IS NULL OR e.user_id = user_id_filter)
    GROUP BY 
        e.event_type,
        e.event_category,
        CASE 
            WHEN granularity = 'hour' THEN date_trunc('hour', e.occurred_at)
            WHEN granularity = 'week' THEN date_trunc('week', e.occurred_at)
            WHEN granularity = 'month' THEN date_trunc('month', e.occurred_at)
            ELSE date_trunc('day', e.occurred_at)
        END
    ORDER BY date DESC, count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Data Retention Policy
-- ============================================================

-- Function to clean old events
CREATE OR REPLACE FUNCTION clean_old_tracking_events(days_to_keep INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_tracking_events
    WHERE occurred_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Grants
-- ============================================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;