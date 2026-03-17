# 策略调优指南

本指南将帮助您优化交易策略参数，提高策略表现，同时避免常见的陷阱。

## 目录

1. [调优原则](#调优原则)
2. [参数优化方法](#参数优化方法)
3. [回测验证](#回测验证)
4. [避免过拟合](#避免过拟合)
5. [不同市场条件下的策略表现](#不同市场条件下的策略表现)
6. [实战建议](#实战建议)

## 调优原则

### 核心原则

1. **稳健性优先**：好的参数在各种市场环境下都表现稳定，而非只在特定时期表现优异
2. **参数越少越好**：参数越多，过拟合风险越高
3. **逻辑可解释性**：参数设置应该有合理的市场逻辑支撑
4. **样本外验证**：必须用样本外数据验证参数有效性

### 调优流程

```
数据准备
    ↓
参数网格搜索
    ↓
样本内回测
    ↓
样本外验证 ←─── 过拟合？
    ↓               ↓
表现评估        重新设计
    ↓
参数确认
    ↓
实盘监控
```

## 参数优化方法

### 1. 网格搜索（Grid Search）

遍历所有参数组合，找到最优解。

```typescript
import { SMAStrategy, BacktestEngine } from 'alphaarena';

// 定义参数范围
const shortPeriods = [5, 10, 15, 20];
const longPeriods = [20, 30, 50, 100, 200];

const results: any[] = [];

// 遍历所有组合
for (const short of shortPeriods) {
  for (const long of longPeriods) {
    if (short >= long) continue; // 短周期必须小于长周期
    
    const strategy = new SMAStrategy({
      shortPeriod: short,
      longPeriod: long,
      tradeQuantity: 100
    });
    
    const engine = new BacktestEngine({
      symbol: 'BTC/USDT',
      startDate: '2023-01-01',
      endDate: '2023-12-31', // 样本内数据
      initialCapital: 100000
    });
    
    const result = await engine.run(strategy);
    
    results.push({
      short,
      long,
      return: result.totalReturn,
      sharpe: result.sharpeRatio,
      maxDD: result.maxDrawdown,
      trades: result.totalTrades
    });
  }
}

// 按收益率排序
results.sort((a, b) => b.return - a.return);
console.log('Top 5 参数组合:');
results.slice(0, 5).forEach((r, i) => {
  console.log(`${i + 1}. SMA(${r.short}/${r.long}): 收益 ${r.return.toFixed(2)}%, 夏普 ${r.sharpe.toFixed(2)}`);
});
```

### 2. 随机搜索（Random Search）

当参数空间很大时，随机采样更高效。

```typescript
import { SMAStrategy, BacktestEngine } from 'alphaarena';

const iterations = 50; // 随机采样次数
const results: any[] = [];

for (let i = 0; i < iterations; i++) {
  // 随机生成参数
  const short = Math.floor(Math.random() * 45) + 5; // 5-50
  const long = Math.floor(Math.random() * 195) + 50; // 50-245
  
  if (short >= long) continue;
  
  const strategy = new SMAStrategy({ shortPeriod: short, longPeriod: long });
  const engine = new BacktestEngine({
    symbol: 'BTC/USDT',
    startDate: '2023-01-01',
    endDate: '2023-12-31',
    initialCapital: 100000
  });
  
  const result = await engine.run(strategy);
  results.push({ short, long, ...result });
}
```

### 3. 滚动窗口优化

使用滚动窗口动态调整参数。

```typescript
class RollingOptimization {
  private lookbackPeriod = 252; // 一年交易日
  private optimizationWindow = 126; // 半年优化窗口
  private reoptimizeInterval = 21; // 每月重新优化

  async optimizeRolling(data: MarketData[]) {
    const results: any[] = [];
    
    for (let i = this.lookbackPeriod; i < data.length; i += this.reoptimizeInterval) {
      // 使用过去 optimizationWindow 天的数据优化参数
      const trainData = data.slice(i - this.optimizationWindow, i);
      const optimalParams = await this.findOptimalParams(trainData);
      
      // 在接下来的 reoptimizeInterval 天测试参数
      const testData = data.slice(i, i + this.reoptimizeInterval);
      const performance = await this.testParams(optimalParams, testData);
      
      results.push({
        period: { start: i, end: i + this.reoptimizeInterval },
        params: optimalParams,
        performance
      });
    }
    
    return results;
  }

  private async findOptimalParams(data: MarketData[]): Promise<any> {
    // 网格搜索找最优参数
    // ...
    return { shortPeriod: 10, longPeriod: 50 };
  }

  private async testParams(params: any, data: MarketData[]): Promise<any> {
    // 用指定参数测试表现
    // ...
    return { return: 0.1, sharpe: 1.2 };
  }
}
```

### 4. 遗传算法

对于复杂的参数空间，可以使用遗传算法优化。

```typescript
// 简化的遗传算法示例
class GeneticOptimizer {
  private populationSize = 20;
  private generations = 50;
  private mutationRate = 0.1;

  async optimize(strategyClass: any, data: MarketData[]) {
    // 初始化种群
    let population = this.initializePopulation();
    
    for (let gen = 0; gen < this.generations; gen++) {
      // 评估适应度
      const fitness = await Promise.all(
        population.map(individual => this.evaluateFitness(individual, strategyClass, data))
      );
      
      // 选择、交叉、变异
      population = this.evolve(population, fitness);
      
      // 输出当前最优
      const bestIndex = fitness.indexOf(Math.max(...fitness));
      console.log(`Generation ${gen}: Best fitness = ${fitness[bestIndex]}`);
    }
    
    return population[0]; // 返回最优个体
  }

  private initializePopulation(): any[] {
    return Array.from({ length: this.populationSize }, () => ({
      shortPeriod: Math.floor(Math.random() * 45) + 5,
      longPeriod: Math.floor(Math.random() * 195) + 50
    }));
  }

  private async evaluateFitness(individual: any, strategyClass: any, data: MarketData[]): Promise<number> {
    const strategy = new strategyClass(individual);
    // 运行回测，返回夏普比率作为适应度
    // ...
    return Math.random(); // 简化示例
  }

  private evolve(population: any[], fitness: number[]): any[] {
    // 锦标赛选择
    const selected = this.tournamentSelection(population, fitness);
    
    // 交叉和变异
    const newPopulation: any[] = [];
    for (let i = 0; i < this.populationSize; i += 2) {
      const [child1, child2] = this.crossover(selected[i], selected[i + 1]);
      newPopulation.push(this.mutate(child1), this.mutate(child2));
    }
    
    return newPopulation;
  }

  private tournamentSelection(population: any[], fitness: number[]): any[] {
    // 实现锦标赛选择
    return population;
  }

  private crossover(parent1: any, parent2: any): [any, any] {
    // 单点交叉
    return [
      { shortPeriod: parent1.shortPeriod, longPeriod: parent2.longPeriod },
      { shortPeriod: parent2.shortPeriod, longPeriod: parent1.longPeriod }
    ];
  }

  private mutate(individual: any): any {
    if (Math.random() < this.mutationRate) {
      individual.shortPeriod += Math.floor(Math.random() * 10) - 5;
    }
    if (Math.random() < this.mutationRate) {
      individual.longPeriod += Math.floor(Math.random() * 20) - 10;
    }
    return individual;
  }
}
```

## 回测验证

### 样本内 vs 样本外验证

```typescript
import { SMAStrategy, BacktestEngine } from 'alphaarena';

// 准备数据
const fullData = await loadData('BTC/USDT', '2022-01-01', '2024-12-31');

// 分割数据
const inSampleData = fullData.slice(0, Math.floor(fullData.length * 0.7)); // 70% 样本内
const outOfSampleData = fullData.slice(Math.floor(fullData.length * 0.7)); // 30% 样本外

// 在样本内优化参数
const bestParams = await optimizeParameters(inSampleData);

// 在样本外验证
const strategy = new SMAStrategy(bestParams);
const outOfSampleResult = await runBacktest(strategy, outOfSampleData);

console.log('样本外表现:');
console.log(`收益率: ${(outOfSampleResult.totalReturn * 100).toFixed(2)}%`);
console.log(`夏普比率: ${outOfSampleResult.sharpeRatio.toFixed(2)}`);
console.log(`最大回撤: ${(outOfSampleResult.maxDrawdown * 100).toFixed(2)}%`);

// 比较样本内外表现差距
const inSampleResult = await runBacktest(strategy, inSampleData);
const degradation = (inSampleResult.sharpeRatio - outOfSampleResult.sharpeRatio) / inSampleResult.sharpeRatio;
console.log(`样本外表现衰减: ${(degradation * 100).toFixed(1)}%`);

// 衰减过大说明可能过拟合
if (degradation > 0.5) {
  console.warn('警告: 样本外表现衰减超过 50%，可能存在过拟合');
}
```

### Walk-Forward 分析

```typescript
class WalkForwardAnalysis {
  private trainRatio = 0.7; // 70% 训练，30% 测试
  
  async analyze(
    data: MarketData[],
    strategyClass: any,
    windowSize: number = 252
  ) {
    const results: any[] = [];
    
    for (let i = windowSize; i < data.length; i += Math.floor(windowSize * (1 - this.trainRatio))) {
      const trainEnd = i;
      const testEnd = Math.min(i + Math.floor(windowSize * (1 - this.trainRatio)), data.length);
      
      // 训练阶段
      const trainData = data.slice(i - windowSize, trainEnd);
      const optimalParams = await this.optimize(trainData, strategyClass);
      
      // 测试阶段
      const testData = data.slice(trainEnd, testEnd);
      const strategy = new strategyClass(optimalParams);
      const result = await this.backtest(strategy, testData);
      
      results.push({
        period: `${trainEnd} - ${testEnd}`,
        params: optimalParams,
        result
      });
    }
    
    return this.aggregateResults(results);
  }

  private aggregateResults(results: any[]): any {
    const totalReturn = results.reduce((sum, r) => sum + r.result.totalReturn, 0);
    const avgSharpe = results.reduce((sum, r) => sum + r.result.sharpeRatio, 0) / results.length;
    const winRate = results.filter(r => r.result.totalReturn > 0).length / results.length;
    
    return {
      totalReturn,
      avgSharpe,
      winRate,
      details: results
    };
  }
}
```

### Monte Carlo 模拟

```typescript
class MonteCarloSimulation {
  async simulate(
    trades: Trade[],
    simulations: number = 1000
  ) {
    const equityCurves: number[][] = [];
    
    for (let sim = 0; sim < simulations; sim++) {
      // 随机打乱交易顺序
      const shuffled = [...trades].sort(() => Math.random() - 0.5);
      
      // 计算权益曲线
      const equity = [100000]; // 初始资金
      for (const trade of shuffled) {
        equity.push(equity[equity.length - 1] * (1 + trade.return));
      }
      
      equityCurves.push(equity);
    }
    
    // 计算置信区间
    const finalEquities = equityCurves.map(e => e[e.length - 1]);
    finalEquities.sort((a, b) => a - b);
    
    const p5 = finalEquities[Math.floor(simulations * 0.05)];
    const p50 = finalEquities[Math.floor(simulations * 0.5)];
    const p95 = finalEquities[Math.floor(simulations * 0.95)];
    
    console.log(`蒙特卡洛模拟结果 (${simulations} 次):`);
    console.log(`5% 分位数: $${p5.toFixed(2)}`);
    console.log(`中位数: $${p50.toFixed(2)}`);
    console.log(`95% 分位数: $${p95.toFixed(2)}`);
    
    return { p5, p50, p95, equityCurves };
  }
}
```

## 避免过拟合

### 过拟合的症状

1. **样本内外表现差距大**：样本外表现显著差于样本内
2. **参数过于精细**：如 SMA(17, 53) 而非 SMA(20, 50)
3. **交易规则过多**：复杂的入场条件组合
4. **完美拟合特定历史事件**：专门为某次大跌添加规则

### 防止过拟合的方法

#### 1. 参数稳定性检查

```typescript
// 检查参数是否在邻域内都表现良好
async function checkParameterStability(
  params: { short: number; long: number },
  data: MarketData[]
): Promise<boolean> {
  const delta = 2; // 邻域范围
  const nearbyParams = [];
  
  for (let ds = -delta; ds <= delta; ds++) {
    for (let dl = -delta; dl <= delta; dl++) {
      if (ds === 0 && dl === 0) continue;
      nearbyParams.push({
        short: params.short + ds,
        long: params.long + dl
      });
    }
  }
  
  // 测试中心参数
  const centerResult = await backtest(params, data);
  
  // 测试邻域参数
  const nearbyResults = await Promise.all(
    nearbyParams.map(p => backtest(p, data))
  );
  
  // 计算邻域平均表现
  const avgNearbyReturn = nearbyResults.reduce((sum, r) => sum + r.totalReturn, 0) / nearbyResults.length;
  
  // 如果中心参数表现远超邻域平均，可能过拟合
  const stabilityRatio = avgNearbyReturn / centerResult.totalReturn;
  
  console.log(`参数稳定性比率: ${stabilityRatio.toFixed(2)}`);
  return stabilityRatio > 0.8; // 邻域表现至少达到中心参数的 80%
}
```

#### 2. 简化参数

```typescript
// 偏好整数、常用的参数值
function simplifyParams(params: any): any {
  // 将 17.3 四舍五入到 15 或 20
  params.shortPeriod = Math.round(params.shortPeriod / 5) * 5;
  params.longPeriod = Math.round(params.longPeriod / 10) * 10;
  
  // 确保短期小于长期
  if (params.shortPeriod >= params.longPeriod) {
    params.shortPeriod = params.longPeriod / 4;
  }
  
  return params;
}
```

#### 3. 参数数量限制

```typescript
// 限制可优化的参数数量
class StrategyOptimizer {
  private maxParams = 3; // 最多优化 3 个参数

  optimize(strategyClass: any) {
    const allParams = this.getAllParameters(strategyClass);
    
    // 选择最重要的参数进行优化
    const selectedParams = this.selectMostImportantParams(allParams, this.maxParams);
    
    // 其他参数使用默认值
    // ...
  }
}
```

#### 4. 样本量检查

```typescript
// 确保有足够的样本量
function validateSampleSize(trades: number, params: number): boolean {
  // 经验法则：每个参数至少需要 30 笔交易
  const minTrades = params * 30;
  
  if (trades < minTrades) {
    console.warn(`样本量不足: ${trades} 笔交易 < ${minTrades} 最小要求`);
    return false;
  }
  
  return true;
}
```

## 不同市场条件下的策略表现

### 市场环境分类

```typescript
enum MarketCondition {
  TRENDING_UP = 'trending_up',      // 上涨趋势
  TRENDING_DOWN = 'trending_down',  // 下跌趋势
  RANGING = 'ranging',              // 震荡区间
  HIGH_VOLATILITY = 'high_volatility', // 高波动
  LOW_VOLATILITY = 'low_volatility'    // 低波动
}

function classifyMarket(data: MarketData[], lookback: number = 50): MarketCondition {
  const prices = data.slice(-lookback).map(d => d.close);
  
  // 计算趋势强度（线性回归斜率）
  const trend = calculateLinearRegressionSlope(prices);
  
  // 计算波动率（ATR 百分比）
  const atr = calculateATR(data, 14);
  const atrPercent = atr / prices[prices.length - 1];
  
  // 判断市场状态
  if (Math.abs(trend) > 0.01) {
    return trend > 0 ? MarketCondition.TRENDING_UP : MarketCondition.TRENDING_DOWN;
  }
  
  if (atrPercent > 0.03) {
    return MarketCondition.HIGH_VOLATILITY;
  }
  
  if (atrPercent < 0.01) {
    return MarketCondition.LOW_VOLATILITY;
  }
  
  return MarketCondition.RANGING;
}
```

### 策略与市场匹配

| 策略类型 | 最佳市场环境 | 较差市场环境 |
|----------|--------------|--------------|
| SMA 交叉 | 趋势市场 | 震荡市场 |
| RSI | 震荡市场 | 强趋势市场 |
| MACD | 趋势市场 | 震荡市场 |
| Bollinger Bands | 震荡市场 | 强趋势市场 |
| Stochastic | 震荡市场 | 强趋势市场 |
| ATR | 所有（波动率管理） | 无 |

### 自适应策略选择

```typescript
class AdaptiveStrategySelector {
  private strategies = {
    sma: new SMAStrategy({ shortPeriod: 10, longPeriod: 50 }),
    rsi: new RSIStrategy({ period: 14, overbought: 70, oversold: 30 }),
    bb: new BollingerBandsStrategy({ period: 20, stdDev: 2 }),
    stochastic: new StochasticStrategy({ kPeriod: 14, dPeriod: 3 })
  };

  selectBestStrategy(marketCondition: MarketCondition): Strategy {
    switch (marketCondition) {
      case MarketCondition.TRENDING_UP:
      case MarketCondition.TRENDING_DOWN:
        return this.strategies.sma; // 趋势市场用 SMA
      
      case MarketCondition.RANGING:
        return this.strategies.rsi; // 震荡市场用 RSI
      
      case MarketCondition.HIGH_VOLATILITY:
        return this.strategies.bb; // 高波动用布林带
      
      default:
        return this.strategies.rsi;
    }
  }

  generateSignal(data: MarketData[]): Signal | null {
    const condition = classifyMarket(data);
    const strategy = this.selectBestStrategy(condition);
    
    data.forEach(d => strategy.onData(d));
    return strategy.generateSignal();
  }
}
```

## 实战建议

### 1. 从简单开始

```typescript
// ❌ 过于复杂的初始设计
const complexStrategy = {
  indicators: ['RSI', 'MACD', 'Stochastic', 'Bollinger', 'ADX'],
  entryRules: 5,
  exitRules: 8,
  parameters: 15
};

// ✅ 简单的初始设计
const simpleStrategy = {
  indicators: ['SMA'],
  entryRules: 1, // 金叉买入
  exitRules: 1,  // 死叉卖出
  parameters: 2  // 短周期、长周期
};
```

### 2. 设置合理的期望

```typescript
// 合理的收益预期
const realisticExpectations = {
  annualReturn: '15-25%', // 年化收益
  maxDrawdown: '<20%',    // 最大回撤
  sharpeRatio: '1.0-2.0', // 夏普比率
  winRate: '40-60%',      // 胜率
  profitFactor: '>1.5'    // 盈亏比
};

// 不合理的期望（警惕）
const unrealisticExpectations = {
  annualReturn: '>50%',   // 过高收益
  maxDrawdown: '<5%',     // 过低回撤
  sharpeRatio: '>3',      // 过高夏普
  winRate: '>80%'         // 过高胜率
};
```

### 3. 持续监控和调整

```typescript
class StrategyMonitor {
  private performanceHistory: Performance[] = [];
  private alertThresholds = {
    maxDrawdownIncrease: 0.1, // 回撤增加超过 10%
    returnDrop: 0.2,          // 收益下降超过 20%
    consecutiveLosses: 5      // 连续亏损次数
  };

  checkPerformance(current: Performance): Alert[] {
    const alerts: Alert[] = [];
    
    // 检查回撤
    if (current.maxDrawdown > this.performanceHistory[0]?.maxDrawdown * (1 + this.alertThresholds.maxDrawdownIncrease)) {
      alerts.push({
        level: 'warning',
        message: `最大回撤增加超过 ${(this.alertThresholds.maxDrawdownIncrease * 100).toFixed(0)}%`
      });
    }
    
    // 检查收益
    if (current.totalReturn < this.performanceHistory[0]?.totalReturn * (1 - this.alertThresholds.returnDrop)) {
      alerts.push({
        level: 'warning',
        message: `收益下降超过 ${(this.alertThresholds.returnDrop * 100).toFixed(0)}%`
      });
    }
    
    this.performanceHistory.unshift(current);
    return alerts;
  }
}
```

### 4. 文档化优化过程

```typescript
// 记录每次优化的详细信息
interface OptimizationRecord {
  date: Date;
  strategy: string;
  dataSource: { symbol: string; start: string; end: string };
  method: 'grid' | 'random' | 'genetic';
  previousParams: any;
  newParams: any;
  inSamplePerformance: any;
  outOfSamplePerformance: any;
  notes: string;
}

// 保存优化记录
function saveOptimization(record: OptimizationRecord) {
  const log = JSON.parse(fs.readFileSync('optimization-log.json', 'utf-8'));
  log.push(record);
  fs.writeFileSync('optimization-log.json', JSON.stringify(log, null, 2));
}
```

### 5. 回测陷阱提醒

```typescript
const backtestingPitfalls = [
  '前视偏差：使用了未来数据',
  '生存偏差：只选择存活至今的资产',
  '交易成本：未考虑滑点和手续费',
  '流动性：假设可以任意价格成交',
  '市场影响：大额交易影响市场价格',
  '幸存者偏差：只回测表现好的时期'
];

// 处理交易成本
function adjustForCosts(returns: number[], slippage: number = 0.001, fee: number = 0.001): number[] {
  return returns.map(r => r - slippage - fee);
}
```

## 相关资源

- [策略开发指南](./strategy-development.md) - 如何开发自定义策略
- [回测使用说明](./backtesting.md) - 回测引擎详细说明
- [SMA 策略](../strategies/SMA.md) - 趋势跟踪策略
- [RSI 策略](../strategies/RSI.md) - 震荡市场策略
- [ATR 策略](../strategies/ATR.md) - 波动率管理