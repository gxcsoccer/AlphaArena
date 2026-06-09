# dns-squarespace-redirect-troubleshooting

_Saved: 2026-06-09_

# DNS 配置问题排查手册

## 问题症状

当用户访问 `alphaarena.app` 或其任何子路径时，页面显示：
- Squarespace 占位页（"We're under construction"）
- Squarespace 韩文定价页面（베이직、코어、어드밴스드）
- 其他非 AlphaArena 内容

## 快速诊断步骤

### 1. 检查 HTTP 响应头

```bash
curl -I https://alphaarena.app/pricing
```

如果看到 `server: Squarespace`，说明请求被路由到 Squarespace 服务器。

### 2. 检查 DNS 解析

```bash
dig alphaarena.app +short
```

**正确的响应**：`76.76.21.21` (Vercel IP)

**错误的响应**：`198.49.23.*` 或 `198.185.159.*` (Squarespace IP)

### 3. 检查 Nameservers

```bash
vercel domains inspect alphaarena.app
```

查看 Nameservers 部分：
- **预期**：`ns1.vercel-dns.com`, `ns2.vercel-dns.com`
- **错误**：`ns-cloud-a*.googledomains.com`

## 根本原因

DNS 配置错误，域名指向 Squarespace IP 而非 Vercel IP。这通常发生在：
- 域名从 Squarespace 购买但未正确配置 DNS
- Nameservers 未更新为 Vercel 的 nameservers

## 解决方案

### 方案 A（推荐，快速生效）

在域名 Registrar 添加 A 记录：

```
类型: A
名称: @ (或留空，表示根域名)
值: 76.76.21.21
TTL: 3600 (1小时)
```

预计生效时间：5-30 分钟

### 方案 B（长期方案）

更改 Nameservers 为：

```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

预计生效时间：24-48 小时

## 重要提醒

1. **这不是代码问题** - 无需修改代码或重新部署
2. **需要投资者操作** - DNS 配置需要在域名 Registrar 控制面板操作
3. **相关文档** - `docs/deployment/DNS_CONFIGURATION.md`

## 相关 Issues

以下 Issues 都是同一根本原因：
- #790, #807, #813, #814, #815, #818, #820, #823, #824

当遇到类似问题时，标记为 `blocked/dns-config` + `needs-investor-action`。