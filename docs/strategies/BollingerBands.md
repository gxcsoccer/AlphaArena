# Bollinger Bands 策略（布林带策略）

## 原理说明

Bollinger Bands（布林带）是一种波动率指标，由三条轨道组成：中轨（移动平均线）、上轨和下轨。价格在带内波动，带宽随市场波动率动态调整。

### 核心概念

- **中轨**：N 周期移动平均线（通常为 20 日 MA）
- **上轨**：中轨 + K 倍标准差（通常为 2 倍）
- **下轨**：中轨 - K 倍标准差（通常为 2 倍）
- **带宽**：上轨与下轨之间的距离，反映市场波动率

### 工作原理

```
价格
  │        上轨（中轨 + 2σ）
  │       ╱‾‾‾‾‾‾‾‾‾╲
  │      ╱           ╲      价格触及上轨 → 可能超买
  │     ╱             ╲
  │    ╱   价格波动区间  ╲
  │   ╱                 ╲
  │  ╱───────────────────╲   中轨（移动平均线）
  │ ╱                     ╲
  │╱                       ╲  价格触及下轨 → 可能超卖
  │╲                       ╱
  │ ╲_____________________╱   下轨（中轨 - 2σ）
  │
  └──────────────────────────→ 时间
       收窄 → 波动率低
       扩张 → 波动率高
```

### 策略逻辑

1. **均值回归**：价格触及上轨 → 可能回调，考虑卖出
2. **均值回归**：价格触及下轨 → 可能反弹，考虑买入
3. **带宽突破**：带宽收窄后突破 → 可能产生趋势行情
4. **带宽扩张**：带宽急剧扩张 → 市场波动加大，谨慎交易

## 参数配置

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `period` | number | 20 | 中轨计算周期 |
| `stdDev` | number | 2 | 标准差倍数 |
| `tradeQuantity` | number | 1 | 每次交易数量 |

### 参数选择建议

| 参数组合 | 适用场景 | 特点 |
|----------|----------|------|
| 20/2 | 标准设置 | 最常用的默认参数 |
| 10/1.5 | 短线交易 | 更敏感，信号频繁 |
| 50/2.5 | 长线投资 | 更稳定，信号少 |

## 代码示例

### 基础使用

```typescript
import { BollingerBandsStrategy } from 'alphaarena';

const strategy = new BollingerBandsStrategy({
  period: 20,
  stdDev: 2,
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
  console.log(`布林带信号: ${signal.type}`);
  console.log(`原因: ${signal.reason}`);
}
```

### 获取布林带值

```typescript
// 获取当前布林带值
const bands = strategy.getBollingerBands();
console.log('上轨:', bands.upper);
console.log('中轨:', bands.middle);
console.log('下轨:', bands.lower);
console.log('当前价格:', bands.price);
console.log('带宽:', bands.bandwidth);
console.log('%B:', bands.percentB); // 价格在带内的位置百分比

// 判断价格位置
if (bands.percentB > 1) {
  console.log('价格突破上轨，超买');
} else if (bands.percentB < 0) {
  console.log('价格跌破下轨，超卖');
} else if (bands.percentB > 0.8) {
  console.log('价格接近上轨，偏强');
} else if (bands.percentB < 0.2) {
  console.log('价格接近下轨，偏弱');
}
```

### 带宽突破策略

```typescript
class BollingerBreakoutStrategy extends BollingerBandsStrategy {
  private prevBandwidth: number = 0;
  private squeezeThreshold: number = 0.1; // 带宽收窄阈值

  generateSignal(): Signal | null {
    const bands = this.getBollingerBands();
    const bandwidth = bands.bandwidth;
    
    // 检测带宽收窄（挤压）
    const isSqueeze = bandwidth < this.squeezeThreshold;
    
    // 带宽从收窄状态突然扩张
    if (this.prevBandwidth < this.squeezeThreshold && 
        bandwidth > this.prevBandwidth * 1.5) {
      // 突破方向判断
      const price = bands.price;
      if (price > bands.middle) {
        return {
          type: 'buy',
          strength: 0.85,
          reason: '布林带挤压后向上突破'
        };
      } else {
        return {
          type: 'sell',
          strength: 0.85,
          reason: '布林带挤压后向下突破'
        };
      }
    }
    
    this.prevBandwidth = bandwidth;
    
    // 默认均值回归信号
    return super.generateSignal();
  }
}
```

### 与回测引擎结合

```typescript
import { BollingerBandsStrategy, BacktestEngine } from 'alphaarena';

const strategy = new BollingerBandsStrategy({
  period: 20,
  stdDev: 2,
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
console.log('夏普比率:', result.sharpeRatio);
```

## 适用场景

### ✅ 推荐使用

1. **震荡/区间市场**：布林带在横向波动市场中表现优异
2. **均值回归交易**：利用价格回归中轨的特性获利
3. **波动率分析**：通过带宽判断市场波动状态
4. **突破交易**：捕捉带宽收窄后的趋势突破

### ❌ 不推荐使用

1. **强趋势市场**：价格可能持续沿轨道运行，均值回归策略会亏损
2. **突发事件**：市场剧烈波动时轨道急剧扩张，信号可靠性下降
3. **低流动性市场**：价格波动不规律，布林带信号失真

