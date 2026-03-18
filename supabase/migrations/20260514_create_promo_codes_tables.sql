-- Promo Codes Tables Migration
-- Creates tables for promo codes, user trial tracking, and promo code usage

-- Promo Codes Table
-- Defines promotional codes for discounts
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  
  -- Discount details
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'CNY', -- For fixed amount discounts
  
  -- Validity
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  
  -- Usage limits
  max_uses INTEGER DEFAULT NULL, -- NULL means unlimited
  max_uses_per_user INTEGER DEFAULT 1,
  current_uses INTEGER NOT NULL DEFAULT 0,
  
  -- Stripe integration
  stripe_coupon_id VARCHAR(100),
  stripe_promotion_code_id VARCHAR(100),
  
  -- Restrictions
  applicable_plans TEXT[] DEFAULT NULL, -- NULL means all plans
  min_purchase_amount DECIMAL(10, 2) DEFAULT NULL,
  first_time_users_only BOOLEAN DEFAULT FALSE,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Metadata
  created_by UUID, -- Admin user who created the code
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Promo Code Usage Table
-- Tracks when and how promo codes are used
CREATE TABLE IF NOT EXISTS promo_code_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Usage context
  stripe_subscription_id VARCHAR(100),
  stripe_invoice_id VARCHAR(100),
  plan_id VARCHAR(20),
  
  -- Discount applied
  discount_amount DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'CNY',
  
  -- Timestamps
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(promo_code_id, user_id, stripe_subscription_id) -- Prevent duplicate usage per subscription
);

-- User Trials Table
-- Tracks user trial periods and prevents abuse
CREATE TABLE IF NOT EXISTS user_trials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  
  -- Trial details
  trial_plan_id VARCHAR(20) NOT NULL DEFAULT 'pro',
  trial_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trial_end TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '14 days',
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'converted', 'expired', 'canceled')),
  
  -- Conversion tracking
  converted_to_plan VARCHAR(20),
  converted_at TIMESTAMPTZ,
  converted_via_promo_code UUID REFERENCES promo_codes(id),
  
  -- Reminder tracking
  reminder_3_days_sent BOOLEAN DEFAULT FALSE,
  reminder_1_day_sent BOOLEAN DEFAULT FALSE,
  reminder_expired_sent BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_promo_codes_code ON promo_codes(code);
CREATE INDEX idx_promo_codes_is_active ON promo_codes(is_active);
CREATE INDEX idx_promo_codes_valid_from ON promo_codes(valid_from);
CREATE INDEX idx_promo_codes_valid_until ON promo_codes(valid_until);
CREATE INDEX idx_promo_code_usage_promo_code_id ON promo_code_usage(promo_code_id);
CREATE INDEX idx_promo_code_usage_user_id ON promo_code_usage(user_id);
CREATE INDEX idx_promo_code_usage_used_at ON promo_code_usage(used_at DESC);
CREATE INDEX idx_user_trials_user_id ON user_trials(user_id);
CREATE INDEX idx_user_trials_status ON user_trials(status);
CREATE INDEX idx_user_trials_trial_end ON user_trials(trial_end);

-- Row Level Security (RLS)
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_code_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_trials ENABLE ROW LEVEL SECURITY;

-- Policies for promo_codes (admin only for writes, public read for active codes)
CREATE POLICY "Anyone can view active promo codes"
  ON promo_codes FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role can manage promo codes"
  ON promo_codes FOR ALL
  USING (auth.role() = 'service_role');

-- Policies for promo_code_usage
CREATE POLICY "Users can view own promo code usage"
  ON promo_code_usage FOR SELECT
  USING (auth.uid()::text = user_id::text OR auth.uid() = user_id);

CREATE POLICY "Service role can manage promo code usage"
  ON promo_code_usage FOR ALL
  USING (auth.role() = 'service_role');

-- Policies for user_trials
CREATE POLICY "Users can view own trials"
  ON user_trials FOR SELECT
  USING (auth.uid()::text = user_id::text OR auth.uid() = user_id);

CREATE POLICY "Service role can manage user trials"
  ON user_trials FOR ALL
  USING (auth.role() = 'service_role');

-- Triggers for updated_at timestamp
DROP TRIGGER IF EXISTS update_promo_codes_updated_at ON promo_codes;
CREATE TRIGGER update_promo_codes_updated_at
  BEFORE UPDATE ON promo_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_trials_updated_at ON user_trials;
CREATE TRIGGER update_user_trials_updated_at
  BEFORE UPDATE ON user_trials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to validate and apply promo code
