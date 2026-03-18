-- Trading Scheduler Tables
-- For automated trading schedule management

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Trading Schedules Table
CREATE TABLE IF NOT EXISTS trading_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
  
  -- Basic info
  name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Scheduling
  cron_expression VARCHAR(100) NOT NULL,
  timezone VARCHAR(50) DEFAULT 'UTC',
  schedule_type VARCHAR(20) NOT NULL DEFAULT 'cron', -- 'cron', 'interval', 'condition'
  
  -- Interval-based scheduling (alternative to cron)
  interval_minutes INTEGER,
  
  -- Condition-based scheduling
  condition_type VARCHAR(50), -- 'price_above', 'price_below', 'volatility_above', etc.
  condition_params JSONB DEFAULT '{}',
  
  -- Trading parameters
  params JSONB NOT NULL DEFAULT '{}', -- strategy execution parameters
  
  -- State
  enabled BOOLEAN DEFAULT true,
  last_execution_at TIMESTAMPTZ,
  last_execution_result VARCHAR(20), -- 'success', 'failed', 'skipped'
  last_execution_message TEXT,
  next_execution_at TIMESTAMPTZ,
  
  -- Statistics
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_cron CHECK (
    schedule_type = 'interval' OR cron_expression IS NOT NULL
  ),
  CONSTRAINT valid_interval CHECK (
    schedule_type != 'interval' OR interval_minutes IS NOT NULL
  )
);

-- Schedule Executions History Table
CREATE TABLE IF NOT EXISTS schedule_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES trading_schedules(id) ON DELETE CASCADE,
  
  -- Execution timing
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'success', 'failed', 'skipped', 'cancelled'
  
  -- Trigger info
  trigger_type VARCHAR(20) NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'manual', 'condition'
  
  -- Results
  result JSONB DEFAULT '{}', -- execution result data
  error_message TEXT,
  error_stack TEXT,
  
  -- Trade info
  trades_executed INTEGER DEFAULT 0,
  total_value NUMERIC(20, 8),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Schedule Safety Config Table
CREATE TABLE IF NOT EXISTS schedule_safety_configs (
  schedule_id UUID PRIMARY KEY REFERENCES trading_schedules(id) ON DELETE CASCADE,
  
  -- Position limits
  max_position_size NUMERIC(20, 8),
  max_position_percent NUMERIC(5, 2), -- % of portfolio
  
  -- Trade limits
  max_daily_trades INTEGER DEFAULT 10,
  max_daily_value NUMERIC(20, 8),
  
  -- Risk management
  stop_loss_percent NUMERIC(5, 2),
  take_profit_percent NUMERIC(5, 2),
  
  -- Account checks
  min_balance_required NUMERIC(20, 8),
  min_margin_available NUMERIC(20, 8),
  
  -- Circuit breakers
  max_consecutive_failures INTEGER DEFAULT 3,
  cooldown_after_failure_minutes INTEGER DEFAULT 30,
  
  -- Notification settings
  notify_on_success BOOLEAN DEFAULT false,
  notify_on_failure BOOLEAN DEFAULT true,
  
  -- State
  consecutive_failures INTEGER DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  is_paused BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trading_schedules_user_id ON trading_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_schedules_strategy_id ON trading_schedules(strategy_id);
CREATE INDEX IF NOT EXISTS idx_trading_schedules_enabled ON trading_schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_trading_schedules_next_execution ON trading_schedules(next_execution_at) WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_schedule_executions_schedule_id ON schedule_executions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_executions_status ON schedule_executions(status);
CREATE INDEX IF NOT EXISTS idx_schedule_executions_scheduled_at ON schedule_executions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_schedule_executions_created_at ON schedule_executions(created_at DESC);

-- Row Level Security (RLS)
ALTER TABLE trading_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_safety_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trading_schedules
CREATE POLICY "Users can view their own schedules" ON trading_schedules
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own schedules" ON trading_schedules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own schedules" ON trading_schedules
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own schedules" ON trading_schedules
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for schedule_executions
CREATE POLICY "Users can view executions of their schedules" ON schedule_executions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trading_schedules 
      WHERE trading_schedules.id = schedule_executions.schedule_id 
      AND trading_schedules.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert executions" ON schedule_executions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update executions" ON schedule_executions
  FOR UPDATE USING (true);

-- RLS Policies for schedule_safety_configs
CREATE POLICY "Users can view safety configs of their schedules" ON schedule_safety_configs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trading_schedules 
      WHERE trading_schedules.id = schedule_safety_configs.schedule_id 
      AND trading_schedules.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create safety configs for their schedules" ON schedule_safety_configs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM trading_schedules 
      WHERE trading_schedules.id = schedule_safety_configs.schedule_id 
      AND trading_schedules.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update safety configs of their schedules" ON schedule_safety_configs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM trading_schedules 
      WHERE trading_schedules.id = schedule_safety_configs.schedule_id 
      AND trading_schedules.user_id = auth.uid()
    )
  );

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_trading_schedules_updated_at
  BEFORE UPDATE ON trading_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedule_safety_configs_updated_at
  BEFORE UPDATE ON schedule_safety_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE trading_schedules IS 'Stores automated trading schedules';
COMMENT ON TABLE schedule_executions IS 'Stores execution history for trading schedules';
COMMENT ON TABLE schedule_safety_configs IS 'Stores safety configuration for trading schedules';