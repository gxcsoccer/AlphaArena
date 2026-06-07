# dns-configuration-issue

_Saved: 2026-06-07_

# DNS Configuration Issue - alphaarena.app

## Problem

Production URL (https://alphaarena.app) shows "Under Construction" placeholder instead of AlphaArena application.

## Root Cause

DNS configuration error - domain `alphaarena.app` points to Squarespace IPs instead of Vercel.

## Evidence

```bash
# DNS resolution (wrong)
$ dig alphaarena.app +short
198.185.159.144  # Squarespace IP
198.185.159.145  # Squarespace IP
198.49.23.144    # Squarespace IP
198.49.23.145    # Squarespace IP

# Expected
76.76.21.21  # Vercel IP
```

## Diagnosis Checklist

1. Check DNS resolution: `dig alphaarena.app +short`
2. Check HTTP server: `curl -sI https://alphaarena.app | grep server` → should show "Vercel"
3. Check Vercel deployment status: `vercel ls --prod` → should show Ready
4. Check Vercel domain config: `vercel domain inspect alphaarena.app`

## Resolution

**NOT a code bug** - requires investor action at domain registrar.

### Fix Steps (for investor)

1. Login to Google Domains (https://domains.google.com)
2. Select `alphaarena.app`
3. Go to DNS → Custom resource records
4. Add A record: `@ → 76.76.21.21`
5. Wait 5-30 minutes for DNS propagation

### Verification

```bash
dig alphaarena.app +short
# Should return: 76.76.21.21

curl -sI https://alphaarena.app | grep server
# Should show: server: Vercel
```

## Related Issues

- #820, #807, #803, #786, #790 - All duplicates of the same DNS issue

## Documentation

- `docs/deployment/DNS_FIX_GUIDE.md`
- `docs/deployment/DNS_CONFIGURATION.md`

## Temporary Access

Before DNS fix, use Vercel preview URLs:
- https://alphaarena-eight.vercel.app
- https://alphaarena-gxcsoccer-s-team.vercel.app