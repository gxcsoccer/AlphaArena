-- Performance Metrics Table
-- Migration: 20260320_create_performance_metrics.sql
-- Description: Creates table for storing mobile/web performance metrics

-- Performance Metrics Table
-- Stores Core Web Vitals and custom performance metrics for monitoring
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id VARCHAR(255) NOT NULL,
    
    -- Core Web Vitals
    fcp DECIMAL(10, 2),  -- First Contentful Paint (ms)
    lcp DECIMAL(10, 2),  -- Largest Contentful Paint (ms)
    fid DECIMAL(10, 2),  -- First Input Delay (ms)
    cls DECIMAL(10, 6),  -- Cumulative Layout Shift (score)
    ttfb DECIMAL(10, 2), -- Time to First Byte (ms)
    inp DECIMAL(10, 2),  -- Interaction to Next Paint (ms)
    
    -- Custom metrics
    tti DECIMAL(10, 2),         -- Time to Interactive (ms)
    memory_used BIGINT,         -- JS Heap Size Used (bytes)
    memory_limit BIGINT,        -- JS Heap Size Limit (bytes)
    
    -- Network metrics
    api_latency DECIMAL(10, 2),    -- Average API latency (ms)
    ws_latency DECIMAL(10, 2),     -- WebSocket latency (ms)
    ws_connected BOOLEAN DEFAULT false, -- WebSocket connection status
    
    -- Page/App context
    page VARCHAR(255) NOT NULL DEFAULT 'unknown',  -- Current page/route
    route VARCHAR(255),                            -- Route name
    
    -- Device/Environment info
    device_type VARCHAR(20) NOT NULL DEFAULT 'desktop' CHECK (device_type IN ('mobile', 'tablet', 'desktop')),
    os VARCHAR(50),
    browser VARCHAR(50),
    screen_width INTEGER,
    screen_height INTEGER,
    connection_type VARCHAR(20),   -- 4g, 3g, wifi, etc.
    effective_type VARCHAR(20),    -- slow-2g, 2g, 3g, 4g
    
    -- Additional context
    user_agent TEXT,
    referrer TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance_metrics
CREATE INDEX IF NOT EXISTS idx_performance_metrics_session_id ON performance_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_user_id ON performance_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_device_type ON performance_metrics(device_type);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_page ON performance_metrics(page);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_created_at ON performance_metrics(created_at DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_performance_metrics_device_created ON performance_metrics(device_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_page_created ON performance_metrics(page, created_at DESC);

-- Row Level Security (RLS) Policies
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for performance_metrics
-- Allow anonymous inserts for public metrics collection
CREATE POLICY "Allow anonymous performance metric inserts" ON performance_metrics
    FOR INSERT WITH CHECK (true);

-- Allow authenticated users to insert their own metrics
CREATE POLICY "Users can insert their own performance metrics" ON performance_metrics
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view their own metrics
CREATE POLICY "Users can view their own performance metrics" ON performance_metrics
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can view all metrics (for admin dashboard)
CREATE POLICY "Service role can view all performance metrics" ON performance_metrics
    FOR SELECT USING (auth.role() = 'service_role');

-- Function to aggregate performance metrics by time period
CREATE OR REPLACE FUNCTION get_aggregated_performance_metrics(
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '7 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW(),
    p_granularity VARCHAR(10) DEFAULT 'day'
) RETURNS TABLE (
    period TIMESTAMPTZ,
    avg_fcp DECIMAL,
    avg_lcp DECIMAL,
    avg_fid DECIMAL,
    avg_cls DECIMAL,
    avg_tti DECIMAL,
    avg_api_latency DECIMAL,
    p50_fcp DECIMAL,
    p50_lcp DECIMAL,
    p75_fcp DECIMAL,
    p75_lcp DECIMAL,
    p95_fcp DECIMAL,
    p95_lcp DECIMAL,
    sample_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH metrics AS (
        SELECT 
            CASE 
                WHEN p_granularity = 'hour' THEN date_trunc('hour', created_at)
                WHEN p_granularity = 'week' THEN date_trunc('week', created_at)
                ELSE date_trunc('day', created_at)
            END as period,
            fcp,
            lcp,
            fid,
            cls,
            tti,
            api_latency
        FROM performance_metrics
        WHERE created_at >= p_start_date AND created_at <= p_end_date
    )
    SELECT 
        period,
        AVG(fcp) as avg_fcp,
        AVG(lcp) as avg_lcp,
        AVG(fid) as avg_fid,
        AVG(cls) as avg_cls,
        AVG(tti) as avg_tti,
        AVG(api_latency) as avg_api_latency,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY fcp) as p50_fcp,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY lcp) as p50_lcp,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY fcp) as p75_fcp,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY lcp) as p75_lcp,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY fcp) as p95_fcp,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY lcp) as p95_lcp,
        COUNT(*) as sample_count
    FROM metrics
    GROUP BY period
    ORDER BY period;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old metrics (data retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_performance_metrics(
    p_days_to_keep INTEGER DEFAULT 30
) RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM performance_metrics
    WHERE created_at < NOW() - (p_days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE performance_metrics IS 'Stores Core Web Vitals and custom performance metrics for mobile/web monitoring';
COMMENT ON COLUMN performance_metrics.fcp IS 'First Contentful Paint - time to first render of any content (ms)';
COMMENT ON COLUMN performance_metrics.lcp IS 'Largest Contentful Paint - time to render largest content element (ms)';
COMMENT ON COLUMN performance_metrics.fid IS 'First Input Delay - time from first user interaction to browser response (ms)';
COMMENT ON COLUMN performance_metrics.cls IS 'Cumulative Layout Shift - sum of all unexpected layout shifts (score 0-1)';
COMMENT ON COLUMN performance_metrics.ttfb IS 'Time to First Byte - time to receive first byte of response (ms)';
COMMENT ON COLUMN performance_metrics.inp IS 'Interaction to Next Paint - time from interaction to next paint (ms)';
COMMENT ON COLUMN performance_metrics.tti IS 'Time to Interactive - time until page is fully interactive (ms)';
COMMENT ON COLUMN performance_metrics.device_type IS 'Device classification: mobile (<768px), tablet (768-1024px), desktop (>1024px)';