# AlphaArena

AlphaArena 是一个 AI 驱动的算法交易平台，提供实时交易、多策略对战、Web 可视化和 LLM 智能决策功能。

## 🌟 项目介绍

AlphaArena 旨在为量化交易者和 AI 开发者提供一个完整的交易策略开发、测试和竞技环境。从 CLI 回测到 Web 实时系统，AlphaArena 支持完整的交易生命周期。

### 核心特性

- **🤖 多 AI 策略对战**: 同时运行多个 AI 策略，实时竞技排名
- **📊 Web 实时可视化**: React 仪表盘，实时展示交易数据、持仓变化和收益曲线
- **🧠 LLM 智能决策**: 集成大语言模型，支持 AI 驱动的交易决策
- **📈 排行榜系统**: 多维度策略排名（ROI、夏普比率、胜率等）
- **💼 投资组合跟踪**: 实时持仓管理、盈亏计算和资产配置分析
- **🔙 回测引擎**: 基于历史数据的策略回测和绩效评估
- **📱 REST + WebSocket API**: 实时数据推送和完整的 API 接口

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Web Frontend (React)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Dashboard│  │ Strategies│  │  Trades  │  │Holdings  │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│  ┌──────────┐  ┌──────────┐                                     │
│  │Leaderboard│ │  Charts   │                                     │
│  └──────────┘  └──────────┘                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↕ (REST + WebSocket)
┌─────────────────────────────────────────────────────────────────┐
│                      Backend API (Express + Socket.IO)           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │StrategyManager│  │TradingEngine │  │LeaderboardSvc│          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │MatchingEngine│  │  LLMClient   │  │  Portfolio   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ↕ (Supabase Client)
┌─────────────────────────────────────────────────────────────────┐
│                    Database (Supabase/PostgreSQL)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │strategies│  │  trades  │  │portfolios│  │  prices  │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│  ┌──────────────────────────────────────────────────┐           │
│  │              leaderboard_snapshots               │           │
│  └──────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

### 数据流

```
市场数据 → 策略 (Strategy/LLMStrategy) → 信号 → 订单 → 订单簿 (OrderBook)
                                                    ↓
                                              撮合引擎 (MatchingEngine)
                                                    ↓
                                              成交记录 → 投资组合 (Portfolio)
                                                    ↓
                                              数据库 (Supabase)
                                                    ↓
                                        WebSocket 推送 → Web 前端
```

## 📦 安装

### 前置要求

- Node.js >= 18.0.0
- npm >= 9.0.0
- (可选) Supabase 账号 - 用于生产环境数据持久化
- (可选) LLM API Key - 用于 LLM 策略

### 安装步骤

```bash
# 克隆仓库
git clone https://github.com/gxcsoccer/AlphaArena.git
cd AlphaArena

# 安装依赖
npm install

# 构建项目
npm run build
npm run build:client
```

## 🚀 使用

### Web 界面

```bash
# 启动开发服务器（前端 + 后端）
npm run dev

# 访问 http://localhost:5173
```

### CLI 命令

```bash
# 查看帮助
npx alpha-arena --help

# 运行策略
npx alpha-arena run --strategy <strategy-name> --symbol <trading-pair>

# 运行回测
npx alpha-arena backtest --strategy <strategy-name> --start <date> --end <date>

# 查看投资组合
npx alpha-arena portfolio --show
```

### Web 页面功能

#### 1. Dashboard (`/dashboard`)
- 系统概览：策略数量、交易次数、成交量、买卖比例
- 策略状态分布（饼图）
- 策略成交量对比（柱状图）
- 最近交易记录
- 活跃策略列表（支持启动/停止控制）

#### 2. Strategies (`/strategies`)
- 策略列表（支持筛选和排序）
- 策略详情
- 策略编辑
- 启动/停止控制
- 状态标签（运行中/暂停/已停止）

#### 3. Trades (`/trades`)
- 交易历史表格（支持筛选：交易对、方向、日期范围）
- 每小时交易分布（柱状图）
- 交易量按交易对（柱状图）
- 价格趋势（面积图）

#### 4. Holdings (`/holdings`)
- 投资组合概览：总值、现金、盈亏、胜率
- 资产配置（饼图）
- 收益曲线（折线图）
- 当前持仓列表

#### 5. Leaderboard (`/leaderboard`)
- 策略排行榜（🥇🥈🥉奖牌）
- 多维度排名：ROI、夏普比率、最大回撤、总盈亏、胜率、成交量
- 排名变化指示（📈/📉）
- 策略对比雷达图
- 历史快照

## 🌐 部署指南

### 前端部署（Vercel）

AlphaArena 前端已配置好 Vercel 部署，只需连接 GitHub 仓库即可自动部署。

#### 1. 自动部署（推荐）

```bash
# 安装 Vercel CLI
npm install -g vercel

# 登录 Vercel
vercel login

# 部署到生产环境
vercel --prod
```

#### 2. 环境变量配置

在 Vercel 项目设置中添加以下环境变量：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `VITE_API_URL` | 后端 API 地址 | `https://your-api.vercel.app` |
| `SUPABASE_URL` | Supabase 项目 URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase 匿名密钥 | `eyJ...` |

#### 3. 部署配置

`vercel.json` 已配置好：
- 构建命令：`npm run build:client`
- 输出目录：`dist/client`
- API 重写规则：`/api/*` → API 函数
- WebSocket 支持：`/socket.io/*`

### 后端部署

#### 选项 A: Railway

