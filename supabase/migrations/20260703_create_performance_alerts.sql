-- Performance Thresholds and Alerts Tables
-- Migration: 20260703_create_performance_alerts.sql
-- Description: Creates tables for performance threshold management and alerting
-- Issue: #663 APM Error Fix and Performance Optimization

-- ============================================================
-- Performance Thresholds Table
-- ============================================================
-- Stores configurable thresholds for performance metrics

CREATE TABLE IF NOT EXISTS performance_thresholds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type VARCHAR(50) NOT NULL UNIQUE,
    warning_threshold DECIMAL(10, 2) NOT NULL,
    critical_threshold DECIMAL(10, 2) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    notification_channels JSONB DEFAULT '{"in_app": true, "email": false, "webhook": false}',
    cooldown_minutes INTEGER DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_metric_type CHECK (metric_type IN (
        'lcp', 'fcp', 'fid', 'cls', 'ttfb', 'inp', 'api_latency', 'error_rate'
    )),
    CONSTRAINT valid_thresholds CHECK (warning_threshold < critical_threshold)
);

-- Insert default thresholds based on Google's Core Web Vitals recommendations
INSERT INTO performance_thresholds (metric_type, warning_threshold, critical_threshold, enabled, notification_channels, cooldown_minutes)
VALUES
    ('lcp', 2500, 4000, TRUE, '{"in_app": true, "email": true, "webhook": false}', 30),
    ('fcp', 1800, 3000, TRUE, '{"in_app": true, "email": true, "webhook": false}', 30),
    ('fid', 100, 300, TRUE, '{"in_app": true, "email": false, "webhook": false}', 30),
    ('cls', 0.1, 0.25, TRUE, '{"in_app": true, "email": false, "webhook": false}', 30),
    ('ttfb', 800, 1800, TRUE, '{"in_app": true, "email": true, "webhook": false}', 15),
    ('inp', 200, 500, TRUE, '{"in_app": true, "email": false, "webhook": false}', 30),
    ('api_latency', 500, 1000, TRUE, '{"in_app": true, "email": true, "webhook": true}', 10),
    ('error_rate', 5, 10, TRUE, '{"in_app": true, "email": true, "webhook": true}', 5)
ON CONFLICT (metric_type) DO NOTHING;

-- ============================================================
-- Performance Alerts Table
-- ============================================================
-- Stores performance alerts when thresholds are exceeded

CREATE TABLE IF NOT EXISTS performance_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('warning', 'critical')),
    current_value DECIMAL(10, 4) NOT NULL,
    threshold_value DECIMAL(10, 4) NOT NULL,
    page VARCHAR(255),
    device_type VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
    acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_alert_metric_type CHECK (metric_type IN (
        'lcp', 'fcp', 'fid', 'cls', 'ttfb', 'inp', 'api_latency', 'error_rate'
    ))
);

-- Indexes for performance_alerts
CREATE INDEX idx_performance_alerts_status ON performance_alerts(status);
CREATE INDEX idx_performance_alerts_metric_type ON performance_alerts(metric_type);
CREATE INDEX idx_performance_alerts_severity ON performance_alerts(severity);
CREATE INDEX idx_performance_alerts_created_at ON performance_alerts(created_at DESC);
CREATE INDEX idx_performance_alerts_active ON performance_alerts(created_at DESC) WHERE status = 'active';

-- ============================================================
-- Error Aggregation Tables
-- ============================================================
-- Pre-aggregated error statistics for faster queries

CREATE TABLE IF NOT EXISTS error_aggregations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_fingerprint VARCHAR(64) NOT NULL, -- MD5 hash of error signature
    error_message TEXT NOT NULL,
    error_name VARCHAR(255),
    error_type VARCHAR(50),
    file_path VARCHAR(500),
    line_number INTEGER,
    first_seen TIMESTAMPTZ NOT NULL,
    last_seen TIMESTAMPTZ NOT NULL,
    occurrence_count INTEGER DEFAULT 1,
    affected_users INTEGER DEFAULT 0,
    affected_sessions INTEGER DEFAULT 0,
    sample_stack TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_error_fingerprint UNIQUE (error_fingerprint)
);

-- Indexes for error_aggregations
CREATE INDEX idx_error_aggregations_fingerprint ON error_aggregations(error_fingerprint);
CREATE INDEX idx_error_aggregations_last_seen ON error_aggregations(last_seen DESC);
CREATE INDEX idx_error_aggregations_occurrence ON error_aggregations(occurrence_count DESC);
CREATE INDEX idx_error_aggregations_type ON error_aggregations(error_type);

-- ============================================================
-- Daily Error Aggregations
-- ============================================================
-- Daily aggregated error counts by type and severity

CREATE TABLE IF NOT EXISTS daily_error_aggregations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    error_fingerprint VARCHAR(64) NOT NULL,
    occurrence_count INTEGER DEFAULT 1,
    affected_users INTEGER DEFAULT 0,
    affected_sessions INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_daily_error UNIQUE (date, error_fingerprint)
);

-- Index for daily error aggregations
CREATE INDEX idx_daily_error_aggregations_date ON daily_error_aggregations(date DESC);
CREATE INDEX idx_daily_error_aggregations_fingerprint ON daily_error_aggregations(error_fingerprint);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE performance_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_aggregations ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_error_aggregations ENABLE ROW LEVEL SECURITY;

-- Service role can manage all tables
CREATE POLICY "Service role can manage performance_thresholds" ON performance_thresholds
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage performance_alerts" ON performance_alerts
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage error_aggregations" ON error_aggregations
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage daily_error_aggregations" ON daily_error_aggregations
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow authenticated users to read thresholds (for frontend config)
CREATE POLICY "Authenticated users can read performance_thresholds" ON performance_thresholds
    FOR SELECT TO authenticated USING (true);

