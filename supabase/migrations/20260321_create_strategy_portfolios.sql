-- Strategy Portfolio Management Migration
-- Creates tables for managing multiple strategies as a combined portfolio

-- Strategy Portfolios table - Main portfolio for combining multiple strategies
CREATE TABLE IF NOT EXISTS strategy_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  
  -- Portfolio info
  name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Capital allocation
  total_capital DECIMAL(20, 8) NOT NULL,
  allocation_method VARCHAR(20) NOT NULL DEFAULT 'equal' CHECK (allocation_method IN ('equal', 'custom', 'risk_parity')),
  
  -- Rebalance configuration
  rebalance_config JSONB DEFAULT '{}',
  -- { enabled: boolean, frequency: 'daily'|'weekly'|'monthly'|'threshold', threshold: number, lastRebalanced: timestamp }
  
  -- Portfolio status
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'stopped')),
  
  -- Performance metrics (cached)
  total_value DECIMAL(20, 8),
  total_return DECIMAL(10, 4),
  total_return_pct DECIMAL(10, 4),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Portfolio Strategies table - Links strategies to portfolios with weights
CREATE TABLE IF NOT EXISTS portfolio_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES strategy_portfolios(id) ON DELETE CASCADE,
  strategy_id UUID NOT NULL,  -- References strategies table
  
  -- Allocation config
  weight DECIMAL(5, 4) NOT NULL CHECK (weight >= 0 AND weight <= 1),
  allocation DECIMAL(20, 8) NOT NULL,  -- Initial allocated amount
  current_allocation DECIMAL(20, 8),   -- Current actual allocation
  
  -- Strategy status within portfolio
  status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'paused', 'stopped')),
  enabled BOOLEAN DEFAULT true,
  
  -- Performance tracking
  current_value DECIMAL(20, 8),
  return_amount DECIMAL(20, 8),
  return_pct DECIMAL(10, 4),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_portfolio_strategy UNIQUE (portfolio_id, strategy_id),
  CONSTRAINT weight_sum_check CHECK (weight >= 0)
);

