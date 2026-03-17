# Stochastic 策略（随机振荡器）

## 原理说明

Stochastic（随机振荡器）是一种动量指标，通过比较当前收盘价与一定周期内的价格区间来判断市场的超买超卖状态和潜在的反转点。

### 核心概念

- **%K 线**：当前收盘价在 N 周期价格区间中的相对位置（快线）
- **%D 线**：%K 线的 M 周期移动平均（慢线/信号线）
- **超买区**：%K > 80，市场可能过度买入
- **超卖区**：%K < 20，市场可能过度卖出

### 工作原理

```
%K 值
  │
100├───────────────────────── 超买区
 80├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ 
  │        %K（快线）
  │       ╱╲  ╱╲
  │      ╱  ╲╱  ╲   %D（慢线）
 50├─ ─ ─ ─ ─ ─ ─ ─╲─ ─ ─ ─ ─ 
  │                 ╲
  │                  ╲ ╱
 20├─ ─ ─ ─ ─ ─ ─ ─ ─╲─ ─ ─ ─ 
  │                   ╲
  0├───────────────────╲─────── 超卖区
  └──────────────────────────→ 时间
```

### 计算公式

```
%K = (当前收盘价 - N周期最低价) / (N周期最高价 - N周期最低价) × 100
%D = %K 的 M 周期移动平均

常用参数：N = 14, M = 3
```

### 信号类型

1. **超买超卖**：%K 进入超买/超卖区后反转
2. **金叉死叉**：%K 与 %D 的交叉信号
3. **背离**：价格与 Stochastic 方向相反

## 参数配置

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `kPeriod` | number | 14 | %K 线计算周期 |
| `dPeriod` | number | 3 | %D 线（%K 的平滑周期） |
| `smooth` | number | 3 | %K 线平滑周期（慢速随机） |
| `overbought` | number | 80 | 超买阈值 |
| `oversold` | number | 20 | 超卖阈值 |
| `tradeQuantity` | number | 1 | 每次交易数量 |

### 快速 vs 慢速随机

| 类型 | 参数 | 特点 |
|------|------|------|
| 快速随机 | smooth = 1 | %K 波动剧烈，信号多但噪音大 |
| 慢速随机 | smooth = 3 | %K 平滑处理，信号更可靠 |

## 代码示例

### 基础使用

```typescript
import { StochasticStrategy } from 'alphaarena';

const strategy = new StochasticStrategy({
  kPeriod: 14,
  dPeriod: 3,
  smooth: 3,
  overbought: 80,
  oversold: 20,
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
  console.log(`Stochastic 信号: ${signal.type}`);
  console.log(`原因: ${signal.reason}`);
}
```

### 获取 Stochastic 值

```typescript
// 获取当前 Stochastic 指标值
const stochValues = strategy.getStochasticValues();
console.log('%K:', stochValues.k);
console.log('%D:', stochValues.d);
console.log('状态:', stochValues.status); // 'overbought' | 'oversold' | 'neutral'

// 判断市场状态
if (stochValues.k > 80 && stochValues.d > 80) {
  console.log('严重超买');
} else if (stochValues.k < 20 && stochValues.d < 20) {
  console.log('严重超卖');
}
```

### 金叉死叉策略

```typescript
class StochasticCrossStrategy extends StochasticStrategy {
  private prevK: number = 0;
  private prevD: number = 0;

  generateSignal(): Signal | null {
    const values = this.getStochasticValues();
    const k = values.k;
    const d = values.d;
    
    // %K 上穿 %D（金叉）
    if (this.prevK <= this.prevD && k > d) {
      // 在超卖区金叉更可靠
      if (k < 30) {
        return {
          type: 'buy',
          strength: 0.9,
          reason: '超卖区金叉，强烈买入信号'
        };
      }
      return {
        type: 'buy',
        strength: 0.6,
        reason: '%K 上穿 %D 金叉'
      };
    }
    
    // %K 下穿 %D（死叉）
    if (this.prevK >= this.prevD && k < d) {
      // 在超买区死叉更可靠
      if (k > 70) {
        return {
          type: 'sell',
          strength: 0.9,
          reason: '超买区死叉，强烈卖出信号'
        };
      }
      return {
        type: 'sell',
        strength: 0.6,
        reason: '%K 下穿 %D 死叉'
      };
    }
    
    this.prevK = k;
    this.prevD = d;
    return null;
  }
}
```

### 与回测引擎结合

```typescript
import { StochasticStrategy, BacktestEngine } from 'alphaarena';

const strategy = new StochasticStrategy({
  kPeriod: 14,
  dPeriod: 3,
  smooth: 3,
  overbought: 80,
  oversold: 20,
  tradeQuantity: 100
});

const engine = new BacktestEngine({
  symbol: 'ETH/USDT',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  initialCapital: 50000
});

const result = await engine.run(strategy);
console.log('胜率:', result.winRate);
console.log('最大回撤:', result.maxDrawdown);
```

## 适用场景

### ✅ 推荐使用

1. **震荡/区间市场**：Stochastic 在横向波动市场中表现最佳
2. **短线交易**：反应灵敏，适合日内和短线交易
3. **反转点识别**：在震荡区间顶部/底部寻找反转机会
4. **多时间框架确认**：在不同周期确认超买超卖状态

### ❌ 不推荐使用

1. **强趋势市场**：价格可能长期停留在超买/超卖区
2. **突破行情**：趋势突破后指标会持续给出错误反转信号
3. **低流动性市场**：价格波动不规律，指标失真

