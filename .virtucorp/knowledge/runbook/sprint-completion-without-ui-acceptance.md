# sprint-completion-without-ui-acceptance

_Saved: 2026-03-27_

# Sprint 完成但 UI Acceptance 阻塞的处理

## 场景
当所有代码工作已完成，但部署问题导致 UI acceptance tests 无法执行时。

## 处理步骤

1. **确认代码完成**
   - 所有 PR 已合并
   - CI 通过（Unit Tests 等）
   - 回顾报告已保存

2. **诊断部署问题**
   - 检查 GitHub Deployments API
   - 尝试不同的 Vercel URL
   - 检查构建日志

3. **创建追踪 Issue**
   - 标记为 P0
   - 详细描述问题和影响
   - 等待基础设施修复

4. **更新 Sprint 状态**
   - 状态改为 "complete"
   - 在回顾中记录阻塞问题

5. **通知 Investor**
   - 说明完成情况
   - 列出阻塞问题
   - 等待指示

## 注意事项
- 不要因为部署问题延误下一个 Sprint 的规划
- 部署问题需要人工干预时，及时升级给 investor