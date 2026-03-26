-- ============================================================
-- Payment Funnel Optimization Tables
-- ============================================================
-- Issue #662: 支付转化漏斗优化
-- Creates tables for tracking payment funnel stages and drop-offs
-- ============================================================

-- ============================================================
-- Payment Funnel Events Table
-- ============================================================
-- Tracks each step of the payment funnel with detailed metadata

CREATE TABLE IF NOT EXISTS payment_funnel_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255),
    session_id VARCHAR(255) NOT NULL,
    
    -- Funnel stage
    stage VARCHAR(50) NOT NULL CHECK (stage IN (
        'subscription_page_view',    -- 用户访问订阅页面
        'plan_selected',             -- 用户选择了计划
        'checkout_initiated',        -- 用户点击订阅按钮
        'checkout_loaded',           -- Stripe Checkout 页面加载
        'payment_method_entered',    -- 用户输入支付方式
        'payment_submitted',         -- 用户提交支付
        'payment_succeeded',         -- 支付成功
        'payment_failed',            -- 支付失败
        'checkout_canceled'          -- 用户取消支付
    )),
    
    -- Plan details
    plan_id VARCHAR(50),
    billing_period VARCHAR(20) CHECK (billing_period IN ('monthly', 'yearly')),
    price_amount DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'CNY',
    
    -- For payment stages
    stripe_session_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    
    -- Drop-off tracking
    drop_off_reason VARCHAR(100),
    drop_off_details JSONB DEFAULT '{}',
    
    -- A/B test tracking
    experiment_id UUID REFERENCES experiments(id),
    variant_id UUID REFERENCES experiment_variants(id),
    
    -- Context
    page_url TEXT,
    referrer TEXT,
    user_agent TEXT,
    device_type VARCHAR(20),
    browser VARCHAR(50),
    os VARCHAR(50),
    country VARCHAR(2),
    region VARCHAR(100),
    city VARCHAR(100),
    
    -- Timing
    time_on_page_seconds INTEGER,
    time_to_action_seconds INTEGER,
    
    -- Timestamps
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_date DATE GENERATED ALWAYS AS (DATE(occurred_at)) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient funnel analysis
CREATE INDEX idx_funnel_events_session ON payment_funnel_events(session_id);
CREATE INDEX idx_funnel_events_user ON payment_funnel_events(user_id);
CREATE INDEX idx_funnel_events_stage ON payment_funnel_events(stage);
CREATE INDEX idx_funnel_events_occurred ON payment_funnel_events(occurred_at DESC);
CREATE INDEX idx_funnel_events_date ON payment_funnel_events(event_date);
CREATE INDEX idx_funnel_events_experiment ON payment_funnel_events(experiment_id);
CREATE INDEX idx_funnel_events_plan ON payment_funnel_events(plan_id);

-- Partial indexes for specific funnel stages
CREATE INDEX idx_funnel_view ON payment_funnel_events(session_id) 
    WHERE stage = 'subscription_page_view';
CREATE INDEX idx_funnel_checkout ON payment_funnel_events(session_id) 
    WHERE stage = 'checkout_initiated';
CREATE INDEX idx_funnel_success ON payment_funnel_events(session_id) 
    WHERE stage = 'payment_succeeded';
CREATE INDEX idx_funnel_failed ON payment_funnel_events(session_id) 
    WHERE stage = 'payment_failed';

-- Comments
COMMENT ON TABLE payment_funnel_events IS 'Tracks each step of the payment conversion funnel';
COMMENT ON COLUMN payment_funnel_events.stage IS 'Funnel stage: subscription_page_view, plan_selected, checkout_initiated, etc.';
COMMENT ON COLUMN payment_funnel_events.drop_off_reason IS 'Reason for drop-off: price_concern, complexity, technical_issue, etc.';

-- ============================================================
-- Payment Funnel Sessions Table
-- ============================================================
-- Aggregates session-level funnel data for faster analysis

