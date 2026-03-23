-- Referral System Tables Migration
-- Creates tables for referral codes, referrals tracking, and rewards

-- Referral Codes Table
-- Each user can have one unique referral code
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  code VARCHAR(20) NOT NULL UNIQUE,
  
  -- Statistics
  total_referrals INTEGER NOT NULL DEFAULT 0,
  successful_referrals INTEGER NOT NULL DEFAULT 0,
  pending_rewards DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_rewards_earned DECIMAL(10, 2) NOT NULL DEFAULT 0,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Referrals Table
-- Tracks each referral event
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_code_id UUID NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
  referrer_user_id UUID NOT NULL, -- Denormalized for quick queries
  invitee_user_id UUID UNIQUE, -- The user who registered with this code (null until registered)
  
  -- Invite tracking
  invite_email VARCHAR(255),
  invite_token UUID DEFAULT gen_random_uuid(), -- Token for invite link
  
  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'registered', 'activated', 'rewarded', 'cancelled')),
  
  -- Device tracking for fraud prevention
  invitee_device_fingerprint VARCHAR(64),
  invitee_ip_address VARCHAR(45),
  
  -- Timestamps
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  registered_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ, -- When the invitee becomes "activated" (e.g., makes first trade)
  
  -- Reward delay tracking
  reward_scheduled_at TIMESTAMPTZ, -- When reward should be given (7 days after activation)
  reward_processed_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rewards Table