-- Allow anonymous inserts for error aggregation (from frontend)
CREATE POLICY "Anyone can insert error_aggregations" ON error_aggregations
    FOR INSERT WITH CHECK (true);

-- ============================================================
-- Functions
-- ============================================================

-- Function to aggregate errors (called by error reporting)
CREATE OR REPLACE FUNCTION upsert_error_aggregation(
    p_error_fingerprint VARCHAR(64),
    p_error_message TEXT,
    p_error_name VARCHAR(255),
    p_error_type VARCHAR(50),
    p_file_path VARCHAR(500),
    p_line_number INTEGER,
    p_stack TEXT,
    p_user_id UUID,
    p_session_id VARCHAR(255)
) RETURNS UUID AS $$
DECLARE
    v_agg_id UUID;
    v_today DATE := CURRENT_DATE;
BEGIN
    -- Upsert main aggregation
    INSERT INTO error_aggregations (
        error_fingerprint, error_message, error_name, error_type,
        file_path, line_number, first_seen, last_seen,
        occurrence_count, sample_stack
    ) VALUES (
        p_error_fingerprint, p_error_message, p_error_name, p_error_type,
        p_file_path, p_line_number, NOW(), NOW(),
        1, p_stack
    )
    ON CONFLICT (error_fingerprint) DO UPDATE SET
        last_seen = NOW(),
        occurrence_count = error_aggregations.occurrence_count + 1,
        updated_at = NOW()
    RETURNING id INTO v_agg_id;

    -- Update daily aggregation
    INSERT INTO daily_error_aggregations (
        date, error_fingerprint, occurrence_count
    ) VALUES (
        v_today, p_error_fingerprint, 1
    )
    ON CONFLICT (date, error_fingerprint) DO UPDATE SET
        occurrence_count = daily_error_aggregations.occurrence_count + 1;

    RETURN v_agg_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get top errors
CREATE OR REPLACE FUNCTION get_top_errors(
    p_days INTEGER DEFAULT 7,
    p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
    error_fingerprint VARCHAR(64),
    error_message TEXT,
    error_name VARCHAR(255),
    error_type VARCHAR(50),
    occurrence_count BIGINT,
    affected_users BIGINT,
    last_seen TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ea.error_fingerprint,
        ea.error_message,
        ea.error_name,
        ea.error_type,
        SUM(dea.occurrence_count)::BIGINT as occurrence_count,
        COUNT(DISTINCT ea.affected_users)::BIGINT as affected_users,
        MAX(ea.last_seen) as last_seen
    FROM error_aggregations ea
    JOIN daily_error_aggregations dea ON ea.error_fingerprint = dea.error_fingerprint
    WHERE dea.date >= CURRENT_DATE - p_days
    GROUP BY ea.error_fingerprint, ea.error_message, ea.error_name, ea.error_type
    ORDER BY occurrence_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and create performance alert
CREATE OR REPLACE FUNCTION check_performance_threshold(
    p_metric_type VARCHAR(50),
    p_value DECIMAL(10, 4),
    p_page VARCHAR(255),
    p_device_type VARCHAR(20)
) RETURNS UUID AS $$
DECLARE
    v_threshold RECORD;
    v_severity VARCHAR(20);
    v_alert_id UUID;
BEGIN
    -- Get threshold
    SELECT * INTO v_threshold
    FROM performance_thresholds
    WHERE metric_type = p_metric_type AND enabled = TRUE;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Determine severity
    IF p_value >= v_threshold.critical_threshold THEN
        v_severity := 'critical';
    ELSIF p_value >= v_threshold.warning_threshold THEN
        v_severity := 'warning';
    ELSE
        RETURN NULL;
    END IF;

    -- Check for recent alert (cooldown)
    SELECT id INTO v_alert_id
    FROM performance_alerts
    WHERE metric_type = p_metric_type
      AND status = 'active'
      AND created_at > NOW() - (v_threshold.cooldown_minutes || ' minutes')::INTERVAL
    LIMIT 1;

    IF FOUND THEN
        RETURN v_alert_id; -- Return existing alert
    END IF;

    -- Create new alert
    INSERT INTO performance_alerts (
        metric_type, severity, current_value, threshold_value, page, device_type
    ) VALUES (
        p_metric_type, v_severity, p_value,
        CASE WHEN v_severity = 'critical' THEN v_threshold.critical_threshold ELSE v_threshold.warning_threshold END,
        p_page, p_device_type
    ) RETURNING id INTO v_alert_id;

    RETURN v_alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Grants
-- ============================================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT SELECT ON performance_thresholds TO authenticated;
GRANT INSERT ON error_aggregations TO anon, authenticated;

-- ============================================================
-- Comments
-- ============================================================

COMMENT ON TABLE performance_thresholds IS 'Configurable thresholds for performance metrics alerting';
COMMENT ON TABLE performance_alerts IS 'Performance alerts when thresholds are exceeded';
COMMENT ON TABLE error_aggregations IS 'Aggregated error statistics with fingerprinting for deduplication';
COMMENT ON TABLE daily_error_aggregations IS 'Daily error counts by fingerprint for trend analysis';
COMMENT ON FUNCTION upsert_error_aggregation IS 'Upsert error aggregation with fingerprinting for deduplication';
COMMENT ON FUNCTION get_top_errors IS 'Get top errors by occurrence count for a time period';
COMMENT ON FUNCTION check_performance_threshold IS 'Check metric value against thresholds and create alert if needed';