CREATE TABLE IF NOT EXISTS payment_funnel_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL UNIQUE,
    user_id VARCHAR(255),
    
    -- Funnel completion status
    completed_stage VARCHAR(50),
    is_converted BOOLEAN DEFAULT FALSE,
    is_dropped BOOLEAN DEFAULT FALSE,
    drop_off_stage VARCHAR(50),
    drop_off_reason VARCHAR(100),
    
    -- Plan information
    selected_plan_id VARCHAR(50),
    selected_billing_period VARCHAR(20),
    selected_price DECIMAL(10, 2),
    
    -- A/B test
    experiment_id UUID REFERENCES experiments(id),
    variant_id UUID REFERENCES experiment_variants(id),
    
    -- Journey timing
    first_event_at TIMESTAMPTZ,
    last_event_at TIMESTAMPTZ,
    total_time_seconds INTEGER,
    time_to_checkout_seconds INTEGER,
    time_to_completion_seconds INTEGER,
    
    -- Device/context
    device_type VARCHAR(20),
    country VARCHAR(2),
    
    -- Event counts
    event_count INTEGER DEFAULT 1,
    page_view_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_funnel_sessions_session ON payment_funnel_sessions(session_id);
CREATE INDEX idx_funnel_sessions_user ON payment_funnel_sessions(user_id);
CREATE INDEX idx_funnel_sessions_converted ON payment_funnel_sessions(is_converted);
CREATE INDEX idx_funnel_sessions_dropped ON payment_funnel_sessions(is_dropped, drop_off_stage);
CREATE INDEX idx_funnel_sessions_experiment ON payment_funnel_sessions(experiment_id);
CREATE INDEX idx_funnel_sessions_first_event ON payment_funnel_sessions(first_event_at DESC);

-- Comments
COMMENT ON TABLE payment_funnel_sessions IS 'Session-level aggregation of payment funnel data';

-- ============================================================
-- Payment Drop-off Reasons Table
-- ============================================================
-- Reference table for categorizing drop-off reasons

CREATE TABLE IF NOT EXISTS payment_dropoff_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    suggestions JSONB DEFAULT '[]', -- Suggested improvements
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    is_actionable BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert common drop-off reasons
INSERT INTO payment_dropoff_reasons (code, category, description, suggestions, severity, is_actionable) VALUES
('price_concern', 'financial', '用户对价格有顾虑', 
 '["提供优惠券", "展示年付优惠", "增加价值说明"]'::jsonb, 'medium', true),
('comparison', 'behavioral', '用户在比较其他选项', 
 '["展示竞品对比", "突出独特价值", "限时优惠"]'::jsonb, 'medium', true),
('complexity', 'ux', '支付流程过于复杂', 
 '["简化支付步骤", "减少表单字段", "提供一键支付"]'::jsonb, 'high', true),
('technical_issue', 'technical', '技术问题导致失败', 
 '["检查支付网关", "优化错误提示", "提供备用支付方式"]'::jsonb, 'critical', true),
('payment_declined', 'payment', '支付被拒绝', 
 '["提供多种支付方式", "检查卡片有效性", "联系客服"]'::jsonb, 'high', true),
('timeout', 'technical', '会话超时', 
 '["延长会话时间", "保存用户进度", "自动恢复"]'::jsonb, 'medium', true),
('distracted', 'behavioral', '用户分心离开', 
 '["发送提醒邮件", "购物车保留通知", "限时优惠"]'::jsonb, 'low', true),
('not_ready', 'behavioral', '用户还没准备好购买', 
 '["提供试用", "发送后续营销", "价值教育"]'::jsonb, 'low', true),
('trust_issue', 'trust', '用户对平台信任度不足', 
 '["展示安全认证", "用户评价", "退款保障"]'::jsonb, 'high', true),
('missing_features', 'product', '缺少用户需要的功能', 
 '["功能调研", "产品反馈收集", "路线图透明化"]'::jsonb, 'medium', true);

-- Comments
COMMENT ON TABLE payment_dropoff_reasons IS 'Reference table for categorizing payment drop-off reasons';

-- ============================================================
-- Payment Funnel Daily Stats Table
-- ============================================================
-- Pre-calculated daily statistics for dashboard

