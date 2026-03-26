# VIP Advanced Features Implementation

## Issue #640: VIP 高级功能 - 高级图表、策略回测增强

### 实现概述

本次实现为 VIP 用户（Pro 和 Enterprise 订阅计划）提供了一系列高级功能，包括高级图表分析、策略回测增强和历史数据权限控制。

---

## 功能对比表

| 功能 | Free | Pro | Enterprise |
|------|------|-----|------------|
| **高级图表** | | | |
| 技术指标叠加 (MACD, RSI, Bollinger, SMA, EMA) | ✗ | ✓ | ✓ |
| 多时间框架图表 | ✗ | ✓ | ✓ |
| 图表模板保存 | ✗ | ✓ | ✓ |
| 图表截图导出 | ✗ | ✓ | ✓ |
| **策略回测** | | | |
| 基础回测 | ✓ | ✓ | ✓ |
| 参数优化 | ✗ | ✓ (最多100次迭代) | ✓ (无限) |
| 多策略对比 | ✗ | ✓ (最多5个策略) | ✓ (无限) |
| 回测报告导出 | ✗ | ✓ | ✓ |
| 回测历史记录保存 | ✗ | ✓ | ✓ |
| **历史数据** | | | |
| 数据范围 | 7天 | 30天 | 无限 |
| API 调用限制 | 100次/天 | 10000次/天 | 无限 |

---

## FeatureGate 使用示例

### 基础用法

```tsx
import FeatureGate from '../components/FeatureGate';

// 包裹 VIP 专属功能
<FeatureGate featureKey="advanced_charts" featureName="高级图表指标">
  <AdvancedChartIndicators symbol="BTC/USD" timeframe="1h" />
</FeatureGate>
```

### 自定义 Fallback

```tsx
<FeatureGate 
  featureKey="multi_timeframe" 
  featureName="多时间框架图表"
  fallback={<UpgradePrompt feature="multi_timeframe" />}
>
  <MultiTimeframeCharts symbol="BTC/USD" />
</FeatureGate>
```

### 编程式检查

```tsx
import { useFeatureGate } from '../components/FeatureGate';

function MyComponent() {
  const { hasAccess, remaining, showUpgradeModal } = useFeatureGate('advanced_backtest');
  
  if (!hasAccess) {
    return <Button onClick={showUpgradeModal}>升级解锁</Button>;
  }
  
  return (
    <div>
      <p>剩余使用次数: {remaining}</p>
      <AdvancedBacktest />
    </div>
  );
}
```

---

## 组件列表

### 1. AdvancedChartIndicators

高级图表指标组件，提供技术指标叠加功能。

**Props:**
- `symbol: string` - 交易对符号
- `timeframe: string` - 时间框架
- `onIndicatorsChange?: (indicators: IndicatorConfig[]) => void` - 指标变化回调
- `chartApi?: IChartApi | null` - lightweight-charts 实例

**功能:**
- 添加/移除技术指标（MACD, RSI, Bollinger, SMA, EMA）
- 自定义指标参数
- 保存指标模板到本地存储
- 图表截图导出

### 2. MultiTimeframeCharts

多时间框架图表组件，允许同时查看多个时间框架。

**Props:**
- `symbol: string` - 交易对符号
- `defaultTimeframes?: TimeFrame[]` - 默认显示的时间框架
- `maxTimeframes?: number` - 最大时间框架数量（默认 4）

**功能:**
- 同时显示多个时间框架图表
- 添加/移除时间框架
- 单个图表全屏查看

### 3. BacktestEnhancement

回测增强组件，提供参数优化和历史记录功能。

**Props:**
- `strategyId: string` - 策略 ID
- `symbol: string` - 交易对符号
- `onOptimizationComplete?: (result: OptimizationResult) => void` - 优化完成回调

**功能:**
- 参数自动优化（寻找最优参数组合）
- 回测历史记录保存
- 优化结果导出（CSV）

### 4. VIPFeaturesDashboard

VIP 功能仪表盘，显示所有 VIP 功能状态。

