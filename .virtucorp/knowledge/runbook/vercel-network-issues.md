# vercel-network-issues

_Saved: 2026-03-21_

# Vercel Network Connectivity Issues

## Problem
From certain network environments (especially in China), Vercel deployments may be inaccessible due to GFW or network routing issues.

## Symptoms
- `curl` requests to `*.vercel.app` URLs timeout
- Smoke tests fail with "failed to wait for network idle" errors
- `web_fetch` and `web_search` tools fail

## Workaround
1. Use local preview server for smoke tests: `npm run build && npm run preview`
2. Access production via VPN or different network
3. Use GitHub Actions CI which runs in an environment that can access Vercel

## Root Cause
This is NOT an application bug. The issue is network connectivity to Vercel's edge servers.

## Resolution
For production smoke tests:
1. Update `.virtucorp/acceptance/smoke-test.yaml` to use `http://localhost:4173`
2. Run `npm run build && npm run preview` before running smoke tests
3. Or run smoke tests from GitHub Actions CI

## Verification
- Check if Supabase APIs are working: `curl https://plnylmnckssnfpwznpwf.supabase.co/rest/v1/`
- Check if Vercel is accessible: `curl -I https://vercel.com`
- If Supabase works but Vercel doesn't, it's a network issue

## Last Updated
2026-03-21