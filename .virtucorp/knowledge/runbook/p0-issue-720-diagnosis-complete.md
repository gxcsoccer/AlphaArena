# p0-issue-720-diagnosis-complete

_Saved: 2026-04-14_

# P0 Issue #720 诊断完成

## 诊断日期
2026-04-15

## 问题现象
烟雾测试报告 `https://alphaarena-eight.vercel.app/pricing` 返回 ERR_CONNECTION_CLOSED

## 根因分析

### 1. 测试 URL 无效
`alphaarena-eight.vercel.app` 不存在于 Vercel 别名列表中。这是一个旧的或从未存在的 URL。

### 2. 自定义域名配置错误

| URL | 当前状态 | 应该是什么 |
|-----|---------|-----------|
| `alphaarena.app` | Squarespace Parking Page ("Coming Soon") | 应代理到 Vercel |
| `alphaarena.com` | DNS → 34.102.136.180 (Google Cloud) ❌ | DNS → 76.76.21.21 (Vercel) |
| `www.alphaarena.com` | DNS 错误 | DNS → 76.76.21.21 (Vercel) |

### 3. Vercel 域名配置状态
```
vercel domains inspect alphaarena.com
Nameservers:
  Intended: ns1.vercel-dns.com, ns2.vercel-dns.com
  Current: ns09.domaincontrol.com, ns10.domaincontrol.com ✘ (GoDaddy)
```

### 4. DNS 污染 + SNI 阻断
在中国大陆，`*.vercel.app` 域名被 DNS 污染，TLS SNI 检测会被阻断。这需要通过 CDN 代理绕过。

## 代码状态
- ✅ 本地构建成功
- ✅ 本地运行正常（localhost:3001/pricing 返回 200）
- ✅ Vercel 部署状态显示 Ready
- ❌ 但域名没有正确指向 Vercel

## 解决方案

### 方案 A：修复 Squarespace 配置
如果 `alphaarena.app` 使用 Squarespace 作为 CDN：
1. 登录 Squarespace
2. 配置 URL 映射到 Vercel 部署
3. 不使用 Parking Page

### 方案 B：修改 DNS A 记录（推荐）
在 GoDaddy 修改：
- `alphaarena.com` A 记录 → 76.76.21.21
- `www.alphaarena.com` A 记录 → 76.76.21.21
- 或将 Nameserver 改为 ns1.vercel-dns.com, ns2.vercel-dns.com

### 方案 C：使用 Cloudflare CDN
最可靠的方案：
1. 将域名 DNS 添加到 Cloudflare
2. Cloudflare 代理模式（橙色云）
3. Origin 设置为 Vercel

## 当前可用的 Vercel 部署 URL
最新生产部署：`alphaarena-oqkc6su98-gxcsoccer-s-team.vercel.app`
但在中国无法直接访问（DNS 污染）

## 需要修复的配置文件
`.virtucorp/acceptance/smoke-test.yaml` 等文件使用了无效 URL：
- 当前：`https://alphaarena-eight.vercel.app`
- 应改为：`https://alphaarena.app`（修复 Squarespace 配置后）
- 或使用最新部署 URL

## 结论
**这不是代码 Bug，是域名/DNS 配置问题。需要 investor 在域名注册商（GoDaddy/Squarespace）修改配置。**

Dev 无法解决此问题，需要 investor 操作域名配置。