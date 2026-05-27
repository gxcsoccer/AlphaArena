# dns-configuration-fix

_Saved: 2026-05-27_

# AlphaArena DNS Configuration Fix

## Problem
When `alphaarena.app` shows a Squarespace "Under Construction" page instead of the AlphaArena application.

## Root Cause
DNS is pointing to Squarespace instead of Vercel.

### How to Verify
```bash
dig alphaarena.app +short
# WRONG: 198.185.159.145, 198.49.23.144 (Squarespace)
# RIGHT: 76.76.21.21 (Vercel)

vercel domains inspect alphaarena.app
# Should show nameservers as ns1.vercel-dns.com, ns2.vercel-dns.com
```

## Solution

### Option A (Recommended - Faster): Update A Record
1. Log into domain registrar (Google Domains / Squarespace)
2. Go to DNS settings for `alphaarena.app`
3. Add/Modify A record:
   - Host: `@`
   - Type: A
   - Value: `76.76.21.21`
4. Add CNAME for www:
   - Host: `www`
   - Type: CNAME
   - Value: `cname.vercel-dns.com`
5. Wait for DNS propagation (usually 5-30 minutes)

### Option B: Change Nameservers
1. Set nameservers to:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
2. Wait for propagation (24-48 hours)

## Verification
After fixing:
```bash
curl -sI https://alphaarena.app | head -5
# Should show Vercel headers, not Squarespace
```

## Related
- Vercel domain docs: https://vercel.link/domain-configuration
- Last incident: 2026-05-28 (Issue #807)