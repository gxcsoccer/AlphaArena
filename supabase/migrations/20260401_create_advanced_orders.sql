-- Iceberg Orders table
-- An iceberg order is a large order split into smaller visible and hidden portions
-- Only the visible portion is shown in the order book, hiding the true size

CREATE TABLE IF NOT EXISTS iceberg_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id),
  symbol VARCHAR(50) NOT NULL,
  side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
  price DECIMAL(20, 8) NOT NULL,
  
  -- Quantities
  total_quantity DECIMAL(20, 8) NOT NULL,
  display_quantity DECIMAL(20, 8) NOT NULL,
  hidden_quantity DECIMAL(20, 8) NOT NULL,
  filled_quantity DECIMAL(20, 8) NOT NULL DEFAULT 0,
  
  -- Randomization to disguise iceberg pattern
  variance DECIMAL(5, 2) CHECK (variance >= 0 AND variance <= 100),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'partially_filled', 'filled', 'cancelled', 'expired')),
  
  -- Tracking
  slices_created INTEGER DEFAULT 0,
  slices_filled INTEGER DEFAULT 0,
  
  -- Timestamps
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for iceberg_orders
CREATE INDEX IF NOT EXISTS idx_iceberg_orders_strategy_id ON iceberg_orders(strategy_id);
CREATE INDEX IF NOT EXISTS idx_iceberg_orders_symbol ON iceberg_orders(symbol);
CREATE INDEX IF NOT EXISTS idx_iceberg_orders_status ON iceberg_orders(status);
CREATE INDEX IF NOT EXISTS idx_iceberg_orders_side ON iceberg_orders(side);
CREATE INDEX IF NOT EXISTS idx_iceberg_orders_created_at ON iceberg_orders(created_at DESC);

-- Comments for iceberg_orders
COMMENT ON TABLE iceberg_orders IS 'Iceberg orders - large orders split into visible and hidden portions to minimize market impact';
COMMENT ON COLUMN iceberg_orders.display_quantity IS 'The quantity visible in the order book';
COMMENT ON COLUMN iceberg_orders.hidden_quantity IS 'The hidden quantity not shown in the order book';
COMMENT ON COLUMN iceberg_orders.variance IS 'Percentage variance (+/-) to randomize display quantity and disguise iceberg pattern';
COMMENT ON COLUMN iceberg_orders.slices_created IS 'Number of order slices created';
COMMENT ON COLUMN iceberg_orders.slices_filled IS 'Number of order slices filled';

-- TWAP Orders table
-- TWAP (Time-Weighted Average Price) orders execute over a specified time period
-- to achieve an average price close to the time-weighted average market price

CREATE TABLE IF NOT EXISTS twap_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id),
  symbol VARCHAR(50) NOT NULL,
  side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
  
  -- Order details
  total_quantity DECIMAL(20, 8) NOT NULL,
  filled_quantity DECIMAL(20, 8) NOT NULL DEFAULT 0,
  remaining_quantity DECIMAL(20, 8) NOT NULL,
  
  -- Time parameters
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  interval_seconds INTEGER NOT NULL,
  
  -- Slicing
  total_slices INTEGER NOT NULL,
  slice_quantity DECIMAL(20, 8) NOT NULL,
  
  -- Execution tracking
  slices_created INTEGER DEFAULT 0,
  slices_filled INTEGER DEFAULT 0,
  average_fill_price DECIMAL(20, 8),
  total_filled_value DECIMAL(30, 8) DEFAULT 0,
  
  -- Price limits
  price_limit DECIMAL(20, 8),
  price_limit_type VARCHAR(20) CHECK (price_limit_type IN ('max', 'min', 'none')),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'completed', 'cancelled', 'expired')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_slice_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for twap_orders
CREATE INDEX IF NOT EXISTS idx_twap_orders_strategy_id ON twap_orders(strategy_id);
CREATE INDEX IF NOT EXISTS idx_twap_orders_symbol ON twap_orders(symbol);
CREATE INDEX IF NOT EXISTS idx_twap_orders_status ON twap_orders(status);
CREATE INDEX IF NOT EXISTS idx_twap_orders_side ON twap_orders(side);
CREATE INDEX IF NOT EXISTS idx_twap_orders_time_range ON twap_orders(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_twap_orders_created_at ON twap_orders(created_at DESC);

-- TWAP Order Slices table
-- Tracks individual slices of a TWAP order

CREATE TABLE IF NOT EXISTS twap_order_slices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twap_order_id UUID NOT NULL REFERENCES twap_orders(id) ON DELETE CASCADE,
  
  -- Slice details
  slice_number INTEGER NOT NULL,
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  price DECIMAL(20, 8),
  
  -- Execution
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'filled', 'cancelled', 'failed')),
  filled_quantity DECIMAL(20, 8) DEFAULT 0,
  fill_price DECIMAL(20, 8),
  filled_value DECIMAL(30, 8) DEFAULT 0,
  
  -- Order reference (links to actual order in matching engine)
  order_id VARCHAR(255),
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  executed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for twap_order_slices
CREATE INDEX IF NOT EXISTS idx_twap_order_slices_twap_order_id ON twap_order_slices(twap_order_id);
CREATE INDEX IF NOT EXISTS idx_twap_order_slices_status ON twap_order_slices(status);
CREATE INDEX IF NOT EXISTS idx_twap_order_slices_scheduled_time ON twap_order_slices(scheduled_time);

-- Comments for twap_orders
COMMENT ON TABLE twap_orders IS 'TWAP (Time-Weighted Average Price) orders - execute over time to achieve average price';
COMMENT ON COLUMN twap_orders.interval_seconds IS 'Time interval between slices in seconds';
COMMENT ON COLUMN twap_orders.total_slices IS 'Total number of slices the order is divided into';
COMMENT ON COLUMN twap_orders.slice_quantity IS 'Quantity per slice';
COMMENT ON COLUMN twap_orders.price_limit IS 'Optional price limit to prevent unfavorable fills';
COMMENT ON COLUMN twap_orders.price_limit_type IS 'Type of price limit: max (for buy), min (for sell), none';

-- Comments for twap_order_slices
COMMENT ON TABLE twap_order_slices IS 'Individual slices of a TWAP order executed over time';
COMMENT ON COLUMN twap_order_slices.slice_number IS 'Sequence number of this slice (1, 2, 3...)';
COMMENT ON COLUMN twap_order_slices.scheduled_time IS 'When this slice was scheduled to execute';
COMMENT ON COLUMN twap_order_slices.order_id IS 'Reference to the actual order in the matching engine';

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
CREATE TRIGGER update_iceberg_orders_updated_at
  BEFORE UPDATE ON iceberg_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_twap_orders_updated_at
  BEFORE UPDATE ON twap_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_twap_order_slices_updated_at
  BEFORE UPDATE ON twap_order_slices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();