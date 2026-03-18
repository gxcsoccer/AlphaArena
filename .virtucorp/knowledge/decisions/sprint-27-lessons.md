# sprint-27-lessons

_Saved: 2026-03-18_

# Sprint 27 经验教训

## 技术决策

### 1. WebSocket 状态同步
- 使用 Supabase Realtime 作为 WebSocket 基础设施，避免重复造轮子
- 实现指数退避重连策略，初始延迟 1s，最大延迟 30s
- 断线期间缓存状态变更，重连后批量同步
- 多标签页通过 BroadcastChannel 同步状态

### 2. 试用期状态管理
- 数据库作为唯一真实数据源
- `TrialService` 统一管理试用状态，避免缓存不一致
- 定时任务（cron）检查试用期到期，每小时运行一次

### 3. 收入分析性能
- 建立订阅表的 `(user_id, status, created_at)` 复合索引
- 仪表板数据异步加载，避免阻塞页面渲染
- 考虑为大数据量场景添加 Redis 缓存层

## 避坑指南

### 1. WebSocket 内存泄漏
- 组件卸载时必须取消订阅
- 使用 `useEffect` cleanup 函数
- 注意 Supabase Realtime channel 的正确关闭方式

### 2. 试用期边界问题
- 使用 UTC 时间存储，避免时区问题
- 试用期结束时间精确到秒，避免整天粒度的歧义
- 前端显示时转换为用户时区

### 3. 文档维护
- docs/ 目录随代码一起管理
- PR review 时检查文档更新
- 关键功能添加代码注释，减少文档过时风险

## 待改进

1. WebSocket 集成测试缺失
2. 仪表板大数据量场景性能测试不足
3. 考虑自动化 API 文档生成（如 OpenAPI）

---
_Saved from Sprint 27 Retrospective - 2026-03-19_