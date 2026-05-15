# p0-issue-786-dns-diagnosis-final

_Saved: 2026-05-15_

# P0 Issue #786 - DNS Diagnosis Final Report

## Issue
Production environment alphaarena.app shows "under construction" placeholder page.

## Diagnosis Date
2026-05-15 12:00 GMT+8

## Root Cause (CONFIRMED)
DNS configuration error - domain points to Squarespace instead of Vercel.

## Evidence

### DNS Resolution
```
$ dig +short alphaarena.app A
198.49.23.145
198.185.159.144
198.185.159.145
198.49.23.144
```
All IPs are Squarespace IPs, NOT Vercel.

### HTTP Response
```
$ curl -sI https://alphaarena.app
server: Squarespace
content-type: text/html;charset=utf-8
```

### Vercel Deployment Status
- ✅ Normal - continuous deployments to Production
- Latest deployment: 2026-05-15T04:00:15Z
- Project ID: prj_QfKnQpqG5OcARmx6TLUTUWiOkVc6

## Correct Configuration Needed
| Domain | Current | Should Be |
|--------|---------|-----------|
| alphaarena.app | Squarespace IPs | 76.76.21.21 (Vercel) |
| www.alphaarena.app | ext-sq.squarespace.com | cname.vercel-dns.com |

## Resolution Steps (INVESTOR ACTION REQUIRED)
1. Go to Google Domains → DNS settings for alphaarena.app
2. Delete all A records pointing to Squarespace IPs
3. Add A record: @ → 76.76.21.21
4. Modify CNAME: www → cname.vercel-dns.com

## Dev Cannot Fix This
- DNS configuration requires domain registrar access
- This is NOT a code bug
- Issue labeled: `status/needs-investor-action`

## Related Knowledge
- dns-configuration-alphaarena-app.md
- production-dns-diagnosis.md
- correct-alphaarena-vercel-url.md

## History
This same issue has occurred multiple times:
- Issue #743, #742, #745, #785, #786
- Each time, root cause is DNS misconfiguration
- Each time, requires investor to fix DNS