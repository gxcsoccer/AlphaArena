# Supabase 迁移指南

本文档介绍如何从传统的 REST API + WebSocket 架构迁移到 Supabase 完整解决方案。

## 🎯 迁移目标

- ✅ 移除独立的 REST API 服务器
- ✅ 移除 WebSocket 服务器（Socket.IO）
- ✅ 使用 Supabase 客户端直接查询数据库
- ✅ 使用 Supabase Realtime 实现实时推送
- ✅ 使用 Supabase Edge Functions 处理复杂查询

## 📋 迁移步骤

### 1. 设置 Supabase 项目

```bash
# 安装 Supabase CLI
npm install -g supabase

# 登录
supabase login

# 初始化项目（如果还没有）
supabase init

# 链接到云端项目
supabase link --project-ref <your-project-ref>
```

### 2. 运行数据库迁移

```bash
# 应用所有迁移
supabase db push

# 或手动运行 SQL 文件
# 在 Supabase Dashboard → SQL Editor 中执行：
# - supabase/migrations/20260311_create_tables.sql
# - supabase/migrations/20260311_create_leaderboard_snapshots.sql
```

### 3. 启用 Realtime

在 Supabase Dashboard → Database → Replication：

1. 找到 `trades` 表 → 点击 "Enable"
2. 找到 `portfolios` 表 → 点击 "Enable"
3. 找到 `strategies` 表 → 点击 "Enable"
4. 找到 `leaderboard_entries` 表 → 点击 "Enable"

### 4. 部署 Edge Functions

```bash
# 部署所有 Edge Functions
supabase functions deploy get-stats
supabase functions deploy get-strategies
supabase functions deploy get-trades
supabase functions deploy get-portfolios
supabase functions deploy get-leaderboard

# 验证部署
supabase functions list
```

### 5. 更新环境变量

复制 `.env.example` 到 `.env.local`：

```bash
cp .env.example .env.local
```

编辑 `.env.local`，填入 Supabase 配置：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 6. 更新前端代码

前端代码已经更新，使用新的 Supabase 客户端：

**旧代码（已废弃）：**
```typescript
import { api, WebSocketClient } from './utils/api'

// REST API 调用
const strategies = await api.getStrategies()

// WebSocket 连接
const ws = new WebSocketClient()
await ws.connect()
ws.on('trade:new', handleTrade)
```

**新代码：**
```typescript
import { api, RealtimeClient } from './utils/api'

// Supabase 查询（相同的 API）
const strategies = await api.getStrategies()

// Realtime 订阅（相同的 API）
const ws = new RealtimeClient()
await ws.connect()
ws.on('trade:new', handleTrade)
```

**代码完全向后兼容！** 不需要修改组件代码。

### 7. 部署前端

```bash
# 安装 Vercel CLI
npm install -g vercel

# 登录
vercel login

# 部署
vercel --prod
```

在 Vercel Dashboard 配置环境变量：
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 8. 验证迁移

1. **测试数据查询**
   ```bash
   curl "https://your-project.supabase.co/functions/v1/get-strategies"
   ```

2. **测试 Realtime 更新**
   - 打开两个浏览器标签页
   - 在一个标签页创建新策略
   - 检查另一个标签页是否自动更新

3. **检查性能**
   - 页面加载时间
   - 数据更新延迟
   - 网络请求数量

## 🔄 架构对比

### 迁移前

```
┌─────────────┐     HTTP      ┌──────────────┐     WebSocket     ┌─────────────┐
│   Frontend  │ ────────────> │ API Server   │ <───────────────> │  WebSocket  │
│   (React)   │ <──────────── │ (Express)    │                 │   Server    │
└─────────────┘     JSON      └──────┬───────┘                 └─────────────┘
                                     │
                                     │ SQL
                                     ↓
                              ┌─────────────┐
                              │  Supabase   │
                              │  Database   │
                              └─────────────┘
```

### 迁移后

```
┌─────────────┐   Supabase Client  ┌─────────────┐
│   Frontend  │ ─────────────────> │  Supabase   │
│   (React)   │ <───────────────── │  Database   │
└─────────────┘   Realtime         └──────┬──────┘
     │                                    │
     │ Edge Function                      │ SQL
     ↓                                    ↓
┌─────────────┐                    ┌─────────────┐
│    Edge     │                    │  Supabase   │
│  Functions  │                    │  Realtime   │
└─────────────┘                    └─────────────┘
```

**优势：**
- ✅ 减少服务器数量（从 3 个到 0 个）
- ✅ 降低延迟（直接数据库连接）
- ✅ 简化部署（无需管理 API 服务器）
- ✅ 自动扩展（Supabase 处理）
- ✅ 降低成本（Serverless 计费）

## 📦 依赖变更

### 移除的依赖（可选）

```bash
# 如果不再需要独立的 API 服务器，可以移除：
npm uninstall express cors socket.io
```

### 保留的依赖

```bash
# Supabase 客户端（已安装）
npm list @supabase/supabase-js
```

## 🔧 配置检查清单

- [ ] Supabase 项目已创建
- [ ] 数据库迁移已运行
- [ ] Realtime 已为所有表启用
- [ ] Edge Functions 已部署
- [ ] 环境变量已配置
- [ ] 前端已部署
- [ ] Realtime 更新已验证
- [ ] 性能测试通过

## 🐛 常见问题

### Q: Realtime 订阅不工作

**A:** 确保：
1. 表已启用 Replication
2. 使用了正确的表名（`public.table_name`）
3. 订阅逻辑在 `useEffect` 中正确清理

### Q: Edge Functions 返回 404

**A:** 
1. 检查函数名称是否正确
2. 确认函数已部署：`supabase functions list`
3. 验证项目引用：`supabase projects list`

### Q: 权限错误

**A:** 
1. 检查 RLS 策略
2. 确保 Anon Key 有读取权限
3. 查看 Supabase Logs

### Q: 类型错误

**A:** 
1. 使用 `src/client/utils/supabase.ts` 中的类型定义
2. 运行 `tsc` 检查类型错误
3. 更新数据库类型：`supabase gen types typescript --local > src/client/utils/supabase.ts`

## 📊 性能优化建议

### 1. 使用索引

确保常用查询字段有索引：

```sql
CREATE INDEX IF NOT EXISTS idx_trades_strategy_id ON trades(strategy_id);
CREATE INDEX IF NOT EXISTS idx_trades_executed_at ON trades(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_portfolios_strategy_id ON portfolios(strategy_id);
```

### 2. 分页查询

对于大量数据，使用分页：

```typescript
const { data } = await supabase
  .from('trades')
  .select('*')
  .range(0, 99) // 第一页
  .order('executed_at', { ascending: false })
```

### 3. 选择性订阅

只订阅需要的表和数据：

```typescript
// 只订阅特定策略的交易
client.subscribeToTrades(handleTrade, { strategyId: 'xxx' })
```

### 4. 缓存策略

对于不常变化的数据，使用 React Query 或 SWR：

```bash
npm install @tanstack/react-query
```

## 🎉 迁移完成！

恭喜！你现在拥有一个：
- ✅ 无服务器的架构
- ✅ 实时更新的界面
- ✅ 简化的部署流程
- ✅ 更低的运营成本

如有问题，请查看 [DEPLOYMENT.md](./DEPLOYMENT.md) 或提交 Issue。
