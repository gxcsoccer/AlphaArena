-- Backtest-Live Integration Tables
-- This migration creates the tables needed for backtest-to-live trading integration

-- Integrated Strategies Table
CREATE TABLE IF NOT EXISTS integrated_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strategy JSONB NOT NULL,
    backtest_config JSONB NOT NULL,
    environment VARCHAR(20) NOT NULL DEFAULT 'backtest' CHECK (environment IN ('backtest', 'paper', 'live')),
    paper_config JSONB,
    live_config JSONB,
    backtest_result_id UUID REFERENCES backtest_results(id) ON DELETE SET NULL,
    monitoring JSONB NOT NULL DEFAULT '{
        "enableComparison": true,
        "deviationThreshold": 10,
        "comparisonInterval": 60000,
        "enableOptimization": true,
        "notificationChannels": []
    }'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'backtesting', 'paper_trading', 'live', 'paused', 'stopped', 'error')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backtest Results Table
CREATE TABLE IF NOT EXISTS backtest_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID REFERENCES integrated_strategies(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    config JSONB NOT NULL,
    stats JSONB NOT NULL,
    trade_summary JSONB,
    performance_metrics JSONB,
    tags TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Comparisons Table
CREATE TABLE IF NOT EXISTS performance_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES integrated_strategies(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    comparison JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optimization Suggestions Table
CREATE TABLE IF NOT EXISTS optimization_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES integrated_strategies(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('parameter_adjustment', 'risk_management', 'strategy_change', 'timing_adjustment')),
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    current_value JSONB,
    suggested_value JSONB,
    expected_improvement TEXT,
    confidence DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    supporting_data JSONB,
    applied BOOLEAN NOT NULL DEFAULT FALSE,
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_integrated_strategies_user_id ON integrated_strategies(user_id);
CREATE INDEX IF NOT EXISTS idx_integrated_strategies_environment ON integrated_strategies(environment);
CREATE INDEX IF NOT EXISTS idx_integrated_strategies_status ON integrated_strategies(status);
CREATE INDEX IF NOT EXISTS idx_backtest_results_user_id ON backtest_results(user_id);
CREATE INDEX IF NOT EXISTS idx_backtest_results_integration_id ON backtest_results(integration_id);
CREATE INDEX IF NOT EXISTS idx_performance_comparisons_integration_id ON performance_comparisons(integration_id);
CREATE INDEX IF NOT EXISTS idx_performance_comparisons_timestamp ON performance_comparisons(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_optimization_suggestions_integration_id ON optimization_suggestions(integration_id);
CREATE INDEX IF NOT EXISTS idx_optimization_suggestions_applied ON optimization_suggestions(applied);

-- Row Level Security (RLS)
ALTER TABLE integrated_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE backtest_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for integrated_strategies
CREATE POLICY "Users can view their own integrated strategies" ON integrated_strategies
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own integrated strategies" ON integrated_strategies
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own integrated strategies" ON integrated_strategies
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own integrated strategies" ON integrated_strategies
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for backtest_results
CREATE POLICY "Users can view their own backtest results" ON backtest_results
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own backtest results" ON backtest_results
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own backtest results" ON backtest_results
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for performance_comparisons
CREATE POLICY "Users can view comparisons for their strategies" ON performance_comparisons
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM integrated_strategies
            WHERE integrated_strategies.id = performance_comparisons.integration_id
            AND integrated_strategies.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can insert comparisons" ON performance_comparisons
    FOR INSERT WITH CHECK (true);

-- RLS Policies for optimization_suggestions
CREATE POLICY "Users can view suggestions for their strategies" ON optimization_suggestions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM integrated_strategies
            WHERE integrated_strategies.id = optimization_suggestions.integration_id
            AND integrated_strategies.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage suggestions" ON optimization_suggestions
    FOR ALL USING (true);

-- Updated at trigger for integrated_strategies
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_integrated_strategies_updated_at
    BEFORE UPDATE ON integrated_strategies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE integrated_strategies IS 'Integrated strategy configurations linking backtest and live trading';
COMMENT ON TABLE backtest_results IS 'Stored backtest results for reference and comparison';
COMMENT ON TABLE performance_comparisons IS 'Historical performance comparisons between backtest and live trading';
COMMENT ON TABLE optimization_suggestions IS 'AI-generated optimization suggestions for strategies';