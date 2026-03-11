# Supabase Edge Functions

AlphaArena 使用 Supabase Edge Functions 替代传统 REST API，提供无服务器的数据查询接口。

## 📁 函数列表

### 1. get-stats

获取平台统计数据。

**端点：** `GET /functions/v1/get-stats`

**响应：**
```json
{
  "success": true,
  "data": {
    "totalStrategies": 10,
    "activeStrategies": 5,
    "totalTrades": 1234,
    "totalVolume": 5678900,
    "buyTrades": 700,
    "sellTrades": 534
  }
}
```

### 2. get-strategies

获取策略列表。

**端点：** `GET /functions/v1/get-strategies?status=active&symbol=BTC/USDT`

**查询参数：**
- `status` (可选): 筛选状态 (`active`, `paused`, `stopped`)
- `symbol` (可选): 筛选交易对

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "SMA Crossover",
      "description": "Simple moving average crossover strategy",
      "symbol": "BTC/USDT",
      "status": "active",
      "config": { "shortPeriod": 10, "longPeriod": 20 },
      "createdAt": "2026-03-10T00:00:00Z",
      "updatedAt": "2026-03-11T00:00:00Z"
    }
  ]
}
```

### 3. get-trades

获取交易记录。

**端点：** `GET /functions/v1/get-trades?strategyId=xxx&symbol=BTC/USDT&side=buy&limit=100&offset=0`

**查询参数：**
- `strategyId` (可选): 筛选策略
- `symbol` (可选): 筛选交易对
- `side` (可选): 筛选方向 (`buy`, `sell`)
- `limit` (可选): 返回数量限制 (默认 100)
- `offset` (可选): 偏移量 (默认 0)

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "strategyId": "uuid",
      "symbol": "BTC/USDT",
      "side": "buy",
      "price": 50000,
      "quantity": 0.1,
      "total": 5000,
      "fee": 5,
      "executedAt": "2026-03-11T00:00:00Z"
    }
  ]
}
```

### 4. get-portfolios

获取持仓数据。

**端点：** `GET /functions/v1/get-portfolios?strategyId=xxx&symbol=BTC/USDT`

**查询参数：**
- `strategyId` (可选): 筛选策略
- `symbol` (可选): 筛选交易对

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "strategyId": "uuid",
    "symbol": "BTC/USDT",
    "baseCurrency": "BTC",
    "quoteCurrency": "USDT",
    "cashBalance": 10000,
    "positions": [
      {
        "symbol": "BTC",
        "quantity": 0.5,
        "averageCost": 48000
      }
    ],
    "totalValue": 34000,
    "snapshotAt": "2026-03-11T00:00:00Z"
  }
}
```

### 5. get-leaderboard

获取排行榜。

**端点：** `GET /functions/v1/get-leaderboard?sortBy=roi`

**查询参数：**
- `sortBy` (可选): 排序字段
  - `roi` (默认)
  - `sharpeRatio`
  - `maxDrawdown`
  - `totalPnL`
  - `winRate`
  - `totalVolume`

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "strategyId": "uuid",
      "strategyName": "SMA Crossover",
      "status": "active",
      "metrics": {
        "totalTrades": 100,
        "totalVolume": 500000,
        "totalPnL": 50000,
        "roi": 25.5,
        "winRate": 65.0,
        "sharpeRatio": 1.5,
        "maxDrawdown": 10.2,
        "avgTradeSize": 5000,
        "profitableTrades": 65,
        "losingTrades": 35,
        "consecutiveWins": 5,
        "consecutiveLosses": 2,
        "bestTrade": 5000,
        "worstTrade": -1000,
        "calculatedAt": "2026-03-11T00:00:00Z"
      },
      "rankChange": 0
    }
  ]
}
```

## 🚀 部署

### 本地测试

```bash
# 启动本地 Supabase
supabase start

# 部署函数到本地
supabase functions serve get-stats --env-file .env.local

# 测试
curl http://localhost:54321/functions/v1/get-stats
```

### 生产部署

```bash
# 登录
supabase login

# 链接项目
supabase link --project-ref <your-project-ref>

# 部署所有函数
supabase functions deploy get-stats
supabase functions deploy get-strategies
supabase functions deploy get-trades
supabase functions deploy get-portfolios
supabase functions deploy get-leaderboard

# 验证部署
supabase functions list
```

## 🔐 安全

### 环境变量

Edge Functions 使用以下环境变量：

- `SUPABASE_URL`: Supabase 项目 URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service Role Key（用于后端操作）

**注意：** Service Role Key 绕过 RLS 策略，仅用于 Edge Functions，不要在前端使用。

### CORS

所有函数都配置了 CORS 头，允许跨域请求：

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

生产环境中，建议限制为特定域名：

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://your-domain.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

## 📊 监控

### 查看日志

```bash
# 实时日志
supabase functions logs get-stats

# 所有函数日志
supabase functions logs
```

### 性能指标

在 Supabase Dashboard → Functions 查看：
- 请求次数
- 平均响应时间
- 错误率
- 资源使用量

## 🧪 测试

### 使用 curl 测试

```bash
# 设置环境变量
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="eyJ..."

# 测试 get-stats
curl "$SUPABASE_URL/functions/v1/get-stats" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"

# 测试 get-strategies
curl "$SUPABASE_URL/functions/v1/get-strategies?status=active" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"

# 测试 get-trades
curl "$SUPABASE_URL/functions/v1/get-trades?limit=10" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"
```

### 在浏览器中测试

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = 'eyJ...'

// 测试 get-stats
fetch(`${SUPABASE_URL}/functions/v1/get-stats`, {
  headers: {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  },
})
  .then(res => res.json())
  .then(data => console.log(data))
```

## 📝 开发新函数

### 模板

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.0'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Your logic here

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
```

### 目录结构

```
supabase/
├── functions/
│   ├── get-stats/
│   │   └── index.ts
│   ├── get-strategies/
│   │   └── index.ts
│   ├── get-trades/
│   │   └── index.ts
│   ├── get-portfolios/
│   │   └── index.ts
│   └── get-leaderboard/
│       └── index.ts
├── migrations/
└── config.toml
```

## 🔗 相关资源

- [Supabase Edge Functions 文档](https://supabase.com/docs/guides/functions)
- [Deno 标准库](https://deno.land/std)
- [Supabase JS 客户端](https://github.com/supabase/supabase-js)
