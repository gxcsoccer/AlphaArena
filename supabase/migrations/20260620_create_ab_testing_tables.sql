-- ============================================================
-- A/B Testing Framework Tables
-- ============================================================
-- Issue #541: Landing Page A/B 测试框架
-- Creates tables for experiments, variants, and metrics tracking
-- ============================================================

-- ============================================================
-- Experiments Table
-- ============================================================
-- Stores A/B test experiment configurations

CREATE TABLE IF NOT EXISTS experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed', 'archived')),
    target_page VARCHAR(255) NOT NULL,
    target_selector VARCHAR(255),
    traffic_allocation DECIMAL(5, 2) DEFAULT 100.00 CHECK (traffic_allocation >= 0 AND traffic_allocation <= 100),
    start_at TIMESTAMP WITH TIME ZONE,
    end_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_dates CHECK (end_at IS NULL OR start_at IS NULL OR end_at > start_at)
);

-- Indexes for experiments
CREATE INDEX idx_experiments_status ON experiments(status);
CREATE INDEX idx_experiments_target_page ON experiments(target_page);
CREATE INDEX idx_experiments_start_at ON experiments(start_at);
CREATE INDEX idx_experiments_created_at ON experiments(created_at DESC);

-- Comments
COMMENT ON TABLE experiments IS 'A/B test experiment configurations';
COMMENT ON COLUMN experiments.status IS 'Experiment status: draft, running, paused, completed, archived';
COMMENT ON COLUMN experiments.target_page IS 'URL path or page identifier where experiment runs';
COMMENT ON COLUMN experiments.target_selector IS 'CSS selector for the element being tested (optional)';
COMMENT ON COLUMN experiments.traffic_allocation IS 'Percentage of users included in experiment (0-100)';
COMMENT ON COLUMN experiments.metadata IS 'Additional experiment configuration as JSON';

-- ============================================================
-- Variants Table
-- ============================================================
-- Stores experiment variants (A, B, C, etc.)

CREATE TABLE IF NOT EXISTS experiment_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    key VARCHAR(50) NOT NULL, -- 'control', 'variant_a', 'variant_b', etc.
    description TEXT,
    traffic_weight DECIMAL(5, 2) DEFAULT 50.00 CHECK (traffic_weight >= 0 AND traffic_weight <= 100),
    is_control BOOLEAN DEFAULT FALSE,
    config JSONB DEFAULT '{}', -- Variant-specific configuration
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_variant_key UNIQUE (experiment_id, key),
    CONSTRAINT valid_traffic_weight CHECK (traffic_weight >= 0)
);

-- Indexes for variants
CREATE INDEX idx_variants_experiment ON experiment_variants(experiment_id);
CREATE INDEX idx_variants_key ON experiment_variants(key);

-- Comments
COMMENT ON TABLE experiment_variants IS 'A/B test experiment variants';
COMMENT ON COLUMN experiment_variants.key IS 'Unique identifier for the variant within experiment';
COMMENT ON COLUMN experiment_variants.traffic_weight IS 'Relative weight for traffic distribution';
COMMENT ON COLUMN experiment_variants.is_control IS 'Whether this is the control group';
COMMENT ON COLUMN experiment_variants.config IS 'Variant configuration (e.g., content changes, styles)';

-- ============================================================
-- Variant Assignments Table
-- ============================================================
-- Tracks which variant each user/session is assigned to

CREATE TABLE IF NOT EXISTS experiment_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES experiment_variants(id) ON DELETE CASCADE,
    user_id VARCHAR(255),
    session_id VARCHAR(255) NOT NULL,
    device_id VARCHAR(255),
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_user_assignment UNIQUE (experiment_id, user_id),
    CONSTRAINT unique_session_assignment UNIQUE (experiment_id, session_id)
);

-- Indexes for assignments
CREATE INDEX idx_assignments_experiment ON experiment_assignments(experiment_id);
CREATE INDEX idx_assignments_variant ON experiment_assignments(variant_id);
CREATE INDEX idx_assignments_user ON experiment_assignments(user_id);
CREATE INDEX idx_assignments_session ON experiment_assignments(session_id);
CREATE INDEX idx_assignments_assigned_at ON experiment_assignments(assigned_at);

-- Comments
COMMENT ON TABLE experiment_assignments IS 'User/session to variant assignments';
COMMENT ON COLUMN experiment_assignments.assigned_at IS 'When the user was assigned to this variant';

-- ============================================================
-- Experiment Events Table
-- ============================================================
-- Tracks events (impressions, clicks, conversions) for each variant

