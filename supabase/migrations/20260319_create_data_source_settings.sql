-- Data Source Settings Table Migration
-- Creates table for user-specific data source configurations

-- Data Source Settings Table
-- Stores user preferences for market data providers
CREATE TABLE IF NOT EXISTS data_source_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- Active provider selection
  active_provider VARCHAR(20) NOT NULL DEFAULT 'mock' CHECK (active_provider IN ('mock', 'alpaca', 'twelvedata')),
  
  -- Alpaca configuration
  alpaca_api_key VARCHAR(100),
  alpaca_api_secret VARCHAR(100),
  alpaca_testnet BOOLEAN NOT NULL DEFAULT true,
  
  -- Twelve Data configuration
  twelvedata_api_key VARCHAR(100),
  
  -- Mock provider settings
  mock_enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_data_source_settings_user_id ON data_source_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_data_source_settings_active_provider ON data_source_settings(active_provider);

-- Row Level Security (RLS) Policies
ALTER TABLE data_source_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own settings
CREATE POLICY "Users can view own data source settings"
  ON data_source_settings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own settings
CREATE POLICY "Users can insert own data source settings"
  ON data_source_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own settings
CREATE POLICY "Users can update own data source settings"
  ON data_source_settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own settings
CREATE POLICY "Users can delete own data source settings"
  ON data_source_settings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_data_source_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamp on row modification
DROP TRIGGER IF EXISTS trigger_update_data_source_settings_updated_at ON data_source_settings;
CREATE TRIGGER trigger_update_data_source_settings_updated_at
  BEFORE UPDATE ON data_source_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_data_source_settings_updated_at();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON data_source_settings TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Insert default settings for existing users (optional, can be done on-demand)
-- This is handled by the application layer when users first access the settings

-- Comments for documentation
COMMENT ON TABLE data_source_settings IS 'Stores user-specific data source configurations including API keys and provider preferences';
COMMENT ON COLUMN data_source_settings.active_provider IS 'Currently active data provider: mock, alpaca, or twelvedata';
COMMENT ON COLUMN data_source_settings.alpaca_api_key IS 'Alpaca Markets API key for stock market data';
COMMENT ON COLUMN data_source_settings.alpaca_api_secret IS 'Alpaca Markets API secret';
COMMENT ON COLUMN data_source_settings.alpaca_testnet IS 'Whether to use Alpaca paper trading/testnet environment';
COMMENT ON COLUMN data_source_settings.twelvedata_api_key IS 'Twelve Data API key for global market data';
COMMENT ON COLUMN data_source_settings.mock_enabled IS 'Whether mock data provider is enabled';