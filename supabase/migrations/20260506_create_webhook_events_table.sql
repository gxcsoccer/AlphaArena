-- Webhook Events Table for Idempotency
-- Ensures each Stripe webhook event is processed only once

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id VARCHAR(100) NOT NULL UNIQUE,
  event_type VARCHAR(100) NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'processed', -- 'processed', 'failed'
  error_message TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Index for fast lookups
CREATE INDEX idx_stripe_webhook_events_stripe_event_id ON stripe_webhook_events(stripe_event_id);
CREATE INDEX idx_stripe_webhook_events_processed_at ON stripe_webhook_events(processed_at DESC);

-- Row Level Security
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service role can manage webhook events
CREATE POLICY "Service role can manage webhook events"
  ON stripe_webhook_events FOR ALL
  USING (auth.role() = 'service_role');

-- Function to check if event was already processed
CREATE OR REPLACE FUNCTION is_webhook_event_processed(
  p_stripe_event_id VARCHAR(100)
) RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM stripe_webhook_events
  WHERE stripe_event_id = p_stripe_event_id;
  
  RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to mark event as processed
CREATE OR REPLACE FUNCTION mark_webhook_event_processed(
  p_stripe_event_id VARCHAR(100),
  p_event_type VARCHAR(100),
  p_status VARCHAR(20) DEFAULT 'processed',
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS VOID AS $$
BEGIN
  INSERT INTO stripe_webhook_events (
    stripe_event_id,
    event_type,
    status,
    error_message,
    metadata
  ) VALUES (
    p_stripe_event_id,
    p_event_type,
    p_status,
    p_error_message,
    p_metadata
  )
  ON CONFLICT (stripe_event_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE stripe_webhook_events IS 'Tracks processed Stripe webhook events for idempotency';
