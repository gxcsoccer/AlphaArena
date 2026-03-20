# sprint-35-test-stability-findings

_Saved: 2026-03-19_

# Sprint 35 测试稳定性发现

## Jest OOM 解决方案
- 调整 Jest 配置中的 `maxWorkers` 限制内存使用
- 优化 CI 工作流，增加内存限制参数
- 避免全量测试并行运行

## Mock 配置问题
- `moduleNameMapper` 配置错误导致模块解析失败
- 确保路径映射与项目结构一致

## 遗留技术债务
- @testing-library/dom 与 Jest 兼容性问题：约 200 个测试失败
- 项目整体约 3000 个 ESLint 问题待清理

## 建议
- 设定明确的测试通过率目标（>95%）
- 分批次清理 ESLint，考虑 pre-commit hook 防止新增问题