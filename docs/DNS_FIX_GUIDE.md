# DNS 配置修复指南 - alphaarena.app

## 问题诊断

### 当前状态
- ✅ Vercel 部署成功（构建正常）
- ❌ DNS 指向错误的服务器（Squarespace）
- ❌ alphaarena.app 显示 "Coming Soon" 占位页

### DNS 检查结果

```
$ nslookup alphaarena.app
Name:   alphaarena.app
Address: 198.185.159.145  # Squarespace IP
Address: 198.185.159.144  # Squarespace IP
Address: 198.49.23.145    # Squarespace IP
Address: 198.49.23.144    # Squarespace IP
```

当前 nameservers：
- ns-cloud-a1.googledomains.com
- ns-cloud-a2.googledomains.com
- ns-cloud-a3.googledomains.com
- ns-cloud-a4.googledomains.com

期望 nameservers（Vercel）：
- ns1.vercel-dns.com
- ns2.vercel-dns.com

## 解决方案

### 选项 A：添加 A 记录（推荐，最快生效）

1. 登录 [Google Domains](https://domains.google.com)
2. 选择域名 `alphaarena.app`
3. 进入 DNS 设置
4. 添加以下 A 记录：

```
类型: A
名称: @ (或留空)
值: 76.76.21.21
TTL: 3600 (或默认)
```

5. 等待 DNS 传播（通常 5-30 分钟）

### 选项 B：更改 Nameservers（Vercel 推荐）

1. 登录 [Google Domains](https://domains.google.com)
2. 选择域名 `alphaarena.app`
3. 进入 DNS 设置
4. 找到 "Name servers" 部分
5. 选择 "Use custom name servers"
6. 添加以下 nameservers：
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
7. 保存更改
8. 等待 DNS 传播（可能需要 24-48 小时，通常几小时内即可）

### 验证修复

修复后，运行以下命令验证：

```bash
# 检查 DNS 解析（应指向 76.76.21.21 或 Vercel IP）
nslookup alphaarena.app

# 检查网站内容（应显示 AlphaArena 而非 Squarespace）
curl -s https://alphaarena.app | grep -i "alphaarena"
```

预期结果：
- DNS 应指向 `76.76.21.21`（选项 A）或 Vercel IP（选项 B）
- 网站内容应包含 "AlphaArena - 算法交易平台"

## 为什么会发生这个问题？

域名之前可能被配置为 Squarespace 的 "Parking Page" 或 "Coming Soon" 页面。当切换到 Vercel 时，需要在域名注册商处更新 DNS 设置，以指向 Vercel 的服务器。

## 相关 Issue

- Issue #803: [P0] 生产环境显示占位页，应用未正确部署

## 更新日志

- 2026-05-26: 初始诊断和修复指南