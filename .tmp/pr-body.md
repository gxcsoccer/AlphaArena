## 问题描述

Issue: #771 - 生产环境后端服务不可用 - Network Error

## 根因分析

1. **DNS 配置错误**: `alphaarena.app` 指向 Squarespace 停放页面，而非 Vercel
   - 需要 investor 在 Google Domains 修改 DNS 配置
   - A 记录应指向: `76.76.21.21`

2. **WebSocket URL 无效**: `VITE_WS_URL` 配置指向已下线的 Railway 服务
   - Railway WebSocket 服务返回 404 "Application not found"
   - WebSocket 功能已迁移至 Supabase Realtime

## 本次修复

虽然主要问题是 DNS 配置，但本次修复清理了过时的配置：

1. **移除无效 WebSocket URL**
   - 从 `.env.production` 移除 `VITE_WS_URL`
   - 从 Vercel 环境变量移除 `VITE_WS_URL`

2. **更新 CORS 配置**
   - 更新 `src/api/server.ts` 的 ALLOWED_ORIGINS
   - 更新 `src/server-start.ts` 的 corsOrigin 数组
   - 添加正确的生产域名

3. **更新文档**
   - `DEPLOYMENT.md`: 移除 WebSocket URL 配置说明
   - `DEPLOYMENT_CHECKLIST.md`: 替换 Railway WebSocket 检查为 Supabase Realtime
   - `docs/sdk/alphaarena-sdk.ts`: 更新默认 baseUrl

## 测试验证

- 客户端构建成功 (`npm run build:client`)
- 配置测试通过 (22 tests)

## 后续操作

DNS 修复需要 investor 在 Google Domains 执行：
- A 记录: `alphaarena.app` -> `76.76.21.21`
- CNAME: `www` -> `cname.vercel-dns.com`

临时访问: `https://alphaarena.vercel.app`（DNS 生效前）

## 相关 Issue

Fixes #771