# dns-troubleshooting-vercel

_Saved: 2026-05-28_

# DNS Troubleshooting for Vercel Deployments

## 当生产环境显示 "Under Construction" 或占位符页面时

### 快速诊断步骤

1. **检查 HTTP 响应头**
   ```bash
   curl -I https://yourdomain.app
   ```
   - 如果 `server: Squarespace` 或其他非 Vercel 服务 → DNS 配置错误
   - 如果 `server: Vercel` → 检查 Vercel 项目配置

2. **检查 DNS 解析**
   ```bash
   dig yourdomain.app +short
   ```
   - Vercel IP: `76.76.21.21`
   - 如果返回其他 IP → DNS A 记录指向错误的服务

3. **检查 Vercel 域名状态**
   ```bash
   vercel domain inspect yourdomain.app
   ```
   - 查看是否有警告信息
   - 检查 Nameservers 是否匹配

### 常见问题

#### 问题：域名指向旧的服务提供商

**症状**：
- 显示占位符页面（Squarespace, WordPress, etc）
- HTTP 响应来自旧服务商
- DNS 解析到旧 IP

**根本原因**：
域名迁移到 Vercel 后，DNS 记录没有更新

**解决方案**：
1. 方案 A（推荐）：修改 A 记录
   ```
   在域名注册商（如 Google Domains, GoDaddy）：
   DNS 设置 → 添加 A 记录 → @ → 76.76.21.21
   ```

2. 方案 B：更改 Nameservers
   ```
   DNS 设置 → Nameservers → ns1.vercel-dns.com, ns2.vercel-dns.com
   ```

**生效时间**：
- 方案 A：5-30 分钟（最长 48 小时）
- 方案 B：最长 48 小时

### 检查清单

当出现生产环境问题时：

1. ✅ 确认 Vercel 部署状态（`vercel ls`）
2. ✅ 检查域名是否添加到 Vercel 项目（`vercel domain ls`）
3. ✅ 检查 DNS 解析结果（`dig yourdomain.app +short`）
4. ✅ 检查 HTTP 响应服务器（`curl -I https://yourdomain.app | grep server`）
5. ✅ 确认 Nameservers 配置

### 预防措施

1. **域名迁移清单**
   - 迁移前：记录当前 DNS 配置
   - 迁移时：更新所有 DNS 记录
   - 迁移后：验证所有域名解析正确

2. **DNS 监控**
   - 设置 DNS 解析监控
   - 当解析结果非预期时告警

3. **文档记录**
   - 记录域名注册商信息
   - 记录 DNS 提供商信息
   - 记录预期的 DNS 配置

### 相关 Issue

- Issue #809: alphaarena.app DNS 配置错误导致显示 Squarespace 占位符
- 受影响域名：alphaarena.app, alphaarena.xyz, alphaarena.com
- 根本原因：三个域名的 DNS 都指向错误的 IP

### 验证命令

DNS 更新后验证：

```bash
# 检查 DNS 解析 - 应返回 76.76.21.21
dig yourdomain.app +short

# 检查 HTTP 响应 - 应显示 Vercel
curl -I https://yourdomain.app | grep server

# 检查页面内容 - 应显示应用而非占位符
curl -s https://yourdomain.app | grep -o '<title>.*</title>'
```