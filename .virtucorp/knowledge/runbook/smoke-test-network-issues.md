# smoke-test-network-issues

_Saved: 2026-05-11_

# Smoke Test Network Connectivity Issues

## Problem
Smoke tests run from China may fail due to network connectivity issues with Vercel domains (alphaarena.vercel.app).

## Symptoms
- Test sees UI from a different website (e.g., Blackrose instead of AlphaArena)
- Navigation items mismatch (e.g., "LIVE, LEADERBOARD, MODELS" instead of "行情, Dashboard")
- Test navigates away to external sites unexpectedly

## Root Cause
DNS resolution issues or cached content from different sites when accessing Vercel domains from China.

## Solutions
1. Run smoke tests with VPN/proxy to bypass Chinese network issues
2. Add explicit URL verification at test start to detect wrong site
3. Use `--clear-browser-state` flag in Midscene to prevent caching
4. Consider using a dedicated test environment server instead of production

## Verification
To verify code is working locally:
```bash
npm run build
npm run preview
vc_ui_accept --url http://localhost:3001 --tasks '[{"name": "Verify Language Switcher", "flow": [{"aiAssert": "Language switcher is visible"}]}]'
```