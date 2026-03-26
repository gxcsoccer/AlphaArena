-- ============================================================
-- Audit Logs Tables for Security Compliance
-- ============================================================
-- Issue #641: Security Audit - API Permissions, Data Access Logging
-- Creates tables for audit trail and access logging
-- ============================================================

-- ============================================================
-- Audit Logs Table
-- ============================================================
-- Stores comprehensive audit trail for all security-relevant events

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Who performed the action
    user_id UUID,
    user_email VARCHAR(255),
    user_role VARCHAR(50) DEFAULT 'user',
    
    -- What action was performed
    action VARCHAR(100) NOT NULL,
    action_category VARCHAR(50) NOT NULL, -- 'auth', 'data_access', 'payment', 'subscription', 'export', 'admin', 'security'
    
    -- What resource was affected
    resource_type VARCHAR(50), -- 'user', 'strategy', 'subscription', 'payment', 'export', etc.
    resource_id VARCHAR(100),
    resource_owner_id UUID, -- Who owns the resource (for cross-user access detection)
    
    -- Request context
    ip_address INET,
    user_agent TEXT,
    request_method VARCHAR(10),
    request_path TEXT,
    request_params JSONB DEFAULT '{}',
    request_id VARCHAR(100),
    
    -- Response context
    response_status INTEGER,
    response_time_ms INTEGER,
    
    -- Additional context
    metadata JSONB DEFAULT '{}',
    
    -- Risk indicators
    is_sensitive BOOLEAN DEFAULT FALSE,
    risk_level VARCHAR(20) DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for audit logs
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_action_category ON audit_logs(action_category);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_resource_owner ON audit_logs(resource_owner_id);
CREATE INDEX idx_audit_logs_ip ON audit_logs(ip_address);
CREATE INDEX idx_audit_logs_risk_level ON audit_logs(risk_level);

-- Partial indexes for common queries
CREATE INDEX idx_audit_logs_sensitive ON audit_logs(created_at DESC) 
    WHERE is_sensitive = TRUE;
CREATE INDEX idx_audit_logs_high_risk ON audit_logs(created_at DESC) 
    WHERE risk_level IN ('high', 'critical');
CREATE INDEX idx_audit_logs_failed ON audit_logs(created_at DESC) 
    WHERE response_status >= 400;

-- Comments
COMMENT ON TABLE audit_logs IS 'Audit trail for security-relevant events';
COMMENT ON COLUMN audit_logs.action IS 'Action type: login, logout, password_change, subscription_change, payment_initiated, data_export, etc.';
COMMENT ON COLUMN audit_logs.action_category IS 'Category: auth, data_access, payment, subscription, export, admin, security';
COMMENT ON COLUMN audit_logs.resource_type IS 'Type of resource affected: user, strategy, subscription, payment, export, etc.';
COMMENT ON COLUMN audit_logs.is_sensitive IS 'Whether this action is security-sensitive';
COMMENT ON COLUMN audit_logs.risk_level IS 'Risk level: low, medium, high, critical';

-- ============================================================
-- Daily Audit Stats Table
-- ============================================================
-- Pre-aggregated daily audit statistics

CREATE TABLE IF NOT EXISTS daily_audit_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE UNIQUE NOT NULL,
    
    -- Counts by category
    total_actions INTEGER DEFAULT 0,
    auth_actions INTEGER DEFAULT 0,
    data_access_actions INTEGER DEFAULT 0,
    payment_actions INTEGER DEFAULT 0,
    subscription_actions INTEGER DEFAULT 0,
    export_actions INTEGER DEFAULT 0,
    admin_actions INTEGER DEFAULT 0,
    security_actions INTEGER DEFAULT 0,
    
    -- Risk indicators
    high_risk_count INTEGER DEFAULT 0,
    critical_risk_count INTEGER DEFAULT 0,
    sensitive_actions INTEGER DEFAULT 0,
    
    -- Failed requests
    failed_requests INTEGER DEFAULT 0,
    
    -- Unique counts
    unique_users INTEGER DEFAULT 0,
    unique_ips INTEGER DEFAULT 0,
    
    -- Top actions
    top_actions JSONB DEFAULT '{}',
    top_ips JSONB DEFAULT '{}',
    
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_daily_audit_stats_date ON daily_audit_stats(date DESC);

COMMENT ON TABLE daily_audit_stats IS 'Pre-aggregated daily audit statistics';

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_audit_stats ENABLE ROW LEVEL SECURITY;

-- Service role can access all tables
CREATE POLICY "Service role can manage audit_logs" ON audit_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage daily_audit_stats" ON daily_audit_stats
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Admins can read audit logs (via service role in API)
-- Regular users cannot directly access audit logs - only through API

-- ============================================================
-- Functions
-- ============================================================

