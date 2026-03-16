-- Enable market data broadcasting via pg_cron
-- 
-- IMPORTANT: This migration sets up the infrastructure, but for real-time updates,
-- you should also configure an external cron service to call the Edge Function every 3-5 seconds.
-- 
-- Why external scheduler?
-- - pg_cron minimum interval is 1 minute
-- - Market data needs updates every 3-5 seconds for good UX
-- - External services like cron-job.org can provide sub-minute intervals
--
-- Setup Instructions:
-- 1. Go to https://cron-job.org or https://easycron.com
-- 2. Create a free account
-- 3. Add a new cron job with:
--    URL: https://plnylmnckssnfpwznpwf.supabase.co/functions/v1/fetch-market-data
--    Method: POST
--    Headers: Content-Type: application/json
--    Body: {}
--    Interval: Every 5 seconds (or as allowed by your plan)
-- 4. Enable the job

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to call the market data fetch endpoint
-- This can be called manually or via pg_cron (minute-level)
CREATE OR REPLACE FUNCTION fetch_and_broadcast_market_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Use Supabase's built-in http extension to call Edge Function
  -- Note: This requires the pg_net or http extension
  SELECT 
    CASE 
      WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'http') THEN
        (SELECT content::jsonb FROM http_post(
          'https://plnylmnckssnfpwznpwf.supabase.co/functions/v1/fetch-market-data',
          '{}'::jsonb,
          'application/json'
        ))
      ELSE
        '{"error": "http extension not available"}'::jsonb
    END INTO result;
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- Schedule a backup cron job (every minute - minimum for pg_cron)
-- This provides a fallback if external scheduler fails
SELECT cron.schedule(
  'market-data-backup',
  '* * * * *',  -- Every minute
  $$SELECT fetch_and_broadcast_market_data();$$
);

-- Log the setup
DO $$
BEGIN
  RAISE NOTICE 'Market data cron job scheduled. For real-time updates, configure external scheduler.';
END $$;