CREATE TABLE IF NOT EXISTS experiment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES experiment_variants(id) ON DELETE CASCADE,
    user_id VARCHAR(255),
    session_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('impression', 'click', 'conversion', 'custom')),
    event_name VARCHAR(100),
    event_value DECIMAL(20, 6),
    properties JSONB DEFAULT '{}',
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    event_date DATE GENERATED ALWAYS AS (DATE(occurred_at)) STORED,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for events
CREATE INDEX idx_events_experiment ON experiment_events(experiment_id);
CREATE INDEX idx_events_variant ON experiment_events(variant_id);
CREATE INDEX idx_events_type ON experiment_events(event_type);
CREATE INDEX idx_events_occurred ON experiment_events(occurred_at DESC);
CREATE INDEX idx_events_date ON experiment_events(event_date);
CREATE INDEX idx_events_user ON experiment_events(user_id);
CREATE INDEX idx_events_session ON experiment_events(session_id);

-- Partial indexes for common queries
CREATE INDEX idx_events_impression ON experiment_events(experiment_id, variant_id) 
    WHERE event_type = 'impression';
CREATE INDEX idx_events_conversion ON experiment_events(experiment_id, variant_id) 
    WHERE event_type = 'conversion';
CREATE INDEX idx_events_click ON experiment_events(experiment_id, variant_id) 
    WHERE event_type = 'click';

-- Comments
COMMENT ON TABLE experiment_events IS 'Events tracked for experiment analysis';
COMMENT ON COLUMN experiment_events.event_type IS 'Type of event: impression, click, conversion, custom';
COMMENT ON COLUMN experiment_events.event_name IS 'Name for custom events';
COMMENT ON COLUMN experiment_events.event_value IS 'Numeric value associated with the event';

-- ============================================================
-- Experiment Statistics Table
-- ============================================================
-- Pre-calculated statistics for faster dashboard queries

CREATE TABLE IF NOT EXISTS experiment_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES experiment_variants(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Counts
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    
    -- Calculated metrics
    conversion_rate DECIMAL(10, 6),
    click_rate DECIMAL(10, 6),
    avg_session_duration_seconds DECIMAL(10, 2),
    bounce_rate DECIMAL(5, 2),
    
    -- Statistical significance
    chi_square DECIMAL(20, 10),
    p_value DECIMAL(20, 15),
    confidence_interval_lower DECIMAL(10, 6),
    confidence_interval_upper DECIMAL(10, 6),
    is_significant BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_variant_stats UNIQUE (experiment_id, variant_id, date)
);

-- Indexes for statistics
CREATE INDEX idx_stats_experiment ON experiment_statistics(experiment_id);
CREATE INDEX idx_stats_variant ON experiment_statistics(variant_id);
CREATE INDEX idx_stats_date ON experiment_statistics(date DESC);

-- Comments
COMMENT ON TABLE experiment_statistics IS 'Pre-calculated daily statistics per variant';
COMMENT ON COLUMN experiment_statistics.chi_square IS 'Chi-square statistic for significance testing';
COMMENT ON COLUMN experiment_statistics.p_value IS 'P-value for statistical significance';
COMMENT ON COLUMN experiment_statistics.confidence_interval_lower IS 'Lower bound of 95% confidence interval';
COMMENT ON COLUMN experiment_statistics.confidence_interval_upper IS 'Upper bound of 95% confidence interval';

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_statistics ENABLE ROW LEVEL SECURITY;

-- Service role can access all tables
CREATE POLICY "Service role can manage experiments" ON experiments
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage experiment_variants" ON experiment_variants
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage experiment_assignments" ON experiment_assignments
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage experiment_events" ON experiment_events
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage experiment_statistics" ON experiment_statistics
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users can read active experiments for their session
CREATE POLICY "Users can read active experiments" ON experiments
    FOR SELECT TO authenticated USING (status = 'running');

-- Users can read variants for active experiments
CREATE POLICY "Users can read active variants" ON experiment_variants
    FOR SELECT TO authenticated 
    USING (EXISTS (
        SELECT 1 FROM experiments 
        WHERE experiments.id = experiment_variants.experiment_id 
        AND experiments.status = 'running'
    ));

-- Users can insert their own assignments
CREATE POLICY "Users can insert own assignments" ON experiment_assignments
    FOR INSERT TO authenticated 
    WITH CHECK (session_id IS NOT NULL);

-- Users can insert their own events
CREATE POLICY "Users can insert own events" ON experiment_events
    FOR INSERT TO authenticated 
    WITH CHECK (session_id IS NOT NULL);

-- ============================================================
-- Functions
-- ============================================================

