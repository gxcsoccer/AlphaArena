# dns-squarespace-vercel-issue

_Saved: 2026-05-19_

# DNS 故障排查：域名指向 Squarespace 而非 Vercel

## 症状
- 网站显示 "Under Construction" 或 Squarespace 占位页
- Vercel 部署正常，但域名无法访问
- `curl` 返回 `server: Squarespace`
- `dig` 返回 Squarespace IP (198.49.23.145, 198.185.159.145, etc.)

## 根因
域名原本在 Google Domains 注册，后迁移到 Squarespace。DNS nameservers 仍然是 Google Domains 的，但 A 记录被 Squarespace 的占位页覆盖。

## 诊断命令
```bash
# 检查 DNS 解析
dig alphaarena.app +short

# 检查 Vercel 部署状态
vercel list
vercel inspect alphaarena.app

# 检查 Vercel 域名配置
vercel domains inspect alphaarena.app

# 检查实际返回内容
curl -sI https://alphaarena.app
```

## 修复方案

### 方案 A（快速，推荐）
在 Squarespace DNS 设置中添加：
- A 记录: `@ → 76.76.21.21`

### 方案 B（长期）
更改 Nameservers：
- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

## 临时访问
- https://alphaarena-eight.vercel.app
- https://alphaarena-gxcsoccer-s-team.vercel.app

## 相关 Issue
- #796: P0 生产事故