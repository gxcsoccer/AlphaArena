-- Conditional Orders table - Stop-loss and Take-profit orders
CREATE TABLE IF NOT EXISTS conditional_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id),
  symbol VARCHAR(50) NOT NULL,
  side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
  order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('stop_loss', 'take_profit')),
  trigger_price DECIMAL(20, 8) NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'triggered', 'cancelled', 'expired')),
  triggered_at TIMESTAMP WITH TIME ZONE,
  triggered_order_id VARCHAR(255),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conditional_orders_strategy_id ON conditional_orders(strategy_id);
CREATE INDEX IF NOT EXISTS idx_conditional_orders_symbol ON conditional_orders(symbol);
CREATE INDEX IF NOT EXISTS idx_conditional_orders_status ON conditional_orders(status);
CREATE INDEX IF NOT EXISTS idx_conditional_orders_order_type ON conditional_orders(order_type);

-- Add comment
COMMENT ON TABLE conditional_orders IS 'Stop-loss and take-profit conditional orders';
COMMENT ON COLUMN conditional_orders.order_type IS 'Type of conditional order: stop_loss (sell when price drops) or take_profit (sell when price rises)';
COMMENT ON COLUMN conditional_orders.trigger_price IS 'Price level that triggers the order';
COMMENT ON COLUMN conditional_orders.triggered_order_id IS 'ID of the market order created when this conditional order was triggered';
