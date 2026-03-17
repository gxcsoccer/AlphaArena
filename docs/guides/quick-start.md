# AlphaArena 快速开始指南

欢迎使用 AlphaArena 算法交易平台！本指南将帮助您在 10 分钟内开始使用平台的核心功能。

## 前置要求

- Node.js >= 18.0.0
- npm >= 9.0.0
- Git

## 安装

### 1. 克隆仓库

```bash
git clone https://github.com/gxcsoccer/AlphaArena.git
cd AlphaArena
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

创建 `.env` 文件（可从 `.env.example` 复制）：

```bash
cp .env.example .env
```

必需的环境变量：

```env
# Supabase 配置（用于实时数据）
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# 服务器端口
PORT=3001
```

### 4. 构建项目

```bash
npm run build
```

## 快速开始

### 启动服务器

```bash
npm start
```

服务器将在 `http://localhost:3001` 启动。

### 启动开发环境

前端开发服务器：

```bash
npm run dev
```

前端将在 `http://localhost:5173` 启动。

## 基本使用

### 1. CLI 命令行工具

AlphaArena 提供了便捷的命令行工具：

```bash
# 查看帮助
npx alpha-arena --help

# 运行 SMA 交叉策略
npx alpha-arena run --strategy sma --symbol BTC/USDT --timeframe 1h

# 运行 RSI 策略
npx alpha-arena run --strategy rsi --symbol BTC/USDT --timeframe 1h

# 执行历史回测
npx alpha-arena backtest --strategy sma --symbol BTC/USDT \
  --start 2024-01-01 --end 2024-12-31 --initial-capital 10000

# 查看当前持仓
npx alpha-arena portfolio --show
```

### 2. 代码使用

```typescript
import { 
  OrderBook, 
  MatchingEngine, 
  Portfolio, 
  SMAStrategy, 
  RSIStrategy,
  BacktestEngine 
} from 'alphaarena';

// 创建订单簿
const orderBook = new OrderBook('BTC/USDT');

// 添加限价单
orderBook.addLimitOrder('buy', 50000, 1.5);
orderBook.addLimitOrder('sell', 50100, 2.0);

// 创建撮合引擎
const engine = new MatchingEngine(orderBook);

// 创建投资组合
const portfolio = new Portfolio(10000); // 初始资金 10000 USDT

// 创建 SMA 策略
const smaStrategy = new SMAStrategy({ 
  shortPeriod: 10, 
  longPeriod: 30 
});

// 创建 RSI 策略
const rsiStrategy = new RSIStrategy({ 
  period: 14, 
  overbought: 70, 
  oversold: 30 
});

// 运行回测
const backtest = new BacktestEngine({
  capital: 10000,
  symbol: 'BTC/USDT',
  strategy: 'sma',
  startTime: Date.now() - 365 * 24 * 60 * 60 * 1000, // 一年前
  endTime: Date.now(),
});

const result = await backtest.run();
console.log('回测结果:', result.stats);
```

### 3. REST API

服务器启动后，可以通过 REST API 访问：

```bash
# 健康检查
curl http://localhost:3001/health

# 获取策略列表
curl http://localhost:3001/api/strategies

# 获取交易记录
curl http://localhost:3001/api/trades

# 获取投资组合
curl http://localhost:3001/api/portfolios

# 创建订单
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTC/USD","side":"buy","type":"limit","price":50000,"quantity":0.1}'

# 获取订单簿
curl http://localhost:3001/api/orderbook/BTC/USD

# 获取市场行情
curl http://localhost:3001/api/market/tickers

# 获取排行榜
curl http://localhost:3001/api/leaderboard
```

## 内置策略

### SMA 交叉策略

基于简单移动平均线的交叉策略：

- **金叉**：短期均线上穿长期均线 → 买入信号
- **死叉**：短期均线下穿长期均线 → 卖出信号

参数：
- `shortPeriod`: 短期均线周期（默认: 5）
- `longPeriod`: 长期均线周期（默认: 20）
- `tradeQuantity`: 每次交易数量（默认: 10）

```typescript
const sma = new SMAStrategy({
  shortPeriod: 5,
  longPeriod: 20,
  tradeQuantity: 1
});
```

### RSI 策略

基于相对强弱指数的动量策略：

- **超卖信号**：RSI < 30 → 买入信号
- **超买信号**：RSI > 70 → 卖出信号

参数：
- `period`: RSI 计算周期（默认: 14）
- `overbought`: 超买阈值（默认: 70）
- `oversold`: 超卖阈值（默认: 30）
- `tradeQuantity`: 每次交易数量（默认: 10）

```typescript
const rsi = new RSIStrategy({
  period: 14,
  overbought: 70,
  oversold: 30,
  tradeQuantity: 1
});
```

### MACD 策略

基于 MACD 指标的趋势策略：

- **金叉**：MACD 线上穿信号线 → 买入信号
- **死叉**：MACD 线下穿信号线 → 卖出信号

参数：
- `fastPeriod`: 快线周期（默认: 12）
- `slowPeriod`: 慢线周期（默认: 26）
- `signalPeriod`: 信号线周期（默认: 9）

### 布林带策略

基于布林带的均值回归策略：

- **下轨突破**：价格跌破下轨 → 买入信号
- **上轨突破**：价格突破上轨 → 卖出信号

参数：
- `period`: 计算周期（默认: 20）
- `stdDev`: 标准差倍数（默认: 2）

## Web 界面

访问前端界面进行可视化操作：

1. 启动前端开发服务器：`npm run dev`
2. 打开浏览器访问：`http://localhost:5173`

Web 界面提供：
- 实时订单簿显示
- K线图表
- 策略选择和配置
- 交易面板
- 持仓和盈亏显示
- 排行榜

## 下一步

- [策略开发指南](./strategy-development.md) - 学习如何开发自定义策略
- [回测使用说明](./backtesting.md) - 深入了解回测功能
- [API 文档](../api/openapi.yaml) - 完整的 REST API 参考
- [常见问题解答](./faq.md) - 常见问题解答

## 故障排除

### 安装失败

```bash
# 清理并重新安装
rm -rf node_modules package-lock.json
npm install
```

### 构建错误

```bash
# 检查 TypeScript 错误
npx tsc --noEmit
```

### 服务无法启动

1. 检查端口是否被占用：
   ```bash
   lsof -i :3001
   ```

2. 检查环境变量是否正确设置：
   ```bash
   cat .env
   ```

### 实时数据不工作

确保 Supabase 配置正确：
- `SUPABASE_URL` 格式应为 `https://xxx.supabase.co`
- `SUPABASE_ANON_KEY` 应为有效的 JWT token

## 获取帮助

- GitHub Issues: https://github.com/gxcsoccer/AlphaArena/issues
- 查看项目 Wiki 获取更多文档