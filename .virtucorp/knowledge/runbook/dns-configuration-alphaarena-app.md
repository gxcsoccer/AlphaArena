# dns-configuration-alphaarena-app

_Saved: 2026-05-14_

# DNS Configuration Issue - alphaarena.app

## Problem
访问 https://alphaarena.app 显示 Squarespace "Coming Soon" 占位页面，应用完全不可用。

## Root Cause
DNS A 记录指向 Squarespace IP，而非 Vercel。

## Diagnosis Steps
1. 检查 HTTP 响应头: `curl -sI https://alphaarena.app` → `server: Squarespace`
2. 检查 DNS A 记录: `dig alphaarena.app +short` → 返回 Squarespace IPs
3. 验证 Vercel 部署: `vercel list --prod` → 部署正常
4. 测试 Vercel 原始域名: `curl https://alphaarena-gxcsoccer-s-team.vercel.app` → 返回正确内容

## Solution
在 Google Domains 控制面板更新 DNS A 记录：

```
删除: 所有指向 Squarespace 的 A 记录 (198.185.159.*, 198.49.23.*)
添加: A 记录 → 76.76.21.21 (Vercel)
```

## Important Notes
- 此问题无法通过代码仓库自动修复
- 需要域名所有者在 Google Domains 手动操作
- DNS 更改后几分钟到几小时生效

## Related
- Issue #785
- Domain added to Vercel: 2026-03-27
- DNS was never correctly configured