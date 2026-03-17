# SMA 策略（简单移动平均交叉）

## 原理说明

SMA（Simple Moving Average，简单移动平均）策略是一种经典的趋势跟踪策略，通过两条不同周期的移动平均线的交叉来判断市场趋势方向。

### 核心概念

- **简单移动平均线（SMA）**：过去 N 个周期收盘价的算术平均值
- **金叉**：短期均线上穿长期均线，通常视为买入信号
- **死叉**：短期均线下穿长期均线，通常视为卖出信号

### 工作原理

```
价格 ↑
  │     ╱╲
  │    ╱  ╲      短期均线（快速响应）
  │   ╱    ╲    ╱
  │  ╱      ╲  ╱
  │ ╱        ╲╱     长期均线（平滑过滤）
  │╱
  └──────────────────→ 时间
```

当短期均线从下方向上穿越长期均线时（金叉），表示短期趋势转强，可能预示上涨行情开始；反之，当短期均线从上方向下穿越长期均线时（死叉），表示短期趋势转弱，可能预示下跌行情开始。

## 参数配置

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `shortPeriod` | number | 5 | 短期均线周期，常用值 5、10、20 |
| `longPeriod` | number | 20 | 长期均线周期，常用值 20、50、200 |
| `tradeQuantity` | number | 1 | 每次交易数量 |

### 参数选择建议

| 周期组合 | 适用场景 | 特点 |
|----------|----------|------|
| 5/20 | 短线交易 | 信号频繁，反应快，假信号较多 |
| 10/50 | 中线交易 | 平衡频率和准确性 |
| 20/200 | 长线投资 | 信号少，可靠性高，滞后性大 |

## 代码示例

### 基础使用

```typescript
import { SMAStrategy } from 'alphaarena';

// 创建策略实例
const strategy = new SMAStrategy({
  shortPeriod: 5,
  longPeriod: 20,
  tradeQuantity: 10
});

// 接收市场数据
strategy.onData({
  timestamp: Date.now(),
  open: 100,
  high: 105,
  low: 98,
  close: 103,
  volume: 1000
});

// 生成信号
const signal = strategy.generateSignal();
if (signal) {
  console.log(`信号类型: ${signal.type}`);
  console.log(`信号强度: ${signal.strength}`);
  console.log(`原因: ${signal.reason}`);
}
```

### 与回测引擎结合

```typescript
import { SMAStrategy, BacktestEngine } from 'alphaarena';

const strategy = new SMAStrategy({
  shortPeriod: 10,
  longPeriod: 50,
  tradeQuantity: 100
});

const engine = new BacktestEngine({
  symbol: 'BTC/USDT',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  initialCapital: 100000
});

const result = await engine.run(strategy);
console.log('总收益率:', result.totalReturn);
console.log('最大回撤:', result.maxDrawdown);
console.log('夏普比率:', result.sharpeRatio);
```

### 实盘交易

```typescript
import { SMAStrategy, LiveTrading } from 'alphaarena';

const strategy = new SMAStrategy({
  shortPeriod: 5,
  longPeriod: 20
});

const trader = new LiveTrading({
  exchange: 'binance',
  symbol: 'BTC/USDT',
  strategy: strategy,
  apiKey: process.env.API_KEY,
  apiSecret: process.env.API_SECRET
});

await trader.start();
```

## 适用场景

### ✅ 推荐使用

1. **趋势市场**：SMA 策略在明显的趋势行情中表现最佳
2. **长周期交易**：较长的均线周期能过滤噪音，提高信号可靠性
3. **多时间框架确认**：结合日线、周线等不同时间框架确认趋势
4. **与其他指标配合**：作为趋势确认工具，配合 RSI、MACD 等指标

### ❌ 不推荐使用

1. **震荡市场**：价格在一定区间内波动时，频繁交叉产生大量假信号
2. **高频交易**：SMA 滞后性不适合需要快速反应的场景
3. **极端市场**：市场剧烈波动时，均线滞后可能导致严重亏损

## 风险提示

### 1. 滞后性风险

SMA 是滞后指标，当信号出现时趋势可能已经发展了一段时间。

**缓解措施**：
- 结合领先指标（如 RSI）进行确认
- 使用 EMA 代替 SMA 提高响应速度
- 接受一定的"确认成本"，不追求抄底逃顶

### 2. 震荡市场假信号

在横盘震荡市场中，SMA 策略会产生频繁的错误信号。

**缓解措施**：
- 增加 ADX 指标判断趋势强度
- 设置信号确认条件（如收盘价确认）
- 设置交易间隔限制，避免连续交易

### 3. 参数敏感性

不同参数组合在不同市场环境下表现差异很大。

**缓解措施**：
- 进行充分的回测验证
- 使用多参数组合分散风险
- 定期评估和调整参数

## 优化建议

### 1. 增加过滤器

```typescript
class EnhancedSMAStrategy extends SMAStrategy {
  generateSignal(): Signal | null {
    const signal = super.generateSignal();
    
    if (!signal) return null;
    
    // 增加 ADX 趋势强度过滤
    const adx = this.calculateADX();
    if (adx < 25) {
      return null; // 趋势不足，忽略信号
    }
    
    return signal;
  }
}
```

### 2. 动态调整仓位

根据信号强度和趋势强度动态调整仓位大小：

```typescript
calculatePositionSize(signal: Signal, adx: number): number {
  const basePosition = 0.1; // 基础仓位 10%
  const strengthFactor = signal.strength;
  const trendFactor = Math.min(adx / 50, 1);
  
  return basePosition * strengthFactor * trendFactor;
}
```

### 3. 组合多个时间框架

```typescript
class MultiTimeFrameSMA extends SMAStrategy {
  // 检查更高时间框架趋势方向
  checkHigherTimeFrameTrend(): 'up' | 'down' | 'neutral' {
    // 只在更高时间框架趋势方向一致时交易
  }
}
```

## 相关资源

- [RSI 策略](./RSI.md) - 震荡市场利器
- [MACD 策略](./MACD.md) - 趋势确认指标
- [策略调优指南](../guides/strategy-tuning.md) - 如何优化策略参数
- [回测使用说明](../guides/backtesting.md) - 如何进行回测验证