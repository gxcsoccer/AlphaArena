-- Fix RLS Security Vulnerability in Subscription Tables
-- CRITICAL: This migration removes user INSERT/UPDATE permissions from subscription tables
-- to prevent users from bypassing Stripe payment and directly creating subscriptions.

-- ============================================================================
-- user_subscriptions: Remove user write permissions
-- Users should ONLY be able to read their own subscriptions.
-- All writes (INSERT/UPDATE/DELETE) must go through API routes that use service_role.
-- ============================================================================

-- Drop dangerous policies that allow users to modify their subscriptions
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON user_subscriptions;

-- Add DELETE policy restriction (in case it exists, we need to remove it too)
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON user_subscriptions;

-- Keep only the read policy for users
-- "Users can view own subscriptions" policy already exists, we keep it

-- Add explicit INSERT policy for service_role only
CREATE POLICY "Only service_role can insert subscriptions"
  ON user_subscriptions FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Add explicit UPDATE policy for service_role only
CREATE POLICY "Only service_role can update subscriptions"
  ON user_subscriptions FOR UPDATE
  USING (auth.role() = 'service_role');

-- Add explicit DELETE policy for service_role only
CREATE POLICY "Only service_role can delete subscriptions"
  ON user_subscriptions FOR DELETE
  USING (auth.role() = 'service_role');

-- ============================================================================
-- subscription_history: Remove user write permissions
-- Users should not be able to modify subscription history directly.
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert own subscription history" ON subscription_history;

-- Add explicit INSERT policy for service_role only
CREATE POLICY "Only service_role can insert subscription history"
  ON subscription_history FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- feature_usage: Restrict user permissions
-- Users can read their own usage, but writes should go through API.
-- This prevents users from manipulating their usage counters.
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert own feature usage" ON feature_usage;
DROP POLICY IF EXISTS "Users can update own feature usage" ON feature_usage;
DROP POLICY IF EXISTS "Users can delete own feature usage" ON feature_usage;

-- Add explicit policies for service_role only
CREATE POLICY "Only service_role can insert feature usage"
  ON feature_usage FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only service_role can update feature usage"
  ON feature_usage FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "Only service_role can delete feature usage"
  ON feature_usage FOR DELETE
  USING (auth.role() = 'service_role');

-- ============================================================================
-- Comments documenting the security model
-- ============================================================================

COMMENT ON TABLE user_subscriptions IS 'SECURITY: Users can only READ their own subscriptions. All writes (INSERT/UPDATE/DELETE) must go through API routes using service_role key. This prevents users from bypassing Stripe payment.';
COMMENT ON TABLE subscription_history IS 'SECURITY: Users can only READ their own history. All writes are handled by system via service_role.';
COMMENT ON TABLE feature_usage IS 'SECURITY: Users can only READ their own usage. All writes are handled by system via service_role to prevent usage counter manipulation.';

-- ============================================================================
-- Verification: Log the security fix
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'RLS Security Fix Applied:';
  RAISE NOTICE '  - user_subscriptions: Removed user INSERT/UPDATE/DELETE permissions';
  RAISE NOTICE '  - subscription_history: Removed user INSERT permissions';
  RAISE NOTICE '  - feature_usage: Removed user INSERT/UPDATE/DELETE permissions';
  RAISE NOTICE 'All writes now require service_role key via API routes.';
END $$;