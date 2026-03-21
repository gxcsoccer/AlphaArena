# supabase-realtime-degraded-mode

_Saved: 2026-03-21_

# Supabase Realtime Degraded Mode

## 问题背景

Supabase Realtime 服务可能因基础设施问题返回 500 错误（Cloudflare Error 1101），导致 WebSocket 连接失败。

## 解决方案

应用实现了降级模式：

1. **自动检测**：通过 `isInfrastructureError()` 检测 Cloudflare 错误（1101, 522, 524 等）和 WebSocket 错误（CHANNEL_ERROR, TIMED_OUT, CLOSED 等）
2. **启动健康检查**：`performInitialHealthCheck()` 在 RealtimeClient 初始化时主动检查服务状态
3. **降级提示**：显示蓝色信息横幅「实时推送服务维护中，数据每 3 秒自动更新」
4. **HTTP 轮询**：降级模式下每 3 秒通过 HTTP 获取数据更新
5. **自动恢复**：持续健康检查，服务恢复后自动切换回 WebSocket

## 关键代码位置

- `/src/lib/realtime.ts` - RealtimeClient 类，降级检测逻辑
- `/src/components/OfflineIndicator.tsx` - 降级模式 UI 横幅

## 投资者需知

如果生产环境持续显示降级模式，需要在 Supabase 后台启用 Realtime 功能：
1. 进入 Database > Replication
2. 启用项目 Realtime
3. 为需要的表启用 Realtime（strategies, trades, portfolios, leaderboard_entries）