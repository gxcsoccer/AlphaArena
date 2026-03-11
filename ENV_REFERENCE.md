# 环境变量快速参考

## 必需变量

### 数据库配置 (Supabase)
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### LLM API 配置
```env
LLM_API_KEY=sk-your-api-key-here
LLM_API_URL=https://api.openai.com/v1
```

### 应用配置
```env
API_BASE_URL=https://your-app.vercel.app
SESSION_SECRET=your-random-secret-key
```

---

## 可选变量

### LLM 模型配置
```env
LLM_MODEL=gpt-4
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=1000
```

### 成本控制
```env
LLM_REQUESTS_PER_MINUTE=60
LLM_DAILY_BUDGET=10
```

### 策略配置
```env
LLM_MIN_CONFIDENCE=0.7
LLM_MAX_RISK_LEVEL=medium
LLM_COOLDOWN_PERIOD=5000
```

### 服务器配置
```env
PORT=3001
LOG_LEVEL=info
ENABLE_LOGGING=true
```

### WebSocket 配置
```env
WS_PING_INTERVAL=30000
WS_PING_TIMEOUT=5000
```

### 交易引擎配置
```env
INITIAL_CASH=100000
DEFAULT_QUANTITY=1
```

### 排行榜配置
```env
LEADERBOARD_REFRESH_INTERVAL=60
LEADERBOARD_SNAPSHOT_RETENTION_DAYS=30
```

### 安全配置
```env
RATE_LIMIT_PER_MINUTE=100
CORS_ORIGINS=https://your-app.vercel.app
```

---

## 平台特定变量

### Vercel
```env
VERCEL=1
VERCEL_ENV=production
VITE_API_URL=https://your-app.vercel.app
```

### Railway
```env
RAILWAY_ENVIRONMENT=production
RAILWAY_STATIC_URL=https://your-app.railway.app
PORT=3001  # Railway 会自动设置
```

### Render
```env
RENDER=true
RENDER_EXTERNAL_URL=https://your-app.onrender.com
PORT=3001  # Render 会自动设置
```

---

## 功能开关
```env
ENABLE_STRATEGY_COMMUNICATION=false
ENABLE_STRATEGY_PERSISTENCE=true
ENABLE_LEADERBOARD_SNAPSHOTS=true
ENABLE_PRICE_HISTORY=true
```

---

## 获取方式

### Supabase 凭证
1. 登录 https://supabase.com
2. 选择项目 → Settings → API
3. 复制 Project URL 和 anon key

### OpenAI API Key
1. 登录 https://platform.openai.com
2. API Keys → Create new secret key
3. 复制 Key（`sk-` 开头）

### 生成 SESSION_SECRET
```bash
# 使用 OpenSSL
openssl rand -hex 32

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 部署平台设置

### Vercel
Dashboard → Project Settings → Environment Variables

### Railway
```bash
railway variables set KEY=value
```

### Render
Dashboard → Environment 标签页

---

## 验证配置

```bash
# 检查环境变量是否设置
echo $SUPABASE_URL
echo $LLM_API_KEY

# 测试 API 健康
curl https://your-app.vercel.app/api/health

# 预期响应
{"status":"ok","timestamp":"2026-03-18T10:00:00.000Z"}
```

---

## 安全提醒

⚠️ **永远不要:**
- 提交 `.env` 文件到 Git
- 在代码中硬编码 API Keys
- 在前端暴露 Service Role Key
- 分享你的环境变量文件

✅ **应该:**
- 使用平台环境变量功能
- 定期轮换 API Keys
- 使用 `.env.example` 作为模板
- 限制环境变量访问权限
