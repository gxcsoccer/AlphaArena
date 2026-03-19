-- Virtual Account System Migration
-- Creates tables for virtual trading accounts, positions, and transactions

-- Virtual Accounts table - Main account for each user
CREATE TABLE IF NOT EXISTS virtual_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL UNIQUE,
  
  -- Account balances
  balance DECIMAL(20, 8) NOT NULL DEFAULT 0,
  initial_capital DECIMAL(20, 8) NOT NULL DEFAULT 100000,
  frozen_balance DECIMAL(20, 8) NOT NULL DEFAULT 0,
  
  -- Account stats
  total_realized_pnl DECIMAL(20, 8) NOT NULL DEFAULT 0,
  total_trades INTEGER NOT NULL DEFAULT 0,
  winning_trades INTEGER NOT NULL DEFAULT 0,
  losing_trades INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  account_currency VARCHAR(10) DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Virtual Positions table - Holdings for each account
CREATE TABLE IF NOT EXISTS virtual_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES virtual_accounts(id) ON DELETE CASCADE,
  
  -- Position details
  symbol VARCHAR(50) NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL DEFAULT 0,
  available_quantity DECIMAL(20, 8) NOT NULL DEFAULT 0,
  frozen_quantity DECIMAL(20, 8) NOT NULL DEFAULT 0,
  
  -- Cost basis
  average_cost DECIMAL(20, 8) NOT NULL DEFAULT 0,
  total_cost DECIMAL(20, 8) NOT NULL DEFAULT 0,
  
  -- Current market data (updated periodically)
  current_price DECIMAL(20, 8),
  market_value DECIMAL(20, 8),
  unrealized_pnl DECIMAL(20, 8),
  unrealized_pnl_pct DECIMAL(10, 4),
  
  -- Risk metrics
  max_quantity DECIMAL(20, 8),  -- Maximum position size
  stop_loss_price DECIMAL(20, 8),
  take_profit_price DECIMAL(20, 8),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_price_update TIMESTAMPTZ,
  
  CONSTRAINT unique_account_symbol UNIQUE (account_id, symbol),
  CONSTRAINT positive_quantity CHECK (quantity >= 0),
  CONSTRAINT positive_available CHECK (available_quantity >= 0),
  CONSTRAINT positive_frozen CHECK (frozen_quantity >= 0)
);

-- Account Transactions table - History of all account changes
CREATE TABLE IF NOT EXISTS account_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES virtual_accounts(id) ON DELETE CASCADE,
  
  -- Transaction details
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'deposit',       -- Initial capital or manual deposit
    'withdraw',      -- Manual withdrawal
    'buy',           -- Buy order execution
    'sell',          -- Sell order execution
    'dividend',      -- Dividend payment
    'fee',           -- Trading fees
    'adjustment',    -- Manual adjustment
    'reset',         -- Account reset
    'frozen',        -- Funds frozen for pending order
    'unfrozen',      -- Funds unfrozen (order cancelled)
    'transfer_in',   -- Transfer from another account
    'transfer_out'   -- Transfer to another account
  )),
  
  -- Amount details
  amount DECIMAL(20, 8) NOT NULL,
  balance_after DECIMAL(20, 8) NOT NULL,
  
  -- Related entity
  reference_type VARCHAR(50),  -- 'order', 'trade', 'position', 'manual'
  reference_id UUID,
  
  -- Symbol (for trades)
  symbol VARCHAR(50),
  quantity DECIMAL(20, 8),
  price DECIMAL(20, 8),
  
  -- Additional info
  description TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pending Orders table - Orders waiting to be executed