CREATE OR REPLACE FUNCTION validate_promo_code(
  p_code VARCHAR(50),
  p_user_id UUID,
  p_plan_id VARCHAR(20) DEFAULT NULL,
  p_amount DECIMAL(10, 2) DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_promo_code RECORD;
  v_usage_count INTEGER;
  v_user_usage_count INTEGER;
  v_result JSONB;
BEGIN
  -- Get promo code details
  SELECT * INTO v_promo_code
  FROM promo_codes
  WHERE code = p_code AND is_active = true;
  
  -- Check if code exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'PROMO_CODE_NOT_FOUND',
      'message', 'Promo code not found or inactive'
    );
  END IF;
  
  -- Check validity period
  IF v_promo_code.valid_until IS NOT NULL AND NOW() > v_promo_code.valid_until THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'PROMO_CODE_EXPIRED',
      'message', 'Promo code has expired'
    );
  END IF;
  
  IF NOW() < v_promo_code.valid_from THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'PROMO_CODE_NOT_YET_VALID',
      'message', 'Promo code is not yet valid'
    );
  END IF;
  
  -- Check usage limits
  IF v_promo_code.max_uses IS NOT NULL AND v_promo_code.current_uses >= v_promo_code.max_uses THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'PROMO_CODE_LIMIT_REACHED',
      'message', 'Promo code usage limit reached'
    );
  END IF;
  
  -- Check user usage count
  SELECT COUNT(*) INTO v_user_usage_count
  FROM promo_code_usage
  WHERE promo_code_id = v_promo_code.id AND user_id = p_user_id;
  
  IF v_user_usage_count >= v_promo_code.max_uses_per_user THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'PROMO_CODE_ALREADY_USED',
      'message', 'You have already used this promo code'
    );
  END IF;
  
  -- Check applicable plans
  IF v_promo_code.applicable_plans IS NOT NULL AND p_plan_id IS NOT NULL THEN
    IF NOT (p_plan_id = ANY(v_promo_code.applicable_plans)) THEN
      RETURN jsonb_build_object(
        'valid', false,
        'error', 'PROMO_CODE_NOT_APPLICABLE',
        'message', 'This promo code is not applicable to the selected plan'
      );
    END IF;
  END IF;
  
  -- Check minimum purchase amount
  IF v_promo_code.min_purchase_amount IS NOT NULL AND p_amount IS NOT NULL THEN
    IF p_amount < v_promo_code.min_purchase_amount THEN
      RETURN jsonb_build_object(
        'valid', false,
        'error', 'PROMO_CODE_MIN_PURCHASE',
        'message', 'Minimum purchase amount not met'
      );
    END IF;
  END IF;
  
  -- Check first-time users only
  IF v_promo_code.first_time_users_only THEN
    SELECT COUNT(*) INTO v_usage_count
    FROM promo_code_usage
    WHERE user_id = p_user_id;
    
    IF v_usage_count > 0 THEN
      RETURN jsonb_build_object(
        'valid', false,
        'error', 'PROMO_CODE_NEW_USERS_ONLY',
        'message', 'This promo code is for new users only'
      );
    END IF;
  END IF;
  
  -- Calculate discount
  DECLARE
    v_discount_amount DECIMAL(10, 2);
  BEGIN
    IF v_promo_code.discount_type = 'percentage' THEN
      IF p_amount IS NOT NULL THEN
        v_discount_amount := p_amount * v_promo_code.discount_value / 100;
      ELSE
        v_discount_amount := NULL;
      END IF;
    ELSE
      v_discount_amount := v_promo_code.discount_value;
    END IF;
  END;
  
  -- Build success result
  RETURN jsonb_build_object(
    'valid', true,
    'promoCodeId', v_promo_code.id,
    'code', v_promo_code.code,
    'discountType', v_promo_code.discount_type,
    'discountValue', v_promo_code.discount_value,
    'discountAmount', v_discount_amount,
    'currency', v_promo_code.currency,
    'stripeCouponId', v_promo_code.stripe_coupon_id,
    'stripePromotionCodeId', v_promo_code.stripe_promotion_code_id,
    'message', 'Promo code is valid'
  );
END;
$$ LANGUAGE plpgsql;

-- Function to record promo code usage
CREATE OR REPLACE FUNCTION record_promo_code_usage(
  p_promo_code_id UUID,
  p_user_id UUID,
  p_stripe_subscription_id VARCHAR(100) DEFAULT NULL,
  p_stripe_invoice_id VARCHAR(100) DEFAULT NULL,
  p_plan_id VARCHAR(20) DEFAULT NULL,
  p_discount_amount DECIMAL(10, 2) DEFAULT NULL,
  p_currency VARCHAR(3) DEFAULT 'CNY'
) RETURNS UUID AS $$
DECLARE
  v_usage_id UUID;
BEGIN
  -- Record usage
  INSERT INTO promo_code_usage (
    promo_code_id,
    user_id,
    stripe_subscription_id,
    stripe_invoice_id,
    plan_id,
    discount_amount,
    currency
  ) VALUES (
    p_promo_code_id,
    p_user_id,
    p_stripe_subscription_id,
    p_stripe_invoice_id,
    p_plan_id,
    p_discount_amount,
    p_currency
  ) RETURNING id INTO v_usage_id;
  
  -- Increment usage count
  UPDATE promo_codes
  SET current_uses = current_uses + 1, updated_at = NOW()
  WHERE id = p_promo_code_id;
  
  RETURN v_usage_id;
