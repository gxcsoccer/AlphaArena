-- Referral VIP Integration Migration
-- Integrates referral rewards with VIP subscription system

-- Function to grant VIP days to a user
CREATE OR REPLACE FUNCTION grant_vip_days(
  p_user_id UUID,
  p_days INTEGER,
  p_reason VARCHAR(100) DEFAULT 'referral_bonus'
) RETURNS JSONB AS $$
DECLARE
  v_subscription RECORD;
  v_new_period_end TIMESTAMPTZ;
  v_current_plan VARCHAR(20);
BEGIN
  -- Check if user has an active subscription
  SELECT * INTO v_subscription
  FROM user_subscriptions
  WHERE user_id = p_user_id AND status IN ('active', 'trialing');
  
  IF v_subscription.plan_id = 'pro' THEN
    -- User is already on Pro, extend the period
    v_new_period_end := GREATEST(v_subscription.current_period_end, NOW()) + (p_days || ' days')::INTERVAL;
    
    UPDATE user_subscriptions SET
      current_period_end = v_new_period_end,
      updated_at = NOW()
    WHERE id = v_subscription.id;
    
    -- Record history
    INSERT INTO subscription_history (user_id, action, from_plan, to_plan, from_status, to_status, reason)
    VALUES (p_user_id, 'renewed', 'pro', 'pro', 'active', 'active', 'Extended by ' || p_days || ' days via ' || p_reason);
    
    RETURN jsonb_build_object(
      'success', true,
      'action', 'extended',
      'days_added', p_days,
      'new_period_end', v_new_period_end,
      'message', 'VIP subscription extended by ' || p_days || ' days'
    );
  ELSE
    -- User is not on Pro, activate Pro for the given days
    v_new_period_end := NOW() + (p_days || ' days')::INTERVAL;
    
    -- Upsert subscription
    INSERT INTO user_subscriptions (
      user_id, plan_id, status, 
      current_period_start, current_period_end
    ) VALUES (
      p_user_id, 'pro', 'active', NOW(), v_new_period_end
    )
    ON CONFLICT (user_id) DO UPDATE SET
      plan_id = 'pro',
      status = 'active',
      current_period_start = NOW(),
      current_period_end = v_new_period_end,
      updated_at = NOW();
    
    -- Record history
    INSERT INTO subscription_history (user_id, action, from_plan, to_plan, from_status, to_status, reason)
    VALUES (p_user_id, 'upgraded', COALESCE(v_subscription.plan_id, 'free'), 'pro', 
            COALESCE(v_subscription.status, 'none'), 'active', 
            'Activated via ' || p_reason || ' for ' || p_days || ' days');
    
    RETURN jsonb_build_object(
      'success', true,
      'action', 'activated',
      'days_granted', p_days,
      'new_period_end', v_new_period_end,
      'message', 'VIP Pro activated for ' || p_days || ' days'
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Update the process_pending_rewards function to grant VIP days
CREATE OR REPLACE FUNCTION process_pending_rewards()
RETURNS INTEGER AS $$
DECLARE
  v_processed_count INTEGER := 0;
  v_reward RECORD;
  v_vip_days INTEGER;
  v_result JSONB;
BEGIN
  -- Find rewards that are due
  FOR v_reward IN
    SELECT * FROM rewards
    WHERE status = 'pending'
      AND scheduled_at IS NOT NULL
      AND scheduled_at <= NOW()
  LOOP
    BEGIN
      -- Convert reward amount to VIP days (100 CNY = 30 days)
      v_vip_days := FLOOR(v_reward.amount / 100 * 30);
      
      -- Ensure minimum of 7 days
      IF v_vip_days < 7 THEN
        v_vip_days := 7;
      END IF;
      
      -- Grant VIP days
      v_result := grant_vip_days(v_reward.user_id, v_vip_days, v_reward.reward_type);
      
      IF (v_result->>'success')::boolean THEN
        -- Mark reward as processed
        UPDATE rewards SET
          status = 'processed',
          processed_at = NOW(),
          updated_at = NOW(),
          description = COALESCE(description, '') || ' - Granted ' || v_vip_days || ' VIP days',
          metadata = jsonb_set(COALESCE(metadata, '{}'), '{vip_days}', to_jsonb(v_vip_days))
        WHERE id = v_reward.id;
        
        -- Update referral code stats
        UPDATE referral_codes SET
          pending_rewards = GREATEST(pending_rewards - v_reward.amount, 0),
          total_rewards_earned = total_rewards_earned + v_reward.amount,
          updated_at = NOW()
        WHERE user_id = v_reward.user_id;
        
        v_processed_count := v_processed_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue processing other rewards
      RAISE WARNING 'Failed to process reward %: %', v_reward.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN v_processed_count;
END;
$$ LANGUAGE plpgsql;

-- Function to process invitee bonus immediately (called on registration)
CREATE OR REPLACE FUNCTION process_invitee_vip_bonus(
  p_invitee_user_id UUID,
  p_bonus_days INTEGER DEFAULT 7
) RETURNS JSONB AS $$
BEGIN
  RETURN grant_vip_days(p_invitee_user_id, p_bonus_days, 'invitee_bonus');
END;
$$ LANGUAGE plpgsql;

-- Update process_referral_registration to grant VIP immediately
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
  v_reward_amount DECIMAL(10, 2) := 100.00;
  v_invitee_vip_days INTEGER := 7; -- 7 days VIP for invitee
  v_referrer_vip_days INTEGER := 30; -- 30 days VIP for referrer when activated
  v_vip_result JSONB;
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
  
  -- Grant VIP days to invitee immediately
  v_vip_result := grant_vip_days(p_invitee_user_id, v_invitee_vip_days, 'invitee_bonus');
  
  -- Record the invitee bonus reward
  INSERT INTO rewards (
    user_id,
    referral_id,
    reward_type,
    amount,
    source_user_id,
    status,
    scheduled_at,
    processed_at,
    description
  ) VALUES (
    p_invitee_user_id,
    v_referral.id,
    'invitee_bonus',
    v_invitee_vip_days * 100 / 30.0, -- Store as equivalent amount for tracking
    v_referral.referrer_user_id,
    'processed',
    NOW(),
    NOW(),
    'New user bonus: ' || v_invitee_vip_days || ' days VIP Pro'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'referral_id', v_referral.id,
    'referrer_user_id', v_referral.referrer_user_id,
    'invitee_bonus', v_invitee_vip_days,
    'invitee_bonus_type', 'vip_days',
    'vip_result', v_vip_result,
    'message', 'Referral registered successfully, granted ' || v_invitee_vip_days || ' VIP days'
  );
END;
$$ LANGUAGE plpgsql;

-- Update activate_referral to grant VIP days
CREATE OR REPLACE FUNCTION activate_referral(
  p_invitee_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_referral RECORD;
  v_reward_amount DECIMAL(10, 2) := 100.00;
  v_referrer_vip_days INTEGER := 30; -- 30 days VIP for referrer
  v_vip_result JSONB;
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
    updated_at = NOW()
  WHERE id = v_referral.id;
  
  -- Update referral code stats
  UPDATE referral_codes SET
    successful_referrals = successful_referrals + 1,
    updated_at = NOW()
  WHERE id = v_referral.referrer_code_id;
  
  -- Grant VIP days to referrer immediately (no delay for activation bonus)
  v_vip_result := grant_vip_days(v_referral.referrer_user_id, v_referrer_vip_days, 'referral_bonus');
  
  -- Create referrer reward record
  INSERT INTO rewards (
    user_id,
    referral_id,
    reward_type,
    amount,
    source_user_id,
    status,
    scheduled_at,
    processed_at,
    description
  ) VALUES (
    v_referral.referrer_user_id,
    v_referral.id,
    'referral_bonus',
    v_referrer_vip_days * 100 / 30.0,
    p_invitee_user_id,
    'processed',
    NOW(),
    NOW(),
    'Referral bonus: ' || v_referrer_vip_days || ' days VIP Pro'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'referral_id', v_referral.id,
    'reward_amount', v_reward_amount,
    'vip_days_granted', v_referrer_vip_days,
    'vip_result', v_vip_result,
    'message', 'Referral activated successfully, granted ' || v_referrer_vip_days || ' VIP days to referrer'
  );
END;
$$ LANGUAGE plpgsql;

-- Update get_referral_stats to include VIP days info
CREATE OR REPLACE FUNCTION get_referral_stats(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_code RECORD;
  v_recent_referrals JSONB;
  v_earnings_summary JSONB;
  v_vip_days_earned INTEGER;
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
  
  -- Get earnings summary with VIP days
  SELECT 
    jsonb_build_object(
      'pending', COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0),
      'processed', COALESCE(SUM(CASE WHEN status = 'processed' THEN amount ELSE 0 END), 0),
      'total', COALESCE(SUM(amount), 0),
      'vip_days_earned', COALESCE(SUM((metadata->>'vip_days')::INTEGER), 0)
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
    'earnings_summary', v_earnings_summary,
    'reward_rules', jsonb_build_object(
      'invitee_bonus_days', 7,
      'referrer_bonus_days', 30,
      'activation_criteria', 'First subscription or trade'
    )
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION grant_vip_days IS 'Grants VIP Pro days to a user, extending or activating subscription';
COMMENT ON FUNCTION process_invitee_vip_bonus IS 'Immediately grants VIP days to a new user who registered via referral';