# dns-fix-required-investor-action

_Saved: 2026-06-07_

# DNS Fix Required - Investor Action

## Problem

Production domain `alphaarena.app` shows "Under Construction" placeholder instead of the AlphaArena application.

## Root Cause

**DNS Configuration Error** - Domain nameservers point to Google Domains, but A records point to Squarespace IP addresses instead of Vercel.

### Evidence

```bash
# DNS shows Squarespace IPs (wrong)
dig alphaarena.app +short
# 198.49.23.144
# 198.185.159.145
# 198.49.23.145
# 198.185.159.144

# Should be Vercel IP: 76.76.21.21

# Nameservers point to Google Domains
dig alphaarena.app NS +short
# ns-cloud-a1.googledomains.com
# ns-cloud-a2.googledomains.com
# ...
```

### Vercel Configuration (Correct)

```bash
vercel dns list alphaarena.app
# @ A 76.76.21.21 ✅
# www A 76.76.21.21 ✅
```

Vercel DNS records are correctly configured, but they don't take effect because nameservers point to Google Domains.

## Fix Instructions for Investor

### Option A: Add A Record (Recommended - Faster)

1. Go to https://domains.google.com
2. Select `alphaarena.app`
3. Navigate to DNS → Custom resource records
4. **Delete** existing A records pointing to Squarespace IPs (198.49.23.x, 198.185.159.x)
5. **Add** new A record:
   - Host: `@`
   - Type: A
   - Value: `76.76.21.21`
   - TTL: 3600
6. Repeat for `alphaarena.xyz` if needed
7. Wait 5-30 minutes for DNS propagation

### Option B: Change Nameservers

1. Go to https://domains.google.com
2. Select `alphaarena.app`
3. Navigate to DNS settings
4. Change nameservers to:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
5. Wait 24-48 hours for full propagation

## Verification

After DNS changes:

```bash
# Check DNS propagation
dig alphaarena.app +short
# Should show: 76.76.21.21

# Check HTTP response
curl -I https://alphaarena.app
# Should show: server: Vercel

# Smoke test
npm run test:smoke
```

## Temporary Access

Before DNS fix, use Vercel preview URLs:
- https://alphaarena-eight.vercel.app
- https://alphaarena-gxcsoccer-s-team.vercel.app

## Related Issues

- #820
- #807
- #803

## Date

2026-06-07