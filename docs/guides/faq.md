# AlphaArena 常见问题解答 (FAQ)

> 📚 **新用户？** 查看我们的 [用户指南](../user-guide/README.md) 获取完整功能说明。

## 目录

- [安装与配置](#安装与配置)
- [策略开发](#策略开发)
- [回测相关](#回测相关)
- [API 使用](#api-使用)
- [实时交易](#实时交易)
- [性能优化](#性能优化)
- [故障排除](#故障排除)

---

## 安装与配置

### Q: 支持哪些 Node.js 版本？

**A:** AlphaArena 要求 Node.js >= 18.0.0。推荐使用 LTS 版本（目前是 20.x）。

检查您的 Node.js 版本：

```bash
node --version
```

如果版本过低，建议使用 nvm 安装：

```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 安装 Node.js 20
nvm install 20
nvm use 20
```

### Q: 安装依赖时报错怎么办？

**A:** 常见原因和解决方法：

1. **网络问题**：使用国内镜像

```bash
npm config set registry https://registry.npmmirror.com
npm install
```

2. **权限问题**：不要使用 sudo

```bash
# 修复 npm 权限
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

3. **缓存问题**：清理缓存

```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Q: 如何配置 Supabase？

**A:** 

1. 在 [Supabase](https://supabase.com) 创建项目
2. 获取项目 URL 和 anon key
3. 创建 `.env` 文件：

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

4. 运行数据库迁移：

```bash
npx supabase db push
```

### Q: 构建失败怎么办？

**A:** 检查 TypeScript 错误：

```bash
npx tsc --noEmit
```

常见错误：

1. **类型错误**：检查类型定义是否正确
2. **模块找不到**：确保所有依赖已安装
3. **版本不兼容**：检查 package.json 中的版本要求

---

## 策略开发

### Q: 如何创建自定义策略？

**A:** 参见 [策略开发指南](./strategy-development.md)。基本步骤：

1. 在 `src/strategy/` 创建策略文件
2. 实现 `Strategy` 接口
3. 在 `index.ts` 中导出
4. 在 `StrategyManager` 中注册

### Q: 策略参数如何传递？

**A:** 通过构造函数传入：

```typescript
const strategy = new SMAStrategy({
  shortPeriod: 5,
  longPeriod: 20,
  tradeQuantity: 1,
});
```

或在 CLI 中：

```bash
npx alpha-arena run --strategy sma \
  --params '{"shortPeriod": 5, "longPeriod": 20}'
```

### Q: 如何访问历史数据？

**A:** 在策略中使用 `history` 属性：

```typescript
onData(data: MarketData): void {
  // 获取最近 20 个收盘价
  const recentCloses = this.context.history.getClose(20);
  
  // 获取特定时间范围的数据
  const hourlyData = this.context.history.getByTimeRange(
    Date.now() - 3600000,
    Date.now()
  );
}
```

### Q: 如何实现止损/止盈？

**A:** 使用条件单功能：

```typescript
// 通过 API
await fetch('/api/conditional-orders', {
  method: 'POST',
  body: JSON.stringify({
    symbol: 'BTC/USD',
    side: 'sell',
    orderType: 'stop_loss',
    triggerPrice: 45000,
    quantity: 0.1,
  }),
});
```

或在策略中：

```typescript
async execute(signal: Signal, context: ExecutionContext): Promise<Order | null> {
  const order = await this.createOrder(signal, context);
  
  // 设置止损（价格下跌 5% 触发）
  await context.createConditionalOrder({
    orderType: 'stop_loss',
    triggerPrice: order.price * 0.95,
    quantity: order.quantity,
  });
  
  return order;
}
```

### Q: 如何调试策略？

**A:** 

1. **使用日志**：

```typescript
onData(data: MarketData): void {
  this.context.logger.debug('Received data:', data);
}
```

2. **单元测试**：

```typescript
describe('MyStrategy', () => {
  it('should generate correct signal', () => {
    strategy.onData(mockData);
    const signal = strategy.generateSignal();
    expect(signal.type).toBe('buy');
  });
});
```

3. **回测调试**：使用简短的时间范围和详细的日志输出。

---

## 回测相关

### Q: 回测结果与实盘差异很大怎么办？

**A:** 可能的原因：

1. **前视偏差**：检查是否使用了未来数据
2. **过度拟合**：使用 Walk-Forward 分析验证
3. **交易成本**：添加手续费和滑点

```typescript
const config: BacktestConfig = {
  ...config,
  feeRate: 0.001,      // 手续费
  slippage: 0.0005,    // 滑点
};
```

### Q: 如何获取历史数据？

**A:** 

1. **从交易所 API 获取**：

```typescript
import { DataFetcher } from './backtest/DataFetcher';

const fetcher = new DataFetcher();
const data = await fetcher.fetchFromExchange({
  exchange: 'binance',
  symbol: 'BTC/USDT',
  interval: '1h',
  start: '2024-01-01',
  end: '2024-12-31',
});
```

2. **从 CSV 文件导入**：

```typescript
const data = await loadFromCSV('data/btc_usdt_1h.csv');
```

### Q: 回测速度太慢怎么办？

**A:** 

1. **使用优化的回测引擎**：

```typescript
import { OptimizedBacktestEngine } from './backtest/OptimizedBacktestEngine';
```

2. **减少数据精度**：使用更大的时间间隔

3. **并行处理**：

```typescript
const results = await Promise.all(
  strategies.map(s => runBacktest(s))
);
```

### Q: 如何优化策略参数？

**A:** 使用参数优化器：

```typescript
import { ParameterOptimizer } from './backtest/ParameterOptimizer';

const optimizer = new ParameterOptimizer({
  strategy: 'sma',
  paramRanges: {
    shortPeriod: [5, 10, 15, 20],
    longPeriod: [20, 30, 40, 50],
  },
  optimizationTarget: 'sharpeRatio',
});

const result = await optimizer.run();
console.log('最佳参数:', result.bestParams);
```

---

## API 使用

### Q: API 返回 401 Unauthorized 怎么办？

**A:** 如果服务器启用了认证，需要在请求头添加 token：

```bash
curl -H "Authorization: Bearer your-token" http://localhost:3001/api/strategies
```

### Q: 实时数据不更新怎么办？

**A:** 

1. 检查 Supabase 配置是否正确
2. 检查 WebSocket 连接状态：

```typescript
const client = new SupabaseRealtimeService(url, key);
await client.subscribe('trades', (payload) => {
  console.log('Received:', payload);
});
```

3. 检查网络防火墙是否阻止了 WebSocket 连接

### Q: 如何分页获取交易记录？

**A:** 使用 `limit` 和 `offset` 参数：

```bash
# 获取第 2 页，每页 50 条
curl "http://localhost:3001/api/trades?limit=50&offset=50"
```

### Q: 如何导出交易记录？

**A:** 使用导出端点：

```bash
curl "http://localhost:3001/api/trades/export?startDate=2024-01-01&endDate=2024-12-31" \
  -o trades.csv
```

---

## 实时交易

### Q: 如何启动实时策略？

**A:** 

```bash
# CLI 方式
npx alpha-arena run --strategy sma --symbol BTC/USDT

# 代码方式
import { RealtimeRunner } from './cli/realtime-runner';

const runner = new RealtimeRunner({
  strategy: 'sma',
  symbol: 'BTC/USDT',
  capital: 10000,
});

await runner.start();
```

### Q: 如何监控策略运行状态？

**A:** 

1. **通过 API**：

```bash
curl http://localhost:3001/health/status
```

2. **通过日志**：

```bash
tail -f logs/strategy.log
```

3. **通过 Web 界面**：访问前端界面查看实时状态

### Q: 如何停止正在运行的策略？

**A:** 

```bash
# 发送停止信号
kill -SIGTERM <pid>

# 或通过 CLI
npx alpha-arena stop --strategy-id <id>
```

### Q: 实时交易如何设置风控？

**A:** 

1. **设置止损止盈**：

```typescript
await context.createConditionalOrder({
  orderType: 'stop_loss',
  triggerPrice: entryPrice * 0.95,
  quantity: position.quantity,
});

await context.createConditionalOrder({
  orderType: 'take_profit',
  triggerPrice: entryPrice * 1.10,
  quantity: position.quantity,
});
```

2. **限制仓位大小**：

```typescript
if (position.quantity > maxPositionSize) {
  logger.warn('Position size limit reached');
  return null;
}
```

3. **限制交易频率**：

```typescript
if (Date.now() - lastTradeTime < minTradeInterval) {
  return null;  // 跳过交易
}
```

---

## 性能优化

### Q: 内存占用过高怎么办？

**A:** 

1. **限制数据缓冲区大小**：

```typescript
if (this.dataBuffer.length > MAX_BUFFER_SIZE) {
  this.dataBuffer.shift();
}
```

2. **使用流式处理**：

```typescript
import { StreamingBacktestEngine } from './backtest/StreamingBacktestEngine';
```

3. **定期清理缓存**：

```typescript
onTick(): void {
  if (this.cache.size > MAX_CACHE_SIZE) {
    this.cache.clear();
  }
}
```

### Q: 如何提高回测速度？

**A:** 

1. **使用增量计算**：

```typescript
// ❌ 每次全量计算
private calculateMA(prices: number[]): number {
  return prices.reduce((a, b) => a + b, 0) / prices.length;
}

// ✅ 增量更新
private updateMA(newPrice: number, oldPrice: number): number {
  this.currentMA = this.currentMA + (newPrice - oldPrice) / this.period;
  return this.currentMA;
}
```

2. **使用优化的数据结构**

3. **减少不必要的日志输出**

### Q: 如何处理大量并发请求？

**A:** 

1. **使用连接池**

2. **实现请求队列**

3. **使用缓存**：

```typescript
const cachedData = cache.get('key');
if (cachedData) {
  return cachedData;
}
// 计算并缓存
cache.set('key', data, TTL);
```

---

## 故障排除

### Q: 服务无法启动，端口被占用怎么办？

**A:** 

```bash
# 查找占用端口的进程
lsof -i :3001

# 结束进程
kill -9 <pid>

# 或使用不同端口
PORT=3002 npm start
```

### Q: 数据库连接失败怎么办？

**A:** 

1. 检查 `.env` 文件中的数据库配置
2. 检查网络连接
3. 检查 Supabase 项目状态

```bash
# 测试连接
npx supabase db ping
```

### Q: 前端页面空白怎么办？

**A:** 

1. 检查浏览器控制台错误
2. 检查 API 是否正常运行
3. 清除浏览器缓存

### Q: 订单无法提交怎么办？

**A:** 

1. 检查请求参数是否正确
2. 检查账户余额是否充足
3. 查看服务器日志

```bash
# 检查日志
tail -f logs/api.log
```

### Q: 如何查看详细错误信息？

**A:** 

1. **设置日志级别**：

```typescript
import { setLogLevel } from './utils/logger';
setLogLevel('debug');
```

2. **查看错误日志**：

```bash
curl http://localhost:3001/metrics/errors
```

---

## 其他问题

### Q: 如何贡献代码？

**A:** 参见 [CONTRIBUTING.md](../../CONTRIBUTING.md)

### Q: 如何报告 Bug？

**A:** 在 [GitHub Issues](https://github.com/gxcsoccer/AlphaArena/issues) 提交 Bug 报告，包含：

1. 问题描述
2. 复现步骤
3. 期望行为
4. 实际行为
5. 环境信息

### Q: 如何获取帮助？

**A:** 

- 查阅文档
- 搜索 [Issues](https://github.com/gxcsoccer/AlphaArena/issues)
- 提交新 Issue

---

## 相关资源

- [快速开始指南](./quick-start.md)
- [策略开发指南](./strategy-development.md)
- [回测使用说明](./backtesting.md)
- [API 文档](../api/openapi.yaml)