-- Function to log an audit event
CREATE OR REPLACE FUNCTION log_audit_event(
    p_user_id UUID DEFAULT NULL,
    p_user_email VARCHAR(255) DEFAULT NULL,
    p_user_role VARCHAR(50) DEFAULT 'user',
    p_action VARCHAR(100),
    p_action_category VARCHAR(50),
    p_resource_type VARCHAR(50) DEFAULT NULL,
    p_resource_id VARCHAR(100) DEFAULT NULL,
    p_resource_owner_id UUID DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_request_method VARCHAR(10) DEFAULT NULL,
    p_request_path TEXT DEFAULT NULL,
    p_request_params JSONB DEFAULT '{}',
    p_request_id VARCHAR(100) DEFAULT NULL,
    p_response_status INTEGER DEFAULT NULL,
    p_response_time_ms INTEGER DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}',
    p_is_sensitive BOOLEAN DEFAULT FALSE,
    p_risk_level VARCHAR(20) DEFAULT 'low'
) RETURNS UUID AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO audit_logs (
        user_id, user_email, user_role,
        action, action_category,
        resource_type, resource_id, resource_owner_id,
        ip_address, user_agent,
        request_method, request_path, request_params, request_id,
        response_status, response_time_ms,
        metadata, is_sensitive, risk_level
    ) VALUES (
        p_user_id, p_user_email, p_user_role,
        p_action, p_action_category,
        p_resource_type, p_resource_id, p_resource_owner_id,
        p_ip_address, p_user_agent,
        p_request_method, p_request_path, p_request_params, p_request_id,
        p_response_status, p_response_time_ms,
        p_metadata, p_is_sensitive, p_risk_level
    ) RETURNING id INTO v_audit_id;
    
    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to aggregate daily audit stats
CREATE OR REPLACE FUNCTION aggregate_daily_audit_stats(target_date DATE)
RETURNS void AS $$
DECLARE
    v_total_actions INTEGER;
    v_auth_actions INTEGER;
    v_data_access_actions INTEGER;
    v_payment_actions INTEGER;
    v_subscription_actions INTEGER;
    v_export_actions INTEGER;
    v_admin_actions INTEGER;
    v_security_actions INTEGER;
    v_high_risk_count INTEGER;
    v_critical_risk_count INTEGER;
    v_sensitive_actions INTEGER;
    v_failed_requests INTEGER;
    v_unique_users INTEGER;
    v_unique_ips INTEGER;
    v_top_actions JSONB;
    v_top_ips JSONB;