## 风险提示

### 1. 趋势市场风险

在强趋势中，Stochastic 可能长时间停留在极端区域，过早反向操作会导致亏损。

**缓解措施**：
```typescript
// 只在趋势方向交易
if (isUptrend() && stochValues.k < 20) {
  // 上涨趋势中只关注超卖买入机会
  return { type: 'buy', ... };
}
if (isDowntrend() && stochValues.k > 80) {
  // 下跌趋势中只关注超买卖出机会
  return { type: 'sell', ... };
}
```

### 2. 频繁假信号

Stochastic 反应灵敏，在震荡市场会产生很多假信号。

**缓解措施**：
- 使用慢速随机（smooth > 1）减少噪音
- 等待 %K 从超买超卖区**返回**后再交易
- 结合其他指标确认

### 3. 滞后风险

虽然 Stochastic 相对灵敏，但在快速行情中仍可能滞后。

**缓解措施**：
- 结合价格形态确认
- 使用更短的周期参数
- 设置适当的止损

## 优化建议

### 1. 等待回归确认

```typescript
class ConfirmedStochasticStrategy extends StochasticStrategy {
  private wasOverbought: boolean = false;
  private wasOversold: boolean = false;

  generateSignal(): Signal | null {
    const values = this.getStochasticValues();
    const k = values.k;
    
    // 记录是否曾进入极端区域
    if (k > this.overbought) this.wasOverbought = true;
    if (k < this.oversold) this.wasOversold = true;
    
    // 从超买区回落到正常区域，卖出
    if (this.wasOverbought && k < this.overbought && k < 70) {
      this.wasOverbought = false;
      return { type: 'sell', strength: 0.8, reason: 'Stochastic 从超买区回落' };
    }
    
    // 从超卖区回升到正常区域，买入
    if (this.wasOversold && k > this.oversold && k > 30) {
      this.wasOversold = false;
      return { type: 'buy', strength: 0.8, reason: 'Stochastic 从超卖区回升' };
    }
    
    return null;
  }
}
```

### 2. 背离检测

```typescript
class StochasticDivergenceStrategy extends StochasticStrategy {
  private priceHistory: number[] = [];
  private kHistory: number[] = [];

  generateSignal(): Signal | null {
    const values = this.getStochasticValues();
    const price = this.getLastPrice();
    
    this.priceHistory.push(price);
    this.kHistory.push(values.k);
    
    if (this.priceHistory.length > 30) {
      this.priceHistory.shift();
      this.kHistory.shift();
    }
    
    // 顶背离：价格创新高，%K 未创新高
    if (this.detectBearishDivergence()) {
      return { type: 'sell', strength: 0.85, reason: 'Stochastic 顶背离' };
    }
    
    // 底背离：价格创新低，%K 未创新低
    if (this.detectBullishDivergence()) {
      return { type: 'buy', strength: 0.85, reason: 'Stochastic 底背离' };
    }
    
    return super.generateSignal();
  }
}
```

### 3. 多时间框架确认

```typescript
class MultiTimeframeStochastic {
  private stochHourly = new StochasticStrategy({ kPeriod: 14, dPeriod: 3 });
  private stoch4Hourly = new StochasticStrategy({ kPeriod: 14, dPeriod: 3 });

  generateSignal(): Signal | null {
    const hourly = this.stochHourly.getStochasticValues();
    const fourHourly = this.stoch4Hourly.getStochasticValues();
    
    // 两周期都超卖，强买入
    if (hourly.k < 20 && fourHourly.k < 25) {
      return { type: 'buy', strength: 0.9, reason: '多周期 Stochastic 超卖共振' };
    }
    
    // 两周期都超买，强卖出
    if (hourly.k > 80 && fourHourly.k > 75) {
      return { type: 'sell', strength: 0.9, reason: '多周期 Stochastic 超买共振' };
    }
    
    // 方向一致时中等强度
    if (hourly.k < 30 && fourHourly.k < 40) {
      return { type: 'buy', strength: 0.7, reason: '小时周期超卖' };
    }
    
    if (hourly.k > 70 && fourHourly.k > 60) {
      return { type: 'sell', strength: 0.7, reason: '小时周期超买' };
    }
    
    return null;
  }
}
```

### 4. 结合布林带

```typescript
class StochasticBollingerStrategy extends StochasticStrategy {
  private bb = new BollingerBandsStrategy({ period: 20, stdDev: 2 });

  generateSignal(): Signal | null {
    const stoch = this.getStochasticValues();
    const bands = this.bb.getBollingerBands();
    const price = bands.price;
    
    // 价格触及下轨 + Stochastic 超卖：强买入
    if (price <= bands.lower && stoch.k < 20) {
      return {
        type: 'buy',
        strength: 0.95,
        reason: '布林带下轨 + Stochastic 超卖双确认'
      };
    }
    
    // 价格触及上轨 + Stochastic 超买：强卖出
    if (price >= bands.upper && stoch.k > 80) {
      return {
        type: 'sell',
        strength: 0.95,
        reason: '布林带上轨 + Stochastic 超买双确认'
      };
    }
    
    return null;
  }
}
```

## 相关资源

- [RSI 策略](./RSI.md) - 类似的震荡指标
- [Bollinger Bands 策略](./BollingerBands.md) - 波动率分析
- [策略调优指南](../guides/strategy-tuning.md) - 如何优化策略参数
- [回测使用说明](../guides/backtesting.md) - 如何进行回测验证