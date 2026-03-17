# AlphaArena 策略开发指南

本指南将帮助您开发自定义交易策略，从基础概念到高级技巧。

## 目录

1. [内置策略概览](#内置策略概览)
2. [策略选择指南](#策略选择指南)
3. [策略组合建议](#策略组合建议)
4. [策略基础](#策略基础)
5. [策略接口](#策略接口)
6. [内置策略分析](#内置策略分析)
7. [开发自定义策略](#开发自定义策略)
8. [策略测试](#策略测试)
9. [最佳实践](#最佳实践)

## 内置策略概览

AlphaArena 提供了 6 种经过验证的内置策略，覆盖趋势跟踪、震荡交易和波动率管理等多种交易场景。

### 策略列表

| 策略 | 类型 | 适用市场 | 信号特点 |
|------|------|----------|----------|
| [SMA](../strategies/SMA.md) | 趋势跟踪 | 趋势市场 | 金叉买入，死叉卖出 |
| [RSI](../strategies/RSI.md) | 震荡指标 | 震荡市场 | 超买卖入，超买卖出 |
| [MACD](../strategies/MACD.md) | 趋势动量 | 趋势市场 | 动量确认，趋势判断 |
| [Bollinger Bands](../strategies/BollingerBands.md) | 波动率 | 震荡市场 | 轨道回归，带宽突破 |
| [Stochastic](../strategies/Stochastic.md) | 震荡指标 | 震荡市场 | 超买超卖，金叉死叉 |
| [ATR](../strategies/ATR.md) | 波动率 | 所有市场 | 止损设置，仓位管理 |

### 策略特性对比

```
趋势跟踪能力:
SMA ★★★★★  MACD ★★★★☆  Bollinger ★★★☆☆  Stochastic ★★☆☆☆  RSI ★★☆☆☆  ATR ★☆☆☆☆

震荡市场表现:
RSI ★★★★★  Stochastic ★★★★☆  Bollinger ★★★★☆  SMA ★★☆☆☆  MACD ★★☆☆☆  ATR ☆☆☆☆☆

波动率管理:
ATR ★★★★★  Bollinger ★★★★☆  其他 ☆☆☆☆☆

信号频率:
Stochastic ★★★★★  RSI ★★★★☆  SMA ★★★☆☆  MACD ★★☆☆☆  Bollinger ★★☆☆☆  ATR ☆☆☆☆☆

滞后性:
ATR ★☆☆☆☆  Stochastic ★★☆☆☆  RSI ★★☆☆☆  Bollinger ★★★☆☆  MACD ★★★★☆  SMA ★★★★★
```

## 策略选择指南

### 按市场环境选择

#### 趋势市场

当市场呈现明显的上涨或下跌趋势时：

```typescript
// 首选：SMA 交叉策略
const strategy = new SMAStrategy({
  shortPeriod: 10,
  longPeriod: 50
});

// 备选：MACD 策略
const macdStrategy = new MACDStrategy({
  fastPeriod: 12,
  slowPeriod: 26,
  signalPeriod: 9
});
```

**特点**：
- 顺势交易，不抄底逃顶
- 信号可靠但滞后
- 设置较宽的止损

#### 震荡市场

当价格在一定区间内波动时：

```typescript
// 首选：RSI 策略
const strategy = new RSIStrategy({
  period: 14,
  overbought: 70,
  oversold: 30
});

// 备选：Stochastic 策略
const stochStrategy = new StochasticStrategy({
  kPeriod: 14,
  dPeriod: 3,
  smooth: 3
});

// 备选：Bollinger Bands 策略
const bbStrategy = new BollingerBandsStrategy({
  period: 20,
  stdDev: 2
});
```

**特点**：
- 低买高卖，均值回归
- 信号频繁但需要过滤
- 设置较紧的止损

#### 高波动市场

当市场波动剧烈时：

```typescript
// 使用 ATR 管理风险
const atrStrategy = new ATRStrategy({ period: 14 });

// 动态调整止损
const stopLoss = currentPrice - (atr * 2);

// 减小仓位
const positionSize = riskAmount / (atr * 2);
```

**特点**：
- 放宽止损距离
- 减小仓位
- 选择低频信号策略

### 按交易风格选择

| 交易风格 | 推荐策略 | 参数建议 |
|----------|----------|----------|
| 日内交易 | Stochastic, RSI | 短周期参数，紧止损 |
| 短线交易（数天） | RSI, SMA | 中等周期参数 |
| 中线交易（数周） | SMA, MACD | 标准参数 |
| 长线投资（数月） | SMA(50/200), MACD | 长周期参数 |

### 按交易品种选择

| 交易品种 | 推荐策略 | 注意事项 |
|----------|----------|----------|
| 股票 | SMA, MACD | 关注基本面，低波动时用震荡策略 |
| 加密货币 | RSI, Bollinger | 高波动市场，ATR 止损很重要 |
| 外汇 | Stochastic, RSI | 流动性好，震荡策略表现佳 |
| 期货 | MACD, SMA | 关注合约到期，趋势策略适用 |

### 选择决策树

```
开始
  │
  ├─ 市场有明确趋势吗？
  │   ├─ 是 → SMA 或 MACD
  │   └─ 否 → 继续判断
  │
  ├─ 价格在一定区间波动吗？
  │   ├─ 是 → RSI 或 Stochastic 或 Bollinger
  │   └─ 否 → 继续判断
  │
  ├─ 波动率如何？
  │   ├─ 高波动 → 用 ATR 管理风险，减小仓位
  │   ├─ 低波动 → 等待突破信号
  │   └─ 正常 → 选择适合的策略
  │
  └─ 你的交易频率偏好？
      ├─ 高频 → Stochastic, RSI（短周期）
      ├─ 中频 → SMA, MACD（标准周期）
      └─ 低频 → SMA, MACD（长周期）
```

## 策略组合建议

### 为什么组合策略？

单一策略存在局限性：
- **SMA**：震荡市场频繁止损
- **RSI**：趋势市场过早反向操作
- **MACD**：信号滞后
- **Bollinger**：强趋势中假信号多

策略组合可以：
1. **互补缺陷**：趋势策略 + 震荡策略
2. **确认信号**：多指标共振
3. **过滤噪音**：减少假信号
4. **分散风险**：不依赖单一策略

### 推荐组合

#### 1. 趋势 + 震荡组合

```typescript
class TrendOscillatorCombo {
  private sma = new SMAStrategy({ shortPeriod: 10, longPeriod: 50 });
  private rsi = new RSIStrategy({ period: 14, overbought: 70, oversold: 30 });

  generateSignal(): Signal | null {
    const smaSignal = this.sma.generateSignal();
    const rsiValue = this.rsi.getCurrentRSI();
    
    // 趋势方向由 SMA 判断
    const trend = this.sma.getTrendDirection(); // 'up' | 'down' | 'neutral'
    
    // 入场时机由 RSI 判断
    if (trend === 'up' && rsiValue < 40) {
      // 上涨趋势中 RSI 回调，买入机会
      return { type: 'buy', strength: 0.85, reason: '趋势向上 + RSI 回调' };
    }
    
    if (trend === 'down' && rsiValue > 60) {
      // 下跌趋势中 RSI 反弹，卖出机会
      return { type: 'sell', strength: 0.85, reason: '趋势向下 + RSI 反弹' };
    }
    
    return null;
  }
}
```

#### 2. 多指标确认组合

```typescript
class MultiIndicatorConfirmation {
  private rsi = new RSIStrategy({ period: 14 });
  private macd = new MACDStrategy({ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });
  private bb = new BollingerBandsStrategy({ period: 20, stdDev: 2 });

  generateSignal(): Signal | null {
    const rsiSignal = this.rsi.generateSignal();
    const macdSignal = this.macd.generateSignal();
    const bbValues = this.bb.getBollingerBands();
    const price = bbValues.price;
    
    // 买入确认：多个指标同时看涨
    const buyConfirmations = [
      rsiSignal?.type === 'buy',
      macdSignal?.type === 'buy',
      price <= bbValues.lower
    ].filter(Boolean).length;
    
    // 卖出确认：多个指标同时看跌
    const sellConfirmations = [
      rsiSignal?.type === 'sell',
      macdSignal?.type === 'sell',
      price >= bbValues.upper
    ].filter(Boolean).length;
    
    // 至少 2 个确认才交易
    if (buyConfirmations >= 2) {
      return { type: 'buy', strength: buyConfirmations / 3, reason: '多指标买入确认' };
    }
    
    if (sellConfirmations >= 2) {
      return { type: 'sell', strength: sellConfirmations / 3, reason: '多指标卖出确认' };
    }
    
    return null;
  }
}
```

#### 3. 趋势过滤 + 震荡入场

```typescript
class TrendFilteredOscillator {
  private sma200 = new SMAStrategy({ shortPeriod: 200, longPeriod: 200 }); // 用于判断趋势
  private stoch = new StochasticStrategy({ kPeriod: 14, dPeriod: 3 });

  generateSignal(): Signal | null {
    const price = this.getLastPrice();
    const smaValue = this.sma200.getCurrentMA();
    const stochSignal = this.stoch.generateSignal();
    
    // 趋势判断
    const isUptrend = price > smaValue;
    const isDowntrend = price < smaValue;
    
    if (!stochSignal) return null;
    
    // 只在趋势方向交易
    if (isUptrend && stochSignal.type === 'buy') {
      return { ...stochSignal, reason: '上涨趋势 + Stochastic 超卖' };
    }
    
    if (isDowntrend && stochSignal.type === 'sell') {
      return { ...stochSignal, reason: '下跌趋势 + Stochastic 超买' };
    }
    
    return null; // 忽略逆势信号
  }
}
```

#### 4. 波动率自适应组合

```typescript
class VolatilityAdaptiveCombo {
  private atr = new ATRStrategy({ period: 14 });
  private sma = new SMAStrategy({ shortPeriod: 10, longPeriod: 50 });
  private rsi = new RSIStrategy({ period: 14 });

  generateSignal(): Signal | null {
    const atr = this.atr.getCurrentATR();
    const price = this.atr.getLastPrice();
    const volatility = atr / price; // ATR 百分比
    
    // 高波动：使用趋势策略
    if (volatility > 0.03) {
      return this.sma.generateSignal();
    }
    
    // 低波动：使用震荡策略
    if (volatility < 0.01) {
      return this.rsi.generateSignal();
    }
    
    // 中等波动：组合信号
    const smaSignal = this.sma.generateSignal();
    const rsiSignal = this.rsi.generateSignal();
    
    if (smaSignal?.type === rsiSignal?.type && smaSignal) {
      return { ...smaSignal, strength: smaSignal.strength * 1.2 };
    }
    
    return null;
  }
}
```

### 组合策略注意事项

1. **避免过度组合**：3-4 个指标足够，过多会增加复杂性
2. **信号一致性**：确保组合的策略逻辑不冲突
3. **参数独立性**：各策略参数应独立优化
4. **回测验证**：组合策略必须在样本外验证
5. **权重分配**：可以给不同策略分配不同权重

```typescript
class WeightedComboStrategy {
  private strategies: { strategy: Strategy; weight: number }[] = [];

  addStrategy(strategy: Strategy, weight: number) {
    this.strategies.push({ strategy, weight });
  }

  generateSignal(): Signal | null {
    let buyScore = 0;
    let sellScore = 0;
    let totalWeight = 0;

    for (const { strategy, weight } of this.strategies) {
      const signal = strategy.generateSignal();
      totalWeight += weight;
      
      if (signal?.type === 'buy') {
        buyScore += weight * signal.strength;
      } else if (signal?.type === 'sell') {
        sellScore += weight * signal.strength;
      }
    }

    const threshold = totalWeight * 0.6; // 60% 权重阈值

    if (buyScore > threshold && buyScore > sellScore) {
      return { type: 'buy', strength: buyScore / totalWeight };
    }
    if (sellScore > threshold && sellScore > buyScore) {
      return { type: 'sell', strength: sellScore / totalWeight };
    }
    
    return null;
  }
}
```

## 策略基础

### 什么是交易策略？

在 AlphaArena 中，交易策略是一个接收市场数据、生成交易信号的算法。策略的核心职责是：

1. **数据接收**：接收市场价格、订单簿等数据
2. **信号生成**：根据算法逻辑生成买入/卖出信号
3. **订单执行**：将信号转换为实际的交易订单

### 策略生命周期

```
初始化 (initialize)
    ↓
接收数据 (onData)
    ↓
生成信号 (generateSignal)
    ↓
执行交易 (execute)
    ↓
更新状态 (onTick)
    ↓
[循环]
    ↓
停止 (onStop)
```

## 策略接口

### 基础接口

```typescript
interface Strategy {
  // 策略名称
  readonly name: string;

  // 初始化策略
  initialize(context: StrategyContext): Promise<void>;

  // 接收市场数据
  onData(data: MarketData): void;

  // 生成交易信号
  generateSignal(): Signal | null;

  // 执行交易
  execute(signal: Signal, context: ExecutionContext): Promise<Order | null>;

  // 每个时间周期调用
  onTick(): void;

  // 策略停止
  onStop(): void;
}
```

### 策略上下文

```typescript
interface StrategyContext {
  // 当前持仓
  portfolio: Portfolio;

  // 订单簿访问
  orderBook: OrderBook;

  // 历史数据
  history: HistoricalData;

  // 配置参数
  params: Record<string, any>;

  // 日志工具
  logger: Logger;
}
```

### 信号类型

```typescript
type SignalType = 'buy' | 'sell' | 'hold';

interface Signal {
  type: SignalType;
  strength: number;      // 信号强度 0-1
  price?: number;        // 建议价格
  quantity?: number;     // 建议数量
  reason?: string;       // 信号原因
  metadata?: Record<string, any>;
}
```

## 内置策略分析

### SMA 交叉策略

```typescript
export class SMAStrategy {
  private shortPeriod: number;
  private longPeriod: number;
  private shortMA: number[] = [];
  private longMA: number[] = [];
  
  constructor(params: { shortPeriod: number; longPeriod: number }) {
    this.shortPeriod = params.shortPeriod || 5;
    this.longPeriod = params.longPeriod || 20;
  }

  onData(data: MarketData): void {
    // 计算短期均线
    this.shortMA.push(this.calculateSMA(data.close, this.shortPeriod));
    
    // 计算长期均线
    this.longMA.push(this.calculateSMA(data.close, this.longPeriod));
  }

  generateSignal(): Signal | null {
    if (this.shortMA.length < 2) return null;

    const currentShortMA = this.shortMA[this.shortMA.length - 1];
    const previousShortMA = this.shortMA[this.shortMA.length - 2];
    const currentLongMA = this.longMA[this.longMA.length - 1];
    const previousLongMA = this.longMA[this.longMA.length - 2];

    // 金叉：短期均线上穿长期均线
    if (previousShortMA <= previousLongMA && currentShortMA > currentLongMA) {
      return { type: 'buy', strength: 0.8, reason: 'Golden Cross' };
    }

    // 死叉：短期均线下穿长期均线
    if (previousShortMA >= previousLongMA && currentShortMA < currentLongMA) {
      return { type: 'sell', strength: 0.8, reason: 'Death Cross' };
    }

    return null;
  }

  private calculateSMA(prices: number[], period: number): number {
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  }
}
```

### RSI 策略

```typescript
export class RSIStrategy {
  private period: number;
  private overbought: number;
  private oversold: number;
  private gains: number[] = [];
  private losses: number[] = [];
  
  constructor(params: { period: number; overbought: number; oversold: number }) {
    this.period = params.period || 14;
    this.overbought = params.overbought || 70;
    this.oversold = params.oversold || 30;
  }

  onData(data: MarketData): void {
    if (this.previousClose === undefined) {
      this.previousClose = data.close;
      return;
    }

    const change = data.close - this.previousClose;
    this.gains.push(change > 0 ? change : 0);
    this.losses.push(change < 0 ? Math.abs(change) : 0);

    // 保持固定长度
    if (this.gains.length > this.period) {
      this.gains.shift();
      this.losses.shift();
    }

    this.previousClose = data.close;
  }

  generateSignal(): Signal | null {
    if (this.gains.length < this.period) return null;

    const rsi = this.calculateRSI();
    
    if (rsi < this.oversold) {
      return { type: 'buy', strength: 1 - rsi / this.oversold, reason: `RSI Oversold (${rsi.toFixed(2)})` };
    }
    
    if (rsi > this.overbought) {
      return { type: 'sell', strength: (rsi - this.overbought) / (100 - this.overbought), reason: `RSI Overbought (${rsi.toFixed(2)})` };
    }

    return null;
  }

  private calculateRSI(): number {
    const avgGain = this.gains.reduce((a, b) => a + b, 0) / this.period;
    const avgLoss = this.losses.reduce((a, b) => a + b, 0) / this.period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }
}
```

## 开发自定义策略

### 步骤 1：创建策略文件

在 `src/strategy/` 目录下创建新策略文件：

```typescript
// src/strategy/MyCustomStrategy.ts

import { Strategy, StrategyContext, Signal, MarketData } from './types';
import { Order } from '../orderbook/types';

export interface MyCustomStrategyParams {
  // 定义策略参数
  threshold: number;
  lookbackPeriod: number;
}

export class MyCustomStrategy implements Strategy {
  readonly name = 'my-custom-strategy';
  
  private params: MyCustomStrategyParams;
  private context: StrategyContext;
  private dataBuffer: number[] = [];

  constructor(params: Partial<MyCustomStrategyParams> = {}) {
    this.params = {
      threshold: params.threshold || 0.5,
      lookbackPeriod: params.lookbackPeriod || 20,
    };
  }

  async initialize(context: StrategyContext): Promise<void> {
    this.context = context;
    context.logger.info(`Initializing ${this.name} with params:`, this.params);
  }

  onData(data: MarketData): void {
    // 存储数据用于分析
    this.dataBuffer.push(data.close);
    
    // 保持固定长度的缓冲区
    if (this.dataBuffer.length > this.params.lookbackPeriod) {
      this.dataBuffer.shift();
    }
  }

  generateSignal(): Signal | null {
    // 确保有足够的数据
    if (this.dataBuffer.length < this.params.lookbackPeriod) {
      return null;
    }

    // 实现你的信号逻辑
    const signal = this.analyzeMarket();
    
    return signal;
  }

  async execute(signal: Signal, context: ExecutionContext): Promise<Order | null> {
    if (signal.type === 'hold') return null;

    const order: Order = {
      id: `order-${Date.now()}`,
      side: signal.type === 'buy' ? 'buy' : 'sell',
      type: 'market',
      symbol: context.symbol,
      quantity: signal.quantity || this.getDefaultQuantity(),
      timestamp: Date.now(),
    };

    return order;
  }

  onTick(): void {
    // 周期性任务，如更新指标、清理缓存等
  }

  onStop(): void {
    this.context.logger.info(`Stopping ${this.name}`);
    this.dataBuffer = [];
  }

  private analyzeMarket(): Signal | null {
    // 实现你的市场分析逻辑
    // 示例：简单的动量策略
    
    const prices = this.dataBuffer;
    const momentum = (prices[prices.length - 1] - prices[0]) / prices[0];
    
    if (momentum > this.params.threshold) {
      return {
        type: 'buy',
        strength: Math.min(momentum / this.params.threshold, 1),
        reason: `Positive momentum: ${(momentum * 100).toFixed(2)}%`,
      };
    }
    
    if (momentum < -this.params.threshold) {
      return {
        type: 'sell',
        strength: Math.min(Math.abs(momentum) / this.params.threshold, 1),
        reason: `Negative momentum: ${(momentum * 100).toFixed(2)}%`,
      };
    }
    
    return { type: 'hold', strength: 0 };
  }

  private getDefaultQuantity(): number {
    // 根据当前持仓计算默认交易数量
    return 1;
  }
}
```

### 步骤 2：导出策略

在 `src/strategy/index.ts` 中添加导出：

```typescript
export * from './MyCustomStrategy';
```

### 步骤 3：注册策略

在 `StrategyManager` 中注册新策略：

```typescript
// src/strategy/StrategyManager.ts

import { MyCustomStrategy } from './MyCustomStrategy';

// 在策略注册表中添加
const strategyRegistry = {
  'sma': SMAStrategy,
  'rsi': RSIStrategy,
  'my-custom': MyCustomStrategy,  // 添加新策略
};
```

### 步骤 4：使用策略

```typescript
// 通过 CLI 使用
npx alpha-arena run --strategy my-custom --symbol BTC/USDT

// 通过代码使用
import { MyCustomStrategy } from './strategy/MyCustomStrategy';

const strategy = new MyCustomStrategy({
  threshold: 0.3,
  lookbackPeriod: 30,
});

await strategy.initialize(context);
```

## 策略测试

### 单元测试

```typescript
// tests/strategy/MyCustomStrategy.test.ts

import { MyCustomStrategy } from '../../src/strategy/MyCustomStrategy';

describe('MyCustomStrategy', () => {
  let strategy: MyCustomStrategy;

  beforeEach(() => {
    strategy = new MyCustomStrategy({
      threshold: 0.5,
      lookbackPeriod: 10,
    });
  });

  describe('generateSignal', () => {
    it('should return buy signal when momentum exceeds threshold', () => {
      // 模拟价格上涨
      for (let i = 0; i < 10; i++) {
        strategy.onData({ close: 100 + i * 10 });
      }

      const signal = strategy.generateSignal();
      
      expect(signal).not.toBeNull();
      expect(signal?.type).toBe('buy');
    });

    it('should return sell signal when momentum falls below threshold', () => {
      // 模拟价格下跌
      for (let i = 0; i < 10; i++) {
        strategy.onData({ close: 200 - i * 15 });
      }

      const signal = strategy.generateSignal();
      
      expect(signal).not.toBeNull();
      expect(signal?.type).toBe('sell');
    });

    it('should return hold when momentum is within threshold', () => {
      // 模拟价格稳定
      for (let i = 0; i < 10; i++) {
        strategy.onData({ close: 100 + (Math.random() - 0.5) * 5 });
      }

      const signal = strategy.generateSignal();
      
      expect(signal?.type).toBe('hold');
    });
  });
});
```

### 回测测试

```typescript
// tests/strategy/MyCustomStrategy.backtest.test.ts

import { BacktestEngine } from '../../src/backtest/BacktestEngine';
import { MyCustomStrategy } from '../../src/strategy/MyCustomStrategy';

describe('MyCustomStrategy Backtest', () => {
  it('should perform well on historical data', async () => {
    const engine = new BacktestEngine({
      capital: 10000,
      symbol: 'BTC/USDT',
      strategy: 'my-custom',
      strategyParams: {
        threshold: 0.5,
        lookbackPeriod: 20,
      },
      startTime: new Date('2024-01-01').getTime(),
      endTime: new Date('2024-12-31').getTime(),
    });

    const result = await engine.run();

    console.log('Backtest Results:', {
      totalReturn: result.stats.totalReturn,
      sharpeRatio: result.stats.sharpeRatio,
      maxDrawdown: result.stats.maxDrawdown,
      winRate: result.stats.winRate,
    });

    // 基本断言
    expect(result.stats.totalTrades).toBeGreaterThan(0);
    expect(result.stats.maxDrawdown).toBeLessThan(0.5); // 最大回撤小于 50%
  });
});
```

## 最佳实践

### 1. 参数设计

- 使用合理的默认值
- 提供参数验证
- 文档化所有参数

```typescript
constructor(params: Partial<StrategyParams> = {}) {
  // 验证参数
  if (params.threshold && (params.threshold < 0 || params.threshold > 1)) {
    throw new Error('Threshold must be between 0 and 1');
  }
  
  this.params = {
    threshold: params.threshold ?? 0.5,  // 使用 ?? 提供默认值
    lookbackPeriod: params.lookbackPeriod ?? 20,
  };
}
```

### 2. 日志记录

- 记录关键事件
- 使用适当的日志级别
- 避免过度日志

```typescript
// 好的做法
context.logger.info(`Signal generated: ${signal.type} at strength ${signal.strength}`);
context.logger.warn('Insufficient data for analysis');
context.logger.error('Failed to execute order:', error);

// 避免在每个 tick 都记录
```

### 3. 错误处理

```typescript
async execute(signal: Signal, context: ExecutionContext): Promise<Order | null> {
  try {
    const order = await this.createOrder(signal, context);
    return order;
  } catch (error) {
    context.logger.error('Order execution failed:', error);
    return null;  // 返回 null 表示执行失败
  }
}
```

### 4. 性能优化

- 使用增量计算而非全量重算
- 缓存中间结果
- 避免内存泄漏

```typescript
// 使用增量计算
private lastMA: number = 0;

private updateMA(newPrice: number, period: number): number {
  if (this.priceBuffer.length < period) {
    this.lastMA = (this.lastMA * this.priceBuffer.length + newPrice) / (this.priceBuffer.length + 1);
  } else {
    const oldPrice = this.priceBuffer[this.priceBuffer.length - period];
    this.lastMA = this.lastMA + (newPrice - oldPrice) / period;
  }
  return this.lastMA;
}
```

### 5. 风险管理

- 设置止损/止盈
- 控制仓位大小
- 避免过度交易

```typescript
async execute(signal: Signal, context: ExecutionContext): Promise<Order | null> {
  // 检查持仓限制
  const currentPosition = context.portfolio.getPosition(context.symbol);
  if (Math.abs(currentPosition.quantity) >= this.maxPositionSize) {
    context.logger.warn('Position size limit reached');
    return null;
  }

  // 计算安全的交易数量
  const safeQuantity = this.calculateSafeQuantity(signal, context);
  
  const order = await this.createOrder(signal, context, safeQuantity);
  
  // 设置止损
  if (order) {
    await this.setStopLoss(order, context);
  }
  
  return order;
}
```

### 6. 策略文档

```typescript
/**
 * MyCustomStrategy - 自定义策略说明
 * 
 * @description
 * 基于动量的趋势跟踪策略，通过分析价格变化率生成交易信号。
 * 
 * @param threshold - 动量阈值，超过此值触发交易信号 (默认: 0.5)
 * @param lookbackPeriod - 回看周期，用于计算动量 (默认: 20)
 * 
 * @example
 * ```typescript
 * const strategy = new MyCustomStrategy({
 *   threshold: 0.3,
 *   lookbackPeriod: 30,
 * });
 * ```
 * 
 * @performance
 * - 预期年化收益: 15-25%
 * - 最大回撤: <20%
 * - 适用市场: 趋势市场
 */
```

## 进阶主题

### 组合策略

```typescript
class CompositeStrategy implements Strategy {
  private strategies: Strategy[];

  constructor(strategies: Strategy[]) {
    this.strategies = strategies;
  }

  generateSignal(): Signal | null {
    const signals = this.strategies
      .map(s => s.generateSignal())
      .filter(Boolean);

    // 投票机制
    const buyVotes = signals.filter(s => s?.type === 'buy').length;
    const sellVotes = signals.filter(s => s?.type === 'sell').length;

    if (buyVotes > sellVotes && buyVotes > this.strategies.length / 2) {
      return { type: 'buy', strength: buyVotes / this.strategies.length };
    }

    if (sellVotes > buyVotes && sellVotes > this.strategies.length / 2) {
      return { type: 'sell', strength: sellVotes / this.strategies.length };
    }

    return { type: 'hold', strength: 0 };
  }
}
```

### 自适应参数

```typescript
class AdaptiveStrategy implements Strategy {
  private adaptivePeriod: number;

  onData(data: MarketData): void {
    // 根据市场波动率调整参数
    const volatility = this.calculateVolatility();
    
    if (volatility > 0.02) {
      this.adaptivePeriod = this.params.longPeriod; // 高波动时使用长周期
    } else {
      this.adaptivePeriod = this.params.shortPeriod; // 低波动时使用短周期
    }
  }
}
```

## 相关资源

### 策略详细文档

- [SMA 策略](../strategies/SMA.md) - 简单移动平均交叉策略
- [RSI 策略](../strategies/RSI.md) - 相对强弱指数策略
- [MACD 策略](../strategies/MACD.md) - 指数平滑异同移动平均策略
- [Bollinger Bands 策略](../strategies/BollingerBands.md) - 布林带策略
- [Stochastic 策略](../strategies/Stochastic.md) - 随机振荡器策略
- [ATR 策略](../strategies/ATR.md) - 平均真实波幅策略

### 使用指南

- [策略调优指南](./strategy-tuning.md) - 如何优化策略参数
- [回测使用说明](./backtesting.md) - 如何进行回测验证
- [快速开始](./quick-start.md) - 新手入门指南
- [常见问题解答](./faq.md) - 常见问题解答

### API 文档

- [API 文档](../api/openapi.yaml) - API 接口文档