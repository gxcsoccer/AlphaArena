# dns-misconfiguration-fix

_Saved: 2026-06-02_

# DNS Misconfiguration Fix for alphaarena.app

## Problem
Production site https://alphaarena.app shows Squarespace "Under Construction" placeholder instead of AlphaArena app.

## Root Cause
DNS is misconfigured to point to Squarespace instead of Vercel:
- A records: 198.185.159.145, 198.49.23.145 (Squarespace) instead of 76.76.21.21 (Vercel)
- CNAME for www: ext-sq.squarespace.com instead of cname.vercel-dns.com
- Nameservers: Google Domains (ns-cloud-a1.googledomains.com) instead of Vercel (ns1.vercel-dns.com)

## Fix Instructions (for domain owner)
Access Google Domains DNS management and:

**Option A - Update DNS records:**
1. Change A record for `alphaarena.app` to point to `76.76.21.21`
2. Change CNAME record for `www.alphaarena.app` to point to `cname.vercel-dns.com`

**Option B - Change nameservers:**
- Update nameservers to: `ns1.vercel-dns.com` and `ns2.vercel-dns.com`

## Verification
After DNS changes propagate (may take up to 48 hours):
- `dig alphaarena.app +short` should show 76.76.21.21
- `curl https://alphaarena.app` should show AlphaArena app (not Squarespace placeholder)
- Server header should show Vercel, not Squarespace

## Related Commands
```bash
# Check current DNS
dig alphaarena.app +short
dig alphaarena.app NS +short
dig www.alphaarena.app CNAME +short

# Check Vercel domain config
vercel domains inspect alphaarena.app

# Check production site
curl -I https://alphaarena.app
```