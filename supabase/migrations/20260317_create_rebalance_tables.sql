-- Rebalance Target Allocations table
CREATE TABLE IF NOT EXISTS rebalance_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  allocations JSONB NOT NULL, -- Array of { symbol, targetWeight, tolerance }
  total_weight DECIMAL(5, 2) DEFAULT 100.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rebalance Plans table
CREATE TABLE IF NOT EXISTS rebalance_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  target_allocation_id UUID REFERENCES rebalance_allocations(id) ON DELETE CASCADE,
  trigger VARCHAR(20) NOT NULL CHECK (trigger IN ('scheduled', 'threshold', 'manual')),
  threshold DECIMAL(5, 2), -- Deviation threshold percentage
  schedule JSONB, -- { frequency, time, dayOfWeek, dayOfMonth }
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rebalance Executions table
CREATE TABLE IF NOT EXISTS rebalance_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES rebalance_plans(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'previewing', 'executing', 'completed', 'partially_completed', 'failed', 'cancelled')),
  trigger VARCHAR(20) NOT NULL,
  preview JSONB, -- Full preview object
  orders JSONB DEFAULT '[]', -- Array of orders
  total_estimated_cost DECIMAL(20, 8),
  total_actual_cost DECIMAL(20, 8) DEFAULT 0,
  total_fees DECIMAL(20, 8) DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  metrics JSONB, -- Execution metrics
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rebalance Orders table (for tracking individual orders)
CREATE TABLE IF NOT EXISTS rebalance_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES rebalance_executions(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES rebalance_plans(id) ON DELETE CASCADE,
  symbol VARCHAR(50) NOT NULL,
  side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
  order_type VARCHAR(10) NOT NULL CHECK (order_type IN ('market', 'limit')),
  quantity DECIMAL(20, 8) NOT NULL,
  limit_price DECIMAL(20, 8),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'partially_filled', 'filled', 'cancelled', 'failed')),
  filled_quantity DECIMAL(20, 8) DEFAULT 0,
  filled_price DECIMAL(20, 8) DEFAULT 0,
  fee DECIMAL(20, 8) DEFAULT 0,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  executed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rebalance_allocations_created ON rebalance_allocations(created_at);
CREATE INDEX IF NOT EXISTS idx_rebalance_plans_active ON rebalance_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_rebalance_plans_trigger ON rebalance_plans(trigger);
CREATE INDEX IF NOT EXISTS idx_rebalance_executions_plan ON rebalance_executions(plan_id);
CREATE INDEX IF NOT EXISTS idx_rebalance_executions_status ON rebalance_executions(status);
CREATE INDEX IF NOT EXISTS idx_rebalance_executions_started ON rebalance_executions(started_at);
CREATE INDEX IF NOT EXISTS idx_rebalance_orders_execution ON rebalance_orders(execution_id);
CREATE INDEX IF NOT EXISTS idx_rebalance_orders_status ON rebalance_orders(status);

-- Comments
COMMENT ON TABLE rebalance_allocations IS 'Target allocation configurations for portfolio rebalancing';
COMMENT ON TABLE rebalance_plans IS 'Rebalancing plan configurations with trigger settings';
COMMENT ON TABLE rebalance_executions IS 'Records of rebalancing execution attempts';
COMMENT ON TABLE rebalance_orders IS 'Individual orders generated during rebalancing';

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_rebalance_allocations_updated_at
    BEFORE UPDATE ON rebalance_allocations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rebalance_plans_updated_at
    BEFORE UPDATE ON rebalance_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
