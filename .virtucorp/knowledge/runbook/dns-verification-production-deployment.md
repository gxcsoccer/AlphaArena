# dns-verification-production-deployment

_Saved: 2026-06-07_

# DNS Verification for Production Deployment

## Issue Pattern
When acceptance tests fail showing "Under Construction" or placeholder pages, verify DNS configuration before assuming code bugs.

## Root Cause
DNS for production domains (alphaarena.app, alphaarena.xyz) points to Squarespace IPs instead of Vercel's IP (76.76.21.21).

## Verification Steps

1. **Force DNS resolution to Vercel:**
   ```bash
   curl --resolve alphaarena-eight.vercel.app:443:76.76.21.21 https://alphaarena-eight.vercel.app/
   ```
   If this returns correct app content, deployment is working.

2. **Check actual DNS:**
   ```bash
   dig alphaarena.app @8.8.8.8 +short
   dig alphaarena-eight.vercel.app @8.8.8.8 +short
   ```
   Should return: 76.76.21.21

3. **Check nameservers:**
   ```bash
   vercel domains inspect alphaarena.app
   ```
   Intended: ns1.vercel-dns.com, ns2.vercel-dns.com
   If showing googledomains.com nameservers, DNS is controlled by Google Domains.

## Fix Instructions

Update DNS at Google Domains:
1. Go to https://domains.google.com
2. Select domain
3. DNS > Custom resource records
4. Delete A records pointing to Squarespace (198.185.159.144, etc.)
5. Add A record: @ → 76.76.21.21
6. Add A record: www → 76.76.21.21
7. Wait 5-30 min for propagation

## Test Automation Note

MidsceneJS AI agent may ignore configured URL and navigate to inferred domain. Fix test YAML to use relative navigation or explicit domain instructions.

## Related Issues
- #803 (P0 blocker in sprint.json)
- #822 (False P0 - actually DNS issue)