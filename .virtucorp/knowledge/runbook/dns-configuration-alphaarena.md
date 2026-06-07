# dns-configuration-alphaarena

_Saved: 2026-06-07_

# DNS Configuration for alphaarena.app

## Issue History
- Issue #820: Production showed "Under Construction" placeholder
- Issue #803: Same issue (DNS pointing to Squarespace)

## Root Cause
Domain registered with Google Domains, but DNS was pointing to Squarespace instead of Vercel.

## Diagnosis Steps
```bash
# Run the DNS check script
bash scripts/check-dns.sh

# Check DNS resolution
dig alphaarena.app +short

# Check Vercel deployment
vercel project ls
vercel domains inspect alphaarena.app
vercel dns list alphaarena.app
```

## Solution
Requires manual intervention at Google Domains:

**Option A (Recommended - Update A Records):**
1. Go to Google Domains → alphaarena.app → DNS
2. Update A record `@` → `76.76.21.21`
3. Update A record `www` → `76.76.21.21`

**Option B (Change Nameservers):**
1. Go to Google Domains → alphaarena.app → Name servers
2. Switch to custom name servers
3. Add: `ns1.vercel-dns.com` and `ns2.vercel-dns.com`

## Vercel Configuration (Already Correct)
- Project: `alphaarena` (prj_QfKnQpqG5OcARmx6TLUTUWiOkVc6)
- Team: `gxcsoccer-s-team`
- Production URL: `alphaarena-gxcsoccer-s-team.vercel.app`
- DNS records in Vercel: A records correctly pointing to `76.76.21.21`

## Cannot Be Fixed via Code
This is a DNS configuration issue that requires the domain owner to manually update DNS settings at the registrar (Google Domains). No code changes can fix this.