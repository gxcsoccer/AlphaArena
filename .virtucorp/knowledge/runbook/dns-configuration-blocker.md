# dns-configuration-blocker

_Saved: 2026-06-08_

# DNS Configuration Blocker

## Issue
Production environment (alphaarena.app, alphaarena.xyz) shows Squarespace parking page instead of Vercel app.

## Root Cause
DNS A records point to Squarespace (198.185.159.144/145) instead of Vercel (76.76.21.21).

## Fix Required (Investor Only)
1. Go to https://domains.google.com/registrar/alphaarena.app/dns
2. Delete existing A records (Squarespace IPs)
3. Add A record: `@` → `76.76.21.21`
4. Add CNAME: `www` → `cname.vercel-dns.com`
5. Repeat for alphaarena.xyz

## Status
- Issue #823
- Labels: `priority/p0`, `needs-investor-action`, `blocked/dns-config`
- Dev CANNOT fix this - requires domain owner action

## Verification
```bash
dig alphaarena.app A +short
# Should return: 76.76.21.21

curl -sI https://alphaarena.app | grep -i server
# Should show Vercel, not Squarespace
```

## Last Updated
2026-06-08 - Escalated to investor after 10 failed attempts by team