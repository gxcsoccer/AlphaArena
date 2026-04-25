# dns-configuration-for-alphaarena

_Saved: 2026-04-25_

# DNS 配置指南 - AlphaArena 品牌域名

## 问题背景

AlphaArena 项目使用 Vercel 部署，品牌域名 `alphaarena.app` 和 `alphaarena.com` 需要正确配置 DNS才能访问。

## 当前状态

- **Vercel 项目**: `gxcsoccer-s-team/alphaarena`
- **生产部署**: 动态生成（每次部署都会创建新的 URL）
- **固定别名**: `alphaarena-eight.vercel.app`（推荐用于测试）
- **品牌域名**: `alphaarena.app`, `alphaarena.com`（DNS 未正确配置）

## DNS 配置步骤

### 方案 A - 配置 A 记录（推荐）

在域名注册商（如 GoDaddy、Google Domains）处配置：

```
类型: A记录
主机: @（或 alphaarena.app）
值: 76.76.21.21
TTL:3600（或默认）

类型: A记录
主机: @（或 alphaarena.com）
值: 76.76.21.21
TTL: 3600（或默认）

类型: CNAME
主机: www
值: cname.vercel-dns.com
```

### 方案 B - 更换 Nameservers

将域名的 nameservers 更改为 Vercel 提供的：

```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

**注意**: 更换 nameservers 后，需要等待 DNS 传播（通常 24-48 小时）。

## 验证 DNS 配置

### 使用 Vercel CLI

```bash
vercel domains inspect alphaarena.app
```

正确的配置应该显示：
```
Nameservers
  Intended Nameservers    Current Nameservers
  ns1.vercel-dns.com      ns1.vercel-dns.com    ✓
  ns2.vercel-dns.com      ns2.vercel-dns.com    ✓
```

### 使用 dig 命令

```bash
dig alphaarena.app
```

正确的解析应该显示：
```
ANSWER SECTION:
alphaarena.app. 3600 IN A 76.76.21.21
```

## 测试 URL

在 DNS 未正确配置期间，使用以下 URL 进行测试：

- **生产部署别名**: `https://alphaarena-eight.vercel.app`
- **最新部署**: 查看最新部署 URL（`vercel ls --prod`）

## 常见问题

### Q: 为什么访问 `alphaarena.app` 显示 "under construction" 页面？

A: DNS 配置错误。域名指向了域名注册商的占位页（如 Squarespace），而不是 Vercel 部署。

### Q: 如何确认问题是否解决？

A: 配置 DNS 后，等待传播完成，然后访问 `https://alphaarena.app`。应该显示 AlphaArena 的 Landing Page，而不是占位页。

### Q: DNS 传播需要多久？

A: 通常 5分钟到 48 小时，取决于 DNS 记录的 TTL 和DNS 服务商。

## 相关资源

- Vercel DNS 配置文档: https://vercel.com/docs/projects/domains
- 之前的相关 issue: #739, #742
- 提交记录: de6f5b1e（详细说明了 DNS 配置问题）

---

最后更新: 2026-04-26
作者: Dev Agent