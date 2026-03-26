-- Auto Execution Configuration Tables
-- VIP-exclusive automated strategy execution feature

-- ============================================
-- Auto Execution Configurations
-- ============================================
CREATE TABLE IF NOT EXISTS auto_execution_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'disabled' CHECK (status IN ('enabled', 'disabled', 'paused', 'error')),
    
    -- Signal source configuration
    signal_source TEXT NOT NULL CHECK (signal_source IN ('strategy', 'signal_subscription', 'copy_trading')),
    strategy_id UUID,
    signal_subscription_id UUID,
    copy_trading_id UUID,
    
    -- Execution settings
    execution_mode TEXT NOT NULL DEFAULT 'immediate' CHECK (execution_mode IN ('immediate', 'batch', 'threshold')),
    default_order_type TEXT NOT NULL DEFAULT 'market' CHECK (default_order_type IN ('market', 'limit', 'smart')),
    batch_interval_minutes INTEGER DEFAULT 5,
    signal_threshold DECIMAL(3,2) DEFAULT 0.70,
    
    -- Trading configuration
    trading_pairs JSONB DEFAULT '[]'::jsonb,
    execution_windows JSONB DEFAULT '[]'::jsonb,
    
    -- Risk controls
    risk_controls JSONB DEFAULT '{
        "max_position_size": 1000,
        "max_position_percent": 5,
        "max_total_exposure": 50,
        "stop_loss_percent": 5,
        "take_profit_percent": 10,
        "max_daily_trades": 20,
        "max_daily_volume": 10000,
        "max_hourly_trades": 5,
        "min_trade_interval": 60,
        "loss_cooldown_minutes": 30,
        "max_drawdown_percent": 10,
        "circuit_breaker_enabled": true,
        "circuit_breaker_threshold": 3
    }'::jsonb,
    
    -- Notification settings
    notify_on_execution BOOLEAN DEFAULT true,
    notify_on_error BOOLEAN DEFAULT true,
    notify_on_risk_event BOOLEAN DEFAULT true,
    
    -- Statistics
    total_executions INTEGER DEFAULT 0,
    successful_executions INTEGER DEFAULT 0,
    failed_executions INTEGER DEFAULT 0,
    total_volume DECIMAL(18,2) DEFAULT 0,
    total_pnl DECIMAL(18,2) DEFAULT 0,
    
    -- Timestamps
    last_execution_at TIMESTAMPTZ,
    last_error_at TIMESTAMPTZ,
    last_error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_signal_source CHECK (
        (signal_source = 'strategy' AND strategy_id IS NOT NULL) OR
        (signal_source = 'signal_subscription' AND signal_subscription_id IS NOT NULL) OR
        (signal_source = 'copy_trading' AND copy_trading_id IS NOT NULL)
    )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_auto_execution_configs_user_id ON auto_execution_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_execution_configs_status ON auto_execution_configs(status);
CREATE INDEX IF NOT EXISTS idx_auto_execution_configs_strategy_id ON auto_execution_configs(strategy_id);

-- ============================================
-- Auto Execution Logs
-- ============================================
CREATE TABLE IF NOT EXISTS auto_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES auto_execution_configs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Signal details
    signal_id TEXT NOT NULL,
    signal_source TEXT NOT NULL,
    signal_side TEXT NOT NULL CHECK (signal_side IN ('buy', 'sell')),
    signal_price DECIMAL(18,8) NOT NULL,
    signal_quantity DECIMAL(18,8) NOT NULL,
    signal_confidence DECIMAL(3,2) NOT NULL,
    signal_timestamp TIMESTAMPTZ NOT NULL,
    
    -- Execution details
    execution_status TEXT NOT NULL DEFAULT 'pending' CHECK (execution_status IN ('pending', 'executing', 'filled', 'failed', 'skipped', 'rejected')),
    order_type TEXT CHECK (order_type IN ('market', 'limit', 'smart')),
    executed_price DECIMAL(18,8),
    executed_quantity DECIMAL(18,8),
    order_id TEXT,
    trade_id TEXT,
    
    -- Risk check results
    risk_check_passed BOOLEAN DEFAULT false,
    risk_check_reasons TEXT[] DEFAULT '{}',
    
    -- Execution timing
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    executed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    execution_duration_ms INTEGER,
    
    -- Fees and costs
    fee_amount DECIMAL(18,8),
    fee_currency TEXT,
    
    -- PnL
    pnl DECIMAL(18,2),
    pnl_percent DECIMAL(8,4),
    
    -- Error information
    error_message TEXT,
    error_code TEXT,
    
    -- Audit trail
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_auto_execution_logs_config_id ON auto_execution_logs(config_id);
CREATE INDEX IF NOT EXISTS idx_auto_execution_logs_user_id ON auto_execution_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_execution_logs_status ON auto_execution_logs(execution_status);
CREATE INDEX IF NOT EXISTS idx_auto_execution_logs_created_at ON auto_execution_logs(created_at);

-- ============================================
-- Daily Statistics Table
-- ============================================
CREATE TABLE IF NOT EXISTS auto_execution_daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES auto_execution_configs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    total_signals INTEGER DEFAULT 0,
    executed_signals INTEGER DEFAULT 0,
    skipped_signals INTEGER DEFAULT 0,
    failed_signals INTEGER DEFAULT 0,
    total_volume DECIMAL(18,2) DEFAULT 0,
    total_fees DECIMAL(18,2) DEFAULT 0,
    realized_pnl DECIMAL(18,2) DEFAULT 0,
    trades_count INTEGER DEFAULT 0,
    win_rate DECIMAL(5,2) DEFAULT 0,
    avg_execution_time INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(config_id, date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_auto_execution_daily_stats_config_id ON auto_execution_daily_stats(config_id);
CREATE INDEX IF NOT EXISTS idx_auto_execution_daily_stats_date ON auto_execution_daily_stats(date);

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE auto_execution_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_execution_daily_stats ENABLE ROW LEVEL SECURITY;

-- Policies for auto_execution_configs
CREATE POLICY "Users can view their own auto execution configs"
    ON auto_execution_configs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own auto execution configs"
    ON auto_execution_configs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own auto execution configs"
    ON auto_execution_configs FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own auto execution configs"
    ON auto_execution_configs FOR DELETE
    USING (auth.uid() = user_id);

-- Policies for auto_execution_logs
CREATE POLICY "Users can view their own auto execution logs"
    ON auto_execution_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service can insert auto execution logs"
    ON auto_execution_logs FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service can update auto execution logs"
    ON auto_execution_logs FOR UPDATE
    USING (true);

-- Policies for auto_execution_daily_stats
CREATE POLICY "Users can view their own daily stats"
    ON auto_execution_daily_stats FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service can manage daily stats"
    ON auto_execution_daily_stats FOR ALL
    USING (true);

-- ============================================
-- Feature Permission for Auto Execution
-- ============================================
INSERT INTO feature_permissions (feature_key, required_plan, description, category, is_active)
VALUES (
    'auto_execution',
    'pro',
    'Automated strategy signal execution with risk controls',
    'trading',
    true
) ON CONFLICT (feature_key) DO UPDATE SET
    required_plan = 'pro',
    description = 'Automated strategy signal execution with risk controls',
    category = 'trading',
    is_active = true;

-- ============================================
-- Trigger to update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_auto_execution_configs_updated_at
    BEFORE UPDATE ON auto_execution_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auto_execution_daily_stats_updated_at
    BEFORE UPDATE ON auto_execution_daily_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();