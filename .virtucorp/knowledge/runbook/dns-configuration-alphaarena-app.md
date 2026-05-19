# dns-configuration-alphaarena-app

_Saved: 2026-05-19_

# DNS Configuration for alphaarena.app

## Issue (May 2026)

The domain `alphaarena.app` was showing a Squarespace "Under Construction" page instead of the AlphaArena application.

## Root Cause

DNS was pointing to Squarespace instead of Vercel:
- **Current A records**: `198.185.159.144`, `198.49.23.145` (Squarespace IPs)
- **Expected A record**: `76.76.21.21` (Vercel IP)
- **Current Nameservers**: `ns-cloud-a*.googledomains.com` (Google Domains)
- **Expected Nameservers**: `ns1.vercel-dns.com`, `ns2.vercel-dns.com` (Vercel)

## Solution Options

### Option A (Recommended - Faster)
Update DNS at Google Domains:
1. Add A record: `@ → 76.76.21.21`
2. Add CNAME: `www → cname.vercel-dns.com`

### Option B
Change nameservers at Google Domains to:
- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

## Verification

After DNS update:
```bash
dig alphaarena.app +short
# Should return: 76.76.21.21

curl -I https://alphaarena.app
# Should return Vercel headers, not Squarespace
```

## Vercel Project Details

- Project ID: `prj_QfKnQpqG5OcARmx6TLUTUWiOkVc6`
- Project Name: `alphaarena`
- Team: `gxcsoccer-s-team`
- Domain is correctly linked in Vercel dashboard

## Related Issue

- GitHub Issue #796