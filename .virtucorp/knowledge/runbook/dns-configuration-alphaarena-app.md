# dns-configuration-alphaarena-app

_Saved: 2026-06-08_

# DNS Configuration for alphaarena.app

## Issue
Production environment (alphaarena.app) shows Squarespace parking page instead of Vercel deployment.

## Root Cause
DNS records at Google Domains point to Squarespace IPs instead of Vercel.

## Current DNS State (as of 2026-06-08)
```
alphaarena.app → 198.49.23.144/145, 198.185.159.144/145 (Squarespace)
Nameservers: ns-cloud-a*.googledomains.com
```

## Expected DNS State
```
alphaarena.app → 76.76.21.21 (Vercel)
www.alphaarena.app → CNAME cname.vercel-dns.com
```

## Fix Steps (Requires Domain Owner Access)
1. Log into https://domains.google.com
2. Navigate to alphaarena.app → DNS → Custom resource records
3. Delete all A records pointing to Squarespace IPs
4. Add A record: Host `@`, Value `76.76.21.21`
5. Add CNAME: Host `www`, Value `cname.vercel-dns.com`
6. Wait 5-30 min for DNS propagation

## Verification
```bash
# Check DNS resolution
dig alphaarena.app +short
# Should return: 76.76.21.21

# Check HTTP response
curl -sI https://alphaarena.app | grep -i server
# Should NOT show "Squarespace"
```

## Related Issues
- Issue #823: [P0] 生产环境显示维护占位页而非实际应用

## Notes
- This is NOT a code fix - requires manual DNS configuration
- Vercel deployment is healthy and correctly configured
- Only domain owner can update DNS records at registrar