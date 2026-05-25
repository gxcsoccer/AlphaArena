# DNS 修复指南 - alphaarena.app

## 问题诊断

**当前状态**：生产环境 https://alphaarena.app 显示 Squarespace 占位页，而非 Vercel 部署的应用。

**根本原因**：DNS 配置错误 - 域名的 nameserver 和 A 记录没有指向 Vercel。

### DNS 配置对比

| 类型 | 当前值 | 正确值 |
|------|--------|--------|
| Nameserver | ns-cloud-a*.googledomains.com | ns1.vercel-dns.com, ns2.vercel-dns.com |
| A 记录 (alphaarena.app) | 198.49.23.144 (Squarespace) | 76.76.21.21 (Vercel) |
| CNAME (www.alphaarena.app) | ext-sq.squarespace.com | cname.vercel-dns.com |

### 验证结果

- ❌ https://alphaarena.app → Squarespace 占位页
- ✅ https://alphaarena-eight.vercel.app → Vercel 预览部署正常
- ✅ 最新生产构建成功 (1 分钟前部署)
- ❌ DNS nameserver 指向 Google Domains，未指向 Vercel

---

## 修复步骤

### 方案 A：修改 A 记录（推荐，更快生效）

1. 登录 [Google Domains](https://domains.google.com/)
2. 选择域名 `alphaarena.app`
3. 进入 **DNS** 设置
4. 在 **自定义资源记录** 中添加/修改：
   ```
   类型: A
   名称: @
   TTL: 3600（或默认）
   IPv4 地址: 76.76.21.21
   ```
5. 添加第二条记录：
   ```
   类型: A
   名称: www
   TTL: 3600（或默认）
   IPv4 地址: 76.76.21.21
   ```
6. 保存更改

**预计生效时间**：5-30 分钟（取决于 TTL）

### 方案 B：修改 Nameserver（完整方案）

1. 登录 [Google Domains](https://domains.google.com/)
2. 选择域名 `alphaarena.app`
3. 进入 **DNS** 设置
4. 找到 **名称服务器** 部分
5. 选择 **使用自定义名称服务器**
6. 添加 Vercel nameserver：
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
7. 保存更改

**预计生效时间**：24-48 小时（DNS 传播）

---

## 验证修复

修改后，等待 DNS 传播，然后运行：

```bash
# 检查 DNS 记录
dig +short alphaarena.app
# 期望输出: 76.76.21.21

dig +short www.alphaarena.app
# 期望输出: 76.76.21.21

# 检查页面内容
curl -s https://alphaarena.app | grep '<title>'
# 期望输出: <title>AlphaArena - ...</title>
```

---

## Vercel 项目信息

- **项目名称**: alphaarena
- **项目 ID**: prj_QfKnQpqG5OcARmx6TLUTUWiOkVc6
- **团队**: gxcsoccer-s-team
- **生产 URL**: https://alphaarena-eight.vercel.app
- **自定义域名**: alphaarena.app, www.alphaarena.app

---

## 为什么显示 Squarespace 页面？

域名之前可能绑定过 Squarespace 服务，DNS 记录仍指向 Squarespace 的 IP 地址。修改 DNS 记录指向 Vercel 后，流量将正确路由到 Vercel 部署的应用。

---

**创建时间**: 2026-05-24
**问题单**: Issue #803