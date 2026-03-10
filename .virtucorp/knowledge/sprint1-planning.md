# Sprint 1 Planning - MVP

**Date:** 2026-03-10
**Milestone:** Sprint 1 - MVP (#1)
**Due:** 2026-03-11

## Issues Created

| # | Title | Priority | Dependencies |
|---|-------|----------|--------------|
| 1 | Implement Order Book (模拟订单簿) | P0 | None |
| 2 | Implement Matching Engine (撮合引擎) | P0 | #1 |
| 3 | Implement Portfolio Tracking (组合跟踪) | P1 | #2 |
| 4 | Define Strategy Interface (策略接口) | P0 | #1, #3 |
| 5 | Implement Baseline Strategy: SMA Crossover | P1 | #4 |
| 6 | Implement CLI Runner (CLI 运行器) | P1 | #2, #3, #5 |

## Development Order

1. **#1 Order Book** - 基础数据结构，无依赖
2. **#2 Matching Engine** - 依赖订单簿
3. **#3 Portfolio Tracking** - 依赖撮合引擎生成成交记录
4. **#4 Strategy Interface** - 依赖订单簿和组合接口定义
5. **#5 SMA Strategy** - 依赖策略接口实现
6. **#6 CLI Runner** - 整合所有组件

## Labels Used
- type/feature: 所有功能开发
- agent/dev: 分配给开发 agent
- status/ready-for-dev: 准备开发
- priority/p0: 核心功能 (订单簿、撮合引擎、策略接口)
- priority/p1: 次要功能 (组合跟踪、SMA 策略、CLI)

## Notes
- 所有 Issues 已关联到 Sprint 1 Milestone
- 依赖关系在 Issue 描述中标注
- 验收标准已定义在每个 Issue 中
