# dns-misconfiguration-troubleshooting

_Saved: 2026-05-16_

# DNS Misconfiguration Troubleshooting

## Issue
Production site showing "Under Construction" or placeholder page instead of the actual application.

## Root Cause Analysis Steps

1. **Check what the production site serves**:
   ```bash
   curl -s https://alphaarena.app | head -50
   ```
   If it returns Squarespace, Wix, or other hosting provider content, DNS is pointing to wrong provider.

2. **Check DNS resolution**:
   ```bash
   dig alphaarena.app +short
   ```
   - Vercel IPs: `76.76.21.21`
   - Squarespace IPs: `198.185.159.144`, `198.49.23.145`, etc.
   - Cloudflare IPs: `104.x.x.x`

3. **Check nameservers**:
   ```bash
   vercel domains inspect alphaarena.app
   ```
   - Intended nameservers for Vercel: `ns1.vercel-dns.com`, `ns2.vercel-dns.com`
   - If showing Google Domains nameservers (`ns-cloud-a*.googledomains.com`), DNS needs update

4. **Verify Vercel deployment status**:
   ```bash
   vercel ls --prod
   ```
   Check if deployments are "Ready" and have correct aliases configured.

5. **Test local build**:
   ```bash
   npm run build:client
   npm run preview
   curl -s http://localhost:3001 | head -50
   ```
   Verify the application works locally.

## Fix Options

### Option A (Quick Fix - Recommended)
At your DNS provider (Google Domains, Cloudflare, etc.), add A record:
- Host: `@`
- Type: A
- Value: `76.76.21.21` (Vercel's IP)
- TTL: 3600 (or default)

### Option B (Complete Fix)
Change domain nameservers to Vercel's:
- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

## DNS Propagation
After updating DNS:
- Wait 5-60 minutes for propagation
- Use `dig alphaarena.app +short` to verify new IPs
- Test with `curl https://alphaarena.app`

## Related Issue
Issue #789: Production site showing Under Construction placeholder (resolved as DNS misconfiguration)