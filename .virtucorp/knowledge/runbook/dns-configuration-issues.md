# dns-configuration-issues

_Saved: 2026-05-19_

# DNS 配置问题排查指南

## 问题症状

- 生产环境显示 "We're under construction" 占位页
- 页面显示 Squarespace 标识而非 AlphaArena 应用
- HTTP 响应头显示 `server: Squarespace`
- `dig alphaarena.app +short` 返回 198.49.23.x 或 198.185.159.x IP 地址

## 根本原因

域名 DNS A 记录指向 Squarespace IP 而非 Vercel IP。

### 为什么会发生？

1. Google Domains 被 Squarespace 收购，域名可能正在迁移
2. Squarespace 有自动 DNS 配置功能，会将域名指向自己的服务器
3. 如果域名的 nameservers 仍然是 Google Domains/Squarespace，他们可以自动覆盖 DNS 记录

## 快速验证

```bash
# 检查 DNS 解析
dig alphaarena.app +short
# 正确: 76.76.21.21
# 错误: 198.49.23.x 或 198.185.159.x

# 检查服务器
curl -sI https://alphaarena.app | grep server
# 正确: Vercel
# 错误: Squarespace

# 检查 Vercel 域名配置
vercel domains inspect alphaarena.app
# 查看是否有 WARNING
```

## 修复方案

### 方案 A - 修改 DNS A 记录（快速修复）

1. 登录域名注册商（Google Domains 或 Squarespace）
2. 进入 alphaarena.app 的 DNS 设置
3. 删除所有指向 198.49.23.x 和 198.185.159.x 的 A 记录
4. 添加新 A 记录：`@ → 76.76.21.21`
5. 添加 CNAME：`www → cname.vercel-dns.com`
6. 等待 5-30 分钟 DNS 传播

### 方案 B - 更改 Nameservers（永久方案）

将域名 nameservers 改为 Vercel 的：
- ns1.vercel-dns.com
- ns2.vercel-dns.com

这样 Vercel 将完全控制 DNS 配置。

## 相关 Issue

- Issue #790: 首次发生 (2026-05-16)
- Issue #797: 问题回归 (2026-05-20)

## 相关文档

- `docs/deployment/DNS_CONFIGURATION.md`
- `DEPLOYMENT.md` 故障排查部分