**功能:**
- 展示所有 VIP 功能列表
- 显示当前订阅计划的功能访问状态
- 功能对比表

---

## API 端点

### 新增 VIP 专属端点

#### POST /api/backtest/optimize
参数优化接口（Pro 及以上）

**请求体:**
```json
{
  "strategy": "sma",
  "symbol": "BTC/USDT",
  "parameters": [
    { "name": "period", "min": 5, "max": 50, "step": 5 }
  ],
  "config": {
    "capital": 10000,
    "startTime": 1640000000000,
    "endTime": 1672444800000
  }
}
```

**响应:**
```json
{
  "success": true,
  "total_iterations": 10,
  "best_result": {
    "params": { "period": 20 },
    "metrics": {
      "totalReturn": 45.2,
      "sharpeRatio": 1.8,
      "maxDrawdown": 12.5
    }
  },
  "top_results": [...]
}
```

#### POST /api/backtest/compare
多策略对比接口（Pro 及以上）

**请求体:**
```json
{
  "strategies": ["sma", "rsi", "macd"],
  "config": {
    "symbol": "BTC/USDT",
    "capital": 10000,
    "startTime": 1640000000000,
    "endTime": 1672444800000
  }
}
```

#### GET /api/backtest/data-limits
获取用户历史数据限制

**响应:**
```json
{
  "plan": "pro",
  "max_days": 30,
  "is_unlimited": false,
  "description": "最近 30 天历史数据"
}
```

---

## 历史数据权限控制

### 后端服务

`HistoricalDataPermissionService` 提供以下功能：

```typescript
// 检查数据访问权限
await checkHistoricalDataPermission(userId, startDate, endDate);

// 根据计划调整日期范围
adjustDateRangeToPlan(plan, requestedStartDate, endDate);

// 获取用户计划
await getUserPlan(userId);
```

### 前端 Hook

`useHistoricalDataPermission` 提供以下功能：

```typescript
const { 
  limit,           // 数据限制信息
  checkPermission, // 检查权限
  getAdjustedStartDate, // 获取调整后的开始日期
} = useHistoricalDataPermission();
```

---

## 测试覆盖

### 单元测试

- `AdvancedChartIndicators.test.tsx` - 高级图表组件测试
- `MultiTimeframeCharts.test.tsx` - 多时间框架组件测试
- `BacktestEnhancement.test.tsx` - 回测增强组件测试
- `FeatureGate.test.tsx` - FeatureGate 组件测试
- `useHistoricalDataPermission.test.ts` - 历史数据权限 Hook 测试

### 集成测试

- VIP 功能端到端测试
- API 端点权限测试
- 订阅升级流程测试

---

## 部署注意事项

1. **数据库迁移**: 确保订阅相关表已创建
2. **环境变量**: 配置 STRIPE_SECRET_KEY 用于订阅验证
3. **中间件**: 确保 subscription.middleware 已应用到需要权限控制的路由
4. **监控**: 添加 VIP 功能使用情况监控

---

## 后续优化建议

1. **参数优化算法**: 实现更高效的优化算法（遗传算法、网格搜索）
2. **报告导出**: 实现 PDF/Excel 报告生成
3. **实时推送**: 为 VIP 用户提供实时策略信号推送
4. **优先级支持**: 为 Enterprise 用户提供专属客服通道

---

## 相关文件

### 组件
- `/src/client/components/AdvancedChartIndicators.tsx`
- `/src/client/components/MultiTimeframeCharts.tsx`
- `/src/client/components/BacktestEnhancement.tsx`
- `/src/client/components/VIPBacktestFeatures.tsx`
- `/src/client/components/FeatureGate.tsx`

### Hooks
- `/src/client/hooks/useHistoricalDataPermission.ts`

### 服务
- `/src/services/HistoricalDataPermissionService.ts`

### API
- `/src/api/backtestRoutes.ts` (已更新)

### 测试
- `/src/client/components/__tests__/VIPFeatures.test.tsx`