-- Paper Trades Table Migration
-- Creates table for individual trade executions

-- Paper Trades table - Individual trade executions
CREATE TABLE IF NOT EXISTS paper_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES virtual_orders(id) ON DELETE SET NULL,
  account_id UUID NOT NULL REFERENCES virtual_accounts(id) ON DELETE CASCADE,
  
  -- Trade details
  symbol VARCHAR(50) NOT NULL,
  side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
  quantity DECIMAL(20, 8) NOT NULL,
  price DECIMAL(20, 8) NOT NULL,
  
  -- Financial details
  gross_amount DECIMAL(20, 8) NOT NULL,    -- quantity * price
  fees DECIMAL(20, 8) NOT NULL DEFAULT 0,
  net_amount DECIMAL(20, 8) NOT NULL,       -- gross_amount +/- fees
  
  -- Fee breakdown
  commission DECIMAL(20, 8) DEFAULT 0,
  stamp_duty DECIMAL(20, 8) DEFAULT 0,
  transfer_fee DECIMAL(20, 8) DEFAULT 0,
  
  -- P&L (for sell trades)
  cost_basis DECIMAL(20, 8),                -- Original cost of sold shares
  realized_pnl DECIMAL(20, 8),              -- Profit/loss on this trade
  
  -- Execution info
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_paper_trades_order ON paper_trades(order_id);
CREATE INDEX IF NOT EXISTS idx_paper_trades_account ON paper_trades(account_id);
CREATE INDEX IF NOT EXISTS idx_paper_trades_symbol ON paper_trades(symbol);
CREATE INDEX IF NOT EXISTS idx_paper_trades_side ON paper_trades(side);
CREATE INDEX IF NOT EXISTS idx_paper_trades_executed ON paper_trades(executed_at DESC);

-- RLS Policies
ALTER TABLE paper_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trades" ON paper_trades
  FOR SELECT USING (
    account_id IN (SELECT id FROM virtual_accounts WHERE user_id = auth.uid()::text)
  );

CREATE POLICY "System can insert trades" ON paper_trades
  FOR INSERT WITH CHECK (true);

-- Function to get trade history with P&L summary
CREATE OR REPLACE FUNCTION get_trade_history(
  p_account_id UUID,
  p_symbol VARCHAR(50) DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  symbol VARCHAR(50),
  side VARCHAR(10),
  quantity DECIMAL(20, 8),
  price DECIMAL(20, 8),
  gross_amount DECIMAL(20, 8),
  fees DECIMAL(20, 8),
  net_amount DECIMAL(20, 8),
  realized_pnl DECIMAL(20, 8),
  executed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.symbol,
    t.side,
    t.quantity,
    t.price,
    t.gross_amount,
    t.fees,
    t.net_amount,
    t.realized_pnl,
    t.executed_at
  FROM paper_trades t
  WHERE t.account_id = p_account_id
    AND (p_symbol IS NULL OR t.symbol = p_symbol)
  ORDER BY t.executed_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get trade statistics
CREATE OR REPLACE FUNCTION get_trade_stats(
  p_account_id UUID
)
RETURNS TABLE (
  total_trades BIGINT,
  buy_trades BIGINT,
  sell_trades BIGINT,
  total_buy_volume DECIMAL(20, 8),
  total_sell_volume DECIMAL(20, 8),
  total_realized_pnl DECIMAL(20, 8),
  total_fees DECIMAL(20, 8),
  winning_trades BIGINT,
  losing_trades BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_trades,
    COUNT(*) FILTER (WHERE side = 'buy')::BIGINT as buy_trades,
    COUNT(*) FILTER (WHERE side = 'sell')::BIGINT as sell_trades,
    COALESCE(SUM(gross_amount) FILTER (WHERE side = 'buy'), 0) as total_buy_volume,
    COALESCE(SUM(gross_amount) FILTER (WHERE side = 'sell'), 0) as total_sell_volume,
    COALESCE(SUM(realized_pnl), 0) as total_realized_pnl,
    COALESCE(SUM(fees), 0) as total_fees,
    COUNT(*) FILTER (WHERE realized_pnl > 0)::BIGINT as winning_trades,
    COUNT(*) FILTER (WHERE realized_pnl < 0)::BIGINT as losing_trades
  FROM paper_trades
  WHERE account_id = p_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;