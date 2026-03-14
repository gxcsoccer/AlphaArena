# Supabase Realtime 调研报告

**调研日期**: 2026-03-12  
**调研人**: VirtuCorp PM Agent  
**Issue**: #47

---

## 1. Supabase Realtime 核心功能

### 1.1 三大核心特性

| 功能 | 描述 | 适用场景 |
|------|------|----------|
| **Broadcast** | 客户端间低延迟消息传递 | 实时消息、游标跟踪、游戏事件、自定义通知 |
| **Presence** | 跨客户端用户状态同步 | 在线状态显示、活跃用户计数 |
| **Postgres Changes** | 数据库变更实时订阅 | 快速开发测试、低连接数场景 |

### 1.2 技术架构

- 基于 **Elixir + Phoenix Framework** 构建
- 全球分布式集群部署
- 通过 WebSocket 连接客户端
- 支持两种协议版本：1.0.0 和 2.0.0

### 1.3 客户端 SDK

```typescript
// 安装
npm install @supabase/supabase-js

// 初始化
import { createClient } from '@supabase/supabase-js'
const supabase = createClient('https://<project>.supabase.co', '<anon_key>')

// 创建频道
const channel = supabase.channel('room:123:messages', {
  config: { private: true },
})

// 监听消息
channel
  .on('broadcast', { event: 'message_sent' }, (payload) => {
    console.log('New message:', payload.payload)
  })
  .subscribe()

// 发送消息
channel.send({
  type: 'broadcast',
  event: 'message_sent',
  payload: { text: 'Hello!', user: 'john', timestamp: new Date().toISOString() },
})

// 清理订阅
supabase.removeChannel(channel)
```

### 1.4 三种消息发送方式

1. **客户端 SDK** - 适用于前端直接通信
2. **HTTP/REST API** - 适用于服务端应用
3. **数据库触发器** - 自动广播数据库变更

---

## 2. 我们的使用场景分析

### 2.1 订单簿实时更新（高频，低延迟）

**需求特点**:
- 高频率更新（可能每秒数十次）
- 低延迟要求（<100ms）
- 大量并发连接

**Supabase Realtime 适配性**: ⚠️ **中等**

| 指标 | Free 计划 | Pro 计划 ($25/月) | Pro (无消费上限) |
|------|-----------|-------------------|------------------|
| 并发连接数 | 200 | 500 | 10,000 |
| 消息/秒 | 100 | 500 | 2,500 |
| 频道加入/秒 | 100 | 500 | 2,500 |

**分析**: 
- Free/Pro 计划的消息频率限制（100-500 msg/s）可能不足以支撑高频订单簿更新
- 需要 Pro (无消费上限) 或 Team/Enterprise 计划才能达到 2,500 msg/s
- 基准测试显示中位延迟 6ms，p95 延迟 28ms，p99 延迟 213ms —— 延迟表现良好

### 2.2 行情数据推送（中频）

**需求特点**:
- 中等频率更新（每秒数次）
- 中等延迟容忍度

**Supabase Realtime 适配性**: ✅ **良好**

- Pro 计划的 500 msg/s 足够支撑中频行情推送
- 可以使用 Broadcast 功能直接推送

### 2.3 交易状态更新（低频）

**需求特点**:
- 低频率更新
- 可靠性要求高

**Supabase Realtime 适配性**: ✅ **优秀**

- 任何计划都能轻松支撑
- 可使用 Postgres Changes 自动同步数据库状态

---

## 3. 技术对比：Socket.IO vs Supabase Realtime

### 3.1 核心差异

| 维度 | Socket.IO | Supabase Realtime |
|------|-----------|-------------------|
| **类型** | 开源库（需自托管） | 托管服务（BaaS） |
| **协议** | WebSocket + 轮询降级 | WebSocket |
| **部署** | 自行部署（Railway/VPS） | 无需部署，开箱即用 |
| **数据库集成** | 手动实现 | 原生 Postgres Changes |
| **认证集成** | 手动实现 | 原生 Supabase Auth + RLS |
| **扩展性** | 取决于服务器配置 | 托管集群自动扩展 |

