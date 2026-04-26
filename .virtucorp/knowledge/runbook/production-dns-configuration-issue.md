# production-dns-configuration-issue

_Saved: 2026-04-26_

# Production DNS Configuration Issue - AlphaArena

## Problem
Production URL `https://alphaarena.app` displays Squarespace "Coming Soon" page instead of the AlphaArena application.

## Root Cause
Domain DNS is configured with Google Domains Nameservers, not Vercel's:

```
Intended Nameservers    Current Nameservers                   
ns1.vercel-dns.com      ns-cloud-a1.googledomains.com    ✘    
ns2.vercel-dns.com      ns-cloud-a2.googledomains.com    ✘    
```

## Solution (Requires Investor Action)

**Option A (Recommended)**: Set A record at DNS provider:
```
A alphaarena.app 76.76.21.21
```

**Option B**: Change Nameservers to Vercel:
- ns1.vercel-dns.com
- ns2.vercel-dns.com

## Verification
Run: `vercel domains inspect alphaarena.app`

## Related
- Issue #743: P0 bug - Production shows construction placeholder
- Vercel project: gxcsoccer-s-team/alphaarena