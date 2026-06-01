# p0-dns-issue-813

_Saved: 2026-06-01_

# Issue #813: DNS Configuration Issue

## Status: BLOCKED - Requires Investor Action

**This is NOT a code bug.** Dev team cannot fix this through code changes.

## Problem

Three production domains incorrectly point to Squarespace parking page:
- alphaarena.app → Squarespace IP (should be Vercel)
- alphaarena.com → misconfigured (should be Vercel)
- alphaarena.xyz → Squarespace IP (should be Vercel)

## Diagnosis (Completed by Dev)

- ✅ Vercel deployments: All working (20+ active)
- ✅ Project configuration: Correct
- ❌ DNS A records: Pointing to Squarespace (198.49.23.145, etc.)
- ❌ Nameservers: Still on Google Domains/GoDaddy, not Vercel

## Solution Required (Investor Action)

### Google Domains (alphaarena.app, alphaarena.xyz)
1. Login to domains.google.com
2. Modify A record `@` → `76.76.21.21`
3. Modify CNAME `www` → `cname.vercel-dns.com`

### GoDaddy (alphaarena.com)
1. Login to godaddy.com
2. Modify A record `@` → `76.76.21.21`
3. Modify CNAME `www` → `cname.vercel-dns.com`

## Recovery Time

- DNS update: 5-30 minutes
- Global propagation: up to 48 hours

## Do NOT Spawn Dev

This issue has been attempted 10+ times. Dev cannot fix DNS configuration. The issue is correctly labeled with:
- `status/blocked`
- `needs-investor-action`
- `blocked/dns-config`

Remove `priority/p0` label if urgent dispatching should stop.

## Investor Response

After investor updates DNS, they should comment on Issue #813. Then spawn Dev or QA to verify and close.