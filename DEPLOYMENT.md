# 生产环境部署指南

## 快速导航

- [部署检查清单](./docs/deployment/DEPLOYMENT_CHECKLIST.md) - 部署前后必检项目
- [回滚流程](./docs/deployment/ROLLBACK_PROCEDURE.md) - 出现问题时的快速恢复方案
- [生产监控配置](./docs/deployment/PRODUCTION_MONITORING.md) - 监控告警配置指南

## 架构概述

AlphaArena 采用混合部署架构：

- **前端**: Vercel (静态托管)
- **REST API**: Supabase Edge Functions (无服务器函数)
- **WebSocket**: Railway (长连接服务)
- **数据库**: Supabase Postgres

### 为什么采用混合架构？

Supabase Edge Functions 基于 Deno，不支持长时间运行的 Node.js 服务和 WebSocket 长连接。因此：
- REST API 迁移到 Supabase Edge Functions
- WebSocket 服务暂时保留在 Railway

## 环境变量配置

### Vercel 环境变量设置

在 Vercel 控制台中为项目设置以下环境变量：

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择 AlphaArena 项目
3. 进入 **Settings** → **Environment Variables**
4. 添加以下变量：

| Variable Name | Development | Production |
|--------------|-------------|------------|
| `VITE_API_URL` | `http://localhost:3001` | `https://plnylmnckssnfpwznpwf.supabase.co/functions/v1` |
| `VITE_SUPABASE_URL` | `https://plnylmnckssnfpwznpwf.supabase.co` | `https://plnylmnckssnfpwznpwf.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | (从 Supabase Dashboard) | (从 Supabase Dashboard) |

**注意**：WebSocket 功能已迁移至 Supabase Realtime，无需配置独立的 WebSocket URL。

### Supabase 环境变量

在 Supabase 项目中配置以下环境变量（Settings → Edge Functions）：

- `SUPABASE_URL`: `https://plnylmnckssnfpwznpwf.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: (从 API 设置获取)

### 本地构建生产版本

```bash
# 创建 .env.production.local 文件
cp .env.production .env.production.local

# 编辑 .env.production.local，填入实际的生产环境 URL

# 构建生产版本
npm run build:client

# 预览生产版本
vercel dev

# 部署到生产环境
vercel --prod
```

## 故障排查

### 页面白屏

1. 打开浏览器开发者工具（F12）
2. 查看 Console 中的错误信息
3. 检查 Network 标签中的 API 请求是否成功

### DNS 配置问题（页面显示占位页）

如果页面显示 "We're under construction" 或其他占位内容：

1. 检查 DNS 解析：`dig alphaarena.app +short`
2. 如果返回 Squarespace IP（198.49.23.* 或 198.185.159.*），说明 DNS 指向错误
3. 参考详细解决方案：[DNS_CONFIGURATION.md](./docs/deployment/DNS_CONFIGURATION.md)

### API 请求失败

- 确认 `VITE_API_URL` 配置正确（应为 Supabase Functions URL）
- 检查 Supabase Edge Functions 是否已部署：`supabase functions list`
- 确认 CORS 配置允许前端域名访问
- 查看 Supabase Dashboard 中的函数日志

### Supabase Edge Functions 错误

1. 检查函数日志：
   ```bash
   supabase functions logs <function-name>
   ```

2. 重新部署函数：
   ```bash
   supabase functions deploy <function-name>
   ```

3. 验证环境变量：
   - 确保 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 已配置

### WebSocket 连接失败

- 确认 `VITE_WS_URL` 配置正确
- 检查后端 WebSocket 服务是否正常运行
- 确认防火墙/安全组允许 WebSocket 连接

### lightweight-charts 错误

如果看到 `addCandlestickSeries is not a function` 错误：

1. 确认 lightweight-charts 版本 >= 4.0
2. 检查是否正确导入：`import { createChart } from 'lightweight-charts'`
3. 确认 chart 对象已正确初始化

## 回滚部署

如果生产环境出现问题，可以快速回滚：

```bash
# 查看之前的部署
vercel ls

# 回滚到指定部署
vercel alias set <DEPLOYMENT_URL> production
```

或在 Vercel Dashboard 中进行回滚操作。