-- Portfolio Rebalances table - History of rebalancing operations
CREATE TABLE IF NOT EXISTS portfolio_rebalances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES strategy_portfolios(id) ON DELETE CASCADE,
  
  -- Rebalance trigger
  reason VARCHAR(50) NOT NULL CHECK (reason IN ('threshold', 'scheduled', 'manual', 'strategy_change')),
  
  -- State snapshots
  allocations_before JSONB NOT NULL,  -- Array of { strategyId, weight, allocation }
  allocations_after JSONB NOT NULL,
  
  -- Trade details
  trades JSONB DEFAULT '[]',  -- Array of trades executed
  
  -- Execution info
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executing', 'completed', 'failed', 'cancelled')),
  error_message TEXT,
  
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Portfolio Performance Snapshots table - Periodic performance tracking
CREATE TABLE IF NOT EXISTS portfolio_performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES strategy_portfolios(id) ON DELETE CASCADE,
  
  -- Snapshot time
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot_type VARCHAR(20) NOT NULL DEFAULT 'hourly' CHECK (snapshot_type IN ('minute', 'hourly', 'daily', 'weekly')),
  
  -- Portfolio state
  total_value DECIMAL(20, 8) NOT NULL,
  total_return DECIMAL(10, 4) NOT NULL DEFAULT 0,
  total_return_pct DECIMAL(10, 4) NOT NULL DEFAULT 0,
  
  -- Individual strategy performance
  strategy_performances JSONB NOT NULL DEFAULT '[]',
  -- Array of { strategyId, name, allocation, currentValue, return, returnPct, contribution }
  
  -- Risk metrics
  diversification_ratio DECIMAL(10, 4),  -- How well diversified
  max_drawdown DECIMAL(10, 4),
  sharpe_ratio DECIMAL(10, 4),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_portfolio_snapshot_time UNIQUE (portfolio_id, snapshot_at, snapshot_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_strategy_portfolios_user ON strategy_portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_strategy_portfolios_status ON strategy_portfolios(status);
CREATE INDEX IF NOT EXISTS idx_strategy_portfolios_created ON strategy_portfolios(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_strategies_portfolio ON portfolio_strategies(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_strategies_strategy ON portfolio_strategies(strategy_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_strategies_status ON portfolio_strategies(status);

CREATE INDEX IF NOT EXISTS idx_portfolio_rebalances_portfolio ON portfolio_rebalances(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_rebalances_status ON portfolio_rebalances(status);
CREATE INDEX IF NOT EXISTS idx_portfolio_rebalances_executed ON portfolio_rebalances(executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_performance_portfolio ON portfolio_performance_snapshots(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_performance_time ON portfolio_performance_snapshots(snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_performance_portfolio_time ON portfolio_performance_snapshots(portfolio_id, snapshot_at DESC);

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_strategy_portfolios_updated_at
    BEFORE UPDATE ON strategy_portfolios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portfolio_strategies_updated_at
    BEFORE UPDATE ON portfolio_strategies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE strategy_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_rebalances ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_performance_snapshots ENABLE ROW LEVEL SECURITY;

-- Policies for strategy_portfolios
CREATE POLICY "Users can view own portfolios" ON strategy_portfolios
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own portfolios" ON strategy_portfolios
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own portfolios" ON strategy_portfolios
  FOR UPDATE USING (user_id = auth.uid()::text);

CREATE POLICY "Users can delete own portfolios" ON strategy_portfolios
  FOR DELETE USING (user_id = auth.uid()::text);

-- Policies for portfolio_strategies
CREATE POLICY "Users can view own portfolio strategies" ON portfolio_strategies
  FOR SELECT USING (
    portfolio_id IN (SELECT id FROM strategy_portfolios WHERE user_id = auth.uid()::text)
  );

CREATE POLICY "Users can insert own portfolio strategies" ON portfolio_strategies
  FOR INSERT WITH CHECK (
    portfolio_id IN (SELECT id FROM strategy_portfolios WHERE user_id = auth.uid()::text)
  );

CREATE POLICY "Users can update own portfolio strategies" ON portfolio_strategies
  FOR UPDATE USING (
    portfolio_id IN (SELECT id FROM strategy_portfolios WHERE user_id = auth.uid()::text)
  );

CREATE POLICY "Users can delete own portfolio strategies" ON portfolio_strategies
  FOR DELETE USING (
    portfolio_id IN (SELECT id FROM strategy_portfolios WHERE user_id = auth.uid()::text)
  );

-- Policies for portfolio_rebalances
CREATE POLICY "Users can view own portfolio rebalances" ON portfolio_rebalances
  FOR SELECT USING (
    portfolio_id IN (SELECT id FROM strategy_portfolios WHERE user_id = auth.uid()::text)
  );

CREATE POLICY "System can insert portfolio rebalances" ON portfolio_rebalances
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update portfolio rebalances" ON portfolio_rebalances
  FOR UPDATE USING (true);

-- Policies for portfolio_performance_snapshots
CREATE POLICY "Users can view own portfolio snapshots" ON portfolio_performance_snapshots
  FOR SELECT USING (
    portfolio_id IN (SELECT id FROM strategy_portfolios WHERE user_id = auth.uid()::text)
  );

CREATE POLICY "System can insert portfolio snapshots" ON portfolio_performance_snapshots
  FOR INSERT WITH CHECK (true);

-- Function to normalize weights in a portfolio
CREATE OR REPLACE FUNCTION normalize_portfolio_weights(p_portfolio_id UUID)
RETURNS void AS $$
DECLARE
  v_total_weight DECIMAL(10, 4);
BEGIN
  -- Calculate total weight
  SELECT COALESCE(SUM(weight), 0) INTO v_total_weight
  FROM portfolio_strategies
  WHERE portfolio_id = p_portfolio_id AND enabled = true;
  
  -- Normalize if total > 0
  IF v_total_weight > 0 THEN
    UPDATE portfolio_strategies
    SET weight = weight / v_total_weight
    WHERE portfolio_id = p_portfolio_id AND enabled = true;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate portfolio performance
CREATE OR REPLACE FUNCTION calculate_portfolio_performance(p_portfolio_id UUID)
RETURNS TABLE (
  total_value DECIMAL(20, 8),
  total_return DECIMAL(10, 4),
  total_return_pct DECIMAL(10, 4)
) AS $$
DECLARE
  v_total_capital DECIMAL(20, 8);
  v_total_value DECIMAL(20, 8);
BEGIN
  -- Get total capital
  SELECT total_capital INTO v_total_capital
  FROM strategy_portfolios WHERE id = p_portfolio_id;
  
  -- Calculate total current value
  SELECT COALESCE(SUM(current_value), 0) INTO v_total_value
  FROM portfolio_strategies WHERE portfolio_id = p_portfolio_id;
  
  -- Return metrics
  RETURN QUERY SELECT
    v_total_value,
    v_total_value - v_total_capital,
    CASE WHEN v_total_capital > 0 THEN ((v_total_value - v_total_capital) / v_total_capital) * 100 ELSE 0 END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE strategy_portfolios IS 'Strategy portfolios combining multiple trading strategies with capital allocation';
COMMENT ON TABLE portfolio_strategies IS 'Links strategies to portfolios with allocation weights';
COMMENT ON TABLE portfolio_rebalances IS 'History of portfolio rebalancing operations';
COMMENT ON TABLE portfolio_performance_snapshots IS 'Periodic snapshots of portfolio performance metrics';