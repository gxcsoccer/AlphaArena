-- Alerting System Tables
-- Creates tables for alert rules, alert history, and alert configurations

-- Alert Rules Table
-- Defines rules for triggering alerts based on various conditions
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Rule type and conditions
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN (
        'consecutive_failures',   -- N consecutive failures
        'execution_timeout',      -- Execution takes too long
        'position_limit',         -- Position size exceeds limit
        'circuit_breaker',        -- Circuit breaker triggered
        'error_rate',             -- Error rate exceeds threshold
        'custom'                  -- Custom condition
    )),
    
    -- Alert severity
    severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Condition configuration (JSON)
    -- Example: {"threshold": 3, "window_minutes": 60}
    conditions JSONB NOT NULL DEFAULT '{}',
    
    -- Which entity this rule applies to
    entity_type VARCHAR(50) CHECK (entity_type IN ('scheduler', 'strategy', 'system', 'user')),
    entity_id UUID, -- ID of the scheduler, strategy, etc.
    
    -- Notification channels
    channels JSONB NOT NULL DEFAULT '{"in_app": true, "email": false, "webhook": false}',
    webhook_url TEXT, -- Custom webhook URL if channel includes webhook
    
    -- Rule state
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    last_triggered_at TIMESTAMPTZ,
    trigger_count INTEGER NOT NULL DEFAULT 0,
    
    -- Cooldown to prevent alert spam
    cooldown_minutes INTEGER NOT NULL DEFAULT 30,
    last_notification_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_conditions CHECK (conditions IS NOT NULL)
);

-- Alert History Table
-- Records all triggered alerts
CREATE TABLE IF NOT EXISTS alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL,
    
    -- Alert details
    rule_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    title VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    
    -- Context data
    context JSONB NOT NULL DEFAULT '{}',
    -- Example: {"schedule_id": "xxx", "consecutive_failures": 5, "last_error": "..."}
    
    -- Notification status
    notification_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (notification_status IN ('pending', 'sent', 'failed', 'skipped')),
    notification_channels JSONB DEFAULT '{}',
    notification_error TEXT,
    sent_at TIMESTAMPTZ,
    
    -- Acknowledgment
    is_acknowledged BOOLEAN NOT NULL DEFAULT false,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES auth.users(id),
    
    -- Resolution
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolution_note TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alert Configurations Table
-- User-level alert settings and preferences
CREATE TABLE IF NOT EXISTS alert_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Global alert settings
    alerts_enabled BOOLEAN NOT NULL DEFAULT true,
    
    -- Default channels for all alerts
    default_channels JSONB NOT NULL DEFAULT '{"in_app": true, "email": false, "webhook": false}',
    
    -- Global webhook URL
    default_webhook_url TEXT,
    
    -- Email settings
    email_enabled BOOLEAN NOT NULL DEFAULT false,
    email_address TEXT,
    
    -- Quiet hours
    quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
    quiet_hours_start TIME DEFAULT '22:00',
    quiet_hours_end TIME DEFAULT '08:00',
    quiet_hours_timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Rate limiting
    max_alerts_per_hour INTEGER NOT NULL DEFAULT 10,
    alert_cooldown_minutes INTEGER NOT NULL DEFAULT 5,
    
    -- Alert type preferences
    alert_preferences JSONB NOT NULL DEFAULT '{
        "consecutive_failures": {"enabled": true, "severity_threshold": "medium"},
        "execution_timeout": {"enabled": true, "severity_threshold": "low"},
        "position_limit": {"enabled": true, "severity_threshold": "high"},
        "circuit_breaker": {"enabled": true, "severity_threshold": "critical"},
        "error_rate": {"enabled": true, "severity_threshold": "medium"},
        "custom": {"enabled": true, "severity_threshold": "medium"}
    }',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- Alert Metrics Table (for dashboard statistics)
