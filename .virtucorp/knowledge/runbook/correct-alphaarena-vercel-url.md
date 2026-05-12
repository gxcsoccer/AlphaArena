# correct-alphaarena-vercel-url

_Saved: 2026-05-12_

# Correct AlphaArena Vercel URL

## Issue
Smoke tests were using `https://alphaarena.vercel.app` which pointed to a different project (APL/BLACKROSE), causing all tests to fail.

## Correct URL
The AlphaArena GitHub repo homepage is: `https://alphaarena-eight.vercel.app`

## Root Cause
- `alphaarena.vercel.app` is a different Vercel project entirely
- It displays "APL v2.5", "PWR: BLACKROSE", "USER: GUEST" content
- The correct AlphaArena project URL is `alphaarena-eight.vercel.app`

## Resolution
Updated all acceptance test YAML files in `.virtucorp/acceptance/` to use the correct URL.

## Related Issue
Issue #778: Landing page missing Sign Up/Registration button (this was a false alarm - tests were running against wrong site)

## Action Required
If `alphaarena.vercel.app` is intended to be the main domain, the Vercel project configuration needs to be fixed to deploy AlphaArena to that URL instead of the current APL/BLACKROSE project.