-- Migration: Multi-Account Management
-- Creates tables for exchange accounts, account groups, and related data

-- Exchange Accounts Table
CREATE TABLE IF NOT EXISTS exchange_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    exchange VARCHAR(50) NOT NULL CHECK (exchange IN ('alpaca', 'binance', 'okx', 'bybit', 'mock')),
    environment VARCHAR(20) NOT NULL CHECK (environment IN ('live', 'paper', 'testnet')),
    api_key TEXT NOT NULL, -- Encrypted
    api_secret TEXT NOT NULL, -- Encrypted
    api_passphrase TEXT, -- For exchanges like OKX
    is_primary BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error', 'connecting')),
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure only one primary account per user
    CONSTRAINT unique_primary_per_user EXCLUDE (
        user_id WITH =
    ) WHERE (is_primary = TRUE),
    
    -- Ensure unique account name per user
    CONSTRAINT unique_account_name_per_user UNIQUE (user_id, name)
);

-- Index for fast user lookup
CREATE INDEX idx_exchange_accounts_user_id ON exchange_accounts(user_id);
CREATE INDEX idx_exchange_accounts_primary ON exchange_accounts(user_id) WHERE is_primary = TRUE;

-- Account Balances Table
CREATE TABLE IF NOT EXISTS account_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES exchange_accounts(id) ON DELETE CASCADE,
    currency VARCHAR(20) NOT NULL,
    total_balance DECIMAL(20, 8) NOT NULL DEFAULT 0,
    available_balance DECIMAL(20, 8) NOT NULL DEFAULT 0,
    frozen_balance DECIMAL(20, 8) NOT NULL DEFAULT 0,
    usd_value DECIMAL(20, 8) NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique currency per account
    CONSTRAINT unique_currency_per_account UNIQUE (account_id, currency)
);

-- Index for account balances lookup
CREATE INDEX idx_account_balances_account_id ON account_balances(account_id);

-- Account Positions Table
CREATE TABLE IF NOT EXISTS account_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES exchange_accounts(id) ON DELETE CASCADE,
    symbol VARCHAR(50) NOT NULL,
    quantity DECIMAL(20, 8) NOT NULL DEFAULT 0,
    available_quantity DECIMAL(20, 8) NOT NULL DEFAULT 0,
    average_cost DECIMAL(20, 8) NOT NULL DEFAULT 0,
    current_price DECIMAL(20, 8),
    market_value DECIMAL(20, 8),
    unrealized_pnl DECIMAL(20, 8),
    unrealized_pnl_pct DECIMAL(10, 4),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique symbol per account
    CONSTRAINT unique_symbol_per_account UNIQUE (account_id, symbol)
);

-- Index for account positions lookup
CREATE INDEX idx_account_positions_account_id ON account_positions(account_id);
CREATE INDEX idx_account_positions_symbol ON account_positions(symbol);

-- Account Groups Table
CREATE TABLE IF NOT EXISTS account_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    account_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
    strategy_allocation JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique group name per user
    CONSTRAINT unique_group_name_per_user UNIQUE (user_id, name)
);

-- Index for account groups lookup
CREATE INDEX idx_account_groups_user_id ON account_groups(user_id);
CREATE INDEX idx_account_groups_active ON account_groups(user_id) WHERE is_active = TRUE;

-- Account Group Executions Table (for tracking strategy executions across accounts)
CREATE TABLE IF NOT EXISTS account_group_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES account_groups(id) ON DELETE CASCADE,
    strategy_id UUID,
    execution_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    total_accounts INTEGER DEFAULT 0,
    successful_accounts INTEGER DEFAULT 0,
    failed_accounts INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    CONSTRAINT valid_accounts CHECK (
        successful_accounts + failed_accounts <= total_accounts
    )
);

-- Index for group executions lookup
CREATE INDEX idx_account_group_executions_group_id ON account_group_executions(group_id);
CREATE INDEX idx_account_group_executions_status ON account_group_executions(status);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_exchange_accounts_updated_at
    BEFORE UPDATE ON exchange_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_groups_updated_at
    BEFORE UPDATE ON account_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE exchange_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_group_executions ENABLE ROW LEVEL SECURITY;

-- Policies for exchange_accounts
CREATE POLICY "Users can view their own exchange accounts"
    ON exchange_accounts FOR SELECT
    USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own exchange accounts"
    ON exchange_accounts FOR INSERT
    WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own exchange accounts"
    ON exchange_accounts FOR UPDATE
    USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own exchange accounts"
    ON exchange_accounts FOR DELETE
    USING (auth.uid()::text = user_id::text);

-- Policies for account_balances
CREATE POLICY "Users can view their own account balances"
    ON account_balances FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM exchange_accounts
            WHERE exchange_accounts.id = account_balances.account_id
            AND exchange_accounts.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Users can insert their own account balances"
    ON account_balances FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM exchange_accounts
            WHERE exchange_accounts.id = account_balances.account_id
            AND exchange_accounts.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Users can update their own account balances"
    ON account_balances FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM exchange_accounts
            WHERE exchange_accounts.id = account_balances.account_id
            AND exchange_accounts.user_id::text = auth.uid()::text
        )
    );

-- Policies for account_positions
CREATE POLICY "Users can view their own account positions"
    ON account_positions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM exchange_accounts
            WHERE exchange_accounts.id = account_positions.account_id
            AND exchange_accounts.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Users can insert their own account positions"
    ON account_positions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM exchange_accounts
            WHERE exchange_accounts.id = account_positions.account_id
            AND exchange_accounts.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Users can update their own account positions"
    ON account_positions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM exchange_accounts
            WHERE exchange_accounts.id = account_positions.account_id
            AND exchange_accounts.user_id::text = auth.uid()::text
        )
    );

-- Policies for account_groups
CREATE POLICY "Users can view their own account groups"
    ON account_groups FOR SELECT
    USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own account groups"
    ON account_groups FOR INSERT
    WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own account groups"
    ON account_groups FOR UPDATE
    USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own account groups"
    ON account_groups FOR DELETE
    USING (auth.uid()::text = user_id::text);

-- Policies for account_group_executions
CREATE POLICY "Users can view their own group executions"
    ON account_group_executions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM account_groups
            WHERE account_groups.id = account_group_executions.group_id
            AND account_groups.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Users can insert their own group executions"
    ON account_group_executions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM account_groups
            WHERE account_groups.id = account_group_executions.group_id
            AND account_groups.user_id::text = auth.uid()::text
        )
    );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON exchange_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON account_balances TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON account_positions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON account_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON account_group_executions TO authenticated;

-- Comments for documentation
COMMENT ON TABLE exchange_accounts IS 'Stores user exchange account credentials (encrypted)';
COMMENT ON TABLE account_balances IS 'Real-time balance snapshots for each exchange account';
COMMENT ON TABLE account_positions IS 'Current positions for each exchange account';
COMMENT ON TABLE account_groups IS 'Groups of accounts for executing strategies across multiple accounts';
COMMENT ON TABLE account_group_executions IS 'Execution history for account group strategies';