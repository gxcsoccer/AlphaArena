# dns-configuration-fix-required-investor-action

_Saved: 2026-06-05_

# DNS 配置修复 - 需要投资者操作

## 问题描述

alphaarena.app（以及 alphaarena.com, alphaarena.xyz）显示 SquareSpace "Under Construction" 占位页，而非 AlphaArena 应用。

## 根本原因

**DNS 配置错误** - 域名指向 SquareSpace 的服务器，而非 Vercel。

- 当前 Nameservers: `ns-cloud-*.googledomains.com` (Google Domains)
- 期望 Nameservers: `ns1.vercel-dns.com`, `ns2.vercel-dns.com` (Vercel)

- 当前 A 记录: 198.185.159.144/145, 198.49.23.144/145 (SquareSpace)
- 期望 A 记录: 76.76.21.21 (Vercel)

## Dev 无法通过代码修复

此问题需要域名所有者在域名注册商（Google Domains）控制台操作。

## 修复方案

### 方案 A：添加 A 记录（最快，5-30 分钟生效）

在 Google Domains 控制台添加：
- 类型: A
- 名称: `@`
- 值: `76.76.21.21`
- TTL: 3600

### 方案 B：更改 Nameservers（推荐）

在 Google Domains 控制台更改 nameservers 为：
- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

## 验证

```bash
npm run dns:check
# 或
nslookup alphaarena.app
# 应返回 76.76.21.21 或 Vercel IP
```

## 相关文件

- `docs/DNS_FIX_GUIDE.md` - 详细修复指南
- `scripts/check-dns.sh` - DNS 验证脚本
- Issue #803, #818 - 历史诊断记录

## 相关 Issues

- #803, #805, #809, #811, #812, #813, #814, #815, #816, #817, #818

**此问题已被诊断多次，需要 investor 操作 DNS 配置才能解决。**