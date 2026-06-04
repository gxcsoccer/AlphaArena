# vercel-dns-troubleshooting

_Saved: 2026-06-04_

# Vercel DNS Troubleshooting

## Symptom: Domain shows placeholder page instead of application

### Root Cause Indicators
1. `curl -sI https://yourdomain.app` shows `server: Squarespace` or another host (not Vercel)
2. `dig yourdomain.app +short` returns non-Vercel IPs (Vercel uses 76.76.21.21 for A records)
3. `vercel domains inspect yourdomain.app` shows nameserver mismatch (Intended ≠ Current)

### Diagnosis Commands
```bash
# Check what server is responding
curl -sI https://yourdomain.app | grep -i server

# Check DNS records
dig yourdomain.app +short

# Check Vercel domain configuration
vercel domains inspect yourdomain.app

# Check Vercel deployments are working
vercel ls
```

### Fix Options

**Option A: Add A/CNAME Records (Recommended)**
At your DNS provider, add:
| Type | Name | Value |
|------|------|-------|
| A | @ | 76.76.21.21 |
| CNAME | www | cname.vercel-dns.com |

**Option B: Change Nameservers**
Change to Vercel nameservers:
- ns1.vercel-dns.com
- ns2.vercel-dns.com

### Important Notes
- DNS changes can take up to 48 hours to propagate (usually 5-30 minutes)
- Vercel deployments continue to work even with misconfigured DNS
- The deployment URL (*.vercel.app) will always work regardless of custom domain DNS