-- A/B Testing Framework Migration
-- Creates tables for experiments, variants, assignments, and events

-- Experiments Table
-- Stores experiment configurations
CREATE TABLE IF NOT EXISTS experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  experiment_type VARCHAR(50) NOT NULL DEFAULT 'referral', -- referral, ui, feature, etc.
  
  -- Targeting
  target_audience JSONB DEFAULT '{}', -- e.g., {"new_users": true, "countries": ["CN", "US"]}
  
  -- Configuration
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed', 'archived')),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  
  -- Traffic allocation
  traffic_allocation DECIMAL(5, 2) NOT NULL DEFAULT 100.00, -- Percentage of users to include (0-100)
  
  -- Statistical settings
  significance_level DECIMAL(3, 2) DEFAULT 0.05, -- p-value threshold (default: 0.05)
  minimum_sample_size INTEGER DEFAULT 1000, -- Minimum participants before calculating significance
  
  -- Results
  winning_variant_id UUID, -- Set when experiment is completed
  results JSONB DEFAULT '{}', -- Stores experiment results and statistics
  
  -- Metadata
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Experiment Variants Table
-- Stores variants for each experiment
CREATE TABLE IF NOT EXISTS experiment_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  
  -- Variant details
  name VARCHAR(100) NOT NULL, -- e.g., 'control', 'treatment_a'
  description TEXT,
  
  -- Configuration
  config JSONB NOT NULL DEFAULT '{}', -- Variant-specific configuration
  -- Example for referral experiment: {"invitee_bonus_days": 14, "referrer_bonus_days": 60}
  
  -- Traffic allocation
  traffic_percentage DECIMAL(5, 2) NOT NULL, -- Percentage of experiment traffic (must sum to 100 per experiment)
  is_control BOOLEAN NOT NULL DEFAULT false,
  
  -- Results
  participants INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  conversion_rate DECIMAL(5, 4) DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(experiment_id, name)
);

-- Experiment Assignments Table
-- Tracks which users are assigned to which variants
CREATE TABLE IF NOT EXISTS experiment_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES experiment_variants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Assignment metadata
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assignment_reason VARCHAR(50) DEFAULT 'random', -- random, forced, sticky
  
  -- Context at assignment time
  context JSONB DEFAULT '{}', -- e.g., {"device": "mobile", "country": "CN"}
  
  -- Conversion tracking
  converted BOOLEAN DEFAULT false,
  converted_at TIMESTAMPTZ,
  conversion_value DECIMAL(10, 2), -- Optional: value of conversion (e.g., revenue)
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(experiment_id, user_id)
);

-- Experiment Events Table
-- Tracks all events related to experiments
CREATE TABLE IF NOT EXISTS experiment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES experiment_variants(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  assignment_id UUID REFERENCES experiment_assignments(id) ON DELETE SET NULL,
  
  -- Event details
  event_type VARCHAR(50) NOT NULL, -- e.g., 'impression', 'click', 'conversion', 'activation'
  event_name VARCHAR(100), -- e.g., 'referral_sent', 'referral_registered', 'reward_earned'
  
  -- Event data
  event_data JSONB DEFAULT '{}', -- Additional event context
  
  -- Tracking
  session_id VARCHAR(100),
  device_type VARCHAR(20), -- mobile, desktop, tablet
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_experiments_status ON experiments(status);
CREATE INDEX idx_experiments_type ON experiments(experiment_type);
CREATE INDEX idx_experiments_dates ON experiments(start_date, end_date);
CREATE INDEX idx_experiment_variants_experiment_id ON experiment_variants(experiment_id);
CREATE INDEX idx_experiment_assignments_experiment_id ON experiment_assignments(experiment_id);
CREATE INDEX idx_experiment_assignments_user_id ON experiment_assignments(user_id);
CREATE INDEX idx_experiment_assignments_variant_id ON experiment_assignments(variant_id);
CREATE INDEX idx_experiment_assignments_converted ON experiment_assignments(experiment_id, converted);
CREATE INDEX idx_experiment_events_experiment_id ON experiment_events(experiment_id);
CREATE INDEX idx_experiment_events_user_id ON experiment_events(user_id);
CREATE INDEX idx_experiment_events_type ON experiment_events(event_type, event_name);
CREATE INDEX idx_experiment_events_created_at ON experiment_events(created_at DESC);

-- Row Level Security (RLS)
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_events ENABLE ROW LEVEL SECURITY;

-- Policies for experiments (admin only for write, public read for active experiments)
CREATE POLICY "Anyone can view running experiments"
  ON experiments FOR SELECT
  USING (status = 'running');

CREATE POLICY "Service role can manage experiments"
  ON experiments FOR ALL
  USING (auth.role() = 'service_role');

-- Policies for variants
CREATE POLICY "Anyone can view variants for running experiments"
  ON experiment_variants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = experiment_variants.experiment_id 
      AND experiments.status = 'running'
    )
  );