BEGIN
    -- Calculate counts by category
    SELECT COUNT(*)::INTEGER INTO v_total_actions
    FROM audit_logs WHERE DATE(created_at) = target_date;
    
    SELECT COUNT(*)::INTEGER INTO v_auth_actions
    FROM audit_logs WHERE DATE(created_at) = target_date AND action_category = 'auth';
    
    SELECT COUNT(*)::INTEGER INTO v_data_access_actions
    FROM audit_logs WHERE DATE(created_at) = target_date AND action_category = 'data_access';
    
    SELECT COUNT(*)::INTEGER INTO v_payment_actions
    FROM audit_logs WHERE DATE(created_at) = target_date AND action_category = 'payment';
    
    SELECT COUNT(*)::INTEGER INTO v_subscription_actions
    FROM audit_logs WHERE DATE(created_at) = target_date AND action_category = 'subscription';
    
    SELECT COUNT(*)::INTEGER INTO v_export_actions
    FROM audit_logs WHERE DATE(created_at) = target_date AND action_category = 'export';
    
    SELECT COUNT(*)::INTEGER INTO v_admin_actions
    FROM audit_logs WHERE DATE(created_at) = target_date AND action_category = 'admin';
    
    SELECT COUNT(*)::INTEGER INTO v_security_actions
    FROM audit_logs WHERE DATE(created_at) = target_date AND action_category = 'security';
    
    -- Calculate risk indicators
    SELECT COUNT(*)::INTEGER INTO v_high_risk_count
    FROM audit_logs WHERE DATE(created_at) = target_date AND risk_level = 'high';
    
    SELECT COUNT(*)::INTEGER INTO v_critical_risk_count
    FROM audit_logs WHERE DATE(created_at) = target_date AND risk_level = 'critical';
    
    SELECT COUNT(*)::INTEGER INTO v_sensitive_actions
    FROM audit_logs WHERE DATE(created_at) = target_date AND is_sensitive = TRUE;
    
    SELECT COUNT(*)::INTEGER INTO v_failed_requests
    FROM audit_logs WHERE DATE(created_at) = target_date AND response_status >= 400;
    
    -- Calculate unique counts
    SELECT COUNT(DISTINCT user_id)::INTEGER INTO v_unique_users
    FROM audit_logs WHERE DATE(created_at) = target_date AND user_id IS NOT NULL;
    
    SELECT COUNT(DISTINCT ip_address)::INTEGER INTO v_unique_ips
    FROM audit_logs WHERE DATE(created_at) = target_date AND ip_address IS NOT NULL;
    
    -- Top actions
    SELECT jsonb_object_agg(action, cnt) INTO v_top_actions
    FROM (
        SELECT action, COUNT(*) as cnt
        FROM audit_logs
        WHERE DATE(created_at) = target_date
        GROUP BY action
        ORDER BY cnt DESC
        LIMIT 20
    ) t;
    
    -- Top IPs
    SELECT jsonb_object_agg(ip_address::text, cnt) INTO v_top_ips
    FROM (
        SELECT ip_address, COUNT(*) as cnt
        FROM audit_logs
        WHERE DATE(created_at) = target_date AND ip_address IS NOT NULL
        GROUP BY ip_address
        ORDER BY cnt DESC
        LIMIT 20
    ) t;
    
    -- Upsert stats
    INSERT INTO daily_audit_stats (
        date, total_actions, auth_actions, data_access_actions,
        payment_actions, subscription_actions, export_actions,
        admin_actions, security_actions, high_risk_count,
        critical_risk_count, sensitive_actions, failed_requests,
        unique_users, unique_ips, top_actions, top_ips, calculated_at
    ) VALUES (
        target_date, v_total_actions, v_auth_actions, v_data_access_actions,
        v_payment_actions, v_subscription_actions, v_export_actions,
        v_admin_actions, v_security_actions, v_high_risk_count,
        v_critical_risk_count, v_sensitive_actions, v_failed_requests,
        v_unique_users, v_unique_ips, v_top_actions, v_top_ips, NOW()
    ) ON CONFLICT (date) DO UPDATE SET
        total_actions = EXCLUDED.total_actions,
        auth_actions = EXCLUDED.auth_actions,
        data_access_actions = EXCLUDED.data_access_actions,
        payment_actions = EXCLUDED.payment_actions,
        subscription_actions = EXCLUDED.subscription_actions,
        export_actions = EXCLUDED.export_actions,
        admin_actions = EXCLUDED.admin_actions,
        security_actions = EXCLUDED.security_actions,
        high_risk_count = EXCLUDED.high_risk_count,
        critical_risk_count = EXCLUDED.critical_risk_count,
        sensitive_actions = EXCLUDED.sensitive_actions,
        failed_requests = EXCLUDED.failed_requests,
        unique_users = EXCLUDED.unique_users,
        unique_ips = EXCLUDED.unique_ips,
        top_actions = EXCLUDED.top_actions,
        top_ips = EXCLUDED.top_ips,
        calculated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean old audit logs
CREATE OR REPLACE FUNCTION clean_old_audit_logs(days_to_keep INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_logs
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to detect suspicious activity
CREATE OR REPLACE FUNCTION detect_suspicious_activity(
    p_user_id UUID DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_time_window_hours INTEGER DEFAULT 24
) RETURNS TABLE (
    risk_type TEXT,
    details JSONB
) AS $$
BEGIN
    -- Multiple failed login attempts from same IP
    IF p_ip_address IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            'multiple_failed_logins'::TEXT as risk_type,
            jsonb_build_object(
                'ip_address', p_ip_address,
                'failed_count', COUNT(*),
                'time_window_hours', p_time_window_hours
            ) as details
        FROM audit_logs
        WHERE ip_address = p_ip_address
          AND action = 'login_failed'
          AND created_at > NOW() - (p_time_window_hours || ' hours')::INTERVAL
        HAVING COUNT(*) >= 5;
    END IF;
    
    -- Multiple failed login attempts for same user
    IF p_user_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            'user_login_failures'::TEXT as risk_type,
            jsonb_build_object(
                'user_id', p_user_id,
                'failed_count', COUNT(*),
                'time_window_hours', p_time_window_hours
            ) as details
        FROM audit_logs
        WHERE user_id = p_user_id
          AND action = 'login_failed'
          AND created_at > NOW() - (p_time_window_hours || ' hours')::INTERVAL
        HAVING COUNT(*) >= 3;
        
        -- Cross-user data access (accessing other users' resources)
        RETURN QUERY
        SELECT 
            'cross_user_access'::TEXT as risk_type,
            jsonb_build_object(
                'user_id', p_user_id,
                'access_count', COUNT(*),
                'time_window_hours', p_time_window_hours
            ) as details
        FROM audit_logs
        WHERE user_id = p_user_id
          AND resource_owner_id IS NOT NULL
          AND resource_owner_id != p_user_id
          AND created_at > NOW() - (p_time_window_hours || ' hours')::INTERVAL
        HAVING COUNT(*) >= 10;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Grants
-- ============================================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ============================================================
-- Initial Data
-- ============================================================

-- Insert initial daily stats for today (will be updated by scheduled job)
INSERT INTO daily_audit_stats (date) VALUES (CURRENT_DATE)
ON CONFLICT (date) DO NOTHING;