# alphaarena-dns-configuration-issue

_Saved: 2026-05-22_

# AlphaArena DNS Configuration Issue

## Problem
Production site `alphaarena.app` shows "Under Construction" placeholder instead of the AlphaArena app.

## Root Cause
DNS nameserver misconfiguration. The domain uses Google Domains nameservers that resolve to Squarespace IPs, not Vercel.

## Verification Commands
```bash
# Check DNS resolution
dig +short alphaarena.app
# Expected: 76.76.21.21 (Vercel)
# Actual: 198.185.159.144, 198.49.23.144, etc. (Squarespace)

# Check server header
curl -sI https://alphaarena.app | grep server
# Expected: Vercel
# Actual: Squarespace

# Check Vercel domain status
vercel domains inspect alphaarena.app
```

## Solution (Requires Investor Action)

### Option A: Add A Record (Recommended if keeping Google nameservers)
1. Log into Google Domains
2. Navigate to `alphaarena.app` → DNS
3. Add A record: `@` → `76.76.21.21`
4. Add CNAME: `www` → `cname.vercel-dns.com`

### Option B: Change Nameservers (Recommended for full Vercel management)
1. Log into Google Domains
2. Navigate to `alphaarena.app` → DNS → Nameservers
3. Change to custom nameservers:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
4. Wait for DNS propagation (minutes to 48 hours)

## Status
- **Issue**: #801
- **Labels**: `priority/p0`, `status/blocked`, `type/bug`
- **Cannot be fixed via code** - requires investor DNS configuration
- **Vercel deployment is healthy** - preview URLs work correctly

## Last Verified
2026-05-23 - DNS still pointing to Squarespace, issue unresolved.