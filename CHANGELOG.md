# Changelog

All notable changes to AlphaArena will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

- **[1.0.0]**: Sprint 1 MVP 发布 - 包含完整的交易模拟和回测功能
