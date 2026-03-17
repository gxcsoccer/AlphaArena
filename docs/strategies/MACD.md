# MACD 策略（指数平滑异同移动平均）

## 原理说明

MACD（Moving Average Convergence Divergence，指数平滑异同移动平均）是一种趋势跟踪动量指标，通过两条指数移动平均线的差值来衡量市场动量和趋势方向。

### 核心概念

- **MACD 线**：快线 EMA(12) - 慢线 EMA(26)，反映短期与长期趋势的差值
- **信号线**：MACD 线的 9 周期 EMA，作为买卖信号的触发器
- **MACD 柱**：MACD 线与信号线的差值，直观显示动量强度

### 工作原理

```
MACD 线
  │
  │         MACD 线在信号线上方 → 看涨
  │        ╱╲
  │       ╱  ╲     ─ ─ ─ 信号线
  │      ╱    ╲   ╱
  0├─────╱──────╲─╱─────────
  │   ╱          ╲
  │  ╱            ╲
  │ ╱              ╲        MACD 线在信号线下方 → 看跌
  │╱
  └──────────────────────────→ 时间
  
MACD 柱状图（Histogram）
  │      ▓▓▓▓
  │     ▓▓▓▓▓▓    正柱：MACD > 信号线
  │    ▓▓▓▓▓▓▓▓   （多头动量增强）
  0├───▓▓▓▓▓▓▓▓───
  │          ░░░░░░░░  负柱：MACD < 信号线
  │           ░░░░░░░  （空头动量增强）
  │            ░░░░░
  └──────────────────────────→ 时间
```

### 信号类型

1. **金叉信号**：MACD 线上穿信号线，买入信号
2. **死叉信号**：MACD 线下穿信号线，卖出信号
3. **零轴突破**：MACD 线穿越零轴，确认趋势方向
4. **背离信号**：价格与 MACD 方向相反，预示反转

## 参数配置

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `fastPeriod` | number | 12 | 快线 EMA 周期 |
| `slowPeriod` | number | 26 | 慢线 EMA 周期 |
| `signalPeriod` | number | 9 | 信号线 EMA 周期 |
| `tradeQuantity` | number | 1 | 每次交易数量 |

### 参数选择建议

| 参数组合 | 适用场景 | 特点 |
|----------|----------|------|
| 12/26/9 | 标准设置 | 平衡信号频率和可靠性，最常用 |
| 5/35/5 | 短线交易 | 信号更频繁，适合快进快出 |
| 19/39/9 | 长线投资 | 信号更少更可靠，滞后较大 |

## 代码示例

### 基础使用

```typescript
import { MACDStrategy } from 'alphaarena';

const strategy = new MACDStrategy({
  fastPeriod: 12,
  slowPeriod: 26,
  signalPeriod: 9,
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
  console.log(`MACD 信号: ${signal.type}`);
  console.log(`原因: ${signal.reason}`);
}
```

### 获取 MACD 值

```typescript
// 获取当前 MACD 指标值
const macdValues = strategy.getMACDValues();
console.log('MACD 线:', macdValues.macd);
console.log('信号线:', macdValues.signal);
console.log('MACD 柱:', macdValues.histogram);

// 判断动量方向
if (macdValues.histogram > 0 && macdValues.histogram > macdValues.prevHistogram) {
  console.log('多头动量增强');
} else if (macdValues.histogram < 0 && macdValues.histogram < macdValues.prevHistogram) {
  console.log('空头动量增强');
}
```

### 与回测引擎结合

```typescript
import { MACDStrategy, BacktestEngine } from 'alphaarena';

const strategy = new MACDStrategy({
  fastPeriod: 12,
  slowPeriod: 26,
  signalPeriod: 9,
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
console.log('交易次数:', result.totalTrades);
```

### 背离策略

```typescript
class MACDDivergenceStrategy extends MACDStrategy {
  private priceHistory: number[] = [];
  private macdHistory: number[] = [];

  generateSignal(): Signal | null {
    const signal = super.generateSignal();
    const macdValues = this.getMACDValues();
    const price = this.getLastPrice();
    
    this.priceHistory.push(price);
    this.macdHistory.push(macdValues.macd);
    
    // 保持历史长度
    if (this.priceHistory.length > 50) {
      this.priceHistory.shift();
      this.macdHistory.shift();
    }
    
    // 检测顶背离
    if (this.detectBearishDivergence()) {
      return {
        type: 'sell',
        strength: 0.85,
        reason: 'MACD 顶背离：价格创新高但 MACD 未创新高'
      };
    }
    
    // 检测底背离
    if (this.detectBullishDivergence()) {
      return {
        type: 'buy',
        strength: 0.85,
        reason: 'MACD 底背离：价格创新低但 MACD 未创新低'
      };
    }
    
    return signal;
  }
  
  private detectBearishDivergence(): boolean {
    // 找到最近的价格高点和对应的 MACD 值
    const recentHighIndex = this.findRecentHigh(this.priceHistory, 20);
    const prevHighIndex = this.findRecentHigh(this.priceHistory.slice(0, -10), 20);
    
    if (recentHighIndex === -1 || prevHighIndex === -1) return false;
    
    // 价格创新高，但 MACD 未创新高
    return this.priceHistory[recentHighIndex] > this.priceHistory[prevHighIndex] &&
           this.macdHistory[recentHighIndex] < this.macdHistory[prevHighIndex];
  }
  
  private detectBullishDivergence(): boolean {
    // 类似顶背离检测
    const recentLowIndex = this.findRecentLow(this.priceHistory, 20);
    const prevLowIndex = this.findRecentLow(this.priceHistory.slice(0, -10), 20);
    
    if (recentLowIndex === -1 || prevLowIndex === -1) return false;
    
    return this.priceHistory[recentLowIndex] < this.priceHistory[prevLowIndex] &&
           this.macdHistory[recentLowIndex] > this.macdHistory[prevLowIndex];
  }
}
```

