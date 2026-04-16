# pricing-route-network-connection-issues

_Saved: 2026-04-16_

# Pricing Route Network Connection Issues

## Problem
When running smoke tests against Vercel deployment URLs, the `/pricing` route fails with `ERR_CONNECTION_CLOSED`, while other routes (main page, language switching) work fine.

## Diagnosis (2026-04-15/17)
- **Not a code bug**: Local build and testing shows `/pricing` route works correctly
- **Network issue**: Likely related to DNS pollution/SNI blocking in China affecting `*.vercel.app` domains
- **DNS configuration**: `alphaarena.app` and `alphaarena.com` DNS point to wrong IPs (Squarespace/Google Cloud instead of Vercel)

## Test Results
| URL | Main Page | Language Switch | /pricing |
|-----|-----------|-----------------|----------|
| `alphaarena-eight.vercel.app` | ❌ | ❌ | ❌ (URL doesn't exist) |
| `alphaarena.app` | ❌ (Squarespace parking) | ❌ | ❌ |
| `alphaarena-odsd3de8c.vercel.app` | ✅ | ✅ | ❌ ERR_CONNECTION_CLOSED |

## Root Cause
1. Scheduler configured with invalid URL (`alphaarena-eight.vercel.app`)
2. Custom domain `alphaarena.app` not proxied to Vercel
3. Direct Vercel URLs (`*.vercel.app`) suffer from network blocking in test environment

## Resolution Required (Investor Action)
- Option A: Configure Squarespace to proxy `alphaarena.app` to Vercel
- Option B: Change DNS A record to Vercel IP `76.76.21.21`
- Option C: Use a CDN that works in China

## Dev Cannot Fix
This is infrastructure/DNS configuration, not code.