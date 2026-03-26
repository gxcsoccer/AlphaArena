# i18n 翻译 Key 命名规范

本文档定义了 AlphaArena 国际化翻译 key 的命名规范，确保翻译文件的一致性和可维护性。

## 命名空间划分

翻译文件按功能模块划分为不同的命名空间：

| 命名空间 | 文件 | 描述 |
|---------|------|------|
| `common` | common.json | 通用 UI 元素、按钮、标签、消息、验证 |
| `navigation` | navigation.json | 菜单项、路由、页面标题、面包屑 |
| `auth` | auth.json | 认证相关：登录、注册、登出、个人资料 |
| `trading` | trading.json | 交易相关：订单、成交、订单簿、持仓、条件单 |
| `portfolio` | portfolio.json | 投资组合、资产配置、持仓详情 |
| `strategy` | strategy.json | 策略管理、策略类型、策略表现 |
| `settings` | settings.json | 设置页面：通用、通知、安全、显示、API |
| `errors` | errors.json | 错误消息：通用错误、验证错误、API 错误 |
| `dashboard` | dashboard.json | 仪表盘：概览、图表、活动、统计 |
| `leaderboard` | leaderboard.json | 排行榜：排名、筛选、统计 |
| `backtest` | backtest.json | 回测：设置、结果、图表、操作 |
| `notification` | notification.json | 通知：类型、设置、状态 |

## Key 命名规范

### 基本格式

```
namespace.entity.action/state
```

### 层级结构

1. **第一层**: 功能区域或实体类型
2. **第二层**: 具体实体或操作类型
3. **第三层**: 具体操作、状态或属性

### 示例

```
common.button.submit         → "提交"（提交按钮）
common.label.name           → "名称"（名称标签）
common.message.success      → "操作成功"（成功消息）
common.validation.required  → "此字段为必填项"（必填验证）

navigation.menu.dashboard   → "仪表盘"（仪表盘菜单项）
navigation.page.home.title  → "首页标题"

auth.login.title            → "登录"
auth.register.passwordMismatch → "两次密码输入不一致"

trading.order.create        → "创建订单"
trading.order.status.filled → "已成交"
trading.position.pnl        → "盈亏"

strategy.type.trend         → "趋势跟踪"
strategy.performance.sharpeRatio → "夏普比率"
```

## 特殊命名约定

### 状态 (Status)

状态相关的 key 使用 `status` 作为第二层：

```json
{
  "order": {
    "status": {
      "pending": "待处理",
      "open": "未成交",
      "filled": "已成交"
    }
  }
}
```

### 类型 (Type)

类型相关的 key 使用 `type` 作为第二层：

```json
{
  "order": {
    "type": {
      "market": "市价单",
      "limit": "限价单"
    }
  }
}
```

### 操作 (Actions)

操作相关的 key 使用动词：

```json
{
  "button": {
    "submit": "提交",
    "cancel": "取消",
    "confirm": "确认"
  }
}
```

### 消息 (Messages)

消息相关的 key 使用 `message` 作为第一层：

```json
{
  "message": {
    "success": "操作成功",
    "error": "操作失败",
    "confirmDelete": "确定要删除吗？"
  }
}
```

### 验证 (Validation)

验证相关的 key 使用 `validation` 作为第一层：

```json
{
  "validation": {
    "required": "此字段为必填项",
    "email": "请输入有效的邮箱地址",
    "minLength": "最少需要 {{min}} 个字符"
  }
}
```

## 插值变量

使用双花括号 `{{variable}}` 表示插值变量：

```json
{
  "validation": {
    "minLength": "最少需要 {{min}} 个字符",
    "maxLength": "最多允许 {{max}} 个字符"
  },
  "format": {
    "currency": "{{value}} USDT",
    "percent": "{{value}}%"
  }
}
```

## 复数形式

如需支持复数形式，使用 `_one`, `_other` 后缀：

```json
{
  "item": {
    "count_one": "{{count}} 个项目",
    "count_other": "{{count}} 个项目"
  }
}
```

## 最佳实践

1. **保持 key 简洁**: 避免过长的 key，保持语义清晰
2. **一致性**: 同类功能使用相同的命名模式
3. **可读性**: key 应该能表达其用途
4. **避免嵌套过深**: 最多 3-4 层嵌套
5. **使用英文 key**: 即使翻译文件是中文，key 也使用英文

## 文件结构

翻译文件位于 `public/locales/` 目录，由 HTTP 后端按需加载（Issue #618）：

```
public/locales/
├── zh-CN/
│   ├── common.json
│   ├── navigation.json
│   ├── auth.json
│   ├── trading.json
│   ├── portfolio.json
│   ├── strategy.json
│   ├── settings.json
│   ├── errors.json
│   ├── dashboard.json
│   ├── leaderboard.json
│   ├── backtest.json
│   └── notification.json
├── en-US/
│   ├── common.json
│   ├── navigation.json
│   └── ...
├── ja-JP/
│   └── ...
└── ko-KR/
    └── ...
```

## 使用示例

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation('trading');
  
  return (
    <div>
      <h1>{t('order.create')}</h1>
      <button>{t('order.buy')}</button>
      <span>{t('order.status.filled')}</span>
    </div>
  );
}
```

## 相关文件

- i18n 配置: `src/client/i18n/index.ts`
- Locale Provider: `src/client/i18n/LocaleProvider.tsx`
- Hooks: `src/client/i18n/hooks.ts`