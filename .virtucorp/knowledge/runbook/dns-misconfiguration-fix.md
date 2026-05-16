# dns-misconfiguration-fix

_Saved: 2026-05-16_

# DNS Misconfiguration Fix - alphaarena.app

## Issue
Production site shows "Under Construction" placeholder instead of the app.

## Diagnosis Steps
1. Check if DNS resolves to Vercel: `curl -s -I https://alphaarena.app` → look for `server: Vercel`
2. If `server: Squarespace`, DNS is misconfigured
3. Check nameservers: `vercel domain inspect alphaarena.app`
4. Look for `✘` in the nameserver comparison

## Root Cause
Domain registered with Google Domains (now Squarespace) but nameservers never updated to Vercel.

## Solution
1. Log into Squarespace Domains: https://domains.squarespace.com
2. Navigate to alphaarena.app → DNS Settings
3. Either:
   - **Option A (Recommended):** Change nameservers to `ns1.vercel-dns.com`, `ns2.vercel-dns.com`
   - **Option B:** Update A records to `76.76.21.21`

## Prevention
After any domain transfer or new domain setup, verify:
1. Nameservers point to Vercel (or A records point to 76.76.21.21)
2. Wait for DNS propagation
3. Run smoke test against production URL

## Related Issue
#789