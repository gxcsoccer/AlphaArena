# AlphaArena 回测使用说明

回测是验证交易策略有效性的关键步骤。本指南将帮助您使用 AlphaArena 的回测引擎测试和优化您的策略。

## 目录

1. [回测基础](#回测基础)
2. [快速开始](#快速开始)
3. [回测配置](#回测配置)
4. [结果分析](#结果分析)
5. [性能优化](#性能优化)
6. [高级功能](#高级功能)

## 回测基础

### 什么是回测？

回测是使用历史数据模拟策略在过去的表现。通过回测，您可以：

- 验证策略逻辑是否正确
- 评估策略的风险收益特征
- 优化策略参数
- 发现策略的潜在问题

### 回测假设

在进行回测时，请注意以下假设：

1. **流动性假设**：假设历史交易量足够执行您的订单
2. **滑点假设**：默认不考虑交易滑点
3. **交易成本**：默认不包含交易手续费
4. **市场影响**：假设您的交易不影响市场价格

### 回测流程

```
加载历史数据
    ↓
初始化策略
    ↓
遍历时间点
    ├── 更新价格数据
    ├── 触发策略 onData
    ├── 生成信号 generateSignal
    ├── 执行交易 execute
    └── 更新投资组合
    ↓
计算统计指标
    ↓
输出回测报告
```

## 快速开始

### CLI 回测

最简单的方式是使用命令行工具：

```bash
# 基本回测
npx alpha-arena backtest --strategy sma --symbol BTC/USDT \
  --start 2024-01-01 --end 2024-12-31

# 指定初始资金
npx alpha-arena backtest --strategy sma --symbol BTC/USDT \
  --start 2024-01-01 --end 2024-12-31 \
  --initial-capital 10000

# 指定策略参数
npx alpha-arena backtest --strategy sma --symbol BTC/USDT \
  --start 2024-01-01 --end 2024-12-31 \
  --params '{"shortPeriod": 5, "longPeriod": 20}'
```

### 代码回测

```typescript
import { BacktestEngine } from './backtest/BacktestEngine';
import { SMAStrategy } from './strategy/SMAStrategy';

async function runBacktest() {
  const engine = new BacktestEngine({
    capital: 10000,           // 初始资金
    symbol: 'BTC/USDT',       // 交易对
    strategy: 'sma',          // 策略名称
    strategyParams: {         // 策略参数
      shortPeriod: 5,
      longPeriod: 20,
    },
    startTime: new Date('2024-01-01').getTime(),
    endTime: new Date('2024-12-31').getTime(),
    tickInterval: 60000,      // 每分钟一个 tick
  });

  const result = await engine.run();
  
  console.log('回测结果:', result.stats);
  console.log('总收益:', result.stats.totalReturn.toFixed(2) + '%');
  console.log('夏普比率:', result.stats.sharpeRatio.toFixed(2));
  console.log('最大回撤:', result.stats.maxDrawdown.toFixed(2) + '%');
  console.log('胜率:', result.stats.winRate.toFixed(2) + '%');
}

runBacktest();
```

## 回测配置

### 配置选项

```typescript
interface BacktestConfig {
  /** 初始资金 */
  capital: number;
  
  /** 交易对符号 */
  symbol: string;
  
  /** 开始时间戳 */
  startTime: number;
  
  /** 结束时间戳 */
  endTime: number;
  
  /** 策略名称 */
  strategy: string;
  
  /** 策略参数 */
  strategyParams?: Record<string, any>;
  
  /** Tick 间隔（毫秒） */
  tickInterval?: number;
  
  /** 交易手续费率 */
  feeRate?: number;
  
  /** 滑点设置 */
  slippage?: number | ((price: number, quantity: number) => number);
  
  /** 数据源 */
  dataSource?: string;
}
```

### 示例配置

```typescript
const config: BacktestConfig = {
  capital: 50000,
  symbol: 'BTC/USDT',
  startTime: new Date('2023-01-01').getTime(),
  endTime: new Date('2023-12-31').getTime(),
  strategy: 'rsi',
  strategyParams: {
    period: 14,
    overbought: 70,
    oversold: 30,
    tradeQuantity: 0.1,
  },
  tickInterval: 60000,        // 1 分钟
  feeRate: 0.001,             // 0.1% 手续费
  slippage: 0.0005,           // 0.05% 滑点
};
```

### 数据准备

#### 加载历史数据

```typescript
import { HistoricalDataLoader } from './backtest/DataLoader';

// 从 CSV 文件加载
const loader = new HistoricalDataLoader();
const data = await loader.loadFromCSV('data/btc_usdt_1m.csv', {
  symbol: 'BTC/USDT',
  timeframe: '1m',
});

// 从 API 加载
const data = await loader.loadFromAPI({
  symbol: 'BTC/USDT',
  startTime: new Date('2024-01-01').getTime(),
  endTime: new Date('2024-12-31').getTime(),
  interval: '1h',
});
```

#### 数据格式

历史数据应包含以下字段：

```typescript
interface PriceDataPoint {
  timestamp: number;  // Unix 时间戳（毫秒）
  open: number;       // 开盘价
  high: number;       // 最高价
  low: number;        // 最低价
  close: number;      // 收盘价
  volume: number;     // 成交量
}
```

CSV 格式示例：

```csv
timestamp,open,high,low,close,volume
1704067200000,42000.00,42100.00,41900.00,42050.00,150.5
1704067260000,42050.00,42150.00,42000.00,42100.00,120.3
...
```

## 结果分析

### 统计指标

```typescript
interface BacktestStats {
  /** 总收益率（%） */
  totalReturn: number;
  
  /** 年化收益率（%） */
  annualizedReturn: number;
  
  /** 夏普比率 */
  sharpeRatio: number;
  
  /** 最大回撤（%） */
  maxDrawdown: number;
  
  /** 总交易次数 */
  totalTrades: number;
  
  /** 盈利交易次数 */
  winningTrades: number;
  
  /** 亏损交易次数 */
  losingTrades: number;
  
  /** 胜率（%） */
  winRate: number;
  
  /** 平均盈利 */
  avgWin: number;
  
  /** 平均亏损 */
  avgLoss: number;
  
  /** 盈亏比 */
  profitFactor: number;
  
  /** 初始资金 */
  initialCapital: number;
  
  /** 最终资金 */
  finalCapital: number;
  
  /** 总盈亏 */
  totalPnL: number;
}
```

### 结果输出

```typescript
const result = await engine.run();

// 控制台输出
console.log('=== 回测报告 ===');
console.log(`策略: ${config.strategy}`);
console.log(`交易对: ${config.symbol}`);
console.log(`时间范围: ${new Date(config.startTime).toLocaleDateString()} - ${new Date(config.endTime).toLocaleDateString()}`);
console.log(`初始资金: $${config.capital.toLocaleString()}`);
console.log(`最终资金: $${result.stats.finalCapital.toLocaleString()}`);
console.log(`总收益: ${result.stats.totalReturn.toFixed(2)}%`);
console.log(`年化收益: ${result.stats.annualizedReturn.toFixed(2)}%`);
console.log(`夏普比率: ${result.stats.sharpeRatio.toFixed(2)}`);
console.log(`最大回撤: ${result.stats.maxDrawdown.toFixed(2)}%`);
console.log(`总交易次数: ${result.stats.totalTrades}`);
console.log(`胜率: ${result.stats.winRate.toFixed(2)}%`);
console.log(`盈亏比: ${result.stats.profitFactor.toFixed(2)}`);

// 获取详细数据
console.log('\n=== 交易记录 ===');
result.trades.forEach((trade, i) => {
  console.log(`${i + 1}. ${trade.side.toUpperCase()} ${trade.quantity} @ $${trade.price} | PnL: $${trade.pnl?.toFixed(2) || 'N/A'}`);
});

// 获取投资组合快照
console.log('\n=== 资金曲线 ===');
result.snapshots.forEach((snapshot, i) => {
  if (i % 100 === 0) {  // 每 100 个快照输出一次
    console.log(`${new Date(snapshot.timestamp).toLocaleDateString()}: $${snapshot.totalValue.toFixed(2)}`);
  }
});
```

### 可视化

```typescript
import { plotEquityCurve, plotDrawdown, plotTrades } from './backtest/Visualization';

// 绘制资金曲线
plotEquityCurve(result.snapshots, {
  title: `${config.strategy} Strategy Equity Curve`,
  outputPath: 'output/equity-curve.png',
});

// 绘制回撤曲线
plotDrawdown(result.snapshots, {
  title: 'Drawdown Chart',
  outputPath: 'output/drawdown.png',
});

// 绘制交易点
plotTrades(result.trades, data, {
  title: 'Trade Points',
  outputPath: 'output/trades.png',
});
```

## 性能优化

### 使用优化的回测引擎

```typescript
import { OptimizedBacktestEngine } from './backtest/OptimizedBacktestEngine';

const engine = new OptimizedBacktestEngine(config);

// 启用性能监控
const result = await engine.run({ enableMetrics: true });

// 查看性能指标
console.log('性能指标:', result.performanceMetrics);
console.log(`总耗时: ${result.duration}ms`);
console.log(`每秒处理 ticks: ${result.stats.dataPoints / (result.duration / 1000)}`);
```

### 批量处理

```typescript
// 批量回测多个参数组合
async function batchBacktest() {
  const paramCombinations = [
    { shortPeriod: 5, longPeriod: 20 },
    { shortPeriod: 10, longPeriod: 30 },
    { shortPeriod: 5, longPeriod: 30 },
    { shortPeriod: 10, longPeriod: 50 },
  ];

  const results = await Promise.all(
    paramCombinations.map(async (params) => {
      const engine = new BacktestEngine({
        ...config,
        strategyParams: params,
      });
      const result = await engine.run();
      return { params, stats: result.stats };
    })
  );

  // 找出最佳参数
  results.sort((a, b) => b.stats.sharpeRatio - a.stats.sharpeRatio);
  
  console.log('最佳参数:', results[0].params);
  console.log('夏普比率:', results[0].stats.sharpeRatio);
}
```

### 内存优化

对于长时间周期的回测，可以使用流式处理：

```typescript
import { StreamingBacktestEngine } from './backtest/StreamingBacktestEngine';

const engine = new StreamingBacktestEngine(config);

// 使用流式处理，减少内存占用
engine.on('progress', (progress) => {
  console.log(`进度: ${(progress * 100).toFixed(1)}%`);
});

engine.on('trade', (trade) => {
  console.log(`交易: ${trade.side} ${trade.quantity} @ ${trade.price}`);
});

await engine.run();
```

## 高级功能

### 参数优化

```typescript
import { ParameterOptimizer } from './backtest/ParameterOptimizer';

const optimizer = new ParameterOptimizer({
  strategy: 'sma',
  symbol: 'BTC/USDT',
  startTime: new Date('2023-01-01').getTime(),
  endTime: new Date('2023-12-31').getTime(),
  capital: 10000,
  paramRanges: {
    shortPeriod: [5, 10, 15, 20],
    longPeriod: [20, 30, 40, 50],
  },
  optimizationTarget: 'sharpeRatio',  // 优化目标
});

const optimizationResult = await optimizer.run();

console.log('最佳参数:', optimizationResult.bestParams);
console.log('最佳夏普比率:', optimizationResult.bestScore);
console.log('所有结果:', optimizationResult.allResults);
```

### Walk-Forward 分析

```typescript
import { WalkForwardAnalysis } from './backtest/WalkForwardAnalysis';

const wfa = new WalkForwardAnalysis({
  strategy: 'sma',
  symbol: 'BTC/USDT',
  totalPeriod: {
    start: new Date('2022-01-01').getTime(),
    end: new Date('2023-12-31').getTime(),
  },
  inSamplePeriod: 180,   // 训练期 180 天
  outSamplePeriod: 30,   // 测试期 30 天
  parameterRanges: {
    shortPeriod: [5, 10, 15],
    longPeriod: [20, 30, 40],
  },
});

const wfaResult = await wfa.run();

console.log('Walk-Forward 分析结果:');
console.log(`平均样本外收益: ${wfaResult.avgOutSampleReturn.toFixed(2)}%`);
console.log(`收益稳定性: ${wfaResult.consistency.toFixed(2)}`);
console.log('各期结果:', wfaResult.periodResults);
```

### 蒙特卡洛模拟

```typescript
import { MonteCarloSimulation } from './backtest/MonteCarloSimulation';

const simulation = new MonteCarloSimulation({
  strategy: 'sma',
  symbol: 'BTC/USDT',
  period: {
    start: new Date('2023-01-01').getTime(),
    end: new Date('2023-12-31').getTime(),
  },
  capital: 10000,
  simulations: 1000,  // 运行 1000 次模拟
  randomSeed: 42,     // 固定随机种子以获得可重复结果
});

const simulationResult = await simulation.run();

console.log('蒙特卡洛模拟结果:');
console.log(`收益范围: ${simulationResult.minReturn.toFixed(2)}% - ${simulationResult.maxReturn.toFixed(2)}%`);
console.log(`平均收益: ${simulationResult.avgReturn.toFixed(2)}%`);
console.log(`收益标准差: ${simulationResult.stdDev.toFixed(2)}%`);
console.log(`95% 置信区间: ${simulationResult.confidenceInterval95.map(v => v.toFixed(2) + '%').join(' - ')}`);
console.log(`盈利概率: ${simulationResult.probabilityOfProfit.toFixed(2)}%`);
```

### 事件回测

支持基于事件驱动的回测，模拟真实交易环境：

```typescript
import { EventDrivenBacktest } from './backtest/EventDrivenBacktest';

const backtest = new EventDrivenBacktest({
  ...config,
  eventTypes: ['price', 'orderbook', 'trade'],
});

// 注册事件处理器
backtest.on('price', (event) => {
  // 处理价格事件
});

backtest.on('orderbook', (event) => {
  // 处理订单簿事件
});

backtest.on('trade', (event) => {
  // 处理成交事件
});

await backtest.run();
```

## 回测陷阱

### 1. 前视偏差 (Look-Ahead Bias)

避免使用未来数据：

```typescript
// ❌ 错误：使用了当天的收盘价
onData(data: MarketData): void {
  if (data.close > data.high) {  // 这在现实中不可能发生
    this.signal = 'buy';
  }
}

// ✅ 正确：只使用历史数据
onData(data: MarketData): void {
  if (this.previousClose > this.ma) {
    this.signal = 'buy';
  }
  this.previousClose = data.close;
}
```

### 2. 过度拟合 (Overfitting)

避免对历史数据过度拟合：

- 使用样本外数据验证
- 使用 Walk-Forward 分析
- 保持策略简单，减少参数数量

### 3. 幸存者偏差 (Survivorship Bias)

使用包含已退市股票的数据集。

### 4. 交易成本忽略

```typescript
// 考虑交易成本
const config: BacktestConfig = {
  ...config,
  feeRate: 0.001,      // 交易所手续费
  slippage: 0.0005,    // 滑点
};
```

## 最佳实践

1. **使用足够长的历史数据**：至少 1-2 年
2. **分样本测试**：将数据分为训练集和测试集
3. **考虑交易成本**：手续费、滑点、市场冲击
4. **风险控制**：设置止损、限制仓位
5. **定期重测**：市场环境变化时重新测试

## 相关资源

- [策略开发指南](./strategy-development.md)
- [API 文档](../api/openapi.yaml)
- [常见问题解答](./faq.md)