# supabase-private-api-wrapper

_Saved: 2026-03-16_

# Supabase 私有 API 封装模式

## 背景

Supabase Realtime 的 `_off()` 方法是私有 API（标记为 `@internal`），用于移除单个监听器。目前没有公开的替代方案。

## 解决方案

创建类型安全的抽象层 (`listener-utils.ts`)：

```typescript
interface RealtimeChannelInternal {
  _off(type: string, filter: RealtimeFilter): RealtimeChannel;
}

export function removeChannelListener(
  channel: RealtimeChannel,
  type: 'broadcast' | 'presence' | 'postgres_changes',
  filter: RealtimeFilter
): void {
  const internalChannel = channel as unknown as RealtimeChannelInternal;
  internalChannel._off(type, filter);
}
```

## 优势

1. **类型安全** - 无需 `as any`
2. **集中管理** - 单一位置更新
3. **清晰文档** - 标注风险和理由
4. **易于迁移** - Supabase 提供公开 `off()` 后可无缝切换

## 注意事项

- `_off` 方法自 realtime-js v1 以来稳定，但仍需监控 Supabase 版本更新
- 添加监听器的 `(channel as any).on()` 也需要类似处理（待完成）

## 参考

- PR #190: 实现此模式
- Issue #187: 原始问题