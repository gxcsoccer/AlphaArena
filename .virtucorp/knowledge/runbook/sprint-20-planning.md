# sprint-20-planning

_Saved: 2026-03-17_

# Sprint 20 Planning

_Saved: 2026-03-17_

## Sprint Overview

**Sprint**: 20  
**Period**: 2026-03-25 → 2026-04-01  
**Milestone**: #21  
**Theme**: 用户体验增强 - 通知系统、策略比较、数据导出

---

## Sprint Goals

1. **用户通知系统** - 实现实时交易信号、风险警报和绩效报告通知
2. **策略性能比较工具** - 让用户能比较不同策略的表现
3. **数据导出和报表功能** - 支持导出交易历史和绩效报告为 CSV/PDF

---

## Planned Issues

| Issue | Description | Priority | Labels |
|-------|-------------|----------|--------|
| #286 | 用户通知系统 (Notification System) | P1 | type/feature |
| #287 | 策略性能比较工具 (Strategy Comparison Tool) | P1 | type/feature |
| #288 | 数据导出和报表功能 (Data Export & Reports) | P2 | type/feature |

---

## Sprint Capacity

3 issues planned for 7-day sprint:
- 2 P1 features (通知系统、策略比较)
- 1 P2 feature (数据导出)

---

## Dependencies

- Sprint 19 delivered: VWAP 策略、交易日志系统、订单流分析、绩效归因分析
- Sprint 20 builds on:
  - WebSocket 实时数据基础设施（用于通知推送）
  - 策略框架和回测引擎（用于策略比较）
  - 绩效计算模块（用于导出报表）

---

## Risks

1. 通知系统可能需要 WebSocket 连接优化
2. PDF 生成需要考虑中文字体支持
3. 策略比较可能有性能问题（多策略并行回测）

---

## Success Criteria

- 所有 3 个 issues 完成并合并
- 单元测试覆盖核心逻辑
- 无 P0/P1 bugs 引入
- 通知实时性 < 1 秒
- 导出功能支持大数据量（分页）

---

*Planning completed by PM Agent on 2026-03-17*