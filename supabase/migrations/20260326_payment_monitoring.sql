-- Migration: Payment Monitoring Tables and Functions
-- Creates tables and functions for payment monitoring dashboard

-- Payment Alerts Table
CREATE TABLE IF NOT EXISTS payment_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('warning', 'critical')),
    message TEXT NOT NULL,
    current_value DECIMAL(10, 2) NOT NULL,
    threshold_value DECIMAL(10, 2) NOT NULL,
    metadata JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Alert Thresholds Table
CREATE TABLE IF NOT EXISTS payment_alert_thresholds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(50) NOT NULL UNIQUE,
    warning_threshold DECIMAL(10, 2) NOT NULL,
    critical_threshold DECIMAL(10, 2) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    cooldown_minutes INTEGER DEFAULT 30,
    notification_channels JSONB DEFAULT '{"in_app": true, "email": false, "webhook": false}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default alert thresholds
INSERT INTO payment_alert_thresholds (alert_type, warning_threshold, critical_threshold, enabled, cooldown_minutes)
VALUES 
    ('success_rate', 95, 90, TRUE, 30),
    ('failure_spike', 10, 20, TRUE, 15),
    ('large_refund', 10000, 50000, TRUE, 60)
ON CONFLICT (alert_type) DO NOTHING;

-- Payment Method Tracking (add column if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_history' 
        AND column_name = 'payment_method'
    ) THEN
        ALTER TABLE payment_history ADD COLUMN payment_method VARCHAR(50) DEFAULT 'stripe';
    END IF;
END $$;

-- Add failure reason column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_history' 
        AND column_name = 'failure_reason'
    ) THEN
        ALTER TABLE payment_history ADD COLUMN failure_reason TEXT;
    END IF;
END $$;

-- Add metadata column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_history' 
        AND column_name = 'metadata'
    ) THEN
        ALTER TABLE payment_history ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payment_alerts_status ON payment_alerts(status);
CREATE INDEX IF NOT EXISTS idx_payment_alerts_type ON payment_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_payment_alerts_created ON payment_alerts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_history_status ON payment_history(status);
CREATE INDEX IF NOT EXISTS idx_payment_history_created ON payment_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_history_method ON payment_history(payment_method);