CREATE TABLE IF NOT EXISTS virtual_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES virtual_accounts(id) ON DELETE CASCADE,
  
  -- Order details
  symbol VARCHAR(50) NOT NULL,
  side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
  order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('market', 'limit', 'stop_market', 'stop_limit')),
  
  -- Quantities
  quantity DECIMAL(20, 8) NOT NULL,
  filled_quantity DECIMAL(20, 8) NOT NULL DEFAULT 0,
  remaining_quantity DECIMAL(20, 8) NOT NULL,
  
  -- Prices
  price DECIMAL(20, 8),          -- Limit price
  stop_price DECIMAL(20, 8),     -- Stop price for stop orders
  average_fill_price DECIMAL(20, 8),
  
  -- Order state
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Waiting to be processed
    'open',         -- Active on the market
    'partial',      -- Partially filled
    'filled',       -- Fully filled
    'cancelled',    -- Cancelled by user
    'rejected',     -- Rejected by system
    'expired'       -- Expired (time-based)
  )),
  
  -- Frozen funds/positions
  frozen_amount DECIMAL(20, 8),  -- Cash frozen for buy orders
  frozen_quantity DECIMAL(20, 8), -- Shares frozen for sell orders
  
  -- Validity
  time_in_force VARCHAR(10) DEFAULT 'GTC' CHECK (time_in_force IN ('GTC', 'IOC', 'FOK', 'GTD')),
  expires_at TIMESTAMPTZ,
  
  -- Execution info
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Error info
  error_message TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- Account History Snapshots - Periodic snapshots for charting