### 3.2 并发连接数限制

| 服务 | Free | Paid |
|------|------|------|
| **Supabase Realtime** | 200 | 500 (Pro) / 10,000+ (Team/Enterprise) |
| **Socket.IO (自托管)** | 取决于服务器配置 | 取决于服务器配置 |

**Socket.IO 自托管参考**（基于典型 VPS 配置）:
- 2GB RAM VPS: ~2,000-5,000 并发连接
- 4GB RAM VPS: ~5,000-10,000 并发连接
- 需要自行配置负载均衡和集群扩展

### 3.3 消息频率限制

| 服务 | Free | Paid |
|------|------|------|
| **Supabase Realtime** | 100 msg/s | 500 (Pro) / 2,500+ (Team/Enterprise) |
| **Socket.IO (自托管)** | 无限制（取决于服务器性能） | 无限制（取决于服务器性能） |

### 3.4 延迟表现

**Supabase Realtime 基准测试数据**:

| 场景 | 并发用户 | 中位延迟 | p95 延迟 | p99 延迟 |
|------|----------|----------|----------|----------|
| Broadcast (WebSocket) | 32,000 | 6ms | 28ms | 213ms |
| Broadcast (大规模) | 250,000 | 58ms | 279ms | 508ms |
| Auth + RLS | 50,000 | 19ms | 49ms | 96ms |
| DB 触发广播 | 80,000 | 46ms | 132ms | 159ms |

**Socket.IO 延迟**（自托管，取决于部署位置）:
- 同区域：~10-50ms
- 跨区域：~50-200ms
- 需要自行优化和监控

### 3.5 开发体验对比

| 特性 | Socket.IO | Supabase Realtime |
|------|-----------|-------------------|
| **前端代码量** | 中等（需手动管理连接） | 低（SDK 封装完善） |
| **后端代码量** | 高（需实现业务逻辑） | 低（可使用 DB 触发器） |
| **认证集成** | 手动实现 | 原生支持（RLS） |
| **调试工具** | 需自行搭建 | 内置 Realtime Inspector |
| **文档质量** | 良好 | 优秀 |

---

## 4. 成本评估

### 4.1 Supabase Realtime 定价（2026 年最新）

| 计划 | 价格 | 并发连接 | 消息/秒 | 数据库 | Egress | MAU |
|------|------|----------|---------|--------|--------|-----|
| **Free** | $0/月 | 200 | 100 | 500MB | 5GB | 50,000 |
| **Pro** | $25/月 | 500 | 500 | 8GB | 250GB | 100,000 |
| **Pro (无上限)** | $25/月 + 用量 | 10,000 | 2,500 | 8GB | 250GB | 100,000 |
| **Team** | $25/月 + 用量 | 10,000 | 2,500 | 8GB | 250GB | 100,000 |
| **Enterprise** | 定制 | 10,000+ | 2,500+ | 定制 | 定制 | 定制 |

**超出配额计费**:
- 数据库存储：$0.021/GB/月
- Egress：$0.09/GB
- MAU：$0.00325/用户（超出部分）

### 4.2 当前 Socket.IO 部署成本（Railway）

**Railway 典型成本**:
- Basic 计划：~$5-20/月（取决于资源使用）
- 资源计费：CPU ~$0.0000083/秒，RAM ~$0.0000055/秒
- 预估月度成本：$10-50/月（取决于流量）

### 4.3 成本对比总结

| 方案 | 月度成本 | 包含服务 | 额外成本 |
|------|----------|----------|----------|
| **Socket.IO (Railway)** | $10-50 | 仅 WebSocket 服务 | 数据库、认证需另计 |
| **Supabase Free** | $0 | 数据库 + Auth + Realtime + Storage | 配额有限 |
| **Supabase Pro** | $25+ | 数据库 + Auth + Realtime + Storage | 用量超出资费 |

