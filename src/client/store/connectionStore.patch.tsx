/**
 * Fix for Issue #178: WebSocket 连接断开
 * 
 * This patch modifies the connection handling to gracefully degrade
 * to REST API polling when Realtime is unavailable.
 */

// The key insight is that REST API works fine, but Realtime fails.
// We should show a degraded mode indicator instead of "disconnected".

// Changes needed in connectionStore.tsx:
// 1. Add "degraded" state when Realtime fails but REST works
// 2. Periodically check REST API health

// Changes needed in OfflineIndicator.tsx:
// 1. Show "实时推送暂停" instead of "连接断开" when in degraded mode
// 2. Show "API 正常，数据每 3 秒更新" to indicate degraded mode works