CREATE POLICY "Service role can manage variants"
  ON experiment_variants FOR ALL
  USING (auth.role() = 'service_role');

-- Policies for assignments
CREATE POLICY "Users can view own assignments"
  ON experiment_assignments FOR SELECT
  USING (auth.uid()::text = user_id::text OR auth.uid() = user_id);

CREATE POLICY "Service role can manage assignments"
  ON experiment_assignments FOR ALL
  USING (auth.role() = 'service_role');

-- Policies for events
CREATE POLICY "Users can view own events"
  ON experiment_events FOR SELECT
  USING (auth.uid()::text = user_id::text OR auth.uid() = user_id);

CREATE POLICY "Service role can manage events"
  ON experiment_events FOR ALL
  USING (auth.role() = 'service_role');

-- Triggers for updated_at timestamp
DROP TRIGGER IF EXISTS update_experiments_updated_at ON experiments;
CREATE TRIGGER update_experiments_updated_at
  BEFORE UPDATE ON experiments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_experiment_variants_updated_at ON experiment_variants;
CREATE TRIGGER update_experiment_variants_updated_at
  BEFORE UPDATE ON experiment_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to assign user to experiment variant
CREATE OR REPLACE FUNCTION assign_user_to_experiment(
  p_experiment_id UUID,
  p_user_id UUID,
  p_context JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
  v_experiment RECORD;
  v_variant RECORD;
  v_assignment RECORD;
  v_random_value DECIMAL(5, 4);
  v_cumulative_percentage DECIMAL(5, 2) := 0;
  v_assignment_id UUID;
BEGIN
  -- Check if experiment exists and is running
  SELECT * INTO v_experiment
  FROM experiments
  WHERE id = p_experiment_id AND status = 'running';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EXPERIMENT_NOT_FOUND',
      'message', 'Experiment not found or not running'
    );
  END IF;
  
  -- Check if user is already assigned
  SELECT * INTO v_assignment
  FROM experiment_assignments
  WHERE experiment_id = p_experiment_id AND user_id = p_user_id;
  
  IF FOUND THEN
    -- Return existing assignment
    SELECT * INTO v_variant
    FROM experiment_variants
    WHERE id = v_assignment.variant_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'variant', jsonb_build_object(
        'id', v_variant.id,
        'name', v_variant.name,
        'config', v_variant.config,
        'is_control', v_variant.is_control
      ),
      'assignment_id', v_assignment.id,
      'already_assigned', true
    );
  END IF;
  
  -- Check if user should be included in experiment based on traffic allocation
  v_random_value := random() * 100;
  
  IF v_random_value > v_experiment.traffic_allocation THEN
    RETURN jsonb_build_object(
      'success', true,
      'variant', null,
      'message', 'User not included in experiment (traffic allocation)'
    );
  END IF;
  
  -- Assign user to variant based on traffic percentages
  v_random_value := random() * 100;
  
  FOR v_variant IN
    SELECT * FROM experiment_variants
    WHERE experiment_id = p_experiment_id
    ORDER BY is_control DESC, name
  LOOP
    v_cumulative_percentage := v_cumulative_percentage + v_variant.traffic_percentage;
    
    IF v_random_value <= v_cumulative_percentage THEN
      -- Found the variant
      EXIT;
    ELSE
      -- Reset to null if not found (shouldn't happen if percentages sum to 100)
      v_variant := NULL;
    END IF;
  END LOOP;
  
  IF v_variant IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'VARIANT_ASSIGNMENT_FAILED',
      'message', 'Failed to assign variant'
    );
  END IF;
  
  -- Create assignment
  INSERT INTO experiment_assignments (
    experiment_id,
    variant_id,
    user_id,
    context,
    assignment_reason
  ) VALUES (
    p_experiment_id,
    v_variant.id,
    p_user_id,
    p_context,
    'random'
  ) RETURNING id INTO v_assignment_id;
  
  -- Update variant participant count
  UPDATE experiment_variants
  SET participants = participants + 1
  WHERE id = v_variant.id;
  
  RETURN jsonb_build_object(
    'success', true,
    'variant', jsonb_build_object(
      'id', v_variant.id,
      'name', v_variant.name,
      'config', v_variant.config,
      'is_control', v_variant.is_control
    ),
    'assignment_id', v_assignment_id,
    'already_assigned', false
  );
END;
$$ LANGUAGE plpgsql;