-- Function to assign user to a variant
CREATE OR REPLACE FUNCTION assign_experiment_variant(
    p_experiment_id UUID,
    p_session_id VARCHAR,
    p_user_id VARCHAR DEFAULT NULL,
    p_device_id VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_variant_id UUID;
    v_experiment RECORD;
    v_variants RECORD[];
    v_total_weight DECIMAL(10, 2);
    v_random_value DECIMAL(10, 2);
    v_cumulative_weight DECIMAL(10, 2) := 0;
BEGIN
    -- Check if experiment exists and is running
    SELECT * INTO v_experiment 
    FROM experiments 
    WHERE id = p_experiment_id AND status = 'running';
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Check if already assigned (by user_id or session_id)
    IF p_user_id IS NOT NULL THEN
        SELECT variant_id INTO v_variant_id
        FROM experiment_assignments
        WHERE experiment_id = p_experiment_id AND user_id = p_user_id;
        
        IF v_variant_id IS NOT NULL THEN
            RETURN v_variant_id;
        END IF;
    END IF;
    
    SELECT variant_id INTO v_variant_id
    FROM experiment_assignments
    WHERE experiment_id = p_experiment_id AND session_id = p_session_id;
    
    IF v_variant_id IS NOT NULL THEN
        RETURN v_variant_id;
    END IF;
    
    -- Get variants and their weights
    SELECT ARRAY_AGG(v) INTO v_variants
    FROM experiment_variants v
    WHERE v.experiment_id = p_experiment_id
    ORDER BY v.key;
    
    -- Calculate total weight
    SELECT SUM(traffic_weight) INTO v_total_weight
    FROM experiment_variants
    WHERE experiment_id = p_experiment_id;
    
    -- Generate random value
    v_random_value := RANDOM() * v_total_weight;
    
    -- Select variant based on weight
    FOR i IN 1..ARRAY_LENGTH(v_variants, 1) LOOP
        v_cumulative_weight := v_cumulative_weight + v_variants[i].traffic_weight;
        IF v_random_value <= v_cumulative_weight THEN
            v_variant_id := v_variants[i].id;
            EXIT;
        END IF;
    END LOOP;
    
    -- Create assignment
    INSERT INTO experiment_assignments (
        experiment_id, variant_id, user_id, session_id, device_id
    ) VALUES (
        p_experiment_id, v_variant_id, p_user_id, p_session_id, p_device_id
    );
    
    RETURN v_variant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track event
CREATE OR REPLACE FUNCTION track_experiment_event(
    p_experiment_id UUID,
    p_variant_id UUID,
    p_session_id VARCHAR,
    p_event_type VARCHAR,
    p_event_name VARCHAR DEFAULT NULL,
    p_event_value DECIMAL DEFAULT NULL,
    p_properties JSONB DEFAULT '{}',
    p_user_id VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO experiment_events (
        experiment_id, variant_id, session_id, user_id,
        event_type, event_name, event_value, properties
    ) VALUES (
        p_experiment_id, p_variant_id, p_session_id, p_user_id,
        p_event_type, p_event_name, p_event_value, p_properties
    ) RETURNING id INTO v_event_id;
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate experiment statistics
CREATE OR REPLACE FUNCTION calculate_experiment_stats(
    p_experiment_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS void AS $$
DECLARE
    v_control_stats RECORD;
    v_variant RECORD;
    v_impressions INTEGER;
    v_clicks INTEGER;
    v_conversions INTEGER;
    v_unique_visitors INTEGER;
    v_conversion_rate DECIMAL(10, 6);
    v_click_rate DECIMAL(10, 6);
BEGIN
    -- Get control variant stats for comparison
    SELECT 
        COUNT(*) FILTER (WHERE event_type = 'impression') as impressions,
        COUNT(*) FILTER (WHERE event_type = 'click') as clicks,
        COUNT(*) FILTER (WHERE event_type = 'conversion') as conversions,
        COUNT(DISTINCT session_id) as unique_visitors
    INTO v_control_stats
    FROM experiment_events e
    JOIN experiment_variants v ON e.variant_id = v.id
    WHERE e.experiment_id = p_experiment_id
      AND v.is_control = TRUE
      AND DATE(e.occurred_at) = p_date;
    
    -- Calculate stats for each variant
    FOR v_variant IN 
        SELECT id FROM experiment_variants WHERE experiment_id = p_experiment_id
    LOOP
        -- Get counts
        SELECT 
            COUNT(*) FILTER (WHERE event_type = 'impression'),
            COUNT(*) FILTER (WHERE event_type = 'click'),
            COUNT(*) FILTER (WHERE event_type = 'conversion'),
            COUNT(DISTINCT session_id)
        INTO v_impressions, v_clicks, v_conversions, v_unique_visitors
        FROM experiment_events
        WHERE experiment_id = p_experiment_id
          AND variant_id = v_variant.id
          AND DATE(occurred_at) = p_date;
        
        -- Calculate rates
        v_conversion_rate := CASE 
            WHEN v_unique_visitors > 0 
            THEN (v_conversions::DECIMAL / v_unique_visitors) * 100 
            ELSE 0 
        END;
        
        v_click_rate := CASE 
            WHEN v_impressions > 0 
            THEN (v_clicks::DECIMAL / v_impressions) * 100 
            ELSE 0 
        END;
        
        -- Upsert statistics
        INSERT INTO experiment_statistics (
            experiment_id, variant_id, date,
            impressions, clicks, conversions, unique_visitors,
            conversion_rate, click_rate
        ) VALUES (
            p_experiment_id, v_variant.id, p_date,
            v_impressions, v_clicks, v_conversions, v_unique_visitors,
            v_conversion_rate, v_click_rate
        ) ON CONFLICT (experiment_id, variant_id, date) DO UPDATE SET
            impressions = EXCLUDED.impressions,
            clicks = EXCLUDED.clicks,
            conversions = EXCLUDED.conversions,
            unique_visitors = EXCLUDED.unique_visitors,
            conversion_rate = EXCLUDED.conversion_rate,
            click_rate = EXCLUDED.click_rate,
            updated_at = NOW();
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get experiment results with statistical significance
CREATE OR REPLACE FUNCTION get_experiment_results(p_experiment_id UUID)
RETURNS TABLE (
    variant_id UUID,
    variant_key VARCHAR,
    variant_name VARCHAR,
    is_control BOOLEAN,
    total_visitors INTEGER,
    total_conversions INTEGER,
    conversion_rate DECIMAL(10, 6),
    improvement DECIMAL(10, 4),
    p_value DECIMAL(20, 15),
    confidence_lower DECIMAL(10, 6),
    confidence_upper DECIMAL(10, 6),
    is_significant BOOLEAN,
    recommendation TEXT
) AS $$
DECLARE
    v_control_rate DECIMAL(10, 6);
BEGIN
    -- Get control conversion rate
    SELECT conversion_rate INTO v_control_rate
    FROM experiment_statistics es
    JOIN experiment_variants v ON es.variant_id = v.id
    WHERE es.experiment_id = p_experiment_id
      AND v.is_control = TRUE
    ORDER BY es.date DESC
    LIMIT 1;
    
    RETURN QUERY
    SELECT 
        v.id as variant_id,
        v.key as variant_key,
        v.name as variant_name,
        v.is_control,
        COALESCE(SUM(es.unique_visitors), 0)::INTEGER as total_visitors,
        COALESCE(SUM(es.conversions), 0)::INTEGER as total_conversions,
        CASE 
            WHEN SUM(es.unique_visitors) > 0 
            THEN (SUM(es.conversions)::DECIMAL / SUM(es.unique_visitors)) * 100 
            ELSE 0 
        END as conversion_rate,
        CASE 
            WHEN v_control_rate > 0 AND NOT v.is_control
            THEN ((CASE WHEN SUM(es.unique_visitors) > 0 
                        THEN (SUM(es.conversions)::DECIMAL / SUM(es.unique_visitors)) * 100 
                        ELSE 0 END) - v_control_rate) / v_control_rate * 100
            ELSE 0 
        END as improvement,
        es.p_value,
        es.confidence_interval_lower as confidence_lower,
        es.confidence_interval_upper as confidence_upper,
        es.is_significant,
        CASE 
            WHEN v.is_control THEN 'Control group (baseline)'
            WHEN es.is_significant AND es.p_value < 0.05 THEN 
                CASE 
                    WHEN (CASE WHEN SUM(es.unique_visitors) > 0 
                               THEN (SUM(es.conversions)::DECIMAL / SUM(es.unique_visitors)) * 100 
                               ELSE 0 END) > v_control_rate 
                    THEN 'Winner: Significantly better than control'
                    ELSE 'Loser: Significantly worse than control'
                END
            ELSE 'Inconclusive: Need more data'
        END as recommendation
    FROM experiment_variants v
    LEFT JOIN experiment_statistics es ON v.id = es.variant_id
    WHERE v.experiment_id = p_experiment_id
    GROUP BY v.id, v.key, v.name, v.is_control, es.p_value, es.confidence_interval_lower, 
             es.confidence_interval_upper, es.is_significant
    ORDER BY v.is_control DESC, conversion_rate DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Triggers
-- ============================================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_experiments_updated_at
    BEFORE UPDATE ON experiments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_variants_updated_at
    BEFORE UPDATE ON experiment_variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Grants
-- ============================================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;