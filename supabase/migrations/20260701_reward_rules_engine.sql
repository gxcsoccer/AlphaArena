-- Reward Rules Engine Migration
-- Creates configurable reward rules table

-- Reward Rules Table
CREATE TABLE IF NOT EXISTS reward_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  
  -- Trigger configuration
  trigger_event VARCHAR(30) NOT NULL CHECK (trigger_event IN ('registration', 'first_payment', 'subscription', 'trade')),
  reward_type VARCHAR(20) NOT NULL CHECK (reward_type IN ('vip_days', 'points', 'cash_voucher')),
  reward_level VARCHAR(20) NOT NULL DEFAULT 'level_1' CHECK (reward_level IN ('level_1', 'level_2')),
  
  -- Reward amounts
  referrer_reward JSONB NOT NULL DEFAULT '{}',
  invitee_reward JSONB NOT NULL DEFAULT '{}',
  
  -- Conditions
  conditions JSONB DEFAULT '{}',
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  
  -- Validity period
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_reward_rules_trigger_event ON reward_rules(trigger_event);
CREATE INDEX idx_reward_rules_is_active ON reward_rules(is_active);
CREATE INDEX idx_reward_rules_priority ON reward_rules(priority DESC);

-- Add risk_score column to fraud flags if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'referral_fraud_flags' AND column_name = 'risk_score'
  ) THEN
    ALTER TABLE referral_fraud_flags ADD COLUMN risk_score INTEGER DEFAULT 0;
  END IF;
END $$;

-- Update fraud flag types
ALTER TABLE referral_fraud_flags 
DROP CONSTRAINT IF EXISTS referral_fraud_flags_flag_type_check;

ALTER TABLE referral_fraud_flags 
ADD CONSTRAINT referral_fraud_flags_flag_type_check 
CHECK (flag_type IN (
  'same_device', 
  'same_ip', 
  'rapid_registration', 
  'suspicious_pattern',
  'self_referral',
  'multiple_accounts',
  'proxy_vpn',
  'device_emulator',
  'behavioral_anomaly',
  'invite_farming'
));

-- Add new severity levels
ALTER TABLE referral_fraud_flags 
DROP CONSTRAINT IF EXISTS referral_fraud_flags_severity_check;

ALTER TABLE referral_fraud_flags 
ADD CONSTRAINT referral_fraud_flags_severity_check 
CHECK (severity IN ('low', 'medium', 'high', 'critical'));

-- Add rule_id to rewards for tracking
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rewards' AND column_name = 'rule_id'
  ) THEN
    ALTER TABLE rewards ADD COLUMN rule_id UUID REFERENCES reward_rules(id);
  END IF;
END $$;

-- Add processing_error and processing_attempts to rewards for retry logic
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rewards' AND column_name = 'processing_error'
  ) THEN
    ALTER TABLE rewards ADD COLUMN processing_error TEXT;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rewards' AND column_name = 'processing_attempts'
  ) THEN
    ALTER TABLE rewards ADD COLUMN processing_attempts INTEGER DEFAULT 0;
  END IF;
END $$;

-- Function to update referral code stats
CREATE OR REPLACE FUNCTION update_referral_code_stats(
  p_user_id UUID,
  p_amount DECIMAL(10, 2)
) RETURNS VOID AS $$
BEGIN
  UPDATE referral_codes SET
    pending_rewards = GREATEST(pending_rewards - p_amount, 0),
    total_rewards_earned = total_rewards_earned + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Insert default rules
INSERT INTO reward_rules (name, description, trigger_event, reward_type, reward_level, referrer_reward, invitee_reward, conditions, priority)
VALUES 
  (
    'registration_invitee_bonus',
    'Invitee gets 7 days VIP Pro upon registration',
    'registration',
    'vip_days',
    'level_1',
    '{"amount": 0, "type": "vip_days", "delayDays": 0}',
    '{"amount": 7, "type": "vip_days", "immediate": true}',
    '{}',
    10
  ),
  (
    'activation_referrer_bonus',
    'Referrer gets 30 days VIP when invitee activates (first payment/subscription)',
    'subscription',
    'vip_days',
    'level_1',
    '{"amount": 30, "type": "vip_days", "delayDays": 0}',
    '{"amount": 0, "type": "vip_days", "immediate": false}',
    '{"paymentRequired": true}',
    20
  ),
  (
    'first_trade_bonus',
    'Additional bonus when invitee completes first trade',
    'trade',
    'vip_days',
    'level_1',
    '{"amount": 7, "type": "vip_days", "delayDays": 0}',
    '{"amount": 7, "type": "vip_days", "immediate": true}',
    '{"requiredTradeCount": 1}',
    15
  )
ON CONFLICT (name) DO NOTHING;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_reward_rules_updated_at ON reward_rules;
CREATE TRIGGER update_reward_rules_updated_at
  BEFORE UPDATE ON reward_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE reward_rules IS 'Configurable reward rules for the referral system';
COMMENT ON COLUMN reward_rules.referrer_reward IS 'JSON with amount, type, and delayDays for referrer reward';
COMMENT ON COLUMN reward_rules.invitee_reward IS 'JSON with amount, type, and immediate flag for invitee reward';
COMMENT ON COLUMN reward_rules.conditions IS 'JSON with minSubscriptionAmount, requiredTradeCount, paymentRequired';