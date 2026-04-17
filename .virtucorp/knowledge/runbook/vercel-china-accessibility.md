# vercel-china-accessibility

_Saved: 2026-04-13_

# Vercel 中国网络连通性问题

## 问题描述

Vercel 的 Edge Network IPs 在中国经常被 GFW 阻断，导致：
- 直接访问 *.vercel.app 域名超时
- 即使 DNS 配置正确，也无法从中国访问

## 已确认被阻断的 IPs

- 69.63.176.59
- 128.121.146.235
- 128.121.243.106
- 76.76.21.21

## 解决方案

### 方案 A：Cloudflare Proxy（推荐）

1. 在 Cloudflare 添加域名
2. 设置 DNS 记录指向 Vercel
3. 开启 Cloudflare Proxy（橙色云朵）
4. Cloudflare 在中国有更好的连通性

### 方案 B：中国 CDN

- 阿里云 CDN + 海外源站（Vercel）
- 腾讯云 CDN + 海外源站

### 方案 C：双域名策略

- 海外：alphaarena.app (Vercel)
- 国内：备用域名 + 国内 CDN

## 排查步骤

1. 检查 Vercel 部署状态：`vercel list`
2. 检查 DNS 解析：`dig <domain> +short`
3. 测试 IP 连通性：`curl -v --resolve <domain>:443:<ip> https://<domain>`
4. 对比其他服务：`curl -I https://cloudflare.com`

## 参考案例

Issue #719：Production site completely inaccessible
- 根因：DNS 指向 Squarespace + Vercel IP 被阻断
- 解决：需要手动修改 DNS + 配置 Cloudflare Proxy