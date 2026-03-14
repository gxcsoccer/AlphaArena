## 背景
投资人已批准将 WebSocket 服务从 Socket.IO (Railway) 迁移到 Supabase Realtime。

## 迁移目标
- 使用 Supabase Realtime Broadcast 替代 Socket.IO
- 保留现有功能：订单簿更新、行情推送、交易状态更新
- 降低运维成本，统一使用 Supabase 平台

## 迁移任务

### 阶段 1: 准备工作 (2-3 天)
- [ ] 配置 Supabase Realtime（开通服务、配置密钥）
- [ ] 安装 Supabase Realtime 客户端 SDK
- [ ] 创建 Realtime Channels 和 Topics 规划

### 阶段 2: 后端改造 (3-4 天)
- [ ] 移除 Socket.IO 服务器代码
- [ ] 实现 Supabase Realtime Broadcast 发送逻辑
- [ ] 实现数据库变更触发 Realtime 推送（如需要）
- [ ] 保留 Railway 部署作为回滚方案

### 阶段 3: 前端改造 (3-4 天)
- [ ] 移除 Socket.IO 客户端代码
- [ ] 集成 Supabase Realtime 客户端 SDK
- [ ] 实现 Channel 订阅和消息处理
- [ ] 实现 Presence 功能（在线状态）
- [ ] 更新订单簿、行情、交易组件

### 阶段 4: 测试和验证 (3-4 天)
- [ ] 单元测试
- [ ] 集成测试
- [ ] 性能测试（延迟、并发）
- [ ] 灰度发布验证

### 阶段 5: 切换和回滚 (1-2 天)
- [ ] 生产环境切换
- [ ] 监控和日志
- [ ] 回滚方案准备

## 技术要点

### Supabase Realtime API
- Broadcast: channel.send({ type: 'broadcast', event: 'message', payload: {...} })
- Presence: channel.on('presence', { event: 'sync' }, callback)
- Postgres Changes: channel.on('postgres_changes', { event: '*', schema, table }, callback)

### 消息 Topics 规划
- orderbook:{symbol} - 订单簿更新
- ticker:{symbol} - 行情数据
- trade:{userId} - 交易状态更新
- presence:traders - 交易员在线状态

## 验收标准
- 所有 Realtime 功能正常工作
- 延迟 < 50ms（p95）
- 并发连接支持 > 500
- 无消息丢失
- 回滚方案验证通过

## 时间估算
- 总周期：3-4 周
- 开发：10-12 工作日
- 测试：3-4 工作日
- 缓冲：2-3 工作日

## 参考文档
- https://supabase.com/docs/guides/realtime
- https://supabase.com/docs/guides/realtime/broadcast
- https://supabase.com/docs/guides/realtime/presence