-- Function to track conversion event
CREATE OR REPLACE FUNCTION track_experiment_conversion(
  p_experiment_id UUID,
  p_user_id UUID,
  p_event_name VARCHAR(100) DEFAULT 'conversion',
  p_event_data JSONB DEFAULT '{}',
  p_conversion_value DECIMAL(10, 2) DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_assignment RECORD;
  v_variant RECORD;
BEGIN
  -- Find user's assignment
  SELECT * INTO v_assignment
  FROM experiment_assignments
  WHERE experiment_id = p_experiment_id AND user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ASSIGNMENT_NOT_FOUND',
      'message', 'User is not assigned to this experiment'
    );
  END IF;
  
  -- Check if already converted (for primary conversion)
  IF v_assignment.converted AND p_event_name = 'conversion' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_converted', true
    );
  END IF;
  
  -- Record event
  INSERT INTO experiment_events (
    experiment_id,
    variant_id,
    user_id,
    assignment_id,
    event_type,
    event_name,
    event_data
  ) VALUES (
    p_experiment_id,
    v_assignment.variant_id,
    p_user_id,
    v_assignment.id,
    'conversion',
    p_event_name,
    p_event_data
  );
  
  -- Update assignment conversion status (for primary conversion)
  IF p_event_name = 'conversion' THEN
    UPDATE experiment_assignments
    SET 
      converted = true,
      converted_at = NOW(),
      conversion_value = p_conversion_value
    WHERE id = v_assignment.id;
    
    -- Update variant conversion count
    UPDATE experiment_variants
    SET 
      conversions = conversions + 1,
      conversion_rate = (conversions + 1)::DECIMAL / NULLIF(participants, 0)
    WHERE id = v_assignment.variant_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'event_name', p_event_name
  );
END;
$$ LANGUAGE plpgsql;

-- Function to calculate experiment statistics
CREATE OR REPLACE FUNCTION calculate_experiment_statistics(
  p_experiment_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_experiment RECORD;
  v_variants JSONB;
  v_control RECORD;
  v_results JSONB := '{}';
  v_chi_square DECIMAL;
  v_p_value DECIMAL;
  v_confidence DECIMAL;
  v_winning_variant_id UUID;
BEGIN
  -- Get experiment details
  SELECT * INTO v_experiment FROM experiments WHERE id = p_experiment_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Experiment not found');
  END IF;
  
  -- Get variants with statistics
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', v.id,
      'name', v.name,
      'is_control', v.is_control,
      'participants', v.participants,
      'conversions', v.conversions,
      'conversion_rate', v.conversion_rate,
      'config', v.config
    )
  ) INTO v_variants
  FROM experiment_variants v
  WHERE v.experiment_id = p_experiment_id
  ORDER BY v.is_control DESC, v.name;
  
  -- Get control variant
  SELECT * INTO v_control
  FROM experiment_variants
  WHERE experiment_id = p_experiment_id AND is_control = true;
  
  IF v_control IS NULL OR v_control.participants < v_experiment.minimum_sample_size THEN
    -- Not enough data
    RETURN jsonb_build_object(
      'experiment_id', p_experiment_id,
      'variants', v_variants,
      'status', 'insufficient_data',
      'message', 'Minimum sample size not reached',
      'control_participants', COALESCE(v_control.participants, 0),
      'minimum_required', v_experiment.minimum_sample_size
    );
  END IF;
  
  -- Calculate Chi-square test for each treatment variant vs control
  -- Using simplified Z-test for two proportions
  
  SELECT jsonb_agg(
    jsonb_build_object(
      'variant_id', v.id,
      'variant_name', v.name,
      'control_participants', v_control.participants,
      'control_conversions', v_control.conversions,
      'control_rate', v_control.conversion_rate,
      'treatment_participants', v.participants,
      'treatment_conversions', v.conversions,
      'treatment_rate', v.conversion_rate,
      'lift', CASE 
        WHEN v_control.conversion_rate > 0 
        THEN ((v.conversion_rate - v_control.conversion_rate) / v_control.conversion_rate) * 100 
        ELSE 0 
      END,
      'is_significant', calculate_ab_significance(
        v_control.participants,
        v_control.conversions,
        v.participants,
        v.conversions,
        v_experiment.significance_level
      )
    )
  ) INTO v_results
  FROM experiment_variants v
  WHERE v.experiment_id = p_experiment_id AND v.is_control = false;
  
  -- Determine winning variant
  SELECT id INTO v_winning_variant_id
  FROM experiment_variants
  WHERE experiment_id = p_experiment_id
    AND id IN (
      SELECT variant_id 
      FROM experiment_assignments 
      WHERE experiment_id = p_experiment_id AND converted = true
      GROUP BY variant_id
      ORDER BY COUNT(*) DESC
      LIMIT 1
    );
  
  RETURN jsonb_build_object(
    'experiment_id', p_experiment_id,
    'variants', v_variants,
    'comparisons', v_results,
    'winning_variant_id', v_winning_variant_id,
    'total_participants', (SELECT SUM(participants) FROM experiment_variants WHERE experiment_id = p_experiment_id),
    'total_conversions', (SELECT SUM(conversions) FROM experiment_variants WHERE experiment_id = p_experiment_id)
  );
