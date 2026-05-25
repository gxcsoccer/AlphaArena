# dns-troubleshooting-vercel

_Saved: 2026-05-25_

# DNS 故障排查指南 (Vercel)

## 症状
- 生产环境显示占位页或错误页面
- Vercel 部署状态显示 Ready
- 本地构建产物正确

## 排查步骤

### 1. 检查 DNS 解析
```bash
dig yourdomain.app +short
```
- 如果返回 IP 不是 Vercel 的 IP (`76.76.21.21`)，说明 DNS 配置错误
- Squarespace IP: `198.185.159.*`, `198.49.23.*`

### 2. 检查 HTTP 响应头
```bash
curl -sI https://yourdomain.app | grep -i server
```
- 如果返回 `Squarespace` 或其他非 Vercel 服务，确认 DNS 问题

### 3. 检查 Vercel 域名配置
```bash
vercel domains inspect yourdomain.app
```
- 查看 Nameserver 配置是否正确
- Vercel 要求: `ns1.vercel-dns.com`, `ns2.vercel-dns.com`
- 或者 A 记录: `76.76.21.21`

### 4. 验证 Vercel 部署
```bash
vercel list --prod
vercel inspect <deployment-url>
```
- 确认部署状态为 Ready
- 确认域名别名已配置

## 修复方案

### 方式 A（推荐）：修改 A 记录
1. 登录域名注册商控制面板
2. 添加/修改 A 记录: `@ -> 76.76.21.21`
3. 添加/修改 A 记录: `www -> 76.76.21.21`

### 方式 B：修改 Nameserver
1. 将 nameserver 改为 Vercel 的 nameserver
2. 可能需要 24-48 小时生效

## 相关 Issue
- Issue #803: DNS 配置指向 Squarespace 导致生产环境不可用