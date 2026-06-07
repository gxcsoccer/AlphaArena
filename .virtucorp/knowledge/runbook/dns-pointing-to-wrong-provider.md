# dns-pointing-to-wrong-provider

_Saved: 2026-06-07_

# DNS 指向错误提供商的诊断和修复

## 症状
- 生产环境显示 "Under Construction" 或其他占位页面
- 页面内容不是预期的应用
- HTTP 响应头显示错误的服务器（如 Squarespace 而不是 Vercel）

## 诊断步骤

### 1. 检查 HTTP 响应头
```bash
curl -sI https://your-domain.com | grep -i server
```
- 应该显示 `server: Vercel` 或类似
- 如果显示 `Squarespace` 或其他，说明 DNS 指向错误

### 2. 检查 DNS 解析
```bash
dig your-domain.com +short
```
- Vercel 应该返回 `76.76.21.21`
- 如果返回其他 IP，检查 DNS 配置

### 3. 检查 Vercel 域名配置
```bash
vercel domains inspect your-domain.com
```
- 查看 Nameservers 和配置状态
- 如果显示警告，按提示修复

### 4. 验证 Vercel 部署状态
```bash
vercel list --prod
vercel inspect <deployment-url>
```
- 确认部署状态为 Ready
- 确认域名正确绑定到项目

## 修复步骤

### 如果 DNS 指向 Squarespace（常见错误）

1. 登录域名注册商（Google Domains, Namecheap, GoDaddy 等）
2. 找到 DNS 设置
3. 修改记录：

| 类型 | 名称 | 值 |
|------|------|-----|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

4. 删除任何 Squarespace 相关记录
5. 等待 DNS 传播（5-30 分钟）

### 如果使用 Vercel Nameservers

1. 在域名注册商处更改 nameservers 为：
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`

## 案例：alphaarena.app (2026-06-07)

### 问题
生产环境 `alphaarena.app` 显示 Squarespace 的 "Under Construction" 页面

### 诊断
- `curl -sI https://alphaarena.app` → `server: Squarespace`
- `dig alphaarena.app +short` → `198.49.23.144` (Squarespace IP)
- Vercel 部署状态正常，域名绑定正确

### 原因
DNS A 记录被错误地指向 Squarespace IP，而不是 Vercel

### 修复
需要在 Google Domains 修改 DNS 记录：
- A 记录 `@` → `76.76.21.21`
- CNAME `www` → `cname.vercel-dns.com`

### 教训
- 域名可能被错误配置指向其他服务
- 检查问题时先看 HTTP 响应头和 DNS 解析
- Vercel CLI 无法修改外部 DNS 配置