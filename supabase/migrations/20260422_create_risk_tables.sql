-- Risk Monitor Tables
-- Tables for risk alerts, risk history, and position risk tracking

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Risk Alerts Table
-- Stores user-configured risk alert rules
CREATE TABLE IF NOT EXISTS risk_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  
  -- Alert configuration
  metric VARCHAR(50) NOT NULL, -- var95, var99, maxDrawdown, sharpeRatio, volatility, beta, concentrationRisk, liquidityRisk
  threshold DECIMAL(20, 8) NOT NULL,
  operator VARCHAR(10) NOT NULL CHECK (operator IN ('gt', 'lt', 'gte', 'lte')),
  channels JSONB NOT NULL DEFAULT '["ui"]'::jsonb, -- ['ui', 'email', 'webhook']
  
  -- Status
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_metric CHECK (metric IN (
    'var95', 'var99', 'maxDrawdown', 'sharpeRatio', 
    'volatility', 'beta', 'concentrationRisk', 'liquidityRisk'
  ))
);

-- Risk Alert History Table
-- Records each time an alert is triggered
CREATE TABLE IF NOT EXISTS risk_alert_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id UUID NOT NULL REFERENCES risk_alerts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  
  -- Trigger details
  metric VARCHAR(50) NOT NULL,
  threshold DECIMAL(20, 8) NOT NULL,
  actual_value DECIMAL(20, 8) NOT NULL,
  operator VARCHAR(10) NOT NULL,
  
  -- Notification status
  channels JSONB NOT NULL DEFAULT '["ui"]'::jsonb,
  notification_sent BOOLEAN NOT NULL DEFAULT false,
  notification_error TEXT,
  
  -- Timestamp
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Index for quick lookups
  INDEX idx_alert_history_user_time (user_id, triggered_at DESC)
);

-- Risk History Table
-- Stores historical risk metrics for trend analysis
CREATE TABLE IF NOT EXISTS risk_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  
  -- Time period
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_type VARCHAR(20) NOT NULL DEFAULT 'snapshot', -- snapshot, daily, weekly
  
  -- Core risk metrics
  var95 DECIMAL(20, 8),
  var99 DECIMAL(20, 8),
  max_drawdown DECIMAL(20, 8),
  current_drawdown DECIMAL(20, 8),
  sharpe_ratio DECIMAL(20, 8),
  volatility DECIMAL(20, 8),
  beta DECIMAL(20, 8),
  concentration_risk DECIMAL(20, 8),
  liquidity_risk DECIMAL(20, 8),
  
  -- Extended metrics
  sortino_ratio DECIMAL(20, 8),
  expected_shortfall_95 DECIMAL(20, 8),
  expected_shortfall_99 DECIMAL(20, 8),
  calmar_ratio DECIMAL(20, 8),
  treynor_ratio DECIMAL(20, 8),
  information_ratio DECIMAL(20, 8),
  tracking_error DECIMAL(20, 8),
  
  -- Portfolio context
  portfolio_value DECIMAL(20, 8),
  position_count INTEGER,
  
  -- Index for quick lookups
  INDEX idx_risk_history_user_time (user_id, recorded_at DESC)
);

-- Position Risk Table
-- Stores per-position risk contribution
CREATE TABLE IF NOT EXISTS position_risks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  risk_history_id UUID REFERENCES risk_history(id) ON DELETE CASCADE,
  
  -- Position info
  symbol VARCHAR(50) NOT NULL,
  
  -- Risk metrics
  weight DECIMAL(20, 8) NOT NULL,
  contribution_to_risk DECIMAL(20, 8) NOT NULL,
  var_contribution DECIMAL(20, 8) NOT NULL,
  beta_to_portfolio DECIMAL(20, 8),
  liquidity_score DECIMAL(20, 8),
  concentration_risk DECIMAL(20, 8),
  
  -- Timestamp
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Index for quick lookups
  INDEX idx_position_risks_user_symbol (user_id, symbol)
);

-- Correlation Matrix Table
-- Stores asset correlation data
CREATE TABLE IF NOT EXISTS correlation_matrix (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  
  -- Asset pair
  symbol1 VARCHAR(50) NOT NULL,
  symbol2 VARCHAR(50) NOT NULL,
  
  -- Correlation value (-1 to 1)
  correlation DECIMAL(20, 8) NOT NULL,
  
  -- Time period for calculation
  period_days INTEGER NOT NULL DEFAULT 30,
  
  -- Timestamp
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint for asset pair per user
  CONSTRAINT unique_correlation_pair UNIQUE (user_id, symbol1, symbol2, period_days),
  
  -- Index
  INDEX idx_correlation_matrix_user (user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_risk_alerts_user ON risk_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_enabled ON risk_alerts(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_risk_alert_history_alert ON risk_alert_history(alert_id);
CREATE INDEX IF NOT EXISTS idx_position_risks_history ON position_risks(risk_history_id);

-- Row Level Security (RLS)
ALTER TABLE risk_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE correlation_matrix ENABLE ROW LEVEL SECURITY;

-- RLS Policies for risk_alerts
CREATE POLICY "Users can view their own risk alerts"
  ON risk_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own risk alerts"
  ON risk_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own risk alerts"
  ON risk_alerts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own risk alerts"
  ON risk_alerts FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for risk_alert_history
CREATE POLICY "Users can view their own alert history"
  ON risk_alert_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert alert history"
  ON risk_alert_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for risk_history
CREATE POLICY "Users can view their own risk history"
  ON risk_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own risk history"
  ON risk_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own risk history"
  ON risk_history FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for position_risks
CREATE POLICY "Users can view their own position risks"
  ON position_risks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own position risks"
  ON position_risks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for correlation_matrix
CREATE POLICY "Users can view their own correlations"
  ON correlation_matrix FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own correlations"
  ON correlation_matrix FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own correlations"
  ON correlation_matrix FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for risk_alerts
CREATE TRIGGER update_risk_alerts_updated_at
  BEFORE UPDATE ON risk_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE risk_alerts IS 'User-configured risk alert rules';
COMMENT ON TABLE risk_alert_history IS 'History of triggered risk alerts';
COMMENT ON TABLE risk_history IS 'Historical risk metrics for trend analysis';
COMMENT ON TABLE position_risks IS 'Per-position risk contribution data';
COMMENT ON TABLE correlation_matrix IS 'Asset correlation data for portfolio analysis';