## 适用场景

### ✅ 推荐使用

1. **趋势确认**：MACD 是确认趋势方向的优秀工具
2. **趋势市场**：在明显的趋势行情中表现良好
3. **中长期交易**：默认参数适合日线及以上周期
4. **动量判断**：MACD 柱直观显示动量变化

### ❌ 不推荐使用

1. **震荡市场**：频繁的金叉死叉产生大量假信号
2. **短线交易**：MACD 滞后性不适合需要快速反应的场景
3. **极端行情**：市场剧烈波动时信号可靠性下降

## 风险提示

### 1. 滞后性风险

MACD 是滞后指标，信号出现时趋势已经确立一段时间。

**缓解措施**：
- 结合领先指标（如 RSI）提前预警
- 使用更短的参数周期（如 5/35/5）
- 接受"确认成本"，追求稳定性而非时效性

### 2. 震荡市场假信号

在横盘市场中，MACD 会产生大量错误信号。

**缓解措施**：
```typescript
// 增加 ADX 过滤
if (adx < 25) {
  // 趋势强度不足，忽略 MACD 信号
  return null;
}
```

### 3. 参数局限性

默认参数可能不适用于所有市场和品种。

**缓解措施**：
- 针对具体品种进行回测优化
- 测试不同参数组合的表现
- 考虑使用自适应参数

## 优化建议

### 1. 零轴过滤

只在 MACD 线在零轴上方时做多，下方时做空：

```typescript
class ZeroAxisFilteredMACD extends MACDStrategy {
  generateSignal(): Signal | null {
    const signal = super.generateSignal();
    const macdValues = this.getMACDValues();
    
    if (!signal) return null;
    
    // 只在 MACD 线在零轴上方时买入
    if (signal.type === 'buy' && macdValues.macd < 0) {
      return null;
    }
    
    // 只在 MACD 线在零轴下方时卖出
    if (signal.type === 'sell' && macdValues.macd > 0) {
      return null;
    }
    
    return signal;
  }
}
```

### 2. 柱状图动量确认

利用 MACD 柱的变化确认入场时机：

```typescript
class HistogramMACD extends MACDStrategy {
  generateSignal(): Signal | null {
    const macdValues = this.getMACDValues();
    const histogram = macdValues.histogram;
    const prevHistogram = this.prevHistogram || 0;
    
    // MACD 柱从负转正且在增长
    if (histogram > 0 && prevHistogram < 0) {
      return {
        type: 'buy',
        strength: Math.min(histogram / 0.5, 1),
        reason: 'MACD 柱转正并增长'
      };
    }
    
    // MACD 柱从正转负且在下降
    if (histogram < 0 && prevHistogram > 0) {
      return {
        type: 'sell',
        strength: Math.min(Math.abs(histogram) / 0.5, 1),
        reason: 'MACD 柱转负并下降'
      };
    }
    
    this.prevHistogram = histogram;
    return null;
  }
}
```

### 3. 多时间框架确认

```typescript
class MultiTimeframeMACD {
  private dailyMACD = new MACDStrategy({ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });
  private hourlyMACD = new MACDStrategy({ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });
  
  generateSignal(): Signal | null {
    const dailySignal = this.dailyMACD.generateSignal();
    const hourlyValues = this.hourlyMACD.getMACDValues();
    
    if (!dailySignal) return null;
    
    // 日线信号与小时线方向一致时入场
    if (dailySignal.type === 'buy' && hourlyValues.macd > hourlyValues.signal) {
      return { ...dailySignal, reason: '日线 + 小时线 MACD 共振' };
    }
    
    if (dailySignal.type === 'sell' && hourlyValues.macd < hourlyValues.signal) {
      return { ...dailySignal, reason: '日线 + 小时线 MACD 共振' };
    }
    
    return null;
  }
}
```

## 相关资源

- [SMA 策略](./SMA.md) - 基础趋势跟踪
- [RSI 策略](./RSI.md) - 超买超卖判断
- [Bollinger Bands 策略](./BollingerBands.md) - 波动率分析
- [策略调优指南](../guides/strategy-tuning.md) - 如何优化策略参数