# DNS Configuration Fix for alphaarena.app

## Problem Summary

**Production URL (alphaarena.app) shows "under construction" page instead of the AlphaArena app.**

This is NOT a code bug - it's a DNS configuration issue.

## Root Cause

The domain `alphaarena.app` is correctly configured in Vercel but has incorrect DNS nameservers:

| Expected (Vercel) | Current (Google Cloud DNS) | Status |
|-------------------|---------------------------|--------|
| ns1.vercel-dns.com | ns-cloud-a1.googledomains.com | ❌ Wrong |
| ns2.vercel-dns.com | ns-cloud-a2.googledomains.com | ❌ Wrong |

Current DNS IPs point to Squarespace servers:
- 198.185.159.145
- 198.49.23.145
- 198.185.159.144
- 198.49.23.144

These are Squarespace's parking page servers, which display "We're under construction."

## Evidence

```bash
# HTTP headers show Squarespace server
curl -I https://alphaarena.app
# server: Squarespace

# DNS lookup shows Squarespace IPs
dig alphaarena.app +short
# 198.185.159.145
# 198.49.23.145
# ...

# Vercel domain inspection confirms nameserver mismatch
vercel domains inspect alphaarena.app
# WARNING! This Domain is not configured properly.
```

## Fix Instructions

### Option A: Add A Record (Recommended - Faster)

1. Go to your domain registrar (Google Domains or wherever alphaarena.app was purchased)
2. Navigate to DNS settings
3. Add an A record:
   - **Host**: `@` (or `alphaarena.app`)
   - **Type**: A
   - **Value**: `76.76.21.21`
   - **TTL**: 3600 (or default)
4. Remove any existing A records pointing to Squarespace IPs
5. Wait 5-30 minutes for DNS propagation

### Option B: Change Nameservers (More Control)

1. Go to your domain registrar
2. Navigate to DNS settings
3. Change nameservers to:
   - **ns1.vercel-dns.com**
   - **ns2.vercel-dns.com**
4. Remove all custom DNS records
5. Wait up to 48 hours for full propagation

## Verification

After making DNS changes, verify:

```bash
# Check DNS propagation
dig alphaarena.app +short
# Should show: 76.76.21.21

# Check HTTP response
curl -I https://alphaarena.app
# Should show: server: Vercel

# Visit the site
open https://alphaarena.app
# Should show AlphaArena app, not "under construction"
```

## Why This Happened

The domain was likely:
1. Purchased through Squarespace or configured with Squarespace DNS
2. Squarespace set up their parking page as default
3. When moved to Vercel, nameservers weren't updated

## Related Files

- `.vercel/project.json` - Vercel project configuration
- `vercel.json` - Routing and build configuration
- `.env.production` - Production environment variables

## Status

- **Vercel Project**: ✅ Correctly configured
- **Vercel Deployment**: ✅ Working (preview URLs work)
- **Domain Assignment**: ✅ `alphaarena.app` assigned to `alphaarena` project
- **DNS Nameservers**: ❌ Wrong (pointing to Google/Squarespace)

---

**Last Updated**: 2026-05-15
**Related Issue**: #786