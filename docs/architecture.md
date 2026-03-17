# AlphaArena 架构设计文档

## 概述

AlphaArena 是一个算法交易平台，采用前后端分离的架构，提供订单簿模拟、撮合引擎、投资组合跟踪、策略开发和回测功能。

## 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AlphaArena System                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         Frontend (React)                             │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │    │
│  │  │ Dashboard│ │ OrderBook│ │ Trading  │ │Portfolio │ │Leaderboard│ │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │    │
│  │                                                                      │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │    │
│  │  │  Hooks   │ │  Store   │ │  Utils   │ │ Components│              │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      │ HTTP / WebSocket                      │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        Backend (Express.js)                          │    │
│  │                                                                      │    │
│  │  ┌──────────────────────────────────────────────────────────────┐  │    │
│  │  │                      REST API Layer                           │  │    │
│  │  │  /api/strategies  /api/trades  /api/orders  /api/portfolios  │  │    │
│  │  └──────────────────────────────────────────────────────────────┘  │    │
│  │                                    │                                 │    │
│  │  ┌───────────────────┐  ┌─────────┴─────────┐  ┌───────────────┐  │    │
│  │  │   Strategy        │  │   Trading         │  │   Market      │  │    │
│  │  │   Manager         │  │   Engine          │  │   Data        │  │    │
│  │  └───────────────────┘  └───────────────────┘  └───────────────┘  │    │
│  │           │                      │                      │          │    │
│  │  ┌────────┴────────┐  ┌─────────┴─────────┐  ┌─────────┴────────┐ │    │
│  │  │  Strategy Impl  │  │   Matching        │  │   OrderBook      │ │    │
│  │  │  - SMA          │  │   Engine          │  │   Service        │ │    │
│  │  │  - RSI          │  └───────────────────┘  └──────────────────┘ │    │
│  │  │  - MACD         │                                    │          │    │
│  │  │  - Bollinger    │                                    │          │    │
│  │  └─────────────────┘                                    │          │    │
│  │                                                          │          │    │
│  │  ┌───────────────────────────────────────────────────────┴──────┐  │    │
│  │  │                  Realtime Service (Supabase)                  │  │    │
│  │  │  - WebSocket connections                                       │  │    │
│  │  │  - Channel subscriptions                                       │  │    │
│  │  │  - Broadcast events                                            │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      │ PostgreSQL                            │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                       Database (Supabase)                            │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │    │
│  │  │strategies│ │  trades  │ │portfolios│ │ orders   │               │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 核心模块

### 1. 策略模块 (Strategy Module)

**职责**：定义交易策略接口，实现内置策略，管理策略生命周期。

**关键组件**：

```
src/strategy/
├── Strategy.ts           # 策略基类和接口
├── SMAStrategy.ts        # SMA 交叉策略
├── RSIStrategy.ts        # RSI 动量策略
├── MACDStrategy.ts       # MACD 趋势策略
├── BollingerBandsStrategy.ts  # 布林带策略
├── StochasticStrategy.ts      # 随机指标策略
├── ATRStrategy.ts        # ATR 波动率策略
├── LLMStrategy.ts        # LLM 驱动策略
├── StrategyManager.ts    # 策略管理器
├── LeaderboardService.ts # 排行榜服务
└── types.ts              # 类型定义
```

**策略接口**：

```typescript
interface Strategy {
  readonly name: string;
  initialize(context: StrategyContext): Promise<void>;
  onData(data: MarketData): void;
  generateSignal(): Signal | null;
  execute(signal: Signal, context: ExecutionContext): Promise<Order | null>;
  onTick(): void;
  onStop(): void;
}
```

**信号类型**：

```typescript
type SignalType = 'buy' | 'sell' | 'hold';

interface Signal {
  type: SignalType;
  strength: number;      // 信号强度 0-1
  price?: number;        // 建议价格
  quantity?: number;     // 建议数量
  reason?: string;       // 信号原因
}
```

### 2. 撮合引擎 (Matching Engine)

**职责**：执行订单撮合，生成成交记录。

**撮合算法**：价格-时间优先（Price-Time Priority）

