# dns-misconfiguration-fix

_Saved: 2026-06-04_

# DNS Misconfiguration Fix

## Problem
Production domain shows parking page (Squarespace "Under Construction") instead of the actual application.

## Diagnosis Steps

1. **Check DNS resolution:**
   ```bash
   dig alphaarena.app +short
   # If returns Squarespace IPs (198.49.23.x), DNS is wrong
   # Should return Vercel IP (76.76.21.21)
   ```

2. **Check nameservers:**
   ```bash
   dig alphaarena.app NS +short
   # Should be ns1.vercel-dns.com, ns2.vercel-dns.com
   ```

3. **Verify Vercel deployment:**
   ```bash
   vercel domains inspect <domain>
   vercel ls --prod
   ```

4. **Check actual content:**
   ```bash
   curl -sI https://<domain> | head -5
   # Server should say "Vercel", not "Squarespace"
   ```

## Fix Options

### Option A (Recommended - Quick)
Add DNS records at registrar:
- A record: `@` → `76.76.21.21`
- CNAME: `www` → `cname.vercel-dns.com`

### Option B (Full DNS)
Change nameservers to:
- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

## Root Cause
Domain registered through Google Domains (sold to Squarespace) had default parking page DNS instead of proper Vercel DNS configuration.

## Date
2026-06-04

## Related Issue
#815