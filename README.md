# AlphaArena

AlphaArena 是一个算法交易平台，提供订单簿模拟、撮合引擎、投资组合跟踪、策略开发和回测功能。

## 项目介绍

AlphaArena 旨在为量化交易者提供一个完整的交易策略开发和测试环境。主要功能包括：

- **订单簿 (OrderBook)**: 模拟真实市场的订单簿结构，支持限价单和市价单
- **撮合引擎 (MatchingEngine)**: 高效的价格时间优先撮合算法
- **投资组合 (Portfolio)**: 实时跟踪持仓、盈亏和资金状况
- **策略框架 (Strategy)**: 灵活的交易策略接口，支持自定义策略开发
- **回测引擎 (Backtest)**: 基于历史数据的策略回测功能
- **命令行工具 (CLI)**: 便捷的命令行接口，支持策略运行和回测

## 安装

### 前置要求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 安装步骤

```bash
# 克隆仓库
git clone https://github.com/gxcsoccer/AlphaArena.git
cd AlphaArena

# 安装依赖
npm install

# 构建项目
npm run build
```

## 使用

### CLI 命令

AlphaArena 提供以下命令行工具：

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

### CLI 使用示例

#### 1. 运行 SMA 交叉策略

```bash
npx alpha-arena run --strategy sma --symbol BTC/USDT --timeframe 1h
```

#### 2. 运行 RSI 策略

```bash
npx alpha-arena run --strategy rsi --symbol BTC/USDT --timeframe 1h
```

#### 3. 执行历史回测

```bash
npx alpha-arena backtest --strategy sma --symbol BTC/USDT --start 2024-01-01 --end 2024-12-31 --initial-capital 10000
```

#### 4. 查看当前持仓

```bash
npx alpha-arena portfolio --show
```

### 代码使用示例

```typescript
import { OrderBook, MatchingEngine, Portfolio, SMAStrategy, RSIStrategy } from 'alphaarena';

// 创建订单簿
const orderBook = new OrderBook('BTC/USDT');

// 添加订单
orderBook.addLimitOrder('buy', 50000, 1.5);
orderBook.addLimitOrder('sell', 50100, 2.0);

// 创建撮合引擎
const engine = new MatchingEngine(orderBook);

// 创建投资组合
const portfolio = new Portfolio(10000); // 初始资金 10000 USDT

// 创建 SMA 策略
const smaStrategy = new SMAStrategy({ shortPeriod: 10, longPeriod: 30 });

// 创建 RSI 策略
const rsiStrategy = new RSIStrategy({ period: 14, overbought: 70, oversold: 30 });
```

## 架构说明

### 模块结构

```
AlphaArena/
├── src/
│   ├── orderbook/        # 订单簿模块
│   │   ├── OrderBook.ts  # 订单簿核心实现
│   │   ├── types.ts      # 订单类型定义
│   │   └── index.ts      # 模块导出
│   │
│   ├── matching/         # 撮合引擎模块
│   │   ├── MatchingEngine.ts  # 撮合逻辑
│   │   ├── types.ts      # 撮合类型定义
│   │   └── index.ts      # 模块导出
│   │
│   ├── portfolio/        # 投资组合模块
│   │   ├── Portfolio.ts  # 持仓跟踪
│   │   ├── types.ts      # 持仓类型定义
│   │   └── index.ts      # 模块导出
│   │
│   ├── strategy/         # 策略框架模块
│   │   ├── Strategy.ts   # 策略接口
│   │   ├── SMAStrategy.ts # SMA 交叉策略实现
│   │   ├── RSIStrategy.ts # RSI 策略实现
│   │   ├── types.ts      # 策略类型定义
│   │   └── index.ts      # 模块导出
│   │
│   ├── backtest/         # 回测引擎模块
│   │   ├── BacktestEngine.ts # 回测逻辑
│   │   ├── types.ts      # 回测类型定义
│   │   └── index.ts      # 模块导出
│   │
│   ├── cli/              # 命令行工具
│   │   └── runner.ts     # CLI 入口
│   │
│   └── index.ts          # 主入口文件
│
├── tests/                # 测试文件
├── bin/                  # 可执行文件
└── package.json
```

### 数据流

```
市场数据 → 策略 (Strategy) → 信号 → 订单 → 订单簿 (OrderBook)
                                        ↓
                                  撮合引擎 (MatchingEngine)
                                        ↓
                                  成交记录 → 投资组合 (Portfolio)
                                        ↓
                                   绩效统计
```

### 核心组件

1. **OrderBook**: 维护买卖订单队列，支持价格优先、时间优先的排序
2. **MatchingEngine**: 执行订单撮合，生成成交记录
3. **Portfolio**: 跟踪现金和持仓变化，计算盈亏
4. **Strategy**: 定义策略接口，包括 `onData()`, `generateSignal()`, `execute()` 等方法
5. **BacktestEngine**: 模拟历史交易，评估策略表现

### 内置策略

#### SMA 交叉策略 (SMAStrategy)

基于简单移动平均线的交叉策略：
- **金叉**：短期均线上穿长期均线 → 买入信号
- **死叉**：短期均线下穿长期均线 → 卖出信号

配置参数：
- `shortPeriod`: 短期均线周期 (默认: 5)
- `longPeriod`: 长期均线周期 (默认: 20)
- `tradeQuantity`: 每次交易数量 (默认: 10)

#### RSI 策略 (RSIStrategy)

基于相对强弱指数的动量策略：
- **超卖信号**：RSI < 30 → 买入信号
- **超买信号**：RSI > 70 → 卖出信号

配置参数：
- `period`: RSI 计算周期 (默认: 14)
- `overbought`: 超买阈值 (默认: 70)
- `oversold`: 超卖阈值 (默认: 30)
- `tradeQuantity`: 每次交易数量 (默认: 10)

## 开发

```bash
# 运行测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监听模式运行测试
npm run test:watch

# 重新构建
npm run build
```

## 📚 文档

### 用户指南

- [快速开始指南](docs/guides/quick-start.md) - 10 分钟快速上手
- [策略开发指南](docs/guides/strategy-development.md) - 开发自定义交易策略
- [回测使用说明](docs/guides/backtesting.md) - 策略回测和优化
- [常见问题解答](docs/guides/faq.md) - 常见问题及解决方案

### 开发者文档

- [架构设计文档](docs/architecture.md) - 系统架构和模块设计
- [API 文档](docs/api/openapi.yaml) - OpenAPI/Swagger 规范
- [贡献指南](CONTRIBUTING.md) - 如何参与项目贡献

## 许可证

ISC

## 贡献

欢迎提交 Issue 和 Pull Request！请参阅 [贡献指南](CONTRIBUTING.md) 了解详情。
