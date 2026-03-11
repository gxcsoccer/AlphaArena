# AlphaArena 部署指南

本指南涵盖 AlphaArena 在生产环境的完整部署流程，包括 Vercel、Railway 和 Render 三个主流平台。

## 📋 部署前准备

### 1. 数据库设置（Supabase）

#### 创建 Supabase 项目

1. 访问 [Supabase](https://supabase.com)
2. 点击 "New Project"
3. 填写项目信息：
   - Name: AlphaArena
   - Database Password: （保存好密码）
   - Region: 选择离用户最近的区域
4. 等待项目创建完成（约 2 分钟）

#### 获取数据库凭证

1. 进入项目设置 → API
2. 复制以下值：
   - **Project URL**: `https://xxx.supabase.co`
   - **anon/public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **service_role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`（仅用于 Edge Functions）

#### 运行数据库迁移

**方法 A: Supabase CLI（推荐）**

```bash
# 安装 Supabase CLI
npm install -g supabase

# 登录
supabase login

# 链接项目
supabase link --project-ref <your-project-ref>

# 应用迁移
supabase db push
```

**方法 B: 手动执行 SQL**

1. 进入 Supabase Dashboard → SQL Editor
2. 运行 `supabase/migrations/20260311_create_tables.sql`
3. 运行 `supabase/migrations/20260311_create_leaderboard_snapshots.sql`

#### 启用 Realtime 功能

1. 进入 Supabase Dashboard → Database → Replication
2. 为以下表启用 Realtime：
   - `trades`
   - `portfolios`
   - `strategies`
   - `leaderboard_entries`
3. 点击每个表的 "Enable" 按钮

#### 部署 Edge Functions

AlphaArena 使用 Supabase Edge Functions 替代传统 REST API：

```bash
# 部署所有 Edge Functions
supabase functions deploy get-stats
supabase functions deploy get-strategies
supabase functions deploy get-trades
supabase functions deploy get-portfolios
supabase functions deploy get-leaderboard
```

Edge Functions 会自动部署到：
- `https://<project-ref>.supabase.co/functions/v1/<function-name>`

### 2. 环境变量准备

创建 `.env.local` 文件（不要提交到 Git）：

```bash
# 从模板复制
cp .env.example .env.local

# 编辑文件
nano .env.local
```

必填变量：
```env
# Supabase 配置
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Edge Functions 配置（本地开发可选）
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**注意**：AlphaArena 现在完全基于 Supabase，不再需要独立的 API 服务器。前端直接通过 Supabase 客户端和 Edge Functions 获取数据。

---

## 🚀 部署方案

### 方案 A: Vercel（前端部署）⭐ 推荐

**优点:**
- 自动 HTTPS
- 全球 CDN
- 零配置部署
- 免费额度充足
- 与 Supabase 完美集成

**缺点:**
- 仅用于前端部署（后端使用 Supabase Edge Functions）

#### 步骤

**1. 安装 Vercel CLI**

```bash
npm install -g vercel
```

**2. 部署前端**

```bash
# 登录
vercel login

# 部署
vercel --prod
```

**3. 配置环境变量**

在 Vercel Dashboard → Project Settings → Environment Variables 添加：

| Variable | Value | Environment |
|----------|-------|-------------|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Production |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Production |

**4. 配置自定义域名（可选）**

```bash
vercel domains add alphaarena.example.com
```

**5. 验证部署**

访问 `https://your-app.vercel.app` 检查应用是否正常运行。

---

### 方案 B: Railway / Render（仅用于策略执行引擎）

**注意**：AlphaArena 的前端和 API 层现在完全基于 Supabase。Railway 或 Render 仅用于部署策略执行引擎（如果需要持续运行的交易机器人）。

#### 部署策略执行引擎

**1. 安装 CLI**

```bash
# Railway
npm install -g @railway/cli

# 或 Render
# 使用 Render Dashboard 网页界面
```

**2. 配置环境变量**

```bash
# Supabase 配置
railway variables set SUPABASE_URL=https://xxx.supabase.co
railway variables set SUPABASE_ANON_KEY=eyJ...
railway variables set SUPABASE_SERVICE_ROLE_KEY=eyJ...

# LLM 配置（如果使用 AI 策略）
railway variables set LLM_API_KEY=sk-...
railway variables set LLM_MODEL=gpt-4

# 其他配置
railway variables set LOG_LEVEL=info
```

**3. 部署**

```bash
# Railway
railway up

# 或使用 Render Dashboard 部署
```

**4. 运行策略引擎**

```bash
# 启动交易引擎
node dist/index.js
```

---

## 🔧 部署后验证

### 1. 健康检查

```bash
# 测试前端部署
curl https://your-app.vercel.app

# 测试 Supabase 连接
curl -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  "https://your-project.supabase.co/rest/v1/strategies?limit=1"
```

### 2. 测试 Supabase Realtime

在浏览器控制台：
```javascript
// 检查 Realtime 连接
const { data, error } = await supabase
  .channel('test')
  .on('system', { event: '*' }, payload => {
    console.log('Realtime working!', payload)
  })
  .subscribe()

console.log('Subscription status:', data?.status)
```

### 3. 测试 Edge Functions

```bash
# 测试 Stats 函数
curl "https://your-project.supabase.co/functions/v1/get-stats"

# 测试 Strategies 函数
curl "https://your-project.supabase.co/functions/v1/get-strategies"

# 测试 Trades 函数
curl "https://your-project.supabase.co/functions/v1/get-trades?limit=10"
```

### 4. 访问 Web 界面

打开浏览器访问：`https://your-app.vercel.app`

检查以下页面：
- `/dashboard` - 仪表盘
- `/strategies` - 策略管理
- `/trades` - 交易历史
- `/holdings` - 投资组合
- `/leaderboard` - 排行榜

### 5. 验证 Realtime 更新

1. 打开两个浏览器标签页
2. 在一个标签页创建新策略或交易
3. 检查另一个标签页是否自动更新

---

## 📊 监控和维护

### 日志查看

**Vercel:**
```bash
vercel logs
```

**Railway:**
```bash
railway logs
```

**Render:**
- Dashboard → Logs 标签页

### 性能监控

**关键指标:**
- API 响应时间 (< 200ms)
- WebSocket 连接数
- 数据库查询时间
- LLM API 调用成功率
- 每日 Token 使用量

**设置告警:**
- Railway: Dashboard → Alerts
- Render: Dashboard → Alerts
- Vercel: Dashboard → Analytics

### 数据库备份

**Supabase 自动备份:**
- 免费计划：7 天保留
- Pro 计划：30 天保留
- 手动备份：Dashboard → Database → Backups

---

## 🔐 安全最佳实践

### 1. 密钥管理

- ✅ 使用平台环境变量（不要硬编码）
- ✅ 定期轮换 API Keys
- ✅ 使用强 SESSION_SECRET
- ❌ 不要提交 `.env` 文件到 Git
- ❌ 不要在代码中暴露 Service Role Key

### 2. CORS 配置

在 `src/api/server.ts` 中配置允许的源：

```typescript
app.use(cors({
  origin: ['https://your-domain.com', 'https://your-app.vercel.app'],
  credentials: true,
}));
```

### 3. 速率限制

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 每个 IP 最多 100 次请求
});

