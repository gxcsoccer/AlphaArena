# production-under-construction-fix

_Saved: 2026-05-16_

# Production "Under Construction" Page Fix

## Problem
Production URL `https://alphaarena.app` displays "We are under construction" placeholder instead of the AlphaArena application.

## Root Cause
DNS configuration issue - NOT a code bug.

- Domain `alphaarena.app` points to Squarespace placeholder instead of Vercel
- Nameservers configured as Google Domains instead of Vercel DNS
- Vercel shows "This Domain is not configured properly"

## Solution (Manual Action Required)

### Option A: Add A Record (Quick, 5-30 min)
In domain registrar control panel:
```
Type: A
Name: @
Value: 76.76.21.21
TTL: 3600
```

### Option B: Change Nameservers (Long-term, 24-48h)
```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

## Verification
After DNS update, run smoke test:
```bash
vc_ui_accept_run file=smoke-test.yaml url_override=https://alphaarena.app
```

## Related Files
- `/docs/deployment/DNS_CONFIGURATION.md` - Detailed DNS configuration guide
- `/DEPLOYMENT.md` - Deployment troubleshooting section
- Issue #792 - Original bug report

## Key Insight
**This is NOT a code bug.** Dev agents cannot fix this through PRs. Requires investor manual action at domain registrar.