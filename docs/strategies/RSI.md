# RSI 策略（相对强弱指数）

## 原理说明

RSI（Relative Strength Index，相对强弱指数）是一种动量振荡器，用于衡量价格变动的速度和幅度，判断市场是否处于超买或超卖状态。

### 核心概念

- **RSI 值范围**：0-100 之间波动
- **超买区**：RSI > 70，市场可能过度买入，存在回调风险
- **超卖区**：RSI < 30，市场可能过度卖出，存在反弹机会
- **中性区**：30 < RSI < 70，市场处于正常波动范围

### 工作原理

```
RSI 值
  │
100├───────────────────────── 超买区（卖出信号）
 80├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ 
  │
  │      ╱╲    ╱╲
  │     ╱  ╲  ╱  ╲
 50├─ ─╱────╲╱────╲──────── 中性区
  │  ╱           ╲
  │ ╱             ╲
 20├─ ─ ─ ─ ─ ─ ─ ─╲─ ─ ─ ─ 
  │                ╲
  0├─────────────────╲─────── 超卖区（买入信号）
  └──────────────────────────→ 时间
```

### 计算公式

```
RS = 平均上涨幅度 / 平均下跌幅度
RSI = 100 - (100 / (1 + RS))
```

## 参数配置

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `period` | number | 14 | RSI 计算周期，常用值 14、9、25 |
| `overbought` | number | 70 | 超买阈值，超过此值考虑卖出 |
| `oversold` | number | 30 | 超卖阈值，低于此值考虑买入 |
| `tradeQuantity` | number | 1 | 每次交易数量 |

### 参数选择建议

| 周期 | 适用场景 | 特点 |
|------|----------|------|
| 9 | 短线交易 | 反应灵敏，信号多，假信号也多 |
| 14 | 标准设置 | 平衡灵敏度和可靠性，最常用 |
| 25 | 长线投资 | 信号少，可靠性高，滞后较大 |

### 阈值调整

- **激进交易**：超买 75/80，超卖 25/20
- **标准交易**：超买 70，超卖 30
- **保守交易**：超买 80，超卖 20

## 代码示例

### 基础使用

```typescript
import { RSIStrategy } from 'alphaarena';

const strategy = new RSIStrategy({
  period: 14,
  overbought: 70,
  oversold: 30,
  tradeQuantity: 10
});

// 模拟数据
const prices = [44, 44.5, 45, 44.8, 46, 47, 46.5, 48, 49, 48.5, 50];

prices.forEach((price, i) => {
  strategy.onData({
    timestamp: Date.now() + i * 86400000,
    close: price
  });
  
  const signal = strategy.generateSignal();
  if (signal) {
    console.log(`Day ${i}: RSI Signal - ${signal.type} (${signal.reason})`);
  }
});
```

### 获取当前 RSI 值

```typescript
// 获取当前 RSI 值用于分析
const rsiValue = strategy.getCurrentRSI();
console.log(`当前 RSI: ${rsiValue.toFixed(2)}`);

if (rsiValue > 70) {
  console.log('市场超买，谨慎追高');
} else if (rsiValue < 30) {
  console.log('市场超卖，关注反弹');
} else {
  console.log('市场中性');
}
```

### 与回测引擎结合

```typescript
import { RSIStrategy, BacktestEngine } from 'alphaarena';

const strategy = new RSIStrategy({
  period: 14,
  overbought: 70,
  oversold: 30,
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
console.log('盈亏比:', result.profitFactor);
```

### 背离检测

```typescript
class RSIDivergenceStrategy extends RSIStrategy {
  private priceHighs: number[] = [];
  private priceLows: number[] = [];
  private rsiHighs: number[] = [];
  private rsiLows: number[] = [];

  generateSignal(): Signal | null {
    const signal = super.generateSignal();
    const rsi = this.getCurrentRSI();
    const price = this.getLastPrice();
    
    // 记录高点和低点
    this.trackExtremes(price, rsi);
    
    // 检测顶背离：价格创新高，RSI 未创新高
    const bearishDivergence = this.detectBearishDivergence();
    if (bearishDivergence) {
      return {
        type: 'sell',
        strength: 0.9,
        reason: '顶背离：价格上涨但 RSI 未创新高，可能反转'
      };
    }
    
    // 检测底背离：价格创新低，RSI 未创新低
    const bullishDivergence = this.detectBullishDivergence();
    if (bullishDivergence) {
      return {
        type: 'buy',
        strength: 0.9,
        reason: '底背离：价格下跌但 RSI 未创新低，可能反弹'
      };
    }
    
    return signal;
  }
}
```

