# alphaarena-ux-restructuring-plan

_Saved: 2026-03-22_

# AlphaArena 用户体验重构计划

## 背景
用户反馈当前产品功能很散、不清晰，需要完整考虑用户操作动线。

## 核心发现

### 问题诊断
1. **菜单过深**：27 个一级菜单项，缺乏层级分组
2. **功能分散**：Dashboard 有 2 个、策略功能分散在 4 个页面、绩效分析在 3 个页面
3. **术语混乱**：中英文混用，命名不统一
4. **用户旅程缺失**：没有清晰的入门流程

### 用户真正需求
目标用户是量化交易爱好者和独立交易者，核心需求是：
1. 验证交易想法是否可行
2. 测试策略表现
3. 改进优化策略
4. 学习量化交易

## 整合方案

### 三大核心模块
```
📊 仪表板 (Dashboard) - 首页
🤖 策略中心 (Strategy) - 策略全生命周期管理
💰 交易 (Trading) - 行情、下单、持仓管理
⚙️ 设置 - 账户、订阅、配置
🏆 排行榜 - 独立社区功能
```

### 页面合并映射
| 原页面 | 合并到 |
|--------|--------|
| Dashboard + User Dashboard | Dashboard (首页) |
| Performance + Attribution + Risk + Sentiment | Dashboard → Tab |
| Strategies + Comparison + Portfolio + Backtest + CopyTrading + Marketplace | Strategy → Tab |
| Index + Trades + Holdings + AdvancedOrders + VirtualAccount + Journal + Rebalance | Trading → Tab |

## 优先级
1. **P0**: 菜单分组重构
2. **P0**: Dashboard 首页整合
3. **P1**: 策略中心模块化
4. **P1**: 交易模块整合
5. **P2**: 设置页面整合

## 建议创建的 Issues
1. P0: 菜单分组重构 - 将 27 个菜单项整合为 5 大模块
2. P0: Dashboard 首页整合 - 合并两个仪表板
3. P1: 策略中心模块化 - Tab 式策略管理
4. P1: 交易模块整合 - 整合交易相关功能
5. P2: 设置页面整合 - 整合账户和配置

## 成功指标
- 菜单项从 27 个减少到 6 个
- 新用户完成首次策略运行时间 < 10 分钟
- 用户反馈"功能清晰"评分 > 4/5