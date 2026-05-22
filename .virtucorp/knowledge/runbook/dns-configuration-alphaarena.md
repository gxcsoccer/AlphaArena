# dns-configuration-alphaarena

_Saved: 2026-05-22_

# DNS Configuration for AlphaArena

## Domain: alphaarena.app

### Correct DNS Settings (Vercel)

| Record | Type | Value |
|--------|------|-------|
| `alphaarena.app` | A | `76.76.21.21` |
| `www.alphaarena.app` | CNAME | `cname.vercel-dns.com` |

### Alternative: Nameservers

- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

## Troubleshooting

### Symptoms
- Site shows "Under Construction" placeholder
- `curl https://alphaarena.app` returns Squarespace HTML

### Diagnosis Commands
```bash
# Check DNS resolution
dig alphaarena.app

# Check what's serving
curl -I https://alphaarena.app

# Verify Vercel domain config
vercel domains inspect alphaarena.app
```

### Root Cause
If DNS points to Squarespace IPs (198.49.23.144, etc.), the domain registrar's DNS needs to be updated to point to Vercel.

## Related Issue
- #801: P0 DNS misconfiguration causing production outage