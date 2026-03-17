# ATR 策略（平均真实波幅）

## 原理说明

ATR（Average True Range，平均真实波幅）是一种波动率指标，用于衡量市场波动的程度。与其他技术指标不同，ATR 不提供价格方向信号，而是反映市场的活跃度和波动性。

### 核心概念

- **真实波幅（True Range）**：以下三者的最大值
  - 当日最高价 - 当日最低价
  - |当日最高价 - 昨日收盘价|
  - |当日最低价 - 昨日收盘价|
- **ATR**：真实波幅的 N 周期移动平均（通常为 14）

### 工作原理

```
价格波动范围
  │
  │     High
  │       │
  │       │ ← True Range = max(H-L, |H-PC|, |L-PC|)
  │       │
  │     Low
  │       
  │  ─ ─ ─ ─ ─ Previous Close (PC)
  │
  └──────────────────────────→ 时间

ATR 值
  │
  │    高波动期
  │   ╱╲╱╲
  │  ╱    ╲
  │ ╱      ╲    低波动期
  │╱        ╲──╱‾‾‾‾╲──
  │
  └──────────────────────────→ 时间
```

### ATR 的应用场景

1. **止损设置**：根据 ATR 动态设置止损距离
2. **仓位管理**：根据波动率调整仓位大小
3. **波动率判断**：识别市场状态（高波动/低波动）
4. **突破确认**：价格突破 ATR 倍数时确认趋势

## 参数配置

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `period` | number | 14 | ATR 计算周期 |
| `multiplier` | number | 2 | 止损/突破的 ATR 倍数 |
| `tradeQuantity` | number | 1 | 每次交易数量 |

### 参数选择建议

| 周期 | 适用场景 | 特点 |
|------|----------|------|
| 7 | 短线交易 | 反应快，波动大 |
| 14 | 标准设置 | 平衡灵敏度和稳定性 |
| 21 | 长线投资 | 更稳定，滞后较大 |

## 代码示例

### 基础使用

```typescript
import { ATRStrategy } from 'alphaarena';

const strategy = new ATRStrategy({
  period: 14,
  multiplier: 2,
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

// 获取 ATR 值
const atr = strategy.getCurrentATR();
console.log(`当前 ATR: ${atr.toFixed(2)}`);
```

### 动态止损设置

```typescript
class ATRStopLoss {
  private atr: ATRStrategy;
  private entryPrice: number = 0;
  private stopLoss: number = 0;
  private atrMultiplier: number = 2;

  constructor() {
    this.atr = new ATRStrategy({ period: 14 });
  }

  setEntry(price: number) {
    this.entryPrice = price;
    const atr = this.atr.getCurrentATR();
    this.stopLoss = price - (atr * this.atrMultiplier);
    console.log(`入场价: ${price}`);
    console.log(`止损价: ${this.stopLoss.toFixed(2)}`);
  }

  checkStopLoss(currentPrice: number): boolean {
    if (currentPrice <= this.stopLoss) {
      console.log('触发止损！');
      return true;
    }
    return false;
  }

  // 移动止损（跟踪止损）
  updateTrailingStop(currentPrice: number) {
    const atr = this.atr.getCurrentATR();
    const newStop = currentPrice - (atr * this.atrMultiplier);
    if (newStop > this.stopLoss) {
      this.stopLoss = newStop;
      console.log(`止损上移至: ${this.stopLoss.toFixed(2)}`);
    }
  }
}
```

### 波动率仓位管理

```typescript
class ATRPositionSizing {
  private atr: ATRStrategy;
  private maxRiskPercent: number = 0.02; // 单笔最大风险 2%
  private atrMultiplier: number = 2;

  constructor() {
    this.atr = new ATRStrategy({ period: 14 });
  }

  calculatePositionSize(accountBalance: number, currentPrice: number): number {
    const atr = this.atr.getCurrentATR();
    const stopDistance = atr * this.atrMultiplier;
    const riskAmount = accountBalance * this.maxRiskPercent;
    
    // 仓位 = 风险金额 / 止损距离
    const positionSize = riskAmount / stopDistance;
    
    console.log(`账户余额: ${accountBalance}`);
    console.log(`单笔风险: ${riskAmount}`);
    console.log(`止损距离: ${stopDistance.toFixed(2)}`);
    console.log(`建议仓位: ${positionSize.toFixed(2)} 单位`);
    
    return positionSize;
  }
}

// 使用示例
const positionManager = new ATRPositionSizing();
const size = positionManager.calculatePositionSize(100000, 50000);
// 如果 ATR = 1000, 止损距离 = 2000
// 风险金额 = 100000 * 0.02 = 2000
// 仓位 = 2000 / 2000 = 1 个单位
```

