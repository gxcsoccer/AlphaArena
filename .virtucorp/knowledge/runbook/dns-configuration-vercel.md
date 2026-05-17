# dns-configuration-vercel

_Saved: 2026-05-17_

# DNS Configuration for Vercel Deployments

## Problem: Domain shows "Under Construction" or wrong content

### Diagnosis

1. Check DNS resolution:
   ```bash
   dig yourdomain.com +short
   ```
   - If IP is `76.76.21.21`, it's pointing to Vercel ✓
   - If IP is something else (e.g., `198.49.23.*` = Squarespace), DNS is misconfigured ✗

2. Check Vercel domain configuration:
   ```bash
   vercel domain inspect yourdomain.com
   ```
   - Look for "Nameservers" section
   - If "Current Nameservers" shows warning (✘), DNS needs reconfiguration

3. Check Vercel deployment status:
   ```bash
   vercel ls
   ```
   - Verify latest deployment shows "Ready" status

### Solution

#### Option A: Modify A Record (Recommended, fastest)

Go to your domain registrar's DNS settings:
1. Delete incorrect A records (e.g., Squarespace IPs)
2. Add new A record:
   - Host: `@`
   - Type: `A`
   - Value: `76.76.21.21`
   - TTL: Auto or 3600

#### Option B: Change Nameservers

1. Go to domain registrar settings
2. Change nameservers to:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`

### Propagation Time

- A record changes: 5-30 minutes typically
- Nameserver changes: 24-48 hours

### Common Registrars and Their Nameserver IPs

- **Squarespace**: `198.49.23.144`, `198.49.23.145`, `198.185.159.144`, `198.185.159.145`
- **Vercel**: `76.76.21.21`
- **Google Domains**: Nameservers like `ns-cloud-a*.googledomains.com`
- **GoDaddy**: Nameservers like `ns*.domaincontrol.com`

### Related Issues

- Issue #794: alphaarena.app pointing to Squarespace instead of Vercel
- Domain registrar: Google Domains (alphaarena.app), GoDaddy (alphaarena.com)
- Required action: Change A records to `76.76.21.21`