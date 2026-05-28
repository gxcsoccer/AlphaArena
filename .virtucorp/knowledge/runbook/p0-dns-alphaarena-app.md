# p0-dns-alphaarena-app

_Saved: 2026-05-28_

# P0: alphaarena.app DNS Configuration Issue

## Problem
Production site https://alphaarena.app shows "Under Construction" placeholder instead of the AlphaArena application.

## Root Cause
DNS A records at Google Domains point to Squarespace IPs instead of Vercel.

## Current DNS State (WRONG)
```
alphaarena.app → 198.49.23.144/145, 198.185.159.144/145 (Squarespace)
www.alphaarena.app → ext-sq.squarespace.com
Nameservers: ns-cloud-a*.googledomains.com
```

## Required DNS State (CORRECT)
```
alphaarena.app → 76.76.21.21 (Vercel)
www.alphaarena.app → 76.76.21.21 (Vercel)
```

## Fix Steps (INVESTOR ACTION REQUIRED)
1. Log into https://domains.google.com
2. Select `alphaarena.app`
3. Go to DNS → Custom resource records
4. Update A record: `@ → 76.76.21.21`
5. Update A record: `www → 76.76.21.21`
6. Wait 5-30 minutes for DNS propagation

## Verification
```bash
dig alphaarena.app +short
# Should return: 76.76.21.21

curl -sI https://alphaarena.app | grep -i server
# Should return: server: Vercel
```

## Temporary Access
Use Vercel URLs while DNS is broken:
- https://alphaarena-eight.vercel.app
- https://alphaarena-gxcsoccer-s-team.vercel.app

## Related Issues
- Issue #803 (closed without fix)
- Issue #809 (current P0)

## Why Dev Cannot Fix
- DNS records are at Google Domains, not Vercel
- No API access to Google Domains
- Requires domain owner credentials