-- Tracks all reward transactions
CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- User receiving the reward
  referral_id UUID REFERENCES referrals(id) ON DELETE SET NULL,
  
  -- Reward details
  reward_type VARCHAR(20) NOT NULL CHECK (reward_type IN ('referral_bonus', 'invitee_bonus', 'activation_bonus', 'manual')),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'CNY',
  
  -- Reward source
  source_user_id UUID, -- Who triggered this reward (for referral rewards)
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'cancelled')),
  
  -- Processing details
  scheduled_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  
  -- Integration with virtual account
  virtual_account_transaction_id UUID,
  
  -- Metadata
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Referral Fraud Detection Table
-- Tracks suspicious patterns
CREATE TABLE IF NOT EXISTS referral_fraud_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  
  -- Flag details
  flag_type VARCHAR(30) NOT NULL CHECK (flag_type IN (
    'same_device', 
    'same_ip', 
    'rapid_registration', 
    'suspicious_pattern',
    'self_referral',
    'multiple_accounts'
  )),
  severity VARCHAR(20) NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high')),
  details JSONB DEFAULT '{}',
  
  -- Resolution
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_referral_codes_user_id ON referral_codes(user_id);
CREATE INDEX idx_referral_codes_code ON referral_codes(code);
CREATE INDEX idx_referrals_referrer_code_id ON referrals(referrer_code_id);
CREATE INDEX idx_referrals_referrer_user_id ON referrals(referrer_user_id);
CREATE INDEX idx_referrals_invitee_user_id ON referrals(invitee_user_id);
CREATE INDEX idx_referrals_invite_token ON referrals(invite_token);
CREATE INDEX idx_referrals_status ON referrals(status);
CREATE INDEX idx_referrals_invited_at ON referrals(invited_at DESC);
CREATE INDEX idx_rewards_user_id ON rewards(user_id);
CREATE INDEX idx_rewards_referral_id ON rewards(referral_id);
CREATE INDEX idx_rewards_status ON rewards(status);
CREATE INDEX idx_rewards_scheduled_at ON rewards(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_referral_fraud_flags_referral_id ON referral_fraud_flags(referral_id);

-- Row Level Security (RLS)
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_fraud_flags ENABLE ROW LEVEL SECURITY;

-- Policies for referral_codes
CREATE POLICY "Users can view own referral code"
  ON referral_codes FOR SELECT
  USING (auth.uid()::text = user_id::text OR auth.uid() = user_id);

CREATE POLICY "Service role can manage referral codes"
  ON referral_codes FOR ALL
  USING (auth.role() = 'service_role');

-- Policies for referrals
CREATE POLICY "Users can view own referrals (as referrer or invitee)"
  ON referrals FOR SELECT
  USING (
    auth.uid()::text = referrer_user_id::text 
    OR auth.uid()::text = invitee_user_id::text 
    OR auth.uid() = referrer_user_id 
    OR auth.uid() = invitee_user_id
  );

CREATE POLICY "Service role can manage referrals"
  ON referrals FOR ALL
  USING (auth.role() = 'service_role');

-- Policies for rewards
CREATE POLICY "Users can view own rewards"
  ON rewards FOR SELECT
  USING (auth.uid()::text = user_id::text OR auth.uid() = user_id);

CREATE POLICY "Service role can manage rewards"
  ON rewards FOR ALL
  USING (auth.role() = 'service_role');

-- Policies for referral_fraud_flags (admin only)
CREATE POLICY "Service role can manage fraud flags"
  ON referral_fraud_flags FOR ALL
  USING (auth.role() = 'service_role');

-- Triggers for updated_at timestamp
DROP TRIGGER IF EXISTS update_referral_codes_updated_at ON referral_codes;
CREATE TRIGGER update_referral_codes_updated_at
  BEFORE UPDATE ON referral_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_referrals_updated_at ON referrals;
CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON referrals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rewards_updated_at ON rewards;
CREATE TRIGGER update_rewards_updated_at
  BEFORE UPDATE ON rewards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to generate a unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code(p_user_id UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
  v_code VARCHAR(20);
  v_exists BOOLEAN;
  v_counter INTEGER := 0;
BEGIN
  LOOP
    -- Generate a random alphanumeric code (8 characters)
    v_code := upper(substring(md5(random()::text || p_user_id::text || v_counter::text) from 1 for 8));
    
    -- Check if it exists
    SELECT EXISTS(SELECT 1 FROM referral_codes WHERE code = v_code) INTO v_exists;
    
    IF NOT v_exists THEN
      RETURN v_code;
    END IF;
    
    v_counter := v_counter + 1;
    
    -- Safety limit
    IF v_counter > 100 THEN
      RAISE EXCEPTION 'Failed to generate unique referral code after 100 attempts';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to create or get referral code for a user
CREATE OR REPLACE FUNCTION get_or_create_referral_code(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_code_id UUID;
  v_code VARCHAR(20);
BEGIN
  -- Check if user already has a referral code
  SELECT id INTO v_code_id FROM referral_codes WHERE user_id = p_user_id;
  
  IF v_code_id IS NOT NULL THEN
    RETURN v_code_id;
  END IF;
  
  -- Generate new code
  v_code := generate_referral_code(p_user_id);
  
  -- Create the referral code
  INSERT INTO referral_codes (user_id, code)
  VALUES (p_user_id, v_code)
  RETURNING id INTO v_code_id;
  
  RETURN v_code_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check for potential fraud
CREATE OR REPLACE FUNCTION check_referral_fraud(
  p_referrer_user_id UUID,
  p_invitee_user_id UUID,
  p_device_fingerprint VARCHAR(64),
  p_ip_address VARCHAR(45)
) RETURNS TABLE (
  flag_type VARCHAR(30),
  severity VARCHAR(20)
) AS $$
BEGIN
  -- Check for self-referral
  IF p_referrer_user_id = p_invitee_user_id THEN
    RETURN QUERY SELECT 'self_referral'::VARCHAR(30), 'high'::VARCHAR(20);
  END IF;
  
  -- Check for same device fingerprint (if provided)
  IF p_device_fingerprint IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM referrals r
      WHERE r.invitee_device_fingerprint = p_device_fingerprint
        AND r.referrer_user_id = p_referrer_user_id
    ) THEN
      RETURN QUERY SELECT 'same_device'::VARCHAR(30), 'medium'::VARCHAR(20);
    END IF;
    
    -- Check if referrer already registered with this device
    IF EXISTS (
      SELECT 1 FROM referrals r
      WHERE r.invitee_device_fingerprint = p_device_fingerprint
        AND r.invitee_user_id = p_referrer_user_id
    ) THEN
      RETURN QUERY SELECT 'multiple_accounts'::VARCHAR(30), 'high'::VARCHAR(20);
    END IF;
  END IF;
  
  -- Check for same IP address (less severe)
  IF p_ip_address IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM referrals r
      WHERE r.invitee_ip_address = p_ip_address
        AND r.referrer_user_id = p_referrer_user_id
        AND r.invited_at > NOW() - INTERVAL '24 hours'
    ) THEN
      RETURN QUERY SELECT 'same_ip'::VARCHAR(30), 'low'::VARCHAR(20);
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to process a referral registration
CREATE OR REPLACE FUNCTION process_referral_registration(
  p_invite_token UUID,
  p_invitee_user_id UUID,
  p_device_fingerprint VARCHAR(64) DEFAULT NULL,
  p_ip_address VARCHAR(45) DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_referral RECORD;
  v_fraud_record RECORD;
  v_referral_code_id UUID;
  v_reward_amount DECIMAL(10, 2) := 100.00; -- Base reward amount
  v_invitee_bonus DECIMAL(10, 2) := 50.00; -- Bonus for invitee
BEGIN
  -- Find the pending referral
  SELECT * INTO v_referral
  FROM referrals
  WHERE invite_token = p_invite_token AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'REFERRAL_NOT_FOUND',
      'message', 'Invalid or expired referral link'
    );
  END IF;
  
  -- Check if referral is too old (30 days)
  IF v_referral.invited_at < NOW() - INTERVAL '30 days' THEN
    UPDATE referrals SET status = 'cancelled', updated_at = NOW()
    WHERE id = v_referral.id;
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'REFERRAL_EXPIRED',
      'message', 'Referral link has expired'
    );
  END IF;
  
  -- Check for fraud
  FOR v_fraud_record IN
    SELECT * FROM check_referral_fraud(
      v_referral.referrer_user_id,
      p_invitee_user_id,
      p_device_fingerprint,
      p_ip_address
    )
  LOOP
    -- Log fraud flag
    INSERT INTO referral_fraud_flags (
      referral_id,
      flag_type,
      severity,
      details
    ) VALUES (
      v_referral.id,
      v_fraud_record.flag_type,
      v_fraud_record.severity,
      jsonb_build_object(
        'device_fingerprint', p_device_fingerprint,
        'ip_address', p_ip_address
      )
    );
    
    -- High severity = cancel the referral
    IF v_fraud_record.severity = 'high' THEN
      UPDATE referrals SET status = 'cancelled', updated_at = NOW()
      WHERE id = v_referral.id;
      
      RETURN jsonb_build_object(
        'success', false,
        'error', 'FRAUD_DETECTED',
        'message', 'Referral flagged for suspicious activity'
      );
    END IF;
  END LOOP;
  
  -- Update the referral record
  UPDATE referrals SET
    invitee_user_id = p_invitee_user_id,
    invitee_device_fingerprint = p_device_fingerprint,
    invitee_ip_address = p_ip_address,
    status = 'registered',
    registered_at = NOW(),
    updated_at = NOW()
  WHERE id = v_referral.id;
  
  -- Update referral code stats
  UPDATE referral_codes SET
    total_referrals = total_referrals + 1,
    updated_at = NOW()
  WHERE id = v_referral.referrer_code_id;
  
  -- Create invitee bonus reward (immediate)
  INSERT INTO rewards (
    user_id,
    referral_id,
    reward_type,
    amount,
    source_user_id,
    status,
    scheduled_at
  ) VALUES (
    p_invitee_user_id,
    v_referral.id,
    'invitee_bonus',
    v_invitee_bonus,
    v_referral.referrer_user_id,
    'pending',
    NOW() -- Immediate for invitee
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'referral_id', v_referral.id,
    'referrer_user_id', v_referral.referrer_user_id,
    'invitee_bonus', v_invitee_bonus,
    'message', 'Referral registered successfully'
  );
