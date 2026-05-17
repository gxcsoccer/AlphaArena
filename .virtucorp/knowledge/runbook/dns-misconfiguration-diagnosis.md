# dns-misconfiguration-diagnosis

_Saved: 2026-05-17_

# DNS 配置错误诊断流程

## 症状
- 生产环境显示 "Under Construction" 或其他非预期页面
- 域名解析到错误的服务器

## 诊断步骤

### 1. 检查 DNS 解析
```bash
dig alphaarena.app +short
nslookup alphaarena.app
```

### 2. 检查 HTTP 响应头
```bash
curl -I https://alphaarena.app
```
查找 `Server:` 头判断服务提供商。

### 3. 检查 Vercel 域名配置
```bash
npx vercel domain inspect alphaarena.app
```
检查 Nameservers 是否匹配。

### 4. 检查 Vercel 部署状态
```bash
npx vercel ls --prod
npx vercel project ls
```

## 常见问题

### Squarespace 占位页
- **症状**: DNS 解析到 `198.185.159.*` 或 `198.49.23.*`
- **原因**: 域名之前在 Squarespace 注册，DNS 未更新
- **修复**: 在域名注册商修改 DNS 记录

## 修复方案

### 方案 A: 添加 A 记录（推荐）
在 DNS 管理界面添加：
- 主机: `@`
- 类型: `A`
- 值: `76.76.21.21` (Vercel IP)

### 方案 B: 修改 Nameservers
将 nameservers 改为 Vercel DNS：
- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

## 注意事项
- DNS 修改后需要 5-30 分钟生效
- 修改 nameservers 可能需要 24-48 小时传播
- 这类问题无法通过代码修复，需要域名所有者操作