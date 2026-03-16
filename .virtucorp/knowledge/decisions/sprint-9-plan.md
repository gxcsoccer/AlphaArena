# sprint-9-plan

_Saved: 2026-03-16_

# Sprint 9 规划

_Saved: 2026-03-16_

## Sprint 信息

- **Sprint 编号：** 9
- **周期：** 2026-04-01 → 2026-04-07
- **Milestone：** #10
- **主题：** 质量工程与基础设施改进

## 背景

Sprint 8 已完成：
- 修复了 Trades 和 Holdings 页面回归问题
- 添加了页面导航 E2E 测试
- 项目稳定运行

从 Sprint 7/8 回顾中提取的技术债务：
- E2E 测试未集成到 CI/CD
- 使用了 Supabase 私有 API `_off`，存在版本风险
- E2E 测试覆盖范围有限

## 目标

1. **CI/CD 集成** - 将 E2E 测试自动化，提升开发效率
2. **技术债务清理** - 消除私有 API 依赖风险
3. **测试覆盖扩展** - 增加交易流程 E2E 测试

## Issues

| Issue | 优先级 | 描述 |
|-------|--------|------|
| #186 | P1 | CI/CD 集成 - 将 E2E 测试加入 GitHub Actions |
| #187 | P2 | 解决 Supabase 私有 API 依赖风险 |
| #188 | P2 | 扩展 E2E 测试覆盖 - 交易流程测试 |

## 详细规划

### Issue #186: CI/CD 集成

**目标：** 建立 GitHub Actions 工作流，自动化 E2E 测试

**任务：**
1. 创建 `.github/workflows/e2e-test.yml`
2. 配置测试环境（依赖、服务启动）
3. 运行 Playwright 测试
4. 上传 artifacts（截图、报告）
5. 配置分支保护规则

**技术考虑：**
- 使用 Playwright 官方 GitHub Action
- 考虑测试并行化
- 缓存依赖加速运行

### Issue #187: 私有 API 依赖

**目标：** 消除对 Supabase `_off` 私有 API 的依赖

**任务：**
1. 调研 Supabase Realtime v2 API
2. 寻找官方取消订阅方式
3. 实现替代方案
4. 添加单元测试
5. 验证功能正确

**风险：** 如果官方暂无替代方案，需评估升级 SDK 版本的可行性

### Issue #188: E2E 测试扩展

**目标：** 覆盖核心交易流程的端到端测试

**测试范围：**
- 订单提交流程（限价单、市价单、取消）
- 订单簿交互（显示、点击填充）
- 持仓展示（加载、更新）
- 交易历史（加载、分页）

**预期：** 新增 15+ 个测试用例

## 验收标准

- [ ] GitHub Actions E2E 测试工作流可用
- [ ] PR 提交自动运行测试
- [ ] 私有 API 依赖已消除
- [ ] E2E 测试覆盖交易流程
- [ ] 所有测试通过

## 风险

1. **Supabase API 调研** - 官方可能暂无完美替代方案，需评估备选策略
2. **CI/CD 环境差异** - E2E 测试在 CI 环境可能需要额外配置
3. **测试数据隔离** - 交易流程测试需要 Mock 或测试环境

## 参考

- [Sprint 8 回顾](sprint-8-retrospective.md)
- [Sprint 7 回顾](../runbook/sprint-7-retrospective.md)