CREATE TABLE IF NOT EXISTS alert_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Time period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('hour', 'day', 'week', 'month')),
    
    -- Metrics
    total_alerts INTEGER NOT NULL DEFAULT 0,
    alerts_by_type JSONB NOT NULL DEFAULT '{}',
    alerts_by_severity JSONB NOT NULL DEFAULT '{}',
    avg_resolution_time_seconds INTEGER,
    
    -- Scheduler-specific metrics
    total_executions INTEGER NOT NULL DEFAULT 0,
    successful_executions INTEGER NOT NULL DEFAULT 0,
    failed_executions INTEGER NOT NULL DEFAULT 0,
    success_rate NUMERIC(5,2),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, period_start, period_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_alert_rules_user_id ON alert_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_entity ON alert_rules(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_alert_rules_type ON alert_rules(rule_type);

CREATE INDEX IF NOT EXISTS idx_alert_history_user_id ON alert_history(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_rule_id ON alert_history(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_created_at ON alert_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_history_severity ON alert_history(severity);
CREATE INDEX IF NOT EXISTS idx_alert_history_status ON alert_history(notification_status);
CREATE INDEX IF NOT EXISTS idx_alert_history_acknowledged ON alert_history(is_acknowledged) WHERE is_acknowledged = false;
CREATE INDEX IF NOT EXISTS idx_alert_history_resolved ON alert_history(is_resolved) WHERE is_resolved = false;

CREATE INDEX IF NOT EXISTS idx_alert_metrics_user_id ON alert_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_metrics_period ON alert_metrics(period_start, period_end);

-- RLS Policies
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_metrics ENABLE ROW LEVEL SECURITY;

-- Alert Rules Policies
CREATE POLICY "Users can view their own alert rules"
    ON alert_rules FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alert rules"
    ON alert_rules FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alert rules"
    ON alert_rules FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alert rules"
    ON alert_rules FOR DELETE
    USING (auth.uid() = user_id);

-- Alert History Policies
CREATE POLICY "Users can view their own alert history"
    ON alert_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "System can insert alert history"
    ON alert_history FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update their own alert history"
    ON alert_history FOR UPDATE
    USING (auth.uid() = user_id);

-- Alert Configurations Policies
CREATE POLICY "Users can view their own alert configurations"
    ON alert_configurations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alert configurations"
    ON alert_configurations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alert configurations"
    ON alert_configurations FOR UPDATE
    USING (auth.uid() = user_id);

-- Alert Metrics Policies
CREATE POLICY "Users can view their own alert metrics"
    ON alert_metrics FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "System can insert alert metrics"
    ON alert_metrics FOR INSERT
    WITH CHECK (true);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_alert_rules_updated_at
    BEFORE UPDATE ON alert_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_configurations_updated_at
    BEFORE UPDATE ON alert_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to get or create default alert configuration
CREATE OR REPLACE FUNCTION get_or_create_alert_configuration(p_user_id UUID)
RETURNS alert_configurations AS $$
DECLARE
    config alert_configurations;
BEGIN
    SELECT * INTO config FROM alert_configurations WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        INSERT INTO alert_configurations (user_id)
        VALUES (p_user_id)
        RETURNING * INTO config;
    END IF;
    
    RETURN config;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to aggregate alert metrics
CREATE OR REPLACE FUNCTION aggregate_alert_metrics(
    p_user_id UUID,
    p_period_type VARCHAR,
    p_period_start TIMESTAMPTZ
)
RETURNS void AS $$
DECLARE
    v_period_end TIMESTAMPTZ;
    v_total_alerts INTEGER;
    v_alerts_by_type JSONB;
    v_alerts_by_severity JSONB;
    v_avg_resolution_time INTEGER;
    v_total_executions INTEGER;
    v_successful_executions INTEGER;
    v_failed_executions INTEGER;
BEGIN
    -- Calculate period end based on type
    CASE p_period_type
        WHEN 'hour' THEN v_period_end := p_period_start + INTERVAL '1 hour';
        WHEN 'day' THEN v_period_end := p_period_start + INTERVAL '1 day';
        WHEN 'week' THEN v_period_end := p_period_start + INTERVAL '1 week';
        WHEN 'month' THEN v_period_end := p_period_start + INTERVAL '1 month';
    END CASE;
    
    -- Aggregate alert history
    SELECT 
        COUNT(*),
        jsonb_object_agg(rule_type, rule_count),
        jsonb_object_agg(severity, severity_count)
    INTO 
        v_total_alerts,
        v_alerts_by_type,
        v_alerts_by_severity
    FROM (
        SELECT 
            rule_type,
            severity,
            COUNT(*) as rule_count
        FROM alert_history
        WHERE user_id = p_user_id
          AND created_at >= p_period_start
          AND created_at < v_period_end
        GROUP BY rule_type, severity
    ) subq;
    
    -- Calculate average resolution time
    SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)))::INTEGER
    INTO v_avg_resolution_time
    FROM alert_history
    WHERE user_id = p_user_id
      AND created_at >= p_period_start
      AND created_at < v_period_end
      AND is_resolved = true
      AND resolved_at IS NOT NULL;
    
    -- Get execution metrics from schedule_executions
    SELECT 
        COUNT(*),
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END),
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)
    INTO 
        v_total_executions,
        v_successful_executions,
        v_failed_executions
    FROM schedule_executions se
    JOIN trading_schedules ts ON se.schedule_id = ts.id
    WHERE ts.user_id = p_user_id
      AND se.created_at >= p_period_start
      AND se.created_at < v_period_end;
    
    -- Insert or update metrics
    INSERT INTO alert_metrics (
        user_id,
        period_start,
        period_end,
        period_type,
        total_alerts,
        alerts_by_type,
        alerts_by_severity,
        avg_resolution_time_seconds,
        total_executions,
        successful_executions,
        failed_executions,
        success_rate
    )
    VALUES (
        p_user_id,
        p_period_start,
        v_period_end,
        p_period_type,
        COALESCE(v_total_alerts, 0),
        COALESCE(v_alerts_by_type, '{}'),
        COALESCE(v_alerts_by_severity, '{}'),
        v_avg_resolution_time,
        COALESCE(v_total_executions, 0),
        COALESCE(v_successful_executions, 0),
        COALESCE(v_failed_executions, 0),
        CASE WHEN v_total_executions > 0 
             THEN ROUND((v_successful_executions::NUMERIC / v_total_executions) * 100, 2)
             ELSE NULL
        END
    )
    ON CONFLICT (user_id, period_start, period_type)
    DO UPDATE SET
        total_alerts = EXCLUDED.total_alerts,
        alerts_by_type = EXCLUDED.alerts_by_type,
        alerts_by_severity = EXCLUDED.alerts_by_severity,
        avg_resolution_time_seconds = EXCLUDED.avg_resolution_time_seconds,
        total_executions = EXCLUDED.total_executions,
        successful_executions = EXCLUDED.successful_executions,
        failed_executions = EXCLUDED.failed_executions,
        success_rate = EXCLUDED.success_rate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;