app.use('/api/', limiter);
```

### 4. HTTPS 强制

Vercel/Railway/Render 默认启用 HTTPS，无需额外配置。

---

## 💰 成本估算

### 开发/测试环境

| 服务 | 免费额度 | 预计成本 |
|------|---------|---------|
| Vercel | 100GB 带宽/月 | $0 |
| Supabase | 500MB 数据库，50K 月活用户 | $0 |
| Supabase Edge Functions | 50K 请求/月 | $0 |
| Supabase Realtime | 2 百万消息/月 | $0 |
| LLM API（可选） | - | $10-20/月 |
| **总计** | | **$0-20/月** |

### 生产环境

| 服务 | 配置 | 预计成本 |
|------|------|---------|
| Vercel | Pro（可选） | $0-20/月 |
| Supabase | Pro | $25/月 |
| Supabase Edge Functions | 额外请求 | $0-10/月 |
| Supabase Realtime | 额外消息 | $0-10/月 |
| LLM API（可选） | 中等使用量 | $50-100/月 |
| Railway/Render（策略引擎） | Standard | $7-20/月 |
| **总计** | | **$82-185/月** |

---

## 🆘 常见问题

### Q: Supabase Realtime 连接失败

**A:** 检查以下几点：
1. 确保在 Supabase Dashboard 启用了 Realtime
2. 检查表是否在 Replication 列表中
3. 验证 `VITE_SUPABASE_ANON_KEY` 是否正确
4. 查看浏览器控制台错误日志

### Q: Edge Functions 返回 404

**A:** 
1. 确认函数已部署：`supabase functions list`
2. 检查函数名称是否正确
3. 验证项目引用是否正确链接
4. 重新部署函数：`supabase functions deploy <function-name>`

### Q: 数据库权限错误

**A:**
1. 检查 Row Level Security (RLS) 策略
2. 确保 Anon Key 有读取权限
3. 查看 Supabase Logs 了解详细错误
4. 必要时创建宽松的 RLS 策略用于测试

### Q: 前端页面空白

**A:**
1. 检查浏览器控制台错误
2. 验证 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY` 环境变量
3. 确保 Supabase 项目正常运行
4. 清除浏览器缓存并硬刷新（Ctrl+Shift+R）

### Q: Realtime 更新不工作

**A:**
1. 确认表已启用 Replication
2. 检查订阅是否正确创建
3. 验证数据库变更是否触发 Realtime 事件
4. 查看 Supabase Realtime 日志

---

## 📚 相关文档

- [README.md](./README.md) - 项目介绍和使用指南
- [CHANGELOG.md](./CHANGELOG.md) - 版本更新记录
- [AGENTS.md](./AGENTS.md) - 开发代理指南
- [ENV_REFERENCE.md](./ENV_REFERENCE.md) - 环境变量参考

### Supabase 资源

- [Supabase 文档](https://supabase.com/docs)
- [Edge Functions 指南](https://supabase.com/docs/guides/functions)
- [Realtime 文档](https://supabase.com/docs/guides/realtime)
- [RLS 策略指南](https://supabase.com/docs/guides/auth/row-level-security)

### 部署平台

- [Vercel 文档](https://vercel.com/docs)
- [Railway 文档](https://docs.railway.app)
- [Render 文档](https://render.com/docs)

---

**部署愉快！** 🚀

如有问题，请提交 Issue 或联系开发团队。
