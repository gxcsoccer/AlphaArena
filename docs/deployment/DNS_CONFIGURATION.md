# DNS 配置指南

## 问题背景

当域名 DNS 指向错误的服务器时，用户会看到占位页而非应用。本文档说明如何正确配置 AlphaArena 域名的 DNS。

## 当前域名配置

AlphaArena 使用以下域名：
- **主域名**: alphaarena.app
- **备用域名**: alphaarena.com
- **www 子域名**: www.alphaarena.com

## Vercel 域名配置要求

### 方案 A：添加 A 记录（推荐，快速生效）

在域名 Registrar（如 Google Domains、Squarespace）控制面板添加：

```
类型: A
名称: @ (或留空，表示根域名)
值: 76.76.21.21
TTL: 建议 3600（1小时）或更低
```

**生效时间**: 5-30 分钟

### 方案 B：更改 Nameservers（长期方案）

将域名 nameservers 改为 Vercel 的 nameservers：

```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

**生效时间**: 24-48 小时（DNS propagation）

## 验证 DNS 配置

### 1. 检查 DNS 解析

```bash
# 检查 alphaarena.app 解析到的 IP
dig alphaarena.app +short

# 应返回 Vercel IP：76.76.21.21
# 如果返回 198.49.23.* 或 198.185.159.*，则指向 Squarespace（错误）
```

### 2. 检查 Nameservers

```bash
# 检查 nameservers
dig alphaarena.app NS +short

# 应返回：
# ns1.vercel-dns.com
# ns2.vercel-dns.com

# 如果返回 ns-cloud-a*.googledomains.com，则为 Squarespace nameservers
```

### 3. Vercel Dashboard 验证

在 Vercel Dashboard → Domains 中检查域名状态：
- ✅ 绿色对勾：DNS 配置正确
- ⚠️ 警告图标：DNS 配置不正确，需要修复

## 常见问题

### Q: 为什么页面显示 "We're under construction"？

A: 这是 Squarespace 的占位页。当域名 DNS 指向 Squarespace 而非 Vercel 时，用户会看到此页面。

### Q: 如何判断是 DNS 问题还是 Vercel 问题？

A: 
1. 直接访问 Vercel 部署 URL（如 `https://alphaarena-xxx.vercel.app`）
2. 如果 Vercel URL 正常显示应用，但自定义域名显示占位页 → DNS 问题
3. 如果 Vercel URL 也显示错误 → Vercel 部署问题

### Q: 我更新了 DNS，为什么还没生效？

A: DNS propagation 需要 5-30 分钟（A 记录）或 24-48 小时（Nameservers）。可以使用以下工具检查：
- https://dnschecker.org
- https://whatsmydns.net

### Q: 如何在 Google Domains/Squarespace 更改 DNS？

A: 
1. 登录域名 Registrar 控制面板
2. 找到 alphaarena.app 域名
3. 进入 DNS 设置或 Nameservers 设置
4. 添加 A 记录或更改 Nameservers
5. 保存并等待生效

## 参考链接

- [Vercel Domains Documentation](https://vercel.com/docs/projects/domains)
- [Vercel DNS Quick Start](https://vercel.com/docs/projects/domains/add-a-domain)

## 历史问题记录

### Issue #790 (2026-05-16)

**问题描述**: 生产环境显示 Squarespace 占位页而非 AlphaArena 应用

**根本原因**: DNS 配置错误，域名指向 Squarespace IP 而非 Vercel IP

**解决方案**: 添加 A 记录 `@ → 76.76.21.21`

**状态**: 等待投资者更新 DNS 配置