CREATE TABLE IF NOT EXISTS payment_funnel_daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    
    -- Stage counts
    page_views INTEGER DEFAULT 0,
    plan_selections INTEGER DEFAULT 0,
    checkout_initiations INTEGER DEFAULT 0,
    checkout_loads INTEGER DEFAULT 0,
    payment_submissions INTEGER DEFAULT 0,
    payment_successes INTEGER DEFAULT 0,
    payment_failures INTEGER DEFAULT 0,
    checkout_cancellations INTEGER DEFAULT 0,
    
    -- Unique counts
    unique_visitors INTEGER DEFAULT 0,
    unique_conversions INTEGER DEFAULT 0,
    
    -- Conversion rates
    page_to_selection_rate DECIMAL(10, 4),
    selection_to_checkout_rate DECIMAL(10, 4),
    checkout_to_payment_rate DECIMAL(10, 4),
    payment_to_success_rate DECIMAL(10, 4),
    overall_conversion_rate DECIMAL(10, 4),
    
    -- Revenue
    total_revenue DECIMAL(12, 2) DEFAULT 0,
    lost_revenue DECIMAL(12, 2) DEFAULT 0,
    
    -- Drop-off analysis
    top_dropoff_stage VARCHAR(50),
    top_dropoff_reason VARCHAR(100),
    dropoff_distribution JSONB DEFAULT '{}',
    
    -- A/B test (if active)
    experiment_id UUID REFERENCES experiments(id),
    variant_id UUID REFERENCES experiment_variants(id),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_funnel_stats UNIQUE (date, experiment_id, variant_id)
);

-- Indexes
CREATE INDEX idx_funnel_daily_stats_date ON payment_funnel_daily_stats(date DESC);
CREATE INDEX idx_funnel_daily_stats_experiment ON payment_funnel_daily_stats(experiment_id, date DESC);

-- Comments
COMMENT ON TABLE payment_funnel_daily_stats IS 'Pre-calculated daily statistics for payment funnel analysis';

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE payment_funnel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_funnel_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_dropoff_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_funnel_daily_stats ENABLE ROW LEVEL SECURITY;

-- Service role can access all tables
CREATE POLICY "Service role can manage payment funnel events" ON payment_funnel_events
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage payment funnel sessions" ON payment_funnel_sessions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage dropoff reasons" ON payment_dropoff_reasons
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage funnel daily stats" ON payment_funnel_daily_stats
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users can insert their own events
CREATE POLICY "Users can insert own funnel events" ON payment_funnel_events
    FOR INSERT TO authenticated WITH CHECK (session_id IS NOT NULL);

-- ============================================================
-- Functions
-- ============================================================

