# sprint-6-retrospective

_Saved: 2026-03-16_

# Sprint 6 回顾报告

**Sprint 周期：** 2026-04-09 → 2026-04-16  
**Milestone：** #7  
**状态：** 已完成 ✅

---

## 完成的工作

### Bug 修复（3 个 P0/P1 问题）

| Issue | PR | 描述 | 状态 |
|-------|-----|------|------|
| #159 | #160 | KLineChart DOM 操作错误修复 | ✅ 已合并 |
| #161 | #162 | K线图表竞态条件修复 | ✅ 已合并 |
| #163 | #164 | 交易对切换数据不匹配修复 | ✅ 已合并 |

### 详细修复内容

#### 1. Issue #159 → PR #160: KLineChart removeChild DOM 错误

**问题：** KLineChart 组件与 Arco Design Spin 组件存在 DOM 操作冲突，导致 `removeChild` 错误。

**根因：**
- React StrictMode 导致 useEffect 执行两次
- lightweight-charts 的 `chart.remove()` 在清理时会删除 DOM 节点
- Arco Design Spin 组件在 loading 状态变化时改变 DOM 结构

**解决方案：**
- 延迟初始化：等待 `loading=false` 后再初始化图表
- 安全清理：添加 `safeRemoveChart()` 函数捕获 DOM 错误
- 使用 useLayoutEffect 替代 useEffect
- 挂载状态追踪：使用 `isMountedRef` 防止卸载后继续操作 DOM
- requestAnimationFrame 延迟确保 DOM 稳定

#### 2. Issue #161 → PR #162: K线图表渲染失败

**问题：** 图表区域显示为黑色矩形框，无蜡烛图数据。

**根因：**
- PR #160 使用 requestAnimationFrame 延迟图表初始化
- 但数据更新的 useEffect 没有延迟
- 导致数据更新在图表初始化前执行，数据被跳过

**解决方案：**
- 添加 `chartReady` state 追踪图表初始化状态
- 在图表初始化成功后设置 `chartReady=true`
- 数据更新的 useEffect 等待 `chartReady=true` 后再设置数据
- cleanupChart 时重置 `chartReady=false`

#### 3. Issue #163 → PR #164: 交易对切换数据不匹配

**问题：** 切换交易对后，K线图表显示错误的价格数据（显示 BTC 数据但界面显示 AAPL）。

**根因：**
- API 响应竞态条件：symbol 变化时，旧 API 响应可能仍然到达
- useKLineData hook 没有追踪请求 ID 来忽略过期响应
- 图表没有验证传入数据是否匹配预期的 symbol

**解决方案：**
- useKLineData hook 改进：
  - 添加 `requestIdRef` 追踪当前请求，忽略过期响应
  - 添加 `currentSymbolRef` 验证数据匹配预期 symbol
  - 返回 `currentSymbol` 供 KLineChart 验证
- KLineChart 组件改进：
  - symbol 变化时立即清除图表数据
  - 更新前验证 `currentSymbol === symbol`
  - 添加价格范围日志便于调试

### 验证结果

- ✅ 冒烟测试全部通过
- ✅ 生产环境运行正常
- ✅ K线图表正常渲染
- ✅ 交易对切换数据正确
- ✅ 浏览器控制台无错误

---

## 遇到的挑战

### 1. 连锁 Bug 修复

第一个修复（PR #160）解决了 DOM 操作错误，但引入了新的竞态条件问题。这提醒我们：
- 修复一个问题时，需要考虑对其他组件的影响
- useEffect/useLayoutEffect 的执行时机非常关键
- 需要更全面的状态追踪机制

### 2. 异步数据竞态条件

交易对切换时的数据不匹配问题揭示了前端处理异步数据的复杂性：
- 多个 API 请求可能乱序返回
- 需要有效的请求 ID 追踪机制
- 数据验证必须在 UI 层也进行

### 3. React StrictMode 双重渲染

StrictMode 在开发环境下会双重调用 useEffect，这在生产环境不会发生，但会导致开发时的 DOM 操作错误。需要在组件设计时就考虑这种场景。

---

## 学到的经验

### 技术经验

1. **图表库生命周期管理**
   - lightweight-charts 的 `chart.remove()` 会删除 DOM 节点
   - 需要在 React 组件卸载前手动清理
   - 使用 ref 追踪挂载状态是必要的

2. **useLayoutEffect vs useEffect**
   - useLayoutEffect 在浏览器绘制前执行，适合 DOM 操作
   - useEffect 在绘制后执行，可能导致闪烁
   - 对于图表初始化，useLayoutEffect 更稳定

3. **请求竞态处理模式**
   - 使用递增请求 ID 追踪当前请求
   - 响应到达时验证请求 ID 是否匹配
   - 不匹配则忽略过期响应

4. **状态同步机制**
   - 添加 `ready` 标志追踪异步操作完成状态
   - 数据更新前检查 `ready` 状态
   - 清理时重置所有状态

### 流程经验

1. **修复验证要全面**
   - 一个修复可能引入新问题
   - 需要验证相关功能是否仍然正常
   - 冒烟测试覆盖关键路径

2. **日志调试很重要**
   - 添加详细日志帮助定位问题
   - 生产环境可保留关键日志
   - 调试完成后可移除冗余日志

---

## 改进建议

### 短期（Sprint 7）

1. **添加 K线图表单元测试**
   - 测试图表初始化、数据更新、symbol 切换
   - 模拟异步请求场景
   - 验证竞态条件处理

2. **优化日志系统**
   - 使用统一的日志前缀 `[KLineChart]`
   - 添加日志级别控制（开发/生产）
   - 关键路径保留必要日志

### 中期

1. **异步数据管理最佳实践**
   - 建立请求 ID 追踪的标准模式
   - 考虑使用 React Query 等库简化数据管理
   - 文档化竞态条件处理方案

2. **组件生命周期检查清单**
   - useEffect 清理函数是否完整
   - ref 状态是否正确追踪
   - 异步操作是否可取消

### 长期

1. **E2E 测试覆盖**
   - 自动化测试交易对切换场景
   - 验证图表数据正确性
   - 回归测试关键用户路径

2. **性能监控**
   - 监控图表渲染性能
   - 追踪 API 响应时间和顺序
   - 建立异常告警机制

---

## 总结

Sprint 6 是一个专注于 Bug 修复的 Sprint。虽然原计划可能有其他功能，但 K线图表的问题阻塞了整个应用的核心功能。团队快速响应，系统性分析了三个相关问题，逐个击破，最终恢复了图表的正常功能。

这次 Sprint 展示了良好的问题解决能力：
- 从现象到根因的深入分析
- 系统性的修复方案设计
- 完整的验证和测试

同时也暴露了一些改进空间：
- 需要更完善的测试覆盖
- 异步数据管理需要更系统的方法
- 组件生命周期处理需要更谨慎

---

**下一步：** Sprint 7 应该关注功能开发，同时将本次学到的经验应用到代码质量的提升中。