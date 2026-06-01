# dns-configuration-issue-813

_Saved: 2026-06-01_

# Issue #813 - DNS 配置问题

## 状态
**阻塞中** — 等待 investor 手动操作

## 问题
生产环境域名指向 Squarespace 停泊页面，而非 Vercel。

## 根本原因
DNS A 记录错误：
- 当前: 198.49.23.145, 198.185.159.144 等 (Squarespace)
- 应该: 76.76.21.21 (Vercel)

## 受影响域名
| 域名 | 注册商 | DNS 提供商 |
|------|--------|-----------|
| alphaarena.app | Google Domains | Google Domains |
| alphaarena.xyz | Google Domains | Google Domains |
| alphaarena.com | GoDaddy | GoDaddy |

## 修复操作
### Google Domains (alphaarena.app, alphaarena.xyz)
1. 登录 https://domains.google.com
2. 选择域名 → DNS → Custom resource records
3. A 记录 `@` → `76.76.21.21`
4. CNAME `www` → `cname.vercel-dns.com`

### GoDaddy (alphaarena.com)
1. 登录 https://www.godaddy.com/
2. My Products → alphaarena.com → DNS
3. 同样修改 A 和 CNAME 记录

## 预期恢复时间
5-30 分钟（DNS 传播）

## Dev 诊断记录
- Vercel 部署: ✅ 正常
- vercel.json 配置: ✅ 正确
- 构建状态: ✅ 成功
- DNS 记录: ❌ 指向错误 IP

## 结论
**无法通过代码修复**，需要域名所有者权限。