```
买单队列（降序）          卖单队列（升序）
┌─────────────────┐    ┌─────────────────┐
│ Price: 50100    │    │ Price: 50200    │
│ Qty: 10         │    │ Qty: 5          │
├─────────────────┤    ├─────────────────┤
│ Price: 50000    │    │ Price: 50300    │
│ Qty: 20         │    │ Qty: 15         │
└─────────────────┘    └─────────────────┘
        ▼                      ▼
    最佳买价              最佳卖价
    50100                 50200
           │              │
           └──── 买一卖一 ────┘
                  不可撮合
            （买价 < 卖价）
```

**撮合流程**：

```typescript
function match(order: Order): MatchResult {
  // 1. 确定对手方
  const oppositeOrders = order.side === 'buy' ? asks : bids;
  
  // 2. 遍历可撮合订单
  while (order.remainingQuantity > 0 && hasMatch(order, oppositeOrders)) {
    const bestOpposite = oppositeOrders.best();
    
    // 3. 执行撮合
    const trade = createTrade(order, bestOpposite);
    trades.push(trade);
    
    // 4. 更新订单状态
    updateOrders(order, bestOpposite, trade.quantity);
  }
  
  return { trades, remainingOrder: order.remainingQuantity > 0 ? order : null };
}
```

### 3. 订单簿 (Order Book)

**职责**：维护买卖订单队列，提供订单簿快照和更新。

**数据结构**：

```typescript
interface OrderBookSnapshot {
  bids: PriceLevel[];  // 买单（价格降序）
  asks: PriceLevel[];  // 卖单（价格升序）
  timestamp: number;
}

interface PriceLevel {
  price: number;
  orders: Order[];
  totalQuantity: number;
}
```

**订单类型**：

```typescript
enum OrderType {
  BID = 'bid',  // 买单
  ASK = 'ask',  // 卖单
}

interface Order {
  id: string;
  price: number;
  quantity: number;
  timestamp: number;
  type: OrderType;
}
```

### 4. 投资组合 (Portfolio)

**职责**：跟踪持仓、计算盈亏、管理资金。

**核心数据**：

```typescript
interface PortfolioSnapshot {
  cash: number;              // 现金余额
  positions: Position[];     // 持仓列表
  totalValue: number;        // 总资产价值
  unrealizedPnL: number;     // 未实现盈亏
  timestamp: number;
}

interface Position {
  symbol: string;
  quantity: number;
  averageCost: number;       // 平均成本
  currentPrice?: number;     // 当前价格
  unrealizedPnL?: number;    // 未实现盈亏
}
```

**盈亏计算**：

```typescript
// 未实现盈亏
unrealizedPnL = (currentPrice - averageCost) * quantity;

// 已实现盈亏（平仓时）
realizedPnL = (exitPrice - averageCost) * exitQuantity;

// 总资产价值
totalValue = cash + sum(position.value);
```

### 5. 回测引擎 (Backtest Engine)

**职责**：使用历史数据模拟策略表现。

**回测流程**：

```
加载数据 → 初始化策略 → 遍历时间点 → 统计结果
                              │
                              ▼
                    ┌─────────────────┐
                    │ 更新价格数据     │
                    │ 触发策略 onData  │
                    │ 生成交易信号     │
                    │ 执行交易         │
                    │ 更新投资组合     │
                    └─────────────────┘
```

**回测配置**：

```typescript
interface BacktestConfig {
  capital: number;           // 初始资金
  symbol: string;            // 交易对
  startTime: number;         // 开始时间
  endTime: number;           // 结束时间
  strategy: string;          // 策略名称
  strategyParams?: object;   // 策略参数
  tickInterval?: number;     // Tick 间隔
  feeRate?: number;          // 手续费率
  slippage?: number;         // 滑点
}
```

**统计指标**：

```typescript
interface BacktestStats {
  totalReturn: number;       // 总收益率
  annualizedReturn: number;  // 年化收益率
  sharpeRatio: number;       // 夏普比率
  maxDrawdown: number;       // 最大回撤
  totalTrades: number;       // 总交易次数
  winRate: number;           // 胜率
  profitFactor: number;      // 盈亏比
}
```

### 6. API 服务 (API Server)

**职责**：提供 REST API 和实时数据服务。

**REST API 端点**：

