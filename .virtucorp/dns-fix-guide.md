# DNS 配置修复指南

## 问题描述

生产环境 https://alphaarena.app 显示 Squarespace 的 "Under Construction" 占位符页面，而非 AlphaArena 应用。

## 根本原因

**DNS 配置错误**：域名的 A 记录指向 Squarespace 服务器，而非 Vercel 服务器。

### 当前状态

```
域名: alphaarena.app
当前 A 记录: 198.185.159.144/145, 198.49.23.144/145 (Squarespace)
应该 A 记录: 76.76.21.21 (Vercel)
Nameservers: ns-cloud-a[1-4].googledomains.com (Google Domains)
```

### Vercel 验证

```
$ vercel domain inspect alphaarena.app

WARNING! This Domain is not configured properly. To configure it you should either:
  a) Set the following record on your DNS provider to continue: 
     `A alphaarena.app 76.76.21.21` [recommended]
  b) Change your Domains's nameservers to the intended set detailed above.
```

## 解决方案

### 方案 A：修改 A 记录（推荐，最快）

**步骤**：

1. 登录 [Google Domains](https://domains.google.com/)
2. 选择域名 `alphaarena.app`
3. 点击左侧菜单 "DNS"
4. 滚动到 "Custom resource records" 部分
5. 修改或添加以下记录：

#### 根域名 (alphaarena.app)

```
类型: A
主机名: @ (或留空，表示根域名)
TTL: 3600 (或默认值)
数据/值: 76.76.21.21
```

#### www 子域名

```
类型: A
主机名: www
TTL: 3600 (或默认值)
数据/值: 76.76.21.21
```

**注意**：删除或禁用任何现有的指向 Squarespace 的 A 记录。

**生效时间**：通常 5-30 分钟，最长 48 小时（DNS 传播）

### 方案 B：更改 Nameservers（长期方案）

**步骤**：

1. 登录 [Google Domains](https://domains.google.com/)
2. 选择域名 `alphaarena.app`
3. 点击左侧菜单 "DNS"
4. 点击 "Name servers"
5. 选择 "Use custom name servers"
6. 输入以下 nameservers：
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
7. 保存更改

**生效时间**：最长 48 小时

## 验证步骤

DNS 更新后，运行以下命令验证：

```bash
# 检查 DNS 解析
dig alphaarena.app +short

# 应该返回：76.76.21.21

# 检查 HTTP 响应
curl -I https://alphaarena.app | grep server

# 应该显示 Vercel 或类似内容，而非 Squarespace
```

## 预防措施

1. **域名迁移清单**：迁移域名时，务必同步更新所有 DNS 记录
2. **DNS 监控**：建议设置 DNS 监控，当解析结果异常时告警
3. **文档记录**：在项目文档中记录域名注册商和 DNS 提供商信息

## 受影响域名清单

所有三个 AlphaArena 品牌域名都有 DNS 配置问题：

### 1. alphaarena.app (主要生产域名)

```
当前 DNS: ns-cloud-a[1-4].googledomains.com (Google Domains)
当前 A 记录: 198.185.159.xxx (Squarespace)
应该 A 记录: 76.76.21.21 (Vercel)
状态: 🔴 完全不可用 - 显示 Squarespace 占位符
```

**修复优先级**: P0 - 立即修复

### 2. alphaarena.xyz

```
当前 DNS: ns-cloud-b[1-4].googledomains.com (Google Domains)
当前 A 记录: 198.185.159.xxx (Squarespace)
应该 A 记录: 76.76.21.21 (Vercel)
状态: 🔴 完全不可用 - 显示 Squarespace 占位符
```

**修复优先级**: P1 - 同步修复

### 3. alphaarena.com

```
当前 DNS: ns09/10.domaincontrol.com (GoDaddy)
当前 A 记录: 34.102.136.180
应该 A 记录: 76.76.21.21 (Vercel)
状态: 🔴 SSL 错误 - 无法访问
```

**修复优先级**: P1 - 同步修复

## 批量修复方案

如果所有域名都在同一个 DNS 提供商管理，建议批量修复：

1. **Google Domains** 管理 .app 和 .xyz 品牌：
   - alphaarena.app
   - alphaarena.xyz
   
2. **GoDaddy** 管理 .com 品牌：
   - alphaarena.com

**建议**: 按照上述方案 A，在各自的 DNS 提供商处统一修改 A 记录。

## 相关信息

- 域名注册商：Google Domains (.app/.xyz), GoDaddy (.com)
- Vercel 项目：gxcsoccer-s-team/alphaarena
- Issue：#809
- 标签：`priority/p0`, `type/bug`, `needs-investor-action`, `blocked/dns-config`