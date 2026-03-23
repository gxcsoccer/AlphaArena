-- ============================================================
-- Error Logs Tables for Analytics
-- ============================================================
-- Issue #524: Data analytics infrastructure
-- Creates tables for error log collection and analysis
-- ============================================================

-- ============================================================
-- Error Logs Table
-- ============================================================
-- Stores error logs for analytics and debugging

CREATE TABLE IF NOT EXISTS error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    error_code VARCHAR(100) NOT NULL,
    error_name VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    stack TEXT,
    user_id VARCHAR(255),
    session_id VARCHAR(255),
    request_id VARCHAR(255),
    path TEXT,
    method VARCHAR(10),
    status_code INTEGER NOT NULL,
    details JSONB DEFAULT '{}',
    user_agent TEXT,
    ip VARCHAR(45),
    browser VARCHAR(100),
    os VARCHAR(100),
    device VARCHAR(50),
    recovered BOOLEAN DEFAULT FALSE,
    recovery_action TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for error logs
CREATE INDEX idx_error_logs_timestamp ON error_logs(timestamp DESC);
CREATE INDEX idx_error_logs_code ON error_logs(error_code);
CREATE INDEX idx_error_logs_user ON error_logs(user_id);
CREATE INDEX idx_error_logs_session ON error_logs(session_id);
CREATE INDEX idx_error_logs_path ON error_logs(path);
CREATE INDEX idx_error_logs_status ON error_logs(status_code);
CREATE INDEX idx_error_logs_recovered ON error_logs(recovered);

-- Partial indexes for common queries
CREATE INDEX idx_error_logs_critical ON error_logs(timestamp) 
    WHERE status_code >= 500;
CREATE INDEX idx_error_logs_unrecovered ON error_logs(timestamp) 
    WHERE recovered = FALSE;

-- Comments
COMMENT ON TABLE error_logs IS 'Error logs for analytics and debugging';
COMMENT ON COLUMN error_logs.error_code IS 'Error code from ErrorCode enum';
COMMENT ON COLUMN error_logs.error_name IS 'Error class name';
COMMENT ON COLUMN error_logs.status_code IS 'HTTP status code';
COMMENT ON COLUMN error_logs.recovered IS 'Whether the error was recovered from';

-- ============================================================
-- Daily Error Stats Table
-- ============================================================
-- Pre-aggregated daily error statistics

CREATE TABLE IF NOT EXISTS daily_error_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE UNIQUE NOT NULL,
    total_errors INTEGER DEFAULT 0,
    errors_by_code JSONB DEFAULT '{}',
    errors_by_status JSONB DEFAULT '{}',
    critical_count INTEGER DEFAULT 0,
    recovered_count INTEGER DEFAULT 0,
    calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for daily error stats
CREATE INDEX idx_daily_error_stats_date ON daily_error_stats(date DESC);

-- Comments
COMMENT ON TABLE daily_error_stats IS 'Pre-aggregated daily error statistics';

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_error_stats ENABLE ROW LEVEL SECURITY;

-- Service role can access all tables
CREATE POLICY "Service role can manage error_logs" ON error_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage daily_error_stats" ON daily_error_stats
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow anonymous inserts for client-side error logging
CREATE POLICY "Anyone can insert error_logs" ON error_logs
    FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ============================================================
-- Functions
-- ============================================================

-- Function to aggregate daily error stats
CREATE OR REPLACE FUNCTION aggregate_daily_error_stats(target_date DATE)
RETURNS void AS $$
DECLARE
    v_total_errors INTEGER;
    v_critical_count INTEGER;
    v_recovered_count INTEGER;
    v_errors_by_code JSONB;
    v_errors_by_status JSONB;
BEGIN
    -- Calculate total errors
    SELECT COUNT(*)::INTEGER
    INTO v_total_errors
    FROM error_logs
    WHERE DATE(timestamp) = target_date;

    -- Calculate critical errors (5xx)
    SELECT COUNT(*)::INTEGER
    INTO v_critical_count
    FROM error_logs
    WHERE DATE(timestamp) = target_date
      AND status_code >= 500;

    -- Calculate recovered errors
    SELECT COUNT(*)::INTEGER
    INTO v_recovered_count
    FROM error_logs
    WHERE DATE(timestamp) = target_date
      AND recovered = TRUE;

    -- Aggregate by error code
    SELECT jsonb_object_agg(error_code, cnt)
    INTO v_errors_by_code
    FROM (
        SELECT error_code, COUNT(*) as cnt
        FROM error_logs
        WHERE DATE(timestamp) = target_date
        GROUP BY error_code
    ) t;

    -- Aggregate by status code
    SELECT jsonb_object_agg(status_code::text, cnt)
    INTO v_errors_by_status
    FROM (
        SELECT status_code, COUNT(*) as cnt
        FROM error_logs
        WHERE DATE(timestamp) = target_date
        GROUP BY status_code
    ) t;

    -- Upsert stats
    INSERT INTO daily_error_stats (
        date, total_errors, errors_by_code, errors_by_status,
        critical_count, recovered_count, calculated_at
    ) VALUES (
        target_date, v_total_errors, v_errors_by_code, v_errors_by_status,
        v_critical_count, v_recovered_count, NOW()
    ) ON CONFLICT (date) DO UPDATE SET
        total_errors = EXCLUDED.total_errors,
        errors_by_code = EXCLUDED.errors_by_code,
        errors_by_status = EXCLUDED.errors_by_status,
        critical_count = EXCLUDED.critical_count,
        recovered_count = EXCLUDED.recovered_count,
        calculated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean old error logs
CREATE OR REPLACE FUNCTION clean_old_error_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM error_logs
    WHERE timestamp < NOW() - (days_to_keep || ' days')::INTERVAL;
    
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
GRANT INSERT ON error_logs TO anon, authenticated;