END;
$$ LANGUAGE plpgsql;

-- Function to start trial for a user
CREATE OR REPLACE FUNCTION start_user_trial(
  p_user_id UUID,
  p_trial_days INTEGER DEFAULT 14,
  p_plan_id VARCHAR(20) DEFAULT 'pro'
) RETURNS JSONB AS $$
DECLARE
  v_existing_trial RECORD;
  v_trial_end TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  -- Check if user already has a trial
  SELECT * INTO v_existing_trial
  FROM user_trials
  WHERE user_id = p_user_id;
  
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'TRIAL_ALREADY_EXISTS',
      'message', 'User already has a trial record',
      'trial', jsonb_build_object(
        'status', v_existing_trial.status,
        'trialEnd', v_existing_trial.trial_end
      )
    );
  END IF;
  
  -- Calculate trial end
  v_trial_end := NOW() + (p_trial_days || ' days')::INTERVAL;
  
  -- Create trial record
  INSERT INTO user_trials (
    user_id,
    trial_plan_id,
    trial_start,
    trial_end,
    status
  ) VALUES (
    p_user_id,
    p_plan_id,
    NOW(),
    v_trial_end,
    'active'
  );
  
  -- Also create/update user subscription to trialing status
  INSERT INTO user_subscriptions (
    user_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    trial_start,
    trial_end
  ) VALUES (
    p_user_id,
    p_plan_id,
    'trialing',
    NOW(),
    v_trial_end,
    NOW(),
    v_trial_end
  ) ON CONFLICT (user_id) DO UPDATE SET
    status = 'trialing',
    plan_id = p_plan_id,
    current_period_start = NOW(),
    current_period_end = v_trial_end,
    trial_start = NOW(),
    trial_end = v_trial_end,
    updated_at = NOW();
  
  -- Record history
  INSERT INTO subscription_history (
    user_id,
    action,
    from_plan,
    to_plan,
    from_status,
    to_status
  ) VALUES (
    p_user_id,
    'trial_started',
    NULL,
    p_plan_id,
    NULL,
    'trialing'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Trial started successfully',
    'trial', jsonb_build_object(
      'planId', p_plan_id,
      'trialStart', NOW(),
      'trialEnd', v_trial_end,
      'trialDays', p_trial_days
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Function to check and expire trials
CREATE OR REPLACE FUNCTION expire_trials()
RETURNS INTEGER AS $$
DECLARE
  v_expired_count INTEGER := 0;
  v_trial RECORD;
BEGIN
  -- Find expired trials
  FOR v_trial IN 
    SELECT id, user_id, trial_plan_id
    FROM user_trials
    WHERE status = 'active' AND trial_end < NOW()
  LOOP
    -- Update trial status
    UPDATE user_trials
    SET status = 'expired', updated_at = NOW()
    WHERE id = v_trial.id;
    
    -- Update user subscription
    UPDATE user_subscriptions
    SET 
      status = 'expired',
      plan_id = 'free',
      updated_at = NOW()
    WHERE user_id = v_trial.user_id;
    
    -- Record history
    INSERT INTO subscription_history (
      user_id,
      action,
      from_plan,
      to_plan,
      from_status,
      to_status
    ) VALUES (
      v_trial.user_id,
      'trial_ended',
      v_trial.trial_plan_id,
      'free',
      'trialing',
      'expired'
    );
    
    v_expired_count := v_expired_count + 1;
  END LOOP;
  
  RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get users needing trial reminders
CREATE OR REPLACE FUNCTION get_users_for_trial_reminder(
  p_days_before INTEGER
) RETURNS TABLE (
  user_id UUID,
  trial_end TIMESTAMPTZ,
  trial_plan_id VARCHAR(20)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ut.user_id,
    ut.trial_end,
    ut.trial_plan_id
  FROM user_trials ut
  WHERE ut.status = 'active'
    AND DATE(ut.trial_end) = CURRENT_DATE + p_days_before
    AND (
      (p_days_before = 3 AND NOT ut.reminder_3_days_sent)
      OR (p_days_before = 1 AND NOT ut.reminder_1_day_sent)
    );
END;
$$ LANGUAGE plpgsql;

-- Function to mark reminder as sent
CREATE OR REPLACE FUNCTION mark_trial_reminder_sent(
  p_user_id UUID,
  p_days_before INTEGER
) RETURNS VOID AS $$
BEGIN
  IF p_days_before = 3 THEN
    UPDATE user_trials
    SET reminder_3_days_sent = true, updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSIF p_days_before = 1 THEN
    UPDATE user_trials
    SET reminder_1_day_sent = true, updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSIF p_days_before = 0 THEN
    UPDATE user_trials
    SET reminder_expired_sent = true, updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE promo_codes IS 'Defines promotional codes for discounts';
COMMENT ON TABLE promo_code_usage IS 'Tracks when and how promo codes are used';
COMMENT ON TABLE user_trials IS 'Tracks user trial periods and prevents abuse';