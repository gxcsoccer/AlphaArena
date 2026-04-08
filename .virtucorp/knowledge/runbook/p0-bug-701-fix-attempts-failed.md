# p0-bug-701-fix-attempts-failed

_Saved: 2026-04-08_

# P0 Bug #701 修复失败记录

## 问题描述
生产环境 https://alphaarena.vercel.app 首页显示 "Network Error"，WebSocket 断开，pricing 页面空白。

## 已尝试的修复方案

### 第1次尝试 - PR #700
- **方案**: 添加 Vercel rewrites + 创建 Supabase Edge Function
- **根因假设**: /api/subscription/plans 返回 404
- **结果**: ❌ 失败。发现 Vercel rewrites 无法代理外部 URL

### 第2次尝试 - 直接提交 c67d20e7
- **方案**: 前端直接调用 Supabase API（绕过 Vercel rewrites）
- **根因假设**: Vercel rewrites 不支持外部 URL
- **结果**: ❌ 失败。首页仍显示 Network Error

### 第3次尝试 - PR #702
- **方案**: 修改 apiUrl fallback 为 Supabase URL + 配置环境变量
- **根因假设**: 构建产物包含 localhost（环境变量未注入）
- **结果**: ❌ 失败。首页仍显示 Network Error，WebSocket 断开

## 验证证据
- 测试报告: `/Users/lang/workspace/AlphaArena/midscene_run/report/_tmp_acceptance-1775609948351-2026-04-08_08-59-11-c370e970.html`
- 页面显示: "Error: Network Error"
- 连接状态: "Disconnected"

## 未检查的可能性
- Vercel 环境变量是否真的生效
- Supabase 项目是否正常运行（可能暂停或配置问题）
- Supabase Realtime WebSocket 是否可用
- CORS 配置是否正确
- Supabase anon key 是否有效

## 建议
需要 investor 协助：
1. 检查 Supabase 项目状态
2. 检查 Vercel 环境变量配置界面
3. 检查 Supabase Realtime 服务是否启用