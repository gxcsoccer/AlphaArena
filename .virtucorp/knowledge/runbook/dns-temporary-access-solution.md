# dns-temporary-access-solution

_Saved: 2026-06-08_

# DNS 临时访问方案

## 问题场景
当自定义域名 DNS 配置错误（指向第三方服务商）导致应用不可访问时，可以使用 Vercel 提供的子域名作为临时访问入口。

## 解决方案

### 1. 确认 Vercel 部署正常
```bash
vercel ls --prod
```

### 2. 检查部署别名
```bash
vercel inspect <deployment-url>
```
在 Aliases 部分找到 Vercel 管理的子域名（格式：`*.vercel.app`）

### 3. 验证子域名可用
```bash
# DNS 解析
nslookup <subdomain>.vercel.app

# HTTP 测试
curl -s -o /dev/null -w "%{http_code}" --resolve <subdomain>.vercel.app:443:76.76.21.21 https://<subdomain>.vercel.app
```

### 4. 添加新子域名（可选）
```bash
vercel domains add <new-subdomain>.vercel.app
```

## AlphaArena 当前可用 URL

| URL | 状态 |
|-----|------|
| `https://alphaarena.app` | ❌ DNS 错误 |
| `https://alphaarena.xyz` | ❌ DNS 错误 |
| `https://alphaarena.com` | ❌ DNS 错误 |
| `https://alphaarena-eight.vercel.app` | ✅ 可用 |
| `https://alphaarena-gxcsoccer-s-team.vercel.app` | ✅ 可用 |

## 永久修复

需要在域名注册商修改 DNS：
- **选项 A**：添加 A 记录 `@ → 76.76.21.21`
- **选项 B**：修改 Nameservers 为 `ns1.vercel-dns.com`, `ns2.vercel-dns.com`