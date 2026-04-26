# production-dns-configuration

_Saved: 2026-04-26_

# AlphaArena 生产环境 DNS 配置

## 问题诊断

当生产环境显示 "We're under construction" 或非预期页面时：

1. **检查 DNS 解析**：
   ```bash
   dig alphaarena.app +short
   ```
   - 正确结果：`76.76.21.21` (Vercel IP)
   - 错误结果：SquareSpace IPs (`198.49.23.*`, `198.185.159.*`)

2. **检查 Vercel 域名配置**：
   ```bash
   vercel domain inspect alphaarena.app
   ```
   - 查看 Nameservers 是否正确

## 修复步骤

### 方案 A：修改 A 记录（推荐）

在域名注册商 DNS 设置中：
1. 添加 A 记录：`alphaarena.app → 76.76.21.21`
2. 等待 DNS 刷新（通常 5-30 分钟）

### 方案 B：更改 Nameservers

将域名 nameservers 改为 Vercel 的：
- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

## 历史记录

- 2026-04-27: 发现 `alphaarena.app` DNS 指向 SquareSpace IPs，导致生产环境显示占位页
- 根因：域名注册商 DNS 配置未更新到 Vercel
- Issue #743

## 相关命令

```bash
# 检查 Vercel 域名状态
vercel domain inspect alphaarena.app

# 检查 DNS 解析
dig alphaarena.app +short

# 直接访问 Vercel 部署（绕过 DNS）
curl https://alphaarena-<deployment-id>.vercel.app

# 触发新部署
vercel --prod
```