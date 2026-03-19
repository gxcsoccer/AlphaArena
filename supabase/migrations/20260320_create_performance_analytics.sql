-- Strategy Performance Analytics Tables
-- Migration: 20260320_create_performance_analytics.sql
-- Description: Creates tables for storing strategy performance snapshots and daily account values

-- Strategy Performance Snapshots Table
-- Stores calculated performance metrics for strategies at specific time periods
CREATE TABLE IF NOT EXISTS strategy_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    -- Core Return Metrics
    total_return DECIMAL(15, 6) NOT NULL DEFAULT 0,
    annualized_return DECIMAL(15, 6) NOT NULL DEFAULT 0,
    
    -- Risk-Adjusted Metrics
    sharpe_ratio DECIMAL(10, 6) NOT NULL DEFAULT 0,
    
    -- Risk Metrics
    max_drawdown DECIMAL(10, 6) NOT NULL DEFAULT 0,
    
    -- Trading Metrics
    win_rate DECIMAL(10, 6) NOT NULL DEFAULT 0,
    profit_factor DECIMAL(15, 6) NOT NULL DEFAULT 0,
    total_trades INTEGER NOT NULL DEFAULT 0,
    
    -- Additional Metrics (JSON)
    additional_metrics JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_period CHECK (period_end > period_start),
    CONSTRAINT valid_total_return CHECK (total_return >= -100),
    CONSTRAINT valid_sharpe CHECK (sharpe_ratio >= -10 AND sharpe_ratio <= 10),
    CONSTRAINT valid_max_drawdown CHECK (max_drawdown >= 0 AND max_drawdown <= 100),
    CONSTRAINT valid_win_rate CHECK (win_rate >= 0 AND win_rate <= 100)
);

-- Indexes for strategy_performance
CREATE INDEX IF NOT EXISTS idx_strategy_performance_strategy_id ON strategy_performance(strategy_id);
CREATE INDEX IF NOT EXISTS idx_strategy_performance_user_id ON strategy_performance(user_id);
CREATE INDEX IF NOT EXISTS idx_strategy_performance_period_end ON strategy_performance(period_end DESC);
CREATE INDEX IF NOT EXISTS idx_strategy_performance_created_at ON strategy_performance(created_at DESC);

-- Daily Account Values Table
-- Stores daily snapshots of account values for performance tracking
CREATE TABLE IF NOT EXISTS daily_account_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    
    -- Account Values
    cash DECIMAL(20, 8) NOT NULL DEFAULT 0,
    positions_value DECIMAL(20, 8) NOT NULL DEFAULT 0,
    total_value DECIMAL(20, 8) NOT NULL DEFAULT 0,
    
    -- Returns
    daily_return DECIMAL(10, 6) NOT NULL DEFAULT 0,
    cumulative_return DECIMAL(10, 6) NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one record per account per day
    CONSTRAINT unique_account_date UNIQUE (account_id, date),
    
    -- Constraints
    CONSTRAINT valid_total_value CHECK (total_value >= 0),
    CONSTRAINT valid_daily_return CHECK (daily_return >= -100 AND daily_return <= 10000)
);

