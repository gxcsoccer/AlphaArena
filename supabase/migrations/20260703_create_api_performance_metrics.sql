-- API Performance Metrics Aggregation Table
-- Migration: 20260703_create_api_performance_metrics.sql
-- Description: Creates table for aggregated API performance metrics
-- Issue: #663 APM Error Fix and Performance Optimization

-- ============================================================
-- API Performance Metrics Table
-- ============================================================
-- Stores aggregated API performance metrics for monitoring

CREATE TABLE IF NOT EXISTS api_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL,
    path VARCHAR(500) NOT NULL,
    
    -- Request counts
    request_count INTEGER DEFAULT 1,
    error_count INTEGER DEFAULT 0,
    
    -- Response time statistics (in milliseconds)
    avg_response_time DECIMAL(10, 2) NOT NULL,
    min_response_time DECIMAL(10, 2) NOT NULL,
    max_response_time DECIMAL(10, 2) NOT NULL,
    p50_response_time DECIMAL(10, 2),
    p75_response_time DECIMAL(10, 2),
    p90_response_time DECIMAL(10, 2),
    p95_response_time DECIMAL(10, 2),
    p99_response_time DECIMAL(10, 2),
    
    -- Time bucket (minute granularity for aggregation)
    recorded_at VARCHAR(16) NOT NULL, -- Format: YYYY-MM-DDTHH:MM
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint for endpoint + time bucket
    CONSTRAINT unique_endpoint_time UNIQUE (endpoint, recorded_at)
);

-- Indexes for api_performance_metrics
CREATE INDEX idx_api_perf_metrics_endpoint ON api_performance_metrics(endpoint);
CREATE INDEX idx_api_perf_metrics_recorded_at ON api_performance_metrics(recorded_at DESC);
CREATE INDEX idx_api_perf_metrics_avg_time ON api_performance_metrics(avg_response_time DESC);
CREATE INDEX idx_api_perf_metrics_errors ON api_performance_metrics(error_count) WHERE error_count > 0;

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE api_performance_metrics ENABLE ROW LEVEL SECURITY;

-- Service role can manage all records
CREATE POLICY "Service role can manage api_performance_metrics" ON api_performance_metrics
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow anonymous inserts (from performance monitor)
CREATE POLICY "Anyone can insert api_performance_metrics" ON api_performance_metrics
    FOR INSERT WITH CHECK (true);

-- ============================================================
-- Functions
-- ============================================================

-- Function to get slowest endpoints
CREATE OR REPLACE FUNCTION get_slowest_endpoints(
    p_hours INTEGER DEFAULT 24,
    p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
    endpoint VARCHAR(500),
    method VARCHAR(10),
    total_requests BIGINT,
    avg_response_time DECIMAL(10, 2),
    p95_response_time DECIMAL(10, 2),
    error_rate DECIMAL(5, 4)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        apm.endpoint,
        apm.method,
        SUM(apm.request_count)::BIGINT as total_requests,
        SUM(apm.avg_response_time * apm.request_count) / NULLIF(SUM(apm.request_count), 0) as avg_response_time,
        MAX(apm.p95_response_time) as p95_response_time,
        SUM(apm.error_count)::DECIMAL / NULLIF(SUM(apm.request_count), 0) as error_rate
    FROM api_performance_metrics apm
    WHERE apm.created_at >= NOW() - (p_hours || ' hours')::INTERVAL
    GROUP BY apm.endpoint, apm.method
    ORDER BY avg_response_time DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get error hotspots
CREATE OR REPLACE FUNCTION get_error_hotspots(
    p_hours INTEGER DEFAULT 24,
    p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
    endpoint VARCHAR(500),
    method VARCHAR(10),
    total_requests BIGINT,
    error_count BIGINT,
    error_rate DECIMAL(5, 4)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        apm.endpoint,
        apm.method,
        SUM(apm.request_count)::BIGINT as total_requests,
        SUM(apm.error_count)::BIGINT as error_count,
        SUM(apm.error_count)::DECIMAL / NULLIF(SUM(apm.request_count), 0) as error_rate
    FROM api_performance_metrics apm
    WHERE apm.created_at >= NOW() - (p_hours || ' hours')::INTERVAL
      AND apm.error_count > 0
    GROUP BY apm.endpoint, apm.method
    ORDER BY error_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to aggregate hourly stats
CREATE OR REPLACE FUNCTION aggregate_hourly_api_performance(
    p_hour TIMESTAMPTZ DEFAULT NOW() - INTERVAL '1 hour'
) RETURNS void AS $$
BEGIN
    -- This function can be called by a scheduled job to create
    -- hourly rollups of performance data
    INSERT INTO api_performance_hourly (
        endpoint, method, hour,
        total_requests, total_errors,
        avg_response_time, p95_response_time, p99_response_time
    )
    SELECT 
        endpoint,
        method,
        date_trunc('hour', created_at),
        SUM(request_count),
        SUM(error_count),
        SUM(avg_response_time * request_count) / SUM(request_count),
        MAX(p95_response_time),
        MAX(p99_response_time)
    FROM api_performance_metrics
    WHERE created_at >= date_trunc('hour', p_hour)
      AND created_at < date_trunc('hour', p_hour) + INTERVAL '1 hour'
    GROUP BY endpoint, method, date_trunc('hour', created_at)
    ON CONFLICT (endpoint, hour) DO UPDATE SET
        total_requests = EXCLUDED.total_requests,
        total_errors = EXCLUDED.total_errors,
        avg_response_time = EXCLUDED.avg_response_time,
        p95_response_time = EXCLUDED.p95_response_time,
        p99_response_time = EXCLUDED.p99_response_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Hourly Aggregation Table
-- ============================================================

CREATE TABLE IF NOT EXISTS api_performance_hourly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL,
    hour TIMESTAMPTZ NOT NULL,
    
    total_requests BIGINT DEFAULT 0,
    total_errors BIGINT DEFAULT 0,
    
    avg_response_time DECIMAL(10, 2),
    p95_response_time DECIMAL(10, 2),
    p99_response_time DECIMAL(10, 2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_endpoint_hour UNIQUE (endpoint, hour)
);

-- Index for hourly data
CREATE INDEX idx_api_perf_hourly_hour ON api_performance_hourly(hour DESC);

-- ============================================================
-- Grants
-- ============================================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT INSERT ON api_performance_metrics TO anon, authenticated;

-- ============================================================
-- Comments
-- ============================================================

COMMENT ON TABLE api_performance_metrics IS 'Aggregated API performance metrics (per-minute granularity)';
COMMENT ON TABLE api_performance_hourly IS 'Hourly rollup of API performance metrics';
COMMENT ON FUNCTION get_slowest_endpoints IS 'Get endpoints with highest average response times';
COMMENT ON FUNCTION get_error_hotspots IS 'Get endpoints with highest error counts';
COMMENT ON FUNCTION aggregate_hourly_api_performance IS 'Aggregate minute-level metrics into hourly rollups';