CREATE TABLE IF NOT EXISTS account_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES virtual_accounts(id) ON DELETE CASCADE,
  
  -- Snapshot time
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot_type VARCHAR(20) NOT NULL DEFAULT 'hourly' CHECK (snapshot_type IN ('minute', 'hourly', 'daily', 'weekly')),
  
  -- Account state
  balance DECIMAL(20, 8) NOT NULL,
  positions_value DECIMAL(20, 8) NOT NULL DEFAULT 0,
  total_value DECIMAL(20, 8) NOT NULL,
  unrealized_pnl DECIMAL(20, 8) NOT NULL DEFAULT 0,
  realized_pnl DECIMAL(20, 8) NOT NULL DEFAULT 0,
  
  -- Daily change
  day_pnl DECIMAL(20, 8),
  day_pnl_pct DECIMAL(10, 4),
  
  -- Position count
  position_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_account_snapshot_time UNIQUE (account_id, snapshot_at, snapshot_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_virtual_accounts_user ON virtual_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_virtual_accounts_active ON virtual_accounts(is_active);

CREATE INDEX IF NOT EXISTS idx_virtual_positions_account ON virtual_positions(account_id);
CREATE INDEX IF NOT EXISTS idx_virtual_positions_symbol ON virtual_positions(symbol);
CREATE INDEX IF NOT EXISTS idx_virtual_positions_account_symbol ON virtual_positions(account_id, symbol);

CREATE INDEX IF NOT EXISTS idx_account_transactions_account ON account_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_account_transactions_type ON account_transactions(type);
CREATE INDEX IF NOT EXISTS idx_account_transactions_created ON account_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_transactions_symbol ON account_transactions(symbol);
CREATE INDEX IF NOT EXISTS idx_account_transactions_reference ON account_transactions(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_virtual_orders_account ON virtual_orders(account_id);
CREATE INDEX IF NOT EXISTS idx_virtual_orders_status ON virtual_orders(status);
CREATE INDEX IF NOT EXISTS idx_virtual_orders_symbol ON virtual_orders(symbol);
CREATE INDEX IF NOT EXISTS idx_virtual_orders_created ON virtual_orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_snapshots_account ON account_snapshots(account_id);
CREATE INDEX IF NOT EXISTS idx_account_snapshots_time ON account_snapshots(snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_snapshots_account_time ON account_snapshots(account_id, snapshot_at DESC);

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_virtual_accounts_updated_at
    BEFORE UPDATE ON virtual_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_virtual_positions_updated_at
    BEFORE UPDATE ON virtual_positions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_virtual_orders_updated_at
    BEFORE UPDATE ON virtual_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE virtual_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE virtual_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE virtual_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_snapshots ENABLE ROW LEVEL SECURITY;

-- Policies for virtual_accounts
CREATE POLICY "Users can view own account" ON virtual_accounts
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own account" ON virtual_accounts
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own account" ON virtual_accounts
  FOR UPDATE USING (user_id = auth.uid()::text);

-- Policies for virtual_positions
CREATE POLICY "Users can view own positions" ON virtual_positions
  FOR SELECT USING (
    account_id IN (SELECT id FROM virtual_accounts WHERE user_id = auth.uid()::text)
  );

CREATE POLICY "Users can insert own positions" ON virtual_positions
  FOR INSERT WITH CHECK (
    account_id IN (SELECT id FROM virtual_accounts WHERE user_id = auth.uid()::text)
  );

CREATE POLICY "Users can update own positions" ON virtual_positions
  FOR UPDATE USING (
    account_id IN (SELECT id FROM virtual_accounts WHERE user_id = auth.uid()::text)
  );

CREATE POLICY "Users can delete own positions" ON virtual_positions
  FOR DELETE USING (
    account_id IN (SELECT id FROM virtual_accounts WHERE user_id = auth.uid()::text)
  );

-- Policies for account_transactions
CREATE POLICY "Users can view own transactions" ON account_transactions
  FOR SELECT USING (
    account_id IN (SELECT id FROM virtual_accounts WHERE user_id = auth.uid()::text)
  );

CREATE POLICY "Users can insert own transactions" ON account_transactions
  FOR INSERT WITH CHECK (
    account_id IN (SELECT id FROM virtual_accounts WHERE user_id = auth.uid()::text)
  );

-- Policies for virtual_orders
CREATE POLICY "Users can view own orders" ON virtual_orders
  FOR SELECT USING (
    account_id IN (SELECT id FROM virtual_accounts WHERE user_id = auth.uid()::text)
  );

CREATE POLICY "Users can insert own orders" ON virtual_orders
  FOR INSERT WITH CHECK (
    account_id IN (SELECT id FROM virtual_accounts WHERE user_id = auth.uid()::text)
  );

CREATE POLICY "Users can update own orders" ON virtual_orders
  FOR UPDATE USING (
    account_id IN (SELECT id FROM virtual_accounts WHERE user_id = auth.uid()::text)
  );

CREATE POLICY "Users can delete own orders" ON virtual_orders
  FOR DELETE USING (
    account_id IN (SELECT id FROM virtual_accounts WHERE user_id = auth.uid()::text)
  );

-- Policies for account_snapshots
CREATE POLICY "Users can view own snapshots" ON account_snapshots
  FOR SELECT USING (
    account_id IN (SELECT id FROM virtual_accounts WHERE user_id = auth.uid()::text)
  );

CREATE POLICY "System can insert snapshots" ON account_snapshots
  FOR INSERT WITH CHECK (true);

-- Function to create a new account for a user
CREATE OR REPLACE FUNCTION create_virtual_account(
  p_user_id VARCHAR(255),
  p_initial_capital DECIMAL(20, 8) DEFAULT 100000
)
RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
BEGIN
  INSERT INTO virtual_accounts (user_id, balance, initial_capital)
  VALUES (p_user_id, p_initial_capital, p_initial_capital)
  RETURNING id INTO v_account_id;
  
  -- Create initial transaction
  INSERT INTO account_transactions (account_id, type, amount, balance_after, description)
  VALUES (v_account_id, 'deposit', p_initial_capital, p_initial_capital, 'Initial capital');
  
  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset an account
CREATE OR REPLACE FUNCTION reset_virtual_account(
  p_account_id UUID,
  p_new_capital DECIMAL(20, 8) DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_account virtual_accounts%ROWTYPE;
  v_new_capital DECIMAL(20, 8);
BEGIN
  -- Get current account
  SELECT * INTO v_account FROM virtual_accounts WHERE id = p_account_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found';
  END IF;
  
  -- Use provided capital or reset to original
  v_new_capital := COALESCE(p_new_capital, v_account.initial_capital);
  
  -- Delete all positions
  DELETE FROM virtual_positions WHERE account_id = p_account_id;
  
  -- Delete all pending orders
  DELETE FROM virtual_orders WHERE account_id = p_account_id;
  
  -- Update account
  UPDATE virtual_accounts
  SET 
    balance = v_new_capital,
    frozen_balance = 0,
    total_realized_pnl = 0,
    total_trades = 0,
    winning_trades = 0,
    losing_trades = 0,
    updated_at = NOW()
  WHERE id = p_account_id;
  
  -- Record reset transaction
  INSERT INTO account_transactions (account_id, type, amount, balance_after, description)
  VALUES (p_account_id, 'reset', v_new_capital, v_new_capital, 'Account reset');
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;