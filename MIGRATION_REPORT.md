# Railway 到 Supabase 迁移报告

**日期**: 2026-03-12  
**状态**: ✅ REST API 迁移完成 | ⚠️ WebSocket 保留 Railway

## 执行摘要

成功将 AlphaArena 后端的 REST API 部分从 Railway 迁移到 Supabase Edge Functions。由于 Supabase 不支持 WebSocket 长连接，WebSocket 服务暂时保留在 Railway。

## 完成的工作

### 1. Supabase 项目配置 ✅
- 链接到现有 Supabase 项目 (`plnylmnckssnfpwznpwf`)
- 验证数据库连接正常
- 确认现有数据表结构完整

### 2. Edge Functions 部署 ✅

部署了 13 个 Supabase Edge Functions：

| 函数名 | 端点 | 状态 |
|--------|------|------|
| get-stats | `/functions/v1/get-stats` | ✅ ACTIVE |
| get-strategies | `/functions/v1/get-strategies` | ✅ ACTIVE |
| get-trades | `/functions/v1/get-trades` | ✅ ACTIVE |
| get-portfolios | `/functions/v1/get-portfolios` | ✅ ACTIVE |
| get-leaderboard | `/functions/v1/get-leaderboard` | ✅ ACTIVE |
| create-strategy | `/functions/v1/create-strategy` | ✅ ACTIVE |
| update-strategy | `/functions/v1/update-strategy` | ✅ ACTIVE |
| get-orderbook | `/functions/v1/get-orderbook` | ✅ ACTIVE |
| get-market-tickers | `/functions/v1/get-market-tickers` | ✅ ACTIVE |
| create-order | `/functions/v1/create-order` | ✅ ACTIVE |
| refresh-leaderboard | `/functions/v1/refresh-leaderboard` | ✅ ACTIVE |
| get-leaderboard-snapshot | `/functions/v1/get-leaderboard-snapshot` | ✅ ACTIVE |
| get-strategy-rank | `/functions/v1/get-strategy-rank` | ✅ ACTIVE |

### 3. 前端适配 ✅
- 更新 `src/client/utils/api.ts` 支持 Supabase Functions 端点映射
- 添加自动端点转换逻辑（`/api/xxx` → `get-xxx`）
- 更新环境变量配置

### 4. 配置文件更新 ✅
- 更新 `.env.example` 使用 Supabase URL
- 更新 `.env.production` 使用 Supabase URL
- 更新 `DEPLOYMENT.md` 文档说明新架构

### 5. 构建验证 ✅
- 前端构建成功 (`npm run build:client`)
- 无编译错误

## 技术限制

### WebSocket 不支持 ⚠️

**问题**: Supabase Edge Functions 基于 Deno，不支持：
- 长时间运行的 Node.js 进程
- Socket.IO WebSocket 连接
- 自定义 TCP/UDP 服务器

**当前解决方案**: 
- WebSocket 服务保留在 Railway
- 前端继续使用 `VITE_WS_URL` 连接到 Railway

**替代方案**（需要额外工作）:
1. **Supabase Realtime**: 使用 Supabase 内置的 Realtime 功能替代 Socket.IO
   - 需要重写前端 WebSocket 客户端
   - 仅支持 Postgres 变更订阅，不支持自定义事件

2. **迁移到其他平台**: 将 WebSocket 服务迁移到支持长连接的平台
   - Render (支持 WebSocket)
   - Fly.io (支持 WebSocket)
   - Railway (保持现状)

3. **轮询替代**: 移除 WebSocket，改用 HTTP 轮询
   - 增加服务器负载
   - 实时性降低

## 环境变量

### 生产环境配置

```bash
# Vercel 环境变量
VITE_API_URL=https://plnylmnckssnfpwznpwf.supabase.co/functions/v1
VITE_WS_URL=wss://alphaarena-production.up.railway.app

# Supabase Edge Functions 环境变量（在 Supabase Dashboard 配置）
SUPABASE_URL=https://plnylmnckssnfpwznpwf.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<从 Supabase Dashboard 获取>
```

## 部署流程

### 部署 Edge Functions

```bash
# 部署单个函数
supabase functions deploy <function-name>

# 部署所有函数
for func in supabase/functions/*/; do
  supabase functions deploy $(basename $func)
done
```

### 部署前端

```bash
# 构建
npm run build:client

# 部署到 Vercel
vercel --prod
```

## 验证清单

- [ ] 测试所有 REST API 端点
- [ ] 验证前端能正常加载数据
- [ ] 测试 WebSocket 连接（Railway）
- [ ] 验证 CORS 配置
- [ ] 监控 Supabase 函数日志
- [ ] 性能测试和负载测试

## 下一步建议

### 短期（Sprint 2）
1. **验证 API 功能**: 在测试环境验证所有 API 端点正常工作
2. **监控和日志**: 设置 Supabase 函数日志监控
3. **性能优化**: 优化函数冷启动时间

### 中期（Sprint 3-4）
1. **WebSocket 迁移评估**: 决定是否迁移到 Supabase Realtime 或其他平台
2. **成本优化**: 评估 Supabase 和 Railway 的成本
3. **自动化部署**: 设置 CI/CD 自动部署 Edge Functions

### 长期
1. **完全去 Railway**: 如果可能，完全迁移到 Supabase 生态
2. **功能增强**: 利用 Supabase 的其他功能（Auth, Storage 等）

## 支持资源

- [Supabase Edge Functions 文档](https://supabase.com/docs/guides/functions)
- [Supabase Realtime 文档](https://supabase.com/docs/guides/realtime)
- [Vercel 部署文档](https://vercel.com/docs)

## 联系

如有问题，请查看：
- Supabase Dashboard: https://supabase.com/dashboard/project/plnylmnckssnfpwznpwf
- Vercel Dashboard: https://vercel.com/dashboard
