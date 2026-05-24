# p0-production-under-construction-fix

_Saved: 2026-05-24_

# P0: 生产环境显示 "We're under construction" 占位页

## 问题诊断

### 症状
- 访问 `https://alphaarena.app` 显示 "We're under construction" 占位页
- 整个应用无法使用，无任何功能入口

### 根本原因
**DNS 配置错误** - 域名指向 Squarespace 的 IP，而非 Vercel

DNS 解析结果：
```
alphaarena.app. IN A 198.49.23.144    ← Squarespace IP
alphaarena.app. IN A 198.49.23.145    ← Squarespace IP
alphaarena.app. IN A 198.185.159.144  ← Squarespace IP
alphaarena.app. IN A 198.185.159.145  ← Squarespace IP
```

期望的 Vercel IP：`76.76.21.21`

Nameservers：`ns-cloud-a*.googledomains.com`（Google Domains）
期望的 Nameservers：`ns1.vercel-dns.com`, `ns2.vercel-dns.com`

## 修复步骤

### 方案 A：修改 DNS A 记录（推荐，最快生效）

1. 登录 Google Domains（或当前 DNS 提供商）
2. 进入 `alphaarena.app` 的 DNS 管理
3. 删除所有现有的 A 记录（指向 198.49.23.* 和 198.185.159.*）
4. 添加新的 A 记录：
   - 名称：`@`（或空）
   - 类型：`A`
   - 值：`76.76.21.21`
   - TTL：`3600`（1小时）或更低
5. 同时为 `www` 子域名添加相同记录：
   - 名称：`www`
   - 类型：`A`
   - 值：`76.76.21.21`

### 方案 B：修改 Nameservers（更彻底，但需要等待传播）

1. 登录 Google Domains
2. 进入 `alphaarena.app` 的 DNS 管理
3. 将 nameservers 改为 Vercel 的：
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
4. 等待 DNS 传播（最多 24-48 小时）

## 验证修复

修复后，运行以下命令验证：

```bash
# 检查 DNS 解析
dig +short alphaarena.app
# 期望输出：76.76.21.21

# 访问网站
curl -sL https://alphaarena.app | head -20
# 期望：看到 AlphaArena 的 HTML 内容，包含 "算法交易平台" 等文字
```

## 相关命令

```bash
# 查看当前 DNS 配置
dig alphaarena.app ANY +noall +answer

# 查看 Vercel 域名状态
vercel domains inspect alphaarena.app

# 强制重新部署
vercel --prod

# 查看最新部署
vercel list | head -5
```

## 2026-05-24 事件记录

- 问题发现：生产环境显示占位页
- 诊断：DNS 指向 Squarespace IP
- 部署验证：Vercel 构建成功（`npm run build` 完成）
- 修复需求：需要在 Google Domains 中修改 DNS A 记录

**状态：等待 investor 在 DNS 提供商中修改配置**