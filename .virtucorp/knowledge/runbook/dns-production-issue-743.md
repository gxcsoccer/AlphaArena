# dns-production-issue-743

_Saved: 2026-04-26_

# Production DNS Issue Troubleshooting (Issue #743)

## Problem
Production shows construction placeholder (Squarespace "Coming Soon") instead of actual app.

## Root Cause
DNS configuration at domain registrar pointing to wrong provider (Squarespace instead of Vercel).

## Diagnostic Steps

1. **Check DNS resolution**:
   ```bash
   dig alphaarena.app +short
   ```
   If returns Squarespace IPs (198.49.23.x, 198.185.159.x), DNS is wrong.

2. **Verify Vercel domain config**:
   ```bash
   vercel domain inspect <domain>
   ```
   Check if nameservers match Vercel's intended ones.

3. **Test HTTP response**:
   ```bash
   curl -s https://<domain>/ | head -20
   ```
   If shows "Coming Soon" or placeholder page, DNS is wrong.

4. **Verify deployment URL**:
   ```bash
   vercel inspect <deployment-url>
   ```
   Check if deployment status is "Ready" and aliases include the custom domain.

## Solution (Investor Action Required)

At domain registrar:
- **Option A (Recommended)**: Set A record `A <domain> 76.76.21.21`
- **Option B**: Change nameservers to `ns1.vercel-dns.com`, `ns2.vercel-dns.com`

## Key Insight
When production shows placeholder/coming soon page, always check DNS first before assuming code/build issues.