END;
$$ LANGUAGE plpgsql;

-- Helper function for statistical significance (Z-test for proportions)
CREATE OR REPLACE FUNCTION calculate_ab_significance(
  p_control_total INTEGER,
  p_control_conversions INTEGER,
  p_treatment_total INTEGER,
  p_treatment_conversions INTEGER,
  p_alpha DECIMAL(3, 2) DEFAULT 0.05
) RETURNS JSONB AS $$
DECLARE
  v_p1 DECIMAL;
  v_p2 DECIMAL;
  v_p_pooled DECIMAL;
  v_se DECIMAL;
  v_z DECIMAL;
  v_p_value DECIMAL;
  v_critical_z DECIMAL;
BEGIN
  -- Calculate conversion rates
  v_p1 := p_control_conversions::DECIMAL / NULLIF(p_control_total, 0);
  v_p2 := p_treatment_conversions::DECIMAL / NULLIF(p_treatment_total, 0);
  
  -- Pooled proportion
  v_p_pooled := (p_control_conversions + p_treatment_conversions)::DECIMAL 
    / NULLIF(p_control_total + p_treatment_total, 0);
  
  -- Standard error
  v_se := SQRT(
    v_p_pooled * (1 - v_p_pooled) * 
    (1::DECIMAL / p_control_total + 1::DECIMAL / p_treatment_total)
  );
  
  -- Z-score
  IF v_se > 0 THEN
    v_z := ABS(v_p2 - v_p1) / v_se;
  ELSE
    v_z := 0;
  END IF;
  
  -- Critical Z-value for two-tailed test
  -- For alpha = 0.05, critical Z = 1.96
  -- For alpha = 0.01, critical Z = 2.576
  IF p_alpha = 0.05 THEN
    v_critical_z := 1.96;
  ELSIF p_alpha = 0.01 THEN
    v_critical_z := 2.576;
  ELSIF p_alpha = 0.10 THEN
    v_critical_z := 1.645;
  ELSE
    v_critical_z := 1.96; -- Default to 0.05
  END IF;
  
  -- Calculate p-value approximation (simplified)
  -- Using Z-table approximation
  IF v_z >= 2.576 THEN
    v_p_value := 0.01;
  ELSIF v_z >= 1.96 THEN
    v_p_value := 0.05;
  ELSIF v_z >= 1.645 THEN
    v_p_value := 0.10;
  ELSE
    v_p_value := 0.20; -- Not significant
  END IF;
  
  RETURN jsonb_build_object(
    'is_significant', v_z >= v_critical_z,
    'z_score', ROUND(v_z, 4),
    'p_value', v_p_value,
    'critical_z', v_critical_z,
    'alpha', p_alpha,
    'control_rate', ROUND(v_p1 * 100, 2),
    'treatment_rate', ROUND(v_p2 * 100, 2),
    'lift', CASE WHEN v_p1 > 0 THEN ROUND(((v_p2 - v_p1) / v_p1) * 100, 2) ELSE 0 END
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get user's active experiments
CREATE OR REPLACE FUNCTION get_user_active_experiments(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_experiments JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'experiment_id', e.id,
      'experiment_name', e.name,
      'experiment_type', e.experiment_type,
      'variant', jsonb_build_object(
        'id', v.id,
        'name', v.name,
        'config', v.config,
        'is_control', v.is_control
      ),
      'assignment_id', a.id,
      'assigned_at', a.assigned_at,
      'converted', a.converted
    )
  ) INTO v_experiments
  FROM experiment_assignments a
  JOIN experiments e ON e.id = a.experiment_id
  JOIN experiment_variants v ON v.id = a.variant_id
  WHERE a.user_id = p_user_id
    AND e.status = 'running'
  ORDER BY a.assigned_at DESC;
  
  RETURN COALESCE(v_experiments, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE experiments IS 'Stores A/B testing experiment configurations';
COMMENT ON TABLE experiment_variants IS 'Stores variants for each experiment with traffic allocation';
COMMENT ON TABLE experiment_assignments IS 'Tracks user assignments to experiment variants';
COMMENT ON TABLE experiment_events IS 'Tracks all events related to experiments for analytics';