# production-dns-diagnosis

_Saved: 2026-04-27_

# Production DNS Diagnosis

## Issue Pattern
When production pages show "under construction" placeholder instead of app content, it's typically a DNS configuration issue, not a code bug.

## Diagnosis Steps

1. **Check code locally**:
   - Verify page component exists and is complete
   - Check route configuration in App.tsx
   - Run `npm run dev` to verify locally

2. **Check Vercel deployment**:
   - Run `vercel ls` to see deployment history
   - Run `vercel inspect <url>` to check deployment status and aliases
   - Verify build logs show correct chunk generation

3. **Check DNS resolution**:
   - Run `nslookup alphaarena.app 8.8.8.8` (Google DNS)
   - Run `nslookup alphaarena.app 1.1.1.1` (Cloudflare DNS)
   - Compare with local DNS: `nslookup alphaarena.app`

4. **Expected IPs for Vercel**:
   - Vercel IP: `76.76.21.21` or similar Vercel CDN IPs
   - Wrong IPs indicate DNS misconfiguration

## Common Causes

### 1. Custom Domain DNS Misconfiguration
- Domain points to old hosting provider (Squarespace, GoDaddy)
- Nameservers not updated to Vercel DNS
- Symptoms: Domain shows hosting provider's placeholder page

### 2. VPN/Network DNS Interception
- Tailscale or corporate VPN intercepts DNS
- Vercel domains resolve to wrong IPs (e.g., Facebook IPs)
- Symptoms: Cannot access Vercel deployments from affected network

## Resolution

### For Domain Owner (Investor Action Required)
1. At domain registrar, add A record:
   ```
   A alphaarena.app → 76.76.21.21
   ```
2. Or change nameservers to Vercel:
   ```
   ns1.vercel-dns.com
   ns2.vercel-dns.com
   ```

### For Developer
- This is NOT a code fix
- Close the issue with DNS diagnosis explanation
- Document in knowledge base

## History
- Issue #743: Production shows construction placeholder - DNS issue
- Issue #742: /strategies page shows placeholder - DNS issue  
- Issue #745: /strategies page shows placeholder - DNS issue (same as #742)