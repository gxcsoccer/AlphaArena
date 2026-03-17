-- OCO (One-Cancels-Other) Orders table
-- An OCO order combines a stop-loss and take-profit order as a linked pair
-- When one order triggers, the other is automatically cancelled

CREATE TABLE IF NOT EXISTS oco_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id),
  symbol VARCHAR(50) NOT NULL,
  
  -- Take Profit leg
  take_profit_trigger_price DECIMAL(20, 8) NOT NULL,
  take_profit_quantity DECIMAL(20, 8) NOT NULL,
  take_profit_order_type VARCHAR(20) NOT NULL DEFAULT 'limit' CHECK (take_profit_order_type IN ('limit', 'market')),
  take_profit_limit_price DECIMAL(20, 8),
  
  -- Stop Loss leg
  stop_loss_trigger_price DECIMAL(20, 8) NOT NULL,
  stop_loss_quantity DECIMAL(20, 8) NOT NULL,
  stop_loss_order_type VARCHAR(20) NOT NULL DEFAULT 'market' CHECK (stop_loss_order_type IN ('limit', 'market')),
  stop_loss_limit_price DECIMAL(20, 8),
  
  -- Common fields
  side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'completed', 'cancelled', 'expired')),
  
  -- Tracking
  triggered_by VARCHAR(20) CHECK (triggered_by IN ('take_profit', 'stop_loss')),
  triggered_at TIMESTAMP WITH TIME ZONE,
  triggered_order_id VARCHAR(255),
  cancelled_order_id VARCHAR(255),
  
  -- Reference to the linked conditional orders
  take_profit_conditional_order_id UUID REFERENCES conditional_orders(id),
  stop_loss_conditional_order_id UUID REFERENCES conditional_orders(id),
  
  -- Timestamps
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_oco_orders_strategy_id ON oco_orders(strategy_id);
CREATE INDEX IF NOT EXISTS idx_oco_orders_symbol ON oco_orders(symbol);
CREATE INDEX IF NOT EXISTS idx_oco_orders_status ON oco_orders(status);
CREATE INDEX IF NOT EXISTS idx_oco_orders_take_profit_conditional ON oco_orders(take_profit_conditional_order_id);
CREATE INDEX IF NOT EXISTS idx_oco_orders_stop_loss_conditional ON oco_orders(stop_loss_conditional_order_id);

-- Add comments
COMMENT ON TABLE oco_orders IS 'OCO (One-Cancels-Other) orders - pairs of stop-loss and take-profit orders where triggering one cancels the other';
COMMENT ON COLUMN oco_orders.take_profit_trigger_price IS 'Price level that triggers the take-profit order';
COMMENT ON COLUMN oco_orders.stop_loss_trigger_price IS 'Price level that triggers the stop-loss order';
COMMENT ON COLUMN oco_orders.triggered_by IS 'Which leg triggered the OCO: take_profit or stop_loss';
COMMENT ON COLUMN oco_orders.triggered_order_id IS 'ID of the market order created when the OCO was triggered';
COMMENT ON COLUMN oco_orders.cancelled_order_id IS 'ID of the cancelled order (the other leg)';