## 风险提示

### 1. 趋势市场风险

在强趋势中，价格可能长时间沿上轨或下轨运行，反复触及不回调。

**缓解措施**：
```typescript
// 结合趋势指标过滤
if (isStrongTrend()) {
  // 在趋势方向上只用顺势信号
  if (trendDirection === 'up') {
    // 忽略上轨卖出信号，只关注下轨买入
  }
}
```

### 2. 假突破风险

价格短暂突破轨道后又回到带内，产生错误信号。

**缓解措施**：
- 等待收盘价确认突破
- 结合成交量确认突破有效性
- 使用更高的标准差倍数（如 2.5 或 3）

### 3. 参数敏感性

不同市场和品种需要不同的参数设置。

**缓解措施**：
- 回测验证参数有效性
- 考虑使用自适应参数

## 优化建议

### 1. %B 指标过滤

```typescript
// %B = (价格 - 下轨) / (上轨 - 下轨)
// 范围通常在 0-1 之间，突破时可能大于 1 或小于 0
class PercentBStrategy extends BollingerBandsStrategy {
  generateSignal(): Signal | null {
    const bands = this.getBollingerBands();
    const percentB = bands.percentB;
    
    // %B 超过 1 后回落，卖出信号
    if (percentB > 1 && this.prevPercentB > percentB) {
      return { type: 'sell', strength: 0.75, reason: '%B 从高位回落' };
    }
    
    // %B 低于 0 后回升，买入信号
    if (percentB < 0 && this.prevPercentB < percentB) {
      return { type: 'buy', strength: 0.75, reason: '%B 从低位回升' };
    }
    
    this.prevPercentB = percentB;
    return null;
  }
}
```

### 2. 带宽指标（BW）

```typescript
// BW = (上轨 - 下轨) / 中轨
// 带宽收窄预示大行情，带宽扩张表示趋势可能结束
class BandwidthStrategy extends BollingerBandsStrategy {
  private bandwidthHistory: number[] = [];
  
  generateSignal(): Signal | null {
    const bands = this.getBollingerBands();
    const bandwidth = bands.bandwidth;
    
    this.bandwidthHistory.push(bandwidth);
    if (this.bandwidthHistory.length > 50) {
      this.bandwidthHistory.shift();
    }
    
    const avgBandwidth = this.bandwidthHistory.reduce((a, b) => a + b, 0) / this.bandwidthHistory.length;
    
    // 带宽显著低于平均值（收窄）
    if (bandwidth < avgBandwidth * 0.5) {
      return { type: 'hold', strength: 0, reason: '带宽收窄，等待突破方向' };
    }
    
    // 带宽显著高于平均值（扩张）
    if (bandwidth > avgBandwidth * 1.5) {
      return { type: 'hold', strength: 0, reason: '带宽扩张过大，谨慎交易' };
    }
    
    return super.generateSignal();
  }
}
```

### 3. 双布林带策略

```typescript
// 使用两套标准差的布林带
class DoubleBollingerBands {
  private bb1 = new BollingerBandsStrategy({ period: 20, stdDev: 1 });
  private bb2 = new BollingerBandsStrategy({ period: 20, stdDev: 2 });
  
  generateSignal(): Signal | null {
    const inner = this.bb1.getBollingerBands(); // 内轨（1σ）
    const outer = this.bb2.getBollingerBands(); // 外轨（2σ）
    const price = outer.price;
    
    // 价格在内外上轨之间：强多头区域
    if (price > inner.upper && price < outer.upper) {
      return { type: 'buy', strength: 0.7, reason: '价格在布林带强多头区域' };
    }
    
    // 价格在内外下轨之间：强空头区域
    if (price < inner.lower && price > outer.lower) {
      return { type: 'sell', strength: 0.7, reason: '价格在布林带强空头区域' };
    }
    
    // 价格回到内轨内：趋势可能减弱
    if (price < inner.upper && price > inner.lower) {
      return { type: 'hold', strength: 0, reason: '价格回归内轨，趋势减弱' };
    }
    
    return null;
  }
}
```

### 4. 结合 RSI

```typescript
class BollingerRSIStrategy extends BollingerBandsStrategy {
  private rsi = new RSIStrategy({ period: 14, overbought: 70, oversold: 30 });
  
  generateSignal(): Signal | null {
    const bands = this.getBollingerBands();
    const price = bands.price;
    const rsiValue = this.rsi.getCurrentRSI();
    
    // 价格触及下轨 + RSI 超卖：强烈买入
    if (price <= bands.lower && rsiValue < 30) {
      return { type: 'buy', strength: 0.9, reason: '布林带下轨 + RSI 超卖共振' };
    }
    
    // 价格触及上轨 + RSI 超买：强烈卖出
    if (price >= bands.upper && rsiValue > 70) {
      return { type: 'sell', strength: 0.9, reason: '布林带上轨 + RSI 超买共振' };
    }
    
    return null;
  }
}
```

## 相关资源

- [RSI 策略](./RSI.md) - 超买超卖指标
- [ATR 策略](./ATR.md) - 真实波动幅度
- [策略调优指南](../guides/strategy-tuning.md) - 如何优化策略参数
- [回测使用说明](../guides/backtesting.md) - 如何进行回测验证