### ATR 突破策略

```typescript
class ATRBreakoutStrategy extends ATRStrategy {
  private previousClose: number = 0;
  private breakoutMultiplier: number = 1.5;

  generateSignal(): Signal | null {
    const atr = this.getCurrentATR();
    const currentPrice = this.getLastPrice();
    
    if (this.previousClose === 0) {
      this.previousClose = currentPrice;
      return null;
    }
    
    const upperBand = this.previousClose + (atr * this.breakoutMultiplier);
    const lowerBand = this.previousClose - (atr * this.breakoutMultiplier);
    
    // 向上突破
    if (currentPrice > upperBand) {
      this.previousClose = currentPrice;
      return {
        type: 'buy',
        strength: 0.8,
        reason: `ATR 突破: 价格 ${currentPrice} > 上轨 ${upperBand.toFixed(2)}`
      };
    }
    
    // 向下突破
    if (currentPrice < lowerBand) {
      this.previousClose = currentPrice;
      return {
        type: 'sell',
        strength: 0.8,
        reason: `ATR 突破: 价格 ${currentPrice} < 下轨 ${lowerBand.toFixed(2)}`
      };
    }
    
    this.previousClose = currentPrice;
    return null;
  }
}
```

### 波动率过滤

```typescript
class VolatilityFilter {
  private atr: ATRStrategy;
  private atrHistory: number[] = [];

  constructor() {
    this.atr = new ATRStrategy({ period: 14 });
  }

  // 判断当前波动率状态
  getVolatilityState(): 'high' | 'low' | 'normal' {
    const currentATR = this.atr.getCurrentATR();
    this.atrHistory.push(currentATR);
    
    if (this.atrHistory.length > 50) {
      this.atrHistory.shift();
    }
    
    if (this.atrHistory.length < 20) return 'normal';
    
    const avgATR = this.atrHistory.reduce((a, b) => a + b, 0) / this.atrHistory.length;
    const ratio = currentATR / avgATR;
    
    if (ratio > 1.5) return 'high';
    if (ratio < 0.7) return 'low';
    return 'normal';
  }

  // 根据波动率调整策略参数
  adjustParameters(): { positionSize: number; stopMultiplier: number } {
    const state = this.getVolatilityState();
    
    switch (state) {
      case 'high':
        // 高波动：减小仓位，放大止损
        return { positionSize: 0.5, stopMultiplier: 3 };
      case 'low':
        // 低波动：正常仓位，正常止损
        return { positionSize: 1, stopMultiplier: 2 };
      default:
        return { positionSize: 1, stopMultiplier: 2 };
    }
  }
}
```

### 与回测引擎结合

```typescript
import { ATRStrategy, BacktestEngine } from 'alphaarena';

const strategy = new ATRStrategy({
  period: 14,
  multiplier: 2,
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
```

## 适用场景

### ✅ 推荐使用

1. **止损设置**：基于真实波动设置合理的止损距离
2. **仓位管理**：根据波动率动态调整仓位大小
3. **波动率判断**：识别市场状态，调整交易策略
4. **突破交易**：使用 ATR 突破确认趋势启动
5. **过滤交易时机**：在高波动时收缩，低波动时扩张

### ❌ 不推荐使用

1. **方向预测**：ATR 不提供价格方向信号
2. **独立交易信号**：需要结合其他指标判断入场时机

## 风险提示

### 1. 波动率突变

ATR 是滞后指标，市场突发事件可能导致波动率急剧变化而 ATR 尚未反映。

**缓解措施**：
```typescript
// 结合当日真实波幅实时监控
const currentTR = Math.max(
  currentHigh - currentLow,
  Math.abs(currentHigh - previousClose),
  Math.abs(currentLow - previousClose)
);
const currentATR = this.atr.getCurrentATR();

if (currentTR > currentATR * 2) {
  console.log('警告：波动率异常，当前波幅是 ATR 的 2 倍以上');
  // 紧急止损或暂停交易
}
```

### 2. 不同品种 ATR 差异

不同交易品种的 ATR 绝对值差异很大，需要标准化处理。

**缓解措施**：
```typescript
// 使用 ATR 占价格的百分比
const atrPercent = (atr / currentPrice) * 100;
console.log(`ATR 百分比: ${atrPercent.toFixed(2)}%`);

// 或使用 ATR 比率（当前 ATR / 历史平均 ATR）
const atrRatio = currentATR / averageHistoricalATR;
```

### 3. 参数敏感性

ATR 周期设置影响波动率判断的灵敏度。

**缓解措施**：
- 使用标准 14 周期作为基准
- 根据交易风格调整（短线用较短周期）
- 结合多个 ATR 周期确认

