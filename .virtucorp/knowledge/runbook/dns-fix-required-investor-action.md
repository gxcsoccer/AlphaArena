# dns-fix-required-investor-action

_Saved: 2026-06-07_

# DNS Fix Required - Investor Action Needed

## Problem

The domain `alphaarena.app` is showing "Under Construction" placeholder instead of the AlphaArena application.

## Root Cause

**DNS configuration error** - NOT a code bug.

The domain's A records point to Squarespace servers instead of Vercel:
- **Current**: 198.185.159.145, 198.49.23.145 (Squarespace)
- **Expected**: 76.76.21.21 (Vercel)

## Evidence

```bash
$ dig alphaarena.app +short
198.185.159.145  # ← Squarespace (WRONG)
198.49.23.145    # ← Squarespace (WRONG)

$ curl -sI https://alphaarena.app | grep -i server
server: Squarespace  # ← Should be "Vercel"

$ vercel domains inspect alphaarena.app
WARNING! This Domain is not configured properly.
```

## Fix Required (Investor Action)

### Option A: Update A Record at Google Domains (Recommended - Faster)

1. Login to Google Domains: https://domains.google.com
2. Select `alphaarena.app`
3. Go to DNS → Custom resource records
4. **Delete** existing A records pointing to Squarespace IPs
5. **Add** new A record:
   - Host: `@`
   - Type: `A`
   - Value: `76.76.21.21`
   - TTL: `3600` (or default)
6. Add CNAME for www:
   - Host: `www`
   - Type: `CNAME`
   - Value: `cname.vercel-dns.com`
7. Wait 5-30 minutes for DNS propagation

### Option B: Change Nameservers to Vercel (Takes Longer)

1. At Google Domains, change nameservers to:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
2. Wait up to 48 hours for propagation

## Verification

After DNS changes, run:
```bash
npm run dns:check
```

Or manually:
```bash
dig alphaarena.app +short
# Should return: 76.76.21.21

curl -sI https://alphaarena.app | grep -i server
# Should show: server: Vercel
```

## Temporary Access

Until DNS is fixed, use Vercel preview URLs:
- https://alphaarena-eight.vercel.app
- https://alphaarena-gxcsoccer-s-team.vercel.app

## Timeline

- **2026-05-25**: Issue first diagnosed
- **2026-06-07**: Still waiting for investor action (13+ days)
- **Issue #820**: Blocking production access

## Related

- Issue #820, #807, #803 (duplicate issues, same root cause)
- docs/deployment/DNS_FIX_GUIDE.md
- scripts/check-dns.sh