**关键洞察**: 
- Supabase 提供**完整后端栈**（数据库、认证、存储、Realtime），而 Socket.IO 仅解决 WebSocket 通信
- 如果已经使用 Supabase 数据库，Realtime 是自然延伸
- 如果使用独立数据库（如 PostgreSQL on Railway），迁移到 Supabase 需要考虑数据库迁移成本

---

## 5. 迁移可行性分析

### 5.1 当前 Socket.IO 代码迁移工作量

**假设当前架构**:
```
前端 (React/Vue) ←→ Socket.IO 客户端 ←→ Socket.IO 服务器 (Railway) ←→ PostgreSQL
```

**目标架构**:
```
前端 (React/Vue) ←→ Supabase JS SDK ←→ Supabase Realtime ←→ Supabase PostgreSQL
```

**迁移工作项**:

| 模块 | 工作量 | 说明 |
|------|--------|------|
| **前端 SDK 替换** | 2-4 小时 | 替换 Socket.IO 客户端为 Supabase SDK |
| **连接管理** | 2-4 小时 | 频道订阅/取消订阅逻辑 |
| **消息格式适配** | 2-4 小时 | 事件命名和 payload 结构调整 |
| **后端触发器** | 4-8 小时 | 如需使用 DB 触发器自动广播 |
| **认证集成** | 4-8 小时 | 如使用 Supabase Auth 需适配 RLS 策略 |
| **测试与调试** | 4-8 小时 | 端到端测试、性能测试 |

**总估算**: **18-36 小时**（约 3-5 工作日）

### 5.2 API 差异

| 操作 | Socket.IO | Supabase Realtime |
|------|-----------|-------------------|
| 连接 | `io(url)` | `createClient(url, key)` |
| 加入频道 | `socket.join('room')` | `channel('room:123:messages').subscribe()` |
| 发送消息 | `socket.emit('event', data)` | `channel.send({ type: 'broadcast', event, payload })` |
| 监听消息 | `socket.on('event', cb)` | `channel.on('broadcast', { event }, cb)` |
| 离开频道 | `socket.leave('room')` | `supabase.removeChannel(channel)` |

### 5.3 客户端改造成本

**前端代码示例对比**:

**Socket.IO (当前)**:
```typescript
import io from 'socket.io-client'
const socket = io('https://api.example.com')

socket.on('connect', () => console.log('connected'))
socket.on('orderbook:update', (data) => updateOrderBook(data))
socket.emit('subscribe:orderbook', { symbol: 'BTC-USD' })
```

**Supabase Realtime (目标)**:
```typescript
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, anonKey)
const channel = supabase.channel('orderbook:BTC-USD')

channel.on('broadcast', { event: 'update' }, (payload) => updateOrderBook(payload.payload))
channel.subscribe()
```

**改造难度**: ⚠️ **中等**
- API 概念相似（连接、订阅、发送、监听）
- 但需要理解频道（Channel）和主题（Topic）命名约定
- 需要处理认证和 RLS 策略

---

## 6. 迁移建议

### 6.1 推荐决策：**有条件推荐** ⚠️

**推荐条件**:
1. ✅ 项目处于早期阶段，可以接受架构调整
2. ✅ 愿意将数据库迁移到 Supabase PostgreSQL（或已在使用）
3. ✅ 并发连接需求 < 10,000，消息频率 < 2,500/s
4. ✅ 希望减少运维负担（无需管理 WebSocket 服务器）

**不推荐情况**:
1. ❌ 已有成熟的 Socket.IO 架构且运行稳定
2. ❌ 需要超高频率更新（>2,500 msg/s）且预算有限
3. ❌ 需要完全控制 WebSocket 服务器配置
4. ❌ 数据库无法迁移到 Supabase（合规、数据主权等原因）

