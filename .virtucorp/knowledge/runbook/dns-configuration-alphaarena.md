# dns-configuration-alphaarena

_Saved: 2026-05-15_

# DNS Configuration for AlphaArena

## Domain Registration
- Registrar: Google Domains
- Nameservers: ns-cloud-a1/a2/a3/a4.googledomains.com

## Correct DNS Configuration

| Type | Host | Value |
|------|------|-------|
| A | @ | 76.76.21.21 (Vercel) |
| CNAME | www | cname.vercel-dns.com |

## Vercel Project
- Project ID: prj_QfKnQpqG5OcARmx6TLUTUWiOkVc6
- Aliases: alphaarena.app, alphaarena.com, www.alphaarena.com

## Issue History (2026-05-15)
DNS was pointing to Squarespace (198.185.159.x) causing production outage.
Required manual DNS fix in Google Domains console.

## Verification Commands
```bash
# Check DNS
dig alphaarena.app +short
# Should return: 76.76.21.21

# Check HTTP server
curl -sI https://alphaarena.app | grep -i server
# Should return: Vercel
```