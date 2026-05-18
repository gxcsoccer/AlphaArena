# dns-configuration-issue-alphaarena-app

_Saved: 2026-05-18_

# DNS Configuration Issue - alphaarena.app

## Problem
Production site (alphaarena.app) shows Squarespace "Under Construction" page instead of the AlphaArena app.

## Root Cause
DNS nameservers pointing to Google/Squarespace instead of Vercel:

| Expected (Vercel) | Current (Wrong) |
|-------------------|-----------------|
| ns1.vercel-dns.com | ns-cloud-a1.googledomains.com |
| ns2.vercel-dns.com | ns-cloud-a2.googledomains.com |

DNS A records point to Squarespace IPs (198.185.159.*, 198.49.23.*) instead of Vercel IP (76.76.21.21).

## Verification Commands
```bash
# Check DNS resolution
dig alphaarena.app +short
# Should return: 76.76.21.21
# Currently returns: 198.185.159.145, 198.49.23.145, etc.

# Check nameservers
dig alphaarena.app NS +short
# Should return: ns1.vercel-dns.com, ns2.vercel-dns.com
# Currently returns: ns-cloud-a*.googledomains.com

# Verify Vercel domain status
vercel domains inspect alphaarena.app
# Shows: WARNING! This Domain is not configured properly.
```

## Fix Options

### Option A: Add A Record (Recommended - 5-30 min propagation)
1. Login to domain registrar (Google Domains or Squarespace)
2. Go to DNS settings for alphaarena.app
3. Add/Update A record:
   - Host: `@` (or `alphaarena.app`)
   - Type: A
   - Value: `76.76.21.21`
   - TTL: 3600
4. Remove any A records pointing to Squarespace IPs
5. Wait 5-30 minutes for DNS propagation

### Option B: Change Nameservers (24-48 hour propagation)
1. Login to domain registrar
2. Change nameservers to:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
3. Wait 24-48 hours for full propagation

## Status
- Vercel project: ✅ Correctly configured
- Vercel deployments: ✅ Working (preview URLs work)
- Domain assignment: ✅ alphaarena.app assigned to project
- DNS configuration: ❌ Requires manual fix by domain owner

## Related Issues
- Issue #790
- Issue #786
- Issue #795 (this P0)
- PR #787 (DNS fix guide)
- PR #791 (DNS configuration docs)

## Important
This is NOT a code bug. It requires manual intervention by the domain owner (investor) to update DNS settings at their domain registrar.