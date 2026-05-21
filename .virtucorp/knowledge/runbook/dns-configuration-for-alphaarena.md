# dns-configuration-for-alphaarena

_Saved: 2026-05-21_

# AlphaArena DNS Configuration

## Domain Registration Info

| Domain | Registrar | Nameservers |
|--------|-----------|-------------|
| alphaarena.app | Google Domains | ns-cloud-a*.googledomains.com |
| alphaarena.com | GoDaddy | ns09/ns10.domaincontrol.com |

## Correct DNS Configuration (Vercel)

### Option A: A Records (Recommended)

```
alphaarena.app:
  @    A    76.76.21.21
  www  A    76.76.21.21

alphaarena.com:
  @    A    76.76.21.21
  www  A    76.76.21.21
```

### Option B: Nameservers

Change nameservers to:
- ns1.vercel-dns.com
- ns2.vercel-dns.com

## Vercel Project Info

- Project ID: prj_QfKnQpqG5OcARmx6TLUTUWiOkVc6
- Team: gxcsoccer-s-team
- Default URL: alphaarena-eight.vercel.app

## Troubleshooting

If site shows Squarespace placeholder:
1. Check DNS: `dig alphaarena.app +short` - should return 76.76.21.21
2. Verify Vercel deployment: `vercel inspect alphaarena.app`
3. Check domain config: `vercel domains inspect alphaarena.app`

## Incident History

- 2026-05-21: DNS records pointed to Squarespace (198.49.23.145) instead of Vercel. Fixed by updating A records.