-- Indexes for daily_account_values
CREATE INDEX IF NOT EXISTS idx_daily_account_values_account_id ON daily_account_values(account_id);
CREATE INDEX IF NOT EXISTS idx_daily_account_values_date ON daily_account_values(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_account_values_total_value ON daily_account_values(total_value);

-- Row Level Security (RLS) Policies
ALTER TABLE strategy_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_account_values ENABLE ROW LEVEL SECURITY;

-- RLS Policies for strategy_performance
CREATE POLICY "Users can view their own strategy performance" ON strategy_performance
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own strategy performance" ON strategy_performance
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own strategy performance" ON strategy_performance
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own strategy performance" ON strategy_performance
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for daily_account_values (account-based, not user-based)
-- Note: For real implementation, you may need to join with a virtual_accounts table
-- to check if the user owns the account
CREATE POLICY "Service role can manage daily account values" ON daily_account_values
    FOR ALL USING (auth.role() = 'service_role');

-- Functions and Triggers

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_strategy_performance_updated_at ON strategy_performance;
CREATE TRIGGER update_strategy_performance_updated_at
    BEFORE UPDATE ON strategy_performance
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate and store performance metrics for a strategy
CREATE OR REPLACE FUNCTION calculate_strategy_performance(
    p_strategy_id VARCHAR(255),
    p_user_id UUID DEFAULT NULL,
    p_period_start TIMESTAMPTZ,
    p_period_end TIMESTAMPTZ,
    p_total_return DECIMAL(15, 6),
    p_annualized_return DECIMAL(15, 6),
    p_sharpe_ratio DECIMAL(10, 6),
    p_max_drawdown DECIMAL(10, 6),
    p_win_rate DECIMAL(10, 6),
    p_profit_factor DECIMAL(15, 6),
    p_total_trades INTEGER,
    p_additional_metrics JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_snapshot_id UUID;
BEGIN
    INSERT INTO strategy_performance (
        strategy_id,
        user_id,
        period_start,
        period_end,
        total_return,
        annualized_return,
        sharpe_ratio,
        max_drawdown,
        win_rate,
        profit_factor,
        total_trades,
        additional_metrics
    ) VALUES (
        p_strategy_id,
        p_user_id,
        p_period_start,
        p_period_end,
        p_total_return,
        p_annualized_return,
        p_sharpe_ratio,
        p_max_drawdown,
        p_win_rate,
        p_profit_factor,
        p_total_trades,
        p_additional_metrics
    ) RETURNING id INTO v_snapshot_id;
    
    RETURN v_snapshot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get performance summary for multiple strategies
CREATE OR REPLACE FUNCTION get_strategy_performance_summary(
    p_strategy_ids VARCHAR(255)[]
) RETURNS TABLE (
    strategy_id VARCHAR(255),
    latest_total_return DECIMAL(15, 6),
    latest_sharpe_ratio DECIMAL(10, 6),
    latest_max_drawdown DECIMAL(10, 6),
    latest_win_rate DECIMAL(10, 6),
    snapshot_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sp.strategy_id,
        sp.total_return AS latest_total_return,
        sp.sharpe_ratio AS latest_sharpe_ratio,
        sp.max_drawdown AS latest_max_drawdown,
        sp.win_rate AS latest_win_rate,
        COUNT(*) OVER (PARTITION BY sp.strategy_id) AS snapshot_count
    FROM strategy_performance sp
    WHERE sp.strategy_id = ANY(p_strategy_ids)
    AND sp.period_end = (
        SELECT MAX(sp2.period_end)
        FROM strategy_performance sp2
        WHERE sp2.strategy_id = sp.strategy_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE strategy_performance IS 'Stores calculated performance metrics for trading strategies at specific time periods';
COMMENT ON TABLE daily_account_values IS 'Stores daily snapshots of account values for performance tracking and analysis';

COMMENT ON COLUMN strategy_performance.total_return IS 'Total return percentage for the period';
COMMENT ON COLUMN strategy_performance.annualized_return IS 'Annualized return percentage';
COMMENT ON COLUMN strategy_performance.sharpe_ratio IS 'Risk-adjusted return (Sharpe ratio)';
COMMENT ON COLUMN strategy_performance.max_drawdown IS 'Maximum drawdown percentage from peak';
COMMENT ON COLUMN strategy_performance.win_rate IS 'Percentage of winning trades';
COMMENT ON COLUMN strategy_performance.profit_factor IS 'Gross profit / gross loss ratio';
COMMENT ON COLUMN strategy_performance.additional_metrics IS 'Additional metrics stored as JSON (sortino, calmar, volatility, etc.)';

COMMENT ON COLUMN daily_account_values.cash IS 'Cash balance in the account';
COMMENT ON COLUMN daily_account_values.positions_value IS 'Total value of open positions';
COMMENT ON COLUMN daily_account_values.total_value IS 'Total account value (cash + positions)';
COMMENT ON COLUMN daily_account_values.daily_return IS 'Return percentage for the day';
COMMENT ON COLUMN daily_account_values.cumulative_return IS 'Cumulative return from start';