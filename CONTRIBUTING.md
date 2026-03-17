# 贡献指南

感谢您对 AlphaArena 的关注！我们欢迎所有形式的贡献。

## 目录

- [行为准则](#行为准则)
- [如何贡献](#如何贡献)
- [开发环境设置](#开发环境设置)
- [项目架构](#项目架构)
- [代码规范](#代码规范)
- [提交规范](#提交规范)
- [Pull Request 流程](#pull-request-流程)
- [测试](#测试)
- [文档](#文档)
- [发布流程](#发布流程)

## 行为准则

### 我们的承诺

为了营造一个开放和友好的环境，我们承诺让参与我们的项目和社区的人员，无论其年龄、体型、残疾、种族、性别认同和表达、经验水平、教育程度、社会经济地位、国籍、外貌、种族、宗教或性取向如何，都能获得无骚扰的体验。

### 我们的标准

积极行为示例：

- 使用友好和包容的语言
- 尊重不同的观点和经验
- 优雅地接受建设性批评
- 关注对社区最有利的事情
- 对其他社区成员表示同理心

## 如何贡献

### 报告 Bug

如果您发现了 Bug，请通过 [GitHub Issues](https://github.com/gxcsoccer/AlphaArena/issues) 提交报告。

Bug 报告应包含：

1. **标题**：简洁描述问题
2. **描述**：详细描述问题
3. **复现步骤**：
   ```
   1. 打开 '...'
   2. 点击 '...'
   3. 滚动到 '...'
   4. 看到错误
   ```
4. **期望行为**：应该发生什么
5. **实际行为**：实际发生了什么
6. **截图**：如果适用，添加截图
7. **环境信息**：
   - 操作系统：[如 macOS 14.0]
   - Node.js 版本：[如 20.10.0]
   - 浏览器：[如 Chrome 120]

### 建议新功能

我们欢迎新功能建议！请在 Issue 中详细描述：

1. 功能描述
2. 使用场景
3. 期望的实现方式（如果有想法）

### 提交代码

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 开发环境设置

### 前置要求

- Node.js >= 18.0.0
- npm >= 9.0.0
- Git
- 推荐使用 VS Code

### 克隆仓库

```bash
git clone https://github.com/gxcsoccer/AlphaArena.git
cd AlphaArena
```

### 安装依赖

```bash
npm install
```

### 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填入必要的配置
```

### 运行开发服务器

```bash
# 前端开发服务器
npm run dev

# 后端开发服务器
npm run dev:server
```

### 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监听模式
npm run test:watch
```

### VS Code 推荐扩展

创建 `.vscode/extensions.json`：

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

## 项目架构

### 目录结构

```
AlphaArena/
├── src/
│   ├── api/              # REST API 服务
│   │   ├── server.ts     # Express 服务器
│   │   └── SupabaseRealtimeService.ts
│   │
│   ├── backtest/         # 回测引擎
│   │   ├── BacktestEngine.ts
│   │   └── types.ts
│   │
│   ├── client/           # 前端 React 应用
│   │   ├── components/   # React 组件
│   │   ├── hooks/        # 自定义 Hooks
│   │   ├── pages/        # 页面组件
│   │   ├── store/        # 状态管理
│   │   └── utils/        # 工具函数
│   │
│   ├── database/         # 数据访问层
│   │   ├── client.ts     # Supabase 客户端
│   │   ├── strategies.dao.ts
│   │   ├── trades.dao.ts
│   │   └── portfolios.dao.ts
│   │
│   ├── engine/           # 交易引擎
│   │   ├── TradingEngine.ts
│   │   ├── MarketSimulator.ts
│   │   └── RiskControl.ts
│   │
│   ├── matching/         # 撮合引擎
│   │   ├── MatchingEngine.ts
│   │   └── types.ts
│   │
│   ├── monitoring/       # 监控服务
│   │   ├── MonitoringService.ts
│   │   └── PriceMonitoringService.ts
│   │
│   ├── orderbook/        # 订单簿
│   │   ├── OrderBook.ts
│   │   ├── OrderBookService.ts
│   │   └── types.ts
│   │
│   ├── portfolio/        # 投资组合
│   │   ├── Portfolio.ts
│   │   └── types.ts
│   │
│   ├── strategy/         # 策略模块
│   │   ├── Strategy.ts           # 策略基类
│   │   ├── SMAStrategy.ts        # SMA 策略
│   │   ├── RSIStrategy.ts        # RSI 策略
│   │   ├── MACDStrategy.ts       # MACD 策略
│   │   ├── StrategyManager.ts    # 策略管理器
│   │   └── LeaderboardService.ts # 排行榜服务
│   │
│   ├── cli/              # 命令行工具
│   │   ├── runner.ts
│   │   └── realtime-runner.ts
│   │
│   └── utils/            # 工具函数
│       └── logger.ts
│
├── tests/                # 测试文件
│   ├── api/
│   ├── backtest/
│   ├── client/
│   ├── database/
│   ├── engine/
│   └── e2e/
│
├── docs/                 # 文档
│   ├── api/              # API 文档
│   └── guides/           # 使用指南
│
├── public/               # 静态资源
├── dist/                 # 构建输出
└── bin/                  # CLI 入口
```

### 核心模块

#### 1. 策略模块 (`src/strategy/`)

交易策略的核心实现，包含：

- 策略接口定义
- 内置策略实现
- 策略管理器

#### 2. 撮合引擎 (`src/matching/`)

订单撮合逻辑，实现价格-时间优先撮合算法。

#### 3. 订单簿 (`src/orderbook/`)

订单簿数据结构和管理。

#### 4. 回测引擎 (`src/backtest/`)

历史数据回测功能。

#### 5. API 服务 (`src/api/`)

REST API 和实时数据服务。

### 数据流

```
市场数据
    ↓
策略 (Strategy)
    ↓
信号 (Signal)
    ↓
订单 (Order)
    ↓
订单簿 (OrderBook)
    ↓
撮合引擎 (MatchingEngine)
    ↓
成交记录 (Trade)
    ↓
投资组合 (Portfolio)
    ↓
绩效统计 (Stats)
```

## 代码规范

### TypeScript 规范

1. **使用 TypeScript**：所有代码必须使用 TypeScript 编写

2. **类型定义**：
   ```typescript
   // ✅ 好
   interface StrategyConfig {
     name: string;
     params: Record<string, any>;
   }

   // ❌ 避免
   const config: any = {};
   ```

3. **命名约定**：
   - 接口：PascalCase (`Strategy`, `Order`)
   - 类：PascalCase (`MatchingEngine`, `Portfolio`)
   - 函数：camelCase (`generateSignal`, `executeOrder`)
   - 常量：UPPER_SNAKE_CASE (`MAX_ORDER_SIZE`)
   - 私有成员：前缀 `_` 或使用 `private`

4. **文件命名**：
   - 组件文件：PascalCase (`TradingOrder.tsx`)
   - 工具文件：camelCase (`logger.ts`)
   - 类型文件：`types.ts`

### ESLint 配置

项目使用 ESLint 进行代码检查：

```bash
# 检查代码
npm run lint

# 自动修复
npm run lint:fix
```

### Prettier 配置

使用 Prettier 进行代码格式化：

```bash
# 格式化代码
npm run format

# 检查格式
npm run format:check
```

### JSDoc 注释

为公共 API 添加 JSDoc 注释：

```typescript
/**
 * 计算简单移动平均线
 * 
 * @param prices - 价格数组
 * @param period - 计算周期
 * @returns 移动平均值
 * 
 * @example
 * ```typescript
 * const ma = calculateSMA([100, 101, 102], 3);
 * // ma = 101
 * ```
 */
export function calculateSMA(prices: number[], period: number): number {
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}
```

## 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

### 提交消息格式

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### 类型 (type)

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具相关

### 示例

```
feat(strategy): add MACD strategy implementation

- Add MACD calculation function
- Add signal generation logic
- Add unit tests

Closes #123
```

```
fix(orderbook): fix order sorting in bid side

Orders were sorted incorrectly when multiple orders had the same price.
Now using timestamp as secondary sort key.

Fixes #456
```

## Pull Request 流程

### 创建 PR

1. **标题格式**：`<type>(<scope>): <description>`
   - 示例：`feat(strategy): add MACD strategy`

2. **描述模板**：
   ```markdown
   ## 描述
   
   简要描述此 PR 的目的和实现方式。

   ## 变更类型
   
   - [ ] 新功能
   - [ ] Bug 修复
   - [ ] 重构
   - [ ] 文档更新
   - [ ] 其他

   ## 测试
   
   描述如何测试这些变更。

   ## 检查清单
   
   - [ ] 代码遵循项目规范
   - [ ] 已添加测试
   - [ ] 所有测试通过
   - [ ] 文档已更新
   ```

### PR 审查

1. 至少需要一位审查者批准
2. 所有 CI 检查必须通过
3. 解决所有审查意见

### 合并规则

- 使用 Squash Merge
- 删除功能分支

## 测试

### 测试结构

```
tests/
├── unit/           # 单元测试
├── integration/    # 集成测试
├── e2e/            # 端到端测试
└── __mocks__/      # Mock 文件
```

### 编写测试

```typescript
describe('SMAStrategy', () => {
  let strategy: SMAStrategy;

  beforeEach(() => {
    strategy = new SMAStrategy({ shortPeriod: 5, longPeriod: 20 });
  });

  describe('generateSignal', () => {
    it('should return buy signal on golden cross', () => {
      // 准备数据
      for (let i = 0; i < 25; i++) {
        strategy.onData({ close: 100 + i });
      }

      // 执行
      const signal = strategy.generateSignal();

      // 断言
      expect(signal).not.toBeNull();
      expect(signal?.type).toBe('buy');
    });
  });
});
```

### 测试覆盖率

我们期望保持较高的测试覆盖率：

- 行覆盖率：>= 80%
- 分支覆盖率：>= 70%
- 函数覆盖率：>= 80%

查看覆盖率报告：

```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

## 文档

### 文档结构

```
docs/
├── api/
│   └── openapi.yaml    # OpenAPI 规范
│
└── guides/
    ├── quick-start.md          # 快速开始
    ├── strategy-development.md # 策略开发指南
    ├── backtesting.md          # 回测说明
    └── faq.md                  # 常见问题
```

### 文档更新

当添加新功能或修改 API 时，请同时更新相关文档：

1. 更新 README.md（如需要）
2. 更新 API 文档（`docs/api/openapi.yaml`）
3. 添加或更新使用指南

### JSDoc 生成

使用 TypeDoc 生成 API 文档：

```bash
npx typedoc --out docs/api-reference src/
```

## 发布流程

### 版本号规则

遵循 [语义化版本](https://semver.org/)：

- `MAJOR.MINOR.PATCH`
- MAJOR：不兼容的 API 变更
- MINOR：向后兼容的新功能
- PATCH：向后兼容的 Bug 修复

### 发布步骤

1. **准备发布**：
   ```bash
   # 更新版本号
   npm version minor  # 或 major/patch

   # 更新 CHANGELOG.md
   ```

2. **构建和测试**：
   ```bash
   npm run build
   npm test
   ```

3. **创建标签**：
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

4. **发布到 npm**（如适用）：
   ```bash
   npm publish
   ```

5. **创建 GitHub Release**：
   - 前往 GitHub Releases
   - 创建新 Release
   - 填写变更日志

## 获取帮助

- **GitHub Issues**：提交 Bug 报告或功能建议
- **GitHub Discussions**：讨论问题或分享想法
- **查阅文档**：先查阅现有文档

---

再次感谢您的贡献！🙏