## 适用场景

### ✅ 推荐使用

1. **震荡/区间市场**：RSI 在横向波动的市场中表现最佳
2. **反转点识别**：结合背离信号捕捉趋势反转
3. **多时间框架**：在不同周期确认超买超卖状态
4. **作为过滤器**：配合趋势策略过滤入场时机

### ❌ 不推荐使用

1. **强趋势市场**：RSI 可能长期停留在超买/超卖区
2. **单边行情**：趋势强劲时信号容易过早
3. **高频交易**：RSI 计算需要足够的数据周期

## 风险提示

### 1. 强趋势中的假信号

在强上涨趋势中，RSI 可能长时间停留在超买区，过早卖出会错失后续涨幅。

**缓解措施**：
```typescript
// 趋势市场只使用顺势信号
if (isUptrend && rsi < 30) {
  // 上涨趋势中只关注超卖买入信号
  return { type: 'buy', ... };
}
if (isDowntrend && rsi > 70) {
  // 下跌趋势中只关注超买卖出信号
  return { type: 'sell', ... };
}
```

### 2. 背离失败

背离信号并不总是可靠，有时价格会继续原方向运动。

**缓解措施**：
- 等待价格确认反转后再入场
- 结合成交量确认背离有效性
- 使用多个时间框架确认

### 3. 参数敏感性

不同品种和周期需要不同的参数设置。

**缓解措施**：
- 针对具体交易品种进行回测优化
- 使用自适应参数调整
- 保持参数相对稳定，避免过拟合

## 优化建议

### 1. 结合趋势过滤

```typescript
class TrendFilteredRSI extends RSIStrategy {
  private sma200: number[] = [];

  generateSignal(): Signal | null {
    const signal = super.generateSignal();
    const currentPrice = this.getLastPrice();
    const avgPrice = this.calculateSMA(200);
    
    if (!signal) return null;
    
    // 只在趋势方向交易
    if (currentPrice > avgPrice && signal.type === 'sell') {
      return null; // 上涨趋势中忽略卖出信号
    }
    if (currentPrice < avgPrice && signal.type === 'buy') {
      return null; // 下跌趋势中忽略买入信号
    }
    
    return signal;
  }
}
```

### 2. 多级确认

```typescript
// 使用多级 RSI 确认
class MultiRSIStrategy {
  private rsiShort = new RSIStrategy({ period: 9 });
  private rsiMedium = new RSIStrategy({ period: 14 });
  private rsiLong = new RSIStrategy({ period: 25 });

  generateSignal(): Signal | null {
    const shortRSI = this.rsiShort.getCurrentRSI();
    const mediumRSI = this.rsiMedium.getCurrentRSI();
    const longRSI = this.rsiLong.getCurrentRSI();
    
    // 多级确认：所有 RSI 都在超卖区
    if (shortRSI < 30 && mediumRSI < 35 && longRSI < 40) {
      return { type: 'buy', strength: 0.85, reason: '多级 RSI 确认超卖' };
    }
    
    // 多级确认：所有 RSI 都在超买区
    if (shortRSI > 70 && mediumRSI > 65 && longRSI > 60) {
      return { type: 'sell', strength: 0.85, reason: '多级 RSI 确认超买' };
    }
    
    return null;
  }
}
```

### 3. 动态阈值

```typescript
// 根据市场波动调整阈值
class DynamicRSI extends RSIStrategy {
  generateSignal(): Signal | null {
    const volatility = this.calculateVolatility();
    
    // 高波动市场使用更极端的阈值
    const overbought = volatility > 0.02 ? 75 : 70;
    const oversold = volatility > 0.02 ? 25 : 30;
    
    const rsi = this.getCurrentRSI();
    
    if (rsi < oversold) {
      return { type: 'buy', strength: (oversold - rsi) / oversold };
    }
    if (rsi > overbought) {
      return { type: 'sell', strength: (rsi - overbought) / (100 - overbought) };
    }
    
    return null;
  }
}
```

## 相关资源

- [SMA 策略](./SMA.md) - 趋势跟踪策略
- [MACD 策略](./MACD.md) - 趋势确认指标
- [Stochastic 策略](./Stochastic.md) - 类似的震荡指标
- [策略调优指南](../guides/strategy-tuning.md) - 如何优化策略参数