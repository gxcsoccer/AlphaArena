# vercel-dns-configuration

_Saved: 2026-04-01_

# Vercel 域名 DNS 配置指南

## 问题症状
- 自定义域名访问出现 SSL_ERROR_SYSCALL
- Vercel 证书颁发失败
- 域名无法访问但 .vercel.app 子域名正常

## 诊断步骤

1. 检查 DNS 解析：
```bash
dig alphaarena.com +short
# 应该返回 76.76.21.21 (Vercel IP)
# 如果返回其他 IP，则 DNS 配置错误
```

2. 检查 Vercel 域名状态：
```bash
vercel domains inspect alphaarena.com
# 查看 Nameservers 部分是否有 ✘ 标记
```

3. 检查证书状态：
```bash
vercel certs ls
```

## 修复方案

### 方案 A：修改 DNS A 记录（推荐）
在域名注册商控制台添加/修改 A 记录：
- 主机记录：`@`
- 记录类型：`A`
- 记录值：`76.76.21.21`
- TTL：默认

对于 www 子域名：
- 主机记录：`www`
- 记录类型：`A`
- 记录值：`76.76.21.21`

### 方案 B：修改 Nameserver
将域名的 Nameserver 改为 Vercel：
- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

## 常见域名注册商

- GoDaddy: DNS Management → DNS Records
- Google Domains: DNS → Custom resource records
- Cloudflare: DNS → Records
- Namecheap: Domain List → Manage → Advanced DNS

## 验证修复

DNS 修改后等待传播（通常几分钟到几小时），然后验证：
```bash
# 检查 DNS 解析
dig alphaarena.com +short
# 应该返回 76.76.21.21

# 检查 HTTPS 访问
curl -Iv https://alphaarena.com
# 应该返回 200 OK
```

## 2026-04-01 事故记录

**域名**: alphaarena.com, alphaarena.app
**症状**: SSL_ERROR_SYSCALL
**根因**: DNS A 记录指向错误 IP
- alphaarena.com → 34.102.136.180 (Google Cloud) ❌
- alphaarena.app → 198.49.23.144 (Squarespace) ❌
- 应该指向 → 76.76.21.21 (Vercel) ✅

**注册商**: GoDaddy (通过 nameserver domaincontrol.com 判断)

**修复需要**: Investor 登录 GoDaddy 修改 A 记录