# dns-configuration-fix

_Saved: 2026-06-06_

# DNS 配置问题修复指南

## 问题描述
生产环境 `alphaarena.app` 显示 Squarespace 的 "Under Construction" 占位页面，而不是 AlphaArena 应用。

## 根本原因
域名 DNS 配置错误：
- **当前状态**: nameservers 指向 `ns-cloud-a*.googledomains.com`
- **当前 IP**: Squarespace IPs (198.49.23.*, 198.185.159.*)
- **期望状态**: 指向 Vercel IP (76.76.21.21)

## 验证命令
```bash
# 检查 DNS 解析
dig alphaarena.app +short
# 应返回: 76.76.21.21
# 实际返回: 198.185.159.145 等 Squarespace IP

# 检查 HTTP 响应
curl -sI https://alphaarena.app | grep server
# 应返回: server: Vercel
# 实际返回: server: Squarespace

# 检查 Vercel 域名配置
vercel domain inspect alphaarena.app
# 显示 nameserver 不匹配警告
```

## 修复步骤（需要 Investor 手动操作）

### 方案 A：添加 A 记录（推荐，快速生效）
1. 登录 Google Domains (domains.google.com)
2. 选择域名 `alphaarena.app`
3. 进入 DNS 设置
4. 添加记录：
   - **主机名**: `@`
   - **类型**: A
   - **值**: `76.76.21.21`
   - **TTL**: 默认或 3600
5. 同时为 `www` 子域名添加相同记录
6. 等待 DNS 传播（5-30 分钟）

### 方案 B：更改 Nameservers（长期方案）
1. 登录 Google Domains
2. 选择域名 `alphaarena.app`
3. 进入 DNS 设置
4. 选择 "使用自定义 nameservers"
5. 输入：
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
6. 等待 DNS 传播（最多 48 小时）

## Vercel 部署状态
- **状态**: ✅ 正常运行
- **最新部署**: Ready 状态
- **构建**: 成功
- **Vercel 默认域名**: `alphaarena-gxcsoccer-s-team.vercel.app` 可正常访问

## 相关 Issues
- #815: DNS misconfiguration
- #813: Production site showing Under Construction page
- #819: P0: 生产环境显示占位页面

## 注意事项
- 这是外部配置问题，无法通过代码修复
- Vercel CLI 无法修改第三方注册商的 DNS 设置
- 需要 investor 访问 Google Domains 手动操作