-- Function to track funnel event
CREATE OR REPLACE FUNCTION track_payment_funnel_event(
    p_session_id VARCHAR,
    p_stage VARCHAR,
    p_user_id VARCHAR DEFAULT NULL,
    p_plan_id VARCHAR DEFAULT NULL,
    p_billing_period VARCHAR DEFAULT NULL,
    p_price_amount DECIMAL DEFAULT NULL,
    p_stripe_session_id VARCHAR DEFAULT NULL,
    p_drop_off_reason VARCHAR DEFAULT NULL,
    p_drop_off_details JSONB DEFAULT '{}',
    p_experiment_id UUID DEFAULT NULL,
    p_variant_id UUID DEFAULT NULL,
    p_time_on_page_seconds INTEGER DEFAULT NULL,
    p_page_url TEXT DEFAULT NULL,
    p_referrer TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_device_type VARCHAR DEFAULT NULL,
    p_country VARCHAR DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
    v_session RECORD;
BEGIN
    -- Insert event
    INSERT INTO payment_funnel_events (
        session_id, stage, user_id, plan_id, billing_period, price_amount,
        stripe_session_id, drop_off_reason, drop_off_details,
        experiment_id, variant_id, time_on_page_seconds,
        page_url, referrer, user_agent, device_type, country
    ) VALUES (
        p_session_id, p_stage, p_user_id, p_plan_id, p_billing_period, p_price_amount,
        p_stripe_session_id, p_drop_off_reason, p_drop_off_details,
        p_experiment_id, p_variant_id, p_time_on_page_seconds,
        p_page_url, p_referrer, p_user_agent, p_device_type, p_country
    ) RETURNING id INTO v_event_id;
    
    -- Update or create session record
    INSERT INTO payment_funnel_sessions (
        session_id, user_id, completed_stage, 
        first_event_at, last_event_at, event_count,
        selected_plan_id, selected_billing_period, selected_price,
        experiment_id, variant_id, device_type, country
    ) VALUES (
        p_session_id, p_user_id, p_stage,
        NOW(), NOW(), 1,
        p_plan_id, p_billing_period, p_price_amount,
        p_experiment_id, p_variant_id, p_device_type, p_country
    )
    ON CONFLICT (session_id) DO UPDATE SET
        completed_stage = p_stage,
        user_id = COALESCE(p_user_id, payment_funnel_sessions.user_id),
        last_event_at = NOW(),
        event_count = payment_funnel_sessions.event_count + 1,
        total_time_seconds = EXTRACT(EPOCH FROM (NOW() - payment_funnel_sessions.first_event_at))::INTEGER,
        updated_at = NOW(),
        -- Update plan info if provided
        selected_plan_id = COALESCE(p_plan_id, payment_funnel_sessions.selected_plan_id),
        selected_billing_period = COALESCE(p_billing_period, payment_funnel_sessions.selected_billing_period),
        selected_price = COALESCE(p_price_amount, payment_funnel_sessions.selected_price)
    WHERE payment_funnel_sessions.session_id = p_session_id;
    
    -- Update conversion status
    IF p_stage = 'payment_succeeded' THEN
        UPDATE payment_funnel_sessions
        SET is_converted = TRUE, 
            time_to_completion_seconds = EXTRACT(EPOCH FROM (NOW() - first_event_at))::INTEGER
        WHERE session_id = p_session_id;
    ELSIF p_stage IN ('payment_failed', 'checkout_canceled') THEN
        UPDATE payment_funnel_sessions
        SET is_dropped = TRUE,
            drop_off_stage = p_stage,
            drop_off_reason = COALESCE(p_drop_off_reason, 'unknown')
        WHERE session_id = p_session_id;
    END IF;
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate funnel statistics
CREATE OR REPLACE FUNCTION calculate_payment_funnel_stats(
    p_date DATE DEFAULT CURRENT_DATE
) RETURNS void AS $$
DECLARE
    v_stats RECORD;
BEGIN
    -- Calculate daily stats
    SELECT 
        COUNT(*) FILTER (WHERE stage = 'subscription_page_view') as page_views,
        COUNT(*) FILTER (WHERE stage = 'plan_selected') as plan_selections,
        COUNT(*) FILTER (WHERE stage = 'checkout_initiated') as checkout_initiations,
        COUNT(*) FILTER (WHERE stage = 'checkout_loaded') as checkout_loads,
        COUNT(*) FILTER (WHERE stage = 'payment_submitted') as payment_submissions,
        COUNT(*) FILTER (WHERE stage = 'payment_succeeded') as payment_successes,
        COUNT(*) FILTER (WHERE stage = 'payment_failed') as payment_failures,
        COUNT(*) FILTER (WHERE stage = 'checkout_canceled') as checkout_cancellations,
        COUNT(DISTINCT session_id) as unique_visitors,
        COUNT(DISTINCT session_id) FILTER (WHERE stage = 'payment_succeeded') as unique_conversions
    INTO v_stats
    FROM payment_funnel_events
    WHERE event_date = p_date;
    
    -- Get drop-off distribution
    WITH dropoffs AS (
        SELECT drop_off_stage, COUNT(*) as cnt
        FROM payment_funnel_sessions
        WHERE DATE(last_event_at) = p_date
          AND is_dropped = TRUE
        GROUP BY drop_off_stage
        ORDER BY cnt DESC
    )
    SELECT 
        drop_off_stage,
        jsonb_object_agg(drop_off_stage, cnt)
    FROM dropoffs
    LIMIT 1;
    
    -- Insert or update stats
    INSERT INTO payment_funnel_daily_stats (
        date,
        page_views, plan_selections, checkout_initiations, checkout_loads,
        payment_submissions, payment_successes, payment_failures, checkout_cancellations,
        unique_visitors, unique_conversions,
        page_to_selection_rate, selection_to_checkout_rate, 
        checkout_to_payment_rate, payment_to_success_rate,
        overall_conversion_rate
    ) VALUES (
        p_date,
        v_stats.page_views, v_stats.plan_selections, v_stats.checkout_initiations, v_stats.checkout_loads,
        v_stats.payment_submissions, v_stats.payment_successes, v_stats.payment_failures, v_stats.checkout_cancellations,
        v_stats.unique_visitors, v_stats.unique_conversions,
        CASE WHEN v_stats.page_views > 0 THEN (v_stats.plan_selections::DECIMAL / v_stats.page_views) * 100 ELSE 0 END,
        CASE WHEN v_stats.plan_selections > 0 THEN (v_stats.checkout_initiations::DECIMAL / v_stats.plan_selections) * 100 ELSE 0 END,
        CASE WHEN v_stats.checkout_loads > 0 THEN (v_stats.payment_submissions::DECIMAL / v_stats.checkout_loads) * 100 ELSE 0 END,
        CASE WHEN v_stats.payment_submissions > 0 THEN (v_stats.payment_successes::DECIMAL / v_stats.payment_submissions) * 100 ELSE 0 END,
        CASE WHEN v_stats.unique_visitors > 0 THEN (v_stats.unique_conversions::DECIMAL / v_stats.unique_visitors) * 100 ELSE 0 END
    )
    ON CONFLICT (date, experiment_id, variant_id) DO UPDATE SET
        page_views = EXCLUDED.page_views,
        plan_selections = EXCLUDED.plan_selections,
        checkout_initiations = EXCLUDED.checkout_initiations,
        checkout_loads = EXCLUDED.checkout_loads,
        payment_submissions = EXCLUDED.payment_submissions,
        payment_successes = EXCLUDED.payment_successes,
        payment_failures = EXCLUDED.payment_failures,
        checkout_cancellations = EXCLUDED.checkout_cancellations,
        unique_visitors = EXCLUDED.unique_visitors,
        unique_conversions = EXCLUDED.unique_conversions,
        page_to_selection_rate = EXCLUDED.page_to_selection_rate,
        selection_to_checkout_rate = EXCLUDED.selection_to_checkout_rate,
        checkout_to_payment_rate = EXCLUDED.checkout_to_payment_rate,
        payment_to_success_rate = EXCLUDED.payment_to_success_rate,
        overall_conversion_rate = EXCLUDED.overall_conversion_rate,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get funnel analysis
CREATE OR REPLACE FUNCTION get_payment_funnel_analysis(
    p_start_date DATE,
    p_end_date DATE,
    p_experiment_id UUID DEFAULT NULL
) RETURNS TABLE (
    date DATE,
    page_views BIGINT,
    plan_selections BIGINT,
    checkout_initiations BIGINT,
    payment_successes BIGINT,
    unique_visitors BIGINT,
    unique_conversions BIGINT,
    overall_conversion_rate DECIMAL,
    top_dropoff_stage VARCHAR,
    top_dropoff_reason VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.date,
        s.page_views,
        s.plan_selections,
        s.checkout_initiations,
        s.payment_successes,
        s.unique_visitors,
        s.unique_conversions,
        s.overall_conversion_rate,
        s.top_dropoff_stage,
        s.top_dropoff_reason
    FROM payment_funnel_daily_stats s
    WHERE s.date BETWEEN p_start_date AND p_end_date
      AND (p_experiment_id IS NULL OR s.experiment_id = p_experiment_id)
    ORDER BY s.date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get drop-off analysis
CREATE OR REPLACE FUNCTION get_payment_dropoff_analysis(
    p_start_date DATE,
    p_end_date DATE,
    p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
    drop_off_stage VARCHAR,
    drop_off_reason VARCHAR,
    count BIGINT,
    percentage DECIMAL,
    avg_time_before_dropoff DECIMAL,
    avg_selected_price DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.drop_off_stage,
        s.drop_off_reason,
        COUNT(*) as count,
        (COUNT(*)::DECIMAL / SUM(COUNT(*)) OVER ()) * 100 as percentage,
        AVG(s.total_time_seconds) as avg_time_before_dropoff,
        AVG(s.selected_price) as avg_selected_price
    FROM payment_funnel_sessions s
    WHERE s.is_dropped = TRUE
      AND DATE(s.last_event_at) BETWEEN p_start_date AND p_end_date
    GROUP BY s.drop_off_stage, s.drop_off_reason
    ORDER BY count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Triggers
-- ============================================================

CREATE TRIGGER update_funnel_sessions_updated_at
    BEFORE UPDATE ON payment_funnel_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_funnel_daily_stats_updated_at
    BEFORE UPDATE ON payment_funnel_daily_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Grants
-- ============================================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;