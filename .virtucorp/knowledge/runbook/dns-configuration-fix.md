# dns-configuration-fix

_Saved: 2026-05-22_

# DNS 配置修复指南

## 问题症状
- `alphaarena.app` 显示 Squarespace "Under Construction" 页面
- Vercel 部署正常，但域名解析到错误的服务器

## 根因
DNS 记录指向 Squarespace 而非 Vercel。

## 当前状态（2026-05-22）
```
dig alphaarena.app +short
198.49.23.144  ← Squarespace IP
198.49.23.145
198.185.159.144
198.185.159.145
```

## 解决方案

### 方案 A：修改 A 记录（推荐）

在域名注册商（Google Domains）修改 DNS 记录：

1. 登录 Google Domains: https://domains.google
2. 选择 `alphaarena.app` 域名
3. 进入 DNS 设置
4. 删除指向 Squarespace 的 A 记录（198.49.23.* 等）
5. 添加新的 A 记录：
   - 主机名: `@`
   - 类型: A
   - 值: `76.76.21.21`
   - TTL: 3600（或自动）
6. 如需要，也添加 www 的 CNAME：
   - 主机名: `www`
   - 类型: CNAME
   - 值: `cname.vercel-dns.com`

### 方案 B：更改 Nameservers

将 nameservers 改为 Vercel 的：

1. 在 Google Domains DNS 设置中选择 "Use custom name servers"
2. 输入：
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
3. 等待 DNS 传播（可能需要 24-48 小时）

**注意**：如果选择此方案，所有 DNS 记录需要在 Vercel 管理。

## 验证

修复后运行：
```bash
dig alphaarena.app +short
# 应返回: 76.76.21.21
```

然后访问 https://alphaarena.app 应显示 AlphaArena 应用。

## Vercel 项目信息
- Production URL: https://alphaarena-gxcsoccer-s-team.vercel.app
- 域名已在 Vercel 项目中正确配置，只需修复 DNS 解析