END;
$$ LANGUAGE plpgsql;

-- Function to activate a referral (called when invitee completes activation criteria)
CREATE OR REPLACE FUNCTION activate_referral(
  p_invitee_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_referral RECORD;
  v_reward_amount DECIMAL(10, 2) := 100.00;
  v_reward_delay_days INTEGER := 7;
BEGIN
  -- Find the registered referral for this user
  SELECT * INTO v_referral
  FROM referrals
  WHERE invitee_user_id = p_invitee_user_id AND status = 'registered';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NO_REFERRAL_FOUND',
      'message', 'No registered referral found for this user'
    );
  END IF;
  
  -- Update referral status
  UPDATE referrals SET
    status = 'activated',
    activated_at = NOW(),
    reward_scheduled_at = NOW() + (v_reward_delay_days || ' days')::INTERVAL,
    updated_at = NOW()
  WHERE id = v_referral.id;
  
  -- Update referral code stats
  UPDATE referral_codes SET
    successful_referrals = successful_referrals + 1,
    pending_rewards = pending_rewards + v_reward_amount,
    updated_at = NOW()
  WHERE id = v_referral.referrer_code_id;
  
  -- Create referrer reward (delayed)
  INSERT INTO rewards (
    user_id,
    referral_id,
    reward_type,
    amount,
    source_user_id,
    status,
    scheduled_at
  ) VALUES (
    v_referral.referrer_user_id,
    v_referral.id,
    'referral_bonus',
    v_reward_amount,
    p_invitee_user_id,
    'pending',
    NOW() + (v_reward_delay_days || ' days')::INTERVAL
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'referral_id', v_referral.id,
    'reward_amount', v_reward_amount,
    'reward_scheduled_at', NOW() + (v_reward_delay_days || ' days')::INTERVAL,
    'message', 'Referral activated successfully'
  );