| 模块 | 端点 | 方法 | 描述 |
|------|------|------|------|
| 策略 | `/api/strategies` | GET | 获取策略列表 |
| 策略 | `/api/strategies/:id` | GET | 获取策略详情 |
| 交易 | `/api/trades` | GET | 获取交易记录 |
| 交易 | `/api/trades/export` | GET | 导出交易记录 |
| 组合 | `/api/portfolios` | GET | 获取投资组合 |
| 组合 | `/api/portfolios/history` | GET | 获取盈亏历史 |
| 订单 | `/api/orders` | GET/POST | 订单管理 |
| 订单 | `/api/orders/:id/cancel` | POST | 取消订单 |
| 条件单 | `/api/conditional-orders` | GET/POST | 条件单管理 |
| 订单簿 | `/api/orderbook/:symbol` | GET | 获取订单簿 |
| 行情 | `/api/market/tickers` | GET | 获取行情 |
| K线 | `/api/market/kline/:symbol` | GET | 获取K线 |
| 排行 | `/api/leaderboard` | GET | 获取排行榜 |

**实时数据**：

使用 Supabase Realtime 实现 WebSocket 推送：

```typescript
// 频道订阅
const channel = supabase.channel('trades');
channel.on('broadcast', { event: 'new' }, (payload) => {
  console.log('New trade:', payload);
});
channel.subscribe();
```

## 数据模型

### 数据库 Schema

```sql
-- 策略表
CREATE TABLE strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  symbol VARCHAR(50),
  params JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 交易记录表
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id),
  symbol VARCHAR(50) NOT NULL,
  side VARCHAR(10) NOT NULL,
  price DECIMAL(20, 8) NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  total DECIMAL(20, 8) NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 投资组合快照表
CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id),
  cash DECIMAL(20, 8) NOT NULL,
  positions JSONB,
  total_value DECIMAL(20, 8),
  unrealized_pnl DECIMAL(20, 8),
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 条件单表
CREATE TABLE conditional_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id),
  symbol VARCHAR(50) NOT NULL,
  side VARCHAR(10) NOT NULL,
  order_type VARCHAR(20) NOT NULL,
  trigger_price DECIMAL(20, 8) NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  triggered_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 技术栈

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | >= 18 | 运行时 |
| TypeScript | 5.x | 开发语言 |
| Express.js | 5.x | Web 框架 |
| Supabase | 2.x | 数据库 & 实时 |

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.x | UI 框架 |
| TypeScript | 5.x | 开发语言 |
| Vite | 7.x | 构建工具 |
| Arco Design | 2.x | UI 组件库 |
| Lightweight Charts | 5.x | 图表库 |
| Recharts | 2.x | 数据可视化 |

### 测试

| 技术 | 版本 | 用途 |
|------|------|------|
| Jest | 30.x | 测试框架 |
| Testing Library | 16.x | React 测试 |
| Puppeteer | 24.x | E2E 测试 |

## 部署架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         Production                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────┐         ┌───────────────────────────────┐   │
│  │   Vercel      │         │     Railway / Render          │   │
│  │   (Frontend)  │ ◄─────► │     (Backend API)             │   │
│  │               │         │                               │   │
│  │  - React App  │         │  - Express Server             │   │
│  │  - Static CDN │         │  - Node.js Runtime            │   │
│  └───────────────┘         └───────────────────────────────┘   │
│                                        │                         │
│                                        ▼                         │
│                            ┌───────────────────────┐            │
│                            │      Supabase        │            │
│                            │                      │            │
│                            │  - PostgreSQL       │            │
│                            │  - Realtime         │            │
│                            │  - Auth (optional)  │            │
│                            └───────────────────────┘            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 安全考虑

### API 安全

1. **CORS 配置**：限制允许的来源
2. **可选认证**：支持 Token 认证
3. **输入验证**：验证所有请求参数
4. **错误处理**：避免泄露敏感信息

### 数据安全

1. **环境变量**：敏感配置存储在 `.env`
2. **数据库访问**：通过 DAO 层访问
3. **日志脱敏**：不记录敏感数据

## 扩展性设计

### 添加新策略

1. 在 `src/strategy/` 创建新策略文件
2. 实现 `Strategy` 接口
3. 在 `index.ts` 导出
4. 在 `StrategyManager` 注册

### 添加新 API 端点

1. 在 `src/api/server.ts` 添加路由
2. 创建对应的 DAO 方法（如需数据库）
3. 添加 OpenAPI 文档
4. 编写测试

### 添加新的数据源

1. 创建 `DataSource` 接口实现
2. 实现数据获取和转换逻辑
3. 在配置中注册

---

*最后更新：2026-04-17*