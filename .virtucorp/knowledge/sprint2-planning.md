# Sprint 2 Planning - Web 实时系统

**Date:** 2026-03-11
**Milestone:** Sprint 2 - Web 实时系统 (#2)
**Due:** 2026-03-18

## 背景
Sprint 1 完成了 CLI 版本的 MVP（订单簿、撮合引擎、组合跟踪、策略接口、SMA 策略）。
Sprint 2 将升级为完整的 Web 实时系统。

## 用户需求
1. **Web 界面** - 实时可视化展示 AI 策略的交易操作
2. **实时运行系统** - AI 策略 7x24 小时在后台交易
3. **多 AI 对战** - 多个 AI 策略同台竞技，有排行榜
4. **实时数据展示** - 订单簿、成交记录、持仓变化、收益曲线
5. **LLM 集成能力** - 支持对接大语言模型做交易决策

## Issues Created

| # | Title | Priority | Dependencies | Labels |
|---|-------|----------|--------------|--------|
| 13 | 数据持久化 - 数据库设计与实现 | P0 | None | type/feature, needs-investor-approval |
| 14 | 后端 API 服务 - WebSocket + REST | P0 | #13 | type/feature |
| 15 | 实时交易引擎 - 后台持续运行 | P0 | #1, #2, #13 | type/feature |
| 16 | 多策略管理 - 同时运行多个 AI 策略 | P1 | #4, #15 | type/feature |
| 17 | Web 前端 - React/Vue + 图表库 | P1 | #14 | type/feature |
| 18 | 排行榜系统 - 多 AI 策略对战 | P2 | #13, #16 | type/feature |
| 19 | LLM 策略接口 - 大语言模型交易决策 | P2 | #4, #15 | type/feature, needs-investor-approval |
| 20 | 项目基础设施 - 技术选型和配置 | P0 | None | type/chore |

## 开发顺序

### Phase 1: 基础设施 (Day 1-2)
1. **#20 项目基础设施** - 技术选型和配置，为后续开发奠定基础

### Phase 2: 核心后端 (Day 2-5)
2. **#13 数据持久化** - 基础架构，其他功能依赖它
3. **#15 实时交易引擎** - 依赖订单簿、撮合引擎、数据持久化
4. **#14 后端 API 服务** - 依赖数据持久化

### Phase 3: 策略管理 (Day 5-7)
5. **#16 多策略管理** - 依赖实时交易引擎

### Phase 4: 前端 (Day 7-10)
6. **#17 Web 前端** - 依赖后端 API

### Phase 5: 高级功能 (Day 10-14)
7. **#18 排行榜系统** - 依赖多策略管理和数据持久化
8. **#19 LLM 策略接口** - 可选，依赖实时交易引擎

## 技术选型决策

### 前端
- **框架**: React + Vite
- **图表库**: Recharts
- **UI 组件**: Ant Design
- **状态管理**: Zustand

### 后端
- **框架**: Express.js
- **WebSocket**: socket.io
- **数据库**: SQLite (开发) → PostgreSQL (生产)

### 部署
- **平台**: Vercel
- **前端**: Static Site
- **后端**: Serverless Functions
- **数据库**: Vercel Postgres

## 外部服务需求

### 需要投资者审批
1. **LLM API 服务** (Issue #19)
   - 提供商：OpenAI / Anthropic
   - 预计成本：$10-50/月
   - 用途：LLM 策略的交易决策

2. **数据库服务** (Issue #13)
   - 提供商：Vercel Postgres / Supabase
   - 预计成本：$0-25/月（免费额度可能足够）
   - 用途：生产环境数据持久化

## Labels Used
- type/feature: 功能开发
- type/chore: 基础设施配置
- priority/p0: 核心功能（基础设施、数据、交易引擎、API）
- priority/p1: 次要功能（多策略管理、前端）
- priority/p2: 可选功能（排行榜、LLM）
- agent/dev: 分配给开发 agent
- status/ready-for-dev: 准备开发
- needs-investor-approval: 需要投资者审批（LLM API、数据库服务）

## Notes
- 所有 Issues 已关联到 Sprint 2 Milestone
- 依赖关系在 Issue 描述中标注
- 验收标准已定义在每个 Issue 中
- LLM 策略接口为可选功能，如预算有限可推迟到 Sprint 3

## Completed
- ✅ **#20 项目基础设施** (PR #21) - 2026-03-11
  - React 19 + Vite 7 + TypeScript 配置完成
  - socket.io-client、Recharts、Ant Design 已安装
  - ESLint + Prettier 代码质量工具配置完成
  - vercel.json 部署配置更新
  - .env.example 模板创建（无真实 API Keys）
  - 16 个配置测试全部通过
