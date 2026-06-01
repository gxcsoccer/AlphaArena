# dns-configuration-blocked-p0

_Saved: 2026-06-01_

# DNS 配置阻塞问题 - Issue #813

## 问题概述

当生产环境显示 Squarespace 的 "Under Construction" 页面时，这是一个 **DNS 配置问题**，而非代码 bug。

## 诊断步骤

1. **验证 Vercel 部署状态**:
   ```bash
   gh api repos/gxcsoccer/AlphaArena/deployments --jq '.[0:5]'
   ```
   如果部署正常（Ready 状态），则问题不在代码。

2. **检查 DNS 解析**:
   ```bash
   # A 记录
   dig +short alphaarena.app A
   # 期望: 76.76.21.21 (Vercel)
   # 如果返回: 198.49.23.144, 198.49.23.145 → Squarespace
   
   # CNAME 记录
   dig +short www.alphaarena.app CNAME
   # 期望: cname.vercel-dns.com
   # 如果返回: ext-sq.squarespace.com → Squarespace
   ```

3. **访问 Vercel 预览域名**:
   如果直接访问 Vercel 预览域名正常，则确认问题在 DNS。

## 根本原因

- DNS A 记录指向 Squarespace IP（198.49.23.144 等）而非 Vercel（76.76.21.21）
- DNS CNAME 记录指向 Squarespace（ext-sq.squarespace.com）而非 Vercel（cname.vercel-dns.com）

## 解决方案

**无法通过代码修复**。需要域名所有者在域名注册商处操作：

### Google Domains（alphaarena.app, alphaarena.xyz）

1. 登录 https://domains.google.com
2. 选择域名 → DNS → Custom resource records
3. 修改 A 记录: `@` → `76.76.21.21`
4. 修改 CNAME 记录: `www` → `cname.vercel-dns.com`
5. 等待 DNS 传播（5-30 分钟）

### GoDaddy（alphaarena.com）

1. 登录 https://www.godaddy.com/
2. My Products → DNS
3. 修改 A 记录和 CNAME 记录（同上）

## Dev 无法修复的原因

1. DNS 解析发生在网络层，请求未到达 Vercel
2. 域名注册商账户需要所有者访问
3. Vercel CLI 无法修改外部注册商的 DNS 记录

## 正确的处理流程

1. Dev 诊断问题 → 确认是 DNS 配置问题
2. 标记 Issue 为 `blocked/dns-config` 和 `needs-investor-action`
3. 提供详细的操作指南
4. 等待 investor 完成 DNS 配置
5. investor 在 Issue 中评论确认后，Dev 验证 DNS 更新
6. 关闭 Issue

## Issue 标签规范

当遇到 DNS 配置阻塞问题时，应添加：
- `status/blocked` - 阻塞状态
- `needs-investor-action` - 需要投资者行动
- `blocked/dns-config` - DNS 配置阻塞