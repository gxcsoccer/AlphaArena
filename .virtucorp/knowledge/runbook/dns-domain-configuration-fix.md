# dns-domain-configuration-fix

_Saved: 2026-05-27_

# DNS Domain Configuration Fix for alphaarena.app

## Issue
Production site showing "Under Construction" placeholder from Squarespace instead of AlphaArena app.

## Root Cause
DNS records are pointing to Squarespace's parking servers instead of Vercel's servers.

## Diagnosis
```bash
# Check current DNS - should show Squarespace IPs (wrong)
dig alphaarena.app +short
# Returns: 198.49.23.145, 198.49.23.144, 198.185.159.145, 198.185.159.144

# Check Vercel domain status
vercel domains inspect alphaarena.app
# Shows: WARNING! Domain is not configured properly
# Required: A alphaarena.app 76.76.21.21
```

## Fix (Manual - requires domain registrar access)

1. **Go to Squarespace Domains** (https://domains.squarespace.com)
   - Login with the account that owns alphaarena.app
   - Navigate to the domain settings

2. **Update DNS Records:**
   - For apex domain (`@` or `alphaarena.app`):
     - Add/Update A record: `76.76.21.21` (Vercel's IP)
   - For www subdomain:
     - Change CNAME from `ext-sq.squarespace.com` to `cname.vercel-dns.com`

3. **Wait for DNS propagation** (5-30 minutes)

4. **Verify fix:**
   ```bash
   dig alphaarena.app +short
   # Should return: 76.76.21.21
   
   curl -s https://alphaarena.app | grep -E '(AlphaArena|免费注册)'
   # Should show AlphaArena content
   ```

## Why This Happened
Google Domains was sold to Squarespace in 2023. When domains are migrated, Squarespace may apply default parking page DNS records. The domain needs to be reconfigured to point to Vercel.

## Related
- Vercel docs: https://vercel.com/docs/projects/domains
- Issue #806