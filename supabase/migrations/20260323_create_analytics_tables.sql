-- Analytics Tables
-- Metric snapshots and analytics reports for Issue #524

-- Metric snapshots for storing calculated metrics over time
CREATE TABLE IF NOT EXISTS metric_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Metric identification
  metric_type TEXT NOT NULL CHECK (metric_type IN ('north_star', 'secondary')),
  metric_name TEXT NOT NULL,
  
  -- Metric values
  value DOUBLE PRECISION NOT NULL,
  previous_value DOUBLE PRECISION,
  change_percent DOUBLE PRECISION,
  
  -- Additional metadata
  metadata JSONB DEFAULT '{}',
  
  -- Period information
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_metric_snapshots_name ON metric_snapshots(metric_name);
CREATE INDEX idx_metric_snapshots_type ON metric_snapshots(metric_type);
CREATE INDEX idx_metric_snapshots_calculated ON metric_snapshots(calculated_at DESC);
CREATE INDEX idx_metric_snapshots_period ON metric_snapshots(period_start, period_end);

-- Analytics reports storage
CREATE TABLE IF NOT EXISTS analytics_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Report identification
  report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly')),
  report_date DATE NOT NULL,
  
  -- Report content (full report as JSON)
  content JSONB NOT NULL,
  
  -- Metadata
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint for one report per type per date
  UNIQUE(report_type, report_date)
);

-- Indexes for reports
CREATE INDEX idx_analytics_reports_type ON analytics_reports(report_type);
CREATE INDEX idx_analytics_reports_date ON analytics_reports(report_date DESC);
CREATE INDEX idx_analytics_reports_generated ON analytics_reports(generated_at DESC);

-- Row Level Security (RLS) policies
ALTER TABLE metric_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_reports ENABLE ROW LEVEL SECURITY;

-- Service role can access everything
CREATE POLICY "Service role full access on metric_snapshots" ON metric_snapshots
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Service role full access on analytics_reports" ON analytics_reports
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Comments for documentation
COMMENT ON TABLE metric_snapshots IS 'Stored metric calculations for trend analysis';
COMMENT ON TABLE analytics_reports IS 'Generated analytics reports (daily/weekly)';
COMMENT ON COLUMN metric_snapshots.metric_type IS 'Type of metric: north_star (primary KPI) or secondary';
COMMENT ON COLUMN metric_snapshots.metric_name IS 'Name of the metric (e.g., weekly_active_trading_users, dau)';
COMMENT ON COLUMN analytics_reports.content IS 'Full report content as JSON (matches DailyReport or WeeklyReport interface)';