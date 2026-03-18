-- Payment History and Stripe Customers Tables
-- Supports Stripe payment integration

-- Stripe Customers Table
-- Associates users with Stripe customer IDs
CREATE TABLE IF NOT EXISTS stripe_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  stripe_customer_id VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255),
  name VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payment History Table
-- Records all payment transactions
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  stripe_customer_id VARCHAR(100),
  stripe_subscription_id VARCHAR(100),
  stripe_invoice_id VARCHAR(100),
  stripe_payment_intent_id VARCHAR(100),
  
  -- Payment details
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'CNY',
  status VARCHAR(20) NOT NULL, -- 'succeeded', 'failed', 'pending', 'refunded'
  
  -- Plan info
  plan_id VARCHAR(20),
  billing_period VARCHAR(20), -- 'monthly', 'yearly'
  
  -- Metadata
  description TEXT,
  invoice_url VARCHAR(500),
  receipt_url VARCHAR(500),
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_stripe_customers_user_id ON stripe_customers(user_id);
CREATE INDEX idx_stripe_customers_stripe_customer_id ON stripe_customers(stripe_customer_id);
CREATE INDEX idx_payment_history_user_id ON payment_history(user_id);
CREATE INDEX idx_payment_history_stripe_customer_id ON payment_history(stripe_customer_id);
CREATE INDEX idx_payment_history_stripe_subscription_id ON payment_history(stripe_subscription_id);
CREATE INDEX idx_payment_history_status ON payment_history(status);
CREATE INDEX idx_payment_history_created_at ON payment_history(created_at DESC);

-- Row Level Security
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- Policies for stripe_customers
CREATE POLICY "Users can view own stripe customer"
  ON stripe_customers FOR SELECT
  USING (auth.uid()::text = user_id::text OR auth.uid() = user_id);

CREATE POLICY "Service role can manage stripe customers"
  ON stripe_customers FOR ALL
  USING (auth.role() = 'service_role');

-- Policies for payment_history
CREATE POLICY "Users can view own payment history"
  ON payment_history FOR SELECT
  USING (auth.uid()::text = user_id::text OR auth.uid() = user_id);

CREATE POLICY "Service role can manage payment history"
  ON payment_history FOR ALL
  USING (auth.role() = 'service_role');

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_stripe_customers_updated_at ON stripe_customers;
CREATE TRIGGER update_stripe_customers_updated_at
  BEFORE UPDATE ON stripe_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_history_updated_at ON payment_history;
CREATE TRIGGER update_payment_history_updated_at
  BEFORE UPDATE ON payment_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to get or create stripe customer
CREATE OR REPLACE FUNCTION get_or_create_stripe_customer(
  p_user_id UUID,
  p_stripe_customer_id VARCHAR(100),
  p_email VARCHAR(255) DEFAULT NULL,
  p_name VARCHAR(255) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Try to get existing
  SELECT id INTO v_id
  FROM stripe_customers
  WHERE user_id = p_user_id;
  
  IF v_id IS NOT NULL THEN
    -- Update if needed
    UPDATE stripe_customers
    SET 
      stripe_customer_id = p_stripe_customer_id,
      email = COALESCE(p_email, email),
      name = COALESCE(p_name, name),
      updated_at = NOW()
    WHERE id = v_id;
    RETURN v_id;
  END IF;
  
  -- Create new
  INSERT INTO stripe_customers (user_id, stripe_customer_id, email, name)
  VALUES (p_user_id, p_stripe_customer_id, p_email, p_name)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to record payment
CREATE OR REPLACE FUNCTION record_payment(
  p_user_id UUID,
  p_stripe_customer_id VARCHAR(100),
  p_stripe_subscription_id VARCHAR(100) DEFAULT NULL,
  p_stripe_invoice_id VARCHAR(100) DEFAULT NULL,
  p_stripe_payment_intent_id VARCHAR(100) DEFAULT NULL,
  p_amount DECIMAL(10, 2),
  p_currency VARCHAR(3) DEFAULT 'CNY',
  p_status VARCHAR(20),
  p_plan_id VARCHAR(20) DEFAULT NULL,
  p_billing_period VARCHAR(20) DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_invoice_url VARCHAR(500) DEFAULT NULL,
  p_receipt_url VARCHAR(500) DEFAULT NULL,
  p_paid_at TIMESTAMPTZ DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO payment_history (
    user_id,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_invoice_id,
    stripe_payment_intent_id,
    amount,
    currency,
    status,
    plan_id,
    billing_period,
    description,
    invoice_url,
    receipt_url,
    paid_at,
    metadata
  ) VALUES (
    p_user_id,
    p_stripe_customer_id,
    p_stripe_subscription_id,
    p_stripe_invoice_id,
    p_stripe_payment_intent_id,
    p_amount,
    p_currency,
    p_status,
    p_plan_id,
    p_billing_period,
    p_description,
    p_invoice_url,
    p_receipt_url,
    p_paid_at,
    p_metadata
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get user payment history
CREATE OR REPLACE FUNCTION get_user_payment_history(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20
) RETURNS TABLE (
  id UUID,
  amount DECIMAL(10, 2),
  currency VARCHAR(3),
  status VARCHAR(20),
  plan_id VARCHAR(20),
  billing_period VARCHAR(20),
  description TEXT,
  invoice_url VARCHAR(500),
  receipt_url VARCHAR(500),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ph.id,
    ph.amount,
    ph.currency,
    ph.status,
    ph.plan_id,
    ph.billing_period,
    ph.description,
    ph.invoice_url,
    ph.receipt_url,
    ph.paid_at,
    ph.created_at
  FROM payment_history ph
  WHERE ph.user_id = p_user_id
  ORDER BY ph.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE stripe_customers IS 'Associates users with Stripe customer IDs';
COMMENT ON TABLE payment_history IS 'Records all payment transactions';
