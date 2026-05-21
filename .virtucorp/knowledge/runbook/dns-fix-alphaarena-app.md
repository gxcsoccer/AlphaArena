# dns-fix-alphaarena-app

_Saved: 2026-05-21_

# DNS Fix for alphaarena.app

## Problem
Production site shows "Under Construction" page from Squarespace instead of AlphaArena app.

## Root Cause
DNS is pointing to Squarespace IPs instead of Vercel.

## Diagnosis Commands
```bash
# Check current DNS
dig alphaarena.app +short
# Expected: 76.76.21.21
# Current (wrong): 198.49.23.144, 198.185.159.144

# Check nameservers
dig ns alphaarena.app +short
# Expected: ns1.vercel-dns.com, ns2.vercel-dns.com
# Current (wrong): ns-cloud-a*.googledomains.com
```

## Solution
**Manual action required at domain registrar**:

### Option A - Add A Record (recommended, 5-30 min propagation)
```
Type: A
Name: @
Value: 76.76.21.21
TTL: 3600
```

### Option B - Change Nameservers (24-48 hour propagation)
```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

## Verification
After DNS change, run smoke test against https://alphaarena.app

## Related Issues
- Issue #800
- Issue #790 (same issue reported earlier)

## Status
- 2026-05-22: Diagnosed, waiting for investor DNS change