-- Function: Get Payment Metrics
CREATE OR REPLACE FUNCTION get_payment_metrics(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
    total_payments BIGINT,
    succeeded_payments BIGINT,
    failed_payments BIGINT,
    pending_payments BIGINT,
    refunded_payments BIGINT,
    total_revenue DECIMAL,
    total_refunded DECIMAL,
    unique_customers BIGINT,
    retry_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_payments,
        COUNT(*) FILTER (WHERE status = 'succeeded') as succeeded_payments,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_payments,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_payments,
        COUNT(*) FILTER (WHERE status = 'refunded') as refunded_payments,
        COALESCE(SUM(amount) FILTER (WHERE status = 'succeeded'), 0) as total_revenue,
        COALESCE(SUM(amount) FILTER (WHERE status = 'refunded'), 0) as total_refunded,
        COUNT(DISTINCT user_id) as unique_customers,
        -- Retry rate: percentage of users who had a failed payment and then a successful one
        COALESCE(
            (SELECT COUNT(DISTINCT ph1.user_id)
             FROM payment_history ph1
             WHERE ph1.status = 'succeeded'
             AND ph1.created_at BETWEEN p_start_date AND p_end_date
             AND EXISTS (
                 SELECT 1 FROM payment_history ph2
                 WHERE ph2.user_id = ph1.user_id
                 AND ph2.status = 'failed'
                 AND ph2.created_at < ph1.created_at
                 AND ph2.created_at BETWEEN p_start_date AND p_end_date
             ))::DECIMAL / NULLIF(COUNT(DISTINCT user_id), 0) * 100,
            0
        ) as retry_rate
    FROM payment_history
    WHERE created_at BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql;

-- Function: Get Payment Method Metrics
CREATE OR REPLACE FUNCTION get_payment_method_metrics(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
    method VARCHAR(50),
    total_payments BIGINT,
    succeeded_payments BIGINT,
    failed_payments BIGINT,
    total_amount DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(payment_method, 'stripe') as method,
        COUNT(*) as total_payments,
        COUNT(*) FILTER (WHERE status = 'succeeded') as succeeded_payments,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_payments,
        COALESCE(SUM(amount) FILTER (WHERE status = 'succeeded'), 0) as total_amount
    FROM payment_history
    WHERE created_at BETWEEN p_start_date AND p_end_date
    GROUP BY payment_method
    ORDER BY total_payments DESC;
END;
$$ LANGUAGE plpgsql;

-- Function: Get Payment Failure Reasons
CREATE OR REPLACE FUNCTION get_payment_failure_reasons(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    reason TEXT,
    count BIGINT,
    percentage DECIMAL,
    recent_examples JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH failure_stats AS (
        SELECT 
            COALESCE(failure_reason, 'Unknown error') as failure_reason,
            COUNT(*) as failure_count,
            (COUNT(*)::DECIMAL / NULLIF(SUM(COUNT(*)) OVER (), 0) * 100) as failure_percentage
        FROM payment_history
        WHERE status = 'failed'
        AND created_at BETWEEN p_start_date AND p_end_date
        GROUP BY failure_reason
        ORDER BY failure_count DESC
        LIMIT p_limit
    )
    SELECT 
        fs.failure_reason as reason,
        fs.failure_count as count,
        fs.failure_percentage as percentage,
        (
            SELECT JSONB_AGG(jsonb_build_object(
                'id', ph.id,
                'amount', ph.amount,
                'currency', ph.currency,
                'created_at', ph.created_at,
                'user_id', ph.user_id
            ))
            FROM (
                SELECT id, amount, currency, created_at, user_id
                FROM payment_history ph2
                WHERE ph2.status = 'failed'
                AND ph2.failure_reason = fs.failure_reason
                AND ph2.created_at BETWEEN p_start_date AND p_end_date
                ORDER BY ph2.created_at DESC
                LIMIT 5
            ) ph
        ) as recent_examples
    FROM failure_stats fs;
END;
$$ LANGUAGE plpgsql;

-- Function: Get Payment Trend
CREATE OR REPLACE FUNCTION get_payment_trend(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_granularity VARCHAR(20) DEFAULT 'day'
)
RETURNS TABLE (
    period TEXT,
    total_payments BIGINT,
    succeeded_payments BIGINT,
    failed_payments BIGINT,
    revenue DECIMAL
) AS $$
DECLARE
    date_trunc_format TEXT;
BEGIN
    -- Map granularity to date_trunc format
    CASE p_granularity
        WHEN 'hour' THEN date_trunc_format := 'hour';
        WHEN 'day' THEN date_trunc_format := 'day';
        WHEN 'week' THEN date_trunc_format := 'week';
        WHEN 'month' THEN date_trunc_format := 'month';
        ELSE date_trunc_format := 'day';
    END CASE;

    RETURN QUERY
    SELECT 
        TO_CHAR(DATE_TRUNC(date_trunc_format, ph.created_at), 
            CASE p_granularity
                WHEN 'hour' THEN 'YYYY-MM-DD HH24:00'
                WHEN 'day' THEN 'YYYY-MM-DD'
                WHEN 'week' THEN 'YYYY-"W"WW'
                WHEN 'month' THEN 'YYYY-MM'
                ELSE 'YYYY-MM-DD'
            END
        ) as period,
        COUNT(*) as total_payments,
        COUNT(*) FILTER (WHERE ph.status = 'succeeded') as succeeded_payments,
        COUNT(*) FILTER (WHERE ph.status = 'failed') as failed_payments,
        COALESCE(SUM(ph.amount) FILTER (WHERE ph.status = 'succeeded'), 0) as revenue
    FROM payment_history ph
    WHERE ph.created_at BETWEEN p_start_date AND p_end_date
    GROUP BY DATE_TRUNC(date_trunc_format, ph.created_at)
    ORDER BY DATE_TRUNC(date_trunc_format, ph.created_at);
END;
$$ LANGUAGE plpgsql;

-- Row Level Security
ALTER TABLE payment_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_alert_thresholds ENABLE ROW LEVEL SECURITY;

-- Policies for payment_alerts
CREATE POLICY "Admins can view all payment alerts"
    ON payment_alerts FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

CREATE POLICY "Admins can insert payment alerts"
    ON payment_alerts FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

CREATE POLICY "Admins can update payment alerts"
    ON payment_alerts FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Policies for payment_alert_thresholds
CREATE POLICY "Admins can view payment alert thresholds"
    ON payment_alert_thresholds FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

CREATE POLICY "Admins can update payment alert thresholds"
    ON payment_alert_thresholds FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_payment_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION get_payment_method_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION get_payment_failure_reasons TO authenticated;
GRANT EXECUTE ON FUNCTION get_payment_trend TO authenticated;

-- Create updated_at trigger for payment_alerts
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payment_alerts_updated_at
    BEFORE UPDATE ON payment_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_alert_thresholds_updated_at
    BEFORE UPDATE ON payment_alert_thresholds
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comment on tables
COMMENT ON TABLE payment_alerts IS 'Stores payment-related alerts for monitoring dashboard';
COMMENT ON TABLE payment_alert_thresholds IS 'Configuration for payment alert thresholds';
COMMENT ON FUNCTION get_payment_metrics IS 'Returns aggregated payment metrics for a time period';
COMMENT ON FUNCTION get_payment_method_metrics IS 'Returns payment metrics broken down by payment method';
COMMENT ON FUNCTION get_payment_failure_reasons IS 'Returns top failure reasons with examples';
COMMENT ON FUNCTION get_payment_trend IS 'Returns payment trend over time with specified granularity';