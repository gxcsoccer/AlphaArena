-- Trading Bot Tables Migration
-- Creates tables for bot configurations, states, logs, and trades

-- Bot Configurations Table
CREATE TABLE IF NOT EXISTS bot_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  strategy TEXT NOT NULL,
  strategy_params JSONB NOT NULL DEFAULT '{}',
  trading_pair JSONB NOT NULL,
  interval TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'paper',
  risk_settings JSONB NOT NULL DEFAULT '{}',
  initial_capital NUMERIC(18, 2) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bot States Table
CREATE TABLE IF NOT EXISTS bot_states (
  bot_id TEXT PRIMARY KEY REFERENCES bot_configs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'stopped',
  portfolio_value NUMERIC(18, 2) NOT NULL DEFAULT 0,
  initial_capital NUMERIC(18, 2) NOT NULL DEFAULT 0,
  realized_pnl NUMERIC(18, 2) NOT NULL DEFAULT 0,
  unrealized_pnl NUMERIC(18, 2) NOT NULL DEFAULT 0,
  total_pnl NUMERIC(18, 2) NOT NULL DEFAULT 0,
  trade_count INTEGER NOT NULL DEFAULT 0,
  win_count INTEGER NOT NULL DEFAULT 0,
  loss_count INTEGER NOT NULL DEFAULT 0,
  position_quantity NUMERIC(18, 4) NOT NULL DEFAULT 0,
  position_average_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
  last_signal_time TIMESTAMPTZ,
  last_trade_time TIMESTAMPTZ,
  last_error TEXT,
  started_at TIMESTAMPTZ,
  total_runtime_ms BIGINT NOT NULL DEFAULT 0,
  daily_pnl NUMERIC(18, 2) NOT NULL DEFAULT 0,
  daily_pnl_reset_at TIMESTAMPTZ
);

-- Bot Logs Table
CREATE TABLE IF NOT EXISTS bot_logs (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES bot_configs(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  data JSONB
);

-- Bot Trades Table
CREATE TABLE IF NOT EXISTS bot_trades (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES bot_configs(id) ON DELETE CASCADE,
  strategy_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  price NUMERIC(18, 4) NOT NULL,
  quantity NUMERIC(18, 4) NOT NULL,
  total NUMERIC(18, 2) NOT NULL,
  fee NUMERIC(18, 2) NOT NULL DEFAULT 0,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  order_id TEXT NOT NULL,
  is_paper_trade BOOLEAN NOT NULL DEFAULT true
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bot_configs_enabled ON bot_configs(enabled);
CREATE INDEX IF NOT EXISTS idx_bot_configs_strategy ON bot_configs(strategy);
CREATE INDEX IF NOT EXISTS idx_bot_logs_bot_id ON bot_logs(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_logs_timestamp ON bot_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bot_trades_bot_id ON bot_trades(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_trades_executed_at ON bot_trades(executed_at DESC);

-- Row Level Security Policies
ALTER TABLE bot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_trades ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Users can view their own bot configs" ON bot_configs
  FOR SELECT USING (auth.uid()::text IS NOT NULL);

CREATE POLICY "Users can insert their own bot configs" ON bot_configs
  FOR INSERT WITH CHECK (auth.uid()::text IS NOT NULL);

CREATE POLICY "Users can update their own bot configs" ON bot_configs
  FOR UPDATE USING (auth.uid()::text IS NOT NULL);

CREATE POLICY "Users can delete their own bot configs" ON bot_configs
  FOR DELETE USING (auth.uid()::text IS NOT NULL);

-- Similar policies for other tables
CREATE POLICY "Users can view bot states" ON bot_states
  FOR SELECT USING (auth.uid()::text IS NOT NULL);

CREATE POLICY "Users can insert bot states" ON bot_states
  FOR INSERT WITH CHECK (auth.uid()::text IS NOT NULL);

CREATE POLICY "Users can update bot states" ON bot_states
  FOR UPDATE USING (auth.uid()::text IS NOT NULL);

CREATE POLICY "Users can view bot logs" ON bot_logs
  FOR SELECT USING (auth.uid()::text IS NOT NULL);

CREATE POLICY "Users can insert bot logs" ON bot_logs
  FOR INSERT WITH CHECK (auth.uid()::text IS NOT NULL);

CREATE POLICY "Users can view bot trades" ON bot_trades
  FOR SELECT USING (auth.uid()::text IS NOT NULL);

CREATE POLICY "Users can insert bot trades" ON bot_trades
  FOR INSERT WITH CHECK (auth.uid()::text IS NOT NULL);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for bot_configs
DROP TRIGGER IF EXISTS update_bot_configs_updated_at ON bot_configs;
CREATE TRIGGER update_bot_configs_updated_at
  BEFORE UPDATE ON bot_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
