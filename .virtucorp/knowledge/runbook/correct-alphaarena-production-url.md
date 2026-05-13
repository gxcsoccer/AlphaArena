# correct-alphaarena-production-url

_Saved: 2026-05-13_

# AlphaArena 正确的生产环境 URL

## 问题
调度器和测试配置使用了错误的 URL：
- `https://alphaarena.vercel.app` → 指向 BLACKROSE 项目（错误）
- `https://alphaarena-eight.vercel.app` → DNS 解析到 Meta/Facebook IP（DNS 污染）

## 正确 URL
```
https://alphaarena-cdtgbttrx-gxcsoccer-s-team.vercel.app
```

## Vercel 项目信息
- 团队: gxcsoccer-s-team
- 项目名: alphaarena

## 建议
1. 在 Vercel 中配置自定义域名（如 alphaarena.app）
2. 更新调度器配置使用正确的 URL
3. 所有 acceptance test 已在 PR #779 中更新为 `alphaarena-eight.vercel.app`（但该域名有 DNS 问题）