## 优化建议

### 1. 结合趋势指标

```typescript
class TrendFilteredATRStrategy {
  private atr = new ATRStrategy({ period: 14 });
  private sma = new SMAStrategy({ shortPeriod: 20, longPeriod: 50 });

  generateSignal(): Signal | null {
    const atrValue = this.atr.getCurrentATR();
    const price = this.atr.getLastPrice();
    const trendSignal = this.sma.generateSignal();
    
    // 只在趋势方向使用 ATR 突破
    if (trendSignal?.type === 'buy') {
      // 上涨趋势，关注向上突破
      const breakoutLevel = price + (atrValue * 1.5);
      // ... 向上突破逻辑
    }
    
    if (trendSignal?.type === 'sell') {
      // 下跌趋势，关注向下突破
      const breakoutLevel = price - (atrValue * 1.5);
      // ... 向下突破逻辑
    }
    
    return null;
  }
}
```

### 2. 动态 ATR 止损

```typescript
class DynamicATRStop {
  private atr = new ATRStrategy({ period: 14 });
  private highestPrice: number = 0;
  private stopLoss: number = 0;
  private atrMultiplier: number = 2;

  updateStop(currentPrice: number): number {
    const atr = this.atr.getCurrentATR();
    
    // 更新最高价
    if (currentPrice > this.highestPrice) {
      this.highestPrice = currentPrice;
    }
    
    // 计算新的止损价
    const newStop = this.highestPrice - (atr * this.atrMultiplier);
    
    // 止损只上移不下移
    if (newStop > this.stopLoss) {
      this.stopLoss = newStop;
    }
    
    return this.stopLoss;
  }
}
```

### 3. 波动率自适应策略

```typescript
class VolatilityAdaptiveStrategy {
  private atr = new ATRStrategy({ period: 14 });
  private atrHistory: number[] = [];

  // 根据波动率调整交易频率
  getTradingFrequency(): number {
    const currentATR = this.atr.getCurrentATR();
    const avgATR = this.getAverageATR();
    
    // 波动率高于平均值 → 降低交易频率
    if (currentATR > avgATR * 1.3) {
      return 0.5; // 减少一半交易
    }
    
    // 波动率低于平均值 → 提高交易频率
    if (currentATR < avgATR * 0.7) {
      return 1.5; // 增加 50% 交易
    }
    
    return 1; // 正常频率
  }

  // 根据波动率调整止损距离
  getStopMultiplier(): number {
    const currentATR = this.atr.getCurrentATR();
    const avgATR = this.getAverageATR();
    
    if (currentATR > avgATR * 1.5) {
      return 2.5; // 高波动，放大止损
    }
    if (currentATR < avgATR * 0.7) {
      return 1.5; // 低波动，收紧止损
    }
    return 2; // 正常
  }

  private getAverageATR(): number {
    if (this.atrHistory.length === 0) return this.atr.getCurrentATR();
    return this.atrHistory.reduce((a, b) => a + b, 0) / this.atrHistory.length;
  }
}
```

### 4. Keltner Channel（凯尔特纳通道）

```typescript
// Keltner Channel = EMA 中轨 + ATR 上下轨
class KeltnerChannelStrategy {
  private ema: number[] = [];
  private atr = new ATRStrategy({ period: 14 });
  private period: number = 20;
  private multiplier: number = 2;

  generateSignal(): Signal | null {
    const atr = this.atr.getCurrentATR();
    const price = this.atr.getLastPrice();
    const middle = this.calculateEMA(price);
    
    const upper = middle + (atr * this.multiplier);
    const lower = middle - (atr * this.multiplier);
    
    // 价格触及下轨，买入
    if (price <= lower) {
      return { type: 'buy', strength: 0.7, reason: 'Keltner 下轨支撑' };
    }
    
    // 价格触及上轨，卖出
    if (price >= upper) {
      return { type: 'sell', strength: 0.7, reason: 'Keltner 上轨阻力' };
    }
    
    return null;
  }

  private calculateEMA(price: number): number {
    this.ema.push(price);
    if (this.ema.length > this.period) {
      this.ema.shift();
    }
    // 简化 EMA 计算
    const multiplier = 2 / (this.period + 1);
    return price * multiplier + (this.ema[this.ema.length - 2] || price) * (1 - multiplier);
  }
}
```

## 相关资源

- [Bollinger Bands 策略](./BollingerBands.md) - 另一种波动率指标
- [SMA 策略](./SMA.md) - 趋势跟踪
- [策略调优指南](../guides/strategy-tuning.md) - 如何优化策略参数
- [回测使用说明](../guides/backtesting.md) - 如何进行回测验证