END;
$$ LANGUAGE plpgsql;

-- Function to process pending rewards
CREATE OR REPLACE FUNCTION process_pending_rewards()
RETURNS INTEGER AS $$
DECLARE
  v_processed_count INTEGER := 0;
  v_reward RECORD;
BEGIN
  -- Find rewards that are due
  FOR v_reward IN
    SELECT * FROM rewards
    WHERE status = 'pending'
      AND scheduled_at IS NOT NULL
      AND scheduled_at <= NOW()
  LOOP
    BEGIN
      -- Here we would integrate with the virtual account system
      -- For now, just mark as processed
      UPDATE rewards SET
        status = 'processed',
        processed_at = NOW(),
        updated_at = NOW()
      WHERE id = v_reward.id;
      
      -- Update referral code stats
      UPDATE referral_codes SET
        pending_rewards = pending_rewards - v_reward.amount,
        total_rewards_earned = total_rewards_earned + v_reward.amount,
        updated_at = NOW()
      WHERE user_id = v_reward.user_id;
      
      v_processed_count := v_processed_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue processing other rewards
      RAISE WARNING 'Failed to process reward %: %', v_reward.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN v_processed_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get referral statistics for a user
CREATE OR REPLACE FUNCTION get_referral_stats(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_code RECORD;
  v_recent_referrals JSONB;
  v_earnings_summary JSONB;
BEGIN
  -- Get referral code info
  SELECT * INTO v_code FROM referral_codes WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'has_code', false,
      'referral_code', null
    );
  END IF;
  
  -- Get recent referrals
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'status', r.status,
      'invited_at', r.invited_at,
      'registered_at', r.registered_at,
      'activated_at', r.activated_at
    )
  )
  INTO v_recent_referrals
  FROM (
    SELECT * FROM referrals
    WHERE referrer_user_id = p_user_id
    ORDER BY invited_at DESC
    LIMIT 10
  ) r;
  
  -- Get earnings summary
  SELECT jsonb_build_object(
    'pending', COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0),
    'processed', COALESCE(SUM(CASE WHEN status = 'processed' THEN amount ELSE 0 END), 0),
    'total', COALESCE(SUM(amount), 0)
  )
  INTO v_earnings_summary
  FROM rewards
  WHERE user_id = p_user_id;
  
  RETURN jsonb_build_object(
    'has_code', true,
    'referral_code', v_code.code,
    'total_referrals', v_code.total_referrals,
    'successful_referrals', v_code.successful_referrals,
    'pending_rewards', v_code.pending_rewards,
    'total_rewards_earned', v_code.total_rewards_earned,
    'recent_referrals', COALESCE(v_recent_referrals, '[]'::jsonb),
    'earnings_summary', v_earnings_summary
  );
END;
$$ LANGUAGE plpgsql;

-- Function to create an invite (for sharing)
CREATE OR REPLACE FUNCTION create_referral_invite(
  p_referrer_user_id UUID,
  p_invite_email VARCHAR(255) DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_code_id UUID;
  v_invite_token UUID;
  v_referral_id UUID;
BEGIN
  -- Get or create referral code
  v_code_id := get_or_create_referral_code(p_referrer_user_id);
  
  -- Generate invite token
  v_invite_token := gen_random_uuid();
  
  -- Create pending referral
  INSERT INTO referrals (
    referrer_code_id,
    referrer_user_id,
    invite_email,
    invite_token,
    status
  ) VALUES (
    v_code_id,
    p_referrer_user_id,
    p_invite_email,
    v_invite_token,
    'pending'
  ) RETURNING id INTO v_referral_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'referral_id', v_referral_id,
    'invite_token', v_invite_token,
    'referral_link', '/register?ref=' || v_invite_token::text,
    'message', 'Invite created successfully'
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE referral_codes IS 'Stores unique referral codes for each user';
COMMENT ON TABLE referrals IS 'Tracks referral events from invite to reward';
COMMENT ON TABLE rewards IS 'Tracks all reward transactions for the referral system';
COMMENT ON TABLE referral_fraud_flags IS 'Tracks suspicious referral patterns for fraud prevention';