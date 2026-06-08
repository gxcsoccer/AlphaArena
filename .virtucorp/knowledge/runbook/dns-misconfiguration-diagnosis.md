# dns-misconfiguration-diagnosis

_Saved: 2026-06-08_

# DNS 配置错误诊断流程

## 问题症状
- 域名访问显示 Squarespace "Under Construction" 页面
- Vercel 部署正常，但自定义域名无法访问

## 诊断步骤

### 1. 检查 HTTP 响应
```bash
curl -sI https://yourdomain.app
# 查看 Server 头，如果是 Squarespace 说明 DNS 指向错误
```

### 2. 检查 DNS 记录
```bash
dig +short yourdomain.app A
dig +short www.yourdomain.app CNAME
```

### 3. 检查 Vercel 域名配置
```bash
vercel domains inspect yourdomain.app
```

### 4. 验证 Vercel 部署是否正常
```bash
# 直接访问 Vercel 部署 URL
curl -sI https://your-project-hash.vercel.app
```

## 常见问题

### DNS 指向 Squarespace
- **原因**: 域名之前在 Squarespace 注册，DNS 记录未更新
- **修复**: 在域名注册商修改 DNS 记录指向 Vercel

### Vercel 要求的 DNS 配置
- A 记录: `@` → `76.76.21.21`
- CNAME: `www` → `cname.vercel-dns.com`

或者使用 Vercel nameservers:
- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

## 相关 Issue
- #823: 生产环境显示维护占位页 (2026-06-08)