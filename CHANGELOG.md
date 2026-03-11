# Changelog

All notable changes to AlphaArena will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-03-18

### 新增

#### 🌐 Web 实时系统

- **React 前端应用** (Issue #17)
  - 5 个核心页面：Dashboard、Strategies、Trades、Holdings、Leaderboard
  - 实时数据更新 via WebSocket (Socket.IO)
  - 交互式图表 (Recharts): 饼图、柱状图、折线图、面积图、雷达图
  - Ant Design UI 组件库集成
  - 响应式布局，支持桌面和移动端
  - 自定义 Hooks 数据管理 (useData)
  - REST API 客户端封装

- **后端 API 服务** (Issue #14)
  - Express.js + Socket.IO 服务器
  - RESTful API 端点：
    - `GET /api/health` - 健康检查
    - `GET /api/strategies` - 策略列表
    - `GET /api/strategies/:id` - 策略详情
    - `PUT /api/strategies/:id` - 更新策略
    - `GET /api/trades` - 交易历史（支持筛选）
    - `GET /api/portfolio/:strategyId/:symbol` - 投资组合
    - `GET /api/stats` - 系统统计
    - `GET /api/leaderboard` - 排行榜（支持多维度排序）
  - WebSocket 事件推送：
    - `trade:new` - 新成交
    - `portfolio:update` - 持仓更新
    - `strategy:tick` - 策略心跳
    - `leaderboard:update` - 排行榜更新

- **实时交易引擎** (Issue #15)
  - 7x24 小时后台持续运行
  - 市场数据实时推送
  - 策略信号自动执行
  - WebSocket 房间订阅机制

#### 🤖 多策略管理

- **StrategyManager** (Issue #16)
  - 同时运行多个 AI 策略
  - 策略隔离：独立的投资组合、订单簿视图、上下文
  - 策略生命周期管理：启动、停止、暂停、恢复
  - 配置热更新支持
  - 数据库持久化（Supabase）
  - 策略间通信机制（可选）
  - 事件系统：策略状态变化、信号生成、成交记录

#### 🏆 排行榜系统

- **LeaderboardService** (Issue #18)
  - 多维度策略排名：
    - ROI (投资回报率)
    - Sharpe Ratio (夏普比率，年化)
    - Maximum Drawdown (最大回撤)
    - Total P&L (总盈亏)
    - Win Rate (胜率)
    - Total Volume (总成交量)
  - 高级统计指标：
    - 平均交易规模
    - 连续盈利/亏损次数
    - 最佳/最差交易
  - 历史快照功能
  - 排名变化追踪（📈/📉）
  - 前端可视化：排行榜表格、对比雷达图、ROI 趋势图

#### 🧠 LLM 策略集成

- **LLMClient** (Issue #19)
  - OpenAI 兼容 API 封装
  - 速率限制：Token Bucket 算法
  - 重试机制：指数退避
  - Token 使用追踪和成本估算
  - 事件系统：请求、响应、错误、限流、Token 使用

- **LLMStrategy** (Issue #19)
  - LLM 驱动的交易决策
  - Prompt 模板系统：
    - 市场分析 Prompt
    - 风险评估 Prompt
    - 交易决策 Prompt
  - 异步信号缓存（非阻塞）
  - 风险管理：
    - 置信度阈值过滤
    - 风险等级过滤
    - 每日预算限制
    - 冷却期控制
  - 决策日志：完整的审计追踪
  - 统计监控：Token 使用、成本、成功率

- **成本控制机制**
  - 每日预算硬限制
  - 速率限制防止 API 限流
  - 置信度过滤节省 Token
  - 实时成本追踪

#### 💾 数据持久化

- **Supabase 数据库** (Issue #13)
  - PostgreSQL 数据库
  - 核心表：
    - `strategies` - 策略配置和状态
    - `trades` - 成交记录
    - `portfolios` - 投资组合快照
    - `price_history` - 历史价格数据
    - `leaderboard_snapshots` - 排行榜快照
    - `leaderboard_entries` - 排行榜条目
  - DAO 层封装：类型安全的数据库操作
  - 筛选和分页支持
  - 统计和聚合方法

#### 🏗️ 项目基础设施

- **技术栈升级** (Issue #20)
  - React 19 + Vite 7
  - TypeScript 5.9+
  - Ant Design 6
  - Recharts 3
  - Socket.IO 4
  - React Router DOM 7
  - ESLint + Prettier 代码质量工具
  - Jest + Testing Library 测试框架

### 改进

#### 投资组合跟踪

- 增强 Portfolio 类 (Issue #3)
  - 多资产持仓管理
  - 平均成本计算优化
  - 实现盈亏（Realized P&L）计算
  - 未实现盈亏（Unrealized P&L）计算
  - 持仓快照功能

#### CLI 运行器

- 完善 CLI 工具 (Issue #6)
  - 回测引擎改进
  - 参数解析优化
  - 输出格式化（JSON/CSV）
  - 帮助文档完善

### 技术栈更新

- **前端**: React 19, Vite 7, TypeScript 5.9
- **UI 组件**: Ant Design 6
- **图表库**: Recharts 3
- **实时通信**: Socket.IO 4
- **路由**: React Router DOM 7
- **后端**: Express.js 5, Socket.IO 4
- **数据库**: Supabase (PostgreSQL)
- **测试**: Jest 30, Testing Library
- **部署**: Vercel, Railway, Render

### 测试

- 单元测试覆盖所有核心模块
- LLM 策略测试（28 个测试用例）
- StrategyManager 测试（27 个测试用例）
- LeaderboardService 测试
- 前端 API 客户端测试
- 数据库 DAO 层集成测试

### 文档

- 完整的 README.md 更新
- API 文档
- 部署指南（Vercel, Railway, Render）
- LLM API 配置说明
- 数据库 Schema 文档

---

## [1.0.0] - 2026-03-11

### 新增

#### OrderBook (订单簿)

- 实现订单簿数据结构，支持买卖订单队列
- 支持限价单 (Limit Order) 和市价单 (Market Order)
- 实现价格优先、时间优先的订单排序
- 支持订单的添加、取消和查询
- 提供订单簿深度查询功能

#### MatchingEngine (撮合引擎)

- 实现价格时间优先 (Price-Time Priority) 撮合算法
- 支持买单和卖单的自动撮合
- 生成详细的成交记录 (Trade)
- 支持部分成交和完全成交
- 提供撮合统计信息

#### Portfolio (投资组合)

- 实现投资组合跟踪功能
- 支持多资产持仓管理
- 实时计算持仓盈亏 (PnL)
- 跟踪现金余额和资金使用率
- 提供持仓明细和汇总报告

#### Strategy (策略框架)

- 定义策略接口 (Strategy Interface)
- 实现 SMA 交叉策略 (SMA Crossover Strategy)
  - 支持自定义短期和长期周期
  - 生成买入/卖出/持有信号
  - 基于均线交叉进行交易决策
- 支持策略信号生成和执行
- 提供策略绩效评估接口

#### CLI (命令行工具)

- 实现命令行运行器 (CLI Runner)
- 支持策略运行命令：`alpha-arena run`
- 支持回测命令：`alpha-arena backtest`
- 支持投资组合查询：`alpha-arena portfolio`
- 提供完整的帮助文档和参数验证
- 支持多种输出格式 (JSON, 表格)

#### Backtest (回测引擎)

- 实现历史数据回测功能
- 支持自定义回测时间范围
- 支持初始资金配置
- 生成回测报告，包括：
  - 总收益率
  - 夏普比率
  - 最大回撤
  - 交易次数
  - 胜率

### 技术栈

- TypeScript 5.9+
- Node.js 18+
- Jest (测试框架)
- Vercel (部署平台)

### 测试

- 单元测试覆盖率 > 80%
- 覆盖所有核心模块：OrderBook, MatchingEngine, Portfolio, Strategy, CLI

---

## 版本说明

- **[2.0.0]**: Sprint 2 发布 - Web 实时系统、多 AI 策略对战、LLM 集成、排行榜系统
- **[1.0.0]**: Sprint 1 MVP 发布 - 包含完整的交易模拟和回测功能

## Sprint 2 功能清单

| Issue # | 功能模块 | 描述 | 状态 |
|---------|---------|------|------|
| #20 | 项目基础设施 | React + Vite + TypeScript 技术栈配置 | ✅ 完成 |
| #13 | 数据持久化 | Supabase 数据库设计与实现 | ✅ 完成 |
| #14 | 后端 API 服务 | Express + WebSocket API | ✅ 完成 |
| #15 | 实时交易引擎 | 后台持续运行系统 | ✅ 完成 |
| #16 | 多策略管理 | StrategyManager 实现 | ✅ 完成 |
| #17 | Web 前端 | React 仪表盘和可视化 | ✅ 完成 |
| #18 | 排行榜系统 | 多维度策略排名 | ✅ 完成 |
| #19 | LLM 策略接口 | 大语言模型交易决策 | ✅ 完成 |

**总计**: 8 个 Issue 全部完成 🎉
