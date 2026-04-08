# production-url-configuration-issue

_Saved: 2026-04-08_

# 生产环境 URL 配置问题

## 问题描述
所有 Vercel 相关的 URL 都无法正常访问 AlphaArena 应用：

| URL | 问题 |
|-----|------|
| `alphaarena-eight.vercel.app` | DNS 解析失败 |
| `alphaarena.vercel.app` | 返回错误的 Blackrose 应用 |
| Preview URLs (`alphaarena-xxx.vercel.app`) | 连接被拒绝 (ERR_CONNECTION_CLOSED) |

## 代码状态
- ✅ 代码本身正常（GitHub API 确认 deployment status: success）
- ✅ 最新 deployment: `https://alphaarena-37sn8okog-gxcsoccer-s-team.vercel.app`
- ✅ Commit: ac77a28091a431296d841fe6eeeedf2c3e0482ab

## 根因
网络/DNS 配置问题，不是代码 Bug。

## 需要处理
1. 检查 Vercel 项目域名配置
2. 确认 `alphaarena.vercel.app` 别名指向正确的项目
3. 或配置自定义域名

## 已尝试的修复
- PR #700, #702: API 配置修复（代码层面已正确）
- Issue #699, #701, #703, #704: 均确认为 DNS/域名配置问题

## 状态
等待 investor 处理域名配置问题。已多次提醒（2026-04-08）。