### 6.2 推荐方案（如决定迁移）

#### 阶段 1: 并行运行（1-2 周）
- 保持现有 Socket.IO 服务
- 搭建 Supabase 项目，配置 Realtime
- 实现双写：消息同时发送到 Socket.IO 和 Supabase
- 小流量用户切换到 Supabase 客户端

#### 阶段 2: 逐步迁移（2-3 周）
- 按功能模块逐步迁移（先低频场景，后高频场景）
- 建议迁移顺序：
  1. 交易状态更新（低频，风险低）
  2. 行情数据推送（中频）
  3. 订单簿实时更新（高频，风险高）

#### 阶段 3: 完全切换（1 周）
- 所有流量切换到 Supabase Realtime
- 监控性能和错误率
- 确认稳定后关闭 Socket.IO 服务

### 6.3 时间估算

| 阶段 | 时间 | 人力 |
|------|------|------|
| 调研与方案设计 | 已完成 | 1 PM |
| 前端 SDK 替换 | 3-5 天 | 1 Dev |
| 后端触发器配置 | 2-3 天 | 1 Dev |
| 测试与调试 | 3-5 天 | 1 Dev + 1 QA |
| 灰度发布 | 1-2 周 | 1 Dev |
| **总计** | **3-4 周** | **1-2 人** |

### 6.4 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 消息延迟增加 | 中 | 高 | 并行运行期间对比延迟数据 |
| 连接稳定性问题 | 中 | 高 | 实现自动重连和降级机制 |
| 成本超预算 | 低 | 中 | 设置消费上限告警 |
| 数据库迁移复杂 | 高 | 高 | 如不迁移数据库，仅使用 Realtime Broadcast |

---

## 7. 替代方案建议

如果不完全迁移到 Supabase，可考虑以下混合方案：

### 方案 A: 仅使用 Supabase Realtime Broadcast（不迁移数据库）
- 保持现有数据库
- 使用 Supabase Realtime 仅作为消息推送服务
- 通过 HTTP API 或服务器发送消息到 Realtime
- **优点**: 最小化数据库迁移风险
- **缺点**: 无法使用 Postgres Changes 自动同步

### 方案 B: 优化现有 Socket.IO 部署
- 评估 Railway 部署性能瓶颈
- 考虑迁移到更低延迟的 hosting（如 Vercel Edge + WebSocket）
- 实现连接池和消息批处理优化
- **优点**: 保持技术栈稳定
- **缺点**: 仍需自行运维

### 方案 C: 使用专业实时服务（如 Ably、Pusher）
- Ably、Pusher 等专业实时消息服务
- 更高的 SLA 保证和全球边缘网络
- **优点**: 企业级可靠性
- **缺点**: 成本更高（Ably 起价 ~$50/月）

---

## 8. 结论

**最终建议**: 

对于 AlphaArena 项目，如果满足以下条件，**推荐迁移到 Supabase Realtime**:

1. 愿意接受 3-4 周的迁移周期
2. 并发连接需求在 Supabase 配额范围内
3. 希望整合后端栈（数据库 + Auth + Realtime）减少运维

**否则**，建议继续优化现有 Socket.IO 部署，或采用混合方案（方案 A）。

**下一步行动**:
- [ ] 与投资人确认迁移意向
- [ ] 如确认迁移，创建 Issue 分配 Dev 执行
- [ ] 如不迁移，关闭本调研 Issue

---

**参考资料**:
- [Supabase Realtime 文档](https://supabase.com/docs/guides/realtime)
- [Supabase Realtime 限制](https://supabase.com/docs/guides/realtime/limits)
- [Supabase Realtime 基准测试](https://supabase.com/docs/guides/realtime/benchmarks)
- [Supabase 定价](https://supabase.com/pricing)
- [Socket.IO vs Supabase 对比](https://ably.com/compare/socketio-vs-supabase)
