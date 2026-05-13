# dns-configuration-issue-diagnosis

_Saved: 2026-05-13_

# DNS 配置问题诊断指南

## 症状

- 访问网站显示 "Network Error"
- SSL 证书不匹配（证书域名与访问域名不同）
- WebSocket 连接失败

## 诊断步骤

### 1. 检查 DNS 解析

```bash
# 检查域名解析到的 IP
dig yourdomain.com +short

# 检查 Vercel 子域名解析
dig yourproject.vercel.app +short
```

### 2. 检查 SSL 证书

```bash
curl -v https://yourdomain.com 2>&1 | grep -A5 "Server certificate"
```

如果证书域名不匹配，说明 DNS 解析到了错误的服务器。

### 3. 强制使用 Vercel IP 测试

```bash
# 使用 --resolve 强制 DNS 解析到 Vercel IP
curl --resolve yourdomain.com:443:76.76.21.21 https://yourdomain.com
```

如果这样能访问，说明 Vercel 部署正常，问题在 DNS。

### 4. 检查 Vercel 域名配置

```bash
vercel domain inspect yourdomain.com
```

Vercel 会显示当前配置状态和建议的 DNS 记录。

## 常见问题

### 问题：域名指向 Squarespace/其他服务商

**原因**：域名之前在 Squarespace 等平台托管，DNS 没有更新。

**解决**：
1. 方案 A：添加 A 记录 `@ → 76.76.21.21`
2. 方案 B：修改 nameservers 为 `ns1.vercel-dns.com` / `ns2.vercel-dns.com`

### 问题：*.vercel.app 解析到错误 IP

**原因**：DNS 污染或网络劫持。

**解决**：
1. 使用自定义域名
2. 配置正确的 DNS 记录
3. 用户端可能需要使用 VPN

## 案例：Issue #780

**症状**：生产环境显示 Network Error

**诊断**：
- `alphaarena.app` DNS → Squarespace IP (198.185.159.144)
- `alphaarena.vercel.app` DNS → Meta IP (157.240.11.40)
- 强制使用 Vercel IP → HTTP 200 正常

**结论**：DNS 配置错误，非代码问题。

**解决**：用户需修改 DNS 配置。