```bash
# 1. 安装 Railway CLI
npm install -g @railway/cli

# 2. 登录 Railway
railway login

# 3. 初始化项目
railway init

# 4. 添加环境变量
railway variables set SUPABASE_URL=xxx
railway variables set SUPABASE_ANON_KEY=xxx
railway variables set LLM_API_KEY=xxx

# 5. 部署
railway up
```

Railway 会自动检测 Node.js 项目并部署。

#### 选项 B: Render

```bash
# 1. 在 Render 控制台创建新 Web Service
# 2. 连接 GitHub 仓库
# 3. 配置环境变量
# 4. 部署命令：npm install && npm run build && npm run dev:server
```

#### 选项 C: Vercel Serverless Functions

将后端 API 部署为 Vercel Serverless Functions：

```typescript
// api/index.ts
import { app } from '../src/api/server';
export default app;
```

### 数据库部署（Supabase）

#### 1. 创建 Supabase 项目

1. 访问 https://supabase.com
2. 创建新项目
3. 获取项目 URL 和 Anon Key

#### 2. 运行数据库迁移

```bash
# 安装 Supabase CLI
npm install -g supabase

# 登录 Supabase
supabase login

# 链接项目
supabase link --project-ref xxx

# 应用迁移
supabase db push
```

或者手动运行 SQL 文件：
- `supabase/migrations/20260311_create_tables.sql`
- `supabase/migrations/20260311_create_leaderboard_snapshots.sql`

#### 3. 配置环境变量

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

## 🔑 LLM API 配置

### 支持的 LLM 提供商

AlphaArena 支持任何 OpenAI 兼容的 API 接口：

- **OpenAI**: GPT-4, GPT-3.5-turbo
- **Anthropic**: Claude (通过代理)
- **国内服务**: 通义千问、文心一言等（需 OpenAI 兼容接口）

### 环境变量配置

创建 `.env` 文件（开发环境）或 `.env.production`（生产环境）：

```env
# LLM API 配置（必需）
LLM_API_KEY=your-api-key-here
LLM_API_URL=https://api.openai.com/v1

# LLM 模型配置（可选）
LLM_MODEL=gpt-4
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=1000

# 速率限制配置（可选）
LLM_REQUESTS_PER_MINUTE=60
LLM_DAILY_BUDGET=10

# 策略配置（可选）
LLM_MIN_CONFIDENCE=0.7
LLM_MAX_RISK_LEVEL=medium
LLM_COOLDOWN_PERIOD=5000
```

### LLM 策略使用示例

```typescript
import { LLMStrategy } from './src/strategy/LLMStrategy';

const strategy = new LLMStrategy({
  id: 'llm-btc',
  name: 'LLM BTC Strategy',
  params: {
    llm: {
      model: 'gpt-4',
      apiUrl: 'https://api.openai.com/v1',
      temperature: 0.7,
      maxTokens: 1000,
    },
    trading: {
      quantity: 1,
      minConfidence: 0.7,
      maxRiskLevel: 'medium',
      cooldownPeriod: 5000,
    },
    rateLimit: {
      requestsPerMinute: 60,
      dailyBudget: 10, // $10/天
    },
  },
});
```

### 成本控制和监控

LLM 策略内置成本控制机制：

1. **每日预算限制**: 自动阻止超出预算的交易信号
2. **速率限制**: 防止 API 限流
3. **置信度过滤**: 过滤低质量信号，节省 token
4. **冷却期**: 防止过度交易
5. **实时统计**: Token 使用量、成本估算、请求成功率

监控命令：
```typescript
const stats = strategy.getLLMStats();
console.log('今日成本:', stats.dailyCost);
console.log('Token 使用:', stats.tokenUsage.totalTokens);
console.log('请求成功率:', stats.requestStats.successRate);
```

### 自定义 Prompt 模板

```typescript
strategy.setPromptTemplate({
  name: 'market-analysis',
  template: `
你是一位专业的量化交易员。
分析以下市场数据并给出交易建议：
- 交易对：{symbol}
- 当前价格：{price}
- 24h 成交量：{volume}
- 价格趋势：{trend}

请输出 JSON 格式的交易信号。
`,
  variables: ['symbol', 'price', 'volume', 'trend'],
});
```

## 🛠️ 开发

```bash
# 运行测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监听模式运行测试
npm run test:watch

# 代码检查
npm run lint
npm run lint:fix

# 代码格式化
npm run format
npm run format:check

# 重新构建
npm run build
npm run build:client
```

## 📊 数据库 Schema

### 核心表

#### strategies
- `id`: UUID (主键)
- `name`: 策略名称
- `description`: 策略描述
- `symbol`: 交易对 (e.g., "BTC/USDT")
- `status`: 状态 (active/paused/stopped)
- `config`: JSONB 配置
- `created_at`, `updated_at`: 时间戳

#### trades
- `id`: UUID (主键)
- `strategy_id`: UUID (外键)
- `symbol`: 交易对
- `side`: 方向 (buy/sell)
- `price`, `quantity`, `total`: 交易详情
- `fee`: 手续费
- `executed_at`: 执行时间

#### portfolios
- `id`: UUID (主键)
- `strategy_id`: UUID (外键)
- `symbol`: 交易对
- `balances`: JSONB 余额
- `total_value`: 总值
- `snapshot_at`: 快照时间

#### leaderboard_snapshots
- `id`: UUID (主键)
- `timestamp`: 快照时间
- `total_strategies`, `total_trades`, `total_volume`: 统计
- `entries`: 排行榜条目（关联表）

## 📄 许可证

ISC

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发流程

1. Fork 仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

---

**Sprint 2 完成** 🎉 - Web 实时系统、多策略对战、LLM 集成、排行榜系统
